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
