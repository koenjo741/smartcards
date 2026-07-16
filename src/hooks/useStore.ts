import { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
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
    const [data, setData] = useState<StoreData>({ projects: [], cards: [], customColors: [] });
    const [isStoreLoaded, setIsStoreLoaded] = useState(false);

    useEffect(() => {
        const initData = async () => {
            try {
                // 1. Try to load from IndexedDB
                let loadedData = await get<StoreData>(STORAGE_KEY);

                // 2. Migration logic: If nothing in IndexedDB, check localStorage
                if (!loadedData) {
                    const storedLocal = localStorage.getItem(STORAGE_KEY);
                    if (storedLocal) {
                        try {
                            const parsed = JSON.parse(storedLocal);
                            if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.cards)) {
                                loadedData = parsed as StoreData;
                                console.log("Migrating data from localStorage to IndexedDB...");
                                await set(STORAGE_KEY, loadedData); // Save to IDB
                                localStorage.removeItem(STORAGE_KEY); // Clean up old storage
                                console.log("Migration successful.");
                            }
                        } catch (e) {
                            console.error('Failed to parse localStorage data during migration:', e);
                        }
                    }
                }

                // 3. Fallback to defaults if still empty
                if (!loadedData) {
                    loadedData = { projects: MOCK_PROJECTS, cards: MOCK_CARDS, customColors: [] };
                }

                setData(loadedData);
            } catch (error) {
                console.error("Failed to load data from IndexedDB:", error);
                setData({ projects: MOCK_PROJECTS, cards: MOCK_CARDS, customColors: [] }); // Fallback on error
            } finally {
                setIsStoreLoaded(true);
            }
        };

        initData();
    }, []);

    useEffect(() => {
        if (!isStoreLoaded) return; // Do not save before initial load is complete

        set(STORAGE_KEY, data).catch(error => {
            console.error("Failed to save to IndexedDB:", error);
            alert("Fehler beim Speichern der Daten. Bitte überprüfe den Speicherplatz deines Browsers.");
        });
    }, [data, isStoreLoaded]);

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
        loadData, // Exported for file import
        isStoreLoaded
    };
}
