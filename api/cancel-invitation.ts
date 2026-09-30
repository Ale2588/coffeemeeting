// POST /api/cancel-invitation { invitationId } → { free, refundedCents, refundFailed }
// Disdetta dell'iscritto; se è entro la disdetta gratuita e aveva pagato, rimborso completo.
import { handle, HttpError, json, readJson, requireUser, rpc } from "./_lib/http";
import { refund } from "./_lib/stripe";

type Result = { free: boolean; refund_payment_intent_id: string | null; refund_amount_cents: number | null };

export const POST = handle(async (request, { db, stripe }) => {
  const profileId = await requireUser(request, db);
  const { invitationId } = await readJson<{ invitationId?: number }>(request);
  if (!Number.isInteger(invitationId)) throw new HttpError(400, "invalid_request");

  const [r] = await rpc<Result[]>(db, "svc_cancel_invitation", { p_invitation_id: invitationId, p_profile_id: profileId });
  let refundedCents: number | null = null;
  let refundFailed = false;
  if (r.refund_payment_intent_id) {
    const ok = await refund(db, stripe, r.refund_payment_intent_id);
    if (ok) refundedCents = r.refund_amount_cents;
    else refundFailed = true;
  }
  return json({ free: r.free, refundedCents, refundFailed });
});
