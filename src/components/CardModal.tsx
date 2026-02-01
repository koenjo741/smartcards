import React from 'react';
import { X } from 'lucide-react';
import type { Project, Card } from '../types';
import { CardForm } from './CardForm';


interface CardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (card: Omit<Card, 'id'> | Card) => void;
    projects: Project[];
    cards: Card[];
    initialData?: Card | null;
    googleSyncStatus?: 'idle' | 'syncing' | 'success' | 'error' | 'deleted';
    debugRevision?: string | null;
    debugTimestamp?: Date | null;
    isCloudSynced?: boolean;
    hasConflict?: boolean;
    onResolveConflict?: (strategy: 'accept_cloud' | 'keep_local') => Promise<void>;
    debugDiff?: any; // Diagnostic Probe
}

export const CardModal: React.FC<CardModalProps> = ({
    isOpen,
    onClose,
    onSave,
    projects,
    cards,
    initialData,
    googleSyncStatus,
    debugRevision,
    debugTimestamp,
    isCloudSynced,
    hasConflict,
    onResolveConflict,
    debugDiff
}) => {
    // Removed redundant useAppSync call. App.tsx handles sync.
    // React.useEffect(() => {
    //     if (isOpen) {
    //         // checkForUpdates();
    //     }
    // }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black bg-opacity-70 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-md bg-slate-900 border border-gray-800 rounded-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-4 text-gray-100">
                    {initialData ? 'Edit Card' : 'New Card'}
                </h2>

                <CardForm
                    onSave={onSave}
                    onCancel={onClose}
                    projects={projects}
                    cards={cards} // Pass cards for linking
                    initialData={initialData}
                    googleSyncStatus={googleSyncStatus}
                    debugRevision={debugRevision}
                    debugTimestamp={debugTimestamp}
                    isCloudSynced={isCloudSynced}
                    hasConflict={hasConflict}
                    onResolveConflict={onResolveConflict}
                    debugDiff={debugDiff}
                />
            </div>
        </div>
    );
};
