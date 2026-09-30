import { callServer } from "../lib/serverApi";
import { byTime, client, toApiError, type Gender, type MeetingFormat, type MemberRole, type MemberStatus, type Slot, type Zone } from "../lib/api";

export type FounderMember = {
  id: string;
  email: string;
  firstName: string;
  job: string;
  format: MeetingFormat;
  status: MemberStatus;
  role: MemberRole;
  createdAt: string;
  invitesResumeOn: string | null;
  zoneIds: number[];
  slotIds: number[];
  gender: Gender | null;
  birthYear: number | null;
};

export type FounderCatalog = { zones: (Zone & { active: boolean })[]; slots: (Slot & { active: boolean })[] };

export type Venue = {
  id: number;
  name: string;
  address: string;
  zoneId: number;
  notes: string;
  active: boolean;
  slotIds: number[];
};

export type VenueInput = Omit<Venue, "id"> & { id: number | null };

export type AvailabilityCell = { zoneId: number; slotId: number; members: number };

/** Zone e slot, compresi quelli disattivati (il fondatore li vede tutti). */
export async function fetchFounderCatalog(): Promise<FounderCatalog> {
  const db = client();
  const [zones, slots] = await Promise.all([
    db.from("zones").select("id, name, active").order("sort_order"),
    db.from("slots").select("id, weekday, start_time, duration_minutes, active"),
  ]);
  if (zones.error || slots.error) throw toApiError(zones.error ?? slots.error);
  return {
    zones: zones.data as FounderCatalog["zones"],
    slots: (slots.data as FounderCatalog["slots"]).sort(byTime),
  };
}

type MemberRow = {
  id: string;
  email: string;
  first_name: string;
  job: string;
  format: MeetingFormat;
  status: MemberStatus;
  role: MemberRole;
  created_at: string;
  invites_resume_on: string | null;
  profile_zones: { zone_id: number }[];
  profile_slots: { slot_id: number }[];
  profile_private: { gender: Gender; birth_year: number } | null;
};

export async function fetchMembers(): Promise<FounderMember[]> {
  const { data, error } = await client()
    .from("profiles")
    .select(
      "id, email, first_name, job, format, status, role, created_at, invites_resume_on, " +
        "profile_zones(zone_id), profile_slots(slot_id), profile_private(gender, birth_year)",
    )
    .order("created_at", { ascending: true });
  if (error) throw toApiError(error);
  return (data as unknown as MemberRow[]).map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.first_name,
    job: r.job,
    format: r.format,
    status: r.status,
    role: r.role,
    createdAt: r.created_at,
    invitesResumeOn: r.invites_resume_on,
    zoneIds: r.profile_zones.map((z) => z.zone_id),
    slotIds: r.profile_slots.map((s) => s.slot_id),
    gender: r.profile_private?.gender ?? null,
    birthYear: r.profile_private?.birth_year ?? null,
  }));
}

export async function fetchWaitlistCount(): Promise<number> {
  const { count, error } = await client()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "waitlisted");
  if (error) throw toApiError(error);
  return count ?? 0;
}

export async function fetchPendingSignupsCount(): Promise<number> {
  const { data, error } = await client().rpc("founder_pending_signups_count");
  if (error) throw toApiError(error);
  return data as number;
}

/** Restituisce lo stato precedente, per poter annullare. */
export async function setMemberStatus(profileId: string, status: MemberStatus): Promise<MemberStatus> {
  const { data, error } = await client().rpc("founder_set_member_status", { p_profile_id: profileId, p_status: status });
  if (error) throw toApiError(error);
  return data as MemberStatus;
}

export async function fetchAvailability(): Promise<AvailabilityCell[]> {
  const { data, error } = await client().rpc("founder_availability");
  if (error) throw toApiError(error);
  return (data as { zone_id: number; slot_id: number; members: number }[]).map((r) => ({
    zoneId: r.zone_id,
    slotId: r.slot_id,
    members: r.members,
  }));
}

type VenueRow = {
  id: number;
  name: string;
  address: string;
  zone_id: number;
  notes: string;
  active: boolean;
  venue_slots: { slot_id: number }[];
};

export async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await client()
    .from("venues")
    .select("id, name, address, zone_id, notes, active, venue_slots(slot_id)")
    .order("name");
  if (error) throw toApiError(error);
  return (data as VenueRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    zoneId: r.zone_id,
    notes: r.notes,
    active: r.active,
    slotIds: r.venue_slots.map((s) => s.slot_id),
  }));
}

export async function saveVenue(v: VenueInput): Promise<number> {
  const { data, error } = await client().rpc("founder_save_venue", {
    p_id: v.id,
    p_name: v.name,
    p_address: v.address,
    p_zone_id: v.zoneId,
    p_notes: v.notes,
    p_slot_ids: v.slotIds,
    p_active: v.active,
  });
  if (error) throw toApiError(error);
  return data as number;
}

// ---------------------------------------------------------------------------
// Tavoli (fase 4)
// ---------------------------------------------------------------------------

export type MeetupStatus = "draft" | "sent" | "cancelled";
export type FounderInvitationStatus = "draft" | "pending" | "confirmed" | "expired" | "cancelled";

export type FounderInvitation = {
  id: number;
  profileId: string;
  status: FounderInvitationStatus;
  respondBy: Date;
  cancelledBy: "member" | "founder" | null;
};

export type Meetup = {
  id: number;
  zoneId: number;
  slotId: number;
  date: string;
  format: "group" | "one_to_one";
  venueId: number | null;
  status: MeetupStatus;
  startsAt: Date;
  durationMinutes: number;
  responseDeadline: Date;
  invitations: FounderInvitation[];
};

export type MeetupInput = {
  id: number | null;
  zoneId: number;
  slotId: number;
  date: string;
  format: "group" | "one_to_one";
  venueId: number | null;
  profileIds: string[];
};

export type AppSettings = { responseDaysBefore: number; responseTime: string; freeCancellationHours: number };

type MeetupRow = {
  id: number;
  zone_id: number;
  slot_id: number;
  meetup_date: string;
  format: "group" | "one_to_one";
  venue_id: number | null;
  status: MeetupStatus;
  starts_at: string;
  duration_minutes: number;
  response_deadline: string;
  invitations: {
    id: number;
    profile_id: string;
    status: FounderInvitationStatus;
    respond_by: string;
    cancelled_by: "member" | "founder" | null;
  }[];
};

/** Stato effettivo: un invito in attesa oltre la scadenza è scaduto. */
export function effectiveStatus(i: FounderInvitation): FounderInvitationStatus {
  return i.status === "pending" && i.respondBy.getTime() <= Date.now() ? "expired" : i.status;
}

export async function fetchMeetups(): Promise<Meetup[]> {
  const { data, error } = await client()
    .from("meetups")
    .select(
      "id, zone_id, slot_id, meetup_date, format, venue_id, status, starts_at, duration_minutes, response_deadline, " +
        "invitations(id, profile_id, status, respond_by, cancelled_by)",
    )
    .order("starts_at");
  if (error) throw toApiError(error);
  return (data as unknown as MeetupRow[]).map((r) => ({
    id: r.id,
    zoneId: r.zone_id,
    slotId: r.slot_id,
    date: r.meetup_date,
    format: r.format,
    venueId: r.venue_id,
    status: r.status,
    startsAt: new Date(r.starts_at),
    durationMinutes: r.duration_minutes,
    responseDeadline: new Date(r.response_deadline),
    invitations: r.invitations.map((i) => ({
      id: i.id,
      profileId: i.profile_id,
      status: i.status,
      respondBy: new Date(i.respond_by),
      cancelledBy: i.cancelled_by,
    })),
  }));
}

export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await client()
    .from("app_settings")
    .select("response_days_before, response_time, free_cancellation_hours")
    .single();
  if (error) throw toApiError(error);
  const r = data as { response_days_before: number; response_time: string; free_cancellation_hours: number };
  return {
    responseDaysBefore: r.response_days_before,
    responseTime: r.response_time,
    freeCancellationHours: r.free_cancellation_hours,
  };
}

/** Colazioni fatte per iscritto (solo chi ne ha almeno una). */
export async function fetchBreakfastCounts(): Promise<Map<string, number>> {
  const { data, error } = await client().rpc("founder_breakfast_counts");
  if (error) throw toApiError(error);
  return new Map((data as { profile_id: string; breakfasts: number }[]).map((r) => [r.profile_id, r.breakfasts]));
}

export async function saveMeetup(m: MeetupInput): Promise<number> {
  const { data, error } = await client().rpc("founder_save_meetup", {
    p_id: m.id,
    p_zone_id: m.zoneId,
    p_slot_id: m.slotId,
    p_date: m.date,
    p_format: m.format,
    p_venue_id: m.venueId,
    p_profile_ids: m.profileIds,
  });
  if (error) throw toApiError(error);
  return data as number;
}

export async function sendMeetup(id: number): Promise<void> {
  const { error } = await client().rpc("founder_send_meetup", { p_id: id });
  if (error) throw toApiError(error);
}

export async function addParticipant(meetupId: number, profileId: string): Promise<void> {
  const { error } = await client().rpc("founder_add_participant", { p_meetup_id: meetupId, p_profile_id: profileId });
  if (error) throw toApiError(error);
}

/** Annulla un tavolo; il server rimborsa chi aveva pagato. */
export async function cancelMeetup(id: number): Promise<{ refunded: number; refundFailed: number }> {
  return callServer("founder-cancel-meetup", { meetupId: id });
}

export type SubscriptionState = { active: boolean; needsSubscription: boolean; plan: "monthly" | "yearly" | null };

export async function fetchSubscriptionStates(): Promise<Map<string, SubscriptionState>> {
  const { data, error } = await client().rpc("founder_subscription_states");
  if (error) throw toApiError(error);
  return new Map(
    (data as { profile_id: string; active: boolean; needs_subscription: boolean; plan: "monthly" | "yearly" | null }[]).map((r) => [
      r.profile_id,
      { active: r.active, needsSubscription: r.needs_subscription, plan: r.plan },
    ]),
  );
}
