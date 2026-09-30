// POST /api/stripe-webhook — eventi da Stripe (firma verificata con STRIPE_WEBHOOK_SECRET).
import type Stripe from "stripe";
import type { Db } from "./_lib/deps";
import { handle, json, rpc } from "./_lib/http";
import { refund } from "./_lib/stripe";

export const POST = handle(async (request, { db, stripe, webhookSecret }) => {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  if (!signature || !webhookSecret) return json({ error: "invalid_signature" }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch {
    return json({ error: "invalid_signature" }, 400);
  }

  const fresh = await rpc<boolean>(db, "svc_register_stripe_event", { p_event_id: event.id, p_type: event.type });
  if (!fresh) return json({ received: true, duplicate: true });

  try {
    await dispatch(event, db, stripe);
  } catch (e) {
    // Si dimentica l'evento: Stripe lo rimanda e verrà rielaborato.
    await rpc(db, "svc_forget_stripe_event", { p_event_id: event.id });
    throw e;
  }
  return json({ received: true });
});

async function dispatch(event: Stripe.Event, db: Db, stripe: Stripe): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "payment") await breakfastPaid(session.id, db, stripe);
      if (session.mode === "subscription" && typeof session.subscription === "string") {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        await upsertSubscription(sub, db);
      }
      return;
    }
    case "checkout.session.expired":
      if (event.data.object.mode === "payment") await rpc(db, "svc_checkout_expired", { p_session_id: event.data.object.id });
      return;
    case "checkout.session.async_payment_failed":
      await rpc(db, "svc_payment_failed", {
        p_payment_intent_id: null,
        p_session_id: event.data.object.id,
        p_card_brand: null,
        p_card_last4: null,
        p_message: "Pagamento non riuscito",
      });
      return;
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
      const pm = pi.last_payment_error?.payment_method;
      await rpc(db, "svc_payment_failed", {
        p_payment_intent_id: pi.id,
        p_session_id: sessions.data[0]?.id ?? null,
        p_card_brand: pm?.card?.brand ?? null,
        p_card_last4: pm?.card?.last4 ?? null,
        p_message: pi.last_payment_error?.message ?? null,
      });
      return;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      const refundId = charge.refunds?.data[0]?.id ?? "manuale";
      if (pi) await rpc(db, "svc_mark_refunded", { p_payment_intent_id: pi, p_refund_id: refundId });
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await upsertSubscription(event.data.object, db);
      return;
    default:
      return;
  }
}

async function breakfastPaid(sessionId: string, db: Db, stripe: Stripe): Promise<void> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
  const pi = session.payment_intent as Stripe.PaymentIntent | null;
  if (!pi) return;
  const charge = pi.latest_charge as Stripe.Charge | null;
  const card = charge?.payment_method_details?.card;
  const result = await rpc<string>(db, "svc_payment_succeeded", {
    p_session_id: session.id,
    p_payment_intent_id: pi.id,
    p_card_brand: card?.brand ?? null,
    p_card_last4: card?.last4 ?? null,
  });
  // L'invito non era più valido (scaduto o tavolo annullato): rimborso completo.
  if (result === "refund") await refund(db, stripe, pi.id);
}

async function upsertSubscription(sub: Stripe.Subscription, db: Db): Promise<void> {
  const item = sub.items.data[0];
  const interval = item?.price?.recurring?.interval;
  // Nelle versioni recenti dell'API la fine del periodo sta sulla voce dell'abbonamento.
  const periodEnd =
    (item as { current_period_end?: number } | undefined)?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  await rpc(db, "svc_upsert_subscription", {
    p_stripe_subscription_id: sub.id,
    p_stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    p_profile_id: sub.metadata?.profile_id || null,
    p_plan: interval === "year" ? "yearly" : "monthly",
    p_stripe_status: sub.status,
    p_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    p_cancel_at_period_end: sub.cancel_at_period_end,
  });
}
