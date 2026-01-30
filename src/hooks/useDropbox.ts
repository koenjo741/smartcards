import { Dropbox } from 'dropbox';
import { useState, useCallback, useEffect } from 'react';
import type { BackupData } from '../types';

// REPLACE THIS WITH YOUR DROPBOX APP KEY
export const DROPBOX_APP_KEY = 'ag0x9i8pgyothjr';

const REDIRECT_URI = window.location.origin + '/'; // http://localhost:5173/

export function useDropbox() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true); // New: True initially
    const [dbx, setDbx] = useState<Dropbox | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [connectionError, setConnectionError] = useState<boolean>(false);

    // 1. Handle Auth on Load (Check URL Hash OR LocalStorage)
    useEffect(() => {
        // A. Check for new token in URL (Redirect from Dropbox)
        if (window.location.hash.includes('access_token')) {
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');

            if (accessToken) {
                // Save to LocalStorage
                localStorage.setItem('dropbox_token', accessToken);

                const newDbx = new Dropbox({ accessToken });
                setDbx(newDbx);
                setIsAuthenticated(true);

                // Get User Info
                newDbx.usersGetCurrentAccount()
                    .then(response => {
                        setUserName(response.result.name.display_name);
                    })
                    .catch(console.error)
                    .finally(() => setIsAuthChecking(false));

                // Clean URL
                window.history.replaceState(null, '', ' ');
                setLastSynced(new Date());
            } else {
                setIsAuthChecking(false);
            }
        }
        // B. Check for existing token in LocalStorage
        else {
            const storedToken = localStorage.getItem('dropbox_token');
            if (storedToken) {
                const newDbx = new Dropbox({ accessToken: storedToken });
                setDbx(newDbx);
                setIsAuthenticated(true);

                // Verify token & get user info
                newDbx.usersGetCurrentAccount()
                    .then(response => {
                        setUserName(response.result.name.display_name);
                        setLastSynced(new Date());
                    })
                    .catch(err => {
                        console.error("Token expired or invalid", err);
                        localStorage.removeItem('dropbox_token');
                        setDbx(null);
                        setIsAuthenticated(false);
                    })
                    .finally(() => setIsAuthChecking(false));
            } else {
                setIsAuthChecking(false);
            }
        }
    }, []);

    // 2. Connect (Redirect to Dropbox)
    const connect = useCallback(() => {
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
        window.location.href = authUrl;
    }, []);

    // 3. Save Data (Upload)
    const saveData = useCallback(async (data: BackupData): Promise<boolean> => {
        if (!dbx) return false;
        setIsSyncing(true);
        try {
            const fileContent = JSON.stringify(data, null, 2);
            const blob = new Blob([fileContent], { type: 'application/json' });

            await dbx.filesUpload({
                path: '/smartcards.json',
                contents: blob,
                mode: { '.tag': 'overwrite' } // Always overwrite for now
            });

            setLastSynced(new Date());
            setConnectionError(false);
            return true;
        } catch (error: unknown) {
            console.error('Dropbox Upload Error:', error);
            const dbxError = error as { status?: number; error?: { error_summary?: string } };
            if (dbxError?.status === 401 || dbxError?.error?.error_summary?.includes('expired_access_token')) {
                setConnectionError(true);
                setIsAuthenticated(false); // Force disconnect state logically
            } else {
                alert('Backup failed. Check internet connection.');
            }
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [dbx]);

    // 4. Load Data (Download)
    const loadData = useCallback(async (): Promise<BackupData | null> => {
        if (!dbx) return null;
        setIsSyncing(true);
        try {
            const response = await dbx.filesDownload({ path: '/smartcards.json' });
            const blob = (response.result as unknown as { fileBlob: Blob }).fileBlob;
            const text = await blob.text();

            setLastSynced(new Date());
            return JSON.parse(text) as BackupData;
        } catch (error) {
            console.error('Dropbox Download Error:', error);
            // It's okay if file doesn't exist yet (new user)
            return null;
        } finally {
            setIsSyncing(false);
        }
    }, [dbx]);

    // 5. Logout
    const disconnect = useCallback(() => {
        localStorage.removeItem('dropbox_token');
        setDbx(null);
        setIsAuthenticated(false);
        setUserName(null);
    }, []);

    // 6. Upload File (New)
    const uploadFile = useCallback(async (file: File) => {
        if (!dbx) throw new Error("Not connected to Dropbox");

        // Create a unique name: timestamp_originalName
        const timestamp = Date.now();
        // Allow international characters (Umlauts etc.) but remove system-reserved chars AND underscores (cause preview issues)
        const safeName = file.name.replace(/[\\/:"*?<>|_]/g, '-');
        const path = `/attachments/${timestamp}_${safeName}`;

        const response = await dbx.filesUpload({
            path,
            contents: file
        });

        // Return simplified Attachment object
        return {
            id: response.result.id, // Dropbox ID
            name: file.name,
            path: response.result.path_display || path,
            type: file.type,
            size: file.size
        };
    }, [dbx]);

    // 7. Get File Link (New)
    const getFileLink = useCallback(async (path: string) => {
        if (!dbx) return null;
        try {
            const response = await dbx.filesGetTemporaryLink({ path });
            return response.result.link;
        } catch (error) {
            console.error("Error getting link:", error);
            return null;
        }
    }, [dbx]);

    // 8. Get File Content (Blob) for Preview
    const getFileContent = useCallback(async (path: string) => {
        if (!dbx) return null;
        try {
            const response = await dbx.filesDownload({ path });
            return (response.result as unknown as { fileBlob: Blob }).fileBlob;
        } catch (error) {
            console.error("Error downloading file content:", error);
            return null;
        }
    }, [dbx]);

    // 9. Delete File (Hard Delete)
    const deleteFile = useCallback(async (path: string) => {
        if (!dbx) throw new Error("Not connected");
        try {
            await dbx.filesDeleteV2({ path });
            return true;
        } catch (error: unknown) {
            const dbxError = error as { error?: { error_summary?: string } };
            // If file is already gone (path_lookup/not_found), consider it a success so UI updates
            if (dbxError?.error?.error_summary?.includes('path_lookup/not_found')) {
                console.warn("File already deleted from Dropbox, removing from local list.");
                return true;
            }
            console.error("Error deleting file:", error);
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
        getFileLink
    };
}
