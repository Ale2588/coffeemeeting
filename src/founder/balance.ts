import type { Gender } from "../lib/api";
import { currentYear } from "../lib/dates";

type Person = { gender: Gender | null; birthYear: number | null };

export type Balance = {
  women: number;
  men: number;
  /** Quota del genere più rappresentato tra donne e uomini (0–1), null se non valutabile. */
  dominantShare: number | null;
  genderChecked: boolean;
  genderUnbalanced: boolean;
  minAge: number | null;
  maxAge: number | null;
  ageGap: number | null;
  agesFar: boolean;
  sizeOk: boolean;
  sizeHint: string;
  labels: { text: string; ok: boolean }[];
};

const sizeOkGroup = (n: number) => n >= 4 && n <= 6;

// Soglie della specifica e del feedback.
const GENDER_THRESHOLD = 0.75;
const AGE_GAP_THRESHOLD = 25;

/**
 * Indicatori di equilibrio del tavolo. "Altro" e "Preferisco non dirlo" non pesano sul genere
 * (decisione del fondatore). Nei tavoli uno a uno il genere non si valuta (feedback, punto 4).
 */
export function computeBalance(format: "group" | "one_to_one", people: Person[]): Balance {
  const women = people.filter((p) => p.gender === "female").length;
  const men = people.filter((p) => p.gender === "male").length;
  const mf = women + men;
  const genderChecked = format === "group" && mf >= 2;
  const dominantShare = mf > 0 ? Math.max(women, men) / mf : null;
  const genderUnbalanced = genderChecked && dominantShare !== null && dominantShare >= GENDER_THRESHOLD;

  const ages = people.filter((p) => p.birthYear).map((p) => currentYear() - p.birthYear!);
  const minAge = ages.length ? Math.min(...ages) : null;
  const maxAge = ages.length ? Math.max(...ages) : null;
  const ageGap = minAge !== null && maxAge !== null ? maxAge - minAge : null;
  const agesFar = ageGap !== null && ageGap > AGE_GAP_THRESHOLD;

  const n = people.length;
  const sizeOk = format === "one_to_one" ? n === 2 : n >= 4 && n <= 6;
  const count = n === 1 ? "1 persona" : `${n} persone`;
  const sizeHint = format === "one_to_one" ? `${n} di 2 persone` : sizeOkGroup(n) ? count : `${count} (servono 4–6)`;

  const labels: { text: string; ok: boolean }[] = [];
  if (genderUnbalanced) labels.push({ text: "Genere sbilanciato", ok: false });
  if (agesFar) labels.push({ text: "Età molto distanti", ok: false });
  if (!sizeOk) labels.push({ text: format === "one_to_one" ? "Servono 2 persone" : "Servono 4–6 persone", ok: false });
  if (labels.length === 0) labels.push({ text: "Equilibrato", ok: true });

  return {
    women,
    men,
    dominantShare,
    genderChecked,
    genderUnbalanced,
    minAge,
    maxAge,
    ageGap,
    agesFar,
    sizeOk,
    sizeHint,
    labels,
  };
}
