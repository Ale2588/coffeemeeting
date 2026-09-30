import { useState } from "react";
import { Link } from "react-router";
import { Button, ButtonLink } from "../components/Button";
import { Notice } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { StatusTag, type StatusTone } from "../components/StatusTag";
import { useToast } from "../components/Toast";
import { ApiError } from "../lib/api";
import { formatDateTime, formatDayTitle, formatTime } from "../lib/dates";
import { computeBalance } from "./balance";
import { BalancePanel } from "./BalancePanel";
import { candidatesFor } from "./candidates";
import {
  addParticipant,
  cancelMeetup,
  effectiveStatus,
  sendMeetup,
  type FounderInvitationStatus,
  type FounderMember,
  type Meetup,
  type Venue,
} from "./founderApi";
import { useFounder } from "./FounderLayout";
import { genderAge } from "./labels";
import { useMeetupData } from "./useMeetupData";

const INVITE_LABEL: Record<FounderInvitationStatus, [string, StatusTone]> = {
  draft: ["Bozza", "neutral"],
  pending: ["Da confermare", "neutral"],
  confirmed: ["Confermato", "positive"],
  expired: ["Scaduto", "warning"],
  cancelled: ["Disdetto", "warning"],
};

const FORMAT_SHORT = { group: "Gruppo", one_to_one: "Uno a uno" } as const;

type Data = NonNullable<ReturnType<typeof useMeetupData>["data"]>;

export function MeetupsPage() {
  const { data, error, loading, reload } = useMeetupData();
  const [showPast, setShowPast] = useState(false);

  const now = Date.now();
  const isOver = (m: Meetup) => m.startsAt.getTime() + m.durationMinutes * 60_000 <= now;
  const drafts = data?.meetups.filter((m) => m.status === "draft" && !isOver(m)) ?? [];
  const sent = data?.meetups.filter((m) => m.status === "sent" && !isOver(m)) ?? [];
  const past = (data?.meetups.filter((m) => m.status === "cancelled" || isOver(m)) ?? []).reverse();

  return (
    <>
      <title>Tavoli · Pannello · CoffeeMeeting</title>
      <div className="admin__toolbar">
        <div>
          <h2>Tavoli</h2>
          <p className="admin__intro">Il pannello suggerisce, decidi tu. Gli inviti partono solo quando premi "Invia inviti".</p>
        </div>
        <ButtonLink to="/pannello/tavoli/nuovo" size="small">
          Nuovo tavolo
        </ButtonLink>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {loading && <LoadingState />}
      {data && (
        <>
          <Section title="Bozze" empty="Nessuna bozza." list={drafts} data={data} reload={reload} />
          <Section title="Inviti inviati" empty="Nessun tavolo in arrivo." list={sent} data={data} reload={reload} />
          {past.length > 0 && (
            <div>
              <button type="button" className="text-link" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
                {showPast ? "Nascondi" : "Mostra"} tavoli passati e annullati ({past.length})
              </button>
              {showPast && <Section title="Passati e annullati" empty="" list={past} data={data} reload={reload} readOnly />}
            </div>
          )}
        </>
      )}
    </>
  );
}

function Section(props: { title: string; empty: string; list: Meetup[]; data: Data; reload: () => Promise<void>; readOnly?: boolean }) {
  return (
    <section aria-label={props.title}>
      <h3 style={{ marginBottom: 10 }}>{props.title}</h3>
      {props.list.length === 0 ? (
        <p className="muted">{props.empty}</p>
      ) : (
        <div className="meetups">
          {props.list.map((m) => (
            <MeetupCard key={m.id} meetup={m} data={props.data} reload={props.reload} readOnly={props.readOnly} />
          ))}
        </div>
      )}
    </section>
  );
}

function MeetupCard({ meetup: m, data, reload, readOnly }: { meetup: Meetup; data: Data; reload: () => Promise<void>; readOnly?: boolean }) {
  const { catalog } = useFounder();
  const toast = useToast();
  const [confirming, setConfirming] = useState<"send" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState("");

  const zone = catalog.zones.find((z) => z.id === m.zoneId)?.name ?? "—";
  const venue: Venue | undefined = data.venues.find((v) => v.id === m.venueId);
  const byId = new Map(data.members.map((x) => [x.id, x]));
  const rows = m.invitations
    .map((i) => ({ inv: i, status: effectiveStatus(i), member: byId.get(i.profileId) }))
    .filter((r): r is typeof r & { member: FounderMember } => r.member !== undefined);
  const seated = rows.filter((r) => ["draft", "pending", "confirmed"].includes(r.status));
  const balance = computeBalance(m.format, seated.map((r) => r.member));
  const confirmed = rows.filter((r) => r.status === "confirmed").length;

  const statusTag =
    m.status === "cancelled" ? (
      <StatusTag tone="warning">Annullato</StatusTag>
    ) : m.status === "draft" ? (
      <StatusTag tone="neutral">Bozza</StatusTag>
    ) : (
      <StatusTag tone={seated.length > 0 && confirmed === seated.length ? "positive" : "neutral"}>
        {confirmed} di {seated.length} confermati
      </StatusTag>
    );

  const addable =
    m.status === "sent"
      ? candidatesFor(data.members, data.meetups, data.subscriptions, { id: m.id, zoneId: m.zoneId, slotId: m.slotId, date: m.date, format: m.format }).filter(
          (c) => c.reasons.length === 0 && !c.busy && !m.invitations.some((i) => i.profileId === c.member.id),
        )
      : [];

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setErr(null);
    try {
      await action();
      setConfirming(null);
      setAdding("");
      await reload();
      toast(done);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Qualcosa non ha funzionato. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="meetup-card">
      <div>
        <div className="meetup-card__head">
          <p className="label-mono">
            {zone} · {formatDayTitle(m.startsAt)} · {formatTime(m.startsAt)} · {FORMAT_SHORT[m.format]}
          </p>
          {statusTag}
        </div>
        <p style={{ marginTop: 8 }}>
          {venue ? (
            <>
              <b>{venue.name}</b> <span className="muted">· {venue.address}</span>
            </>
          ) : (
            <span className="muted">Locale da assegnare</span>
          )}
        </p>
        {m.status !== "cancelled" && (
          <p className="muted" style={{ marginTop: 4 }}>
            Risposte entro {formatDateTime(m.responseDeadline)}
          </p>
        )}
        <ul className="plist">
          {rows.length === 0 && <li className="muted">Nessun partecipante.</li>}
          {rows.map(({ inv, status, member }) => {
            const ga = genderAge(member.gender, member.birthYear);
            const first = (data.breakfasts.get(member.id) ?? 0) === 0;
            const [label, tone] = INVITE_LABEL[status];
            return (
              <li key={inv.id}>
                <span>
                  {member.firstName}
                  {first && <span className="first-time">prima volta</span>}{" "}
                  <span className="muted">· {member.job}</span>
                </span>
                <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                  <span className="meta" aria-label={ga.long}>
                    {ga.short}
                  </span>
                  {m.status !== "draft" && <StatusTag tone={tone}>{label}</StatusTag>}
                </span>
              </li>
            );
          })}
        </ul>

        {err && (
          <div style={{ marginTop: 12 }}>
            <Notice tone="error">{err}</Notice>
          </div>
        )}

        {!readOnly && m.status === "sent" && addable.length > 0 && (
          <div className="button-row" style={{ marginTop: 12, alignItems: "center" }}>
            <select
              className="status-select"
              aria-label="Aggiungi una persona al tavolo"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
            >
              <option value="">Aggiungi una persona…</option>
              {addable.map((c) => (
                <option key={c.member.id} value={c.member.id}>
                  {c.member.firstName} · {c.member.job}
                </option>
              ))}
            </select>
            <Button
              size="small"
              variant="secondary"
              disabled={!adding}
              loading={busy && !confirming}
              onClick={() => run(() => addParticipant(m.id, adding), "Persona aggiunta: vedrà l'invito nella sua pagina.")}
            >
              Invita
            </Button>
          </div>
        )}

        {confirming && (
          <div className="confirm-bar" style={{ marginTop: 12 }} role="alertdialog" aria-label="Conferma">
            {confirming === "send" ? (
              <p>
                Inviare gli inviti a {seated.length} persone? Li vedranno nella loro pagina e potranno rispondere fino a{" "}
                {formatDateTime(m.responseDeadline)}. Per ora non parte nessuna email.
              </p>
            ) : (
              <p>
                {m.status === "draft"
                  ? "Eliminare questa bozza?"
                  : "Annullare il tavolo? Chi ha ricevuto l'invito vedrà che è stato annullato; chi aveva già pagato riceve il rimborso completo."}
              </p>
            )}
            <div className="button-row">
              <Button
                size="small"
                variant={confirming === "cancel" ? "danger" : "primary"}
                loading={busy}
                onClick={() =>
                  confirming === "send"
                    ? run(() => sendMeetup(m.id), "Inviti inviati.")
                    : run(async () => {
                        const r = await cancelMeetup(m.id);
                        if (r.refundFailed > 0) {
                          throw new ApiError(
                            `Tavolo annullato, ma ${r.refundFailed} rimborsi non sono partiti: falli a mano dal pannello di Stripe.`,
                          );
                        }
                      }, m.status === "draft" ? "Bozza eliminata." : "Tavolo annullato: chi aveva pagato riceve il rimborso.")
                }
              >
                {confirming === "send" ? "Sì, invia" : m.status === "draft" ? "Sì, elimina" : "Sì, annulla il tavolo"}
              </Button>
              <Button size="small" variant="secondary" disabled={busy} onClick={() => setConfirming(null)}>
                Indietro
              </Button>
            </div>
          </div>
        )}
      </div>

      <div>
        <BalancePanel balance={balance} format={m.format} />
        {!readOnly && m.status !== "cancelled" && !confirming && (
          <div className="options" style={{ marginTop: 14 }}>
            {m.status === "draft" && (
              <>
                <Button size="small" block disabled={!venue || !balance.sizeOk} onClick={() => setConfirming("send")}>
                  Invia inviti
                </Button>
                {(!venue || !balance.sizeOk) && (
                  <p className="muted">{!venue ? "Assegna un locale per inviare." : "Correggi il numero di persone per inviare."}</p>
                )}
                <Link to={`/pannello/tavoli/${m.id}`} className="btn btn--secondary btn--small btn--block">
                  Modifica
                </Link>
                <Button size="small" variant="secondary" block onClick={() => setConfirming("cancel")}>
                  Elimina bozza
                </Button>
              </>
            )}
            {m.status === "sent" && (
              <Button size="small" variant="danger" block onClick={() => setConfirming("cancel")}>
                Annulla tavolo
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
