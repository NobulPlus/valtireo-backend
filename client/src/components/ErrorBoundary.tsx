import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="font-display text-4xl font-semibold text-pine">Something went wrong</p>
          <p className="text-sm text-muted">
            This page ran into an unexpected error. Reloading usually fixes it.
          </p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
