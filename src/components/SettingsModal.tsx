import React, { useState } from 'react';
import { Save, FolderOpen, HardDrive, CheckCircle, AlertCircle, X } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import type { Project } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAuthenticated: boolean;
    userName: string | null;
    isSyncing: boolean;
    lastSynced: Date | null;
    onConnect: () => void;
    onDisconnect: () => void;
    onSave: () => void;
    onLoad: () => void;
    projects: Project[];
    onReorderProjects: (projects: Project[]) => void;
    onDeleteProject: (pk: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    isAuthenticated,
    userName,
    isSyncing,
    lastSynced,
    onConnect,
    onDisconnect,
    onSave,
    onLoad,
    projects,
    onReorderProjects,
    onDeleteProject
}) => {
    if (!isOpen) return null;

    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    const moveProject = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index > 0) {
            const newProjects = [...projects];
            [newProjects[index - 1], newProjects[index]] = [newProjects[index], newProjects[index - 1]];
            onReorderProjects(newProjects);
        } else if (direction === 'down' && index < projects.length - 1) {
            const newProjects = [...projects];
            [newProjects[index + 1], newProjects[index]] = [newProjects[index], newProjects[index + 1]];
            onReorderProjects(newProjects);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center z-50 p-4">
            <div className="bg-slate-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-800 shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-blue-500" />
                        Settings
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Project Management */}
                    <div className="space-y-3">
                        <div className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Manage Projects</div>
                        <div className="bg-slate-950 rounded-lg border border-gray-800 divide-y divide-gray-800">
                            {projects.map((p, index) => (
                                <div key={p.id} className="flex items-center justify-between p-3 group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                        <span className={`text-sm font-medium ${p.name === 'TODO' ? 'text-amber-500' : 'text-gray-200'}`}>
                                            {p.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {p.name !== 'TODO' && (
                                            <>
                                                <button
                                                    onClick={() => moveProject(index, 'up')}
                                                    disabled={index === 0}
                                                    className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    onClick={() => moveProject(index, 'down')}
                                                    disabled={index === projects.length - 1}
                                                    className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                                                >
                                                    ▼
                                                </button>
                                                <div className="w-px h-4 bg-gray-800 mx-1"></div>
                                                <button
                                                    onClick={() => {
                                                        setConfirmState({
                                                            isOpen: true,
                                                            title: 'Delete Project',
                                                            message: `Delete project "${p.name}"? Cards will remain unassigned.`,
                                                            onConfirm: () => onDeleteProject(p.id)
                                                        });
                                                    }}
                                                    className="p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                        {p.name === 'TODO' && (
                                            <span className="text-xs text-gray-600 italic px-2">Protected</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>


                    {/* Current Status */}
                    <div className={`p-4 rounded-lg border ${isAuthenticated ? 'bg-blue-900/20 border-blue-500/30' : 'bg-gray-800 border-gray-700'}`}>
                        <div className="flex items-start gap-3">
                            {isAuthenticated ? (
                                <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5" />
                            )}
                            <div>
                                <h3 className="text-sm font-medium text-gray-200">
                                    {isAuthenticated ? `Connected as ${userName}` : 'Not Connected'}
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    {isAuthenticated
                                        ? 'Data synced with Dropbox.'
                                        : 'Connect to sync across devices.'}
                                </p>
                                {lastSynced && (
                                    <p className="text-xs text-green-400 mt-2">
                                        Last Synced: {lastSynced.toLocaleTimeString()}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <div className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Sync Actions</div>

                        {!isAuthenticated ? (
                            <button
                                onClick={onConnect}
                                className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium"
                            >
                                <HardDrive className="w-5 h-5" />
                                Connect Dropbox
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={onSave}
                                    disabled={isSyncing}
                                    className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 border border-gray-700 rounded-lg transition-all group group-hover:border-gray-600"
                                >
                                    <span className="flex items-center gap-3 text-gray-200">
                                        <Save className="w-5 h-5 text-green-500" />
                                        <span>Force Upload</span>
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {isSyncing ? 'Syncing...' : 'Save to Cloud'}
                                    </span>
                                </button>

                                <button
                                    onClick={onLoad}
                                    disabled={isSyncing}
                                    className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 border border-gray-700 rounded-lg transition-all"
                                >
                                    <span className="flex items-center gap-3 text-gray-200">
                                        <FolderOpen className="w-5 h-5 text-yellow-500" />
                                        <span>Force Download</span>
                                    </span>
                                    <span className="text-xs text-gray-500">Overwrite Local</span>
                                </button>

                                <button
                                    onClick={onDisconnect}
                                    className="w-full text-center text-xs text-red-500 hover:text-red-400 mt-4 underline"
                                >
                                    Disconnect account
                                </button>
                            </>
                        )}
                    </div>

                    <div className="text-xs text-gray-500 p-3 bg-gray-900/50 rounded border border-gray-800">
                        <strong>Note:</strong> Data is automatically saved to the cloud when you make changes. Only use manual controls if needed.
                    </div>
                </div>

                <div className="p-4 bg-slate-950 border-t border-gray-800 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-gray-700"
                    >
                        Close
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                isDestructive={true}
            />
        </div>
    );
};
