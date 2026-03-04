import React from 'react';
import { Download, Plus, Loader2 } from 'lucide-react';
import type { Project } from '../types';

interface HeaderProps {
    selectedProject: Project | undefined;
    connectionError: boolean;
    isSyncing: boolean;
    isGoogleAuthenticated: boolean;
    isStandalone: boolean;
    onInstallClick: () => void;
    onOpenNewCard: () => void;
    expandedCardId: string | null;
    hasConflict?: boolean;
    onResolveConflict?: (strategy: 'accept_cloud' | 'keep_local' | 'manual_merge', dataOverride?: any) => void;
    isDirty?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
    selectedProject,
    connectionError,
    isSyncing,
    isGoogleAuthenticated,
    isStandalone,
    onInstallClick,
    onOpenNewCard,
    expandedCardId,
    hasConflict,
    onResolveConflict,
    isDirty
}) => {
    return (
        <div className="sticky md:static top-0 z-10">
            {hasConflict && (
                <div className="bg-red-600 text-white p-4 mb-2 md:mb-4 md:mt-2 mx-[-16px] md:mx-0 rounded-none md:rounded-lg shadow-lg border-y md:border-2 border-red-400 flex flex-col sm:flex-row items-start sm:items-center justify-between animate-[pulse_3s_ease-in-out_infinite] z-50 relative">
                    <div>
                        <h2 className="font-bold text-lg mb-1 flex items-center">
                            <span className="mr-2">⚠️</span> Synchronisations-Konflikt!
                        </h2>
                        <p className="text-sm text-red-100 font-medium">
                            Deine lokalen Daten weichen von den Daten in Dropbox ab (z.B. durch Offline-Nutzung).
                            Bitte wähle, wie du fortfahren möchtest:
                        </p>
                    </div>
                    <div className="mt-3 sm:mt-0 flex flex-wrap gap-2 shrink-0 w-full sm:w-auto">
                        <button
                            onClick={() => onResolveConflict?.('manual_merge')}
                            className="flex-1 sm:flex-none bg-yellow-500 text-yellow-900 hover:bg-yellow-400 font-bold py-2 px-3 sm:px-4 rounded shadow-md transition-colors border border-yellow-200 text-xs sm:text-sm"
                            title="Lade die Cloud-Daten, aber behalte lokale Änderungen als Duplikate ('[LOKAL_KOPIE]')"
                        >
                            Manuell mergen (Sicher)
                        </button>
                        <button
                            onClick={() => onResolveConflict?.('keep_local')}
                            className="flex-1 sm:flex-none bg-white text-red-700 hover:bg-red-50 font-bold py-2 px-3 sm:px-4 rounded shadow-md transition-colors border border-red-200 text-xs sm:text-sm"
                        >
                            Lokale erzwingen
                        </button>
                        <button
                            onClick={() => onResolveConflict?.('accept_cloud')}
                            className="flex-1 sm:flex-none bg-red-800 hover:bg-red-900 text-white font-bold py-2 px-3 sm:px-4 rounded shadow-md transition-colors border border-red-500 text-xs sm:text-sm"
                        >
                            Verwerfen & Cloud laden
                        </button>
                    </div>
                </div>
            )}
            <header className="mb-4 md:mb-6 flex justify-between items-center bg-slate-950/95 backdrop-blur py-2 md:py-0 -mx-4 px-4 md:mx-0 md:px-0 border-b md:border-none border-gray-800">
                <div>
                    <div className="flex items-center space-x-2">
                        <h1 className="text-xl md:text-3xl font-bold text-white">
                            {selectedProject ? selectedProject.name : 'All Cards'}
                        </h1>
                    </div>
                    <div className="flex items-center space-x-2 mt-1 flex-wrap gap-y-1">
                        <p className="hidden md:block text-gray-400">
                            {selectedProject ? 'Cards for ' + selectedProject.name : 'Manage themes and ideas'}
                        </p>
                        <span className="hidden md:inline text-gray-600">|</span>

                        {/* Dropbox Status */}
                        {connectionError ? (
                            <div className="flex items-center space-x-1 text-yellow-500 font-bold text-[10px] md:text-xs bg-yellow-500/10 px-1.5 py-0.5 rounded animate-pulse">
                                <span>⚠️</span>
                                <span>Dropbox: Disconnected</span>
                            </div>
                        ) : isSyncing ? (
                            <div className="flex items-center space-x-1 text-blue-400 font-bold text-[10px] md:text-xs bg-blue-500/10 px-1.5 py-0.5 rounded">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Syncing...</span>
                            </div>
                        ) : isDirty ? (
                            <div className="flex items-center space-x-1 text-orange-400 font-bold text-[10px] md:text-xs bg-orange-500/10 px-1.5 py-0.5 rounded" title="Unsaved changes pending">
                                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></span>
                                <span>Unsaved</span>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-1 text-blue-400 font-bold text-[10px] md:text-xs bg-blue-500/10 px-1.5 py-0.5 rounded">
                                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                                <span>Cloud Synced</span>
                            </div>
                        )}

                        <span className="hidden md:inline text-gray-600">|</span>

                        {/* Google Calendar Status */}
                        {isGoogleAuthenticated ? (
                            <div className="flex items-center space-x-1 text-green-400 font-bold text-[10px] md:text-xs bg-green-500/10 px-1.5 py-0.5 rounded">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                                <span>G-Cal</span>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-1 text-gray-400 font-bold text-[10px] md:text-xs bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700" title="Not connected to Google Calendar">
                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                                <span>G-Cal</span>
                            </div>
                        )}

                        {/* PWA Install Button */}
                        {!isStandalone && (
                            <>
                                <span className="hidden md:inline text-gray-600">|</span>
                                <button
                                    onClick={onInstallClick}
                                    className="flex items-center space-x-1 text-green-400 hover:text-green-300 font-bold text-[10px] md:text-xs bg-green-500/10 hover:bg-green-500/20 px-1.5 py-0.5 rounded transition-colors"
                                >
                                    <Download className="w-3 h-3" />
                                    <span className="hidden md:inline">Install</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {!expandedCardId && (!selectedProject || selectedProject.name !== 'TODO') && (
                    <button
                        onClick={onOpenNewCard}
                        disabled={connectionError}
                        className={`flex items-center space-x-1 md:space-x-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors shadow-sm ${connectionError ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                        <Plus className="w-4 h-4 md:w-5 md:h-5" />
                        <span className="text-sm md:text-base whitespace-nowrap">New Card</span>
                    </button>
                )}
            </header>
        </div>
    );
};
