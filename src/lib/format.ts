import { SLOTS, WEEKDAY_LABEL, type Weekday } from "../config/pilot";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Unisce una lista in italiano: "a", "a e b", "a, b e c". */
export function joinIt(items: readonly string[], last = "e"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${last} ${items[items.length - 1]}`;
}

/** "Martedì e giovedì, 7:45 o 8:30" a partire dagli slot configurati. */
export function describeSlots(): string {
  const days = [...new Set(SLOTS.map((s) => s.day))] as Weekday[];
  const times = [...new Set(SLOTS.map((s) => s.time))];
  return `${capitalize(joinIt(days.map((d) => WEEKDAY_LABEL[d])))}, ${joinIt(times, "o")}`;
}

/** "il martedì o il giovedì" per il testo corrente. */
export function describeSlotDays(): string {
  const days = [...new Set(SLOTS.map((s) => s.day))] as Weekday[];
  return joinIt(
    days.map((d) => `il ${WEEKDAY_LABEL[d]}`),
    "o",
  );
}

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatEur(amount: number): string {
  return euro.format(amount);
}

const ISO_WEEKDAY = ["", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];

/** Giorno della settimana ISO (1 = lunedì) in italiano, con iniziale maiuscola. */
export function weekdayName(isoWeekday: number): string {
  return capitalize(ISO_WEEKDAY[isoWeekday] ?? "");
}

/** "07:45:00" → "7:45" */
export function formatSlotTime(time: string): string {
  const [h, m] = time.split(":");
  return `${Number(h)}:${m}`;
}

export function slotLabel(slot: { weekday: number; start_time: string }): string {
  return `${weekdayName(slot.weekday)} ${formatSlotTime(slot.start_time)}`;
}
