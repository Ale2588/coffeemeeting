import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { Button, ButtonLink } from "../components/Button";
import { Card, Notice } from "../components/Card";
import { ContactLink } from "../components/ContactLink";
import { TextField } from "../components/Field";
import { LoadingState } from "../components/LoadingState";
import { SiteHeader } from "../components/SiteHeader";
import { StatusTag } from "../components/StatusTag";
import { useMyProfile } from "../features/useMyProfile";
import { ApiError, setInvitePause, signOut, type MyProfile } from "../lib/api";
import { addDaysIso, formatDateOnly, formatDateTime, formatDayTitle, formatTime, todayIso } from "../lib/dates";
import { breakfastsDone, fetchMyInvitations, isPast, type MyInvitation } from "../lib/invitations";
import { formatCents, slotLabel } from "../lib/format";
import { CloseAccount } from "../features/CloseAccount";
import {
  fetchMySubscription,
  openBillingPortal,
  reopenAccount,
  subscriptionView,
  type MySubscription,
} from "../lib/subscription";
import { FORMAT_LABEL } from "../lib/labels";

export function MemberPage() {
  const { profile, loading, error, reload } = useMyProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;

  async function logout() {
    await signOut();
    navigate("/", { replace: true });
  }

  const header = (
    <SiteHeader
      action={
        <span className="header-actions">
          {profile?.role === "founder" && (
            <Link to="/pannello" className="text-link">
              Pannello
            </Link>
          )}
          <button type="button" className="text-link" onClick={logout}>
            Esci
          </button>
        </span>
      }
    />
  );

  let body;
  if (loading) body = <LoadingState />;
  else if (error) body = <Notice tone="error">{error}</Notice>;
  else if (!profile) body = <NoProfile />;
  else
    body = (
      <>
        {flash && (
          <div style={{ marginBottom: 18 }}>
            <Notice>
              <span role="status">{flash}</span>
            </Notice>
          </div>
        )}
        <ProfileByStatus profile={profile} onChanged={reload} />
      </>
    );

  return (
    <>
      <title>Il mio account · CoffeeMeeting</title>
      {header}
      <main id="contenuto">{body}</main>
    </>
  );
}

function ProfileByStatus({ profile, onChanged }: { profile: MyProfile; onChanged: () => Promise<void> }) {
  switch (profile.status) {
    case "waitlisted":
      return <Waitlisted profile={profile} onChanged={onChanged} />;
    case "active":
    case "warned":
      return <Active profile={profile} onChanged={onChanged} />;
    case "suspended":
      return <Suspended />;
    case "expelled":
      return <Closed title="Il tuo account è chiuso." text="Non riceverai più inviti. Se vuoi chiarire, puoi scriverci." />;
    case "rejected":
      return (
        <Closed
          title="Per ora non possiamo accoglierti."
          text="La tua iscrizione non è stata accettata. Se pensi che sia un errore, scrivici."
        />
      );
    case "closed":
      return <AccountClosed profile={profile} onChanged={onChanged} />;
  }
}

function AccountClosed({ profile, onChanged }: { profile: MyProfile; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const purgeOn = profile.closedAt ? addDaysIso(profile.closedAt.slice(0, 10), 30) : null;
  const canReopen = purgeOn !== null && purgeOn > todayIso();

  async function reopen() {
    setBusy(true);
    setError(null);
    try {
      await reopenAccount();
      await onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Qualcosa non ha funzionato. Riprova tra poco.");
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <StatusTag tone="neutral">Account chiuso</StatusTag>
      <h1>Hai chiuso l'account.</h1>
      <p className="lead">
        Non ricevi più inviti e non ti addebitiamo più nulla.
        {purgeOn && ` Nome, email e preferenze verranno cancellati ${formatDateOnly(purgeOn)}.`}
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      {canReopen && (
        <>
          <p>Ci hai ripensato? Fino ad allora puoi riaprirlo com'era.</p>
          <Button variant="secondary" block loading={busy} onClick={reopen}>
            Riapri l'account
          </Button>
        </>
      )}
    </div>
  );
}

function PreferencesSummary({ profile }: { profile: MyProfile }) {
  return (
    <Card>
      <dl className="kv">
        <dt>Zone</dt>
        <dd>{profile.zones.map((z) => z.name).join(", ") || "Nessuna"}</dd>
        <dt>Orari</dt>
        <dd>{profile.slots.map(slotLabel).join(", ") || "Nessuno"}</dd>
        <dt>Formato</dt>
        <dd>{FORMAT_LABEL[profile.format]}</dd>
        <dt>Lavoro</dt>
        <dd>{profile.job}</dd>
      </dl>
    </Card>
  );
}

/** A3 — Lista d'attesa. Nessuna posizione in coda. */
function Waitlisted({ profile, onChanged }: { profile: MyProfile; onChanged: () => Promise<void> }) {
  return (
    <div className="stack">
      <StatusTag tone="neutral">In lista d'attesa</StatusTag>
      <h1>Ci sei, {profile.firstName}.</h1>
      <p className="lead">
        Apriamo una zona quando ci sono abbastanza persone negli stessi orari. Ti scriviamo appena arriva il tuo primo
        invito.
      </p>
      <PreferencesSummary profile={profile} />
      <ButtonLink to="/account/preferenze" variant="secondary" block>
        Modifica preferenze
      </ButtonLink>
      <CloseAccount asLink onClosed={() => void onChanged()} />
    </div>
  );
}

/** Pagina iniziale dell'iscritto attivo. Inviti, colazioni e abbonamento arrivano con le fasi 4 e 5. */
function Active({ profile, onChanged }: { profile: MyProfile; onChanged: () => Promise<void> }) {
  const paused = profile.invitesResumeOn !== null && profile.invitesResumeOn > todayIso();
  return (
    <>
      <div className="stack">
        <h1>Ciao, {profile.firstName}.</h1>
        <div className="pills">
          {paused ? <StatusTag tone="neutral">Inviti in pausa</StatusTag> : <StatusTag>Attivo</StatusTag>}
        </div>
      </div>

      <section className="section" style={{ marginTop: 14 }} aria-labelledby="invites-title">
        <h3 id="invites-title">Prossimi inviti</h3>
        <UpcomingInvitations paused={paused} resumeOn={profile.invitesResumeOn} />
      </section>

      <section className="section stack" aria-labelledby="sub-title">
        <h3 id="sub-title">Abbonamento</h3>
        <SubscriptionSection />
      </section>

      <section className="section stack" aria-labelledby="prefs-title">
        <h3 id="prefs-title">Le tue preferenze</h3>
        <PreferencesSummary profile={profile} />
        <ButtonLink to="/account/preferenze" variant="secondary" block>
          Modifica preferenze
        </ButtonLink>
      </section>

      <section className="section stack" aria-labelledby="pause-title">
        <h3 id="pause-title">Pausa</h3>
        <PauseControl paused={paused} onChanged={onChanged} />
      </section>

      <section className="section stack" aria-labelledby="close-title-section">
        <h3 id="close-title-section">Chiudere l'account</h3>
        <CloseAccount onClosed={() => void onChanged()} />
      </section>
    </>
  );
}

const SUB_POLL_MS = 2000;
const SUB_POLL_MAX = 10;

/** Stato dell'abbonamento con l'azione giusta: attiva, rinnova, gestisci. */
function SubscriptionSection() {
  const [params, setParams] = useSearchParams();
  const justPaid = params.get("abbonamento") === "attivato";
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let n = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = () =>
      fetchMySubscription()
        .then((s) => {
          setSub(s);
          // Ritorno da Stripe: l'attivazione arriva dal webhook, di solito in pochi secondi.
          if (justPaid && (s.active || ++n >= SUB_POLL_MAX)) {
            clearInterval(timer);
            setParams({}, { replace: true });
          }
        })
        .catch(() => setError("Impossibile caricare l'abbonamento."));
    void load();
    if (justPaid) timer = setInterval(load, SUB_POLL_MS);
    return () => clearInterval(timer);
  }, [justPaid, setParams]);

  async function portal() {
    setBusy(true);
    try {
      window.location.assign(await openBillingPortal());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Qualcosa non ha funzionato. Riprova tra poco.");
      setBusy(false);
    }
  }

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!sub) return <LoadingState />;
  if (justPaid && !sub.active) return <LoadingState label="Pagamento ricevuto da Stripe: stiamo attivando l'abbonamento…" />;

  const v = subscriptionView(sub);
  const planLabel = (p: "monthly" | "yearly") => (p === "monthly" ? "mensile" : "annuale");
  const manage = (
    <Button variant="secondary" block loading={busy} onClick={portal}>
      Gestisci l'abbonamento
    </Button>
  );

  switch (v.kind) {
    case "not_needed":
      return (
        <p style={{ color: "var(--ink-2)" }}>
          La prima colazione non lo richiede: la paghi e basta. Dopo, se vuoi continuare, ti proponiamo l'abbonamento (
          {formatCents(sub.monthlyCents)} al mese o {formatCents(sub.yearlyCents)} all'anno).
        </p>
      );
    case "inactive":
      return (
        <>
          <div className="pills">
            <StatusTag tone="warning">Abbonamento non attivo</StatusTag>
          </div>
          <p style={{ color: "var(--ink-2)" }}>
            Dalla seconda colazione serve l'abbonamento: senza, non ricevi nuovi inviti.
            {sub.reminderOn && ` Te lo riproponiamo ${formatDateOnly(sub.reminderOn)}.`}
          </p>
          <ButtonLink to="/abbonamento" block>
            Attiva
          </ButtonLink>
        </>
      );
    case "expired":
      return (
        <>
          <div className="pills">
            <StatusTag tone="warning">Abbonamento scaduto</StatusTag>
          </div>
          <p style={{ color: "var(--ink-2)" }}>Senza abbonamento non ricevi nuovi inviti.</p>
          <ButtonLink to="/abbonamento" block>
            Rinnova
          </ButtonLink>
        </>
      );
    case "active":
      return (
        <>
          <div className="pills">
            <StatusTag>Abbonamento attivo · {planLabel(v.plan)}</StatusTag>
          </div>
          {v.renewsOn && <p style={{ color: "var(--ink-2)" }}>Si rinnova {formatDateTime(v.renewsOn)}.</p>}
          {manage}
        </>
      );
    case "ending":
      return (
        <>
          <div className="pills">
            <StatusTag tone="neutral">Attivo fino alla scadenza · {planLabel(v.plan)}</StatusTag>
          </div>
          <p style={{ color: "var(--ink-2)" }}>
            Hai disdetto: resta attivo {v.endsOn ? `fino a ${formatDateTime(v.endsOn)}` : "fino alla fine del periodo pagato"}, poi
            non si rinnova e non ti addebitiamo più nulla.
          </p>
          {manage}
        </>
      );
    case "past_due":
      return (
        <>
          <div className="pills">
            <StatusTag tone="warning">Rinnovo non riuscito</StatusTag>
          </div>
          <p style={{ color: "var(--ink-2)" }}>
            Il pagamento del rinnovo non è andato a buon fine. Aggiorna la carta: Stripe riprova l'addebito nei prossimi giorni.
          </p>
          {manage}
        </>
      );
  }
}

function UpcomingInvitations({ paused, resumeOn }: { paused: boolean; resumeOn: string | null }) {
  const [list, setList] = useState<MyInvitation[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetchMyInvitations()
      .then(setList)
      .catch(() => setError(true));
  }, []);

  if (error) return <Notice tone="error">Impossibile caricare gli inviti. Ricarica la pagina.</Notice>;
  if (!list) return <LoadingState />;

  const upcoming = list
    .filter((i) => !isPast(i) && !i.meetupCancelled && (i.status === "pending" || i.status === "confirmed"))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const done = breakfastsDone(list);

  return (
    <>
      {upcoming.length === 0 ? (
        <p style={{ color: "var(--ink-2)", marginTop: 8 }}>
          {paused && resumeOn
            ? `Inviti in pausa: ripartono da ${formatDateOnly(resumeOn)}.`
            : "Nessun invito per ora. Ti scriviamo appena ne arriva uno."}
        </p>
      ) : (
        <ul className="invite-list">
          {upcoming.map((i) => (
            <li key={i.id}>
              <Link to={`/invito/${i.id}`} className="invite-row">
                <span>
                  <span className="invite-row__when">
                    {formatDayTitle(i.startsAt)}, {formatTime(i.startsAt)}
                  </span>
                  <br />
                  <span className="invite-row__where">
                    {i.venueName ?? i.zoneName}
                    {i.status === "pending" && ` · rispondi entro ${formatDateTime(i.respondBy)}`}
                  </span>
                </span>
                {i.status === "confirmed" ? (
                  <StatusTag>Confermato</StatusTag>
                ) : (
                  <StatusTag tone="warning">Da confermare</StatusTag>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <dl className="kv" style={{ marginTop: 16 }}>
        <dt>Colazioni fatte</dt>
        <dd>{done}</dd>
      </dl>
    </>
  );
}

function PauseControl({ paused, onChanged }: { paused: boolean; onChanged: () => Promise<void> }) {
  const tomorrow = addDaysIso(todayIso(), 1);
  const maxDate = addDaysIso(todayIso(), 365);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(addDaysIso(todayIso(), 14));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(resumeOn: string | null) {
    if (resumeOn !== null && (resumeOn < tomorrow || resumeOn > maxDate)) {
      setError("Scegli una data tra domani e un anno da oggi.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setInvitePause(resumeOn);
      await onChanged();
      setOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Qualcosa non ha funzionato. Riprova tra poco.");
    } finally {
      setBusy(false);
    }
  }

  if (paused) {
    return (
      <>
        {error && <Notice tone="error">{error}</Notice>}
        <Button variant="secondary" block loading={busy} onClick={() => apply(null)}>
          Riprendi gli inviti da oggi
        </Button>
      </>
    );
  }
  if (!open) {
    return (
      <>
        <p style={{ color: "var(--ink-2)" }}>Vai in vacanza o hai settimane piene? Fermi gli inviti fino a una data.</p>
        <Button variant="secondary" block onClick={() => setOpen(true)}>
          Metti in pausa gli inviti
        </Button>
      </>
    );
  }
  return (
    <>
      <TextField
        label="Riprendi gli inviti da"
        type="date"
        min={tomorrow}
        max={maxDate}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        hint={date ? `Fino ad allora non ricevi inviti. Ripartono da ${formatDateOnly(date)}.` : undefined}
        error={error}
      />
      <div className="button-row">
        <Button loading={busy} onClick={() => apply(date)}>
          Conferma la pausa
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Annulla
        </Button>
      </div>
    </>
  );
}

/** S4 — Account sospeso (testi definitivi con la fase 6). */
function Suspended() {
  return (
    <div className="stack">
      <StatusTag tone="warning">Account sospeso</StatusTag>
      <h1>Per ora non riceverai inviti.</h1>
      <p className="lead">
        Chi ha segnalato resta anonimo. Puoi dirci la tua: ogni caso lo legge una persona. Le colazioni già pagate ti
        vengono rimborsate.
      </p>
      <p>
        <ContactLink />
      </p>
    </div>
  );
}

function Closed({ title, text }: { title: string; text: string }) {
  return (
    <div className="stack">
      <StatusTag tone="warning">Account non attivo</StatusTag>
      <h1>{title}</h1>
      <p className="lead">{text}</p>
      <p>
        <ContactLink />
      </p>
    </div>
  );
}

function NoProfile() {
  return (
    <div className="stack">
      <h1>Non troviamo la tua iscrizione.</h1>
      <p className="lead">
        Hai confermato l'email, ma non risulta un modulo di iscrizione collegato. Compilalo con la stessa email: bastano
        un paio di minuti.
      </p>
      <ButtonLink to="/iscriviti" block>
        Iscriviti alla lista d'attesa
      </ButtonLink>
      <p className="field__hint">
        Pensi sia un errore? <ContactLink />
      </p>
      <Link to="/" className="text-link">
        Torna alla home
      </Link>
    </div>
  );
}
