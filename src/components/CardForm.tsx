import React, { useState, useEffect } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { ErrorBoundary } from './ErrorBoundary';
import { Check, Loader2, Trash2 } from 'lucide-react';
import type { Project, Card, Attachment, GanttCardProps } from '../types';
import { RichTextEditor } from './RichTextEditor';
import DatePicker, { registerLocale } from 'react-datepicker';
import { de } from 'date-fns/locale';
registerLocale('de', de);
import "react-datepicker/dist/react-datepicker.css";

import { ProjectSelector } from './ProjectSelector';
import { AttachmentManager } from './AttachmentManager';
import { LinkedCardsManager } from './LinkedCardsManager';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { CompanyAutocomplete } from './CompanyAutocomplete';
import { normalizeDateInput } from '../utils/dateUtils';

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

// Helper function to format numbers with thousands separators
const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

// Custom Input for DatePicker to handle manual normalization safely
const CustomDateInput = React.forwardRef<HTMLInputElement, any>((props, ref) => {
    const { value, onClick, onChange, onBlur: parentOnBlur, placeholder, className, required, disabled } = props;
    const [localValue, setLocalValue] = React.useState(value || '');

    React.useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const input = e.target;
        const rawValue = input.value;
        const normalized = normalizeDateInput(rawValue);

        if (rawValue !== normalized) {
            setLocalValue(normalized);
            // Trigger onChange so DatePicker parses the normalized value
            if (onChange) {
                const event = {
                    target: { ...input, value: normalized },
                    currentTarget: { ...input, value: normalized },
                    type: 'change'
                } as any;
                onChange(event);
            }
        } else if (rawValue !== value) {
            // Even if not normalized, if it changed from the prop value, we should update the parent
            if (onChange) {
                const event = {
                    target: input,
                    currentTarget: input,
                    type: 'change'
                } as any;
                onChange(event);
            }
        }
        
        if (parentOnBlur) {
            parentOnBlur(e);
        }
    };

    return (
        <input
            ref={ref}
            value={localValue}
            onClick={onClick}
            onChange={handleLocalChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={className}
            required={required}
            disabled={disabled}
            type="text"
        />
    );
});

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

}) => {

    // I will do props definition first.
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [isGantt, setIsGantt] = useState<boolean>(false);
    const [dueDate, setDueDate] = useState('');
    const [linkedCardIds, setLinkedCardIds] = useState<string[]>([]);
    // GANTT State
    const [ganttData, setGanttData] = useState<Partial<GanttCardProps>>({ status: 'Geplant', milestones: [] });
    const [newMilestoneDate, setNewMilestoneDate] = useState<string>('');
    const [newMilestoneTitle, setNewMilestoneTitle] = useState<string>('');

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
            setIsGantt(prev => (initialData.isGantt || false) !== prev ? (initialData.isGantt || false) : prev);
            if (initialData.gantt) {
                setGanttData(initialData.gantt);
            }
        } else {
            setTitle('');
            setContent('');
            setSelectedProjectIds([]);
            setDueDate('');
            setAttachments([]);
            setLinkedCardIds([]);
            setIsGantt(false);
            setGanttData({ status: 'Geplant', milestones: [] });
        }
    }, [initialData]);

    // Enforce GANTT constraint: only exactly 1 project can be selected AND it must be a GANTT project
    useEffect(() => {
        if (isGantt) {
            if (selectedProjectIds.length !== 1) {
                setIsGantt(false);
            } else {
                const selectedProj = projects.find(p => p.id === selectedProjectIds[0]);
                if (!selectedProj?.isGantt) {
                    setIsGantt(false);
                }
            }
        }
    }, [selectedProjectIds, isGantt, projects]);

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
                googleCalendarId: dueDate ? currentData?.googleCalendarId : undefined,
                isGantt: selectedProjectIds.length === 1 ? isGantt : false,
                gantt: (selectedProjectIds.length === 1 && isGantt) ? (ganttData as GanttCardProps) : undefined
            } as Card);
            setSaveStatus('saved');
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [title, content, selectedProjectIds, dueDate, attachments, linkedCardIds, isGantt, ganttData]);

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
            googleCalendarId: dueDate ? currentData?.googleCalendarId : undefined,
            isGantt: selectedProjectIds.length === 1 ? isGantt : false,
            gantt: (selectedProjectIds.length === 1 && isGantt) ? (ganttData as GanttCardProps) : undefined
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
                <div className="space-y-3">
                    <ProjectSelector
                        projects={projects}
                        selectedProjectIds={selectedProjectIds}
                        onToggleProject={toggleProject}
                        isTodoCard={!!isTodoCard}
                        isGantt={isGantt}
                        onGanttChange={setIsGantt}
                    />
                </div>
            )}

            {/* Render Standard Fields OR GANTT Fields */}
            {!isGantt ? (
                <>
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
                                customInput={<CustomDateInput />}
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
                </>
            ) : (
                <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-300">
                                Beginn
                            </label>
                            <DatePicker
                                selected={ganttData.startDate ? new Date(ganttData.startDate) : null}
                                onChange={(date: Date | null) => {
                                    if (date) {
                                        if (ganttData.endDate && date > new Date(ganttData.endDate)) {
                                            alert('Das Startdatum darf nicht nach dem Enddatum liegen.');
                                            setGanttData(prev => ({ ...prev, startDate: undefined }));
                                            return;
                                        }
                                        const offset = date.getTimezoneOffset();
                                        const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
                                        setGanttData(prev => ({ ...prev, startDate: adjustedDate.toISOString().split('T')[0] }));
                                    } else {
                                        setGanttData(prev => ({ ...prev, startDate: undefined }));
                                    }
                                }}
                                dateFormat="dd.MM.yyyy"
                                className="w-full px-2 py-1 bg-[#020617] border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                                placeholderText="DD.MM.YYYY"
                                isClearable
                                todayButton="Heute"
                                locale="de"
                                customInput={<CustomDateInput />}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-300">
                                Ende
                            </label>
                            <DatePicker
                                selected={ganttData.endDate ? new Date(ganttData.endDate) : null}
                                onChange={(date: Date | null) => {
                                    if (date) {
                                        if (ganttData.startDate && date < new Date(ganttData.startDate)) {
                                            alert('Das Enddatum darf nicht vor dem Startdatum liegen.');
                                            setGanttData(prev => ({ ...prev, endDate: undefined }));
                                            return;
                                        }
                                        const offset = date.getTimezoneOffset();
                                        const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
                                        setGanttData(prev => ({ ...prev, endDate: adjustedDate.toISOString().split('T')[0] }));
                                    } else {
                                        setGanttData(prev => ({ ...prev, endDate: undefined }));
                                    }
                                }}
                                dateFormat="dd.MM.yyyy"
                                className={`w-full px-2 py-1 bg-[#020617] border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 placeholder-gray-500 ${!ganttData.startDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                                placeholderText="DD.MM.YYYY"
                                isClearable
                                todayButton="Heute"
                                locale="de"
                                disabled={!ganttData.startDate}
                                customInput={<CustomDateInput />}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-300">
                            Info
                        </label>
                        <textarea
                            value={ganttData.info || ''}
                            onChange={(e) => setGanttData(prev => ({ ...prev, info: e.target.value }))}
                            rows={3}
                            className="w-full px-2 py-1 bg-[#020617] border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 placeholder-gray-500 resize-y"
                            placeholder="Zusätzliche Informationen..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-300">
                                Status
                            </label>
                            <select
                                value={ganttData.status || 'Geplant'}
                                onChange={(e) => {
                                    const newStatus = e.target.value as 'Geplant' | 'In Arbeit' | 'Fertig';
                                    setGanttData(prev => ({ 
                                        ...prev, 
                                        status: newStatus,
                                        progress: newStatus === 'Geplant' ? 0 : prev.progress
                                    }));
                                }}
                                className="w-full px-2 py-1 bg-[#020617] border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                            >
                                <option value="Geplant">Geplant</option>
                                <option value="In Arbeit">In Arbeit</option>
                                <option value="Fertig">Fertig</option>
                            </select>
                        </div>
                        <div className={ganttData.status === 'Geplant' ? 'opacity-50 cursor-not-allowed' : ''}>
                            <label className="block text-sm font-medium mb-1 text-gray-300">
                                Fortschritt (%)
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                disabled={ganttData.status === 'Geplant'}
                                value={ganttData.progress === 0 ? "0" : (ganttData.progress || '')}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    setGanttData(prev => ({ ...prev, progress: val === '' ? 0 : parseInt(val, 10) }));
                                }}
                                onBlur={(e) => {
                                    let val = parseInt(e.target.value, 10);
                                    if (isNaN(val)) val = 0;
                                    val = Math.max(0, Math.min(100, val));
                                    setGanttData(prev => ({ ...prev, progress: val }));
                                }}
                                className="w-full px-2 py-1 bg-[#020617] border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 disabled:bg-slate-900/50 disabled:text-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-300">
                                Budget, zugewiesen
                            </label>
                            <input
                                type="text"
                                defaultValue={formatCurrency(ganttData.plannedBudget)}
                                onBlur={(e) => {
                                    const val = e.target.value.replace(/\./g, '').replace(',', '.');
                                    const num = val === '' ? undefined : Number(val);
                                    if (num === undefined || !isNaN(num)) {
                                        setGanttData(prev => ({ ...prev, plannedBudget: num }));
                                        e.target.value = formatCurrency(num);
                                    }
                                }}
                                className="w-full px-2 py-1 bg-[#020617] border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-300">
                                Budget, verbraucht
                            </label>
                            <input
                                type="text"
                                defaultValue={formatCurrency(ganttData.consumedBudget)}
                                onBlur={(e) => {
                                    const val = e.target.value.replace(/\./g, '').replace(',', '.');
                                    const num = val === '' ? undefined : Number(val);
                                    if (num === undefined || !isNaN(num)) {
                                        setGanttData(prev => ({ ...prev, consumedBudget: num }));
                                        e.target.value = formatCurrency(num);
                                    }
                                }}
                                className={`w-full px-2 py-1 bg-[#020617] border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium ${(ganttData.consumedBudget ?? 0) > (ganttData.plannedBudget ?? 0)
                                    ? 'border-red-500 text-red-400'
                                    : 'border-green-500/50 text-green-400'
                                    }`}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-300">
                            Firmen
                        </label>
                        <CompanyAutocomplete
                            value={ganttData.companies || []}
                            onChange={(companies) => setGanttData(prev => ({ ...prev, companies }))}
                            allGanttCards={cards.filter(c => c.isGantt)}
                            currentCardId={initialData?.id}
                        />
                    </div>

                    <div className="border-t border-slate-700/50 pt-4 mt-4">
                        <label className="block text-sm font-medium mb-3 text-gray-300">
                            Meilensteine
                        </label>
                        
                        {/* List of existing milestones */}
                        {ganttData.milestones && ganttData.milestones.length > 0 && (
                            <div className="space-y-2 mb-4">
                                {ganttData.milestones.sort((a, b) => a.date.localeCompare(b.date)).map(milestone => (
                                    <div key={milestone.id} className="flex items-center justify-between bg-slate-900/50 p-2 rounded-md border border-slate-700/50">
                                        <div className="flex items-center space-x-3">
                                            <div className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded">
                                                {new Date(milestone.date).toLocaleDateString('de-DE')}
                                            </div>
                                            <div className="text-sm text-gray-200">{milestone.title}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setGanttData(prev => ({
                                                    ...prev,
                                                    milestones: prev.milestones?.filter(m => m.id !== milestone.id)
                                                }));
                                            }}
                                            className="text-gray-500 hover:text-red-400 p-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add new milestone row */}
                        <div className="flex items-end space-x-2">
                            <div className="w-36">
                                <label className="block text-xs text-gray-400 mb-1">Datum</label>
                                <DatePicker
                                    selected={newMilestoneDate ? new Date(newMilestoneDate) : null}
                                    onChange={(date: Date | null) => {
                                        if (date) {
                                            const offset = date.getTimezoneOffset();
                                            const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
                                            setNewMilestoneDate(adjustedDate.toISOString().split('T')[0]);
                                        } else {
                                            setNewMilestoneDate('');
                                        }
                                    }}
                                    dateFormat="dd.MM.yyyy"
                                    className="w-full px-2 py-1.5 bg-[#020617] border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 text-sm"
                                    placeholderText="DD.MM.YYYY"
                                    isClearable
                                    locale="de"
                                    customInput={<CustomDateInput />}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs text-gray-400 mb-1">Kurztext</label>
                                <input
                                    type="text"
                                    value={newMilestoneTitle}
                                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                                    placeholder="Bezeichnung..."
                                    className="w-full px-2 py-1.5 bg-[#020617] border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 text-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (newMilestoneDate && newMilestoneTitle.trim()) {
                                                setGanttData(prev => ({
                                                    ...prev,
                                                    milestones: [...(prev.milestones || []), {
                                                        id: Date.now().toString(),
                                                        date: newMilestoneDate,
                                                        title: newMilestoneTitle.trim()
                                                    }]
                                                }));
                                                setNewMilestoneDate('');
                                                setNewMilestoneTitle('');
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <button
                                type="button"
                                disabled={!newMilestoneDate || !newMilestoneTitle.trim()}
                                onClick={() => {
                                    if (newMilestoneDate && newMilestoneTitle.trim()) {
                                        setGanttData(prev => ({
                                            ...prev,
                                            milestones: [...(prev.milestones || []), {
                                                id: Date.now().toString(),
                                                date: newMilestoneDate,
                                                title: newMilestoneTitle.trim()
                                            }]
                                        }));
                                        setNewMilestoneDate('');
                                        setNewMilestoneTitle('');
                                    }
                                }}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-md transition-colors h-[34px]"
                            >
                                Hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
