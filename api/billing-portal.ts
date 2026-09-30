// POST /api/billing-portal → { url } del portale Stripe (carta, disdetta dell'abbonamento, ricevute).
import { handle, json, origin, requireUser } from "./_lib/http";
import { ensureCustomer } from "./_lib/stripe";

export const POST = handle(async (request, { db, stripe }) => {
  const profileId = await requireUser(request, db);
  const customer = await ensureCustomer(db, stripe, profileId);
  const portal = await stripe.billingPortal.sessions.create({ customer, locale: "it", return_url: `${origin(request)}/account` });
  return json({ url: portal.url });
});
