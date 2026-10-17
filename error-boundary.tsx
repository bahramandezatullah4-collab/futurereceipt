import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function safeErrorSummary(error: Error): string {
  const message = `${error.name || 'Error'}: ${error.message || 'No message'}`
    .replace(/\b(?:pk|sk)_(?:test|live)_[A-Za-z0-9_-]+\b/gi, '[redacted key]')
    .replace(/\b(?:sess|user|clt|org)_[A-Za-z0-9_-]+\b/gi, '[redacted id]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
    .replace(/https?:\/\/\S+/gi, '[redacted URL]');
  return message.slice(0, 220);
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <main className="ecobill-noise grid min-h-[100dvh] w-full place-items-center bg-[#eeeadf] p-4 sm:p-6">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-lg)] sm:p-8" role="alert" data-testid="screen-app-error">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <span aria-hidden="true" className="text-2xl font-bold">!</span>
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This screen could not be loaded. Try again or reload the app.
        </p>
        {import.meta.env.DEV ? (
          <pre className="mt-4 max-h-48 overflow-auto rounded-xl bg-muted p-3 text-left text-xs text-foreground">
            {error.message || String(error)}
          </pre>
        ) : (
          <details className="mx-auto mt-4 max-w-full text-left">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground underline underline-offset-2">
              Technical details
            </summary>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-3 text-xs text-foreground">
              {safeErrorSummary(error)}
            </pre>
          </details>
        )}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={resetError}
            className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
            data-testid="button-error-retry"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload();
            }}
            className="min-h-11 rounded-xl border border-border px-5 text-sm font-semibold text-foreground"
            data-testid="button-error-reload"
          >
            Reload app
          </button>
        </div>
      </section>
    </main>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
