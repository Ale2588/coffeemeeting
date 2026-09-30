export function LoadingState({ label = "Caricamento…" }: { label?: string }) {
  return (
    <p className="loading-state" role="status">
      <span className="loading-state__spinner" aria-hidden="true" />
      {label}
    </p>
  );
}
