import { Button, Result } from 'antd';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

/**
 * R30: top-level error boundary. Without this, an uncaught render
 * error in any feature page unmounts the whole app — the user sees
 * a blank white screen with the real error buried in devtools.
 *
 * Catches render-phase errors only (event-handler errors still
 * surface through AntD's <App> message API).
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AppErrorBoundary] uncaught render error:', error, info);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    return (
      <Result
        status="error"
        title="Something went wrong"
        subTitle={error.message || 'An unexpected error occurred.'}
        extra={
          <Button type="primary" onClick={this.handleReload}>
            Reload
          </Button>
        }
      />
    );
  }
}
