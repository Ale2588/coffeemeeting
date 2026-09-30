import { client, toApiError, type MeetingFormat } from "./api";

export type InvitationStatus = "pending" | "confirmed" | "expired" | "cancelled";

export type MyInvitation = {
  id: number;
  status: InvitationStatus;
  respondBy: Date;
  cancelledBy: "member" | "founder" | null;
  meetupCancelled: boolean;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  freeCancellationUntil: Date;
  format: Exclude<MeetingFormat, "both">;
  zoneName: string;
  venueName: string | null;
  venueAddress: string | null;
  participants: number;
};

type Row = {
  invitation_id: number;
  status: InvitationStatus;
  respond_by: string;
  cancelled_by: "member" | "founder" | null;
  meetup_status: "sent" | "cancelled";
  starts_at: string;
  duration_minutes: number;
  free_cancellation_until: string;
  format: Exclude<MeetingFormat, "both">;
  zone_name: string;
  venue_name: string | null;
  venue_address: string | null;
  participants: number;
};

export async function fetchMyInvitations(): Promise<MyInvitation[]> {
  const { data, error } = await client().rpc("my_invitations");
  if (error) throw toApiError(error);
  return (data as Row[]).map((r) => {
    const startsAt = new Date(r.starts_at);
    return {
      id: r.invitation_id,
      status: r.status,
      respondBy: new Date(r.respond_by),
      cancelledBy: r.cancelled_by,
      meetupCancelled: r.meetup_status === "cancelled",
      startsAt,
      endsAt: new Date(startsAt.getTime() + r.duration_minutes * 60_000),
      durationMinutes: r.duration_minutes,
      freeCancellationUntil: new Date(r.free_cancellation_until),
      format: r.format,
      zoneName: r.zone_name,
      venueName: r.venue_name,
      venueAddress: r.venue_address,
      participants: r.participants,
    };
  });
}

export async function fetchCompanions(invitationId: number): Promise<{ firstName: string; job: string }[]> {
  const { data, error } = await client().rpc("my_meetup_companions", { p_invitation_id: invitationId });
  if (error) throw toApiError(error);
  return (data as { first_name: string; job: string }[]).map((r) => ({ firstName: r.first_name, job: r.job }));
}

/** Restituisce il nuovo stato: "confirmed", oppure "expired" se la scadenza è passata. */
export async function confirmInvitation(invitationId: number): Promise<InvitationStatus> {
  const { data, error } = await client().rpc("confirm_invitation", { p_invitation_id: invitationId });
  if (error) throw toApiError(error);
  return data as InvitationStatus;
}

/** Restituisce true se la disdetta è avvenuta entro la finestra gratuita. */
export async function cancelInvitation(invitationId: number): Promise<boolean> {
  const { data, error } = await client().rpc("cancel_invitation", { p_invitation_id: invitationId });
  if (error) throw toApiError(error);
  return data as boolean;
}

/** Invito concluso: il tavolo è già finito. */
export const isPast = (inv: MyInvitation) => inv.endsAt.getTime() <= Date.now();

/** Colazioni fatte: inviti confermati a tavoli già iniziati. */
export const breakfastsDone = (list: MyInvitation[]) =>
  list.filter((i) => i.status === "confirmed" && !i.meetupCancelled && i.startsAt.getTime() <= Date.now()).length;
