import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Resizable } from 're-resizable';

export const ResizableImage = (props: NodeViewProps) => {
    const { node, updateAttributes } = props;

    return (
        <NodeViewWrapper className="image-view inline-block align-top max-w-full">
            <Resizable
                size={{
                    width: node.attrs.width || 'auto',
                    height: node.attrs.height || 'auto'
                }}
                maxWidth="100%"
                lockAspectRatio={true}
                onResizeStop={(_e, _direction, ref, _d) => {
                    updateAttributes({
                        width: ref.style.width,
                        height: ref.style.height,
                    });
                }}
                enable={{
                    top: false,
                    right: true,
                    bottom: true,
                    left: true,
                    topRight: true,
                    bottomRight: true,
                    bottomLeft: true,
                    topLeft: true,
                }}
                className="relative shadow-sm group border-2 border-transparent hover:border-blue-500 transition-colors"
                handleComponent={{
                    bottomRight: <div className="hidden group-hover:block w-3 h-3 bg-blue-500 absolute bottom-0 right-0 cursor-se-resize rounded-sm" />,
                    topRight: <div className="hidden group-hover:block w-3 h-3 bg-blue-500 absolute top-0 right-0 cursor-ne-resize rounded-sm" />,
                    bottomLeft: <div className="hidden group-hover:block w-3 h-3 bg-blue-500 absolute bottom-0 left-0 cursor-sw-resize rounded-sm" />,
                    topLeft: <div className="hidden group-hover:block w-3 h-3 bg-blue-500 absolute top-0 left-0 cursor-nw-resize rounded-sm" />,
                }}
            >
                <img
                    src={node.attrs.src}
                    alt={node.attrs.alt}
                    className="block w-full h-full object-contain rounded-md"
                />
                {/* Optional: Add visible handles on hover if needed, re-resizable handles transparency by default */}
            </Resizable>
        </NodeViewWrapper>
    );
};
