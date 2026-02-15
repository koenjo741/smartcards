import { useState, useEffect } from 'react';
import type { Project, Card } from '../types';

interface StoreData {
    projects: Project[];
    cards: Card[];
    customColors?: string[];
}

/**
 * Applies backlink logic: when a card's linkedCardIds change,
 * the corresponding back-links on other cards are added/removed.
 * Exported so App.tsx can reuse this for force-sync without duplication.
 */
export const applyBacklinks = (cards: Card[], updatedCard: Card): Card[] => {
    const oldCard = cards.find(c => c.id === updatedCard.id);
    if (!oldCard) return cards.map(c => c.id === updatedCard.id ? updatedCard : c);

    const oldLinks = oldCard.linkedCardIds || [];
    const newLinks = updatedCard.linkedCardIds || [];
    const addedLinks = newLinks.filter(id => !oldLinks.includes(id));
    const removedLinks = oldLinks.filter(id => !newLinks.includes(id));

    return cards.map(c => {
        if (c.id === updatedCard.id) return updatedCard;

        if (addedLinks.includes(c.id)) {
            const currentLinks = c.linkedCardIds || [];
            if (!currentLinks.includes(updatedCard.id)) {
                return { ...c, linkedCardIds: [...currentLinks, updatedCard.id] };
            }
        }

        if (removedLinks.includes(c.id)) {
            const currentLinks = c.linkedCardIds || [];
            return { ...c, linkedCardIds: currentLinks.filter(id => id !== updatedCard.id) };
        }

        return c;
    });
};

const STORAGE_KEY = 'smartcards-data';

const MOCK_PROJECTS: Project[] = [
    { id: '1', name: 'Work', color: '#3b82f6' },
    { id: '2', name: 'Personal', color: '#10b981' },
    { id: '3', name: 'Learning', color: '#8b5cf6' },
];

const MOCK_CARDS: Card[] = [
    { id: '1', title: 'Setup Project', content: 'Initialize Vite and Tailwind', projectIds: ['1'], dueDate: '2023-11-01' },
    { id: '2', title: 'Buy Groceries', content: 'Milk, Eggs, Bread', projectIds: ['2'] },
    { id: '3', title: 'Learn React Hooks', content: 'Read documentation on useEffect', projectIds: ['3'] },
];

export function useStore() {
    const [data, setData] = useState<StoreData>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Structural sanity check
                if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.cards)) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Failed to parse stored data, falling back to defaults:', e);
        }
        return { projects: MOCK_PROJECTS, cards: MOCK_CARDS, customColors: [] };
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error("Failed to save to localStorage:", error);
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                alert("Storage Quota Exceeded! Your changes cannot be saved locally because the storage is full. Please remove large images or attachments.");
            }
        }
    }, [data]);

    const addCard = (card: Card) => {
        setData(prev => ({ ...prev, cards: [...prev.cards, card] }));
    };

    const updateCard = (updatedCard: Card) => {
        setData(prev => {
            const newCards = applyBacklinks(prev.cards, updatedCard);
            return { ...prev, cards: newCards };
        });
    };

    const deleteCard = (id: string) => {
        setData(prev => ({
            ...prev,
            cards: prev.cards
                .filter(c => c.id !== id) // Remove the card itself
                .map(c => ({
                    ...c,
                    // Remove the deleted card's ID from any linkedCardIds
                    linkedCardIds: c.linkedCardIds?.filter(linkedId => linkedId !== id) || []
                }))
        }));
    };

    const addProject = (project: Project) => {
        setData(prev => ({ ...prev, projects: [...prev.projects, project] }));
    };

    const reorderProjects = (projects: Project[]) => {
        setData(prev => ({ ...prev, projects }));
    };

    const updateProject = (updatedProject: Project) => {
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => p.id === updatedProject.id ? updatedProject : p)
        }));
    };

    const deleteProject = (id: string) => {
        setData(prev => ({
            ...prev,
            projects: prev.projects.filter(p => p.id !== id),
            cards: prev.cards.map(card => ({
                ...card,
                projectIds: card.projectIds.filter(pid => pid !== id)
            }))
        }));
    };

    const setCustomColors = (colors: string[]) => {
        setData(prev => ({ ...prev, customColors: colors }));
    };

    const loadData = (newData: StoreData) => {
        setData(newData);
    };

    return {
        projects: data.projects,
        cards: data.cards,
        addCard,
        updateCard,
        deleteCard,
        addProject,
        reorderProjects,
        updateProject,
        deleteProject,
        customColors: data.customColors || [],
        setCustomColors,
        loadData // Exported for file import
    };
}
