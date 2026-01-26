import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import type { Project, Card } from '../types';
import { RichTextEditor } from './RichTextEditor';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface CardFormProps {
    onSave: (card: Omit<Card, 'id'> | Card) => void;
    onCancel: () => void;
    projects: Project[];
    initialData?: Card | null;
    className?: string; // Allow custom styling wrapper
}

export const CardForm: React.FC<CardFormProps> = ({
    onSave,
    onCancel,
    projects,
    initialData,
    className
}) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [dueDate, setDueDate] = useState('');

    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

    // Use ref to hold the latest onSave callback to avoid effect dependencies
    const onSaveRef = React.useRef(onSave);
    const initialDataRef = React.useRef(initialData);

    useEffect(() => {
        onSaveRef.current = onSave;
        initialDataRef.current = initialData;
    }, [onSave, initialData]);

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            setContent(initialData.content);
            setSelectedProjectIds(initialData.projectIds || []);
            setDueDate(initialData.dueDate || '');
        } else {
            setTitle('');
            setContent('');
            setSelectedProjectIds([]);
            setDueDate('');
        }
    }, [initialData?.id]); // Only reset form when switching cards (ID changes), not when content updates triggers prop update

    useEffect(() => {
        if (!initialDataRef.current) return;

        setSaveStatus('saving');
        const timeoutId = setTimeout(() => {
            onSaveRef.current({
                ...(initialDataRef.current || {}),
                title,
                content,
                projectIds: selectedProjectIds,
                dueDate: dueDate || undefined
            } as Card);
            setSaveStatus('saved');
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [title, content, selectedProjectIds, dueDate]); // Depend ONLY on user-editable state

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...(initialData || {}),
            title,
            content,
            projectIds: selectedProjectIds,
            dueDate: dueDate || undefined
        } as Card);
    };

    const toggleProject = (projectId: string) => {
        setSelectedProjectIds(prev =>
            prev.includes(projectId)
                ? prev.filter(id => id !== projectId)
                : [...prev, projectId]
        );
    };

    const todoProject = projects.find(proj => proj.name === 'TODO');
    const isTodoCard = initialData && todoProject && initialData.projectIds.includes(todoProject.id);

    return (
        <form onSubmit={handleSubmit} className={`space-y-4 ${className || ''}`}>
            <div>
                <label className="block text-sm font-medium mb-1 text-gray-300">
                    Title
                </label>
                <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 placeholder-gray-500 font-bold"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                    Projects
                </label>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                    {projects.map(p => {
                        const isSelected = selectedProjectIds.includes(p.id);

                        // If it's the TODO card, prevent changing projects
                        // We disable all buttons. The TODO project will remain selected (read-only).
                        const isDisabled = !!isTodoCard;

                        return (
                            <button
                                key={p.id}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => toggleProject(p.id)}
                                className={`
                  inline-flex items-center space-x-1 px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-sm font-medium transition-all border
                  ${isSelected
                                        ? 'border-transparent shadow-sm text-white' // Active: White text
                                        : 'bg-slate-800 border-gray-700 text-gray-400 hover:bg-slate-700 hover:text-gray-200'} // Inactive
                  ${isDisabled && !isSelected ? 'opacity-30 cursor-not-allowed' : ''} // Dim ONLY unselected disabled items
                  ${isDisabled && isSelected ? 'cursor-default' : ''} // Show active disabled items normally but unclickable
                `}
                                style={isSelected ? { backgroundColor: p.color } : {}}
                            >
                                <span>{p.name}</span>
                                {isSelected && <Check className="w-3 h-3 ml-1" />}
                            </button>
                        )
                    })}
                </div>
                {projects.length === 0 && (
                    <p className="text-xs text-gray-500 italic">No projects available.</p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium mb-1 text-gray-300">
                    Content
                </label>
                <div className="flex-1 min-h-[400px]">
                    <RichTextEditor
                        key={initialData?.id || 'new'}
                        content={content}
                        onChange={setContent}
                    />
                </div>
            </div>

            {!isTodoCard && (
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-300">
                        Due Date
                    </label>
                    <DatePicker
                        selected={dueDate ? new Date(dueDate) : null}
                        onChange={(date: Date | null) => {
                            if (date) {
                                // Format as YYYY-MM-DD for consistency with existing type
                                const offset = date.getTimezoneOffset();
                                const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
                                setDueDate(adjustedDate.toISOString().split('T')[0]);
                            } else {
                                setDueDate('');
                            }
                        }}
                        dateFormat="dd.MM.yyyy"
                        className="w-full px-3 py-2 bg-slate-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 placeholder-gray-500"
                        placeholderText="Select due date"
                        isClearable
                    />
                </div>
            )}

            <div className="flex justify-end pt-4 space-x-2 border-t border-gray-700 mt-6">
                {!initialData ? (
                    <>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-slate-800 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={selectedProjectIds.length === 0}
                            className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${selectedProjectIds.length === 0 ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-blue-600 hover:bg-blue-700'}`}
                            title={selectedProjectIds.length === 0 ? "Select at least one project" : ""}
                        >
                            Save
                        </button>
                    </>
                ) : (
                    <div className="text-sm text-gray-500 italic flex items-center">
                        {saveStatus === 'saving' ? 'Saving...' : 'All changes saved'}
                    </div>
                )}
            </div>
        </form>
    );
};
