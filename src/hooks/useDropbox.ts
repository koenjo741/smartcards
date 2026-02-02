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
    const saveData = useCallback(async (data: BackupData, parentRev?: string | null): Promise<{ success: boolean; rev?: string; conflict?: boolean; errorType?: 'conflict' | 'auth' | 'server_error' | 'network' }> => {
        if (!dbx) return { success: false };
        setIsSyncing(true);
        try {
            const fileContent = JSON.stringify(data, null, 2);
            const blob = new Blob([fileContent], { type: 'application/json' });

            // OPTIMISTIC LOCKING STRATEGY
            // If we have a known parent revision, we tell Dropbox: "Only save this if the current file is still at this revision".
            // If the revisions don't match, Dropbox rejects the upload with a conflict error.
            const mode = parentRev ? { '.tag': 'update' as const, 'update': parentRev } : { '.tag': 'overwrite' as const };

            console.log(`[SYNC-DEBUG] Saving with mode:`, mode);

            const response = await dbx.filesUpload({
                path: '/smartcards.json',
                contents: blob,
                mode: mode
            });

            const rev = response.result.rev;
            setLastSynced(new Date());
            setConnectionError(false);
            console.log("[SYNC-DEBUG] Save Successful. New Rev:", rev);
            return { success: true, rev };
        } catch (error: any) {
            console.error('Dropbox Upload Error:', error);

            // 1. Handle Conflict (409 or Specific Error Summary)
            const errorSummary = error?.error?.error_summary; // e.g., "path/conflict/..."
            const status = error?.status;

            if ((errorSummary && errorSummary.includes('conflict')) || status === 409) {
                console.warn("[SYNC-DEBUG] CONFLICT DETECTED by Dropbox (Optimistic Lock).");
                return { success: false, conflict: true, errorType: 'conflict' };
            }

            // 2. Handle 503 Service Unavailable (Common source of "Ghost Saves")
            if (status === 503) {
                console.warn("[SYNC-DEBUG] 503 Service Unavailable. The save MIGHT have worked. Proceed with caution.");
                // We return specific type so the caller can decide to POLL immediately to see what happened.
                return { success: false, errorType: 'server_error' };
            }

            // 3. Handle Auth Errors
            const dbxError = error as { status?: number; error?: { error_summary?: string } };
            if (dbxError?.status === 401 || dbxError?.error?.error_summary?.includes('expired_access_token')) {
                setConnectionError(true);
                setIsAuthenticated(false); // Force disconnect state logically
                return { success: false, errorType: 'auth' };
            }

            // 4. Other/Network
            return { success: false, errorType: 'network' };
        } finally {
            setIsSyncing(false);
        }
    }, [dbx]);

    // 4.5 Get Latest Revision (Lightweight Check) - Bypassing SDK Cache
    const getLatestRevision = useCallback(async (): Promise<string | null> => {
        const accessToken = localStorage.getItem('dropbox_token');

        // Strategy A: Try raw fetch for cache busting
        if (accessToken) {
            try {
                const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        path: '/smartcards.json',
                        include_media_info: false,
                        include_deleted: false,
                        include_has_explicit_shared_members: false
                    }),
                    // Fetch API Cache Mode (This keeps the browser from caching)
                    cache: 'no-store'
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log("[SYNC-DEBUG] Latest Rev on Server (Fetch):", data.rev);
                    return data.rev;
                } else {
                    console.warn("[SYNC-DEBUG] Fetch Metadata failed, falling back to SDK. Status:", response.status);
                }
            } catch (error) {
                console.error("[SYNC-DEBUG] Fetch Metadata Error:", error);
            }
        }

        // Strategy B: Fallback to SDK (Might be cached, but better than null)
        if (!dbx) return null;
        try {
            console.log("[SYNC-DEBUG] Using SDK for Metadata (Fallback)");
            const meta = await dbx.filesGetMetadata({ path: '/smartcards.json' });
            const rev = (meta.result as any).rev;
            console.log("[SYNC-DEBUG] Latest Rev on Server (SDK):", rev);
            return rev;
        } catch (error) {
            console.error("[SYNC-DEBUG] SDK Metadata Error:", error);
            // File might not exist yet
            return null;
        }
    }, [dbx]);

    // 4. Load Data (Download)
    // 4. Load Data (Download)
    const loadData = useCallback(async (knownRev?: string): Promise<{ data: BackupData; rev: string } | null> => {
        if (!dbx) return null;
        setIsSyncing(true);
        try {
            let rev = knownRev;

            // Step 1: If Rev not provided, Get Metadata using ROBUST strategy
            if (!rev) {
                const latestRev = await getLatestRevision();
                if (!latestRev) {
                    console.warn("Sync: Could not determine latest revision. Aborting load.");
                    return null;
                }
                rev = latestRev;
            }

            console.log("Sync: Downloading revision:", rev);

            // Step 2: Download specific revision
            const response = await dbx.filesDownload({ path: `rev:${rev}` });
            const blob = (response.result as unknown as { fileBlob: Blob }).fileBlob;
            const text = await blob.text();

            setLastSynced(new Date());
            return { data: JSON.parse(text) as BackupData, rev: rev! };
        } catch (error) {
            console.error('Dropbox Download Error:', error);
            // It's okay if file doesn't exist yet (new user)
            return null;
        } finally {
            setIsSyncing(false);
        }
    }, [dbx, getLatestRevision]);



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
        getFileLink,
        getLatestRevision
    };
}
