import { Component, type ErrorInfo, type ReactNode } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";

function Screen({ detail }: { detail: string }) {
  return (
    <div className="page">
      <header className="site-header">
        <a href="/" className="logo">
          Coffee<i>Meeting</i>
        </a>
      </header>
      <main className="section stack">
        <p className="label-mono">Errore</p>
        <h1>Qualcosa non ha funzionato.</h1>
        <p className="lead">Ricarica la pagina. Se il problema resta, torna alla home.</p>
        <p>
          <a href="/" className="text-link">
            Torna alla home
          </a>
        </p>
        <details>
          <summary className="muted">Dettagli tecnici</summary>
          <pre className="muted" style={{ whiteSpace: "pre-wrap" }}>{detail}</pre>
        </details>
      </main>
    </div>
  );
}

function describe(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/** errorElement delle rotte: un errore in una pagina non lascia la schermata bianca. */
export function RouteErrorScreen() {
  const error = useRouteError();
  console.error(error);
  return <Screen detail={describe(error)} />;
}

/** Ultima rete di sicurezza per errori fuori dal router. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    return this.state.error ? <Screen detail={describe(this.state.error)} /> : this.props.children;
  }
}
