import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Button, ButtonLink } from "../components/Button";
import { Notice } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { SiteHeader } from "../components/SiteHeader";
import { StatusTag } from "../components/StatusTag";
import { Ticket } from "../features/Ticket";
import { ApiError } from "../lib/api";
import { downloadIcs, googleCalendarUrl } from "../lib/calendar";
import { formatDateTime } from "../lib/dates";
import { formatCents } from "../lib/format";
import {
  cancelInvitation,
  fetchCompanions,
  fetchMyInvitations,
  isPast,
  startBreakfastCheckout,
  type MyInvitation,
} from "../lib/invitations";

const GENERIC = "Qualcosa non ha funzionato. Riprova tra poco.";
const message = (e: unknown) => (e instanceof ApiError ? e.message : GENERIC);

const POLL_MS = 2000;
const POLL_MAX = 15;

export function InvitationPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const returned = params.get("pagamento");
  const [inv, setInv] = useState<MyInvitation | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(returned === "ok");

  const load = useCallback(async () => {
    try {
      const list = await fetchMyInvitations();
      const found = list.find((i) => i.id === Number(id)) ?? null;
      setInv(found);
      return found;
    } catch (e) {
      setError(message(e));
      return null;
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ritorno da Stripe: la conferma arriva dal webhook, di solito in pochi secondi.
  useEffect(() => {
    if (returned !== "ok") return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const found = await load();
      if (found?.status !== "pending" || n >= POLL_MAX) {
        clearInterval(t);
        setWaiting(false);
        setParams({}, { replace: true });
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [returned, load, setParams]);

  return (
    <>
      <title>Il tuo invito · CoffeeMeeting</title>
      <SiteHeader
        action={
          <Link to="/account" className="text-link">
            Il mio account
          </Link>
        }
      />
      <main id="contenuto">
        {error && <Notice tone="error">{error}</Notice>}
        {!error && inv === undefined && <LoadingState />}
        {inv === null && (
          <div className="stack">
            <h1>Invito non trovato.</h1>
            <p className="lead">Forse il link è sbagliato, oppure l'invito è per un altro account.</p>
            <ButtonLink to="/account" variant="secondary" block>
              Vai al mio account
            </ButtonLink>
          </div>
        )}
        {inv && waiting && inv.status === "pending" && <LoadingState label="Pagamento ricevuto da Stripe: stiamo confermando il tuo posto…" />}
        {inv && !(waiting && inv.status === "pending") && (
          <InvitationView inv={inv} reload={async () => void (await load())} cancelledCheckout={returned === "annullato"} />
        )}
      </main>
    </>
  );
}

type ViewProps = { inv: MyInvitation; reload: () => Promise<void>; cancelledCheckout?: boolean };

/** Cosa è successo ai soldi di un invito disdetto o annullato. */
function moneyAfterCancel(inv: MyInvitation): string {
  const p = inv.payment;
  if (p?.status === "refunded") return `Ti abbiamo rimborsato ${formatCents(p.amountCents)} sulla carta usata: arrivano entro 5–10 giorni lavorativi.`;
  if (p?.status === "succeeded") return `La colazione (${formatCents(p.amountCents)}) non è rimborsabile: la disdetta è arrivata dopo la scadenza.`;
  return "Non ti abbiamo addebitato nulla.";
}

function InvitationView({ inv, reload, cancelledCheckout }: ViewProps) {
  if (inv.meetupCancelled || inv.cancelledBy === "founder") {
    return (
      <>
        <Ticket inv={inv} voided />
        <div className="stack" style={{ marginTop: 18 }}>
          <StatusTag tone="warning">Tavolo annullato</StatusTag>
          <p className="lead">
            Abbiamo dovuto annullare questo tavolo.{" "}
            {inv.payment?.status === "refunded" || inv.payment?.status === "succeeded"
              ? `Ti rimborsiamo ${formatCents(inv.payment.amountCents)} sulla carta usata, entro 5–10 giorni lavorativi.`
              : "Non ti addebitiamo nulla."}{" "}
            Il prossimo invito arriva come sempre.
          </p>
          <ButtonLink to="/account" variant="secondary" block>
            Vai al mio account
          </ButtonLink>
        </div>
      </>
    );
  }
  if (inv.status === "cancelled") {
    return (
      <>
        <Ticket inv={inv} voided />
        <div className="stack" style={{ marginTop: 18 }}>
          <StatusTag tone="neutral">Disdetto</StatusTag>
          <p className="lead">Hai disdetto questa colazione. {moneyAfterCancel(inv)} Il prossimo invito arriva come sempre.</p>
          <ButtonLink to="/account" variant="secondary" block>
            Vai al mio account
          </ButtonLink>
        </div>
      </>
    );
  }
  if (inv.status === "expired") {
    return (
      <>
        <Ticket inv={inv} voided />
        <div className="stack" style={{ marginTop: 18 }}>
          <StatusTag tone="warning">Invito scaduto</StatusTag>
          <p className="lead">
            Non hai risposto entro {formatDateTime(inv.respondBy)}: il posto è passato a un'altra persona. Non ti abbiamo
            addebitato nulla.
          </p>
          <p style={{ color: "var(--ink-2)" }}>Se in questo periodo non riesci a rispondere, puoi mettere in pausa gli inviti.</p>
          <ButtonLink to="/account" variant="secondary" block>
            Metti in pausa gli inviti
          </ButtonLink>
        </div>
      </>
    );
  }
  if (inv.status === "confirmed" && isPast(inv)) {
    return (
      <>
        <Ticket inv={inv} stamp="Fatto" />
        <p className="lead" style={{ marginTop: 18 }}>
          Colazione conclusa. Presto ti chiederemo com'è andata.
        </p>
      </>
    );
  }
  return inv.status === "confirmed" ? (
    <Confirmed inv={inv} reload={reload} />
  ) : (
    <Pending inv={inv} reload={reload} cancelledCheckout={cancelledCheckout} />
  );
}

function CalendarButtons({ inv }: { inv: MyInvitation }) {
  return (
    <div className="button-row" style={{ marginTop: 12 }}>
      <Button variant="secondary" onClick={() => downloadIcs(inv)}>
        Aggiungi al calendario
      </Button>
      <a className="btn btn--secondary" href={googleCalendarUrl(inv)} target="_blank" rel="noopener noreferrer">
        Google Calendar
      </a>
    </div>
  );
}

function Pending({ inv, reload, cancelledCheckout }: ViewProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const price = formatCents(inv.priceCents);
  const failed = inv.payment?.status === "failed";

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      window.location.assign(await startBreakfastCheckout(inv.id));
    } catch (e) {
      setError(message(e));
      setNeedsSubscription(e instanceof ApiError && e.code === "subscription_required");
      setBusy(false);
    }
  }

  return (
    <>
      <Ticket inv={inv} />
      <CalendarButtons inv={inv} />
      {failed && (
        <div style={{ marginTop: 16 }}>
          <Notice tone="error">
            <b>Pagamento non riuscito</b>
            {inv.payment?.cardLast4 ? ` (carta che termina con ${inv.payment.cardLast4})` : ""}. Non ti abbiamo addebitato
            nulla. Il posto resta tuo fino a {formatDateTime(inv.respondBy)}.
          </Notice>
        </div>
      )}
      {cancelledCheckout && !failed && (
        <div style={{ marginTop: 16 }}>
          <Notice>Pagamento non completato. Non ti abbiamo addebitato nulla.</Notice>
        </div>
      )}
      <p className="deadline" style={{ margin: "18px 0 10px" }}>
        <span className="label-mono">Rispondi entro</span> {formatDateTime(inv.respondBy)}
      </p>
      {error && (
        <div style={{ marginBottom: 10 }}>
          <Notice tone="error">
            {error}
            {needsSubscription && (
              <>
                {" "}
                <Link to="/abbonamento" className="text-link" style={{ minHeight: 0, padding: 0 }}>
                  Attiva l'abbonamento
                </Link>
              </>
            )}
          </Notice>
        </div>
      )}
      <Button block loading={busy} onClick={pay}>
        {busy ? "Pagamento in corso…" : failed ? `Riprova · ${price}` : `Conferma e paga ${price}`}
      </Button>
      {failed && (
        <div style={{ marginTop: 10 }}>
          <Button variant="secondary" block disabled={busy} onClick={pay}>
            Usa un altro metodo
          </Button>
        </div>
      )}
      <p className="field__hint" style={{ textAlign: "center" }}>
        Paghi su Stripe, in modalità di prova: nessun addebito reale.
      </p>
      <CancelBlock inv={inv} reload={reload} />
    </>
  );
}

function Confirmed({ inv, reload }: { inv: MyInvitation; reload: () => Promise<void> }) {
  const [companions, setCompanions] = useState<{ firstName: string; job: string }[] | null>(null);
  useEffect(() => {
    fetchCompanions(inv.id)
      .then(setCompanions)
      .catch(() => setCompanions([]));
  }, [inv.id]);

  return (
    <>
      <Ticket inv={inv} stamp="Confermato" />
      <p className="lead" style={{ marginTop: 18 }}>
        Ci vediamo lì.{" "}
        {inv.payment?.status === "succeeded"
          ? `Pagato ${formatCents(inv.payment.amountCents)}${inv.payment.cardLast4 ? ` con la carta che termina con ${inv.payment.cardLast4}` : ""}.`
          : ""}
      </p>
      <CalendarButtons inv={inv} />
      <section style={{ marginTop: 26 }} aria-labelledby="companions-title">
        <h3 id="companions-title">Al tavolo con te</h3>
        {companions === null && <LoadingState />}
        {companions && companions.length === 0 && (
          <p style={{ color: "var(--ink-2)", marginTop: 8 }}>
            Nessun altro ha ancora confermato. Qui vedrai nome e lavoro di chi conferma.
          </p>
        )}
        {companions && companions.length > 0 && (
          <ul className="companions">
            {companions.map((c, i) => (
              <li key={i}>
                <span className="name">{c.firstName}</span>
                <span className="job">{c.job}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <CancelBlock inv={inv} reload={reload} />
    </>
  );
}

/** Disdetta sempre visibile, con conferma e testo su cosa succede ai soldi. */
function CancelBlock({ inv, reload }: { inv: MyInvitation; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const free = Date.now() < inv.freeCancellationUntil.getTime();
  const deadline = formatDateTime(inv.freeCancellationUntil);
  const paid = inv.payment?.status === "succeeded" ? inv.payment.amountCents : null;

  async function doCancel() {
    setBusy(true);
    setError(null);
    try {
      const r = await cancelInvitation(inv.id);
      if (r.refundFailed) {
        setError("Disdetta registrata, ma il rimborso non è partito in automatico: lo facciamo noi a mano entro 2 giorni lavorativi.");
      }
      await reload();
      window.scrollTo(0, 0);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  const money =
    paid === null
      ? "Non ti addebitiamo nulla."
      : free
        ? `Ti rimborsiamo ${formatCents(paid)} sulla carta usata, entro 5–10 giorni lavorativi.`
        : `La colazione non è più rimborsabile: perdi i ${formatCents(paid)} pagati.`;

  return (
    <div className="cancel-block">
      <p>
        {free ? (
          <>
            Non puoi più venire? Disdetta gratuita fino a <b>{deadline}</b> (12 ore prima).
          </>
        ) : paid !== null ? (
          <>La disdetta gratuita è terminata {deadline}. Puoi ancora disdire, ma senza rimborso.</>
        ) : (
          <>Non puoi più venire? Puoi ancora rifiutare l'invito: non hai pagato nulla.</>
        )}
      </p>
      {!open ? (
        <Button variant="danger" block onClick={() => setOpen(true)}>
          Disdici
        </Button>
      ) : (
        <div className="sheet" role="dialog" aria-labelledby="cancel-title">
          <h3 id="cancel-title">{inv.status === "pending" ? "Rifiuti l'invito?" : "Disdici la colazione?"}</h3>
          <p>
            {money} Il tuo posto passa a un'altra persona.
          </p>
          {free && paid !== null && (
            <p style={{ color: "var(--ink-2)", fontSize: 14 }}>Dopo {deadline} la colazione non è più rimborsabile.</p>
          )}
          {error && (
            <div style={{ marginTop: 10 }}>
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          <div className="button-row" style={{ marginTop: 14 }}>
            <Button variant="danger" loading={busy} onClick={doCancel}>
              Sì, disdici
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
              Torna all'invito
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
