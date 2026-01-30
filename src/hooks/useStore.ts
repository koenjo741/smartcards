import { useState, useEffect } from 'react';
import type { Project, Card } from '../types';

interface StoreData {
    projects: Project[];
    cards: Card[];
    customColors?: string[];
}

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
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return { projects: MOCK_PROJECTS, cards: MOCK_CARDS, customColors: [] };
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, [data]);

    const addCard = (card: Card) => {
        setData(prev => ({ ...prev, cards: [...prev.cards, card] }));
    };

    const updateCard = (updatedCard: Card) => {
        setData(prev => {
            const oldCard = prev.cards.find(c => c.id === updatedCard.id);
            if (!oldCard) return prev; // Should not happen in normal flow

            const oldLinks = oldCard.linkedCardIds || [];
            const newLinks = updatedCard.linkedCardIds || [];

            // 1. Identify added and removed links
            const addedLinks = newLinks.filter(id => !oldLinks.includes(id));
            const removedLinks = oldLinks.filter(id => !newLinks.includes(id));

            // 2. Update cards
            const newCards = prev.cards.map(c => {
                // Case A: The card itself being updated
                if (c.id === updatedCard.id) return updatedCard;

                // Case B: A card that was just linked (Add back-link)
                if (addedLinks.includes(c.id)) {
                    const currentLinks = c.linkedCardIds || [];
                    // Avoid duplicates
                    if (!currentLinks.includes(updatedCard.id)) {
                        return { ...c, linkedCardIds: [...currentLinks, updatedCard.id] };
                    }
                }

                // Case C: A card that was just unlinked (Remove back-link)
                if (removedLinks.includes(c.id)) {
                    const currentLinks = c.linkedCardIds || [];
                    return { ...c, linkedCardIds: currentLinks.filter(id => id !== updatedCard.id) };
                }

                // Case D: Unaffected card
                return c;
            });

            return {
                ...prev,
                cards: newCards
            };
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
