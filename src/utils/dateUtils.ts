/**
 * Date utility functions extracted from App.tsx for reusability.
 */

/** Returns a color string based on how far the due date is from today. */
export const getDueDateStyle = (dateString: string): string | undefined => {
    if (!dateString) return undefined;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = parseDateString(dateString);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffTime < 0) return '#ee4444';     // Überfällig
    if (diffTime === 0) return '#2563eb';    // Heute
    if (diffDays >= 1 && diffDays <= 7) return '#f59e10'; // Nächste 7 Tage
    return undefined;
};

/** Formats a date string to DD.MM.YYYY format. */
export const formatDueDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = parseDateString(dateString);
    const dayStr = date.getDate().toString().padStart(2, '0');
    const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
    const yearStr = date.getFullYear();
    return `${dayStr}.${monthStr}.${yearStr}`;
};

export const parseDateString = (dateString: string | undefined | null): Date => {
    if (!dateString) return new Date(NaN);
    if (dateString.includes('T')) {
        return new Date(dateString);
    }
    const parts = dateString.split('-');
    if (parts.length !== 3) return new Date(NaN);
    const [year, month, day] = parts.map(Number);
    return new Date(year, month - 1, day);
};

/** Checks if a date string in YYYY-MM-DD or DD.MM.YYYY format represents a real, valid date. */
export const isValidDate = (date: Date, inputDay: number, inputMonth: number, inputYear: number): boolean => {
    return (
        date.getFullYear() === inputYear &&
        date.getMonth() === inputMonth - 1 &&
        date.getDate() === inputDay
    );
};

/** Normalizes a raw date input string (e.g., from a keyboard) to DD.MM.YYYY. */
export const normalizeDateInput = (input: string): string => {
    if (!input) return input;

    // 1. Replace all commas, slashes, and spaces with dots
    let normalized = input.replace(/[,/ ]/g, '.');

    // 2. Handle 8-digit inputs like 15091957 -> 15.09.1957
    if (/^\d{8}$/.test(normalized)) {
        return `${normalized.slice(0, 2)}.${normalized.slice(2, 4)}.${normalized.slice(4)}`;
    }

    // 3. Handle 6-digit inputs like 150927 -> 15.09.2027
    if (/^\d{6}$/.test(normalized)) {
        return `${normalized.slice(0, 2)}.${normalized.slice(2, 4)}.20${normalized.slice(4)}`;
    }

    // 4. Handle cases like 1.2.2027, 01.2.2027, 1.2.27 etc.
    const parts = normalized.split('.').filter(p => p !== '');
    if (parts.length === 3) {
        let [day, month, year] = parts;
        
        // Pad day and month
        day = day.padStart(2, '0');
        month = month.padStart(2, '0');
        
        // Handle 2-digit years (assuming 20xx for years like 27)
        if (year.length === 2) {
            year = `20${year}`;
        }
        
        return `${day}.${month}.${year}`;
    }

    return normalized;
};
