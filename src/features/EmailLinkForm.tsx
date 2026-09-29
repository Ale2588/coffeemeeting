import { useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { Notice } from "../components/Card";
import { TextField } from "../components/Field";
import { ApiError, sendMagicLink } from "../lib/api";

type Props = { submitLabel: string; initialEmail?: string; onSent: (email: string) => void };

/** Inserimento email per ricevere il link di accesso (solo iscritti esistenti). */
export function EmailLinkForm({ submitLabel, initialEmail = "", onSent }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setFieldError("Controlla l'indirizzo email.");
      return;
    }
    setFieldError(null);
    setError(null);
    setSending(true);
    try {
      await sendMagicLink(clean, { allowNewUser: false });
      onSent(clean);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Qualcosa non ha funzionato. Riprova tra poco.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="form-fields">
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldError}
        hint="Quella che hai usato per iscriverti."
      />
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" block loading={sending}>
        {submitLabel}
      </Button>
    </form>
  );
}
