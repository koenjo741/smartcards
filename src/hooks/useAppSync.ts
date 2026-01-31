import { useEffect, useRef, useState } from 'react';
import { useStore } from './useStore';
import { useDropbox } from './useDropbox';

// Helper for stable JSON stringify to avoid false positives in Sync
const stableStringify = (obj: any): string => {
    const clean = (input: any): any => {
        if (Array.isArray(input)) return input.map(clean);
        if (typeof input === 'object' && input !== null) {
            const newObj: any = {};
            Object.keys(input).sort().forEach(key => {
                const val = input[key];
                // Keep everything except null/undefined, but allow empty strings/arrays
                if (val !== null && val !== undefined) {
                    newObj[key] = clean(val);
                }
            });
            return newObj;
        }
        return input;
    };
    return JSON.stringify(clean(obj));
};

export function useAppSync() {
    const { projects, cards, customColors, loadData: loadDataStore } = useStore();
    const {
        isAuthenticated: isDropboxAuthenticated,
        isSyncing,
        saveData,
        loadData,
        connect,
        disconnect,
        connectionError,
        isAuthChecking,
        userName,
        lastSynced,
        deleteFile
    } = useDropbox();

    const [isCloudLoaded, setIsCloudLoaded] = useState(false);
    const [lastSavedHash, setLastSavedHash] = useState<string>("");

    // Track local changes to prevent Auto-Sync from overwriting pending saves
    const lastLocalChange = useRef<number>(Date.now());

    // Update timestamp on any change
    useEffect(() => {
        lastLocalChange.current = Date.now();
    }, [projects, cards, customColors]);

    // 1. Initial Load on Connect
    useEffect(() => {
        if (isDropboxAuthenticated && !isCloudLoaded) {
            loadData().then((data) => {
                if (data && data.projects && data.cards) {
                    loadDataStore(data);
                    // Set initial hash to prevent false positives
                    const initialHash = stableStringify({
                        projects: data.projects,
                        cards: data.cards,
                        customColors: data.customColors || []
                    });
                    setLastSavedHash(initialHash);
                }
                setIsCloudLoaded(true); // Enable auto-save after first attempt
            });
        }
    }, [isDropboxAuthenticated, isCloudLoaded, loadData, loadDataStore]);

    // 2. Auto-Save to Dropbox (Debounced 3s)
    useEffect(() => {
        if (!isDropboxAuthenticated || !isCloudLoaded) return;
        if (!projects || projects.length === 0) return;

        const timeoutId = setTimeout(async () => {
            const currentData = { projects, cards, customColors };
            const success = await saveData(currentData);
            if (success) {
                setLastSavedHash(stableStringify(currentData));
            }
        }, 3000); // 3s Debounce

        return () => clearTimeout(timeoutId);
    }, [projects, cards, customColors, isDropboxAuthenticated, isCloudLoaded, saveData]);

    // 3. Auto-Sync / Polling & Visibility Trigger
    useEffect(() => {
        if (!isDropboxAuthenticated) return;

        const checkCloudUpdates = () => {
            const runCheck = async () => {
                if (isSyncing) return;

                // PROTECTION: Skip sync if local data changed recently (last 15s)
                const timeSinceLastChange = Date.now() - lastLocalChange.current;
                if (timeSinceLastChange < 15000) return;

                const cloudData = await loadData();
                if (cloudData && cloudData.projects && cloudData.projects.length > 0) {
                    const currentProjects = projects || [];
                    const currentCards = cards || [];

                    const cloudProjects = cloudData.projects || [];
                    const cloudCards = cloudData.cards || [];
                    const cloudColors = cloudData.customColors || [];

                    const currentHash = stableStringify({ projects: currentProjects, cards: currentCards, customColors });
                    const cloudHash = stableStringify({ projects: cloudProjects, cards: cloudCards, customColors: cloudColors });

                    if (currentHash !== cloudHash) {
                        // CRITICAL: Only overwrite local data if local data is CLEAN (synced)
                        // If currentHash != lastSavedHash, user has unsaved changes that haven't been pushed yet.
                        // We must NOT overwrite them.
                        if (currentHash === lastSavedHash) {
                            console.log("Auto-Sync: Cloud update detected (Local is clean). Updating...");
                            loadDataStore(cloudData);
                            setLastSavedHash(cloudHash);
                        } else {
                            console.warn("Auto-Sync: Cloud update detected BUT Local has unsaved changes. Skipping overwrite to prevent data loss.");
                            // Optional: Trigger a save immediately?
                            // For now, just protecting local data is priority.
                        }
                    }
                }
            };
            runCheck().catch(console.error);
        };

        const intervalId = setInterval(checkCloudUpdates, 30000);

        const handleTrigger = () => {
            if (document.visibilityState === 'visible') {
                checkCloudUpdates();
            }
        };

        document.addEventListener('visibilitychange', handleTrigger);
        window.addEventListener('focus', handleTrigger);
        window.addEventListener('online', handleTrigger);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleTrigger);
            window.removeEventListener('focus', handleTrigger);
            window.removeEventListener('online', handleTrigger);
        };
    }, [isDropboxAuthenticated, isSyncing, loadData, loadDataStore, projects, cards, customColors]);

    // Derived state
    const currentHash = stableStringify({ projects, cards, customColors });
    const isDirty = isDropboxAuthenticated && (currentHash !== lastSavedHash);
    const isCloudSynced = !isDirty && !isSyncing;

    // 4. Unsaved Changes Warning
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isSyncing || (isDropboxAuthenticated && isDirty)) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isSyncing, isDropboxAuthenticated, isDirty]);

    return {
        isDropboxAuthenticated,
        isAuthChecking,
        isCloudLoaded,
        isSyncing,
        connectionError,
        connect,
        disconnect,
        loadData,
        saveData,
        deleteFile,
        lastSynced,
        isCloudSynced,
        userName
    };
}
