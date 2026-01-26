import type { Card } from '../types';

/**
 * Advanced Search Logic
 * Supports:
 * - Text search (Title, Content)
 * - Wildcards (*)
 * - Booleans (AND, OR) - OR has higher precedence in this simple splitter, or we can handle block-by-block.
 *   Note: Typical precedence is AND > OR. We'll implement a simple top-level OR splitting.
 * - Date comparison (> DD.MM.YYYY, < DD.MM.YYYY)
 */

export const matchesSearch = (card: Card, query: string): boolean => {
    if (!query || !query.trim()) return true;

    // 1. Handle OR (Top Level)
    // If the query contains " OR ", we split and if ANY part matches, return true.
    if (query.includes(' OR ')) {
        const parts = query.split(' OR ');
        return parts.some(part => matchesSearch(card, part));
    }

    // 2. Handle AND (Implicit or Explicit " AND ")
    // If " AND " is present, split by it. Otherwise, splitting by space acts as implicit AND.
    // However, to respect spaces in other operators (like > 12.12.2025), we need careful tokenizing.
    // For simplicity, we'll assume " AND " is the explicit operator or spaces between independent terms.
    // But dealing with "> 01.01.2020" as one token needs care.
    // Let's normalize space around operators first? No, simple approach:

    // We treat " AND " same as generic space separation if we just loop through requirements.
    // But let's explicitly handle " AND " to match user request.
    let andParts = query.split(' AND ');

    // If no explicit AND, we might still have space separated terms. 
    // BUT we have to be careful not to split "> 12..."
    // Let's refine the strategy:
    // We will iterate through all "must match" conditions.

    // Flatten logic: 
    // The query at this stage (after OR split) requires ALL sub-conditions to be true.
    const mustMatchConditions = andParts.flatMap(part => {
        // Handle space separation as AND, but respect "operator value" grouping.
        // Regex to split by space, but keep "> date" or "< date" together?
        // Actually, easiest is to process the string and extract special operators first, then treat rest as text.
        return parseConditions(part.trim());
    });

    return mustMatchConditions.every(condition => checkCondition(card, condition));
};

type Condition =
    | { type: 'text'; value: string }
    | { type: 'date_gt'; date: Date } // >
    | { type: 'date_lt'; date: Date }; // <

const parseConditions = (queryString: string): Condition[] => {
    const conditions: Condition[] = [];
    let remaining = queryString;

    // Extract Date Operators (> DD.MM.YYYY or < DD.MM.YYYY)
    // Regex matches > or < followed by optional space and DD.MM.YYYY
    const dateRegex = /([<>])\s*(\d{2}\.\d{2}\.\d{4})/g;

    let match;
    while ((match = dateRegex.exec(queryString)) !== null) {
        const operator = match[1];
        const dateStr = match[2];
        const [day, month, year] = dateStr.split('.').map(Number);
        const date = new Date(year, month - 1, day);
        date.setHours(0, 0, 0, 0);

        if (operator === '>') {
            conditions.push({ type: 'date_gt', date });
        } else {
            conditions.push({ type: 'date_lt', date });
        }

        // Remove this match from remaining string to process text later
        // (We assume this regex is specific enough not to eat content text unintentionally excessively)
        // A safer way is to replace with empty string in a temp var
        remaining = remaining.replace(match[0], '');
    }

    // Process remaining text (split by spaces for multiple keywords)
    const textParts = remaining.trim().split(/\s+/).filter(s => s.length > 0);
    textParts.forEach(part => {
        conditions.push({ type: 'text', value: part });
    });

    return conditions;
};

const checkCondition = (card: Card, condition: Condition): boolean => { // eslint-disable-line @typescript-eslint/no-unused-vars
    if (condition.type === 'date_gt' || condition.type === 'date_lt') {
        if (!card.dueDate) return false;

        // Parse card date (handles ISO and simple)
        let cardDate: Date;
        if (card.dueDate.includes('T')) {
            cardDate = new Date(card.dueDate);
        } else {
            const [y, m, d] = card.dueDate.split('-').map(Number);
            cardDate = new Date(y, m - 1, d);
        }
        cardDate.setHours(0, 0, 0, 0);

        if (condition.type === 'date_gt') return cardDate > condition.date;
        if (condition.type === 'date_lt') return cardDate < condition.date;
    }

    if (condition.type === 'text') {
        const term = condition.value;
        const textToSearch = ((card.title || '') + ' ' + (card.content || '')).toLowerCase();

        // Handle Wildcard *
        if (term.includes('*')) {
            // Escape special regex chars except *
            const escapeRegex = (str: string) => str.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
            // Allow * to span anything (.*)
            const patternString = term.split('*').map(escapeRegex).join('.*');
            const regex = new RegExp(patternString, 'i'); // 'i' flag for case insensitive mostly handled by lowercase, but good for safety
            return regex.test(textToSearch);
        } else {
            return textToSearch.includes(term.toLowerCase());
        }
    }

    return true;
}
