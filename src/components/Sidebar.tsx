import React from 'react';
import { Layout, Settings, Plus, Layers, Pencil, CalendarClock, X } from 'lucide-react';
import type { Project } from '../types';

interface SidebarProps {
    projects: Project[];
    onAddProject: () => void;
    selectedProjectId: string | null;
    onSelectProject: (id: string | null) => void;
    onEditProject: (project: Project) => void;
    onOpenSettings: () => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    // Mobile Props
    isOpen: boolean;
    onClose: () => void;
    // View Mode
    currentView: 'list' | 'timeline';
    onViewChange: (view: 'list' | 'timeline') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    projects,
    onAddProject,
    selectedProjectId,
    onSelectProject,
    onEditProject,
    onOpenSettings,
    searchQuery,
    onSearchChange,
    isOpen,
    onClose,
    currentView,
    onViewChange
}) => {
    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            <aside className={`
                w-64 bg-slate-900 border-r border-gray-800 h-screen flex flex-col
                fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-6 flex items-center space-x-2 border-b border-gray-800">
                    <Layout className="w-6 h-6 text-blue-500" />
                    <span className="text-lg font-bold text-gray-100">SmartCards</span>
                </div>

                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    <button
                        onClick={() => {
                            onViewChange('list');
                            onSelectProject(null);
                        }}
                        className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md transition-all ${currentView === 'list' && selectedProjectId === null
                            ? 'bg-blue-600 text-white shadow-md' // Active: Full Blue
                            : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white' // Inactive: Dark Card
                            }`}
                    >
                        <Layers className="w-4 h-4" />
                        <span>All Projects</span>
                    </button>

                    {/* Desktop-Only Timeline Button */}
                    <button
                        onClick={() => onViewChange('timeline')}
                        className={`hidden md:flex w-full items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md transition-all ${currentView === 'timeline'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white'
                            }`}
                    >
                        <CalendarClock className="w-4 h-4" />
                        <span>Timeline</span>
                    </button>

                    <div className="mt-4 mb-2 relative">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full bg-slate-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 pr-7 focus:outline-none focus:border-blue-500 placeholder-gray-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => onSearchChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-400"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    <div className="px-3 py-2 mt-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Projects
                    </div>

                    <div className="space-y-1">
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                className={`w-full flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-all group ${selectedProjectId === project.id
                                    ? 'text-white shadow-md' // Active
                                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white' // Inactive
                                    }`}
                                style={{ backgroundColor: selectedProjectId === project.id ? project.color : undefined }}
                            >
                                <button
                                    onClick={() => {
                                        onViewChange('list');
                                        onSelectProject(project.id);
                                    }}
                                    className="flex-1 flex items-center space-x-2 text-left"
                                >
                                    {selectedProjectId !== project.id && (
                                        <span
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: project.color }}
                                        />
                                    )}
                                    <span>{project.name}</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEditProject(project);
                                    }}
                                    className={`opacity-0 group-hover:opacity-100 p-1 transition-opacity ${selectedProjectId === project.id ? 'text-white/80 hover:text-white' : 'text-gray-500 hover:text-blue-400'}`}
                                    title="Edit project"
                                >
                                    <Pencil className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={onAddProject}
                        className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-500 hover:text-blue-400 hover:bg-slate-800 rounded-md transition-all dash-border border-gray-700 mt-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Project</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <button
                        onClick={onOpenSettings}
                        className="flex items-center space-x-3 text-sm font-medium text-gray-400 hover:text-gray-200"
                    >
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                    </button>
                </div>
            </aside>
        </>
    );
};
