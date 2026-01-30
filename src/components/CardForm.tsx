import React, { useState, useEffect } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { Check, FileText, Paperclip, Trash2, Loader2, ExternalLink, Eye, X, Link } from 'lucide-react';
import type { Project, Card, Attachment } from '../types';
import { RichTextEditor } from './RichTextEditor';
import DatePicker, { registerLocale } from 'react-datepicker';
import { de } from 'date-fns/locale';
registerLocale('de', de);
import "react-datepicker/dist/react-datepicker.css";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useDropbox } from '../hooks/useDropbox';
// import { useGoogleCalendar } from '../hooks/useGoogleCalendar';

interface CardFormProps {
    onSave: (card: Omit<Card, 'id'> | Card) => void;
    onCancel: () => void;
    projects: Project[];
    cards?: Card[]; // Potential linked cards
    initialData?: Card | null;
    onSelectCard?: (card: Card) => void; // For navigation
    className?: string; // Allow custom styling wrapper
    customColors?: string[];
    onUpdateCustomColors?: (colors: string[]) => void;
    isCloudSynced?: boolean;
    isSyncing?: boolean;
    googleSyncStatus?: 'idle' | 'syncing' | 'success' | 'error' | 'deleted';
}

export const CardForm: React.FC<CardFormProps> = ({
    onSave,
    onCancel,
    projects,
    cards = [],
    initialData,
    onSelectCard,
    className,
    customColors = [],
    onUpdateCustomColors,
    isCloudSynced,
    isSyncing,
    googleSyncStatus = 'idle'
}) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [dueDate, setDueDate] = useState('');
    const [linkedCardIds, setLinkedCardIds] = useState<string[]>([]);
    const [linkSearch, setLinkSearch] = useState('');

    // Confirmation State
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

    // Attachment State
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const { uploadFile, getFileContent, deleteFile } = useDropbox();
    // Preview State & Effect removed (unused)

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
            setAttachments(initialData.attachments || []);
            setLinkedCardIds(initialData.linkedCardIds || []);
        } else {
            setTitle('');
            setContent('');
            setSelectedProjectIds([]);
            setDueDate('');
            setAttachments([]);
            setLinkedCardIds([]);
        }
    }, [initialData?.id]);

    useEffect(() => {
        if (!initialDataRef.current) return;

        setSaveStatus('saving');
        const timeoutId = setTimeout(() => {
            const currentData = initialDataRef.current;
            onSaveRef.current({
                ...(currentData || {}),
                title,
                content,
                projectIds: selectedProjectIds,
                dueDate: dueDate || undefined,
                attachments,
                linkedCardIds: linkedCardIds || [],
                googleEventId: dueDate ? currentData?.googleEventId : undefined,
                googleCalendarId: dueDate ? currentData?.googleCalendarId : undefined
            } as Card);
            setSaveStatus('saved');
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [title, content, selectedProjectIds, dueDate, attachments, linkedCardIds]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const currentData = initialData;
        onSave({
            ...(currentData || {}),
            title,
            content,
            projectIds: selectedProjectIds,
            dueDate: dueDate || undefined,
            attachments,
            linkedCardIds: linkedCardIds || [],
            googleEventId: dueDate ? currentData?.googleEventId : undefined,
            googleCalendarId: dueDate ? currentData?.googleCalendarId : undefined
        } as Card);
    };

    const toggleProject = (projectId: string) => {
        setSelectedProjectIds(prev =>
            prev.includes(projectId)
                ? prev.filter(id => id !== projectId)
                : [...prev, projectId]
        );
    };

    // ... (in handleExportPDF)

    // handleExportPDF removed (unused)

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
                        const isDisabled = !!isTodoCard;

                        // NEW: Hide TODO project button unless the card is ALREADY in it (to allow removal)
                        // or if we are editing the primary TODO card itself.
                        if (p.name === 'TODO' && !isSelected) {
                            return null;
                        }

                        return (
                            <button
                                key={p.id}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => toggleProject(p.id)}
                                className={`
                  inline-flex items-center space-x-1 px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-sm font-medium transition-all border
                  ${isSelected
                                        ? 'border-transparent shadow-sm text-white'
                                        : 'bg-slate-800 border-gray-700 text-gray-400 hover:bg-slate-700 hover:text-gray-200'}
                  ${isDisabled && !isSelected ? 'opacity-30 cursor-not-allowed' : ''}
                  ${isDisabled && isSelected ? 'cursor-default' : ''}
                `}
                                style={isSelected ? { backgroundColor: p.color } : {}}
                            >
                                <span>{p.name}</span>
                                {isSelected && <Check className="w-3 h-3 ml-1" />}
                            </button>
                        )
                    })}

                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1 text-gray-300">
                    Content
                </label>
                <div className="flex-1 min-h-[400px]">
                    <RichTextEditor
                        content={content}
                        onChange={setContent}
                        userColors={customColors}
                        onUserColorsChange={onUpdateCustomColors}
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
                                const offset = date.getTimezoneOffset();
                                const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
                                setDueDate(adjustedDate.toISOString().split('T')[0]);
                            } else {
                                setDueDate('');
                                // Deletion is now handled by onSave in App.tsx for better state management
                            }
                        }}
                        dateFormat="dd.MM.yyyy"
                        className="w-full px-3 py-2 bg-slate-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 placeholder-gray-500"
                        placeholderText="Select due date"
                        isClearable
                        todayButton="Heute"
                        locale="de"
                    />
                </div>
            )}

            <div>
                <label className="block text-sm font-medium mb-1 text-gray-300 flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    Linked Cards
                </label>

                {/* List of linked cards */}
                <div className="flex flex-wrap gap-2 mb-2">
                    {/* ... */}
                </div>
                {/* ... */}
            </div>
            {/* ... skipping to footer ... */}
            <div className="flex justify-end items-center pt-4 space-x-2 border-t border-gray-700 mt-6">
                {/* Footer Actions (Cancel / Save only) */}
                <div className="flex items-center space-x-2">
                    {!initialData ? (
                        <>
                            {/* ... */}
                        </>
                    ) : (
                        <div className="text-sm text-gray-500 italic flex items-center space-x-2">
                            {/* Google Calendar Status */}
                            {googleSyncStatus === 'syncing' && (
                                <span className="text-blue-400 flex items-center">
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Updating Google Calendar...
                                </span>
                            )}
                            {googleSyncStatus === 'success' && (
                                <span className="text-green-500 flex items-center">
                                    <Check className="w-3 h-3 mr-1" />
                                    Calendar Updated
                                </span>
                            )}
                            {googleSyncStatus === 'deleted' && (
                                <span className="text-orange-400 flex items-center">
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Date deleted from Google Calendar
                                </span>
                            )}
                            {googleSyncStatus === 'error' && (
                                <span className="text-red-500 flex items-center">
                                    Error updating Calendar
                                </span>
                            )}

                            {/* Divider if both statuses are visible */}
                            {(googleSyncStatus !== 'idle') && <span className="text-gray-600">|</span>}

                            {/* Dropbox / Combined Status */}
                            <span>
                                {saveStatus === 'saving' ? 'Saving...' :
                                    (typeof isCloudSynced !== 'undefined' && !isCloudSynced) ?
                                        (isSyncing ? 'Syncing to Dropbox...' : 'Pending Upload...') :
                                        (initialData?.googleEventId && googleSyncStatus === 'idle')
                                            ? 'Saved to Dropbox & Google Calendar'
                                            : 'Saved to Dropbox'}
                            </span>
                        </div>
                    )}
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
        </form>
    );
};
