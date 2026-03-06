import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { Card, Project } from '../types';
import { Maximize2, Minimize2 } from 'lucide-react';
import clsx from 'clsx';
import { format, addDays, startOfMonth, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';

interface GanttViewProps {
    cards: Card[];
    projects: Project[];
    onCardClick: (card: Card) => void;
}

type ZoomLevel = 'days' | 'weeks' | 'months';

const ZOOM_CONFIG = {
    days: { width: 40, showDays: true, showWeeks: true },
    weeks: { width: 12, showDays: false, showWeeks: true },
    months: { width: 4, showDays: false, showWeeks: false }
};

const HEADER_HEIGHT = 100;
const ROW_HEIGHT = 48;

export const GanttView: React.FC<GanttViewProps> = ({ cards, projects, onCardClick }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [scrollLeft, setScrollLeft] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('days');

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

    const toggleCardExpansion = (e: React.MouseEvent, cardId: string) => {
        e.stopPropagation();
        setExpandedCards(prev => {
            const next = new Set(prev);
            if (next.has(cardId)) next.delete(cardId);
            else next.add(cardId);
            return next;
        });
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
            <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm flex flex-col" style={{ width: totalDays * dayWidth + 300, height: config.showDays ? HEADER_HEIGHT : (config.showWeeks ? 65 : 40) }}>
                <div className="flex border-b border-gray-200 text-xs font-bold text-teal-600 h-8">
                    <div className="w-[300px] shrink-0 border-r border-gray-200 bg-white sticky left-0 z-40" />
                    {months.map((m, i) => (
                        <div key={`m-${i}`} className="flex items-center px-4 border-r border-gray-200/50" style={{ width: m.width }}><span className="truncate">{m.label}</span></div>
                    ))}
                </div>
                {config.showWeeks && (
                    <div className="flex border-b border-gray-200 text-[10px] text-gray-500 font-semibold h-7 bg-gray-50">
                        <div className="w-[300px] shrink-0 border-r border-gray-200 bg-gray-50 sticky left-0 z-40" />
                        {weeks.map((w, i) => (
                            <div key={`w-${i}`} className="flex items-center px-1 border-r border-gray-200/50" style={{ width: w.width }}><span className="truncate">{w.label}</span></div>
                        ))}
                    </div>
                )}
                {config.showDays && (
                    <div className="flex h-10 bg-white items-end text-[10px] text-gray-500 font-medium">
                        <div className="w-[300px] shrink-0 border-r border-gray-200 bg-white sticky left-0 z-40 h-full" />
                        {dates.map((d, i) => {
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            const isToday = differenceInDays(new Date(), d) === 0;
                            return (
                                <div key={`d-${i}`} className={clsx("flex flex-col items-center justify-center border-r border-gray-200 h-full", isWeekend ? "bg-gray-50" : "", isToday ? "bg-teal-50 text-teal-600 font-bold border-teal-200" : "")} style={{ width: dayWidth }}>
                                    <div className="uppercase mb-0.5" style={{ fontSize: '8px' }}>{format(d, 'eeeeee', { locale: de })}</div>
                                    <div className={clsx("text-xs", isToday ? "text-teal-600" : "text-gray-800")}>{format(d, 'dd')}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 rounded-r-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-white z-40">
                <div className="flex items-center space-x-4">
                    <h2 className="text-gray-800 font-bold text-lg flex items-center space-x-2"><span>📅 Projektplan</span></h2>
                    <div className="flex p-0.5 bg-gray-100 rounded-lg">
                        {(['days', 'weeks', 'months'] as ZoomLevel[]).map((level) => (
                            <button key={level} onClick={() => setZoomLevel(level)} className={clsx("px-3 py-1 rounded-md text-xs font-bold transition-all", zoomLevel === level ? "bg-white text-teal-600 shadow-sm" : "text-gray-500 hover:text-teal-600")}>
                                {level === 'days' ? 'Tage' : level === 'weeks' ? 'Wochen' : 'Monate'}
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={scrollToToday} className="px-3 py-1.5 text-xs font-medium border border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 rounded transition-colors">Springe zu Heute</button>
            </div>
            <div ref={scrollContainerRef} className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent bg-gray-50/30">
                <div className="min-w-max relative" style={{ width: totalDays * dayWidth + 300, minHeight: '100%' }}>
                    <div className="absolute inset-y-0 flex pointer-events-none z-0 mt-[100px]" style={{ left: '300px', width: totalDays * dayWidth }}>
                        {dates.map((d, i) => (
                            <div key={`grid-${i}`} className={clsx("border-r border-gray-100 h-full", d.getDay() === 0 || d.getDay() === 6 ? "bg-gray-100/50" : "", differenceInDays(new Date(), d) === 0 ? "bg-teal-50/50 border-teal-100 block" : "")} style={{ width: dayWidth }} />
                        ))}
                    </div>
                    {renderHeader()}
                    <div className="relative z-10 flex flex-col">
                        {ganttProjects.length === 0 && <div className="p-8 text-center text-gray-500 sticky left-0 w-full max-w-lg mx-auto mt-10"><p>Keine Projekte vorhanden.</p></div>}
                        {ganttProjects.map((project) => {
                            const isExpanded = expandedProjects.has(project.id);
                            const projectCards = ganttCards.filter(c => c.projectIds.includes(project.id));
                            const pColor = project.color || '#3b82f6';

                            return (
                                <React.Fragment key={project.id}>
                                    <div className="relative border-b border-gray-200 group flex items-center hover:bg-black/5 transition-colors cursor-pointer" style={{ height: ROW_HEIGHT, zIndex: 10 }} onClick={() => toggleProject(project.id)}>
                                        <div className="sticky left-0 z-20 flex items-center h-full px-4 w-[300px] shrink-0 font-bold uppercase tracking-wider text-white shadow-[2px_0_5_rgba(0,0,0,0.1)]" style={{ backgroundColor: pColor }}>
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
                                                <div key={card.id} className={clsx("relative border-b border-gray-100 group transition-all", isCardExpanded ? "bg-yellow-50 shadow-lg" : "hover:bg-gray-50")} style={{ height: isCardExpanded ? 'auto' : ROW_HEIGHT, minHeight: ROW_HEIGHT, zIndex: isCardExpanded ? 100 : 1 }}>
                                                    <div className="sticky left-0 z-20 flex items-start h-full px-4 w-[300px] bg-white border-r border-gray-200 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                                        <button onClick={(e) => toggleCardExpansion(e, card.id)} className="flex-1 text-left pt-3.5 flex items-center space-x-2 truncate hover:text-blue-600">
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
                                                            <span className={clsx("text-sm font-medium truncate", isCardExpanded ? "text-blue-600" : "text-gray-700")}>{card.title}</span>
                                                        </button>
                                                    <button onClick={(e) => { e.stopPropagation(); onCardClick(card); }} className="pt-3.5 text-gray-400 hover:text-blue-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                </div>
                                                {!isCardExpanded ? (
                                                    <div className="absolute inset-y-0 right-0 overflow-hidden pointer-events-none" style={{ left: '300px' }}>
                                                        {cLayout.visible && (() => {
                                                            const viewportRight = scrollLeft + containerWidth;
                                                            const barLeft = cLayout.left + 300;
                                                            const barRight = barLeft + cLayout.width;
                                                            const isOffRight = barRight > viewportRight;
                                                            const minTitleWidth = 60;
                                                            const stickyOffset = isOffRight ? Math.max(0, Math.min(cLayout.width - minTitleWidth, barRight - viewportRight + 12)) : 0;

                                                            return (
                                                                <div className="absolute rounded-sm z-10 flex flex-col justify-center shadow-sm pointer-events-auto" style={{ left: `${cLayout.left}px`, width: `${cLayout.width}px`, top: '15%', height: '70%', paddingLeft: zoomLevel === 'days' ? '0.75rem' : '0.2rem', paddingRight: zoomLevel === 'days' ? '0.75rem' : '0.2rem', backgroundColor: `${pColor}90` }} onClick={(e) => toggleCardExpansion(e, card.id)}>
                                                                    <div className="flex justify-between items-center text-xs text-blue-900 font-bold whitespace-nowrap overflow-hidden w-full relative h-full">
                                                                        <span className="truncate pr-4 flex-1">{card.title}</span>
                                                                        <div className="flex-shrink-0 text-[10px] bg-white/30 px-1 rounded transition-transform duration-75 ease-out" style={{ transform: `translateX(${-stickyOffset}px)` }}>
                                                                            {dateDisplay}{zoomLevel === 'days' ? `, ${card.gantt?.status}` : ''}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <div className="absolute top-0 right-0 pointer-events-none" style={{ left: '300px', height: '1000px', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}>
                                                        <div className="absolute z-50 flex flex-col shadow-2xl pointer-events-auto border-yellow-400 border rounded-md" style={{ left: `${cLayout.left}px`, width: 'auto', maxWidth: `${cLayout.width}px`, minWidth: '420px', top: '4px', backgroundColor: '#fef9c3' }} onClick={e => e.stopPropagation()}>
                                                            <div className="p-6 md:p-8 text-gray-800 text-sm flex flex-col cursor-text select-text relative">
                                                                <div className="absolute top-4 right-4 md:top-6 md:right-6 text-right pointer-events-none sticky right-0">
                                                                    <div className="text-xs font-bold text-blue-800">{dateDisplay}</div>
                                                                    <div className="text-[11px] font-semibold text-blue-600 mt-1">{card.gantt?.status}</div>
                                                                    {isOverdue && (
                                                                        <div className="text-[11px] font-bold text-red-600 mt-2 animate-pulse">
                                                                            Enddatum überschritten!
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="pr-24">
                                                                    <div className="text-[10px] uppercase text-blue-600 font-bold mb-1">{project.name}</div>
                                                                    <div className="font-bold text-lg text-blue-800 mb-3">{card.title}</div>
                                                                </div>
                                                                <div className="border-b border-blue-900/10 mb-6" />
                                                                <div>
                                                                    <h5 className="font-bold text-xs mb-1">Info</h5>
                                                                    <div className="text-sm border-l-2 border-yellow-500 pl-3 py-1 mb-4 whitespace-pre-wrap leading-relaxed">{card.gantt?.info || 'Keine Info hinterlegt.'}</div>
                                                                    {card.gantt?.companies && card.gantt.companies.length > 0 && (
                                                                        <>
                                                                            <h5 className="font-bold text-sm mb-1 text-blue-600">Firmen</h5>
                                                                            <div className="text-blue-600 text-xs font-semibold">{card.gantt.companies.join(', ')}</div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <button onClick={(e) => toggleCardExpansion(e, card.id)} className="mt-6 self-end px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-yellow-400/30 hover:bg-yellow-400/50 rounded-full transition-colors">Schließen</button>
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
