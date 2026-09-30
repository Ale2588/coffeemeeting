import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Button, ButtonLink } from "../components/Button";
import { Notice } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { SiteHeader } from "../components/SiteHeader";
import { StatusTag } from "../components/StatusTag";
import { Ticket } from "../features/Ticket";
import { ApiError } from "../lib/api";
import { downloadIcs, googleCalendarUrl } from "../lib/calendar";
import { formatDateTime } from "../lib/dates";
import {
  cancelInvitation,
  confirmInvitation,
  fetchCompanions,
  fetchMyInvitations,
  isPast,
  type MyInvitation,
} from "../lib/invitations";

const GENERIC = "Qualcosa non ha funzionato. Riprova tra poco.";
const message = (e: unknown) => (e instanceof ApiError ? e.message : GENERIC);

export function InvitationPage() {
  const { id } = useParams();
  const [inv, setInv] = useState<MyInvitation | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchMyInvitations();
      setInv(list.find((i) => i.id === Number(id)) ?? null);
    } catch (e) {
      setError(message(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
        {inv && <InvitationView inv={inv} reload={load} />}
      </main>
    </>
  );
}

function InvitationView({ inv, reload }: { inv: MyInvitation; reload: () => Promise<void> }) {
  if (inv.meetupCancelled || inv.cancelledBy === "founder") {
    return (
      <>
        <Ticket inv={inv} voided />
        <div className="stack" style={{ marginTop: 18 }}>
          <StatusTag tone="warning">Tavolo annullato</StatusTag>
          <p className="lead">Abbiamo dovuto annullare questo tavolo. Non ti addebitiamo nulla. Il prossimo invito arriva come sempre.</p>
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
          <p className="lead">Hai disdetto questa colazione. Non ti addebitiamo nulla. Il prossimo invito arriva come sempre.</p>
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
  return inv.status === "confirmed" ? <Confirmed inv={inv} reload={reload} /> : <Pending inv={inv} reload={reload} />;
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

function Pending({ inv, reload }: { inv: MyInvitation; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await confirmInvitation(inv.id);
      await reload();
      window.scrollTo(0, 0);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  return (
    <>
      <Ticket inv={inv} />
      <CalendarButtons inv={inv} />
      <p className="deadline" style={{ margin: "18px 0 10px" }}>
        <span className="label-mono">Rispondi entro</span> {formatDateTime(inv.respondBy)}
      </p>
      {error && (
        <div style={{ marginBottom: 10 }}>
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <Button block loading={busy} onClick={confirm}>
        {busy ? "Conferma in corso…" : "Conferma la colazione"}
      </Button>
      <p className="field__hint" style={{ textAlign: "center" }}>
        Fase di prova: confermando non ti addebitiamo nulla.
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
        Ci vediamo lì. Nessun addebito: in questa fase di prova la colazione non si paga dall'app.
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

  async function doCancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelInvitation(inv.id);
      await reload();
      window.scrollTo(0, 0);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  return (
    <div className="cancel-block">
      <p>
        {free ? (
          <>
            Non puoi più venire? Disdetta gratuita fino a <b>{deadline}</b> (12 ore prima).
          </>
        ) : (
          <>
            La disdetta gratuita è terminata {deadline}. Puoi ancora disdire: in questa fase di prova non ti addebitiamo
            nulla.
          </>
        )}
      </p>
      {!open ? (
        <Button variant="danger" block onClick={() => setOpen(true)}>
          Disdici
        </Button>
      ) : (
        <div className="sheet" role="dialog" aria-labelledby="cancel-title">
          <h3 id="cancel-title">{inv.status === "pending" ? "Rifiuti l'invito?" : "Disdici la colazione?"}</h3>
          <p>Non ti addebitiamo nulla. Il tuo posto passa a un'altra persona.</p>
          {free && (
            <p style={{ color: "var(--ink-2)", fontSize: 14 }}>
              Regola: dopo {deadline} la colazione non è più rimborsabile.
            </p>
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
