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

    // Track horizontal scroll position for sticky badges
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const onScroll = () => {
            setScrollLeft(el.scrollLeft);
            setContainerWidth(el.clientWidth);
        };
        onScroll(); // initial
        el.addEventListener('scroll', onScroll, { passive: true });
        const ro = new ResizeObserver(onScroll);
        ro.observe(el);
        return () => { el.removeEventListener('scroll', onScroll); ro.disconnect(); };
    }, []);

    // Only consider projects and cards that are explicitly marked as Gantt OR have gantt props
    const ganttProjects = useMemo(() => projects.filter(p => p.isGantt || p.gantt), [projects]);
    const ganttCards = useMemo(() => cards.filter(c => c.isGantt || c.gantt), [cards]);

    // Determine the full time range spanning all projects and tasks
    const { minDate, totalDays, dates } = useMemo(() => {
        let min = new Date();
        let max = new Date();
        let hasDates = false;

        // Helper to process dates safely
        const processDate = (dateStr?: string) => {
            if (!dateStr) return;
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

        // Check project dates
        ganttProjects.forEach(p => {
            if (p.gantt) {
                processDate(p.gantt.startDate);
                processDate(p.gantt.endDate);
            }
        });

        // Check card dates
        ganttCards.forEach(c => {
            if (c.gantt) {
                processDate(c.gantt.startDate);
                processDate(c.gantt.endDate);
            }
        });

        // If no dates found, fake a range (current month)
        if (!hasDates) {
            min = startOfMonth(new Date());
            max = addDays(min, 30);
        } else {
            // Pad the view for breathing room
            min = addDays(min, -28); // 4 weeks before
            max = addDays(max, 56); // 8 weeks after
        }

        // Snap min to start of month for cleaner headers
        min = startOfMonth(min);

        const diff = differenceInDays(max, min) + 1;

        // Generate array of dates
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
            // Scroll to position, centering the day
            const targetX = (daysFromStart * dayWidth) - (scrollContainerRef.current.clientWidth / 2) + (dayWidth / 2);
            scrollContainerRef.current.scrollTo({ left: Math.max(0, targetX), behavior: 'smooth' });
        }
    };

    useEffect(() => {
        // Initial scroll to today shortly after mount
        setTimeout(scrollToToday, 500);
    }, []); // Run once on mount

    // Render header groups (Months, Weeks, Days)
    const renderHeader = () => {
        const months: { label: string; width: number }[] = [];
        const weeks: { label: string; width: number }[] = [];

        let currentMonthStr = '';
        let currentMonthDays = 0;

        let currentWeekStr = '';
        let currentWeekDays = 0;

        dates.forEach((d, index) => {
            // Month grouping
            const mStr = format(d, 'MMMM yyyy', { locale: de }).toUpperCase();
            if (mStr !== currentMonthStr) {
                if (currentMonthStr) {
                    months.push({ label: currentMonthStr, width: currentMonthDays * dayWidth });
                }
                currentMonthStr = mStr;
                currentMonthDays = 1;
            } else {
                currentMonthDays++;
            }

            // Week grouping (KW)
            const wStr = `KW ${format(d, 'I', { locale: de })}`; // ISO Week number
            if (wStr !== currentWeekStr) {
                if (currentWeekStr) {
                    weeks.push({ label: currentWeekStr, width: currentWeekDays * dayWidth });
                }
                currentWeekStr = wStr;
                currentWeekDays = 1;
            } else {
                currentWeekDays++;
            }

            // Final push for last iteration
            if (index === dates.length - 1) {
                months.push({ label: currentMonthStr, width: currentMonthDays * dayWidth });
                weeks.push({ label: currentWeekStr, width: currentWeekDays * dayWidth });
            }
        });

        const config = ZOOM_CONFIG[zoomLevel];

        return (
            <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm flex flex-col" style={{ width: totalDays * dayWidth, height: config.showDays ? HEADER_HEIGHT : (config.showWeeks ? 65 : 40) }}>
                {/* Months Row */}
                <div className="flex border-b border-gray-200 text-xs font-bold text-teal-600 h-8">
                    {months.map((m, i) => (
                        <div key={`m-${i}`} className="flex items-center px-4 border-r border-gray-200/50" style={{ width: m.width }}>
                            <span className="truncate">{m.label}</span>
                        </div>
                    ))}
                </div>

                {/* Weeks Row */}
                {config.showWeeks && (
                    <div className="flex border-b border-gray-200 text-[10px] text-gray-500 font-semibold h-7 bg-gray-50">
                        {weeks.map((w, i) => (
                            <div key={`w-${i}`} className="flex items-center px-1 border-r border-gray-200/50" style={{ width: w.width }}>
                                <span className="truncate">{w.label}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Days Row */}
                {config.showDays && (
                    <div className="flex h-10 bg-white items-end text-[10px] text-gray-500 font-medium">
                        {dates.map((d, i) => {
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            const isToday = differenceInDays(new Date(), d) === 0;
                            return (
                                <div
                                    key={`d-${i}`}
                                    className={clsx(
                                        "flex flex-col items-center justify-center border-r border-gray-200 h-full",
                                        isWeekend ? "bg-gray-50" : "",
                                        isToday ? "bg-teal-50 text-teal-600 font-bold border-teal-200" : ""
                                    )}
                                    style={{ width: dayWidth }}
                                >
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

    // Helper to calculate left offset and width for a date range
    const getBarLayout = (startStr?: string, endStr?: string) => {
        if (!startStr) return { left: 0, width: 0, visible: false };

        const start = new Date(startStr);
        const end = endStr ? new Date(endStr) : start; // Default 1 day if no end

        // Ensure valid dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return { left: 0, width: 0, visible: false };

        let startOffset = differenceInDays(start, minDate);
        let duration = differenceInDays(end, start) + 1; // inclusive

        // Handle bars that start before our minDate (though we pad so unlikely)
        if (startOffset < 0) {
            duration += startOffset; // reduce width
            startOffset = 0;
        }

        if (duration <= 0) return { left: 0, width: 0, visible: false };

        return {
            left: startOffset * dayWidth,
            width: duration * dayWidth,
            visible: true
        };
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 rounded-r-xl overflow-hidden shadow-sm">
            {/* Controls / Top Toolbar */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-white z-40">
                <div className="flex items-center space-x-4">
                    <h2 className="text-gray-800 font-bold text-lg flex items-center space-x-2">
                        <span>📅 Projektplan</span>
                    </h2>

                    {/* Zoom Toggle */}
                    <div className="flex p-0.5 bg-gray-100 rounded-lg">
                        {(['days', 'weeks', 'months'] as ZoomLevel[]).map((level) => (
                            <button
                                key={level}
                                onClick={() => setZoomLevel(level)}
                                className={clsx(
                                    "px-3 py-1 rounded-md text-xs font-bold transition-all",
                                    zoomLevel === level
                                        ? "bg-white text-teal-600 shadow-sm"
                                        : "text-gray-500 hover:text-teal-600"
                                )}
                            >
                                {level === 'days' ? 'Tage' : level === 'weeks' ? 'Wochen' : 'Monate'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex space-x-2">
                    <button onClick={scrollToToday} className="px-3 py-1.5 text-xs font-medium border border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 rounded transition-colors">
                        Springe zu Heute
                    </button>
                </div>
            </div>

            {/* Main Gantt Body */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent bg-gray-50/30"
            >
                <div className="min-w-max relative" style={{ width: totalDays * dayWidth, minHeight: '100%' }}>

                    {/* Vertical Grid Lines (Background) */}
                    <div className="absolute inset-0 flex pointer-events-none z-0 mt-[100px]">
                        {dates.map((d, i) => {
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            const isToday = differenceInDays(new Date(), d) === 0;
                            return (
                                <div
                                    key={`grid-${i}`}
                                    className={clsx(
                                        "border-r border-gray-100 h-full",
                                        isWeekend && zoomLevel === 'days' ? "bg-gray-100/50" : "",
                                        isToday ? "bg-teal-50/50 border-teal-100 block" : ""
                                    )}
                                    style={{ width: dayWidth }}
                                />
                            );
                        })}
                    </div>

                    {renderHeader()}

                    {/* Project and Task Rows */}
                    <div className="relative z-10 flex flex-col">
                        {ganttProjects.length === 0 && (
                            <div className="p-8 text-center text-gray-500 sticky left-0 w-full max-w-lg mx-auto mt-10">
                                <p>Keine (ausgewählten) Projekte mit Gantt-Daten vorhanden.</p>
                            </div>
                        )}

                        {ganttProjects.map((project) => {
                            const isExpanded = expandedProjects.has(project.id);
                            // Find cards for this project
                            const projectCards = ganttCards.filter(c => c.projectIds.includes(project.id));

                            // Project Layout
                            const pLayout = getBarLayout(project.gantt?.startDate, project.gantt?.endDate);
                            const pColor = project.color || '#3b82f6';
                            const pText = `${project.gantt?.startDate ? format(new Date(project.gantt.startDate), 'dd.MM.yyyy') : ''} ${project.gantt?.endDate ? ` – ${format(new Date(project.gantt.endDate), 'dd.MM.yyyy')}` : ''} ${project.gantt?.status ? `, ${project.gantt.status}` : ''}`;

                            return (
                                <React.Fragment key={project.id}>
                                    {/* PROJECT ROW (Full width background acting as header) */}
                                    <div className="relative border-b border-gray-200 group flex items-center hover:bg-black/5 transition-colors cursor-pointer" style={{ height: ROW_HEIGHT }} onClick={() => toggleProject(project.id)}>

                                        {/* Fixed Left Label (Sticky) */}
                                        <div className="sticky left-0 z-20 flex items-center h-full px-4 w-[300px] shrink-0 font-bold uppercase tracking-wider text-white shadow-[2px_0_5px_rgba(0,0,0,0.1)]" style={{ backgroundColor: pColor }}>
                                            <span className="truncate flex-1">{project.name}</span>
                                            <span className="text-white/70 ml-2">
                                                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                            </span>
                                        </div>

                                        {/* Timeline Tracker Section */}
                                        {pLayout.visible ? (
                                            <div
                                                className="absolute h-[80%] top-[10%] rounded-sm right-0 z-10 flex items-center justify-end px-3 text-xs text-white shadow-sm overflow-hidden whitespace-nowrap"
                                                style={{
                                                    // Let's draw the bar from its exact left offset. If it goes under the sticky nav, that's fine/expected.
                                                    left: `${Math.max(300, pLayout.left)}px`, // simple hack: don't let the visual bar draw under the header, start it at least at 300px
                                                    width: `${Math.max(10, pLayout.left < 300 ? pLayout.width - (300 - pLayout.left) : pLayout.width)}px`, // adjust width if clipped
                                                    backgroundColor: pColor,
                                                    opacity: 0.9
                                                }}
                                            >
                                                {zoomLevel === 'days' && <span className="font-medium mix-blend-screen">{pText}</span>}
                                            </div>
                                        ) : (
                                            <div className="pl-[320px] text-xs text-gray-500 italic">Keine Projektdaten</div>
                                        )}
                                    </div>

                                    {/* TASK ROWS (IF EXPANDED) */}
                                    {isExpanded && projectCards.map(card => {
                                        const cLayout = getBarLayout(card.gantt?.startDate, card.gantt?.endDate);
                                        const isCardExpanded = expandedCards.has(card.id);
                                        // Lighten the project color for tasks
                                        const cColor = `${pColor}80`; // Add 50% opacity in hex if standard

                                        // Format dates for display
                                        const sDateStr = card.gantt?.startDate ? format(new Date(card.gantt.startDate), 'dd.MM.yyyy') : '';
                                        const eDateStr = card.gantt?.endDate ? format(new Date(card.gantt.endDate), 'dd.MM.yyyy') : sDateStr;
                                        const dateDisplay = sDateStr === eDateStr ? sDateStr : `${sDateStr} – ${eDateStr}`;

                                        return (
                                            <div key={card.id} className={clsx(
                                                "relative border-b border-gray-100 group transition-all",
                                                isCardExpanded ? "bg-yellow-50" : "hover:bg-gray-50"
                                            )}
                                                style={{ height: isCardExpanded ? 'auto' : ROW_HEIGHT, minHeight: ROW_HEIGHT }}>

                                                {/* Task Label on Left (Sticky) */}
                                                <div className="sticky left-0 z-20 flex items-start h-full px-4 w-[300px] bg-white border-r border-gray-200">
                                                    <button onClick={(e) => toggleCardExpansion(e, card.id)} className="flex-1 text-left pt-3 truncate pr-2 hover:text-blue-600">
                                                        <span className={clsx("text-sm font-medium", isCardExpanded ? "text-blue-600" : "text-gray-700")}>{card.title}</span>
                                                    </button>
                                                    {/* Edit button could go here */}
                                                    <button onClick={(e) => { e.stopPropagation(); onCardClick(card); }} className="pt-3 text-gray-400 hover:text-blue-500">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                </div>

                                                {/* Timeline Bar Section */}
                                                {cLayout.visible && (
                                                    <div className={clsx("absolute z-10 flex flex-col justify-center shadow-sm",
                                                        isCardExpanded ? "border-yellow-400 border rounded-md" : ""
                                                    )}
                                                        style={{
                                                            left: `${Math.max(300, cLayout.left)}px`,
                                                            ...(isCardExpanded
                                                                ? {
                                                                    // Content-fitted: let the box shrink to its content
                                                                    width: 'auto',
                                                                    maxWidth: `${Math.max(10, cLayout.left < 300 ? cLayout.width - (300 - cLayout.left) : cLayout.width)}px`,
                                                                    minWidth: '360px',
                                                                    top: '0',
                                                                    height: 'auto',
                                                                }
                                                                : {
                                                                    width: `${Math.max(10, cLayout.left < 300 ? cLayout.width - (300 - cLayout.left) : cLayout.width)}px`,
                                                                    top: '10%',
                                                                    height: '80%',
                                                                    paddingLeft: zoomLevel === 'days' ? '0.75rem' : '0.2rem',
                                                                    paddingRight: zoomLevel === 'days' ? '0.75rem' : '0.2rem',
                                                                }),
                                                            backgroundColor: isCardExpanded ? '#fef9c3' : cColor,
                                                        }}
                                                        onClick={(e) => toggleCardExpansion(e, card.id)}
                                                    >
                                                        {/* Minimized view content */}
                                                        {!isCardExpanded && zoomLevel === 'days' && (() => {
                                                            const viewportRight = scrollLeft + containerWidth;
                                                            const barLeft = Math.max(300, cLayout.left);
                                                            const barRight = barLeft + cLayout.width;

                                                            // Only stick if the bar is partially off-screen to the right
                                                            const isOffRight = barRight > viewportRight;
                                                            // Calculate how much pixel space we need to "push back" to stay in view
                                                            // We subtract a small padding (12px) from the right
                                                            const stickyOffset = isOffRight ? Math.min(cLayout.width - 200, barRight - viewportRight + 12) : 0;

                                                            return (
                                                                <div className="flex justify-between items-center text-xs text-blue-900 font-medium whitespace-nowrap overflow-hidden w-full relative">
                                                                    <span className="truncate pr-4 flex-1">{card.title}</span>
                                                                    <div
                                                                        className="flex-shrink-0 text-[10px] opacity-80 transition-transform duration-75 ease-out"
                                                                        style={{ transform: `translateX(${-stickyOffset}px)` }}
                                                                    >
                                                                        {dateDisplay}, {card.gantt?.status}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Expanded view (Detailed) — generous padding around content */}
                                                        {isCardExpanded && (
                                                            <div className="p-6 md:p-8 text-gray-800 text-sm flex flex-col cursor-text select-text" onClick={e => e.stopPropagation()}>
                                                                <div>
                                                                    <div className="text-[10px] uppercase text-blue-600 font-bold mb-1">{project.name}</div>
                                                                    <div className="font-bold text-lg text-blue-800 mb-3">{card.title}</div>
                                                                </div>

                                                                <div>
                                                                    <h5 className="font-bold text-xs mb-1">Infotext</h5>
                                                                    <div className="text-sm border-l-2 border-yellow-500 pl-3 py-1 mb-4 whitespace-pre-wrap">
                                                                        {card.gantt?.info || 'Kein Infotext hinterlegt.'}
                                                                    </div>

                                                                    {card.gantt?.companies && card.gantt.companies.length > 0 && (
                                                                        <>
                                                                            <h5 className="font-bold text-xs mb-1 text-blue-600">Firmen</h5>
                                                                            <div className="text-blue-600 text-sm">
                                                                                {card.gantt.companies.join(', ')}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Sticky dates/status badge — computed position at right viewport edge */}
                                                {isCardExpanded && (() => {
                                                    // Position the badge at the right edge of the visible scroll area
                                                    const badgeLeft = scrollLeft + containerWidth - 160; // 160px badge width
                                                    const barLeft = Math.max(300, cLayout.left);
                                                    // Only show sticky badge if the yellow box extends beyond viewport
                                                    const showSticky = barLeft < badgeLeft; // badge is always visible in viewport
                                                    return showSticky ? (
                                                        <div className="absolute z-40"
                                                            style={{ left: `${badgeLeft}px`, top: '4px' }}>
                                                            <div className="bg-yellow-100/95 backdrop-blur-sm border border-yellow-400 rounded-lg shadow-lg px-3 py-2 text-right whitespace-nowrap">
                                                                <div className="text-xs font-bold text-blue-800">{dateDisplay}</div>
                                                                <div className="text-[11px] font-semibold text-blue-600 mt-0.5">{card.gantt?.status}</div>
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Padding at the bottom */}
                    <div className="h-40" />
                </div>
            </div>
        </div>
    );
};
