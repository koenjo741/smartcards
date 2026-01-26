import React from 'react';
import { Sidebar } from './Sidebar';
import type { Project } from '../types';

interface LayoutProps {
    children: React.ReactNode;
    projects: Project[];
    onAddProject: () => void;
    selectedProjectId: string | null;
    onSelectProject: (id: string | null) => void;
    onEditProject: (project: Project) => void;
    onOpenSettings: () => void;
    connectionError?: boolean;
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
    children,
    projects,
    onAddProject,
    selectedProjectId,
    onSelectProject,
    onEditProject,
    onOpenSettings,
    connectionError,
    searchQuery,
    onSearchChange
}) => {
    // Mobile Sidebar State
    const [isSidebarOpen, setSidebarOpen] = React.useState(false);

    return (
        <div className="flex h-screen bg-white relative flex-col md:flex-row">
            {connectionError && (
                <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-center py-2 z-50 font-bold shadow-md animate-pulse">
                    ⚠️ CONNECTION LOST: Changes will NOT be saved! Check internet or re-connect.
                </div>
            )}

            {/* Mobile Header */}
            <div className="md:hidden bg-slate-900 border-b border-gray-800 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="text-gray-400 hover:text-white"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <span className="text-lg font-bold text-gray-100">SmartCards</span>
                </div>
            </div>

            <Sidebar
                projects={projects}
                onAddProject={onAddProject}
                selectedProjectId={selectedProjectId}
                onSelectProject={(id) => {
                    onSelectProject(id);
                    setSidebarOpen(false); // Close sidebar on selection
                }}
                onEditProject={onEditProject}
                onOpenSettings={onOpenSettings}
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                isOpen={isSidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />
            <main className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-8">
                <div className="w-full mx-auto h-full flex flex-col">
                    {children}
                </div>
            </main>
        </div>
    );
};
