import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../components/Button";
import { Notice } from "../components/Card";
import { PILOT } from "../config/pilot";
import { ApiError, sendMagicLink } from "../lib/api";
import { formatDateTime } from "../lib/dates";

type Props = {
  email: string;
  allowNewUser: boolean;
  intro: ReactNode;
  onChangeEmail: () => void;
};

const RESEND_COOLDOWN_S = 60;

/** "Ti abbiamo mandato un link": scadenza con giorno e ora, reinvio, cambio email. */
export function LinkSent({ email, allowNewUser, intro, onChangeEmail }: Props) {
  const [sentAt, setSentAt] = useState(() => new Date());
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const waitS = Math.max(0, RESEND_COOLDOWN_S - Math.floor((now - sentAt.getTime()) / 1000));
  useEffect(() => {
    if (waitS === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitS]);

  const expiresAt = new Date(sentAt.getTime() + PILOT.loginLinkValidityMinutes * 60_000);

  async function resend() {
    setSending(true);
    setError(null);
    try {
      await sendMagicLink(email, { allowNewUser });
      setSentAt(new Date());
      setNow(Date.now());
      setResent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Qualcosa non ha funzionato. Riprova tra poco.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="stack">
      <p className="label-mono">Controlla la posta</p>
      <h1>Ti abbiamo mandato un link.</h1>
      <p className="lead">{intro}</p>
      <p>
        L'abbiamo inviato a <b>{email}</b>. Funziona una volta sola e vale fino a{" "}
        <b>{formatDateTime(expiresAt)}</b>.
      </p>
      {resent && !error && (
        <p role="status" className="field__hint">
          Nuovo link inviato. Quello precedente non vale più.
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <p className="field__hint">Non lo trovi? Controlla anche nella posta indesiderata.</p>
      <div className="form-actions">
        <Button variant="secondary" block loading={sending} disabled={waitS > 0} onClick={resend}>
          {waitS > 0 ? `Mandane un altro tra ${waitS} s` : "Mandane un altro"}
        </Button>
        <Button variant="secondary" block onClick={onChangeEmail}>
          Usa un'altra email
        </Button>
      </div>
    </div>
  );
}
