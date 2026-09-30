// POST /api/close-account → { refunded, refundFailed }
// Chiude l'account: inviti futuri disdetti (rimborso se entro la disdetta gratuita),
// abbonamento non più rinnovato, dati personali cancellati dopo 30 giorni.
import { handle, json, requireUser, rpc } from "./_lib/http";
import { refund } from "./_lib/stripe";

type Row = { refund_payment_intent_id: string | null; stripe_subscription_id: string | null };

export const POST = handle(async (request, { db, stripe }) => {
  const profileId = await requireUser(request, db);
  const rows = await rpc<Row[]>(db, "svc_close_account", { p_profile_id: profileId });

  let refunded = 0;
  let refundFailed = 0;
  for (const r of rows) {
    if (r.refund_payment_intent_id) {
      if (await refund(db, stripe, r.refund_payment_intent_id)) refunded++;
      else refundFailed++;
    }
    if (r.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(r.stripe_subscription_id, { cancel_at_period_end: true });
      } catch (e) {
        console.error(`Abbonamento ${r.stripe_subscription_id} non fermato`, e);
      }
    }
  }
  return json({ refunded, refundFailed });
});
