import { useEffect, useRef, useState } from 'react';
import { useDropbox } from './useDropbox';
import { stableStringify, getObjectDiff } from '../utils/helpers';

interface UseAppSyncProps {
    projects: any[];
    cards: any[];
    customColors: string[];
    loadDataStore: (data: any) => void;
}

export function useAppSync({ projects, cards, customColors, loadDataStore }: UseAppSyncProps) {
    // const { projects, cards, customColors, loadData: loadDataStore } = useStore(); // REMOVED: Now passed as props
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
        deleteFile,
        getLatestRevision
    } = useDropbox();

    const [isCloudLoaded, setIsCloudLoaded] = useState(false);
    const [lastSavedHash, setLastSavedHash] = useState<string>("");
    const [lastServerRevision, setLastServerRevision] = useState<string | null>(null);
    const [hasConflict, setHasConflict] = useState(false);
    const [debugDiff, setDebugDiff] = useState<any>(null); // DIAGNOSTIC STATE

    // Track local changes to prevent Auto-Sync from overwriting pending saves
    const lastLocalChange = useRef<number>(Date.now());
    const isInitializingRef = useRef(false); // Guard against double-firing initial load
    // NEW: Track pending cloud load to sync hash after store update
    const pendingCloudLoadRef = useRef<{ rev: string } | null>(null);

    // Update timestamp on any change (and Handle Post-Store Hash Sync)
    useEffect(() => {
        if (pendingCloudLoadRef.current) {
            console.log("Sync: Calculating hash AFTER store update...", pendingCloudLoadRef.current.rev);
            const newHash = stableStringify({ projects, cards, customColors });
            setLastSavedHash(newHash);
            setLastServerRevision(pendingCloudLoadRef.current.rev);
            localStorage.setItem('sm_last_synced_hash_v3', newHash);

            // Clear pending flag
            pendingCloudLoadRef.current = null;
            // NOTE: We do NOT update lastLocalChange here. This acts as a "silent" baseline set.
        } else {
            lastLocalChange.current = Date.now();
        }
    }, [projects, cards, customColors]);

    // 1. Initial Load on Connect
    useEffect(() => {
        // Guard: Authenticated, Not Loaded, AND Not currently initializing
        if (isDropboxAuthenticated && !isCloudLoaded && !isInitializingRef.current) {
            isInitializingRef.current = true; // Lock immediately

            console.log("Sync: Starting Initial Load...");
            loadData().then((result) => {
                if (!result) {
                    console.warn("Sync: Initial Load failed or empty.");
                    // If failed, maybe allow retry? For now, unlock but keep isCloudLoaded false?
                    // Or set isCloudLoaded true to enable empty state?
                    // Let's assume if it returns null, we are offline or empty.
                    // Better to set isCloudLoaded = true to allow local work if we can't fetch?
                    // For now, let's just log.
                    // isInitializingRef.current = false; // Optional: Allow retry
                    return;
                }
                const { data, rev } = result;

                // Check if we have unsaved local changes from a previous session
                const storedHash = localStorage.getItem('sm_last_synced_hash_v3');
                const currentHash = stableStringify({ projects, cards, customColors });

                // Allow initial overwrite if we are establishing a fresh sync protocol (v3)
                // or if the stored hash matches current state.
                const hasUnsavedLocalChanges = storedHash && storedHash !== currentHash;

                if (hasUnsavedLocalChanges) {
                    console.warn("Sync: Unsaved local changes detected from previous session. SKIPPING cloud overwrite.");
                    setLastSavedHash(storedHash || "");
                    setLastServerRevision(rev); // Update revision anyway so we know what's upstream
                    setIsCloudLoaded(true);
                    return;
                }

                if (data && data.projects && data.cards) {
                    console.log("Sync: Cloud data loaded. Pushing to Store... Rev:", rev);

                    // NORMALIZE DATA: Consistent with auto-sync
                    const normalizedData = {
                        ...data,
                        projects: data.projects || [],
                        cards: (data.cards || []).map((c: any) => ({
                            ...c,
                            projectIds: c.projectIds || [],
                            attachments: c.attachments || [],
                            linkedCardIds: c.linkedCardIds || []
                        })),
                        customColors: data.customColors || []
                    };

                    loadDataStore(normalizedData);

                    // DEFER HASH CALCULATION:
                    // We set this ref so the NEXT render (which has the updated store data)
                    // will calculate the hash. This ensures hash matches what useStore actually contains.
                    pendingCloudLoadRef.current = { rev };
                }
                setIsCloudLoaded(true); // Enable auto-save
            }).catch(err => {
                console.error("Sync: Initial Load Error", err);
                isInitializingRef.current = false; // Allow retry on error
            });
        }
    }, [isDropboxAuthenticated, isCloudLoaded, loadData, loadDataStore, projects, cards, customColors]);

    // 2. Auto-Save to Dropbox (Debounced 3s)
    useEffect(() => {
        if (!isDropboxAuthenticated || !isCloudLoaded) return;
        if (!projects || projects.length === 0) return;

        const timeoutId = setTimeout(async () => {
            // OPTIMISTIC LOCK CHECK: Before saving, check if server is ahead
            // If we save now, we might overwrite someone else's work (Last Write Wins)
            // Ideally, we want to stop if server has a newer revision.

            // Only check if we haven't already detected a conflict
            if (hasConflict) {
                console.warn("Auto-Save Suspended: Conflict active.");
                return;
            }

            // Redundancy Check: If data has already been saved (e.g. by manual save), skip.
            const currentData = { projects, cards, customColors };
            if (stableStringify(currentData) === lastSavedHash) {
                // console.log("Auto-Save Skipped: Data already matches last saved state.");
                return;
            }

            // Lightweight check (optional but safer)
            // Note: This adds latency to every save. Maybe only do it if some time passed?
            // For safety, let's do it.
            const serverRev = await getLatestRevision();
            if (serverRev && lastServerRevision && serverRev !== lastServerRevision) {
                console.warn("Auto-Save Aborted: Server has newer revision (Split Brain detected).");
                setHasConflict(true);
                return;
            }

            const { success, rev, conflict } = await saveWithMeta(currentData);

            if (conflict) {
                console.warn("Auto-Save Aborted: Revision Mismatch (Optimistic Lock).");
                setHasConflict(true);
                return;
            }

            if (success) {
                const newHash = stableStringify(currentData);
                setLastSavedHash(newHash);
                if (rev) setLastServerRevision(rev);
                localStorage.setItem('sm_last_synced_hash_v3', newHash);
            }
        }, 3000); // 3s Debounce

        return () => clearTimeout(timeoutId);
    }, [projects, cards, customColors, isDropboxAuthenticated, isCloudLoaded, saveData, lastSavedHash]);

    // 3. Auto-Sync / Polling & Visibility Trigger
    const checkForUpdates = async (force: boolean = false) => {
        if (!isDropboxAuthenticated || isSyncing) return;

        // PROTECTION: Skip sync if local data changed recently (last 2s)
        // This reduces likelihood of overwriting an active edit
        // We relax this from 15s to 2s to allow snappier multi-window updates.
        // If 'force' is true (e.g. tab focus), we skip this check UNLESS actual typing is happening right now?
        // Let's still respect the 2s buffer even on force, to be safe against "typing then switching tabs quickly".
        const timeSinceLastChange = Date.now() - lastLocalChange.current;
        if (!force && timeSinceLastChange < 2000) return;

        try {
            // Lightweight Check: Get Revision ID first
            const latestRev = await getLatestRevision();

            if (!latestRev || latestRev === lastServerRevision) {
                // If strictly equal, no update needed.
                if (hasConflict && latestRev === lastServerRevision) {
                    // Conflict might be stale if revisions match
                }
                return;
            }

            console.log(`Sync: New revision detected (${latestRev}). Checking safety...`);

            // If we are Dirty AND Server Changed -> Conflict
            if (lastSavedHash && currentHash !== lastSavedHash) {
                console.warn("Sync Conflict: Server has new revision, but Local has unsaved changes.");

                // DIAGNOSTIC PROBE: Calculate Diff
                try {
                    // We need to compare currentData against what we THINK is last saved.
                    // We only have the hash. But to diff, we should probably compare against what we just downloaded?
                    // No, the conflict is "Local vs LastSaved". 
                    // But we don't store the full LastSaved object, only hash or local storage.
                    // Actually, we can compare currentData vs CloudData (which we haven't downloaded yet fully, or we can fetch it).
                    // BETTER: Compare currentData vs a theoretical clean state? 
                    // Wait, we have 'projects', 'cards', 'customColors'.
                    // Discrepancy is: stableStringify(current) !== lastSavedHash.
                    // We can't diff against a hash.

                    // Strategy: If we have a stored lastSavedHash, we assume the previous state was 'X'.
                    // We don't have 'X'.
                    // But we can enable the "Ignore" strategy if the diff is trivial?
                    // Diagnosing: We can't show "Old vs New" if we don't have "Old".

                    // ALTERNATIVE: Just output the currentData structure to console so user can send it?
                    // Or, maybe we compare against the *incoming* cloud data?
                    // Yes, showing "Local vs Cloud" diff would be useful.

                    const result = await loadData(latestRev); // We fetch it to compare!
                    if (result && result.data) {
                        const cloudDataRaw = result.data;
                        const cloudData = {
                            ...cloudDataRaw,
                            projects: cloudDataRaw.projects || [],
                            cards: (cloudDataRaw.cards || []).map((c: any) => ({
                                ...c,
                                projectIds: c.projectIds || [],
                                attachments: c.attachments || [],
                                linkedCardIds: c.linkedCardIds || []
                            })),
                            customColors: cloudDataRaw.customColors || []
                        };
                        const currentData = { projects, cards, customColors };
                        const diff = getObjectDiff(cloudData, currentData); // Cloud vs Local
                        console.warn("DIAGNOSTIC DIFF (Cloud vs Local):", diff);
                        setDebugDiff(diff);
                    }
                } catch (e) {
                    console.error("Diff calc failed", e);
                }

                setHasConflict(true);
                return;
            }

            const result = await loadData(latestRev);
            if (result && result.data && result.data.projects) {
                const cloudDataRaw = result.data;
                const rev = result.rev;

                // NORMALIZE DATA: Ensure arrays are present to match Store/Component behavior
                // This prevents hash mismatch (undefined vs []) which causes "Phantom Dirty State"
                const cloudData = {
                    ...cloudDataRaw,
                    projects: cloudDataRaw.projects || [],
                    cards: (cloudDataRaw.cards || []).map((c: any) => ({
                        ...c,
                        projectIds: c.projectIds || [],
                        attachments: c.attachments || [],
                        linkedCardIds: c.linkedCardIds || []
                    })),
                    customColors: cloudDataRaw.customColors || []
                };

                const cloudHash = stableStringify({ projects: cloudData.projects, cards: cloudData.cards, customColors: cloudData.customColors });

                if (currentHash === lastSavedHash || lastSavedHash === "") {
                    console.log("Auto-Sync: Cloud update applied. New Rev:", rev);
                    loadDataStore(cloudData);
                    setLastSavedHash(cloudHash);
                    setLastServerRevision(rev);
                    localStorage.setItem('sm_last_synced_hash_v3', cloudHash);
                    setHasConflict(false);
                } else {
                    console.warn("Sync Conflict: Local changed during download.");
                    setHasConflict(true);
                }
            }
        } catch (error) {
            console.error("Auto-Sync Error:", error);
        }
    };

    // Explicit Conflict Resolution
    const resolveConflict = async (strategy: 'accept_cloud' | 'keep_local', dataOverride?: any) => {
        if (strategy === 'accept_cloud') {
            console.log("Resolving Conflict: Accepting Cloud...");
            // Force get latest rev securely first
            const secureRev = await getLatestRevision();
            const result = await loadData(secureRev || undefined);

            if (result && result.data) {
                const cloudHash = stableStringify({ projects: result.data.projects, cards: result.data.cards, customColors: result.data.customColors || [] });
                loadDataStore(result.data);
                setLastSavedHash(cloudHash);
                setLastServerRevision(result.rev);
                localStorage.setItem('sm_last_synced_hash_v3', cloudHash);
                setHasConflict(false);
            }
        } else {
            // keep_local -> force save
            // BETTER STRATEGY: Get latest rev, assume we are overwriting it.
            const latest = await getLatestRevision();
            // Updatestate so saveWithMeta uses it
            setLastServerRevision(latest);

            // Let's call saveData directly to be safe.

            const currentData = dataOverride || { projects, cards, customColors };
            const payload = {
                ...currentData,
                _meta: { lastSaved: Date.now(), appVersion: '1.0.1' }
            };

            // We pass 'latest' (or null) to force update on top of it.
            const { success, rev } = await saveData(payload, latest);

            if (success) {
                const newHash = stableStringify(currentData);
                setLastSavedHash(newHash);
                if (rev) setLastServerRevision(rev);
                localStorage.setItem('sm_last_synced_hash_v3', newHash);
                setHasConflict(false);
            }
        }
    };

    useEffect(() => {
        if (!isDropboxAuthenticated) return;

        const intervalId = setInterval(() => checkForUpdates(false), 10000); // Check every 10s (lightweight)

        const handleTrigger = () => {
            if (document.visibilityState === 'visible') {
                checkForUpdates(true); // FORCE check on visibility (bypass 2s check? No, logic above still checks 2s unless 'force' handles it)
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
    }, [isDropboxAuthenticated, isSyncing, loadData, loadDataStore, projects, cards, customColors, lastServerRevision, lastSavedHash]);

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

    // 7. Wrapped Manual Save (Updates Local State & Checks Conflicts)
    const handleManualSave = async (data: any = { projects, cards, customColors }): Promise<{ success: boolean; rev?: string }> => {
        // Optimistic Lock Check
        if (hasConflict) {
            console.warn("Manual Save Aborted: Conflict active.");
            return { success: false };
        }

        const serverRev = await getLatestRevision();
        if (serverRev && lastServerRevision && serverRev !== lastServerRevision) {
            console.warn("Manual Save Aborted: Server has newer revision (Split Brain detected).");
            setHasConflict(true);
            return { success: false };
        }

        console.log("[SYNC-DEBUG] Manual Save Initiated...");
        // Inject Meta here too
        const { success, rev, conflict } = await saveWithMeta(data);
        console.log("[SYNC-DEBUG] Raw Save Result:", { success, rev, conflict });

        if (conflict) {
            console.warn("Manual Save Failed: Conflict verified by Server.");
            setHasConflict(true);
            return { success: false };
        }

        if (success) {
            console.log("[SYNC-DEBUG] Manual Save Success. Logic: Updating Local State. New Rev:", rev);
            const newHash = stableStringify(data);
            setLastSavedHash(newHash);
            if (rev) {
                setLastServerRevision(rev);
                console.log("[SYNC-DEBUG] setLastServerRevision CALLED with:", rev);
            } else {
                console.warn("[SYNC-DEBUG] Warning: Save Success but NO Revision returned!");
            }
            localStorage.setItem('sm_last_synced_hash_v3', newHash);
        }
        return { success, rev };
    };

    // 8. Wrapped Save Data for internal Auto-Save with Meta Injection
    const saveWithMeta = async (data: any) => {
        const payload = {
            ...data,
            _meta: { lastSaved: Date.now(), appVersion: '1.0.1' }
        };
        // Always pass the last known server revision to enable Optimistic Locking
        return saveData(payload, lastServerRevision);
    };

    return {
        isDropboxAuthenticated,
        isAuthChecking,
        isCloudLoaded,
        isSyncing,
        connectionError,
        connect,
        disconnect,
        loadData,
        saveData: handleManualSave, // Export wrapped version
        deleteFile,
        lastSynced,
        isCloudSynced,
        userName,
        checkForUpdates, // Export for manual trigger (e.g. Card Focus)
        hasConflict,
        resolveConflict,
        lastServerRevision,
        debugDiff
    };
}
