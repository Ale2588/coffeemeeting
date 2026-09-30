import { client, toApiError, type MeetingFormat } from "./api";
import { callServer } from "./serverApi";

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
  priceCents: number;
  /** Ultimo tentativo di pagamento per questo invito, se c'è. */
  payment: { status: PaymentStatus; amountCents: number; cardLast4: string | null } | null;
};

export type PaymentStatus = "pending" | "succeeded" | "failed" | "expired" | "refunded";

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
  price_cents: number;
  payment_status: PaymentStatus | null;
  payment_amount_cents: number | null;
  card_last4: string | null;
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
      priceCents: r.price_cents,
      payment: r.payment_status
        ? { status: r.payment_status, amountCents: r.payment_amount_cents ?? r.price_cents, cardLast4: r.card_last4 }
        : null,
    };
  });
}

export async function fetchCompanions(invitationId: number): Promise<{ firstName: string; job: string }[]> {
  const { data, error } = await client().rpc("my_meetup_companions", { p_invitation_id: invitationId });
  if (error) throw toApiError(error);
  return (data as { first_name: string; job: string }[]).map((r) => ({ firstName: r.first_name, job: r.job }));
}

/** Apre il pagamento Stripe della colazione: restituisce l'indirizzo a cui andare. */
export async function startBreakfastCheckout(invitationId: number): Promise<string> {
  const { url } = await callServer<{ url: string }>("checkout-breakfast", { invitationId });
  return url;
}

export type CancelResult = { free: boolean; refundedCents: number | null; refundFailed: boolean };

/** Disdetta; se entro la disdetta gratuita e già pagata, il server fa il rimborso. */
export async function cancelInvitation(invitationId: number): Promise<CancelResult> {
  return callServer<CancelResult>("cancel-invitation", { invitationId });
}

/** Invito concluso: il tavolo è già finito. */
export const isPast = (inv: MyInvitation) => inv.endsAt.getTime() <= Date.now();

/** Colazioni fatte: inviti confermati a tavoli già iniziati. */
export const breakfastsDone = (list: MyInvitation[]) =>
  list.filter((i) => i.status === "confirmed" && !i.meetupCancelled && i.startsAt.getTime() <= Date.now()).length;
