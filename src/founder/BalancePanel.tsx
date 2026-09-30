import { StatusTag } from "../components/StatusTag";
import type { Balance } from "./balance";

/** Colonna di equilibrio: barra del genere, fascia d'età, numero di persone, etichette. */
export function BalancePanel({ balance, format }: { balance: Balance; format: "group" | "one_to_one" }) {
  const mf = balance.women + balance.men;
  return (
    <div className="balance">
      <p className="label-mono">Genere</p>
      {format === "one_to_one" ? (
        <p className="muted">Non valutato per l'uno a uno</p>
      ) : mf === 0 ? (
        <p className="muted">—</p>
      ) : (
        <>
          <div
            className="bar"
            role="img"
            aria-label={`${balance.women} donne, ${balance.men} uomini`}
          >
            <i style={{ width: `${(balance.women / mf) * 100}%` }} />
            <i style={{ width: `${(balance.men / mf) * 100}%` }} />
          </div>
          <p className="muted">
            D {balance.women} · U {balance.men}
          </p>
        </>
      )}
      <p className="label-mono">Età</p>
      <p>
        {balance.minAge === null ? "—" : `${balance.minAge}–${balance.maxAge}`}
        {balance.ageGap !== null && <span className="muted"> · scarto {balance.ageGap}</span>}
      </p>
      <p className="label-mono">Persone</p>
      <p>{balance.sizeHint}</p>
      <div className="pills" style={{ marginTop: 10 }}>
        {balance.labels.map((l) => (
          <StatusTag key={l.text} tone={l.ok ? "positive" : "warning"}>
            {l.text}
          </StatusTag>
        ))}
      </div>
    </div>
  );
}
