import { useEffect, useRef, useState } from 'react';
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

    const [isCloudLoaded, setIsCloudLoaded] = useState(false);
    const isInitializingRef = useRef(false);
    const pendingSaveRef = useRef(false);
    const lastSavedHashRef = useRef('');

    // --- 1. Initial Load: Cloud → Local ---
    useEffect(() => {
        if (!isDropboxAuthenticated || isCloudLoaded || isInitializingRef.current) return;
        isInitializingRef.current = true;

        loadData().then((result) => {
            if (result?.data?.projects && result?.data?.cards) {
                const normalized = normalizeBackupData(result.data);
                loadDataStore(normalized);
                lastSavedHashRef.current = stableStringify({
                    projects: normalized.projects,
                    cards: normalized.cards,
                    customColors: normalized.customColors,
                });
            }
            setIsCloudLoaded(true);
        }).catch(err => {
            console.error('Sync: Initial load error', err);
            setIsCloudLoaded(true); // Let user work offline
            isInitializingRef.current = false;
        });
    }, [isDropboxAuthenticated, isCloudLoaded, loadData, loadDataStore]);

    // --- 2. Auto-Save: Local → Cloud (3s debounce, overwrite) ---
    useEffect(() => {
        if (!isDropboxAuthenticated || !isCloudLoaded) return;
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
            }
            pendingSaveRef.current = false;
        }, 3000);

        return () => clearTimeout(timeoutId);
    }, [projects, cards, customColors, isDropboxAuthenticated, isCloudLoaded, saveData]);

    // --- 3. Re-pull on visibility/focus (only if no pending save) ---
    useEffect(() => {
        if (!isDropboxAuthenticated || !isCloudLoaded) return;

        const handleVisibility = async () => {
            if (document.visibilityState !== 'visible') return;
            if (pendingSaveRef.current || isSyncing) return;

            try {
                const result = await loadData();
                if (result?.data?.projects && result?.data?.cards) {
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
    }, [isDropboxAuthenticated, isCloudLoaded, isSyncing, loadData, loadDataStore]);

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

    // Derived state
    const currentHash = stableStringify({ projects, cards, customColors });
    const isCloudSynced = currentHash === lastSavedHashRef.current && !isSyncing;

    return {
        isDropboxAuthenticated,
        isAuthChecking,
        isCloudLoaded,
        isSyncing,
        connectionError,
        connect,
        disconnect,
        loadData,
        deleteFile,
        lastSynced,
        isCloudSynced,
        userName,
    };
}
