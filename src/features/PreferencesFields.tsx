import { TextField, FieldGroup } from "../components/Field";
import { OptionCard, OptionGroup } from "../components/OptionCard";
import { Pill, PillGroup } from "../components/Pill";
import type { Catalog } from "../lib/api";
import { formatSlotTime, weekdayName } from "../lib/format";
import { FORMAT_OPTIONS } from "../lib/labels";
import { toggleId, type PreferencesErrors, type PreferencesValues } from "./preferences";

type Props = {
  catalog: Catalog;
  values: PreferencesValues;
  errors: PreferencesErrors;
  onChange: (patch: Partial<PreferencesValues>) => void;
};

/** Campi comuni a iscrizione (A2) e "Modifica preferenze": nome, lavoro, zone, orari, formato. */
export function PreferencesFields({ catalog, values, errors, onChange }: Props) {
  return (
    <>
      <TextField
        label="Nome"
        autoComplete="given-name"
        value={values.firstName}
        maxLength={60}
        onChange={(e) => onChange({ firstName: e.target.value })}
        error={errors.firstName}
      />
      <TextField
        label="Che lavoro fai"
        value={values.job}
        maxLength={80}
        onChange={(e) => onChange({ job: e.target.value })}
        hint="Lo vedranno le persone al tuo tavolo, dopo la conferma."
        error={errors.job}
      />
      <FieldGroup
        label="Zone comode"
        hint="Scegline quante vuoi: vicino a casa, all'ufficio o sul tragitto."
        error={errors.zoneIds}
      >
        {({ labelId, describedBy }) => (
          <PillGroup labelId={labelId} describedBy={describedBy}>
            {catalog.zones.map((z) => (
              <Pill
                key={z.id}
                selected={values.zoneIds.includes(z.id)}
                onToggle={() => onChange({ zoneIds: toggleId(values.zoneIds, z.id) })}
              >
                {z.name}
              </Pill>
            ))}
          </PillGroup>
        )}
      </FieldGroup>
      <FieldGroup
        label="Orari che ti vanno bene"
        hint="Più orari scegli, prima arriva il primo invito."
        error={errors.slotIds}
      >
        {({ labelId, describedBy }) => (
          <OptionGroup labelId={labelId} describedBy={describedBy} grid>
            {catalog.slots.map((s) => (
              <OptionCard
                key={s.id}
                selected={values.slotIds.includes(s.id)}
                onSelect={() => onChange({ slotIds: toggleId(values.slotIds, s.id) })}
                title={weekdayName(s.weekday)}
                detail={formatSlotTime(s.start_time)}
              />
            ))}
          </OptionGroup>
        )}
      </FieldGroup>
      <FieldGroup label="Formato" hint="Dici a cosa sei disponibile. Puoi cambiarlo quando vuoi." error={errors.format}>
        {({ labelId, describedBy }) => (
          <OptionGroup labelId={labelId} describedBy={describedBy}>
            {FORMAT_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                selected={values.format === o.value}
                onSelect={() => onChange({ format: o.value })}
                title={o.title}
                detail={o.detail}
              />
            ))}
          </OptionGroup>
        )}
      </FieldGroup>
    </>
  );
}
