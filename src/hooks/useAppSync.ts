import { useEffect, useRef, useState } from 'react';
import { useDropbox } from './useDropbox';
import { stableStringify, getObjectDiff } from '../utils/helpers';
import { normalizeBackupData, isValidBackupData } from '../utils/normalizeBackupData';
import type { Project, Card } from '../types';

const safeSetItem = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.error(`Failed to set localStorage item ${key}:`, e);
    }
};

interface UseAppSyncProps {
    projects: Project[];
    cards: Card[];
    customColors: string[];
    loadDataStore: (data: { projects: Project[]; cards: Card[]; customColors?: string[] }) => void;
}

export function useAppSync({ projects, cards, customColors, loadDataStore }: UseAppSyncProps) {
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
        getLatestRevision,
    } = useDropbox();

    const [isCloudLoaded, setIsCloudLoaded] = useState(false);
    const [lastSavedHash, setLastSavedHash] = useState<string>(() => localStorage.getItem('sm_last_synced_hash_v3') || '');
    const [lastServerRevision, setLastServerRevision] = useState<string | null>(() => localStorage.getItem('sm_last_server_revision_v3') || null);
    const [hasConflict, setHasConflict] = useState(false);
    const [conflictingItems, setConflictingItems] = useState<string[]>([]);
    const [pendingSave, setPendingSave] = useState(false);

    const checkConflicts = (cloudData: { cards: Card[] }) => {
        const diffCards: string[] = [];
        // Check for local cards that differ from cloud or are missing in cloud
        cards.forEach(localCard => {
            const cloudCard = cloudData.cards.find(c => c.id === localCard.id);
            if (!cloudCard || stableStringify(localCard) !== stableStringify(cloudCard)) {
                diffCards.push(localCard.title || 'Ohne Titel');
            }
        });
        // Check for cloud cards that are missing locally
        cloudData.cards.forEach(cloudCard => {
            if (!cards.find(c => c.id === cloudCard.id)) {
                diffCards.push(cloudCard.title || 'Ohne Titel');
            }
        });
        setConflictingItems(Array.from(new Set(diffCards)));
    };

    const updateLastServerRevision = (rev: string | null) => {
        setLastServerRevision(rev);
        if (rev) safeSetItem('sm_last_server_revision_v3', rev);
        else localStorage.removeItem('sm_last_server_revision_v3');
    };

    const lastLocalChange = useRef<number>(Date.now());
    const isInitializingRef = useRef(false);
    const pendingCloudLoadRef = useRef<{ rev: string } | null>(null);

    // Compute current hash (used throughout this hook)
    const currentHash = stableStringify({ projects, cards, customColors });

    // Track local changes & handle post-store hash sync
    useEffect(() => {
        if (pendingCloudLoadRef.current) {
            const newHash = stableStringify({ projects, cards, customColors });
            setLastSavedHash(newHash);
            updateLastServerRevision(pendingCloudLoadRef.current.rev);
            safeSetItem('sm_last_synced_hash_v3', newHash);
            pendingCloudLoadRef.current = null;
        } else {
            lastLocalChange.current = Date.now();
        }
    }, [projects, cards, customColors]);

    // Retry pending saves when connectivity is restored
    useEffect(() => {
        if (!pendingSave || !isDropboxAuthenticated) return;

        const handleOnline = async () => {
            if (!pendingSave) return;
            const data = { projects, cards, customColors };
            if (!isValidBackupData(data)) return;

            const { success, rev } = await saveWithMeta(data);
            if (success) {
                const hash = stableStringify(data);
                setLastSavedHash(hash);
                if (rev) updateLastServerRevision(rev);
                safeSetItem('sm_last_synced_hash_v3', hash);
                setPendingSave(false);
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [pendingSave, isDropboxAuthenticated, projects, cards, customColors]);

    // 1. Initial Load on Connect
    useEffect(() => {
        if (!isDropboxAuthenticated || isCloudLoaded || isInitializingRef.current) return;

        isInitializingRef.current = true;

        loadData().then((result) => {
            if (!result) {
                console.warn('Sync: Initial load returned empty.');
                setIsCloudLoaded(true); // Allow local work
                return;
            }

            const { data, rev } = result;
            const storedHash = localStorage.getItem('sm_last_synced_hash_v3');
            const storedRev = localStorage.getItem('sm_last_server_revision_v3');
            const localHash = stableStringify({ projects, cards, customColors });
            const hasUnsavedLocalChanges = storedHash && storedHash !== localHash;

            if (hasUnsavedLocalChanges) {
                if (storedRev && storedRev !== rev) {
                    console.warn('Sync: Conflict detected on initial load! Server has newer changes.');
                    setHasConflict(true);
                    if (data?.cards) checkConflicts(data);
                    setLastSavedHash(storedHash || '');
                    updateLastServerRevision(storedRev); // Keep old rev explicitly for conflict resolution payload
                    setIsCloudLoaded(true);
                    return;
                }
                console.warn('Sync: Unsaved local changes detected. Skipping cloud overwrite.');
                setLastSavedHash(storedHash || '');
                updateLastServerRevision(rev);
                setIsCloudLoaded(true);
                return;
            }

            if (data?.projects && data?.cards) {
                const normalizedData = normalizeBackupData(data);
                loadDataStore(normalizedData);
                pendingCloudLoadRef.current = { rev };
            }

            setIsCloudLoaded(true);
        }).catch(err => {
            console.error('Sync: Initial load error', err);
            isInitializingRef.current = false;
        });
    }, [isDropboxAuthenticated, isCloudLoaded, loadData, loadDataStore, projects, cards, customColors]);

    // 2. Auto-Save to Dropbox (3s debounce)
    useEffect(() => {
        if (!isDropboxAuthenticated || !isCloudLoaded || hasConflict) return;
        if (!projects || projects.length === 0) return;

        const timeoutId = setTimeout(async () => {
            const data = { projects, cards, customColors };

            // Skip if already in sync
            if (stableStringify(data) === lastSavedHash) return;

            // Pre-save validation: never save empty/corrupt data
            if (!isValidBackupData(data)) {
                console.warn('Auto-save aborted: data validation failed.');
                return;
            }

            const { success, rev, conflict } = await saveWithMeta(data);

            if (conflict) {
                setHasConflict(true);
                // Trigger an update check to download the cloud version and find the diff
                checkForUpdates(true);
                return;
            }

            if (success) {
                const newHash = stableStringify(data);
                setLastSavedHash(newHash);
                if (rev) updateLastServerRevision(rev);
                safeSetItem('sm_last_synced_hash_v3', newHash);
                setPendingSave(false);
            } else {
                // Mark for retry on reconnect
                setPendingSave(true);
            }
        }, 3000);

        return () => clearTimeout(timeoutId);
    }, [projects, cards, customColors, isDropboxAuthenticated, isCloudLoaded, saveData, lastSavedHash, hasConflict]);

    // 3. Auto-Sync / Polling & Visibility Trigger
    const checkForUpdates = async (force: boolean = false) => {
        if (!isDropboxAuthenticated || isSyncing) return;

        // Compute hash at call time (fixing the critical hoisting bug)
        const localHash = stableStringify({ projects, cards, customColors });

        const timeSinceLastChange = Date.now() - lastLocalChange.current;
        if (!force && timeSinceLastChange < 2000) return;

        try {
            const latestRev = await getLatestRevision();
            if (!latestRev || latestRev === lastServerRevision) return;

            // Local is dirty AND server changed → potential conflict
            if (lastSavedHash && localHash !== lastSavedHash) {
                // Smart conflict detection: compare content, not just revisions
                try {
                    const result = await loadData(latestRev);
                    if (result?.data) {
                        const cloudData = normalizeBackupData(result.data);
                        const cloudHash = stableStringify({
                            projects: cloudData.projects,
                            cards: cloudData.cards,
                            customColors: cloudData.customColors,
                        });

                        if (cloudHash === localHash) {
                            // False conflict – content identical, just accept server revision
                            updateLastServerRevision(latestRev);
                            setLastSavedHash(localHash);
                            safeSetItem('sm_last_synced_hash_v3', localHash);
                            setHasConflict(false);
                            setConflictingItems([]);
                            return;
                        }

                        checkConflicts(cloudData);

                        if (import.meta.env.DEV) {
                            console.warn('Sync conflict diff:', getObjectDiff(
                                { projects: cloudData.projects, cards: cloudData.cards, customColors: cloudData.customColors },
                                { projects, cards, customColors }
                            ));
                        }
                    }
                } catch (e) {
                    console.error('Smart conflict check failed:', e);
                }

                setHasConflict(true);
                return;
            }

            // Clean local state → safe to apply cloud update
            const result = await loadData(latestRev);
            if (result?.data?.projects) {
                const cloudData = normalizeBackupData(result.data);
                const cloudHash = stableStringify({
                    projects: cloudData.projects,
                    cards: cloudData.cards,
                    customColors: cloudData.customColors,
                });

                if (localHash === lastSavedHash || lastSavedHash === '') {
                    loadDataStore(cloudData);
                    setLastSavedHash(cloudHash);
                    updateLastServerRevision(result.rev);
                    safeSetItem('sm_last_synced_hash_v3', cloudHash);
                    setHasConflict(false);
                } else {
                    setHasConflict(true);
                }
            }
        } catch (error) {
            console.error('Auto-sync error:', error);
        }
    };

    // Conflict Resolution
    const resolveConflict = async (strategy: 'accept_cloud' | 'keep_local' | 'manual_merge', dataOverride?: any) => {
        if (strategy === 'accept_cloud') {
            const secureRev = await getLatestRevision();
            const result = await loadData(secureRev || undefined);

            if (result?.data) {
                const normalized = normalizeBackupData(result.data);
                const cloudHash = stableStringify({
                    projects: normalized.projects,
                    cards: normalized.cards,
                    customColors: normalized.customColors,
                });
                loadDataStore(normalized);
                setLastSavedHash(cloudHash);
                updateLastServerRevision(result.rev);
                safeSetItem('sm_last_synced_hash_v3', cloudHash);
                setHasConflict(false);
                setConflictingItems([]);
            }
        } else if (strategy === 'manual_merge') {
            const secureRev = await getLatestRevision();
            const result = await loadData(secureRev || undefined);

            // Cloud Data laden
            if (result?.data) {
                const cloudData = normalizeBackupData(result.data);
                const localData = dataOverride || { projects, cards, customColors };

                // Wir identifizieren alle veränderten Karten (Diff)
                const newCards = [...cloudData.cards]; // Start base is cloud

                localData.cards.forEach((localCard: Card) => {
                    const cloudCard = cloudData.cards.find(c => c.id === localCard.id);
                    if (!cloudCard) {
                        // Local card is completely new, just add it
                        newCards.push(localCard);
                    } else if (stableStringify(localCard) !== stableStringify(cloudCard)) {
                        // Card exists in both but differs -> Create local duplicate!
                        newCards.push({
                            ...localCard,
                            id: crypto.randomUUID(), // New ID
                            title: `[LOKAL_KOPIE] ${localCard.title}`,
                        });
                    }
                });

                // Neue merged daten speichern (Lokale Updates zu Dropbox schicken)
                const mergedData = {
                    projects: cloudData.projects, // Keep cloud projects
                    cards: newCards,
                    customColors: cloudData.customColors
                };

                const payload = { ...mergedData, _meta: { lastSaved: Date.now(), appVersion: '1.0.1' } };
                const { success, rev } = await saveData(payload, secureRev);

                if (success) {
                    const newHash = stableStringify(mergedData);
                    loadDataStore(mergedData); // Update UI
                    setLastSavedHash(newHash);
                    if (rev) updateLastServerRevision(rev);
                    safeSetItem('sm_last_synced_hash_v3', newHash);
                    setHasConflict(false);
                    setConflictingItems([]);
                }
            }
        } else {
            const latest = await getLatestRevision();
            updateLastServerRevision(latest);

            const data = dataOverride || { projects, cards, customColors };
            const payload = { ...data, _meta: { lastSaved: Date.now(), appVersion: '1.0.1' } };

            const { success, rev } = await saveData(payload, latest);

            if (success) {
                const newHash = stableStringify(data);
                setLastSavedHash(newHash);
                if (rev) updateLastServerRevision(rev);
                safeSetItem('sm_last_synced_hash_v3', newHash);
                setHasConflict(false);
                setConflictingItems([]);
            }
        }
    };

    // Polling & visibility-based sync
    useEffect(() => {
        if (!isDropboxAuthenticated) return;

        const intervalId = setInterval(() => checkForUpdates(false), 10000);

        const handleTrigger = () => {
            if (document.visibilityState === 'visible') {
                checkForUpdates(true);
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
    const isDirty = isDropboxAuthenticated && (currentHash !== lastSavedHash);
    const isCloudSynced = !isDirty && !isSyncing;

    // Unsaved Changes Warning
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isSyncing || (isDropboxAuthenticated && isDirty) || hasConflict) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isSyncing, isDropboxAuthenticated, isDirty]);

    // Manual Save (with validation)
    const handleManualSave = async (data: any = { projects, cards, customColors }): Promise<{ success: boolean; rev?: string }> => {
        if (hasConflict) return { success: false };

        if (!isValidBackupData(data)) {
            console.warn('Manual save aborted: data validation failed.');
            return { success: false };
        }

        const { success, rev, conflict } = await saveWithMeta(data);

        if (conflict) {
            setHasConflict(true);
            checkForUpdates(true);
            return { success: false };
        }

        if (success) {
            const newHash = stableStringify(data);
            setLastSavedHash(newHash);
            if (rev) updateLastServerRevision(rev);
            safeSetItem('sm_last_synced_hash_v3', newHash);
        }

        return { success, rev };
    };

    // Internal: Save with metadata injection
    const saveWithMeta = async (data: any) => {
        const payload = {
            ...data,
            _meta: { lastSaved: Date.now(), appVersion: '1.0.1' },
        };
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
        saveData: handleManualSave,
        deleteFile,
        lastSynced,
        isCloudSynced,
        userName,
        checkForUpdates,
        hasConflict,
        conflictingItems,
        resolveConflict,
        lastServerRevision,
        isDirty,
    };
}
