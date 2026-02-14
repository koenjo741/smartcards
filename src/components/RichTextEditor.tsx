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
import { Bold, Italic, Superscript as SuperIcon, Subscript as SubIcon, Table as TableIcon, Trash2, Columns, Rows, Indent, Outdent, List, ListOrdered, Image as ImageIcon, Highlighter, AlignLeft, AlignCenter, AlignRight, AlignJustify, Calendar } from 'lucide-react';
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImage } from './ResizableImage';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
// import Link from '@tiptap/extension-link';
import { ColorPicker } from './ColorPicker';
import TextAlign from '@tiptap/extension-text-align';
import { resizeImage } from '../utils/imageUtils';

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
    userColors?: string[];
    onUserColorsChange?: (colors: string[]) => void;
    isStandAlone?: boolean;
    gcalEvents?: any[];
}

const CustomTable = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            align: {
                default: 'left',
                parseHTML: element => element.getAttribute('data-align'),
                renderHTML: attributes => {
                    const align = attributes.align;

                    // Robust Inline Styles
                    // Using float for right alignment as it is very strong
                    // Using margin auto for center
                    // Ensuring box-sizing is border-box

                    let style = 'border-collapse: collapse; display: table; width: fit-content; max-width: 100%; margin-top: 1rem; margin-bottom: 1rem; box-sizing: border-box;';

                    if (align === 'center') {
                        style += 'margin-left: auto; margin-right: auto;';
                    } else if (align === 'right') {
                        // Float is often more effective than margin-left: auto if width is tricky
                        style += 'float: right; margin-left: 1rem;';
                    } else {
                        style += 'margin-right: auto; margin-left: 0;';
                    }

                    return {
                        'data-align': align,
                        style: style,
                    };
                },
            },
        };
    },
});

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
    content,
    onChange,
    editable = true,
    userColors = [],
    onUserColorsChange,
    isStandAlone = false,
    gcalEvents = []
}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [showColorPopover, setShowColorPopover] = React.useState<'text' | 'highlight' | null>(null);

    // Focus Logic for Dashboard
    const [isEditorFocused, setIsEditorFocused] = React.useState(false);

    // Filter events
    const getLocalYMD = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    const todayStr = getLocalYMD(new Date());
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    const tomorrowStr = getLocalYMD(tmr);

    const filterEvents = (events: any[], targetYMD: string) => {
        return (events || []).filter(e => {
            if (e.start.date) {
                // All-day events have simple YYYY-MM-DD string
                return e.start.date === targetYMD;
            }
            if (e.start.dateTime) {
                // Timed events need conversion to local date string
                return getLocalYMD(new Date(e.start.dateTime)) === targetYMD;
            }
            return false;
        });
    };

    const todayEvents = filterEvents(gcalEvents, todayStr);
    const tomorrowEvents = filterEvents(gcalEvents, tomorrowStr);

    const formatTime = (dateStr: string) => {
        if (!dateStr || dateStr.length === 10) return '';
        return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const selectionRef = React.useRef<any>(null); // To store selection for color picker
    const addUserColor = (color: string) => {
        if (!userColors.includes(color) && onUserColorsChange) {
            const newColors = [...userColors, color];
            onUserColorsChange(newColors);
        }
    };

    const removeUserColor = (colorToRemove: string) => {
        if (onUserColorsChange) {
            const newColors = userColors.filter(c => c !== colorToRemove);
            onUserColorsChange(newColors);
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                // Resize image before inserting (max 800px, JPEG 0.7)
                // This prevents LocalStorage Quota Exceeded errors
                const resizedDataUrl = await resizeImage(file, 800, 800, 0.7);

                editor?.chain().focus().setImage({ src: resizedDataUrl }).run();
            } catch (err) {
                console.error("Image Upload/Resize Error:", err);
                alert("Failed to process image. Please try another one.");
            }
        }
    };

    const editor = useEditor({
        extensions: [
            StarterKit,
            Superscript,
            Subscript,
            CustomTable.configure({
                resizable: false, // Disabling resizable to prevent width conflicts
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
            // Link.configure({ // Removed
            //     autolink: true,
            //     openOnClick: false,
            //     linkOnPaste: true,
            // }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
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
            handlePaste: (view, event, slice) => {
                const items = Array.from(event.clipboardData?.items || []);
                const imageItem = items.find(item => item.type.startsWith('image/'));

                if (imageItem) {
                    const file = imageItem.getAsFile();
                    if (file) {
                        event.preventDefault(); // Prevent default paste behavior
                        resizeImage(file, 800, 800, 0.7).then(resizedDataUrl => {
                            view.dispatch(view.state.tr.replaceSelectionWith(
                                view.state.schema.nodes.image.create({ src: resizedDataUrl })
                            ));
                        }).catch(err => {
                            console.error("Paste Image Resize Error:", err);
                            alert("Failed to process pasted image.");
                        });
                        return true; // We handled it
                    }
                }
                return false; // Default behavior
            },
            handleDrop: (view, event, slice, moved) => {
                const hasFiles = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0;
                if (!moved && hasFiles) {
                    const file = event.dataTransfer?.files[0];
                    if (file && file.type.startsWith('image/')) {
                        event.preventDefault(); // Prevent default drop
                        resizeImage(file, 800, 800, 0.7).then(resizedDataUrl => {
                            // Calculate position from coordinates
                            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                            if (coordinates) {
                                view.dispatch(view.state.tr.insert(coordinates.pos, view.state.schema.nodes.image.create({ src: resizedDataUrl })));
                            } else {
                                // Fallback to current selection
                                view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src: resizedDataUrl })));
                            }
                        }).catch(err => {
                            console.error("Drop Image Resize Error:", err);
                            alert("Failed to process dropped image.");
                        });
                        return true; // We handled it
                    }
                }
                return false;
            }
        },
    });

    // Update editor content when prop changes (external change, e.g. switching cards)
    useEffect(() => {
        if (editor && content !== undefined) {
            const currentContent = editor.getHTML();
            // Prevent re-render loop if content is semantically same (prevents cursor jump)
            if (currentContent !== content) {
                editor.commands.setContent(content, { emitUpdate: false } as any);
            }
        }
    }, [content, editor]);

    // Focus Listener for Dashboard
    const handleContainerFocus = () => {
        setIsEditorFocused(true);
    };

    const handleContainerBlur = (e: React.FocusEvent<HTMLDivElement>) => {
        // Only lose focus if moving outside the component
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsEditorFocused(false);
        }
    };

    if (!editor) {
        return null;
    }

    // Helper to check if cursor is inside a table (robust check)
    const isTableActive = editor ? (
        editor.isActive('table') ||
        editor.isActive('tableRow') ||
        editor.isActive('tableCell') ||
        editor.isActive('tableHeader')
    ) : false;

    return (
        <div
            className="border border-gray-700 rounded-md flex flex-col h-full shadow-sm w-full max-w-full"
            style={{ backgroundColor: '#f3f4f6' }}
            onFocus={handleContainerFocus}
            onBlur={handleContainerBlur}
        >
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
            />
            {editable && (
                (isStandAlone && !isEditorFocused) ? (
                    // DASHBOARD VIEW
                    <div className="rounded-t-md border-b border-gray-700 bg-slate-900 p-4 sticky top-0 z-10 flex gap-6 min-h-[60px] overflow-hidden">
                        {/* Today Column */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold mb-2 text-xs uppercase tracking-wider flex items-center" style={{ color: '#f59e0b' }}>
                                <Calendar className="w-3 h-3 mr-1" />
                                Heute
                            </h3>
                            <div className="space-y-1">
                                {todayEvents.length > 0 ? todayEvents.map(e => (
                                    <div key={e.id} className="text-[10px] md:text-xs text-gray-300 truncate flex items-baseline">
                                        {e.start.dateTime && (
                                            <span className="text-gray-400 text-[10px] md:text-xs font-mono mr-2 w-8 md:w-10 shrink-0">
                                                {formatTime(e.start.dateTime)}
                                            </span>
                                        )}
                                        <span className="truncate">{e.summary}</span>
                                    </div>
                                )) : (
                                    <div className="text-gray-600 text-[10px] italic">Keine Termine</div>
                                )}
                            </div>
                        </div>

                        {/* Tomorrow Column */}
                        <div className="flex-1 min-w-0 border-l border-gray-800 pl-6">
                            <h3 className="font-bold mb-2 text-xs uppercase tracking-wider flex items-center" style={{ color: '#425de3' }}>
                                <Calendar className="w-3 h-3 mr-1" />
                                Morgen
                            </h3>
                            <div className="space-y-1">
                                {tomorrowEvents.length > 0 ? tomorrowEvents.map(e => (
                                    <div key={e.id} className="text-[10px] md:text-xs text-gray-300 truncate flex items-baseline">
                                        {e.start.dateTime && (
                                            <span className="text-gray-400 text-[10px] md:text-xs font-mono mr-2 w-8 md:w-10 shrink-0">
                                                {formatTime(e.start.dateTime)}
                                            </span>
                                        )}
                                        <span className="truncate">{e.summary}</span>
                                    </div>
                                )) : (
                                    <div className="text-gray-600 text-[10px] italic">Keine Termine</div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // STANDARD TOOLBAR
                    <div className="rounded-t-md border-b border-gray-700 bg-slate-900 p-2 flex flex-wrap gap-1 sticky top-0 z-10">
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive('bold') ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                            title="Bold"
                        // ... (omitting lines for brevity in prompt, but I need to be careful with the Replace tool)
                        // Actually I should split this into chunks or use a larger block that includes the necessary parts.
                        // I will target the container start, the toolbar start, and the content wrapper.

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
                            value={editor.getAttributes('textStyle').fontFamily || 'default'}
                            className="h-8 text-sm border border-gray-600 rounded bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-200 py-0 pl-2 pr-7 cursor-pointer mr-1"
                            title="Font Family"
                            style={{ width: '150px' }}
                        >
                            <optgroup label="Proportional">
                                <option value="default">Inter</option>
                                <option value="Roboto, sans-serif">Roboto</option>
                                <option value="Open Sans, sans-serif">Open Sans</option>
                                <option value="Lato, sans-serif">Lato</option>
                                <option value="Montserrat, sans-serif">Montserrat</option>
                                <option value="Source Sans 3, sans-serif">Source Sans</option>
                                <option value="Nunito, sans-serif">Nunito</option>
                                <option value="Rubik, sans-serif">Rubik</option>
                                <option value="Merriweather, serif">Merriweather</option>
                            </optgroup>
                            <optgroup label="Monospaced">
                                <option value="Roboto Mono, monospace">Roboto Mono</option>
                                <option value="Source Code Pro, monospace">Source Code Pro</option>
                                <option value="Fira Code, monospace">Fira Code</option>
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
                                    const { from, to } = editor.state.selection;
                                    selectionRef.current = { from, to };
                                    setShowColorPopover(showColorPopover === 'text' ? null : 'text');
                                }}
                                className="flex items-center justify-center w-6 h-6 rounded hover:bg-slate-700 border border-gray-600"
                                title="Text Color"
                            >
                                <div className="w-4 h-4 rounded-sm border border-gray-300" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }} />
                            </button>

                            {showColorPopover === 'text' && (
                                <div className="absolute top-full left-0 mt-1 z-50">
                                    <ColorPicker
                                        type="text"
                                        onClose={() => setShowColorPopover(null)}
                                        editor={editor}
                                        selectionRef={selectionRef}
                                        userColors={userColors}
                                        addUserColor={addUserColor}
                                        removeUserColor={removeUserColor}
                                    />
                                </div>
                            )}

                            {/* Highlight Color Trigger */}
                            <button
                                type="button"
                                onClick={() => {
                                    const { from, to } = editor.state.selection;
                                    selectionRef.current = { from, to };
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
                                    <ColorPicker
                                        type="highlight"
                                        onClose={() => setShowColorPopover(null)}
                                        editor={editor}
                                        selectionRef={selectionRef}
                                        userColors={userColors}
                                        addUserColor={addUserColor}
                                        removeUserColor={removeUserColor}
                                    />
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
                        <div className="w-px h-6 bg-gray-600 mx-1 self-center" />
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().setTextAlign('left').run()}
                            className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive({ textAlign: 'left' }) ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                            title="Align Left"
                        >
                            <AlignLeft className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().setTextAlign('center').run()}
                            className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive({ textAlign: 'center' }) ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                            title="Align Center"
                        >
                            <AlignCenter className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().setTextAlign('right').run()}
                            className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive({ textAlign: 'right' }) ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                            title="Align Right"
                        >
                            <AlignRight className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                            className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                            title="Justify"
                        >
                            <AlignJustify className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-gray-600 mx-1 self-center" />
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

                        {/* Insert Table Button - Disabled if inside a table */}
                        <button
                            type="button"
                            onClick={() => {
                                if (isTableActive) return; // Prevent nested tables
                                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                            }}
                            disabled={isTableActive}
                            className={`p-1.5 rounded hover:bg-slate-700 ${isTableActive ? 'opacity-30 cursor-not-allowed text-gray-600' : 'text-gray-400'}`}
                            title={isTableActive ? "Table Controls Active" : "Insert Table"}
                        >
                            <TableIcon className="w-4 h-4" />
                        </button>

                        {/* Table Controls - Shown when inside a table (Robust check) */}
                        {isTableActive && (
                            <div className="flex items-center gap-1 bg-slate-800 rounded px-2 py-1 ml-1 border border-slate-600 animate-in fade-in zoom-in duration-200">
                                <span className="text-xs text-gray-400 mr-1 font-medium select-none">Table:</span>
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
                                <div className="w-px h-4 bg-gray-600 mx-1 self-center" />
                                <button
                                    type="button"
                                    onClick={() => editor.chain().focus().updateAttributes('table', { align: 'left' }).run()}
                                    className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive('table', { align: 'left' }) ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                                    title="Align Table Left"
                                >
                                    <AlignLeft className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => editor.chain().focus().updateAttributes('table', { align: 'center' }).run()}
                                    className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive('table', { align: 'center' }) ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                                    title="Align Table Center"
                                >
                                    <AlignCenter className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => editor.chain().focus().updateAttributes('table', { align: 'right' }).run()}
                                    className={`p-1.5 rounded hover:bg-slate-700 ${editor.isActive('table', { align: 'right' }) ? 'bg-slate-600 text-white' : 'text-gray-400'}`}
                                    title="Align Table Right"
                                >
                                    <AlignRight className="w-4 h-4" />
                                </button>

                                <div className="w-px h-4 bg-gray-600 mx-1 self-center" />
                                <button
                                    type="button"
                                    onClick={() => editor.chain().focus().deleteTable().run()}
                                    className="p-1.5 rounded hover:bg-red-900/50 text-red-400"
                                    title="Delete Table"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
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
                )
            )}

            <div className={`flex-1 overflow-y-auto overflow-x-auto pb-2 rounded-b-md w-full max-w-full ${!editable ? 'rounded-t-md' : ''}`}>
                <EditorContent editor={editor} className="h-full" />
            </div>
        </div >
    );
};
