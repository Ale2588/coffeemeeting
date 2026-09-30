import { useCallback, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "../components/Button";
import { Notice } from "../components/Card";
import { Checkbox, FieldGroup, SelectField, TextField } from "../components/Field";
import { LoadingState } from "../components/LoadingState";
import { OptionCard, OptionGroup } from "../components/OptionCard";
import { useToast } from "../components/Toast";
import { toggleId } from "../features/preferences";
import { ApiError } from "../lib/api";
import { formatSlotTime, weekdayName } from "../lib/format";
import { fetchVenues, saveVenue, type Venue, type VenueInput } from "./founderApi";
import { useFounder } from "./FounderLayout";
import { useAsync } from "./useAsync";

const EMPTY: VenueInput = { id: null, name: "", address: "", zoneId: 0, notes: "", active: true, slotIds: [] };

export function VenueFormPage() {
  const { id } = useParams();
  const isNew = id === undefined;
  const load = useCallback(async (): Promise<Venue | null> => {
    if (isNew) return null;
    return (await fetchVenues()).find((v) => v.id === Number(id)) ?? null;
  }, [id, isNew]);
  const { data, error, loading } = useAsync(load);

  return (
    <>
      <title>{`${isNew ? "Nuovo locale" : "Modifica locale"} · Pannello · CoffeeMeeting`}</title>
      <div className="admin__toolbar">
        <h2>{isNew ? "Nuovo locale" : "Modifica locale"}</h2>
        <Link to="/pannello/locali" className="text-link">
          Torna ai locali
        </Link>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {loading && <LoadingState />}
      {!loading && !error && !isNew && !data && <Notice tone="error">Locale non trovato.</Notice>}
      {!loading && !error && (isNew || data) && <VenueForm initial={data ?? EMPTY} />}
    </>
  );
}

type Errors = Partial<Record<"name" | "address" | "zoneId" | "notes", string>>;

function VenueForm({ initial }: { initial: VenueInput }) {
  const { catalog } = useFounder();
  const navigate = useNavigate();
  const toast = useToast();
  const [v, setV] = useState<VenueInput>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const change = (patch: Partial<VenueInput>) => {
    setV((x) => ({ ...x, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof Errors];
      return next;
    });
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found: Errors = {};
    if (!v.name.trim()) found.name = "Scrivi il nome del locale.";
    if (!v.address.trim()) found.address = "Scrivi l'indirizzo.";
    if (!v.zoneId) found.zoneId = "Scegli la zona.";
    if (v.notes.length > 1000) found.notes = "Al massimo 1000 caratteri.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveVenue({ ...v, name: v.name.trim(), address: v.address.trim(), notes: v.notes.trim() });
      toast(v.id === null ? `Locale "${v.name.trim()}" aggiunto.` : `Locale "${v.name.trim()}" salvato.`);
      navigate("/pannello/locali");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Qualcosa non ha funzionato. Riprova.");
      setSaving(false);
    }
  }

  // Zone e slot disattivati restano selezionabili solo se il locale li usa già.
  const zones = catalog.zones.filter((z) => z.active || z.id === initial.zoneId);
  const slots = catalog.slots.filter((s) => s.active || initial.slotIds.includes(s.id));

  return (
    <form noValidate onSubmit={onSubmit} className="form-fields" style={{ maxWidth: 560 }}>
      <TextField label="Nome" value={v.name} maxLength={120} onChange={(e) => change({ name: e.target.value })} error={errors.name} />
      <TextField
        label="Indirizzo"
        value={v.address}
        maxLength={200}
        onChange={(e) => change({ address: e.target.value })}
        hint="Via e numero civico, come comparirà nell'invito."
        error={errors.address}
      />
      <SelectField
        label="Zona"
        placeholder="Scegli"
        options={zones.map((z) => ({ value: String(z.id), label: z.name }))}
        value={v.zoneId ? String(v.zoneId) : ""}
        onChange={(e) => change({ zoneId: Number(e.target.value) })}
        error={errors.zoneId}
      />
      <FieldGroup label="Slot disponibili" hint="In quali orari il locale può ospitare un tavolo.">
        {({ labelId, describedBy }) => (
          <OptionGroup labelId={labelId} describedBy={describedBy} grid>
            {slots.map((s) => (
              <OptionCard
                key={s.id}
                selected={v.slotIds.includes(s.id)}
                onSelect={() => change({ slotIds: toggleId(v.slotIds, s.id) })}
                title={weekdayName(s.weekday)}
                detail={formatSlotTime(s.start_time)}
              />
            ))}
          </OptionGroup>
        )}
      </FieldGroup>
      <div className="field">
        <label className="field__label" htmlFor="venue-notes">
          Note
        </label>
        <textarea
          id="venue-notes"
          className="input"
          rows={4}
          style={{ paddingTop: 12, paddingBottom: 12, resize: "vertical" }}
          maxLength={1000}
          value={v.notes}
          onChange={(e) => change({ notes: e.target.value })}
        />
        <p className="field__hint">Solo per te: referente, tavolo riservato, accordi sul prezzo.</p>
      </div>
      <Checkbox
        label="Locale attivo: si può assegnare ai tavoli"
        checked={v.active}
        onChange={(e) => change({ active: e.target.checked })}
      />
      {saveError && <Notice tone="error">{saveError}</Notice>}
      <div className="button-row">
        <Button type="submit" loading={saving}>
          {v.id === null ? "Aggiungi locale" : "Salva modifiche"}
        </Button>
      </div>
    </form>
  );
}
