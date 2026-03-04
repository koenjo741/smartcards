import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { Card } from '../types';

interface CompanyAutocompleteProps {
    value: string[];
    onChange: (companies: string[]) => void;
    allGanttCards: Card[];
    currentCardId?: string; // To ignore warnings for the current card
}

export const CompanyAutocomplete: React.FC<CompanyAutocompleteProps> = ({
    value = [],
    onChange,
    allGanttCards,
    currentCardId
}) => {
    const [inputValue, setInputValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // Derived list of all companies used in the system
    const allKnownCompanies = React.useMemo(() => {
        const companies = new Set<string>();
        allGanttCards.forEach(card => {
            if (card.gantt?.companies) {
                card.gantt.companies.forEach(company => companies.add(company));
            }
        });
        return Array.from(companies).sort();
    }, [allGanttCards]);

    // Filter suggestions based on input, excluding already selected ones
    useEffect(() => {
        const filtered = allKnownCompanies.filter(
            company =>
                !value.includes(company) &&
                company.toLowerCase().includes(inputValue.toLowerCase())
        );
        setSuggestions(filtered);
    }, [inputValue, allKnownCompanies, value]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddCompany = (company: string) => {
        const trimmed = company.trim();
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed]);
        }
        setInputValue('');
        setIsFocused(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (inputValue.trim()) {
                handleAddCompany(inputValue);
            }
        } else if (e.key === 'Escape') {
            setIsFocused(false);
        }
    };

    const handleRemoveCompany = (companyToRemove: string) => {
        // We will implement the ConfirmModal logic dynamically here or rely on the parent 
        // if we want to extract it, but it's easier to do it inline if we have a simple window.confirm or similar.
        // The requirements mentioned a "ConfirmModal", which might mean replacing this with standard UI state.
        if (window.confirm(`Möchten Sie die Firma "${companyToRemove}" wirklich entfernen?`)) {
            onChange(value.filter(c => c !== companyToRemove));
        }
    };

    // Check if the input value matches any existing known company assigned to OTHER tasks
    const getWarningForCompany = (company: string): string | null => {
        const conflictingCards = allGanttCards.filter(card =>
            card.id !== currentCardId &&
            card.gantt?.companies?.includes(company)
        );
        if (conflictingCards.length > 0) {
            return `Achtung: Firma "${company}" ist bereits bei ${conflictingCards.length === 1 ? 'einer anderen Aufgabe' : `${conflictingCards.length} anderen Aufgaben`} zugeteilt.`;
        }
        return null;
    };

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <div className="relative">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Firma suchen oder neu eingeben..."
                    className="w-full px-2 py-1 bg-[#020617] border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 placeholder-gray-500"
                />

                {/* Dropdown for suggestions */}
                {isFocused && (inputValue || suggestions.length > 0) && (
                    <div className="absolute z-10 w-full mt-1 bg-[#020617] border border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <ul className="py-1 text-sm text-gray-200">
                            {suggestions.map((suggestion) => (
                                <li
                                    key={suggestion}
                                    onClick={() => handleAddCompany(suggestion)}
                                    className="px-4 py-2 hover:bg-blue-600 cursor-pointer"
                                >
                                    {suggestion}
                                </li>
                            ))}
                            {/* Option to add new if it doesn't match exactly */}
                            {inputValue.trim() && !allKnownCompanies.includes(inputValue.trim()) && (
                                <li
                                    onClick={() => handleAddCompany(inputValue)}
                                    className="px-4 py-2 hover:bg-blue-600 cursor-pointer text-blue-300 italic"
                                >
                                    "{inputValue.trim()}" als neue Firma hinzufügen
                                </li>
                            )}
                        </ul>
                    </div>
                )}
            </div>

            {/* Input Warnings */}
            {inputValue.trim() && getWarningForCompany(inputValue.trim()) && (
                <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 p-2 rounded">
                    <AlertTriangle className="w-4 h-4" />
                    {getWarningForCompany(inputValue.trim())}
                </div>
            )}

            {/* Selected Companies Tags */}
            {value.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {value.map(company => (
                        <div key={company} className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-slate-700 text-blue-300 border border-blue-500/30">
                                {company}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveCompany(company)}
                                    className="hover:text-red-400 focus:outline-none transition-colors"
                                    title="Firma entfernen"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
