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

/** Parses a date string that can be either ISO format or YYYY-MM-DD. */
export const parseDateString = (dateString: string): Date => {
    if (dateString.includes('T')) {
        return new Date(dateString);
    }
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
};

/** Normalizes a raw date input string (e.g., from a keyboard) to DD.MM.YYYY. */
export const normalizeDateInput = (input: string): string => {
    // 1. Replace all commas with dots
    let normalized = input.replace(/,/g, '.');

    // 2. Handle 8-digit inputs like 15091957 -> 15.09.1957
    if (/^\d{8}$/.test(normalized)) {
        normalized = `${normalized.slice(0, 2)}.${normalized.slice(2, 4)}.${normalized.slice(4)}`;
    }

    return normalized;
};
