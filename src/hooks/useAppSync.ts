import { useEffect, useRef, useState, useCallback } from 'react';
import { useDropbox } from './useDropbox';
import { stableStringify } from '../utils/helpers';
import { normalizeBackupData, isValidBackupData } from '../utils/normalizeBackupData';
import type { Project, Card } from '../types';

interface UseAppSyncProps {
    projects: Project[];
    cards: Card[];
    customColors: string[];
    loadDataStore: (data: { projects: Project[]; cards: Card[]; customColors?: string[] }) => void;
}

export type CloudStatus = 'idle' | 'loading' | 'synced' | 'error' | 'new';

/**
 * Cloud-First Sync Hook.
 * 
 * Architecture:
 * - On connect: Load cloud data → overwrite local store (cloud = truth)
 * - On local change: Debounced auto-save to Dropbox (3s, overwrite mode)
 * - On visibility/focus: Re-pull from cloud if no pending local save
 * - No conflict resolution, no merge, no revision tracking
 */
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
    } = useDropbox();

    const [cloudStatus, setCloudStatus] = useState<CloudStatus>('idle');
    const isInitializingRef = useRef(false);
    const pendingSaveRef = useRef(false);
    const lastSavedHashRef = useRef('');
    // Stable snapshot of current local data — updated every render via ref,
    // so effects can read the latest value without listing them as deps.
    const latestLocalRef = useRef({ projects, cards, customColors });
    latestLocalRef.current = { projects, cards, customColors };

    // --- 1. Initial Load: Cloud → Local ---
    useEffect(() => {
        if (!isDropboxAuthenticated || cloudStatus !== 'idle' || isInitializingRef.current) return;
        isInitializingRef.current = true;
        setCloudStatus('loading');

        loadData().then((result) => {
            if (result.type === 'success') {
                const normalized = normalizeBackupData(result.data);
                loadDataStore(normalized);
                lastSavedHashRef.current = stableStringify({
                    projects: normalized.projects,
                    cards: normalized.cards,
                    customColors: normalized.customColors,
                });
                setCloudStatus('synced');
            } else if (result.type === 'not_found') {
                // File doesn't exist yet - this is a NEW user.
                // Use the ref snapshot to avoid stale closure over initial empty values.
                const local = latestLocalRef.current;
                lastSavedHashRef.current = stableStringify(local);
                setCloudStatus('new');
            } else {
                // Network error or server error
                console.warn('Sync: Initial load failed. Auto-save is BLOCKED to prevent data loss.');
                setCloudStatus('error');
            }
        }).catch(err => {
            console.error('Sync: Initial load error', err);
            setCloudStatus('error');
            isInitializingRef.current = false;
        });
    // IMPORTANT: projects/cards/customColors intentionally excluded.
    // Adding them would cause this effect to re-run mid-load whenever the
    // store updates, creating a race condition that re-triggers initialization.
    // latestLocalRef captures their current values without being a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDropboxAuthenticated, cloudStatus, loadData, loadDataStore]);

    // --- 2. Auto-Save: Local → Cloud (3s debounce, overwrite) ---
    useEffect(() => {
        // SAFETY: Only allow save if we are synced with cloud OR it's confirmed as a new account.
        // If status is 'error', we block saving to prevent overwriting an unreadable cloud file.
        if (!isDropboxAuthenticated || (cloudStatus !== 'synced' && cloudStatus !== 'new')) return;
        if (!projects || projects.length === 0) return;

        const data = { projects, cards, customColors };
        const currentHash = stableStringify(data);

        // Skip if already in sync
        if (currentHash === lastSavedHashRef.current) return;

        pendingSaveRef.current = true;

        const timeoutId = setTimeout(async () => {
            if (!isValidBackupData(data)) {
                console.warn('Auto-save aborted: data validation failed.');
                pendingSaveRef.current = false;
                return;
            }

            const payload = {
                ...data,
                _meta: { lastSaved: Date.now(), appVersion: __APP_VERSION__ },
            };

            const { success } = await saveData(payload);

            if (success) {
                lastSavedHashRef.current = stableStringify(data);
                // If we were 'new', we are now 'synced'
                if (cloudStatus === 'new') setCloudStatus('synced');
            }
            pendingSaveRef.current = false;
        }, 3000);

        return () => clearTimeout(timeoutId);
    }, [projects, cards, customColors, isDropboxAuthenticated, cloudStatus, saveData]);

    // --- 3. Re-pull on visibility/focus (only if no pending save) ---
    useEffect(() => {
        if (!isDropboxAuthenticated || cloudStatus !== 'synced') return;

        const handleVisibility = async () => {
            if (document.visibilityState !== 'visible') return;
            if (pendingSaveRef.current || isSyncing) return;

            try {
                const result = await loadData();
                if (result.type === 'success') {
                    const normalized = normalizeBackupData(result.data);
                    const cloudHash = stableStringify({
                        projects: normalized.projects,
                        cards: normalized.cards,
                        customColors: normalized.customColors,
                    });

                    // Only update if cloud differs from what we last saved
                    if (cloudHash !== lastSavedHashRef.current) {
                        loadDataStore(normalized);
                        lastSavedHashRef.current = cloudHash;
                    }
                }
            } catch (error) {
                console.error('Sync: Visibility re-pull error', error);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleVisibility);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleVisibility);
        };
    }, [isDropboxAuthenticated, cloudStatus, isSyncing, loadData, loadDataStore]);

    // --- 4. Unsaved Changes Warning ---
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isSyncing || pendingSaveRef.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isSyncing]);

    const forceSave = useCallback(async () => {
        if (!isDropboxAuthenticated) return { success: false, errorType: 'auth' };
        const data = { projects, cards, customColors };
        const payload = {
            ...data,
            _meta: { lastSaved: Date.now(), appVersion: __APP_VERSION__ },
        };
        const res = await saveData(payload);
        if (res.success) {
            lastSavedHashRef.current = stableStringify(data);
            if (cloudStatus === 'new') setCloudStatus('synced');
        }
        return res;
    }, [projects, cards, customColors, isDropboxAuthenticated, saveData, cloudStatus]);

    /**
     * Force Download: pulls the latest cloud file and overwrites local state.
     * Critically, it also updates lastSavedHashRef to match the downloaded data,
     * preventing the 3-second auto-save debounce from immediately re-uploading
     * the old local data over the freshly downloaded cloud data.
     */
    const forceDownload = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
        if (!isDropboxAuthenticated) return { success: false, error: 'not_authenticated' };
        try {
            const result = await loadData();
            if (result.type === 'success') {
                const normalized = normalizeBackupData(result.data);
                loadDataStore(normalized);
                // CRITICAL: sync the hash so auto-save doesn't overwrite immediately
                lastSavedHashRef.current = stableStringify({
                    projects: normalized.projects,
                    cards: normalized.cards,
                    customColors: normalized.customColors,
                });
                setCloudStatus('synced');
                return { success: true };
            } else if (result.type === 'not_found') {
                return { success: false, error: 'not_found' };
            } else {
                return { success: false, error: 'load_error' };
            }
        } catch (err: any) {
            console.error('Sync: forceDownload error', err);
            return { success: false, error: err?.message ?? 'unknown' };
        }
    }, [isDropboxAuthenticated, loadData, loadDataStore]);

    // Derived state
    const currentHash = stableStringify({ projects, cards, customColors });
    const isCloudSynced = currentHash === lastSavedHashRef.current && !isSyncing;
    const isCloudLoaded = cloudStatus === 'synced' || cloudStatus === 'new' || cloudStatus === 'error'; // Error allows UI to show but with warning

    return {
        isDropboxAuthenticated,
        isAuthChecking,
        isCloudLoaded,
        cloudStatus,
        isSyncing,
        connectionError,
        connect,
        disconnect,
        loadData,
        deleteFile,
        lastSynced,
        isCloudSynced,
        userName,
        forceSave,
        forceDownload,
    };
}
