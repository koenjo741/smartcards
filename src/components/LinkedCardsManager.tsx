import React, { useState } from 'react';
import { Link as LinkIcon, X, Plus } from 'lucide-react';
import type { Card } from '../types';

interface LinkedCardsManagerProps {
    linkedCardIds: string[];
    allCards: Card[];
    currentCardId?: string;
    onUpdateLinks: (newIds: string[]) => void;
    onNavigate?: (card: Card) => void;
}

export const LinkedCardsManager: React.FC<LinkedCardsManagerProps> = ({
    linkedCardIds,
    allCards,
    currentCardId,
    onUpdateLinks,
    onNavigate
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    const linkedCards = allCards.filter(c => linkedCardIds.includes(c.id));

    // Filter available cards: Exclude current card and already linked cards
    const availableCards = allCards.filter(c =>
        c.id !== currentCardId &&
        !linkedCardIds.includes(c.id) &&
        (c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.content.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 10); // Limit results

    const handleAddLink = (cardId: string) => {
        onUpdateLinks([...linkedCardIds, cardId]);
        setSearchTerm('');
        setShowSearch(false);
    };

    const handleRemoveLink = (cardId: string) => {
        onUpdateLinks(linkedCardIds.filter(id => id !== cardId));
    };

    return (
        <div>
            <label className="block text-sm font-medium mb-2 text-gray-300 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Linked Cards
            </label>

            {/* Existing Links */}
            <div className="flex flex-wrap gap-2 mb-3">
                {linkedCards.map(card => (
                    <div
                        key={card.id}
                        className="flex items-center bg-slate-800 border border-gray-700 rounded-full pl-3 pr-1 py-1 text-sm text-blue-300 hover:border-blue-500/50 transition-colors group"
                    >
                        <span
                            className="cursor-pointer hover:underline truncate max-w-[150px]"
                            onClick={() => onNavigate && onNavigate(card)}
                        >
                            {card.title || 'Untitled Card'}
                        </span>
                        <button
                            type="button"
                            onClick={() => handleRemoveLink(card.id)}
                            className="ml-2 p-1 hover:bg-slate-700 rounded-full text-gray-500 hover:text-red-400 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Add Link Input */}
            <div className="relative">
                {!showSearch ? (
                    <button
                        type="button"
                        onClick={() => setShowSearch(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-gray-400 rounded-md border border-gray-700 hover:bg-slate-700 hover:text-white transition-all text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Link a card
                    </button>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Search cards..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSearch(false)}
                                className="p-2 hover:bg-slate-800 rounded text-gray-400"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Results Dropdown */}
                        {searchTerm && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-gray-700 rounded-md shadow-xl max-h-48 overflow-y-auto z-10">
                                {availableCards.length > 0 ? (
                                    availableCards.map(card => (
                                        <button
                                            key={card.id}
                                            type="button"
                                            onClick={() => handleAddLink(card.id)}
                                            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white transition-colors truncate border-b border-gray-700/50 last:border-none"
                                        >
                                            {card.title || 'Untitled'}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-sm text-gray-500 italic">
                                        No matching cards
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
