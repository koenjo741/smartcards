import React, { useEffect } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
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

    return (
        <div className="border border-gray-300 rounded-md overflow-hidden bg-white flex flex-col h-full text-gray-900 shadow-sm">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
            />
            {editable && (
                <div className="border-b border-gray-200 bg-gray-50 p-2 flex flex-wrap gap-1 sticky top-0 z-10">
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-300 text-gray-900' : 'text-gray-600'}`}
                        title="Bold"
                    >
                        <Bold className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-300 text-gray-900' : 'text-gray-600'}`}
                        title="Italic"
                    >
                        <Italic className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
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
                            className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-200 border border-gray-300"
                            title="Text Color"
                        >
                            <div className="w-4 h-4 rounded-sm border border-gray-300" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }} />
                        </button>

                        {/* Text Color Popover */}
                        {showColorPopover === 'text' && (
                            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 shadow-xl rounded-lg z-50 flex items-center space-x-2">
                                <input
                                    type="color"
                                    value={tempColor}
                                    onChange={(e) => setTempColor(e.target.value)}
                                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (selectionRef.current) {
                                            editor.chain().focus().setTextSelection(selectionRef.current).unsetMark('textStyle').run();
                                            editor.chain().setTextSelection(selectionRef.current).setMark('textStyle', { color: tempColor }).run();
                                        }
                                        setShowColorPopover(null);
                                    }}
                                    className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 flex items-center"
                                >
                                    <Check className="w-3 h-3 mr-1" />
                                    OK
                                </button>
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
                            className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-200 border border-gray-300 ml-1"
                            title="Highlight Color"
                        >
                            <div className="w-4 h-4 rounded-sm border border-gray-300" style={{ backgroundColor: editor.getAttributes('highlight').color || '#ffff00' }} />
                        </button>

                        {/* Highlight Popover */}
                        {showColorPopover === 'highlight' && (
                            <div className="absolute top-full left-8 mt-1 p-2 bg-white border border-gray-200 shadow-xl rounded-lg z-50 flex items-center space-x-2">
                                <input
                                    type="color"
                                    value={tempColor}
                                    onChange={(e) => setTempColor(e.target.value)}
                                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (selectionRef.current) {
                                            editor.chain().focus().setTextSelection(selectionRef.current).unsetHighlight().run();
                                            editor.chain().setTextSelection(selectionRef.current).toggleHighlight({ color: tempColor }).run();
                                        }
                                        setShowColorPopover(null);
                                    }}
                                    className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 flex items-center"
                                >
                                    <Check className="w-3 h-3 mr-1" />
                                    OK
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleHighlight().run()}
                            className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('highlight') ? 'bg-gray-300 text-gray-900' : 'text-gray-600'}`}
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
                        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('superscript') ? 'bg-gray-300 text-gray-900' : 'text-gray-600'}`}
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
                        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('subscript') ? 'bg-gray-300 text-gray-900' : 'text-gray-600'}`}
                        title="Subscript"
                    >
                        <SubIcon className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-300 text-gray-900' : 'text-gray-600'}`}
                        title="Bullet List"
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-300 text-gray-900' : 'text-gray-600'}`}
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
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
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
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                        title="Outdent (Shift+Tab)"
                    >
                        <Outdent className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                        title="Insert Table"
                    >
                        <TableIcon className="w-4 h-4" />
                    </button>

                    {editor.isActive('table') && (
                        <>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addColumnAfter().run()}
                                className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                                title="Add Column"
                            >
                                <Columns className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowAfter().run()}
                                className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                                title="Add Row"
                            >
                                <Rows className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteTable().run()}
                                className="p-1.5 rounded hover:bg-red-50 text-red-500"
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
