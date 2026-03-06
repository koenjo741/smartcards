import { Dropbox } from 'dropbox';
import { useState, useCallback, useEffect } from 'react';
import type { BackupData } from '../types';

export const DROPBOX_APP_KEY = 'ag0x9i8pgyothjr';
const REDIRECT_URI = window.location.origin + '/';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

interface SaveResult {
    success: boolean;
    errorType?: 'auth' | 'server_error' | 'network';
}

/** Exponential backoff delay: 1s, 2s, 4s */
const backoffDelay = (attempt: number) =>
    new Promise<void>(resolve => setTimeout(resolve, BASE_BACKOFF_MS * Math.pow(2, attempt)));

export function useDropbox() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [dbx, setDbx] = useState<Dropbox | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [connectionError, setConnectionError] = useState<boolean>(false);

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
                    .then(response => setUserName(response.result.name.display_name))
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

                newDbx.usersGetCurrentAccount()
                    .then(response => {
                        setUserName(response.result.name.display_name);
                        setLastSynced(new Date());
                    })
                    .catch((err: any) => {
                        if (err?.status === 401) {
                            localStorage.removeItem('dropbox_token');
                            setDbx(null);
                            setIsAuthenticated(false);
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
                    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
                    window.location.href = authUrl;
                } else {
                    setIsAuthChecking(false);
                }
            }
        }
    }, []);

    const connect = useCallback(() => {
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
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
                        setConnectionError(true);
                        setIsAuthenticated(false);
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
    const loadData = useCallback(async (): Promise<{ data: BackupData } | null> => {
        if (!dbx) return null;
        setIsSyncing(true);
        try {
            const response = await dbx.filesDownload({ path: '/smartcards.json' });
            const blob = (response.result as unknown as { fileBlob: Blob }).fileBlob;
            const text = await blob.text();

            setLastSynced(new Date());
            return { data: JSON.parse(text) as BackupData };
        } catch (error) {
            console.error('Dropbox download error:', error);
            return null;
        } finally {
            setIsSyncing(false);
        }
    }, [dbx]);

    const disconnect = useCallback(() => {
        localStorage.removeItem('dropbox_token');
        setDbx(null);
        setIsAuthenticated(false);
        setUserName(null);
    }, []);

    const uploadFile = useCallback(async (file: File) => {
        if (!dbx) {
            const token = localStorage.getItem('dropbox_token');
             if (token) {
                 // Try to create dbx dynamically if not initialized yet
                 const tempDbx = new Dropbox({ accessToken: token });
                 const safeName = file.name.replace(/[\\/:"*?<>|_]/g, '-');
                 const path = `/attachments/${Date.now()}_${safeName}`;
                 const response = await tempDbx.filesUpload({ path, contents: file });
                 return {
                     id: response.result.id,
                     name: file.name,
                     path: response.result.path_display || path,
                     type: file.type,
                     size: file.size,
                 };
             }
             throw new Error('Not connected to Dropbox');
        }

        const safeName = file.name.replace(/[\\/:"*?<>|_]/g, '-');
        const path = `/attachments/${Date.now()}_${safeName}`;

        const response = await dbx.filesUpload({ path, contents: file });

        return {
            id: response.result.id,
            name: file.name,
            path: response.result.path_display || path,
            type: file.type,
            size: file.size,
        };
    }, [dbx]);

    const getFileLink = useCallback(async (path: string) => {
        let client = dbx;
        if (!client) {
            const token = localStorage.getItem('dropbox_token');
            if (token) client = new Dropbox({ accessToken: token });
        }
        if (!client) return null;
        
        try {
            const response = await client.filesGetTemporaryLink({ path });
            return response.result.link;
        } catch {
            return null;
        }
    }, [dbx]);

    const getFileContent = useCallback(async (path: string) => {
        let client = dbx;
        if (!client) {
            const token = localStorage.getItem('dropbox_token');
            if (token) client = new Dropbox({ accessToken: token });
        }
        if (!client) return null;

        try {
            const response = await client.filesDownload({ path });
            return (response.result as unknown as { fileBlob: Blob }).fileBlob;
        } catch {
            return null;
        }
    }, [dbx]);

    const deleteFile = useCallback(async (path: string) => {
        let client = dbx;
        if (!client) {
            const token = localStorage.getItem('dropbox_token');
            if (token) client = new Dropbox({ accessToken: token });
        }
        if (!client) throw new Error('Not connected');
        
        try {
            await client.filesDeleteV2({ path });
            return true;
        } catch (error: unknown) {
            const dbxError = error as { error?: { error_summary?: string } };
            if (dbxError?.error?.error_summary?.includes('path_lookup/not_found')) {
                return true; // Already gone
            }
            console.error('Error deleting file:', error);
            return false;
        }
    }, [dbx]);

    return {
        isAuthenticated,
        isAuthChecking,
        userName,
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
