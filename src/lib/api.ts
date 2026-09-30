import type { AuthError } from "@supabase/supabase-js";
import { supabase, supabaseConfigError } from "./supabase";

export type MeetingFormat = "group" | "one_to_one" | "both";
export type Gender = "female" | "male" | "other" | "undisclosed";
export type MemberStatus = "waitlisted" | "active" | "warned" | "suspended" | "expelled" | "rejected";
export type MemberRole = "member" | "founder";

export type Zone = { id: number; name: string };
export type Slot = { id: number; weekday: number; start_time: string; duration_minutes: number };
export type Catalog = { zones: Zone[]; slots: Slot[] };

export type MyProfile = {
  id: string;
  email: string;
  firstName: string;
  job: string;
  format: MeetingFormat;
  status: MemberStatus;
  role: MemberRole;
  invitesResumeOn: string | null;
  zones: Zone[];
  slots: Slot[];
};

export type PreferencesInput = {
  firstName: string;
  job: string;
  format: MeetingFormat;
  zoneIds: number[];
  slotIds: number[];
};

export type SignupInput = PreferencesInput & { email: string; gender: Gender; birthYear: number };

/** Errore con un messaggio già pronto per l'interfaccia. */
export class ApiError extends Error {}

const SERVER_MESSAGES: Record<string, string> = {
  invalid_email: "Controlla l'indirizzo email.",
  invalid_first_name: "Scrivi il tuo nome.",
  invalid_job: "Scrivi che lavoro fai.",
  invalid_zones: "Scegli almeno una zona.",
  invalid_slots: "Scegli almeno un orario.",
  invalid_format: "Scegli un formato.",
  invalid_gender: "Scegli un'opzione per il genere.",
  invalid_birth_year: "Controlla l'anno di nascita: per iscriverti devi essere maggiorenne.",
  invalid_resume_date: "Scegli una data di ripresa tra domani e un anno da oggi.",
  not_allowed: "Questa operazione non è disponibile per il tuo account.",
  cannot_change_self: "Non puoi cambiare il tuo stato.",
  not_found: "Non trovato: forse è stato eliminato. Ricarica la pagina.",
  invalid_status: "Stato non valido.",
  invalid_venue_name: "Scrivi il nome del locale.",
  invalid_venue_address: "Scrivi l'indirizzo del locale.",
  invalid_venue_notes: "Le note possono avere al massimo 1000 caratteri.",
};

const GENERIC = "Qualcosa non ha funzionato. Riprova tra poco.";

export function toApiError(error: { message?: string } | null): ApiError {
  const code = Object.keys(SERVER_MESSAGES).find((k) => error?.message?.includes(k));
  return new ApiError(code ? SERVER_MESSAGES[code] : GENERIC);
}

export function client() {
  if (!supabase) throw new ApiError(`Il servizio non è ancora configurato. ${supabaseConfigError ?? ""}`.trim());
  return supabase;
}

export const byTime = (a: Slot, b: Slot) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time);

export async function fetchCatalog(): Promise<Catalog> {
  const db = client();
  const [zones, slots] = await Promise.all([
    db.from("zones").select("id, name").eq("active", true).order("sort_order"),
    db.from("slots").select("id, weekday, start_time, duration_minutes").eq("active", true),
  ]);
  if (zones.error || slots.error) throw toApiError(zones.error ?? slots.error);
  return { zones: zones.data as Zone[], slots: (slots.data as Slot[]).sort(byTime) };
}

type ProfileRow = {
  id: string;
  email: string;
  first_name: string;
  job: string;
  format: MeetingFormat;
  status: MemberStatus;
  role: MemberRole;
  invites_resume_on: string | null;
  profile_zones: { zones: Zone & { sort_order: number } }[];
  profile_slots: { slots: Slot }[];
};

async function selectMyProfile(userId: string): Promise<MyProfile | null> {
  const { data, error } = await client()
    .from("profiles")
    .select(
      "id, email, first_name, job, format, status, role, invites_resume_on, " +
        "profile_zones(zones(id, name, sort_order)), profile_slots(slots(id, weekday, start_time, duration_minutes))",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw toApiError(error);
  if (!data) return null;
  const row = data as unknown as ProfileRow;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    job: row.job,
    format: row.format,
    status: row.status,
    role: row.role,
    invitesResumeOn: row.invites_resume_on,
    zones: row.profile_zones
      .map((pz) => pz.zones)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(({ id, name }) => ({ id, name })),
    slots: row.profile_slots.map((ps) => ps.slots).sort(byTime),
  };
}

/** Profilo dell'utente collegato. Se manca, prova a recuperare un'iscrizione rimasta in attesa. */
export async function fetchMyProfile(userId: string): Promise<MyProfile | null> {
  const profile = await selectMyProfile(userId);
  if (profile) return profile;
  const { data: claimed, error } = await client().rpc("claim_pending_signup");
  if (error) throw toApiError(error);
  return claimed ? selectMyProfile(userId) : null;
}

export async function submitSignup(input: SignupInput): Promise<void> {
  const { error } = await client().rpc("submit_signup", {
    p_email: input.email,
    p_first_name: input.firstName,
    p_job: input.job,
    p_format: input.format,
    p_zone_ids: input.zoneIds,
    p_slot_ids: input.slotIds,
    p_gender: input.gender,
    p_birth_year: input.birthYear,
  });
  if (error) throw toApiError(error);
}

function redirectUrl() {
  return `${window.location.origin}/auth/callback`;
}

function isRateLimited(error: AuthError) {
  return error.status === 429 || error.code === "over_email_send_rate_limit";
}

/**
 * Manda il link di accesso. Con `allowNewUser` crea l'utente (iscrizione); senza, vale solo
 * per chi è già registrato. In entrambi i casi non riveliamo se un'email è iscritta.
 */
export async function sendMagicLink(email: string, { allowNewUser }: { allowNewUser: boolean }): Promise<void> {
  const { error } = await client().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: allowNewUser, emailRedirectTo: redirectUrl() },
  });
  if (!error) return;
  if (isRateLimited(error)) {
    throw new ApiError("Hai chiesto troppi link in poco tempo. Riprova tra qualche minuto.");
  }
  // Email sconosciuta in fase di accesso: rispondiamo come se il link fosse partito.
  if (!allowNewUser && error.status !== undefined && error.status >= 400 && error.status < 500) return;
  throw new ApiError(GENERIC);
}

export async function updateMyPreferences(input: PreferencesInput): Promise<void> {
  const { error } = await client().rpc("update_my_preferences", {
    p_first_name: input.firstName,
    p_job: input.job,
    p_format: input.format,
    p_zone_ids: input.zoneIds,
    p_slot_ids: input.slotIds,
  });
  if (error) throw toApiError(error);
}

/** `null` riprende subito gli inviti; altrimenti la data di ripresa "AAAA-MM-GG". */
export async function setInvitePause(resumeOn: string | null): Promise<void> {
  const { error } = await client().rpc("set_my_invite_pause", { p_resume_on: resumeOn });
  if (error) throw toApiError(error);
}

export async function signOut(): Promise<void> {
  await client().auth.signOut();
}
