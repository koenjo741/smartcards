import { useState, useEffect } from 'react';
import type { Project, Card } from '../types';

interface StoreData {
    projects: Project[];
    cards: Card[];
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
        return { projects: MOCK_PROJECTS, cards: MOCK_CARDS };
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, [data]);

    const addCard = (card: Card) => {
        setData(prev => ({ ...prev, cards: [...prev.cards, card] }));
    };

    const updateCard = (updatedCard: Card) => {
        setData(prev => ({
            ...prev,
            cards: prev.cards.map(c => c.id === updatedCard.id ? updatedCard : c)
        }));
    };

    const deleteCard = (id: string) => {
        setData(prev => ({ ...prev, cards: prev.cards.filter(c => c.id !== id) }));
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
        loadData // Exported for file import
    };
}
