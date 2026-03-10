import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseUserDateInput } from '../utils/dateUtils';

interface CalendarHeaderInputProps {
    date: Date;
    changeYear: (year: number) => void;
    changeMonth: (month: number) => void;
    decreaseMonth: () => void;
    increaseMonth: () => void;
    prevMonthButtonDisabled: boolean;
    nextMonthButtonDisabled: boolean;
    onSelectDate: (date: Date) => void;
}

export const CalendarHeaderInput: React.FC<CalendarHeaderInputProps> = ({
    date,
    changeYear,
    changeMonth,
    decreaseMonth,
    increaseMonth,
    prevMonthButtonDisabled,
    nextMonthButtonDisabled,
    onSelectDate
}) => {
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const parsed = parseUserDateInput(inputValue);
            if (parsed) {
                onSelectDate(parsed);
                setInputValue('');
            }
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        
        // Dynamic jump: if it's a valid partial or full date, adjust the calendar view
        const parsed = parseUserDateInput(val);
        if (parsed) {
            changeYear(parsed.getFullYear());
            changeMonth(parsed.getMonth());
        }
    };

    const monthName = date.toLocaleDateString('de-DE', { month: 'long' });
    const year = date.getFullYear();

    return (
        <div className="p-2 bg-slate-800 border-b border-slate-700 flex flex-col space-y-2">
            <div className="flex justify-between items-center px-1">
                <button
                    onClick={decreaseMonth}
                    disabled={prevMonthButtonDisabled}
                    type="button"
                    className="p-1 hover:bg-slate-700 rounded-md disabled:opacity-30 text-gray-400"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-sm font-semibold text-gray-200">
                    {monthName} {year}
                </div>
                <button
                    onClick={increaseMonth}
                    disabled={nextMonthButtonDisabled}
                    type="button"
                    className="p-1 hover:bg-slate-700 rounded-md disabled:opacity-30 text-gray-400"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            <div className="px-1">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Datum tippen..."
                    autoFocus
                    className="w-full px-2 py-1.5 bg-[#020617] border border-gray-600 rounded-md text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            </div>
        </div>
    );
};
