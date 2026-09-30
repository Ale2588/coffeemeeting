import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button, ButtonLink } from "../components/Button";
import { Card, Notice } from "../components/Card";
import { ContactLink } from "../components/ContactLink";
import { TextField } from "../components/Field";
import { LoadingState } from "../components/LoadingState";
import { SiteHeader } from "../components/SiteHeader";
import { StatusTag } from "../components/StatusTag";
import { useMyProfile } from "../features/useMyProfile";
import { ApiError, setInvitePause, signOut, type MyProfile } from "../lib/api";
import { addDaysIso, formatDateOnly, todayIso } from "../lib/dates";
import { slotLabel } from "../lib/format";
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
      return <Waitlisted profile={profile} />;
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
  }
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
function Waitlisted({ profile }: { profile: MyProfile }) {
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
        <p style={{ color: "var(--ink-2)", marginTop: 8 }}>
          {paused
            ? `Inviti in pausa: ripartono da ${formatDateOnly(profile.invitesResumeOn!)}.`
            : "Nessun invito per ora. Ti scriviamo appena ne arriva uno."}
        </p>
      </section>

      <section className="section" aria-labelledby="sub-title">
        <h3 id="sub-title">Abbonamento</h3>
        <p style={{ color: "var(--ink-2)", marginTop: 8 }}>
          La prima colazione non lo richiede: la paghi e basta. Dopo, se vuoi continuare, ti proponiamo l'abbonamento.
        </p>
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
