import { StrictMode, Component, type ReactNode, type ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/outfit';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './index.css';
import App from './App.tsx';

/**
 * Applies the user's saved UI scale to the document root *before* React mounts,
 * so frame 1 paints at the correct zoom level with no post-mount rescale jump.
 */
function applyStoredUiScale(): void {
  try {
    const saved = localStorage.getItem('auralune_ui_scale');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.85 && parsed <= 1.45) {
        document.documentElement.style.zoom = String(parsed);
        document.documentElement.style.setProperty('--ui-scale', String(parsed));
      }
    }
  } catch {
    // localStorage unavailable — useThemeManager will apply the default on mount.
  }
}

applyStoredUiScale();

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
        <div className="relative z-140 min-h-screen overflow-y-auto bg-deep/95 p-8 font-mono text-fg">
          <h2 className="mb-3 text-2xl text-accent-pink">Auralune UI Runtime Error</h2>
          <div className="mb-4 rounded-xl border border-accent-pink/40 bg-accent-pink/10 p-4 text-md text-rose-300">
            <strong>{this.state.error?.name}: </strong>
            {this.state.error?.message}
          </div>
          {this.state.error?.stack && (
            <pre className="mb-4 overflow-x-auto rounded-lg bg-black/60 p-3.5 text-ui whitespace-pre-wrap text-fg-secondary">
              {this.state.error.stack}
            </pre>
          )}
          {this.state.errorInfo?.componentStack && (
            <pre className="overflow-x-auto rounded-lg bg-black/60 p-3.5 text-xs whitespace-pre-wrap text-fg-muted">
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-accent-purple px-5 py-2.5 font-semibold text-on-accent"
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
