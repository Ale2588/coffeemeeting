// POST /api/checkout-breakfast { invitationId } → { url } della pagina di pagamento Stripe.
import { handle, HttpError, json, origin, readJson, requireUser, rpc } from "./_lib/http";
import { ensureCustomer, formatRome } from "./_lib/stripe";

type Prepared = { amount_cents: number; starts_at: string; respond_by: string; venue_name: string | null };

export const POST = handle(async (request, { db, stripe }) => {
  const profileId = await requireUser(request, db);
  const { invitationId } = await readJson<{ invitationId?: number }>(request);
  if (!Number.isInteger(invitationId)) throw new HttpError(400, "invalid_request");

  const [prepared] = await rpc<Prepared[]>(db, "svc_prepare_breakfast_checkout", {
    p_invitation_id: invitationId,
    p_profile_id: profileId,
  });
  const customer = await ensureCustomer(db, stripe, profileId);
  const base = origin(request);
  const metadata = { invitation_id: String(invitationId), profile_id: profileId };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer,
    locale: "it",
    client_reference_id: String(invitationId),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: prepared.amount_cents,
          product_data: {
            name: `Colazione CoffeeMeeting · ${formatRome(prepared.starts_at)}`,
            ...(prepared.venue_name ? { description: prepared.venue_name } : {}),
          },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    success_url: `${base}/invito/${invitationId}?pagamento=ok`,
    cancel_url: `${base}/invito/${invitationId}?pagamento=annullato`,
    // Il minimo consentito da Stripe; un pagamento chiuso dopo la scadenza viene rimborsato.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });

  await rpc(db, "svc_record_checkout", {
    p_session_id: session.id,
    p_invitation_id: invitationId,
    p_profile_id: profileId,
    p_amount_cents: prepared.amount_cents,
  });
  return json({ url: session.url });
});
