import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean; // If true, confirm button is red
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = true
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full shrink-0 ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-2 leading-tight">
                                {title}
                            </h3>
                            <p className="text-sm text-gray-300 leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-950 px-6 py-4 flex justify-end gap-3 border-t border-gray-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm transition-colors ${isDestructive
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        autoFocus // Automatically focus the confirm button for keyboard users (Enter to confirm)
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
