import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.state.error) {
        if (this.props.fallback) {
          return this.props.fallback;
        }

        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h2>
              <p className="text-gray-600 mb-4">
                {this.state.error.message || '予期しないエラーが発生しました'}
              </p>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                onClick={() => this.setState({ hasError: false, error: null })}
                type="button"
              >
                再試行
              </button>
            </div>
          </div>
        );
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }
    }

    return this.props.children;
  }
}
