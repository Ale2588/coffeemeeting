import { useState } from "react";
import { Button } from "../components/Button";
import { Notice } from "../components/Card";
import { ApiError } from "../lib/api";
import { addDaysIso, formatDateOnly, todayIso } from "../lib/dates";
import { closeAccount } from "../lib/subscription";

/** "Chiudi il mio account", con conferma e con cosa succede ai soldi e ai dati. */
export function CloseAccount({ onClosed, asLink }: { onClosed: () => void; asLink?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const purgeOn = formatDateOnly(addDaysIso(todayIso(), 30));

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await closeAccount();
      if (r.refundFailed > 0) {
        setError("Account chiuso, ma un rimborso non è partito in automatico: lo facciamo noi a mano entro 2 giorni lavorativi.");
        setBusy(false);
        setTimeout(onClosed, 4000);
        return;
      }
      onClosed();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Qualcosa non ha funzionato. Riprova tra poco.");
      setBusy(false);
    }
  }

  if (!open) {
    return asLink ? (
      <p style={{ textAlign: "center" }}>
        <button type="button" className="text-link" onClick={() => setOpen(true)}>
          Chiudi il mio account
        </button>
      </p>
    ) : (
      <Button variant="danger" block onClick={() => setOpen(true)}>
        Chiudi il mio account
      </Button>
    );
  }
  return (
    <div className="sheet" role="dialog" aria-labelledby="close-title">
      <h3 id="close-title">Chiudi l'account?</h3>
      <p>Da subito non ricevi più inviti. Le colazioni già confermate vengono disdette: se mancano più di 12 ore, ti rimborsiamo quanto pagato.</p>
      <p>Se hai un abbonamento, non si rinnova più: nessun altro addebito, nessun rimborso del periodo in corso.</p>
      <p style={{ color: "var(--ink-2)", fontSize: 14 }}>
        Nome, email e preferenze verranno cancellati {purgeOn}. Fino ad allora puoi riaprire l'account. Conserviamo solo i dati dei pagamenti
        che la legge ci obbliga a tenere.
      </p>
      {error && (
        <div style={{ marginTop: 10 }}>
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="button-row" style={{ marginTop: 14 }}>
        <Button variant="danger" loading={busy} onClick={confirm}>
          Sì, chiudi l'account
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
