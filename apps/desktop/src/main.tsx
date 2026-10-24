import { StrictMode, Component, type ReactNode, type ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FATAL REACT ERROR:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '32px',
            background: 'rgba(15, 10, 25, 0.96)',
            color: '#fff',
            fontFamily: 'monospace',
            minHeight: '100vh',
            boxSizing: 'border-box',
            overflowY: 'auto',
            zIndex: 999999,
            position: 'relative',
          }}
        >
          <h2 style={{ color: '#f43f5e', fontSize: '1.4rem', marginBottom: '12px' }}>
            Auralune UI Runtime Error
          </h2>
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              padding: '16px',
              borderRadius: '10px',
              marginBottom: '16px',
              color: '#fda4af',
              fontSize: '0.95rem',
            }}
          >
            <strong>{this.state.error?.name}: </strong>
            {this.state.error?.message}
          </div>
          {this.state.error?.stack && (
            <pre
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                padding: '14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#94a3b8',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                marginBottom: '16px',
              }}
            >
              {this.state.error.stack}
            </pre>
          )}
          {this.state.errorInfo?.componentStack && (
            <pre
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                padding: '14px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#64748b',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              background: '#a855f7',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Reload UI
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
