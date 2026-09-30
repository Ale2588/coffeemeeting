import type Stripe from "stripe";
import type { Db } from "./deps";
import { rpc } from "./http";

/** Cliente Stripe dell'iscritto, creato alla prima occasione. */
export async function ensureCustomer(db: Db, stripe: Stripe, profileId: string): Promise<string> {
  const [row] = await rpc<{ stripe_customer_id: string | null; email: string; first_name: string }[]>(
    db,
    "svc_get_stripe_customer",
    { p_profile_id: profileId },
  );
  if (!row) throw new Error("profilo non trovato");
  if (row.stripe_customer_id) return row.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: row.email,
    name: row.first_name,
    metadata: { profile_id: profileId },
  });
  await rpc(db, "svc_set_stripe_customer", { p_profile_id: profileId, p_customer_id: customer.id });
  return customer.id;
}

/**
 * Rimborsa un pagamento e lo segna come rimborsato. Non solleva errori: se Stripe non
 * risponde, il rimborso resta da fare a mano (lo vede il fondatore nel pannello Stripe).
 */
export async function refund(db: Db, stripe: Stripe, paymentIntentId: string): Promise<boolean> {
  try {
    const r = await stripe.refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey: `refund-${paymentIntentId}` });
    await rpc(db, "svc_mark_refunded", { p_payment_intent_id: paymentIntentId, p_refund_id: r.id });
    return true;
  } catch (e) {
    console.error(`Rimborso non riuscito per ${paymentIntentId}`, e);
    return false;
  }
}

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

export function formatRome(iso: string): string {
  return dateFormat.format(new Date(iso));
}
