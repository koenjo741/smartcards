import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Project } from '../types';

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (project: Omit<Project, 'id'> | Project) => void;
    initialData?: Project | null;
}

const COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#8b5cf6', // purple
    '#ef4444', // red
    '#f59e0b', // amber
    '#ec4899', // pink
    '#6366f1', // indigo
    '#14b8a6', // teal
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialData
}) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState(COLORS[0]);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setColor(initialData.color);
        } else {
            setName('');
            setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...(initialData || {}),
            name,
            color,
        } as Project);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black bg-opacity-70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-slate-800 rounded-lg shadow-xl p-6 relative border border-gray-700 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-4 text-gray-100">
                    {initialData ? 'Edit Project' : 'New Project'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Name
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 placeholder-gray-500"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Color
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="w-8 h-8 p-0 rounded-full overflow-hidden border-0 cursor-pointer"
                                title="Custom Color"
                            />
                        </div>
                        <div className="mt-2">
                            <input
                                type="text"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                placeholder="#000000"
                                className="w-full px-3 py-2 bg-slate-900 border border-gray-700 rounded-md text-sm font-mono uppercase text-gray-100 placeholder-gray-500"
                                maxLength={7}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 space-x-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-slate-700 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
