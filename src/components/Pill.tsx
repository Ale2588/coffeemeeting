import type { ReactNode } from "react";

type PillProps = {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** Pillola selezionabile. Lo stato è esposto con aria-pressed e un segno di spunta, non solo col colore. */
export function Pill({ selected, onToggle, children }: PillProps) {
  return (
    <button type="button" className="pill" aria-pressed={selected} onClick={onToggle}>
      {children}
    </button>
  );
}

type PillGroupProps = { labelId: string; describedBy?: string; children: ReactNode };

export function PillGroup({ labelId, describedBy, children }: PillGroupProps) {
  return (
    <div className="pills" role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
      {children}
    </div>
  );
}
