// Tutte le date mostrate sono nel fuso Europe/Rome, qualunque sia il fuso del dispositivo.
export const TIME_ZONE = "Europe/Rome";

const dayFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFormat = new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });

/** "martedì 29 settembre, 14:32" */
export function formatDateTime(d: Date): string {
  return `${dayFormat.format(d)}, ${timeFormat.format(d)}`;
}

/** Data locale "AAAA-MM-GG" di oggi a Roma. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

/** Somma giorni a una data "AAAA-MM-GG" senza passare per i fusi orari. */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "lunedì 19 ottobre" da una data "AAAA-MM-GG". */
export function formatDateOnly(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Anno corrente a Roma. */
export function currentYear(): number {
  return Number(todayIso().slice(0, 4));
}

const longDay = new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });

/** "Martedì 6 ottobre" */
export function formatDayTitle(d: Date): string {
  const s = longDay.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "7:45" */
export function formatTime(d: Date): string {
  return timeFormat.format(d);
}

/** Istante corrispondente a un'ora locale di Roma ("AAAA-MM-GG", "HH:MM"). */
export function romeWallTime(dateIso: string, time: string): Date {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asRome = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asRome - guess));
}

/** Giorno della settimana ISO (1 = lunedì) di una data "AAAA-MM-GG". */
export function isoWeekday(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}
