// POST /api/founder-cancel-meetup { meetupId } → { refunded, refundFailed }
// Il fondatore annulla un tavolo: rimborso completo a chi aveva confermato e pagato.
import { handle, HttpError, json, readJson, requireUser, rpc } from "./_lib/http";
import { refund } from "./_lib/stripe";

export const POST = handle(async (request, { db, stripe }) => {
  const founderId = await requireUser(request, db);
  const { meetupId } = await readJson<{ meetupId?: number }>(request);
  if (!Number.isInteger(meetupId)) throw new HttpError(400, "invalid_request");

  const rows = await rpc<{ refund_payment_intent_id: string }[]>(db, "svc_founder_cancel_meetup", {
    p_meetup_id: meetupId,
    p_founder_id: founderId,
  });
  let refunded = 0;
  let refundFailed = 0;
  for (const r of rows) {
    if (await refund(db, stripe, r.refund_payment_intent_id)) refunded++;
    else refundFailed++;
  }
  return json({ refunded, refundFailed });
});
