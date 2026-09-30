import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "../components/Button";
import { Notice } from "../components/Card";
import { SelectField, TextField } from "../components/Field";
import { LoadingState } from "../components/LoadingState";
import { Placeholder } from "../components/Placeholder";
import { SiteHeader } from "../components/SiteHeader";
import { LinkSent } from "../features/LinkSent";
import { PreferencesFields } from "../features/PreferencesFields";
import {
  focusFirstError,
  toPreferencesInput,
  validatePreferences,
  type PreferencesErrors,
  type PreferencesValues,
} from "../features/preferences";
import { useCatalog } from "../features/useCatalog";
import { ApiError, sendMagicLink, submitSignup, type Gender } from "../lib/api";
import { currentYear } from "../lib/dates";
import { GENDER_OPTIONS } from "../lib/labels";

type Values = PreferencesValues & { email: string; gender: Gender | ""; birthYear: string };
type Errors = PreferencesErrors & Partial<Record<"email" | "gender" | "birthYear", string>>;

const EMPTY: Values = { firstName: "", email: "", job: "", zoneIds: [], slotIds: [], format: "", gender: "", birthYear: "" };

function validate(v: Values): Errors {
  const errors: Errors = validatePreferences(v);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) errors.email = "Controlla l'indirizzo email.";
  if (!v.gender) errors.gender = "Scegli un'opzione.";
  const year = Number(v.birthYear);
  const now = currentYear();
  if (!/^\d{4}$/.test(v.birthYear.trim())) errors.birthYear = "Scrivi l'anno con quattro cifre.";
  else if (year > now - 18) errors.birthYear = "Per iscriverti devi essere maggiorenne.";
  else if (year < now - 100) errors.birthYear = "Controlla l'anno di nascita.";
  return errors;
}

export function SignupPage() {
  const { catalog, error: catalogError } = useCatalog();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const change = (patch: Partial<Values>) => {
    setValues((v) => ({ ...v, ...patch }));
    // Un campo corretto perde subito il suo messaggio d'errore.
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof Errors];
      return next;
    });
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0) {
      focusFirstError(formRef.current);
      return;
    }
    setSubmitting(true);
    try {
      const email = values.email.trim().toLowerCase();
      await submitSignup({
        ...toPreferencesInput(values),
        email,
        gender: values.gender as Gender,
        birthYear: Number(values.birthYear),
      });
      await sendMagicLink(email, { allowNewUser: true });
      setSentTo(email);
      window.scrollTo(0, 0);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Qualcosa non ha funzionato. Riprova tra poco.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <title>Iscriviti · CoffeeMeeting</title>
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
            allowNewUser
            intro="Aprilo per confermare l'email: da lì entri in lista d'attesa. Se eri già iscritto, il link ti porta alla tua pagina."
            onChangeEmail={() => setSentTo(null)}
          />
        ) : (
          <>
            <h1>Iscriviti</h1>
            <p className="lead" style={{ marginTop: 8 }}>
              Serve un minuto. Entri in lista d'attesa e ti scriviamo quando la tua zona si apre.
            </p>
            {catalogError && (
              <div style={{ marginTop: 22 }}>
                <Notice tone="error">{catalogError}</Notice>
              </div>
            )}
            {!catalog && !catalogError && <LoadingState />}
            {catalog && (
              <form ref={formRef} noValidate onSubmit={onSubmit} className="form-fields" style={{ marginTop: 22 }}>
                <PreferencesFields catalog={catalog} values={values} errors={errors} onChange={change} />
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={values.email}
                  onChange={(e) => change({ email: e.target.value })}
                  hint="Ti mandiamo un link per confermarla. Niente password."
                  error={errors.email}
                />
                <div>
                  <div className="field-row">
                    <SelectField
                      label="Genere"
                      placeholder="Scegli"
                      options={GENDER_OPTIONS}
                      value={values.gender}
                      onChange={(e) => change({ gender: e.target.value as Gender | "" })}
                      error={errors.gender}
                    />
                    <TextField
                      label="Anno di nascita"
                      inputMode="numeric"
                      autoComplete="bday-year"
                      maxLength={4}
                      placeholder="AAAA"
                      value={values.birthYear}
                      onChange={(e) => change({ birthYear: e.target.value.replace(/\D/g, "") })}
                      error={errors.birthYear}
                    />
                  </div>
                  <p className="field__hint">Servono solo a comporre tavoli equilibrati. Nessun iscritto li vedrà.</p>
                </div>
                <Notice>
                  Iscrivendoti accetti le regole della comunità e l'informativa privacy{" "}
                  <Placeholder>TESTI DA FORNIRE</Placeholder>. Non paghi nulla adesso.
                </Notice>
                {submitError && <Notice tone="error">{submitError}</Notice>}
                <div className="form-actions">
                  <Button type="submit" block loading={submitting}>
                    Entra in lista d'attesa
                  </Button>
                  <p className="field__hint" style={{ textAlign: "center" }}>
                    Sei già iscritto?{" "}
                    <Link to="/accedi" className="text-link">
                      Accedi
                    </Link>
                  </p>
                </div>
              </form>
            )}
          </>
        )}
      </main>
    </>
  );
}
