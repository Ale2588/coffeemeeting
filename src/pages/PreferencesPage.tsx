import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/Button";
import { Notice } from "../components/Card";
import { ContactLink } from "../components/ContactLink";
import { LoadingState } from "../components/LoadingState";
import { SiteHeader } from "../components/SiteHeader";
import { PreferencesFields } from "../features/PreferencesFields";
import {
  focusFirstError,
  toPreferencesInput,
  validatePreferences,
  type PreferencesErrors,
  type PreferencesValues,
} from "../features/preferences";
import { useCatalog } from "../features/useCatalog";
import { useMyProfile } from "../features/useMyProfile";
import { ApiError, updateMyPreferences, type MyProfile, type Catalog } from "../lib/api";

export function PreferencesPage() {
  const { catalog, error: catalogError } = useCatalog();
  const { profile, loading, error } = useMyProfile();

  const loadError = catalogError ?? error;
  return (
    <>
      <title>Modifica preferenze · CoffeeMeeting</title>
      <SiteHeader
        action={
          <Link to="/account" className="text-link">
            Annulla
          </Link>
        }
      />
      <main id="contenuto">
        <h1>Modifica preferenze</h1>
        <div style={{ marginTop: 22 }}>
          {loadError && <Notice tone="error">{loadError}</Notice>}
          {!loadError && (loading || !catalog) && <LoadingState />}
          {!loadError && catalog && !loading && !profile && (
            <Notice>Non troviamo la tua iscrizione.</Notice>
          )}
          {!loadError && catalog && profile && <PreferencesForm catalog={catalog} profile={profile} />}
        </div>
      </main>
    </>
  );
}

function PreferencesForm({ catalog, profile }: { catalog: Catalog; profile: MyProfile }) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  // Zone o orari disattivati nel frattempo non compaiono tra le scelte.
  const [values, setValues] = useState<PreferencesValues>(() => ({
    firstName: profile.firstName,
    job: profile.job,
    format: profile.format,
    zoneIds: profile.zones.map((z) => z.id).filter((id) => catalog.zones.some((z) => z.id === id)),
    slotIds: profile.slots.map((s) => s.id).filter((id) => catalog.slots.some((s) => s.id === id)),
  }));
  const [errors, setErrors] = useState<PreferencesErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const change = (patch: Partial<PreferencesValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof PreferencesErrors];
      return next;
    });
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validatePreferences(values);
    setErrors(found);
    setSaveError(null);
    if (Object.keys(found).length > 0) {
      focusFirstError(formRef.current);
      return;
    }
    setSaving(true);
    try {
      await updateMyPreferences(toPreferencesInput(values));
      navigate("/account", { state: { flash: "Preferenze salvate." } });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Qualcosa non ha funzionato. Riprova tra poco.");
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="form-fields">
      <PreferencesFields catalog={catalog} values={values} errors={errors} onChange={change} />
      <p className="field__hint">
        Genere e anno di nascita non si modificano da qui. Se hai sbagliato, <ContactLink>scrivici</ContactLink>.
      </p>
      {saveError && <Notice tone="error">{saveError}</Notice>}
      <div className="form-actions">
        <Button type="submit" block loading={saving}>
          Salva preferenze
        </Button>
      </div>
    </form>
  );
}
