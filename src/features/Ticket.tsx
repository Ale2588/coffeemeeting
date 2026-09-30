import type { ReactNode } from "react";
import { Price } from "../components/Price";
import { PILOT } from "../config/pilot";
import { mapsUrl } from "../lib/calendar";
import { formatDayTitle, formatTime } from "../lib/dates";
import type { MyInvitation } from "../lib/invitations";

type Props = { inv: MyInvitation; voided?: boolean; stamp?: ReactNode };

/** Il biglietto dell'invito: giorno e ora in grande, poi locale e dettagli. */
export function Ticket({ inv, voided, stamp }: Props) {
  const people =
    inv.format === "one_to_one" ? "Uno a uno: 2 persone, tu compreso" : `${inv.participants} persone, tu compreso`;
  return (
    <article className={voided ? "ticket ticket--void" : "ticket"} aria-label="Invito">
      {stamp && <span className="ticket__stamp">{stamp}</span>}
      <div className="ticket__top">
        <p className="label-mono">Il tuo invito · {inv.zoneName}</p>
        <p className="ticket__day">{formatDayTitle(inv.startsAt)}</p>
        <p className="ticket__time">{formatTime(inv.startsAt)}</p>
      </div>
      <div className="ticket__perf" aria-hidden="true" />
      <div className="ticket__bottom">
        <p style={{ fontWeight: 600 }}>{inv.venueName ?? "Locale da definire"}</p>
        {inv.venueAddress && (
          <p style={{ color: "var(--ink-2)", fontSize: 15 }}>
            {inv.venueAddress} ·{" "}
            <a className="text-link" style={{ minHeight: 0, padding: 0 }} href={mapsUrl(inv)} target="_blank" rel="noopener noreferrer">
              Apri la mappa
            </a>
          </p>
        )}
        <dl className="kv" style={{ marginTop: 14 }}>
          <dt>Al tavolo</dt>
          <dd>{people}</dd>
          <dt>Durata</dt>
          <dd>circa {inv.durationMinutes} minuti</dd>
          <dt>Colazione</dt>
          <dd>
            <Price amount={PILOT.breakfastPriceEur} />
          </dd>
        </dl>
      </div>
    </article>
  );
}
