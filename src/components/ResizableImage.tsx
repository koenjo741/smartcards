import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

export const ResizableImage = (props: NodeViewProps) => {
    const { node } = props;

    return (
        <NodeViewWrapper
            className="image-view inline-block align-top leading-none outline-none border-none"
            style={{
                width: '100%', // Wrapper takes full width to allow calculation
                marginTop: '0.5rem',
                marginBottom: '0.5rem'
            }}
            onDragStart={(e: React.DragEvent) => e.preventDefault()}
        >
            <img
                src={node.attrs.src}
                alt={node.attrs.alt}
                className="block rounded-md shadow-sm"
                style={{
                    marginLeft: '20px', // 1 tab indentation
                    width: 'calc((100% - 20px) * 0.9)', // 90% of remaining width
                    height: 'auto', // Maintain aspect ratio
                    maxWidth: '100%'
                }}
                draggable="false"
            />
        </NodeViewWrapper>
    );
};
