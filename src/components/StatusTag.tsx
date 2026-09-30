import type { ReactNode } from "react";

export type StatusTone = "positive" | "warning" | "neutral";

type StatusTagProps = { tone?: StatusTone; children: ReactNode };

/** Etichetta di stato in monospazio. Il testo porta sempre il significato; il colore lo rinforza. */
export function StatusTag({ tone = "positive", children }: StatusTagProps) {
  const cls = tone === "positive" ? "tag" : `tag tag--${tone}`;
  return (
    <span className={cls}>
      <span className="tag__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
