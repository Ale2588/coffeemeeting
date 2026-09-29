import { useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { SiteHeader } from "../components/SiteHeader";
import { EmailLinkForm } from "../features/EmailLinkForm";
import { LinkSent } from "../features/LinkSent";

export function LoginPage() {
  const { session } = useAuth();
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (session) return <Navigate to="/account" replace />;

  return (
    <>
      <title>Accedi · CoffeeMeeting</title>
      <SiteHeader
        action={
          <Link to="/" className="text-link">
            Annulla
          </Link>
        }
      />
      <main id="contenuto">
        {sentTo ? (
          <LinkSent
            email={sentTo}
            allowNewUser={false}
            intro="Aprilo da questo telefono o da qualsiasi altro dispositivo per entrare. Se l'email non risulta iscritta, non arriva nulla."
            onChangeEmail={() => setSentTo(null)}
          />
        ) : (
          <div className="stack">
            <h1>Accedi</h1>
            <p className="lead">Scrivi la tua email: ti mandiamo un link per entrare. Niente password.</p>
            <EmailLinkForm submitLabel="Mandami il link" onSent={setSentTo} />
            <p className="field__hint">
              Non sei ancora iscritto?{" "}
              <Link to="/iscriviti" className="text-link">
                Iscriviti alla lista d'attesa
              </Link>
            </p>
          </div>
        )}
      </main>
    </>
  );
}
