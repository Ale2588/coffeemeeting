import type { Gender, MemberStatus } from "../lib/api";
import type { StatusTone } from "../components/StatusTag";
import { currentYear } from "../lib/dates";

export const STATUS_LABEL: Record<MemberStatus, string> = {
  waitlisted: "In lista d'attesa",
  active: "Attivo",
  warned: "Avvisato",
  suspended: "Sospeso",
  expelled: "Espulso",
  rejected: "Rifiutato",
  closed: "Account chiuso",
};

export const STATUS_TONE: Record<MemberStatus, StatusTone> = {
  waitlisted: "neutral",
  active: "positive",
  warned: "warning",
  suspended: "warning",
  expelled: "warning",
  rejected: "neutral",
  closed: "neutral",
};

/** Ordine dei filtri nella pagina Iscritti. */
export const STATUS_ORDER: MemberStatus[] = ["active", "warned", "suspended", "expelled", "waitlisted", "rejected", "closed"];

const GENDER_SHORT: Record<Gender, string> = { female: "D", male: "U", other: "A", undisclosed: "—" };
const GENDER_LONG: Record<Gender, string> = {
  female: "donna",
  male: "uomo",
  other: "altro",
  undisclosed: "genere non indicato",
};

/** "D · 38" e la versione estesa per i lettori di schermo. Solo pannello del fondatore. */
export function genderAge(gender: Gender | null, birthYear: number | null): { short: string; long: string } {
  if (!gender || !birthYear) return { short: "—", long: "dati non disponibili" };
  const age = currentYear() - birthYear;
  return { short: `${GENDER_SHORT[gender]} · ${age}`, long: `${GENDER_LONG[gender]}, circa ${age} anni` };
}
