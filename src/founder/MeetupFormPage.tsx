import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "../components/Button";
import { Notice } from "../components/Card";
import { Checkbox, FieldGroup, SelectField } from "../components/Field";
import { LoadingState } from "../components/LoadingState";
import { OptionCard, OptionGroup } from "../components/OptionCard";
import { Pill, PillGroup } from "../components/Pill";
import { useToast } from "../components/Toast";
import { ApiError } from "../lib/api";
import { addDaysIso, formatDateOnly, formatDateTime, isoWeekday, romeWallTime, todayIso } from "../lib/dates";
import { computeBalance } from "./balance";
import { BalancePanel } from "./BalancePanel";
import { candidatesFor } from "./candidates";
import { slotShort } from "./catalogLabels";
import { saveMeetup, type AppSettings, type Meetup, type MeetupInput } from "./founderApi";
import { useFounder } from "./FounderLayout";
import { genderAge } from "./labels";
import { useMeetupData } from "./useMeetupData";

type Data = NonNullable<ReturnType<typeof useMeetupData>["data"]>;

export function MeetupFormPage() {
  const { id } = useParams();
  const { data, error, loading } = useMeetupData();
  const existing = id ? data?.meetups.find((m) => m.id === Number(id)) : undefined;

  return (
    <>
      <title>{`${id ? "Modifica tavolo" : "Nuovo tavolo"} · Pannello · CoffeeMeeting`}</title>
      <div className="admin__toolbar">
        <h2>{id ? "Modifica tavolo" : "Nuovo tavolo"}</h2>
        <Link to="/pannello/tavoli" className="text-link">
          Torna ai tavoli
        </Link>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {loading && <LoadingState />}
      {data && id && (!existing || existing.status !== "draft") && (
        <Notice tone="error">Solo le bozze si possono modificare.</Notice>
      )}
      {data && (!id || existing?.status === "draft") && <MeetupForm data={data} existing={existing} />}
    </>
  );
}

/** Prossime date (fino a 8) nel giorno della settimana dello slot. */
function upcomingDates(weekday: number): string[] {
  const out: string[] = [];
  let d = todayIso();
  while (out.length < 8) {
    if (isoWeekday(d) === weekday) out.push(d);
    d = addDaysIso(d, 1);
  }
  return out;
}

function responseDeadline(date: string, s: AppSettings): Date {
  return romeWallTime(addDaysIso(date, -s.responseDaysBefore), s.responseTime.slice(0, 5));
}

const shortDate = (iso: string) => {
  const s = formatDateOnly(iso);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function MeetupForm({ data, existing }: { data: Data; existing?: Meetup }) {
  const { catalog } = useFounder();
  const navigate = useNavigate();
  const toast = useToast();
  const zones = catalog.zones.filter((z) => z.active);
  const slots = catalog.slots.filter((s) => s.active);

  const [v, setV] = useState<MeetupInput>(() =>
    existing
      ? {
          id: existing.id,
          zoneId: existing.zoneId,
          slotId: existing.slotId,
          date: existing.date,
          format: existing.format,
          venueId: existing.venueId,
          profileIds: existing.invitations.filter((i) => i.status === "draft").map((i) => i.profileId),
        }
      : { id: null, zoneId: zones[0]?.id ?? 0, slotId: slots[0]?.id ?? 0, date: "", format: "group", venueId: null, profileIds: [] },
  );
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const change = (patch: Partial<MeetupInput>) => setV((x) => ({ ...x, ...patch }));
  const slot = slots.find((s) => s.id === v.slotId);
  const dates = slot ? upcomingDates(slot.weekday) : [];
  const now = Date.now();

  const candidates = useMemo(
    () => candidatesFor(data.members, data.meetups, { id: v.id, zoneId: v.zoneId, slotId: v.slotId, date: v.date, format: v.format }),
    [data, v.id, v.zoneId, v.slotId, v.date, v.format],
  );
  const selected = v.profileIds
    .map((id) => data.members.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined);
  // Senza data non si sa chi è già occupato: i candidati compaiono dopo averla scelta.
  const visible = v.date
    ? candidates.filter((c) => showAll || (c.reasons.length === 0 && !c.busy) || v.profileIds.includes(c.member.id))
    : [];
  const balance = computeBalance(v.format, selected);
  const max = v.format === "one_to_one" ? 2 : 6;

  const venues = data.venues
    .filter((x) => x.active)
    .sort((a, b) => Number(b.zoneId === v.zoneId && b.slotIds.includes(v.slotId)) - Number(a.zoneId === v.zoneId && a.slotIds.includes(v.slotId)));

  function toggle(id: string) {
    change({ profileIds: v.profileIds.includes(id) ? v.profileIds.filter((x) => x !== id) : [...v.profileIds, id] });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.date) {
      setDateError("Scegli la data.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveMeetup(v);
      toast(v.id ? "Bozza salvata." : "Bozza creata. Controlla l'equilibrio e poi invia gli inviti.");
      navigate("/pannello/tavoli");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Qualcosa non ha funzionato. Riprova.");
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="meetup-form">
      <div className="form-fields">
        <div className="field-row">
          <SelectField
            label="Zona"
            options={zones.map((z) => ({ value: String(z.id), label: z.name }))}
            value={String(v.zoneId)}
            onChange={(e) => change({ zoneId: Number(e.target.value), venueId: null })}
          />
          <SelectField
            label="Orario"
            options={slots.map((s) => ({ value: String(s.id), label: slotShort(s) }))}
            value={String(v.slotId)}
            onChange={(e) => change({ slotId: Number(e.target.value), date: "" })}
          />
        </div>

        <FieldGroup label="Data" error={dateError ?? undefined}>
          {({ labelId, describedBy }) => (
            <PillGroup labelId={labelId} describedBy={describedBy}>
              {dates.map((d) => {
                const closed = responseDeadline(d, data.settings).getTime() <= now;
                return (
                  <Pill
                    key={d}
                    selected={v.date === d}
                    onToggle={() => {
                      setDateError(null);
                      change({ date: d });
                    }}
                  >
                    {shortDate(d)}
                    {closed ? " · tardi" : ""}
                  </Pill>
                );
              })}
            </PillGroup>
          )}
        </FieldGroup>

        <FieldGroup label="Formato">
          {({ labelId }) => (
            <OptionGroup labelId={labelId} grid>
              <OptionCard selected={v.format === "group"} onSelect={() => change({ format: "group" })} title="Gruppo" detail="4–6 persone" />
              <OptionCard selected={v.format === "one_to_one"} onSelect={() => change({ format: "one_to_one" })} title="Uno a uno" detail="2 persone" />
            </OptionGroup>
          )}
        </FieldGroup>

        <SelectField
          label="Locale"
          placeholder="Da assegnare"
          options={venues.map((x) => {
            const fits = x.zoneId === v.zoneId && x.slotIds.includes(v.slotId);
            const zone = catalog.zones.find((z) => z.id === x.zoneId)?.name ?? "";
            return { value: String(x.id), label: `${x.name} · ${zone}${fits ? "" : " (fuori zona o orario)"}` };
          })}
          value={v.venueId ? String(v.venueId) : ""}
          onChange={(e) => change({ venueId: e.target.value ? Number(e.target.value) : null })}
          hint={venues.length === 0 ? "Nessun locale attivo: aggiungine uno nella sezione Locali." : "Puoi salvare la bozza anche senza locale."}
        />

        <FieldGroup label={`Partecipanti (${selected.length} di ${max})`}>
          {({ labelId }) => (
            <div role="group" aria-labelledby={labelId} className="table-scroll" style={{ minWidth: 0 }}>
              {visible.length === 0 && (
                <p className="empty">
                  {v.date ? "Nessuno disponibile con questi criteri." : "Scegli una data per vedere chi è disponibile."}
                </p>
              )}
              {visible.map((c) => {
                const ga = genderAge(c.member.gender, c.member.birthYear);
                const first = (data.breakfasts.get(c.member.id) ?? 0) === 0;
                const checked = v.profileIds.includes(c.member.id);
                const notes = [...c.reasons, ...(c.busy ? ["già in un altro tavolo"] : [])];
                return (
                  <label key={c.member.id} className="candidate">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && (c.busy || selected.length >= max)}
                      onChange={() => toggle(c.member.id)}
                    />
                    <span className="candidate__main">
                      {c.member.firstName}
                      {first && <span className="first-time">prima volta</span>} <span className="muted">· {c.member.job}</span>
                      {notes.length > 0 && (
                        <>
                          <br />
                          <span className="muted">{notes.join(" · ")}</span>
                        </>
                      )}
                    </span>
                    <span className="mono muted" aria-label={ga.long}>
                      {ga.short}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </FieldGroup>
        <Checkbox
          label="Mostra anche chi ha scelto altre zone, altri orari o un altro formato"
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
        />

        {saveError && <Notice tone="error">{saveError}</Notice>}
        <div className="button-row">
          <Button type="submit" loading={saving}>
            {v.id ? "Salva bozza" : "Crea bozza"}
          </Button>
        </div>
      </div>

      <aside className="meetup-form__aside card">
        <BalancePanel balance={balance} format={v.format} />
        <p className="label-mono" style={{ marginTop: 14 }}>
          Scadenza di risposta
        </p>
        <p>{v.date ? formatDateTime(responseDeadline(v.date, data.settings)) : "—"}</p>
      </aside>
    </form>
  );
}
