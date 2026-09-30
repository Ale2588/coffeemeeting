type PlaceholderProps = { children?: string };

/** Segnaposto esplicito per un dato non ancora fornito. Mai sostituirlo con un valore inventato. */
export function Placeholder({ children = "DA DEFINIRE" }: PlaceholderProps) {
  return <span className="placeholder">[{children}]</span>;
}

type PhotoPlaceholderProps = { label?: string; className?: string };

export function PhotoPlaceholder({ label = "Foto reale · da fornire", className }: PhotoPlaceholderProps) {
  return (
    <div
      className={className ? `photo-placeholder ${className}` : "photo-placeholder"}
      role="img"
      aria-label="Segnaposto per una foto reale"
    >
      <span className="label-mono">{label}</span>
    </div>
  );
}
