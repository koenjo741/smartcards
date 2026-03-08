import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { Card, Project } from '../types';
import { Maximize2, Minimize2 } from 'lucide-react';
import clsx from 'clsx';
import { format, addDays, startOfMonth, differenceInDays, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';

interface GanttViewProps {
    cards: Card[];
    projects: Project[];
    onCardClick: (card: Card) => void;
    onUpdateCard?: (card: Card) => void;
}

type ZoomLevel = 'days' | 'weeks' | 'months';

interface DragState {
    cardId: string;
    type: 'move' | 'start' | 'end';
    startX: number;
    originalStart: Date;
    originalEnd: Date;
    currentDeltaDays: number;
}

const ZOOM_CONFIG = {
    days: { width: 40, showDays: true, showWeeks: true },
    weeks: { width: 12, showDays: false, showWeeks: true },
    months: { width: 6, showDays: false, showWeeks: false }
};

const HEADER_HEIGHT = 100;
const ROW_HEIGHT = 48;

const renderTextWithLinks = (text: string) => {
    if (!text) return text;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
        if (part.match(urlRegex)) {
            return (
                <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline break-all" onClick={e => e.stopPropagation()}>
                    {part}
                </a>
            );
        }
        return part;
    });
};

export const GanttView: React.FC<GanttViewProps> = ({ cards, projects, onCardClick, onUpdateCard }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [scrollLeft, setScrollLeft] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('days');
    const [dragState, setDragState] = useState<DragState | null>(null);

    const dayWidth = ZOOM_CONFIG[zoomLevel].width;

    // Track horizontal scroll position for sticky badges and handle Ctrl+Wheel zoom
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const onScroll = () => {
            setScrollLeft(el.scrollLeft);
            setContainerWidth(el.clientWidth);
        };
        onScroll(); // initial
        el.addEventListener('scroll', onScroll, { passive: true });

        // Handle Ctrl+Wheel for zooming
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault(); // Prevent browser zoom
                const zoomOrder: ZoomLevel[] = ['months', 'weeks', 'days'];
                setZoomLevel(prev => {
                    const currentIndex = zoomOrder.indexOf(prev);
                    if (e.deltaY < 0 && currentIndex < zoomOrder.length - 1) {
                        return zoomOrder[currentIndex + 1];
                    } else if (e.deltaY > 0 && currentIndex > 0) {
                        return zoomOrder[currentIndex - 1];
                    }
                    return prev;
                });
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });

        const ro = new ResizeObserver(onScroll);
        ro.observe(el);
        return () => { 
            el.removeEventListener('scroll', onScroll); 
            el.removeEventListener('wheel', onWheel);
            ro.disconnect(); 
        };
    }, []);

    // Only consider projects and cards that are explicitly marked as Gantt OR have gantt props
    const ganttProjects = useMemo(() => projects.filter(p => p.isGantt || p.gantt), [projects]);
    const ganttCards = useMemo(() => cards.filter(c => c.isGantt || c.gantt), [cards]);

    // Determine the full time range spanning all projects and tasks
    const { minDate, totalDays, dates } = useMemo(() => {
        let min = new Date();
        let max = new Date();
        let hasDates = false;

        const processDate = (dateStr?: string) => {
            if (!dateStr || dateStr === 'undefined') return;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return;
            if (!hasDates) {
                min = new Date(d);
                max = new Date(d);
                hasDates = true;
            } else {
                if (d < min) min = new Date(d);
                if (d > max) max = new Date(d);
            }
        };

        ganttProjects.forEach(p => {
            if (p.gantt) {
                processDate(p.gantt.startDate);
                processDate(p.gantt.endDate);
            }
        });

        ganttCards.forEach(c => {
            if (c.gantt) {
                processDate(c.gantt.startDate);
                processDate(c.gantt.endDate);
            }
        });

        if (!hasDates) {
            min = startOfMonth(new Date());
            max = addDays(min, 30);
        } else {
            min = addDays(min, -28);
            max = addDays(max, 56);
        }
        min = startOfMonth(min);
        const diff = differenceInDays(max, min) + 1;
        const daysArr: Date[] = [];
        for (let i = 0; i < diff; i++) {
            daysArr.push(addDays(min, i));
        }
        return { minDate: min, maxDate: max, totalDays: diff, dates: daysArr };
    }, [ganttProjects, ganttCards]);

    const toggleProject = (projectId: string) => {
        setExpandedProjects(prev => {
            const next = new Set(prev);
            if (next.has(projectId)) next.delete(projectId);
            else next.add(projectId);
            return next;
        });
    };

    const toggleAllProjects = () => {
        if (expandedProjects.size === ganttProjects.length && ganttProjects.length > 0) {
            setExpandedProjects(new Set());
        } else {
            setExpandedProjects(new Set(ganttProjects.map(p => p.id)));
        }
    };

    const toggleCardExpansion = (e: React.MouseEvent, cardId: string) => {
        // Prevent toggling if we are currently finishing a drag
        if (dragState) return;
        e.stopPropagation();
        setExpandedCards(prev => {
            const next = new Set(prev);
            if (next.has(cardId)) {
                next.delete(cardId);
            } else {
                next.add(cardId);
                const card = ganttCards.find(c => c.id === cardId);
                if (card?.gantt?.startDate) {
                    setTimeout(() => scrollToDate(card?.gantt?.startDate), 50);
                }
            }
            return next;
        });
    };

    // --- DRAG & DROP LOGIC ---
    useEffect(() => {
        if (!dragState) return;

        const handleMouseMove = (e: MouseEvent) => {
            // Adjust for container scroll position 
            if (scrollContainerRef.current) {
               // Not strictly necessary to adjust if we track pure screen deltas,
               // but scrolling while holding complicates things. Delta from start is easiest:
            }

            const deltaX = e.clientX - dragState.startX;
            const deltaDays = Math.round(deltaX / dayWidth);

            setDragState(prev => prev ? { ...prev, currentDeltaDays: deltaDays } : null);
        };

        const handleMouseUp = () => {
            if (dragState && dragState.currentDeltaDays !== 0 && onUpdateCard) {
                const card = ganttCards.find(c => c.id === dragState.cardId);
                if (card) {
                    let newStart = new Date(dragState.originalStart);
                    let newEnd = new Date(dragState.originalEnd);

                    if (dragState.type === 'move') {
                        newStart = addDays(newStart, dragState.currentDeltaDays);
                        newEnd = addDays(newEnd, dragState.currentDeltaDays);
                    } else if (dragState.type === 'start') {
                        newStart = addDays(newStart, dragState.currentDeltaDays);
                        if (newStart > newEnd) newStart = newEnd; // Prevent negative duration
                    } else if (dragState.type === 'end') {
                        newEnd = addDays(newEnd, dragState.currentDeltaDays);
                        if (newEnd < newStart) newEnd = newStart;
                    }

                    // To avoid timezone shift issues on string conversion, preserve time roughly
                    const toLocalISO = (d: Date) => {
                        const tzo = -d.getTimezoneOffset();
                        const dif = tzo >= 0 ? '+' : '-';
                        const pad = (num: number) => (num < 10 ? '0' : '') + num;
                        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + dif + pad(Math.floor(Math.abs(tzo) / 60)) + ':' + pad(Math.abs(tzo) % 60);
                    };

                    onUpdateCard({
                        ...card,
                        gantt: {
                            ...card.gantt,
                            startDate: toLocalISO(newStart),
                            endDate: toLocalISO(newEnd)
                        } as any
                    });
                }
            }
            setDragState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, dayWidth, onUpdateCard, ganttCards]);

    const handleDragStart = (e: React.MouseEvent, cardId: string, type: 'move' | 'start' | 'end', originalStartStr?: string, originalEndStr?: string) => {
        if (!originalStartStr) return;
        e.stopPropagation();
        e.preventDefault();
        
        const originalStart = new Date(originalStartStr);
        const originalEnd = originalEndStr ? new Date(originalEndStr) : new Date(originalStart);
        
        setDragState({
            cardId,
            type,
            startX: e.clientX,
            originalStart,
            originalEnd,
            currentDeltaDays: 0
        });
    };
    // -------------------------

    const scrollToDate = (dateStr?: string) => {
        if (!scrollContainerRef.current || !dateStr) return;
        const targetDate = new Date(dateStr);
        if (isNaN(targetDate.getTime())) return;
        
        targetDate.setHours(0, 0, 0, 0);

        const daysFromStart = differenceInDays(targetDate, minDate);
        if (daysFromStart >= 0 && daysFromStart <= totalDays) {
            const gap = 24; // Small gap so it doesn't touch the sticky nav
            const dayPos = daysFromStart * dayWidth;
            const targetX = dayPos - gap;
            
            scrollContainerRef.current.scrollTo({ left: Math.max(0, targetX), behavior: 'smooth' });
        }
    };

    const scrollToToday = () => {
        if (!scrollContainerRef.current) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daysFromStart = differenceInDays(today, minDate);
        if (daysFromStart >= 0 && daysFromStart <= totalDays) {
            const dayPos = (daysFromStart * dayWidth) + 300;
            const targetX = dayPos - (scrollContainerRef.current.clientWidth / 2) - 150;
            scrollContainerRef.current.scrollTo({ left: Math.max(0, targetX), behavior: 'smooth' });
        }
    };

    useEffect(() => {
        setTimeout(scrollToToday, 500);
    }, []);

    // Helper for bar layout
    const getBarLayout = (startStr?: string, endStr?: string) => {
        if (!startStr || typeof startStr !== 'string' || startStr.trim() === '' || startStr === 'undefined') {
            return { left: 0, width: 0, visible: false };
        }
        const start = new Date(startStr);
        const end = endStr ? new Date(endStr) : start;
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return { left: 0, width: 0, visible: false };
        let startOffset = differenceInDays(start, minDate);
        let duration = differenceInDays(end, start) + 1;
        if (duration <= 0) return { left: 0, width: 0, visible: false };
        return { left: startOffset * dayWidth, width: duration * dayWidth, visible: true };
    };

    const renderHeader = () => {
        const months: { label: string; width: number }[] = [];
        const weeks: { label: string; width: number }[] = [];
        let currentMonthStr = '';
        let currentMonthDays = 0;
        let currentWeekStr = '';
        let currentWeekDays = 0;

        dates.forEach((d, index) => {
            const mStr = format(d, 'MMMM yyyy', { locale: de }).toUpperCase();
            if (mStr !== currentMonthStr) {
                if (currentMonthStr) months.push({ label: currentMonthStr, width: currentMonthDays * dayWidth });
                currentMonthStr = mStr;
                currentMonthDays = 1;
            } else currentMonthDays++;

            const wStr = `KW ${format(d, 'I', { locale: de })}`;
            if (wStr !== currentWeekStr) {
                if (currentWeekStr) weeks.push({ label: currentWeekStr, width: currentWeekDays * dayWidth });
                currentWeekStr = wStr;
                currentWeekDays = 1;
            } else currentWeekDays++;

            if (index === dates.length - 1) {
                months.push({ label: currentMonthStr, width: currentMonthDays * dayWidth });
                weeks.push({ label: currentWeekStr, width: currentWeekDays * dayWidth });
            }
        });

        const config = ZOOM_CONFIG[zoomLevel];
        return (
            <div className="sticky top-0 z-30 bg-slate-900 border-b border-slate-700 shadow-sm flex flex-col" style={{ width: totalDays * dayWidth + 300, height: config.showDays ? HEADER_HEIGHT : (config.showWeeks ? 65 : 40) }}>
                <div className="flex border-b border-slate-700 text-xs font-bold text-teal-500 h-8">
                    <div 
                        className="w-[300px] shrink-0 border-r border-slate-700 bg-slate-900 sticky left-0 z-40 cursor-pointer" 
                        onDoubleClick={toggleAllProjects} 
                        title="Doppelklick zum Aus-/Einklappen aller Projekte"
                    />
                    {months.map((m, i) => (
                        <div key={`m-${i}`} className="flex items-center px-4 border-r border-gray-200/50" style={{ width: m.width }}><span className="truncate">{m.label}</span></div>
                    ))}
                </div>
                {config.showWeeks && (
                    <div className="flex border-b border-slate-700 text-[10px] text-gray-400 font-semibold h-7 bg-slate-800">
                        <div 
                            className="w-[300px] shrink-0 border-r border-slate-700 bg-slate-800 sticky left-0 z-40 cursor-pointer" 
                            onDoubleClick={toggleAllProjects} 
                            title="Doppelklick zum Aus-/Einklappen aller Projekte"
                        />
                        {weeks.map((w, i) => (
                            <div key={`w-${i}`} className="flex items-center px-1 border-r border-gray-200/50" style={{ width: w.width }}><span className="truncate">{w.label}</span></div>
                        ))}
                    </div>
                )}
                {config.showDays && (
                    <div className="flex h-10 bg-slate-900 items-end text-[10px] text-gray-400 font-medium">
                        <div 
                            className="w-[300px] shrink-0 border-r border-slate-700 bg-slate-900 sticky left-0 z-40 h-full cursor-pointer" 
                            onDoubleClick={toggleAllProjects} 
                            title="Doppelklick zum Aus-/Einklappen aller Projekte"
                        />
                        {dates.map((d, i) => {
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            const isToday = isSameDay(new Date(), d);
                            return (
                                <div key={`d-${i}`} className={clsx("flex flex-col items-center justify-center border-r h-full transition-colors", isToday ? "bg-teal-900/30 text-teal-400 font-bold border-teal-500/50 shadow-[inset_0_-3px_0_rgba(20,184,166,0.5)]" : isWeekend ? "bg-slate-800 border-slate-700" : "border-slate-800")} style={{ width: dayWidth }}>
                                    <div className="uppercase mb-0.5" style={{ fontSize: '8px' }}>{format(d, 'eeeeee', { locale: de })}</div>
                                    <div className={clsx("text-xs", isToday ? "text-teal-400" : "text-gray-300")}>{format(d, 'dd')}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 border-l border-slate-700 rounded-r-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-900 z-40">
                <div className="flex items-center space-x-4">
                    <h2 className="text-gray-100 font-bold text-lg flex items-center space-x-2"><span>📅 Projektplan</span></h2>
                    <div className="flex p-0.5 bg-slate-800 rounded-lg">
                        {(['days', 'weeks', 'months'] as ZoomLevel[]).map((level) => (
                            <button key={level} onClick={() => setZoomLevel(level)} className={clsx("px-3 py-1 rounded-md text-xs font-bold transition-all", zoomLevel === level ? "bg-slate-700 text-teal-400 shadow-sm" : "text-gray-400 hover:text-teal-400")}>
                                {level === 'days' ? 'Tage' : level === 'weeks' ? 'Wochen' : 'Monate'}
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={scrollToToday} className="px-3 py-1.5 text-xs font-medium border border-teal-500/30 text-teal-400 bg-teal-900/20 hover:bg-teal-900/40 rounded transition-colors">Heute</button>
            </div>
            <div ref={scrollContainerRef} className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent bg-slate-950">
                <div className="min-w-max relative" style={{ width: totalDays * dayWidth + 300, minHeight: '100%' }}>
                    <div className="absolute inset-y-0 flex pointer-events-none z-0 mt-[100px]" style={{ left: '300px', width: totalDays * dayWidth }}>
                        {dates.map((d, i) => {
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            const isToday = isSameDay(new Date(), d);
                            return (
                                <div key={`grid-${i}`} className={clsx("border-r h-full transition-colors", isToday ? "bg-teal-900/10 border-teal-500/30 shadow-[inset_0_0_12px_rgba(20,184,166,0.1)] relative z-0" : isWeekend ? "bg-slate-900/50 border-slate-800" : "border-slate-800")} style={{ width: dayWidth }} />
                            );
                        })}
                    </div>
                    {renderHeader()}
                    <div className="relative z-10 flex flex-col">
                        {ganttProjects.length === 0 && <div className="p-8 text-center text-gray-400 sticky left-0 w-full max-w-lg mx-auto mt-10"><p>Keine Projekte vorhanden.</p></div>}
                        {ganttProjects.map((project) => {
                            const isExpanded = expandedProjects.has(project.id);
                            const projectCards = ganttCards.filter(c => c.projectIds.includes(project.id));
                            const pColor = project.color || '#3b82f6';

                            return (
                                <React.Fragment key={project.id}>
                                    <div className="relative border-b border-slate-700 group flex items-center hover:bg-white/5 transition-colors cursor-pointer" style={{ height: ROW_HEIGHT, zIndex: 10 }} onClick={() => toggleProject(project.id)}>
                                        <div className="sticky left-0 z-20 flex items-center h-full px-4 w-[300px] shrink-0 font-bold uppercase tracking-wider text-white shadow-[2px_0_5px_rgba(0,0,0,0.3)]" style={{ backgroundColor: pColor }}>
                                            <span className="truncate flex-1">{project.name}</span>
                                            <span className="text-white/70 ml-2">{isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</span>
                                        </div>
                                        {/* Timeline Bar Section with clipping container - REMOVED per user request */}
                                        <div className="absolute inset-y-0 right-0 overflow-hidden pointer-events-none" style={{ left: '300px' }} />
                                    </div>
                                        {isExpanded && projectCards.map(card => {
                                            const cLayout = getBarLayout(card.gantt?.startDate, card.gantt?.endDate);
                                            const isCardExpanded = expandedCards.has(card.id);
                                            const sDateStr = card.gantt?.startDate ? format(new Date(card.gantt.startDate), 'dd.MM.yyyy') : '';
                                            const eDateStr = card.gantt?.endDate ? format(new Date(card.gantt.endDate), 'dd.MM.yyyy') : sDateStr;
                                            const dateDisplay = sDateStr === eDateStr ? sDateStr : `${sDateStr} – ${eDateStr}`;

                                            // Overdue Logic
                                            const isOverdue = (() => {
                                                if (!card.gantt?.endDate || card.gantt.endDate === 'undefined' || card.gantt.status === 'Fertig') return false;
                                                const end = new Date(card.gantt.endDate);
                                                if (isNaN(end.getTime())) return false;
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                return end < today;
                                            })();

                                            return (
                                                <div key={card.id} className={clsx("relative border-b border-slate-800 group transition-all", isCardExpanded ? "bg-slate-900 shadow-lg" : "hover:bg-slate-900/50")} style={{ height: isCardExpanded ? 'auto' : ROW_HEIGHT, minHeight: ROW_HEIGHT, zIndex: isCardExpanded ? 100 : 1 }}>
                                                    <div className="sticky left-0 z-20 flex items-start h-full px-4 w-[300px] bg-slate-900 border-r border-slate-700 shadow-[1px_0_3px_rgba(0,0,0,0.2)]">
                                                        <button onClick={(e) => toggleCardExpansion(e, card.id)} className="flex-1 text-left pt-3.5 flex items-center space-x-2 truncate hover:text-blue-400">
                                                            {card.gantt?.status && (
                                                                <span className={clsx(
                                                                    "w-2 h-2 rounded-full flex-shrink-0",
                                                                    isOverdue ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" : (
                                                                        card.gantt.status === 'Geplant' ? "bg-orange-500" :
                                                                            card.gantt.status === 'In Arbeit' ? "bg-blue-500" :
                                                                                "bg-green-500"
                                                                    )
                                                                )} />
                                                            )}
                                                            <span className={clsx("text-sm font-medium truncate", isCardExpanded ? "text-blue-400" : "text-gray-200")}>{card.title}</span>
                                                        </button>
                                                    <button onClick={(e) => { e.stopPropagation(); onCardClick(card); }} className="pt-3.5 text-gray-500 hover:text-blue-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                </div>
                                                {!isCardExpanded ? (
                                                    <div className="absolute inset-y-0 right-0 pointer-events-none z-10" style={{ left: '300px', clipPath: 'inset(-800px -2000px -800px 0)' }}>
                                                        {(() => {
                                                            const isDraggingCard = dragState?.cardId === card.id;
                                                            let renderLayout = { ...cLayout };

                                                            if (isDraggingCard && dragState) {
                                                                let newStart = new Date(dragState.originalStart);
                                                                let newEnd = new Date(dragState.originalEnd);

                                                                if (dragState.type === 'move') {
                                                                    newStart = addDays(newStart, dragState.currentDeltaDays);
                                                                    newEnd = addDays(newEnd, dragState.currentDeltaDays);
                                                                } else if (dragState.type === 'start') {
                                                                    newStart = addDays(newStart, dragState.currentDeltaDays);
                                                                    if (newStart > newEnd) newStart = newEnd;
                                                                } else if (dragState.type === 'end') {
                                                                    newEnd = addDays(newEnd, dragState.currentDeltaDays);
                                                                    if (newEnd < newStart) newEnd = newStart;
                                                                }

                                                                renderLayout = getBarLayout(newStart.toISOString(), newEnd.toISOString());
                                                            }

                                                            if (!renderLayout.visible) return null;

                                                            const viewportRight = scrollLeft + containerWidth;
                                                            const barLeft = renderLayout.left + 300;
                                                            const barRight = barLeft + renderLayout.width;
                                                            const isOffRight = barRight > viewportRight;
                                                            const minTitleWidth = 60;
                                                            const stickyOffset = isOffRight ? Math.max(0, Math.min(renderLayout.width - minTitleWidth, barRight - viewportRight + 12)) : 0;

                                                                return (
                                                                    <div 
                                                                        className={clsx(
                                                                            "absolute rounded-sm z-10 flex flex-col justify-center shadow-sm pointer-events-auto",
                                                                            isDraggingCard ? "cursor-grabbing opacity-80" : "cursor-grab"
                                                                        )} 
                                                                        style={{ 
                                                                            left: `${renderLayout.left}px`, 
                                                                            width: `${renderLayout.width}px`, 
                                                                            top: '15%', 
                                                                            height: '70%', 
                                                                            paddingLeft: zoomLevel === 'days' ? '0.75rem' : '0.2rem', 
                                                                            paddingRight: zoomLevel === 'days' ? '0.75rem' : '0.2rem', 
                                                                            backgroundColor: `${pColor}90`,
                                                                            transition: isDraggingCard ? 'none' : 'all 0.1s ease-out'
                                                                        }} 
                                                                        onClick={(e) => {
                                                                            if (!isDraggingCard) toggleCardExpansion(e, card.id);
                                                                        }}
                                                                        onMouseDown={(e) => handleDragStart(e, card.id, 'move', card.gantt?.startDate, card.gantt?.endDate)}
                                                                    >
                                                                        {/* Left Resize Handle */}
                                                                        <div 
                                                                            className="absolute top-0 bottom-0 left-0 w-2 cursor-col-resize z-20 hover:bg-slate-400/20 rounded-l-sm"
                                                                            onMouseDown={(e) => handleDragStart(e, card.id, 'start', card.gantt?.startDate, card.gantt?.endDate)}
                                                                        />
                                                                        
                                                                        <div className="flex justify-between items-center text-[14.6px] text-blue-100 whitespace-nowrap overflow-hidden w-full relative h-full pointer-events-none z-10" style={{ fontWeight: 510 }}>
                                                                            <span className="truncate pr-4 flex-1 select-none">{card.title}</span>
                                                                            <div className="flex-shrink-0 text-[13.9px] bg-black/30 px-1 rounded transition-transform duration-75 ease-out select-none" style={{ transform: `translateX(${-stickyOffset}px)`, fontWeight: 400 }}>
                                                                                {dateDisplay}{zoomLevel === 'days' ? `, ${card.gantt?.status}` : ''}
                                                                            </div>
                                                                        </div>

                                                                        {/* Progress Bar Rendering */}
                                                                        {card.gantt?.progress !== undefined && card.gantt.progress > 0 && (
                                                                            <div 
                                                                                className="absolute bottom-0 left-0 bg-white/20 pointer-events-none z-0 transition-all duration-300 left-rounded"
                                                                                style={{ width: `${card.gantt.progress}%`, height: '5%' }}
                                                                            />
                                                                        )}

                                                                        {/* Milestones rendering */}
                                                                        {card.gantt?.milestones?.map(milestone => {
                                                                            // Calculate milestone position relative to timeline start
                                                                            const msLayout = getBarLayout(milestone.date, milestone.date);
                                                                            if (!msLayout.visible) return null;
                                                                            
                                                                            // The diamond should be centered on its specific day.
                                                                            // Its absolute position on the timeline is msLayout.left + dayWidth/2
                                                                            // Relative to this bar, it's (msLayout.left - renderLayout.left) + dayWidth/2 - diamondSize/2
                                                                            const diamondSize = 10;
                                                                            const relativeLeft = (msLayout.left - renderLayout.left) + (dayWidth / 2) - (diamondSize / 2);
                                                                            
                                                                            // Don't render if it falls completely outside the current bar visually (though data-wise it shouldn't)
                                                                            if (relativeLeft < -diamondSize || relativeLeft > renderLayout.width) return null;

                                                                            return (
                                                                                <div 
                                                                                    key={milestone.id}
                                                                                    className="absolute top-0 bottom-0 z-20 group"
                                                                                    style={{
                                                                                        left: `${relativeLeft}px`,
                                                                                        width: `${diamondSize}px`
                                                                                    }}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    {/* Milestone Diamond */}
                                                                                    <div 
                                                                                        className="absolute top-1/2 -translate-y-1/2 rotate-45 border border-white/50 shadow-sm"
                                                                                        style={{
                                                                                            width: '100%',
                                                                                            height: `${diamondSize}px`,
                                                                                            backgroundColor: '#f59e0b'
                                                                                        }}
                                                                                    />
                                                                                    {/* Custom Tooltip on Hover */}
                                                                                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-[14px] font-normal whitespace-nowrap rounded-md shadow-lg pointer-events-none z-30">
                                                                                        <div className="font-bold text-amber-400 mb-0.5">{new Date(milestone.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                                                                                        {milestone.title}
                                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-gray-900" />
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}

                                                                        {/* Right Resize Handle */}
                                                                        <div 
                                                                            className="absolute top-0 bottom-0 right-0 w-2 cursor-col-resize z-20 hover:bg-slate-400/20 rounded-r-sm"
                                                                            onMouseDown={(e) => handleDragStart(e, card.id, 'end', card.gantt?.startDate, card.gantt?.endDate)}
                                                                        />
                                                                    </div>
                                                                );
                                                            })()}
                                                     </div>
                                                ) : (
                                                    <div className="absolute inset-y-0 right-0 pointer-events-none z-50" style={{ left: '300px', clipPath: 'inset(-800px -2000px -2000px 0)' }}>
                                                        <div className="absolute z-50 flex flex-col shadow-2xl pointer-events-auto border-slate-700 border rounded-md" 
                                                            style={{ 
                                                                left: `${cLayout.left}px`,
                                                                width: 'auto', 
                                                                maxWidth: `${cLayout.width}px`, 
                                                                minWidth: '420px', 
                                                                top: '4px', 
                                                                backgroundColor: '#0f172a' 
                                                            }} 
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            <div className="p-6 md:p-8 text-gray-100 text-sm flex flex-col cursor-text select-text relative">
                                                                <div className="absolute top-4 right-4 md:top-6 md:right-6 text-right pointer-events-none sticky right-0">
                                                                    <div className="text-xs font-bold text-blue-400">{dateDisplay}</div>
                                                                    <div className="text-[11px] font-semibold text-blue-300 mt-1">
                                                                        {card.gantt?.status}
                                                                        {card.gantt?.progress !== undefined ? `, Fortschritt: ${card.gantt.progress}%` : ''}
                                                                    </div>
                                                                    {isOverdue && (
                                                                        <div className="text-[11px] font-bold text-red-600 mt-2 animate-pulse">
                                                                            Enddatum überschritten!
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="pr-24">
                                                                    <div className="text-[10px] uppercase text-blue-400 font-bold mb-1">{project.name}</div>
                                                                    <div className="font-bold text-lg text-blue-300 mb-3">{card.title}</div>
                                                                </div>
                                                                <div className="border-b border-blue-400/10 mb-6" />
                                                                <div>
                                                                    <h5 className="font-bold text-[11px] text-blue-400 mb-1.5 uppercase tracking-wider">Info</h5>
                                                                    <div className="text-sm border-l-2 border-slate-600 pl-3 py-1 mb-4 whitespace-pre-wrap leading-relaxed text-gray-300">
                                                                        {card.gantt?.info ? renderTextWithLinks(card.gantt.info) : 'Keine Info hinterlegt.'}
                                                                    </div>
                                                                    
                                                                    {/* Separator line between Info and Milestones/Firmen */}
                                                                    {(card.gantt?.milestones?.length || card.gantt?.companies?.length) ? (
                                                                        <div className="border-b border-blue-400/10 mb-4" />
                                                                    ) : null}
                                                                    {card.gantt?.milestones && card.gantt.milestones.length > 0 && (
                                                                        <div className="mb-4">
                                                                            <h5 className="font-bold text-[11px] text-blue-400 mb-1.5 uppercase tracking-wider">Meilensteine</h5>
                                                                            <div className="bg-slate-800/50 rounded-md border border-slate-700 overflow-hidden">
                                                                                <table className="w-full text-xs text-left text-gray-300">
                                                                                    <tbody>
                                                                                        {card.gantt.milestones.sort((a, b) => a.date.localeCompare(b.date)).map((ms, idx) => (
                                                                                            <tr key={ms.id} className={idx !== card.gantt!.milestones!.length - 1 ? "border-b border-slate-700/50" : ""}>
                                                                                                <td className="py-1 px-2 whitespace-nowrap font-semibold text-amber-500 w-20">
                                                                                                    {new Date(ms.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                                                </td>
                                                                                                <td className="py-1 px-2">
                                                                                                    {ms.title}
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {card.gantt?.companies && card.gantt.companies.length > 0 && (
                                                                        <>
                                                                            <h5 className="font-bold text-[11px] text-blue-400 mb-1.5 uppercase tracking-wider">Firmen</h5>
                                                                            <div className="text-sm font-semibold text-gray-200">{card.gantt.companies.join(', ')}</div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <button onClick={(e) => toggleCardExpansion(e, card.id)} className="mt-6 self-end px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-full transition-colors border border-slate-700">Schließen</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </div>
                    <div className="h-40" />
                </div>
            </div>
        </div>
    );
};
