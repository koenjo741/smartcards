import type { BackupData } from '../types';

/**
 * Normalizes raw cloud data to ensure all arrays are present.
 * Prevents hash mismatches (undefined vs []) which cause "Phantom Dirty State".
 * Single source of truth – used by useAppSync for both initial load and auto-sync.
 */
export const normalizeBackupData = (data: any): BackupData => ({
    projects: data.projects || [],
    cards: (data.cards || []).map((c: any) => ({
        ...c,
        projectIds: c.projectIds || [],
        attachments: c.attachments || [],
        linkedCardIds: c.linkedCardIds || [],
    })),
    customColors: data.customColors || [],
    _meta: data._meta,
});

/**
 * Validates that backup data is structurally safe to save.
 * Prevents saving empty/corrupt data that would overwrite good cloud data.
 */
export const isValidBackupData = (data: any): data is BackupData =>
    data &&
    Array.isArray(data.projects) &&
    data.projects.length > 0 &&
    Array.isArray(data.cards);
