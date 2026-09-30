// POST /api/checkout-subscription { plan: "monthly" | "yearly" } → { url } del Checkout Stripe.
import { handle, HttpError, json, origin, readJson, requireUser, rpc } from "./_lib/http";
import { ensureCustomer } from "./_lib/stripe";

export const POST = handle(async (request, { db, stripe }) => {
  const profileId = await requireUser(request, db);
  const { plan } = await readJson<{ plan?: string }>(request);
  if (plan !== "monthly" && plan !== "yearly") throw new HttpError(400, "invalid_plan");

  const amount = await rpc<number>(db, "svc_prepare_subscription_checkout", { p_profile_id: profileId, p_plan: plan });
  const customer = await ensureCustomer(db, stripe, profileId);
  const base = origin(request);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    locale: "it",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amount,
          recurring: { interval: plan === "monthly" ? "month" : "year" },
          product_data: { name: plan === "monthly" ? "Abbonamento CoffeeMeeting, mensile" : "Abbonamento CoffeeMeeting, annuale" },
        },
      },
    ],
    metadata: { profile_id: profileId, plan },
    subscription_data: { metadata: { profile_id: profileId, plan } },
    success_url: `${base}/account?abbonamento=attivato`,
    cancel_url: `${base}/abbonamento`,
  });
  return json({ url: session.url });
});
