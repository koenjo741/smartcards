import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Bold, Italic, Superscript as SuperIcon, Subscript as SubIcon, Table as TableIcon, Trash2, Columns, Rows, Indent, Outdent, List, ListOrdered, Image as ImageIcon, Highlighter, Check } from 'lucide-react';
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImage } from './ResizableImage';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';

const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return {
            types: ['textStyle'],
        };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
                        renderHTML: attributes => {
                            if (!attributes.fontSize) {
                                return {};
                            }
                            return {
                                style: `font-size: ${attributes.fontSize}`,
                            };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontSize: (fontSize: string) => ({ chain }: any) => {
                return chain()
                    .setMark('textStyle', { fontSize })
                    .run();
            },
            unsetFontSize: () => ({ chain }: any) => {
                return chain()
                    .setMark('textStyle', { fontSize: null })
                    .removeEmptyTextStyle()
                    .run();
            },
        };
    },
});

const FontFamily = Extension.create({
    name: 'fontFamily',
    addOptions() {
        return {
            types: ['textStyle'],
        };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontFamily: {
                        default: null,
                        parseHTML: element => element.style.fontFamily?.replace(/['"]+/g, ''),
                        renderHTML: attributes => {
                            if (!attributes.fontFamily) {
                                return {};
                            }
                            return {
                                style: `font-family: ${attributes.fontFamily}`,
                            };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontFamily: (fontFamily: string) => ({ chain }: any) => {
                return chain()
                    .setMark('textStyle', { fontFamily })
                    .run();
            },
            unsetFontFamily: () => ({ chain }: any) => {
                return chain()
                    .setMark('textStyle', { fontFamily: null })
                    .removeEmptyTextStyle()
                    .run();
            },
        };
    },
});

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    editable?: boolean;
}

// ... (imports remain)
import { Bold, Italic, Superscript as SuperIcon, Subscript as SubIcon, Table as TableIcon, Trash2, Columns, Rows, Indent, Outdent, List, ListOrdered, Image as ImageIcon, Highlighter, Check, Plus, X } from 'lucide-react';
// ... (extensions remain)

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

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    editable?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, editable = true }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [showColorPopover, setShowColorPopover] = React.useState<'text' | 'highlight' | null>(null);
    const [tempColor, setTempColor] = React.useState('#000000');
    const selectionRef = React.useRef<any>(null); // To store selection for color picker
    // User colors state
    const [userColors, setUserColors] = React.useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('editor-user-colors');
                return saved ? JSON.parse(saved) : [];
            } catch (e) {
                console.error('Failed to load user colors', e);
                return [];
            }
        }
        return [];
    });

    const addUserColor = (color: string) => {
        if (!userColors.includes(color)) {
            const newColors = [...userColors, color];
            setUserColors(newColors);
            localStorage.setItem('editor-user-colors', JSON.stringify(newColors));
        }
    };

    const removeUserColor = (colorToRemove: string) => {
        const newColors = userColors.filter(c => c !== colorToRemove);
        setUserColors(newColors);
        localStorage.setItem('editor-user-colors', JSON.stringify(newColors));
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit
                alert("Image too large. Please select an image under 1MB.");
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result;
                if (typeof result === 'string') {
                    editor?.chain().focus().setImage({ src: result }).run();
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const editor = useEditor({
        extensions: [
            StarterKit,
            Superscript,
            Subscript,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            TextStyle,
            FontFamily,
            FontSize,
            Extension.create({
                name: 'indent',
                addGlobalAttributes() {
                    return [
                        {
                            types: ['listItem', 'paragraph', 'heading'],
                            attributes: {
                                indent: {
                                    default: 0,
                                    renderHTML: attributes => ({
                                        style: `margin-left: ${attributes.indent * 20}px`
                                    }),
                                    parseHTML: element => parseInt(element.style.marginLeft) / 20 || 0,
                                },
                            },
                        },
                    ];
                },
                addCommands() {
                    return {
                        indent: () => ({ tr, state }: any) => {
                            const { selection } = state;
                            tr.doc.nodesBetween(selection.from, selection.to, (node: any, pos: any) => {
                                if (['listItem', 'paragraph', 'heading'].includes(node.type.name)) {
                                    const currentIndent = node.attrs.indent || 0;
                                    tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: currentIndent + 1 });
                                    return false;
                                }
                            });
                            return true;
                        },
                        outdent: () => ({ tr, state }: any) => {
                            const { selection } = state;
                            tr.doc.nodesBetween(selection.from, selection.to, (node: any, pos: any) => {
                                if (['listItem', 'paragraph', 'heading'].includes(node.type.name)) {
                                    const currentIndent = node.attrs.indent || 0;
                                    if (currentIndent > 0) {
                                        tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: currentIndent - 1 });
                                    }
                                    return false;
                                }
                            });
                            return true;
                        },
                    } as any;
                },
                addKeyboardShortcuts() {
                    return {
                        Tab: () => {
                            if (this.editor.isActive('listItem')) {
                                if (this.editor.can().sinkListItem('listItem')) {
                                    return this.editor.commands.sinkListItem('listItem');
                                }
                                return (this.editor.commands as any).indent();
                            }
                            if (this.editor.isActive('table')) {
                                return false;
                            }
                            return (this.editor.commands as any).indent();
                        },
                        'Shift-Tab': () => {
                            if (this.editor.isActive('listItem')) {
                                if (this.editor.can().liftListItem('listItem')) {
                                    return this.editor.commands.liftListItem('listItem');
                                }
                                return (this.editor.commands as any).outdent();
                            }
                            return (this.editor.commands as any).outdent();
                        }
                    };
                },
            }),
            Image.configure({
                inline: true,
                allowBase64: true,
            }).extend({
                addAttributes() {
                    return {
                        ...this.parent?.(),
                        width: {
                            default: null,
                        },
                        height: {
                            default: null,
                        },
                    };
                },
                addNodeView() {
                    return ReactNodeViewRenderer(ResizableImage);
                },
            }),
            Color.configure({ types: [TextStyle.name] }),
            Highlight.configure({ multicolor: true }),
            Link.configure({
                autolink: true,
                openOnClick: false,
                linkOnPaste: true,
            }),
        ],
        content,
        editable,
        onUpdate: ({ editor }) => {
            onChange(editor.isEmpty ? '' : editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-2',
            },
        },
    });

    // Update editor content when prop changes (external change, e.g. switching cards)
    useEffect(() => {
        if (editor && content !== undefined) {
            // Only update if content is actually different to avoid cursor jumps / loops
            // We compare loosely or just trust setContent to handle diff
            const currentContent = editor.getHTML();
            if (currentContent !== content && !editor.isFocused) {
                // Only update if not focused OR if content is wildly different (like completely new card)
                // For the "Switch Card" case, the editor is likely not focused or we want to force update anyway.
                // Actually, simpler check:
                editor.commands.setContent(content);
            }
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    const ColorPickerContent = ({ type, onClose }: { type: 'text' | 'highlight', onClose: () => void }) => {
        const [pickerColor, setPickerColor] = React.useState(type === 'text' ? (editor.getAttributes('textStyle').color || '#000000') : (editor.getAttributes('highlight').color || '#ffff00'));

        const applyColor = (color: string) => {
            if (selectionRef.current) {
                if (type === 'text') {
                    editor.chain().focus().setTextSelection(selectionRef.current).unsetMark('textStyle').run();
                    editor.chain().setTextSelection(selectionRef.current).setMark('textStyle', { color: color }).run();
                } else {
                    editor.chain().focus().setTextSelection(selectionRef.current).unsetHighlight().run();
                    editor.chain().setTextSelection(selectionRef.current).toggleHighlight({ color: color }).run();
                }
            }
            onClose();
        };

        return (
            <div className="p-3 bg-slate-800 border border-gray-700 shadow-xl rounded-lg z-50 flex flex-col gap-3 w-64">
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
                        {/* Placeholder if empty to maintain height or just nothing */}
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

    return (
        <div className="border border-gray-700 rounded-md overflow-hidden flex flex-col h-full text-gray-900 shadow-sm" style={{ backgroundColor: '#f3f4f6' }}>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
            />
            {editable && (
                <div className="border-b border-gray-700 bg-slate-900 p-2 flex flex-wrap gap-1 sticky top-0 z-10">
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive('bold') ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                        title="Bold"
                    >
                        <Bold className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive('italic') ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                        title="Italic"
                    >
                        <Italic className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-gray-600 mx-1 self-center" />

                    {/* Font Family Select */}
                    <select
                        onChange={(e) => {
                            const font = e.target.value;
                            if (font === 'default') {
                                (editor.commands as any).unsetFontFamily();
                            } else {
                                (editor.commands as any).setFontFamily(font);
                            }
                        }}
                        className="h-8 text-sm border border-gray-600 rounded bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-200 py-0 pl-2 pr-7 cursor-pointer mr-1"
                        title="Font Family"
                        style={{ width: '150px' }}
                    >
                        <optgroup label="Proportional">
                            <option value="default">Inter</option>
                            <option value="Roboto, sans-serif">Roboto</option>
                            <option value="'Open Sans', sans-serif">Open Sans</option>
                            <option value="Lato, sans-serif">Lato</option>
                            <option value="Montserrat, sans-serif">Montserrat</option>
                            <option value="'Source Sans 3', sans-serif">Source Sans</option>
                            <option value="Nunito, sans-serif">Nunito</option>
                            <option value="Rubik, sans-serif">Rubik</option>
                        </optgroup>
                        <optgroup label="Monospaced">
                            <option value="'Roboto Mono', monospace">Roboto Mono</option>
                            <option value="'Source Code Pro', monospace">Source Code Pro</option>
                            <option value="'Fira Code', monospace">Fira Code</option>
                        </optgroup>
                    </select>

                    {/* Font Size Select */}
                    <select
                        onChange={(e) => {
                            const size = e.target.value;
                            if (size === 'default') {
                                (editor.commands as any).unsetFontSize();
                            } else {
                                (editor.commands as any).setFontSize(size);
                            }
                        }}
                        value={editor.getAttributes('textStyle').fontSize || 'default'}
                        className="h-8 text-sm border border-gray-600 rounded bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-200 py-0 pl-2 pr-7 cursor-pointer"
                        title="Font Size"
                        style={{ width: '85px' }}
                    >
                        <option value="default">Size</option>
                        <option value="12px">12px</option>
                        <option value="14px">14px</option>
                        <option value="16px">16px</option>
                        <option value="18px">18px</option>
                        <option value="20px">20px</option>
                        <option value="24px">24px</option>
                        <option value="30px">30px</option>
                    </select>

                    <div className="w-px h-6 bg-gray-600 mx-1 self-center" />
                    <div className="flex items-center gap-1 relative">
                        {/* Text Color Trigger */}
                        <button
                            type="button"
                            onClick={() => {
                                // Save range integers instead of Selection object
                                const { from, to } = editor.state.selection;
                                selectionRef.current = { from, to };
                                setTempColor(editor.getAttributes('textStyle').color || '#000000');
                                setShowColorPopover(showColorPopover === 'text' ? null : 'text');
                            }}
                            className="flex items-center justify-center w-6 h-6 rounded hover:bg-slate-700 border border-gray-600"
                            title="Text Color"
                        >
                            <div className="w-4 h-4 rounded-sm border border-gray-300" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }} />
                        </button>

                        {/* Text Color Popover */}
                        {showColorPopover === 'text' && (
                            <div className="absolute top-full left-0 mt-1 z-50">
                                <ColorPickerContent type="text" onClose={() => setShowColorPopover(null)} />
                                {/* Overlay to close */}
                                <div className="fixed inset-0 z-40" onClick={() => setShowColorPopover(null)} />
                            </div>
                        )}

                        {/* Highlight Color Trigger */}
                        <button
                            type="button"
                            onClick={() => {
                                const { from, to } = editor.state.selection;
                                selectionRef.current = { from, to };
                                setTempColor(editor.getAttributes('highlight').color || '#ffff00');
                                setShowColorPopover(showColorPopover === 'highlight' ? null : 'highlight');
                            }}
                            className="flex items-center justify-center w-6 h-6 rounded hover:bg-slate-700 border border-gray-600 ml-1"
                            title="Highlight Color"
                        >
                            <div className="w-4 h-4 rounded-sm border border-gray-300" style={{ backgroundColor: editor.getAttributes('highlight').color || '#ffff00' }} />
                        </button>

                        {/* Highlight Popover */}
                        {showColorPopover === 'highlight' && (
                            <div className="absolute top-full left-0 mt-1 z-50">
                                <ColorPickerContent type="highlight" onClose={() => setShowColorPopover(null)} />
                                <div className="fixed inset-0 z-40" onClick={() => setShowColorPopover(null)} />
                            </div>
                        )}


                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleHighlight().run()}
                            className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive('highlight') ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                            title="Toggle Highlight"
                        >
                            <Highlighter className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (editor.isActive('superscript')) {
                                editor.chain().focus().unsetSuperscript().run();
                            } else {
                                editor.chain().focus().unsetSubscript().setSuperscript().run();
                            }
                        }}
                        className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive('superscript') ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                        title="Superscript"
                    >
                        <SuperIcon className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (editor.isActive('subscript')) {
                                editor.chain().focus().unsetSubscript().run();
                            } else {
                                editor.chain().focus().unsetSuperscript().setSubscript().run();
                            }
                        }}
                        className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive('subscript') ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                        title="Subscript"
                    >
                        <SubIcon className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-gray-600 mx-1 self-center" />
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive('bulletList') ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                        title="Bullet List"
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive('orderedList') ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                        title="Ordered List"
                    >
                        <ListOrdered className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (editor.isActive('listItem')) {
                                if (editor.can().sinkListItem('listItem')) {
                                    editor.chain().focus().sinkListItem('listItem').run();
                                } else {
                                    (editor.chain().focus() as any).indent().run();
                                }
                            } else {
                                (editor.chain().focus() as any).indent().run();
                            }
                        }}
                        className="p-1.5 rounded hover:bg-slate-700 text-gray-400"
                        title="Indent (Tab)"
                    >
                        <Indent className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (editor.isActive('listItem')) {
                                if (editor.can().liftListItem('listItem')) {
                                    editor.chain().focus().liftListItem('listItem').run();
                                } else {
                                    (editor.chain().focus() as any).outdent().run();
                                }
                            } else {
                                (editor.chain().focus() as any).outdent().run();
                            }
                        }}
                        // disabled={!editor.can().liftListItem('listItem')} // Disabled check removed as we have fallback
                        className="p-1.5 rounded hover:bg-slate-700 text-gray-400"
                        title="Outdent (Shift+Tab)"
                    >
                        <Outdent className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-gray-600 mx-1 self-center" />
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                        className="p-1.5 rounded hover:bg-slate-700 text-gray-400"
                        title="Insert Table"
                    >
                        <TableIcon className="w-4 h-4" />
                    </button>

                    {editor.isActive('table') && (
                        <>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addColumnAfter().run()}
                                className="p-1.5 rounded hover:bg-slate-700 text-gray-400"
                                title="Add Column"
                            >
                                <Columns className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteColumn().run()}
                                className="p-1.5 rounded hover:bg-red-900/50 text-red-400"
                                title="Delete Column"
                            >
                                <Columns className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowAfter().run()}
                                className="p-1.5 rounded hover:bg-slate-700 text-gray-400"
                                title="Add Row"
                            >
                                <Rows className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteRow().run()}
                                className="p-1.5 rounded hover:bg-red-900/50 text-red-400"
                                title="Delete Row"
                            >
                                <Rows className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteTable().run()}
                                className="p-1.5 rounded hover:bg-red-900/50 text-red-400"
                                title="Delete Table"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}

                    <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                        title="Insert Image"
                    >
                        <ImageIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                <EditorContent editor={editor} className="h-full" />
            </div>
        </div >
    );
};

