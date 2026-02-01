
// Helper for stable JSON stringify to avoid false positives in Sync
export const stableStringify = (obj: any): string => {
    // Normalize: Remove keys with null values but KEEP undefined/empty arrays if they are part of the schema
    const clean = (input: any): any => {
        if (Array.isArray(input)) return input.map(clean);
        if (typeof input === 'object' && input !== null) {
            const newObj: any = {};
            Object.keys(input).sort().forEach(key => {
                const val = input[key];
                // Keep everything except null/undefined, but allow empty strings/arrays
                if (val !== null && val !== undefined) {
                    newObj[key] = clean(val);
                }
            });
            return newObj;
        }
        return input;
    };
    return JSON.stringify(clean(obj));
};

export const stripHtml = (html: string) => {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return (doc.body.textContent || "").trim();
    } catch (e) {
        // Fallback for environments where DOMParser might fail (rare in browser)
        if (typeof document !== 'undefined') {
            const tmp = document.createElement("DIV");
            tmp.innerHTML = html;
            return (tmp.textContent || tmp.innerText || "").trim();
        }
        return html.replace(/<[^>]*>?/gm, '');
    }
};

export const getPreviewText = (html: string) => {
    // Replace block tags with newlines to preserve structure
    const withNewlines = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n');

    const text = stripHtml(withNewlines);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const firstLine = lines[0] || "";

    if (firstLine.length > 50) {
        return firstLine.substring(0, 50) + '...';
    }
    return firstLine;
};

export const getObjectDiff = (obj1: any, obj2: any): any => {
    const diff: any = {};

    // Return early if one is falsy and other isn't
    if (!obj1 || !obj2) {
        if (obj1 !== obj2) return { [!obj1 ? "old" : "new"]: "MISSING_OR_NULL", val: obj1 || obj2 };
        return {};
    }

    const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    keys.forEach(key => {
        // Ignore _meta or internal fields if needed, but for now we want EVERYTHING
        if (key === '_meta') return;

        const val1 = obj1[key];
        const val2 = obj2[key];

        // Simple Deep Compare
        if (JSON.stringify(val1) !== JSON.stringify(val2)) {
            if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
                // Check array separately? JSON.stringify handles arrays well for equality check
                // but deep diff might be better.
                // For arrays, if they differ, just return comparison
                if (Array.isArray(val1) || Array.isArray(val2)) {
                    diff[key] = { local: val1, saved: val2, type: 'array_mismatch' };
                } else {
                    const nestedDiff = getObjectDiff(val1, val2);
                    if (Object.keys(nestedDiff).length > 0) {
                        diff[key] = nestedDiff;
                    }
                }
            } else {
                diff[key] = { local: val1, saved: val2 };
            }
        }
    });
    return diff;
};
