import type { Gender, MeetingFormat } from "./api";

export const FORMAT_OPTIONS: ReadonlyArray<{ value: MeetingFormat; title: string; detail: string }> = [
  { value: "group", title: "Tavolo di gruppo", detail: "4–6 persone" },
  { value: "one_to_one", title: "Uno a uno", detail: "2 persone" },
  { value: "both", title: "Entrambi", detail: "Decidiamo noi volta per volta" },
];

export const FORMAT_LABEL: Record<MeetingFormat, string> = {
  group: "Tavolo di gruppo",
  one_to_one: "Uno a uno",
  both: "Entrambi",
};

export const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: "female", label: "Donna" },
  { value: "male", label: "Uomo" },
  { value: "other", label: "Altro" },
  { value: "undisclosed", label: "Preferisco non dirlo" },
];
