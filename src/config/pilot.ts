// Parametri del pilota. Valori provvisori dalla specifica (sezione 3), "da confermare".
// Un valore `null` significa "non ancora fornito": l'interfaccia mostra un segnaposto esplicito.
// Dalla fase 2 slot, zone e locali vivranno nel database; qui restano i testi della home.

export type Weekday = "mar" | "gio";

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mar: "martedì",
  gio: "giovedì",
};

export const SLOTS: ReadonlyArray<{ day: Weekday; time: string }> = [
  { day: "mar", time: "7:45" },
  { day: "mar", time: "8:30" },
  { day: "gio", time: "7:45" },
  { day: "gio", time: "8:30" },
];

export const ZONES = [
  "Porta Venezia",
  "Isola",
  "Navigli",
  "Città Studi",
  "Porta Romana",
  "CityLife",
  "Centrale",
  "Lambrate",
] as const;

export const PILOT = {
  timeZone: "Europe/Rome",
  durationMinutes: 45,
  groupSize: { min: 4, max: 6 },
  freeCancellationHours: 12,
  /** Prezzo della colazione in euro. Da definire (specifica, sezione 10). */
  breakfastPriceEur: null as number | null,
  /** Prezzo mensile dell'abbonamento in euro. Da definire (feedback, punto 7). */
  subscriptionMonthlyEur: null as number | null,
  /** Email di contatto per "Scrivici". Da fornire. */
  contactEmail: null as string | null,
  /** Validità del link di accesso. Deve coincidere con "Email OTP Expiration" su Supabase. */
  loginLinkValidityMinutes: 60,
} as const;
