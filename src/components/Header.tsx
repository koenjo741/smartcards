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
    onResolveConflict?: (strategy: 'accept_cloud' | 'keep_local', dataOverride?: any) => void;
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
    onResolveConflict
}) => {
    return (
        <header className="mb-4 md:mb-6 flex justify-between items-center sticky md:static top-0 z-10 bg-slate-950/95 backdrop-blur py-2 md:py-0 -mx-4 px-4 md:mx-0 md:px-0 border-b md:border-none border-gray-800">
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
                    ) : (
                        <div className="flex items-center space-x-1 text-blue-400 font-bold text-[10px] md:text-xs bg-blue-500/10 px-1.5 py-0.5 rounded">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                            <span>Dropbox</span>
                        </div>
                    )}

                    {hasConflict && (
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => onResolveConflict?.('keep_local')}
                                className="ml-2 flex items-center space-x-1 animate-pulse text-white font-bold text-[10px] md:text-xs bg-red-600 hover:bg-red-500 px-2 py-0.5 rounded shadow-lg border border-red-400 transition-colors"
                                title="Overwrite cloud with local version"
                            >
                                <span>⚠️ Force Push</span>
                            </button>
                            <button
                                onClick={() => onResolveConflict?.('accept_cloud')}
                                className="flex items-center space-x-1 text-white font-bold text-[10px] md:text-xs bg-blue-600 hover:bg-blue-500 px-2 py-0.5 rounded shadow-lg border border-blue-400 transition-colors"
                                title="Update to the latest version from server"
                            >
                                <span>⬇️ Pull Cloud</span>
                            </button>
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
    );
};
