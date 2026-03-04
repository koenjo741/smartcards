import React, { useState, useEffect } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { ErrorBoundary } from './ErrorBoundary';
import { Check, Loader2, Trash2 } from 'lucide-react';
import type { Project, Card, Attachment } from '../types';
import { RichTextEditor } from './RichTextEditor';
import DatePicker, { registerLocale } from 'react-datepicker';
import { de } from 'date-fns/locale';
registerLocale('de', de);
import "react-datepicker/dist/react-datepicker.css";

import { ProjectSelector } from './ProjectSelector';
import { AttachmentManager } from './AttachmentManager';
import { LinkedCardsManager } from './LinkedCardsManager';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';

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
    hasConflict?: boolean;
    onResolveConflict?: (strategy: 'accept_cloud' | 'keep_local' | 'manual_merge', dataOverride?: Record<string, unknown>) => Promise<void>;
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
    googleSyncStatus = 'idle',
    hasConflict,
    onResolveConflict
}) => {

    // I will do props definition first.
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [dueDate, setDueDate] = useState('');
    const [linkedCardIds, setLinkedCardIds] = useState<string[]>([]);
    // const [linkSearch, setLinkSearch] = useState(''); // Moved to LinkedCardsManager

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
    // Logic moved to AttachmentManager
    // Preview State & Effect removed (unused)

    // Google Calendar Events State for Standard Card (Todo)
    const [gcalEvents, setGcalEvents] = useState<any[]>([]);
    const { listUpcomingEvents } = useGoogleCalendar();

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
            // Update state if initialData changes (e.g. from Sync)
            // We check if value is different to avoid unnecessary re-renders, 
            // though React state updates are cheap if value is same.
            // The critical part is that we DO update if the server sent new data.
            setTitle(prev => initialData.title !== prev ? initialData.title : prev);
            setContent(prev => initialData.content !== prev ? initialData.content : prev);
            setSelectedProjectIds(prev => JSON.stringify(initialData.projectIds) !== JSON.stringify(prev) ? (initialData.projectIds || []) : prev);
            setDueDate(prev => (initialData.dueDate || '') !== prev ? (initialData.dueDate || '') : prev);
            setAttachments(prev => JSON.stringify(initialData.attachments) !== JSON.stringify(prev) ? (initialData.attachments || []) : prev);
            setLinkedCardIds(prev => JSON.stringify(initialData.linkedCardIds) !== JSON.stringify(prev) ? (initialData.linkedCardIds || []) : prev);
        } else {
            setTitle('');
            setContent('');
            setSelectedProjectIds([]);
            setDueDate('');
            setAttachments([]);
            setLinkedCardIds([]);
        }
    }, [initialData]);

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

    const todoProject = projects.find(proj => proj.name === 'TODO');
    const isTodoCard = initialData && todoProject && initialData.projectIds.includes(todoProject.id);

    // Fetch Google Calendar Events for Standard Card
    useEffect(() => {
        if (isTodoCard) {
            listUpcomingEvents().then(events => {
                setGcalEvents(events);
            });
        }
    }, [isTodoCard, listUpcomingEvents]);

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

            {/* Hide Project Selector for Standard Card (Todo) */}
            {!isTodoCard && (
                <div>
                    <ProjectSelector
                        projects={projects}
                        selectedProjectIds={selectedProjectIds}
                        onToggleProject={toggleProject}
                        isTodoCard={!!isTodoCard}
                    />
                </div>
            )}

            <div>
                <label className="block text-sm font-medium mb-1 text-gray-300">
                    Content
                </label>
                <div className="flex-1 min-h-[400px]">
                    <ErrorBoundary fallbackTitle="Editor Error" fallbackMessage="Could not load the text editor.">
                        <RichTextEditor
                            content={content}
                            onChange={setContent}
                            userColors={customColors}
                            onUserColorsChange={onUpdateCustomColors}
                            isStandAlone={!!isTodoCard}
                            gcalEvents={gcalEvents}
                        />
                    </ErrorBoundary>
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
                <AttachmentManager
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                />
            </div>

            <div>
                <LinkedCardsManager
                    linkedCardIds={linkedCardIds}
                    allCards={cards}
                    currentCardId={initialData?.id}
                    onUpdateLinks={setLinkedCardIds}
                    onNavigate={onSelectCard}
                />
            </div>
            {/* ... skipping to footer ... */}
            <div className="flex justify-end items-center pt-4 space-x-2 border-t border-gray-700 mt-6">
                {/* Footer Actions (Cancel / Save only) */}
                <div className="flex items-center space-x-2">
                    {!initialData ? (
                        <>
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={selectedProjectIds.length === 0}
                                className={`px-4 py-2 text-sm text-white rounded-md transition-colors font-medium shadow-lg ${selectedProjectIds.length === 0
                                    ? 'bg-gray-600 cursor-not-allowed opacity-50'
                                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/20'
                                    }`}
                                title={selectedProjectIds.length === 0 ? "Please select a project first" : undefined}
                            >
                                Create Card
                            </button>
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

                                {/* FORCE SYNC BUTTON for Deadlock Scenarios (Only show on Conflict) */}
                                {hasConflict && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!onResolveConflict) return;

                                            // Construct Current State Manually to Bypass React State Delay
                                            const currentData = initialData;
                                            const updatedCard = {
                                                ...(currentData || {}),
                                                title,
                                                content,
                                                projectIds: selectedProjectIds,
                                                dueDate: dueDate || undefined,
                                                attachments,
                                                linkedCardIds: linkedCardIds || [],
                                                googleEventId: dueDate ? currentData?.googleEventId : undefined,
                                                googleCalendarId: dueDate ? currentData?.googleCalendarId : undefined
                                            } as Card;

                                            // Save locally first (UI update)
                                            onSave(updatedCard);

                                            // Construct Full Payload for Upload
                                            const updatedCards = cards.map(c => c.id === updatedCard.id ? updatedCard : c);
                                            // If new card (no ID match), append it? 
                                            // Force Push usually happens on existing cards. 
                                            // If new card, 'cards' prop won't have it yet.
                                            // But 'initialData' usually implies existing.

                                            const payload = {
                                                projects,
                                                cards: updatedCards,
                                                customColors
                                            };


                                            onResolveConflict('keep_local', payload);
                                        }}
                                        className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded ml-2 uppercase font-bold tracking-wider"
                                        title="Overwrite Cloud with Local Version (Includes current edits)"
                                    >
                                        FORCE SAVE NOW
                                    </button>
                                )}
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
