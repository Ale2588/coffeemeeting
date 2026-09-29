import type { ReactNode } from "react";

type OptionCardProps = {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  detail?: ReactNode;
};

/** Opzione a scheda per slot e formato: titolo in grassetto e dettaglio sotto. */
export function OptionCard({ selected, onSelect, title, detail }: OptionCardProps) {
  return (
    <button type="button" className="option" aria-pressed={selected} onClick={onSelect}>
      <b>{title}</b>
      {detail && <small>{detail}</small>}
    </button>
  );
}

type OptionGroupProps = { labelId: string; describedBy?: string; grid?: boolean; children: ReactNode };

export function OptionGroup({ labelId, describedBy, grid, children }: OptionGroupProps) {
  return (
    <div
      className={grid ? "options options--grid" : "options"}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
    >
      {children}
    </div>
  );
}
