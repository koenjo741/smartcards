import { Dropbox } from 'dropbox';
import { useState, useCallback, useEffect } from 'react';
import type { BackupData } from '../types';

export const DROPBOX_APP_KEY = 'ag0x9i8pgyothjr';
const REDIRECT_URI = window.location.origin + '/';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

// Global cache for account info to prevent API spam when multiple components mount useDropbox
let cachedUserName: string | null = null;
let accountCheckPromise: Promise<any> | null = null;

interface SaveResult {
    success: boolean;
    errorType?: 'auth' | 'server_error' | 'network';
}

/** Exponential backoff delay: 1s, 2s, 4s */
const backoffDelay = (attempt: number) =>
    new Promise<void>(resolve => setTimeout(resolve, BASE_BACKOFF_MS * Math.pow(2, attempt)));

/** Wrapper to prevent Dropbox API from hanging indefinitely */
const withTimeout = <T>(promise: Promise<T>, ms: number = 30000): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Dropbox API Timeout after ${ms}ms`)), ms);
        promise.then(
            res => { clearTimeout(timer); resolve(res); },
            err => { clearTimeout(timer); reject(err); }
        );
    });
};

export type LoadResult =
    | { type: 'success'; data: BackupData; rev: string; contentHash: string; size: number }
    | { type: 'not_found' }
    | { type: 'error'; error: any };

export function useDropbox() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [dbx, setDbx] = useState<Dropbox | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [connectionError, setConnectionError] = useState<boolean>(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    const handleAuthError = useCallback(() => {
        setConnectionError(true);
        setIsAuthenticated(false);
        setDbx(null);
        setUserEmail(null);
        localStorage.removeItem('dropbox_token');
        cachedUserName = null;
        accountCheckPromise = null;
    }, []);


    // Handle Auth on Load (URL Hash OR LocalStorage)
    useEffect(() => {
        if (window.location.hash.includes('access_token')) {
            const params = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = params.get('access_token');

            if (accessToken) {
                localStorage.setItem('dropbox_token', accessToken);
                sessionStorage.removeItem('dropbox_auto_connect_attempted');
                const newDbx = new Dropbox({ accessToken });
                setDbx(newDbx);
                setIsAuthenticated(true);

                newDbx.usersGetCurrentAccount()
                    .then(response => {
                        setUserName(response.result.name.display_name);
                        setUserEmail(response.result.email);
                    })
                    .catch(console.error)
                    .finally(() => setIsAuthChecking(false));

                window.history.replaceState(null, '', ' ');
                setLastSynced(new Date());
            } else {
                setIsAuthChecking(false);
            }
        } else {
            const storedToken = localStorage.getItem('dropbox_token');
            if (storedToken) {
                const newDbx = new Dropbox({ accessToken: storedToken });
                setDbx(newDbx);
                setIsAuthenticated(true);

                if (!accountCheckPromise) {
                    accountCheckPromise = newDbx.usersGetCurrentAccount()
                        .then(response => {
                            cachedUserName = response.result.name.display_name;
                            setUserEmail(response.result.email);
                            return response;
                        })
                        .catch(err => {
                            accountCheckPromise = null;
                            throw err;
                        });
                }

                accountCheckPromise
                    .then(() => {
                        if (cachedUserName) setUserName(cachedUserName);
                        setLastSynced(new Date());
                    })
                    .catch((err: any) => {
                        if (err?.status === 401 || err?.error?.error_summary?.includes('expired_access_token')) {
                            handleAuthError();
                            if (!sessionStorage.getItem('dropbox_auto_connect_attempted')) {
                                sessionStorage.setItem('dropbox_auto_connect_attempted', '1');
                                const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&force_reapprove=true`;
                                window.location.href = authUrl;
                            }
                        } else {
                            // Transient error, don't clear token
                            console.warn("Failed to get current account (Dropbox transient error)", err);
                        }
                    })
                    .finally(() => setIsAuthChecking(false));
            } else {
                // Auto-connect: redirect to Dropbox OAuth if not yet attempted this session
                if (!sessionStorage.getItem('dropbox_auto_connect_attempted')) {
                    sessionStorage.setItem('dropbox_auto_connect_attempted', '1');
                    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&force_reapprove=true`;
                    window.location.href = authUrl;
                } else {
                    setIsAuthChecking(false);
                }
            }
        }
    }, []);

    const connect = useCallback(() => {
        // force_reapprove=true ensures Dropbox always shows the consent screen,
        // allowing the user to switch accounts if the wrong one is selected.
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&force_reapprove=true`;
        window.location.href = authUrl;
    }, []);

    // Save Data — always overwrite mode, with automatic retry for transient errors
    const saveData = useCallback(async (data: BackupData): Promise<SaveResult> => {
        if (!dbx) return { success: false };

        setIsSyncing(true);
        try {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    await dbx.filesUpload({
                        path: '/smartcards.json',
                        contents: blob,
                        mode: { '.tag': 'overwrite' },
                    });

                    setLastSynced(new Date());
                    setConnectionError(false);
                    return { success: true };

                } catch (error: any) {
                    const errorSummary = error?.error?.error_summary;
                    const status = error?.status;

                    // Auth error – no retry
                    if (status === 401 || errorSummary?.includes('expired_access_token')) {
                        handleAuthError();
                        return { success: false, errorType: 'auth' };
                    }

                    // Transient error (503, network) – retry with backoff
                    const isRetryable = status === 503 || !status;
                    if (isRetryable && attempt < MAX_RETRIES) {
                        console.warn(`Dropbox save attempt ${attempt + 1} failed, retrying...`);
                        await backoffDelay(attempt);
                        continue;
                    }

                    // Final failure
                    return { success: false, errorType: status === 503 ? 'server_error' : 'network' };
                }
            }

            return { success: false, errorType: 'network' };
        } finally {
            setIsSyncing(false);
        }
    }, [dbx]);

    // Load Data (Download latest file)
    const loadData = useCallback(async (): Promise<LoadResult> => {
        if (!dbx) return { type: 'error', error: 'Not authenticated' };
        setIsSyncing(true);
        try {
            const response = await dbx.filesDownload({ path: '/smartcards.json' });
            const result = response.result as any;
            const blob = (result as unknown as { fileBlob: Blob }).fileBlob;
            const text = await blob.text();
            const rev: string = result.rev ?? 'unknown';
            const contentHash: string = result.content_hash ?? 'unknown';
            const size: number = result.size ?? 0;

            console.log(`[Dropbox] loadData: rev=${rev} size=${size} content_hash=${contentHash.slice(0, 12)}...`);
            setLastSynced(new Date());
            return { type: 'success', data: JSON.parse(text) as BackupData, rev, contentHash, size };
        } catch (error: any) {
            const errorSummary = error?.error?.error_summary || '';
            // 409 path/not_found or 404
            if (error.status === 409 && errorSummary.includes('path/not_found')) {
                return { type: 'not_found' };
            }
            if (error.status === 404) {
                return { type: 'not_found' };
            }

            console.error('Dropbox download error:', error);
            return { type: 'error', error };
        } finally {
            setIsSyncing(false);
        }
    }, [dbx]);

    const disconnect = useCallback(() => {
        localStorage.removeItem('dropbox_token');
        // Block auto-reconnect so the user must explicitly choose to connect again.
        // Without this, the app immediately redirects to Dropbox OAuth on next load,
        // potentially reconnecting to the wrong account.
        sessionStorage.setItem('dropbox_auto_connect_attempted', '1');
        setDbx(null);
        setIsAuthenticated(false);
        setUserName(null);
        setUserEmail(null);
        cachedUserName = null;
        accountCheckPromise = null;
    }, []);

    const uploadFile = useCallback(async (file: File) => {
        let client = dbx;
        if (!client) {
            const token = localStorage.getItem('dropbox_token');
            if (token) client = new Dropbox({ accessToken: token });
        }
        if (!client) throw new Error('Not connected to Dropbox');

        const safeName = file.name.replace(/[\\/:"*?<>|_]/g, '-');
        const path = `/attachments/${Date.now()}_${safeName}`;

        try {
            const response = await withTimeout(client.filesUpload({ path, contents: file }), 60000); // 60s for uploads
            return {
                id: response.result.id,
                name: file.name,
                path: response.result.path_display || path,
                type: file.type,
                size: file.size,
            };
        } catch (error: any) {
            console.error('Dropbox upload error:', error);
            if (error?.status === 401 || error?.error?.error_summary?.includes('expired')) {
                handleAuthError();
            }
            throw error;
        }
    }, [dbx, handleAuthError]);

    const getFileLink = useCallback(async (path: string) => {
        let client = dbx;
        if (!client) {
            const token = localStorage.getItem('dropbox_token');
            if (token) client = new Dropbox({ accessToken: token });
        }
        if (!client) return null;
        
        try {
            const response = await withTimeout(client.filesGetTemporaryLink({ path }), 15000);
            return response.result.link;
        } catch (error: any) {
            console.error('Dropbox getFileLink error for path', path, error);
            if (error?.status === 401 || error?.error?.error_summary?.includes('expired')) {
                handleAuthError();
            }
            return null;
        }
    }, [dbx, handleAuthError]);

    const getFileContent = useCallback(async (path: string) => {
        let client = dbx;
        if (!client) {
            const token = localStorage.getItem('dropbox_token');
            if (token) client = new Dropbox({ accessToken: token });
        }
        if (!client) return null;

        try {
            const response = await withTimeout(client.filesDownload({ path }), 30000);
            return (response.result as unknown as { fileBlob: Blob }).fileBlob;
        } catch (error: any) {
            console.error('Dropbox getFileContent error for path', path, error);
            if (error?.status === 401 || error?.error?.error_summary?.includes('expired')) {
                handleAuthError();
            }
            throw error;
        }
    }, [dbx, handleAuthError]);

    const deleteFile = useCallback(async (path: string) => {
        let client = dbx;
        if (!client) {
            const token = localStorage.getItem('dropbox_token');
            if (token) client = new Dropbox({ accessToken: token });
        }
        if (!client) throw new Error('Not connected');
        
        try {
            await withTimeout(client.filesDeleteV2({ path }), 15000);
            return true;
        } catch (error: any) {
            console.error('Dropbox deleteFile error for path', path, error);
            if (error?.status === 401 || error?.error?.error_summary?.includes('expired')) {
                handleAuthError();
            }
            const dbxError = error as { error?: { error_summary?: string } };
            if (dbxError?.error?.error_summary?.includes('path_lookup/not_found')) {
                return true; // Already gone
            }
            console.error('Error deleting file:', error);
            return false;
        }
    }, [dbx, handleAuthError]);

    return {
        isAuthenticated,
        isAuthChecking,
        userName,
        userEmail,
        isSyncing,
        lastSynced,
        connectionError,
        connect,
        disconnect,
        saveData,
        loadData,
        uploadFile,
        getFileContent,
        deleteFile,
        getFileLink,
    };
}
