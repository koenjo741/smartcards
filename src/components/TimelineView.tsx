import React, { useMemo, useRef } from 'react';
import type { Card, Project } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TimelineViewProps {
    cards: Card[];
    projects: Project[];
    onCardClick: (card: Card) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ cards, projects, onCardClick }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const timelineData = useMemo(() => {
        // 1. Filter cards with valid due dates
        const datedCards = cards.filter(c => c.dueDate);

        if (datedCards.length === 0) return [];

        // 2. Sort by date
        datedCards.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

        // 3. Group by Month-Year
        const groups: { key: string; label: string; date: Date; cards: Card[] }[] = [];

        datedCards.forEach(card => {
            const date = new Date(card.dueDate!);
            // Handle different date formats if necessary, but assuming ISO/YYYY-MM-DD from App.tsx
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            const label = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

            let group = groups.find(g => g.key === key);
            if (!group) {
                group = {
                    key,
                    label,
                    date: new Date(date.getFullYear(), date.getMonth(), 1), // First of month for sorting
                    cards: []
                };
                groups.push(group);
            }
            group.cards.push(card);
        });

        // Ensure groups are sorted chronologically
        groups.sort((a, b) => a.date.getTime() - b.date.getTime());

        return groups;
    }, [cards]);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 300;
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    if (timelineData.length === 0) {
        return (
            <div className="flex bg-slate-900 border-l border-gray-700 items-center justify-center p-8 h-full">
                <div className="text-center text-gray-500">
                    <p className="text-lg font-medium">No cards with due dates found.</p>
                    <p className="text-sm">Add dates to your cards to see them on the timeline.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-900 border-l border-gray-700 rounded-r-xl overflow-hidden shadow-2xl">
            {/* Header / Controls */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-slate-900 z-10">
                <h2 className="text-white font-bold text-lg flex items-center space-x-2">
                    <span>📅 Timeline</span>
                </h2>
                <div className="flex space-x-2">
                    <button onClick={() => scroll('left')} className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-full transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => scroll('right')} className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-full transition-colors">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Scrolling Container */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-x-auto overflow-y-hidden flex relative scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
            >
                <div className="flex h-full min-w-full">
                    {timelineData.map((group, index) => (
                        <div key={group.key} className="flex-shrink-0 w-80 border-r border-gray-800 h-full flex flex-col relative group">
                            {/* Month Header */}
                            <div className="sticky top-0 bg-slate-900/95 backdrop-blur z-10 p-3 border-b border-gray-800 text-center font-bold text-blue-400 uppercase tracking-widest text-sm shadow-sm">
                                {group.label}
                            </div>

                            {/* Cards in this Month */}
                            <div className="p-3 space-y-3 overflow-y-auto flex-1 pb-10">
                                {group.cards.map(card => {
                                    // Find main project color
                                    const mainProject = projects.find(p => card.projectIds.includes(p.id));
                                    const color = mainProject ? mainProject.color : '#3b82f6'; // Default blue

                                    const dueDate = new Date(card.dueDate!);
                                    const day = dueDate.getDate();
                                    const weekday = dueDate.toLocaleDateString('de-DE', { weekday: 'short' });

                                    return (
                                        <button
                                            key={card.id}
                                            onClick={() => onCardClick(card)}
                                            className="w-full text-left bg-slate-800 hover:bg-slate-750 border border-gray-700 hover:border-blue-500/50 rounded-lg p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all group relative overflow-hidden"
                                        >
                                            {/* Glow Effect on Hover using Project Color */}
                                            <div
                                                className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity"
                                                style={{ backgroundColor: color }}
                                            />

                                            {/* Date Badge */}
                                            <div className="flex items-center space-x-2 mb-2">
                                                <div
                                                    className="flex flex-col items-center justify-center w-10 h-10 rounded bg-slate-900 border border-gray-700 text-xs font-bold shadow-inner"
                                                    style={{ borderColor: `${color}40`, color: color }}
                                                >
                                                    <span className="text-[9px] uppercase opacity-70 leading-none">{weekday}</span>
                                                    <span className="text-base leading-none mt-0.5">{day}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-gray-200 font-semibold text-sm truncate leading-tight">
                                                        {card.title}
                                                    </h4>
                                                </div>
                                            </div>

                                            {/* Project Dots */}
                                            <div className="flex gap-1 mt-1">
                                                {projects.filter(p => card.projectIds.includes(p.id)).map(p => (
                                                    <div
                                                        key={p.id}
                                                        className="w-2 h-2 rounded-full ring-1 ring-slate-800"
                                                        style={{ backgroundColor: p.color }}
                                                        title={p.name}
                                                    />
                                                ))}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Background Stripes for odd columns if desired for contrast */}
                            {index % 2 === 1 && <div className="absolute inset-0 bg-white/[0.02] pointer-events-none -z-10" />}
                        </div>
                    ))}
                    {/* Padding at end */}
                    <div className="w-8 flex-shrink-0" />
                </div>
            </div>
        </div>
    );
};
