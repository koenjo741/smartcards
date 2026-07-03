import React, { useState, useCallback, useRef, useEffect } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

type WidthOption = 25 | 50 | 75 | 100;

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
}

const WIDTH_OPTIONS: { label: string; value: WidthOption }[] = [
    { label: '25 % Breite', value: 25 },
    { label: '50 % Breite', value: 50 },
    { label: '75 % Breite', value: 75 },
    { label: '100 % Breite', value: 100 },
];

export const ResizableImage = (props: NodeViewProps) => {
    const { node, updateAttributes, editor } = props;
    const widthPercent: WidthOption = node.attrs.widthPercent ?? 100;

    const [menu, setMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
    const menuRef = useRef<HTMLDivElement>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        // Only show context menu in editable mode
        if (!editor.isEditable) return;
        e.preventDefault();
        e.stopPropagation();
        setMenu({ visible: true, x: e.clientX, y: e.clientY });
    }, [editor.isEditable]);

    const handleSelect = useCallback((value: WidthOption) => {
        updateAttributes({ widthPercent: value });
        setMenu({ visible: false, x: 0, y: 0 });
    }, [updateAttributes]);

    const handleClose = useCallback(() => {
        setMenu({ visible: false, x: 0, y: 0 });
    }, []);

    // Close menu on outside click or Escape
    useEffect(() => {
        if (!menu.visible) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        const onMouseDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('mousedown', onMouseDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('mousedown', onMouseDown);
        };
    }, [menu.visible, handleClose]);

    // Calculate image width: widthPercent of the wrapper (minus the 20px indent)
    const imgWidthStyle = widthPercent === 100
        ? 'calc(100% - 20px)'
        : `calc((100% - 20px) * ${widthPercent / 100})`;

    return (
        <NodeViewWrapper
            className="image-view inline-block align-top leading-none outline-none border-none"
            style={{ width: '100%', marginTop: '0.5rem', marginBottom: '0.5rem' }}
            onDragStart={(e: React.DragEvent) => e.preventDefault()}
        >
            <img
                src={node.attrs.src}
                alt={node.attrs.alt}
                className="block rounded-md shadow-sm"
                style={{
                    marginLeft: '20px',
                    width: imgWidthStyle,
                    height: 'auto',
                    maxWidth: '100%',
                    cursor: editor.isEditable ? 'context-menu' : 'default',
                    transition: 'width 0.2s ease',
                }}
                draggable="false"
                onContextMenu={handleContextMenu}
            />

            {/* Width badge shown while in editable mode */}
            {editor.isEditable && (
                <span
                    style={{
                        display: 'inline-block',
                        marginLeft: '20px',
                        fontSize: '10px',
                        color: '#888',
                        userSelect: 'none',
                        pointerEvents: 'none',
                    }}
                >
                    {widthPercent}%
                </span>
            )}

            {/* Context menu rendered via portal-like fixed positioning */}
            {menu.visible && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label="Bildgröße wählen"
                    style={{
                        position: 'fixed',
                        top: menu.y,
                        left: menu.x,
                        zIndex: 9999,
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        border: '1px solid rgba(99,102,241,0.35)',
                        borderRadius: '10px',
                        padding: '6px 0',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(99,102,241,0.2)',
                        minWidth: '160px',
                        backdropFilter: 'blur(12px)',
                    }}
                >
                    <div
                        style={{
                            padding: '4px 14px 8px',
                            fontSize: '10px',
                            fontWeight: 600,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'rgba(148,163,184,0.7)',
                            borderBottom: '1px solid rgba(99,102,241,0.2)',
                            marginBottom: '4px',
                        }}
                    >
                        Bildgröße
                    </div>
                    {WIDTH_OPTIONS.map(({ label, value }) => {
                        const isActive = value === widthPercent;
                        return (
                            <button
                                key={value}
                                role="menuitem"
                                onClick={() => handleSelect(value)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '7px 14px',
                                    background: isActive
                                        ? 'rgba(99,102,241,0.18)'
                                        : 'transparent',
                                    border: 'none',
                                    color: isActive ? '#a5b4fc' : '#cbd5e1',
                                    fontSize: '13px',
                                    fontFamily: 'inherit',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background 0.15s ease, color 0.15s ease',
                                }}
                                onMouseEnter={e => {
                                    if (!isActive) {
                                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.10)';
                                        (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!isActive) {
                                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                                        (e.currentTarget as HTMLButtonElement).style.color = '#cbd5e1';
                                    }
                                }}
                            >
                                {/* Mini visual indicator */}
                                <span
                                    style={{
                                        display: 'inline-block',
                                        height: '8px',
                                        width: `${value * 0.5}px`,  // 25→12.5px … 100→50px
                                        background: isActive
                                            ? 'rgba(99,102,241,0.8)'
                                            : 'rgba(148,163,184,0.4)',
                                        borderRadius: '2px',
                                        flexShrink: 0,
                                        transition: 'background 0.15s ease',
                                    }}
                                />
                                {label}
                                {isActive && (
                                    <span style={{ marginLeft: 'auto', color: '#818cf8', fontSize: '12px' }}>✓</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </NodeViewWrapper>
    );
};
