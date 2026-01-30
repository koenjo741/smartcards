import React, { useRef, useState } from 'react';
import { Paperclip, Trash2, Eye, Loader2, FileText } from 'lucide-react';
import type { Attachment } from '../types';
import { useDropbox } from '../hooks/useDropbox';

interface AttachmentManagerProps {
    attachments: Attachment[];
    onAttachmentsChange: (attachments: Attachment[]) => void;
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({
    attachments,
    onAttachmentsChange
}) => {
    const { uploadFile, deleteFile, getFileLink } = useDropbox();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            const newAttachments: Attachment[] = [];
            for (let i = 0; i < files.length; i++) {
                const uploadedFile = await uploadFile(files[i]);
                if (uploadedFile) {
                    newAttachments.push(uploadedFile);
                }
            }
            onAttachmentsChange([...attachments, ...newAttachments]);
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to upload file to Dropbox.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (attachment: Attachment) => {
        if (!confirm(`Delete "${attachment.name}"?`)) return;

        // Optimistic update
        const updated = attachments.filter(a => a.id !== attachment.id);
        onAttachmentsChange(updated);

        try {
            await deleteFile(attachment.path);
        } catch (error) {
            console.error("Delete failed", error);
            // Revert if critical? usually Dropbox delete is fire & forget or we sync later.
        }
    };

    const handlePreview = async (attachment: Attachment) => {
        const link = await getFileLink(attachment.path);
        if (link) {
            window.open(link, '_blank');
        } else {
            alert("Could not generate preview link.");
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium mb-2 text-gray-300 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments
            </label>

            <div className="space-y-2 mb-3">
                {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between p-2 bg-slate-800 rounded border border-gray-700 hover:border-gray-600 transition-colors">
                        <div className="flex items-center space-x-3 overflow-hidden">
                            <div className="p-2 bg-slate-700 rounded text-blue-400">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm text-gray-200 truncate font-medium" title={att.name}>{att.name}</p>
                                <p className="text-xs text-gray-500">{att.type} • {(att.size / 1024).toFixed(1)} KB</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-1">
                            <button
                                type="button"
                                onClick={() => handlePreview(att)}
                                className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-slate-700/50 rounded transition-colors"
                                title="Preview"
                            >
                                <Eye className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDelete(att)}
                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                title="Delete"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                />
                <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-blue-400 rounded-md border border-blue-900/30 hover:bg-slate-700 hover:border-blue-500/50 transition-all text-sm font-medium"
                >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    {isUploading ? 'Uploading...' : 'Add File'}
                </button>
            </div>
        </div>
    );
};
