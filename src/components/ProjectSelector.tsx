import React from 'react';
import { Check, CalendarClock } from 'lucide-react';
import type { Project } from '../types';

interface ProjectSelectorProps {
    projects: Project[];
    selectedProjectIds: string[];
    onToggleProject: (projectId: string) => void;
    isTodoCard?: boolean;
    isGantt?: boolean;
    onGanttChange?: (isGantt: boolean) => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
    projects,
    selectedProjectIds,
    onToggleProject,
    isTodoCard,
    isGantt,
    onGanttChange
}) => {
    const singleSelectedProject = selectedProjectIds.length === 1 ? projects.find(p => p.id === selectedProjectIds[0]) : null;
    const isProjectGantt = singleSelectedProject?.isGantt;
    const isGanttCheckboxDisabled = selectedProjectIds.length !== 1 || !isProjectGantt;

    let ganttTooltipMessage = "GANTT-Karten können nur genau 1 Projekt zugeordnet werden.";
    if (selectedProjectIds.length === 1 && !isProjectGantt) {
        ganttTooltipMessage = "Das ausgewählte Projekt muss ein GANTT-Projekt sein, damit diese Karte als GANTT markiert werden kann.";
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                    Projects
                </label>
                {onGanttChange && (
                    <label className={`flex items-center gap-1.5 cursor-pointer group relative ${isGanttCheckboxDisabled ? 'opacity-50' : ''}`}>
                        <input
                            type="checkbox"
                            checked={isGantt || false}
                            onChange={(e) => onGanttChange(e.target.checked)}
                            disabled={isGanttCheckboxDisabled}
                            className="w-3.5 h-3.5 rounded border-gray-600 bg-slate-700 text-blue-500 disabled:cursor-not-allowed"
                        />
                        <span className="text-xs text-gray-400 flex items-center gap-1 group-hover:text-gray-300 transition-colors">
                            <CalendarClock className="w-3.5 h-3.5" /> GANTT
                        </span>
                        {isGanttCheckboxDisabled && (
                            <div className="hidden group-hover:block absolute top-6 right-0 bg-slate-900 text-xs text-gray-300 p-2 rounded shadow-lg border border-gray-700 z-20 w-max max-w-[250px]">
                                {ganttTooltipMessage}
                            </div>
                        )}
                    </label>
                )}
            </div>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
                {[...projects].sort((a, b) => a.name.localeCompare(b.name)).map(p => {
                    const isSelected = selectedProjectIds.includes(p.id);
                    const isDisabled = !!isTodoCard;

                    // Hide unselected projects if GANTT is checked
                    if (isGantt && !isSelected) {
                        return null;
                    }

                    // Hide TODO project button unless the card is ALREADY in it (to allow removal)
                    // or if we are editing the primary TODO card itself.
                    if (p.name === 'TODO' && !isSelected) {
                        return null;
                    }

                    return (
                        <button
                            key={p.id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => onToggleProject(p.id)}
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
    );
};
