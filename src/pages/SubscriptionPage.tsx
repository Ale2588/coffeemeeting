import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/Button";
import { Notice } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { SiteHeader } from "../components/SiteHeader";
import { CloseAccount } from "../features/CloseAccount";
import { ApiError } from "../lib/api";
import { formatDateOnly } from "../lib/dates";
import { formatCents } from "../lib/format";
import {
  fetchMySubscription,
  openBillingPortal,
  remindLater,
  startSubscriptionCheckout,
  type MySubscription,
  type Plan,
} from "../lib/subscription";

const message = (e: unknown) => (e instanceof ApiError ? e.message : "Qualcosa non ha funzionato. Riprova tra poco.");

/** Proposta di abbonamento (feedback, punto 1): tre opzioni. */
export function SubscriptionPage() {
  const navigate = useNavigate();
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [plan, setPlan] = useState<Plan>("monthly");
  const [busy, setBusy] = useState<"pay" | "later" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMySubscription()
      .then(setSub)
      .catch((e) => setError(message(e)));
  }, []);

  async function run(kind: "pay" | "later" | "portal") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "pay") window.location.assign(await startSubscriptionCheckout(plan));
      if (kind === "portal") window.location.assign(await openBillingPortal());
      if (kind === "later") {
        const on = await remindLater();
        navigate("/account", { state: { flash: `Va bene: te lo riproponiamo ${formatDateOnly(on)}. Intanto non ricevi nuovi inviti.` } });
      }
    } catch (e) {
      setError(message(e));
      setBusy(null);
    }
  }

  const monthly = sub ? formatCents(sub.monthlyCents) : "";
  const yearly = sub ? formatCents(sub.yearlyCents) : "";
  const perMonth = sub ? formatCents(Math.round(sub.yearlyCents / 12)) : "";

  return (
    <>
      <title>Abbonamento · CoffeeMeeting</title>
      <SiteHeader
        action={
          <Link to="/account" className="text-link">
            Il mio account
          </Link>
        }
      />
      <main id="contenuto">
        {error && <Notice tone="error">{error}</Notice>}
        {!sub && !error && <LoadingState />}
        {sub?.active && (
          <div className="stack">
            <h1>Il tuo abbonamento è attivo.</h1>
            <p className="lead">Carta, ricevute e disdetta si gestiscono sul portale di Stripe.</p>
            <Button variant="secondary" block loading={busy === "portal"} onClick={() => run("portal")}>
              Gestisci l'abbonamento
            </Button>
          </div>
        )}
        {sub && !sub.active && (
          <div className="stack">
            {sub.confirmedBreakfasts >= 1 && <p className="label-mono">La tua prima colazione è fatta</p>}
            <h1>Vuoi continuare?</h1>
            <p className="lead">
              Con l'abbonamento ricevi inviti nei tuoi orari. La colazione la paghi a parte, ogni volta che confermi.
            </p>
            <div className="plans" role="group" aria-label="Piano">
              <button type="button" className="plan" aria-pressed={plan === "monthly"} onClick={() => setPlan("monthly")}>
                <span>
                  <b>Mensile</b>
                  <br />
                  <small>Disdici quando vuoi: resta attivo fino alla fine del mese pagato</small>
                </span>
                <span className="plan__price">{monthly}</span>
              </button>
              <button type="button" className="plan" aria-pressed={plan === "yearly"} onClick={() => setPlan("yearly")}>
                <span>
                  <b>Annuale</b>
                  <br />
                  <small>Circa {perMonth} al mese</small>
                </span>
                <span className="plan__price">{yearly}</span>
              </button>
            </div>
            <Button block loading={busy === "pay"} disabled={busy !== null} onClick={() => run("pay")}>
              {`Attiva l'abbonamento · ${plan === "monthly" ? `${monthly} al mese` : `${yearly} all'anno`}`}
            </Button>
            <p className="field__hint" style={{ textAlign: "center" }}>
              Paghi su Stripe, in modalità di prova: nessun addebito reale. Si rinnova da solo finché non lo disdici.
            </p>
            <Button variant="secondary" block loading={busy === "later"} disabled={busy !== null} onClick={() => run("later")}>
              Non ora, ricordamelo tra una settimana
            </Button>
            <CloseAccount asLink onClosed={() => navigate("/account", { replace: true })} />
          </div>
        )}
      </main>
    </>
  );
}
