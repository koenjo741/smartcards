import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, CalendarClock, AlertTriangle } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { de } from 'date-fns/locale';
import type { Project, GanttProjectProps, Card } from '../types';
import { CustomDateInput } from './CustomDateInput';
import { isValidDate } from '../utils/dateUtils';

interface ProjectDetailViewProps {
    project: Project;
    cards: Card[];
    onSave: (project: Project) => void;
    onClose: () => void;
}

// Helper function to format numbers with thousands separators
const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ project, cards, onSave, onClose }) => {
    const [ganttData, setGanttData] = useState<GanttProjectProps>({
        startDate: new Date().toISOString().split('T')[0],
        status: 'Geplant',
    });
    // Add local state for formatted total budget to allow typing commas/dots
    const [formattedTotalBudget, setFormattedTotalBudget] = useState<string>('');
    const [formattedYearlyBudgets, setFormattedYearlyBudgets] = useState<Record<string, string>>({});
    const [budgetError, setBudgetError] = useState<string | null>(null);
    const budgetSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ganttDataRef = useRef(ganttData);

    // Sync ref with state
    useEffect(() => { ganttDataRef.current = ganttData; }, [ganttData]);

    // Calculate Spent Budget from Gantt Cards belonging to this project
    const spentBudget = cards
        .filter(card => card.isGantt && card.projectIds.includes(project.id) && card.gantt?.consumedBudget)
        .reduce((sum, card) => sum + (card.gantt?.consumedBudget || 0), 0);
    const isSpentExceeded = (ganttData.totalBudget !== undefined && ganttData.totalBudget > 0) && spentBudget > ganttData.totalBudget;

    // Debounced save function
    const debouncedSave = useCallback((dataToSave: GanttProjectProps) => {
        if (budgetSaveTimeoutRef.current) {
            clearTimeout(budgetSaveTimeoutRef.current);
        }

        budgetSaveTimeoutRef.current = setTimeout(() => {
            onSave({
                ...project,
                gantt: dataToSave
            });
        }, 3000); // 3 seconds delay
    }, [project, onSave]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (budgetSaveTimeoutRef.current) {
                clearTimeout(budgetSaveTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (project.gantt) {
            setGanttData(project.gantt);
            setFormattedTotalBudget(formatCurrency(project.gantt.totalBudget));

            // Format yearly budgets
            const formattedYearly: Record<string, string> = {};
            if (project.gantt.yearlyBudgets) {
                Object.entries(project.gantt.yearlyBudgets).forEach(([year, amount]) => {
                    formattedYearly[year] = formatCurrency(amount);
                });
            }
            setFormattedYearlyBudgets(formattedYearly);
        } else {
            setFormattedTotalBudget('');
            setFormattedYearlyBudgets({});
        }
    }, [project]);

    // Derived state for budget validation
    const totalYearlyBudgets = Object.values(ganttData.yearlyBudgets || {}).reduce((sum, val) => sum + (val || 0), 0);
    const isBudgetExceeded = (ganttData.totalBudget !== undefined && ganttData.totalBudget > 0) && totalYearlyBudgets > ganttData.totalBudget;

    useEffect(() => {
        if (isBudgetExceeded) {
            setBudgetError(`Achtung: Die Summe der Jahresbudgets (${totalYearlyBudgets}) übersteigt das Gesamtbudget (${ganttData.totalBudget}).`);
        } else {
            setBudgetError(null);
        }
    }, [totalYearlyBudgets, ganttData.totalBudget, isBudgetExceeded]);

    // Enhanced Date Validation
    useEffect(() => {
        if (ganttData.startDate && ganttData.endDate) {
            const start = new Date(ganttData.startDate);
            const end = new Date(ganttData.endDate);

            // Check for physically impossible dates (e.g., 31.11.)
            if (!isNaN(start.getTime())) {
                const parts = ganttData.startDate.split('-');
                if (!isValidDate(start, Number(parts[2]), Number(parts[1]), Number(parts[0]))) {
                    alert('Ungültiges Startdatum (z.B. der 31. eines Monats mit nur 30 Tagen).');
                    setGanttData(prev => ({ ...prev, startDate: new Date().toISOString().split('T')[0] }));
                    return;
                }
            }
            if (!isNaN(end.getTime())) {
                const parts = ganttData.endDate.split('-');
                if (!isValidDate(end, Number(parts[2]), Number(parts[1]), Number(parts[0]))) {
                    alert('Ungültiges Enddatum (z.B. der 31. eines Monats mit nur 30 Tagen).');
                    setGanttData(prev => ({ ...prev, endDate: undefined }));
                    return;
                }
            }

            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
                alert('Das Startdatum darf nicht nach dem Enddatum liegen.');
                setGanttData(prev => ({ ...prev, endDate: undefined }));
            }
        }
    }, [ganttData.startDate, ganttData.endDate]);


    const handleChange = (field: keyof GanttProjectProps, value: any) => {
        setGanttData(prev => {
            const newData = { ...prev, [field]: value };
            debouncedSave(newData);
            return newData;
        });
    };

    const handleImmediateSave = () => {
        if (budgetSaveTimeoutRef.current) {
            clearTimeout(budgetSaveTimeoutRef.current);
        }
        const currentGantt = ganttDataRef.current;
        onSave({
            ...project,
            gantt: currentGantt
        });
    };

    const handleTotalBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        setFormattedTotalBudget(rawValue);

        // Convert the string with commas/dots to a valid number for storage
        // E.g., "1.000,50" -> "1000.50"
        const normalizedValue = rawValue.replace(/\./g, '').replace(',', '.');
        const numValue = normalizedValue === '' ? undefined : Number(normalizedValue);

        if (numValue === undefined || !isNaN(numValue)) {
            setGanttData(prev => {
                const newData = { ...prev, totalBudget: numValue };
                debouncedSave(newData);
                return newData;
            });
        }
    };

    const handleTotalBudgetBlur = () => {
        setFormattedTotalBudget(formatCurrency(ganttData.totalBudget));
    };

    const handleYearlyBudgetChange = (year: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const normalizedValue = rawValue.replace(/\./g, '').replace(',', '.');
        const numValue = normalizedValue === '' ? 0 : Number(normalizedValue);

        setFormattedYearlyBudgets(prev => ({ ...prev, [year]: rawValue }));

        if (!isNaN(numValue)) {
            setGanttData(prev => {
                const newData = {
                    ...prev,
                    yearlyBudgets: {
                        ...(prev.yearlyBudgets || {}),
                        [year]: numValue
                    }
                };
                debouncedSave(newData);
                return newData;
            });
        }
    };

    const handleYearlyBudgetBlur = (year: string) => {
        setFormattedYearlyBudgets(prev => ({
            ...prev,
            [year]: formatCurrency(ganttData.yearlyBudgets?.[year])
        }));
    };

    // Generate years between start and end date
    const generateYears = () => {
        if (!ganttData.startDate || !ganttData.endDate) return [];

        const startYear = new Date(ganttData.startDate).getFullYear();
        const endYear = new Date(ganttData.endDate).getFullYear();

        if (isNaN(startYear) || isNaN(endYear) || startYear > endYear) return [];

        const years = [];
        for (let y = startYear; y <= endYear; y++) {
            years.push(y.toString());
        }
        return years;
    };

    const years = generateYears();

    // Cleanup old years if end date is shortened
    useEffect(() => {
        if (years.length > 0 && ganttData.yearlyBudgets) {
            const currentBudgets = { ...ganttData.yearlyBudgets };
            let changed = false;

            Object.keys(currentBudgets).forEach(year => {
                if (!years.includes(year)) {
                    // If the user shortens the end date, we must warn them if they had budget entered.
                    // For now, if the value is 0, we silently delete it. 
                    // If it's > 0, we could block the date change, but simple approach is to keep it in state until they fix it, 
                    // but we shouldn't render it. Actually, rendering an error is better.
                    // Let's just remove it if it's 0 to keep state clean.
                    if (currentBudgets[year] === 0) {
                        delete currentBudgets[year];
                        changed = true;
                    }
                }
            });
            if (changed) {
                setGanttData(prev => ({ ...prev, yearlyBudgets: currentBudgets }));
            }
        }
    }, [years, ganttData.yearlyBudgets]);


    // Calculated at the top of the component:
    // const spentBudget = ...
    // const isSpentExceeded = ...

    return (
        <div className="flex flex-col h-full bg-slate-800 text-gray-100 relative">
            <div className="flex items-center justify-between pb-4 border-b border-gray-700 mb-6 sticky top-0 bg-slate-800 z-10 pt-2">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: project.color }}></div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        {project.name}
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md border border-blue-500/30 flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" /> GANTT
                        </span>
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-200 transition-colors bg-slate-700 hover:bg-slate-600 rounded-md"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-thin scrollbar-thumb-gray-600">

                {/* Basisdaten (Header removed for space) */}
                <div className="bg-slate-900/50 p-5 rounded-lg border border-gray-700/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Beginn *</label>
                            <DatePicker
                                selected={ganttData.startDate ? new Date(ganttData.startDate) : null}
                                onChange={(date: Date | null) => {
                                    if (date) {
                                        // Adjust for locale time zone issues by picking ISO string part
                                        const dateStr = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                                        handleChange('startDate', dateStr);
                                    }
                                }}
                                dateFormat="dd.MM.yyyy"
                                locale={de}
                                todayButton="Heute"
                                className="w-full bg-[#020617] border border-gray-700 rounded px-2 py-1 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                customInput={<CustomDateInput onCommit={handleImmediateSave} />}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Ende (optional)</label>
                            <DatePicker
                                selected={ganttData.endDate ? new Date(ganttData.endDate) : null}
                                onChange={(date: Date | null) => {
                                    const dateStr = date ? new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : undefined;
                                    handleChange('endDate', dateStr);
                                }}
                                dateFormat="dd.MM.yyyy"
                                locale={de}
                                isClearable
                                todayButton="Heute"
                                className="w-full bg-[#020617] border border-gray-700 rounded px-2 py-1 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                customInput={<CustomDateInput onCommit={handleImmediateSave} />}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                            <select
                                value={ganttData.status}
                                onChange={(e) => handleChange('status', e.target.value)}
                                className="w-full bg-[#020617] border border-gray-700 rounded px-2 py-1 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option value="Geplant">Geplant</option>
                                <option value="In Arbeit">In Arbeit</option>
                                <option value="Fertig">Fertig</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Info</label>
                            <textarea
                                value={ganttData.info || ''}
                                onChange={(e) => handleChange('info', e.target.value)}
                                placeholder="Zusätzliche Informationen zum Projekt..."
                                rows={3}
                                className="w-full bg-[#020617] border border-gray-700 rounded px-2 py-1 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
                            />
                        </div>
                    </div>
                </div>

                {/* Budget */}
                <div className="bg-slate-900/50 p-5 rounded-lg border border-gray-700/50">
                    <h3 className="text-lg font-semibold mb-4 text-gray-200 border-b border-gray-800 pb-2">Budget</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Budget, geplant (Gesamt)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                                <input
                                    type="text"
                                    value={formattedTotalBudget}
                                    onChange={handleTotalBudgetChange}
                                    onBlur={handleTotalBudgetBlur}
                                    className="w-full bg-[#020617] border border-gray-700 rounded px-2 py-1 pl-8 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        {/* Jahresbudgets (Dynamsich) */}
                        {years.length > 0 && (
                            <div className="mt-4 p-4 bg-slate-950/50 rounded-md border border-gray-800">
                                <h4 className="text-sm font-semibold text-gray-400 mb-3">Aufteilung nach Jahren</h4>

                                {budgetError && (
                                    <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 text-red-400 text-sm rounded-md flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                        <p>{budgetError}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {years.map(year => (
                                        <div key={year}>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Jahr {year}</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-sm">€</span>
                                                <input
                                                    type="text"
                                                    value={formattedYearlyBudgets[year] ?? ''}
                                                    onChange={(e) => handleYearlyBudgetChange(year, e)}
                                                    onBlur={() => handleYearlyBudgetBlur(year)}
                                                    className={`w-full bg-[#020617] border rounded px-2 py-1 pl-6 text-sm focus:outline-none focus:ring-2 ${isBudgetExceeded
                                                        ? 'border-red-500/50 text-red-200 focus:ring-red-500'
                                                        : 'border-gray-700 text-gray-200 focus:ring-blue-500'
                                                        }`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 text-right text-xs text-gray-500">
                                    Summe: <span className={isBudgetExceeded ? 'text-red-400 font-bold' : 'text-gray-300'}>€ {totalYearlyBudgets.toFixed(2)}</span> / € {(ganttData.totalBudget || 0).toFixed(2)}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-800/50">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Budget, verbraucht (Gesamt)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                                <input
                                    type="text"
                                    readOnly
                                    value={spentBudget.toFixed(2)}
                                    className={`w-full bg-[#020617] border border-gray-700/50 rounded px-2 py-1 pl-8 text-gray-400 cursor-not-allowed ${isSpentExceeded ? 'text-red-400 font-bold' : ''
                                        }`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 italic">
                                    (Wird automatisch berechnet)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
};
