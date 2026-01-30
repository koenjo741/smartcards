import React, { useRef, useEffect, useState } from 'react';
import { Ban, X, Plus } from 'lucide-react';

interface ColorPickerProps {
    type: 'text' | 'highlight';
    onClose: () => void;
    editor: any;
    selectionRef: React.MutableRefObject<any>;
    userColors: string[];
    addUserColor: (color: string) => void;
    removeUserColor: (color: string) => void;
}

const BASIC_COLORS = [
    '#000000', // Black
    '#4b5563', // Gray 600
    '#9ca3af', // Gray 400
    '#dc2626', // Red 600
    '#d97706', // Amber 600
    '#ca8a04', // Yellow 600
    '#16a34a', // Green 600
    '#2563eb', // Blue 600
    '#7c3aed', // Violet 600
    '#db2777', // Pink 600
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
    type,
    onClose,
    editor,
    selectionRef,
    userColors,
    addUserColor,
    removeUserColor
}) => {
    const [pickerColor, setPickerColor] = useState(
        type === 'text'
            ? (editor.getAttributes('textStyle').color || '#000000')
            : (editor.getAttributes('highlight').color || '#ffff00')
    );
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const applyColor = (color: string) => {
        if (selectionRef.current) {
            if (type === 'text') {
                editor.chain().focus().setTextSelection(selectionRef.current).setColor(color).run();
            } else {
                editor.chain().focus().setTextSelection(selectionRef.current).unsetHighlight().run();
                editor.chain().setTextSelection(selectionRef.current).toggleHighlight({ color: color }).run();
            }
        }
        onClose();
    };

    return (
        <div
            ref={containerRef}
            className="p-3 bg-slate-800 border border-gray-700 shadow-xl rounded-lg z-50 flex flex-col gap-3 w-64"
        >
            {/* No Color Button */}
            <button
                type="button"
                onClick={() => {
                    if (selectionRef.current) {
                        if (type === 'text') {
                            editor.chain().focus().setTextSelection(selectionRef.current).unsetColor().run();
                        } else {
                            editor.chain().focus().setTextSelection(selectionRef.current).unsetHighlight().run();
                        }
                    }
                    onClose();
                }}
                className="flex items-center gap-2 w-full p-1.5 rounded hover:bg-slate-700 text-gray-300 hover:text-white transition-colors border border-gray-600 mb-1"
                title="Remove color"
            >
                <Ban className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">No Color</span>
            </button>

            {/* Basic Colors */}
            <div>
                <div className="text-xs text-gray-400 font-semibold mb-1.5 uppercase tracking-wider">Basic Colors</div>
                <div className="grid grid-cols-5 gap-1.5">
                    {BASIC_COLORS.map(color => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => applyColor(color)}
                            className="w-6 h-6 rounded-sm border border-gray-600 hover:scale-110 transition-transform shadow-sm"
                            style={{ backgroundColor: color }}
                            title={color}
                        />
                    ))}
                </div>
            </div>

            {/* User Colors */}
            <div>
                <div className="text-xs text-gray-400 font-semibold mb-1.5 uppercase tracking-wider flex justify-between items-center">
                    <span>My Colors</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                    {userColors.map(color => (
                        <div key={color} className="relative group">
                            <button
                                type="button"
                                onClick={() => applyColor(color)}
                                className="w-6 h-6 rounded-sm border border-gray-600 hover:scale-110 transition-transform shadow-sm"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeUserColor(color);
                                }}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove color"
                            >
                                <X className="w-2 h-2" />
                            </button>
                        </div>
                    ))}
                    {userColors.length === 0 && <span className="text-xs text-gray-500 col-span-5 italic">No custom colors yet</span>}
                </div>
            </div>

            <div className="w-full h-px bg-gray-700" />

            {/* Custom Color Input */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <input
                        type="color"
                        value={pickerColor}
                        onChange={(e) => setPickerColor(e.target.value)}
                        className="w-full h-8 p-0 border border-gray-600 rounded bg-transparent cursor-pointer"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => addUserColor(pickerColor)}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded border border-gray-600"
                    title="Save to My Colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => applyColor(pickerColor)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 flex items-center"
                >
                    Apply
                </button>
            </div>
        </div>
    );
};
