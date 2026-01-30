import React from 'react';

interface EmptyStateProps {
    onConnect: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onConnect }) => {
    return (
        <div className="flex h-screen items-center justify-center bg-slate-950 text-white p-4">
            <div className="max-w-md w-full text-center space-y-8">
                <div>
                    <h1 className="text-4xl font-bold mb-4">SmartCards 🧠</h1>
                    <p className="text-gray-400 text-lg">
                        Manage your ideas and projects with secure Dropbox sync.
                    </p>
                </div>

                <div className="bg-slate-900 p-8 rounded-xl border border-gray-800 shadow-2xl">
                    <div className="mb-6">
                        <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-400">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold">Connect to Start</h2>
                        <p className="text-sm text-gray-500 mt-2">
                            Your data is stored safely in your own Dropbox. We never see your files.
                        </p>
                    </div>

                    <button
                        onClick={onConnect}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                    >
                        <span>Connect Dropbox</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
