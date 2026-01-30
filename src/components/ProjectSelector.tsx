import React from 'react';
import { Check } from 'lucide-react';
import type { Project } from '../types';

interface ProjectSelectorProps {
    projects: Project[];
    selectedProjectIds: string[];
    onToggleProject: (projectId: string) => void;
    isTodoCard?: boolean;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
    projects,
    selectedProjectIds,
    onToggleProject,
    isTodoCard
}) => {
    return (
        <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
                Projects
            </label>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
                {projects.map(p => {
                    const isSelected = selectedProjectIds.includes(p.id);
                    const isDisabled = !!isTodoCard;

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
