import type { MeetingFormat, PreferencesInput } from "../lib/api";

export type PreferencesValues = {
  firstName: string;
  job: string;
  format: MeetingFormat | "";
  zoneIds: number[];
  slotIds: number[];
};

export type PreferencesErrors = Partial<Record<keyof PreferencesValues, string>>;

export function validatePreferences(v: PreferencesValues): PreferencesErrors {
  const errors: PreferencesErrors = {};
  if (!v.firstName.trim()) errors.firstName = "Scrivi il tuo nome.";
  else if (v.firstName.trim().length > 60) errors.firstName = "Al massimo 60 caratteri.";
  if (!v.job.trim()) errors.job = "Scrivi che lavoro fai.";
  else if (v.job.trim().length > 80) errors.job = "Al massimo 80 caratteri.";
  if (v.zoneIds.length === 0) errors.zoneIds = "Scegli almeno una zona.";
  if (v.slotIds.length === 0) errors.slotIds = "Scegli almeno un orario.";
  if (!v.format) errors.format = "Scegli un formato.";
  return errors;
}

export function toPreferencesInput(v: PreferencesValues): PreferencesInput {
  return {
    firstName: v.firstName.trim(),
    job: v.job.trim(),
    format: v.format as MeetingFormat,
    zoneIds: v.zoneIds,
    slotIds: v.slotIds,
  };
}

export const toggleId = (list: number[], id: number) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

/** Porta il fuoco sul primo campo con errore, dopo il rendering. */
export function focusFirstError(form: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    form?.querySelector<HTMLElement>(".field--error input, .field--error select, .field--error button")?.focus();
  });
}
