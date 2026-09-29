import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { LoadingState } from "../components/LoadingState";
import { SiteHeader } from "../components/SiteHeader";
import { StatusTag } from "../components/StatusTag";
import { EmailLinkForm } from "../features/EmailLinkForm";
import { LinkSent } from "../features/LinkSent";
import { PILOT } from "../config/pilot";
import { INITIAL_URL_PARAMS } from "../lib/initialUrl";

const WAIT_FOR_SESSION_MS = 5000;

/** Arrivo dal link via email: entra nell'account, oppure mostra "link scaduto". */
export function AuthCallbackPage() {
  const { session, loading } = useAuth();
  const linkError = INITIAL_URL_PARAMS.get("error_code") ?? INITIAL_URL_PARAMS.get("error");
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (linkError) return;
    const t = setTimeout(() => setTimedOut(true), WAIT_FOR_SESSION_MS);
    return () => clearTimeout(t);
  }, [linkError]);

  if (session) return <Navigate to="/account" replace />;
  if (!linkError && (loading || !timedOut)) {
    return (
      <>
        <title>Accesso · CoffeeMeeting</title>
        <SiteHeader />
        <main id="contenuto">
          <LoadingState label="Ti stiamo facendo entrare…" />
        </main>
      </>
    );
  }
  return <LinkExpired />;
}

function LinkExpired() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  return (
    <>
      <title>Link scaduto · CoffeeMeeting</title>
      <SiteHeader />
      <main id="contenuto">
        {sentTo ? (
          <LinkSent
            email={sentTo}
            allowNewUser={false}
            intro="Aprilo per entrare. Se l'email non risulta iscritta, non arriva nulla."
            onChangeEmail={() => setSentTo(null)}
          />
        ) : (
          <div className="stack">
            <StatusTag tone="warning">Link scaduto</StatusTag>
            <h1>Questo link non vale più.</h1>
            <p className="lead">
              I link di accesso valgono {PILOT.loginLinkValidityMinutes / 60 === 1 ? "un'ora" : `${PILOT.loginLinkValidityMinutes} minuti`}{" "}
              e funzionano una volta sola. Chiedine uno nuovo: arriva in un minuto.
            </p>
            <EmailLinkForm submitLabel="Mandami un nuovo link" onSent={setSentTo} />
          </div>
        )}
      </main>
    </>
  );
}
