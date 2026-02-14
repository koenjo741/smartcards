import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallbackTitle?: string;
    fallbackMessage?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 border border-red-500 rounded-md bg-red-900/20 text-red-200">
                    <div className="flex items-center gap-2 mb-2 font-bold text-red-400">
                        <AlertTriangle className="w-5 h-5" />
                        {this.props.fallbackTitle || 'Something went wrong'}
                    </div>
                    <p className="text-sm mb-2">
                        {this.props.fallbackMessage || 'An unexpected error occurred in this component.'}
                    </p>
                    {this.state.error && (
                        <pre className="text-xs bg-black/50 p-2 rounded overflow-auto max-h-32 font-mono">
                            {this.state.error.message}
                        </pre>
                    )}
                    <button
                        className="mt-3 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
