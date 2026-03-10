/**
 * Date utility functions for consistent date handling across the application.
 */

export const pad2 = (v: number | string) => String(v).padStart(2, '0');

/** Returns a color string based on how far the due date is from today. */
export const getDueDateStyle = (dateString: string): string | undefined => {
    if (!dateString) return undefined;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = parseISODate(dateString);
    if (!target || isNaN(target.getTime())) return undefined;
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffTime < 0) return '#ee4444';     // Überfällig
    if (diffTime === 0) return '#2563eb';    // Heute
    if (diffDays >= 1 && diffDays <= 7) return '#f59e10'; // Nächste 7 Tage
    return undefined;
};

/** Formats a date string (ISO or display) to DD.MM.YYYY format. */
export const formatDueDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = parseISODate(dateString);
    if (!date) return '';
    return formatDisplayDate(date);
};

/** Format Date object → DD.MM.YYYY */
export const formatDisplayDate = (date: Date): string => {
    if (isNaN(date.getTime())) return '';
    return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
};

/** Format Date object → YYYY-MM-DD (safe for storage and Google Calendar) */
export const formatISODate = (date: Date): string => {
    if (isNaN(date.getTime())) return '';
    // Use sv-SE locale for stable YYYY-MM-DD format without timezone shifts
    return date.toLocaleDateString('sv-SE');
};

/** Legacy support for parseDateString - mapped to parseISODate */
export const parseDateString = (dateString: string | undefined | null): Date => {
    return parseISODate(dateString) || new Date(NaN);
};

/** Safely parses ISO (YYYY-MM-DD) or Display (DD.MM.YYYY) strings into a Date object. */
export const parseISODate = (value?: string | null): Date | null => {
    if (!value) return null;

    if (value.includes('T')) {
        return new Date(value);
    }

    if (value.includes('-')) {
        const [y, m, d] = value.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    if (value.includes('.')) {
        const [d, m, y] = value.split('.').map(Number);
        return new Date(y, m - 1, d);
    }

    return null;
};

/** Checks if a day, month, and year combination represents a real, valid date. */
export const isRealDate = (day: number, month: number, year: number): boolean => {
    const d = new Date(year, month - 1, day);
    return (
        d.getFullYear() === year &&
        d.getMonth() === month - 1 &&
        d.getDate() === day
    );
};

/** Checks if a Date object corresponds to the input day/month/year. */
export const isValidDate = (_date: Date, inputDay: number, inputMonth: number, inputYear: number): boolean => {
    return isRealDate(inputDay, inputMonth, inputYear);
};

/** 
 * Robustly parses flexible user input (e.g., "1.2", "1509", "150920", "15/9/27") 
 * into a Date object, normalizing separators and padding years.
 */
export const parseUserDateInput = (input: string): Date | null => {
    if (!input) return null;

    let normalized = input.replace(/[,/ ]/g, '.').trim();

    // Handle 8-digit inputs like 15091957 -> 15.09.1957
    if (/^\d{8}$/.test(normalized)) {
        normalized = `${normalized.slice(0, 2)}.${normalized.slice(2, 4)}.${normalized.slice(4)}`;
    }

    // Handle 6-digit inputs like 150927 -> 15.09.2027
    if (/^\d{6}$/.test(normalized)) {
        normalized = `${normalized.slice(0, 2)}.${normalized.slice(2, 4)}.20${normalized.slice(4)}`;
    }

    const parts = normalized.split('.').filter(Boolean);

    // Support partial inputs like "1.2" (assumes current year)
    if (parts.length === 2) {
        parts.push(new Date().getFullYear().toString());
    }

    if (parts.length !== 3) return null;

    let [day, month, year] = parts.map(Number);

    // Handle 2-digit years
    if (year < 100) year += 2000;

    if (!isRealDate(day, month, year)) return null;

    return new Date(year, month - 1, day);
};

/** Kept for backwards compatibility but calls parseUserDateInput */
export const normalizeDateInput = (input: string): string => {
    const parsed = parseUserDateInput(input);
    return parsed ? formatDisplayDate(parsed) : input;
};
