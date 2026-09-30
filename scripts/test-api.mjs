// Test delle funzioni server (api/) con Stripe e Supabase finti. Uso: npm run test:api
// I moduli TypeScript si caricano con Vite, senza dipendenze in più.
import assert from "node:assert/strict";
import { createServer } from "vite";
import Stripe from "stripe";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const load = (p) => vite.ssrLoadModule(p);
const { setDeps } = await load("/api/_lib/deps.ts");

const WEBHOOK_SECRET = "whsec_test";
let calls, rpcAnswers, stripeCalls, failRefund;

function fakeStripe() {
  const s = new Stripe("sk_test_finto");
  const rec = (name, result) => async (...args) => {
    stripeCalls.push([name, ...args]);
    if (typeof result === "function") return result(...args);
    return result;
  };
  s.customers.create = rec("customers.create", { id: "cus_1" });
  s.checkout.sessions.create = rec("sessions.create", { id: "cs_1", url: "https://checkout.stripe.test/cs_1" });
  s.checkout.sessions.list = rec("sessions.list", { data: [{ id: "cs_1" }] });
  s.checkout.sessions.retrieve = rec("sessions.retrieve", {
    id: "cs_1",
    payment_intent: { id: "pi_1", latest_charge: { payment_method_details: { card: { brand: "visa", last4: "4242" } } } },
  });
  s.refunds.create = rec("refunds.create", () => {
    if (failRefund) throw new Error("Stripe non risponde");
    return { id: "re_1" };
  });
  s.subscriptions.update = rec("subscriptions.update", {});
  s.billingPortal.sessions.create = rec("portal.create", { url: "https://billing.stripe.test/p" });
  return s;
}

function reset() {
  calls = [];
  stripeCalls = [];
  rpcAnswers = {};
  failRefund = false;
  setDeps({
    stripe: fakeStripe(),
    webhookSecret: WEBHOOK_SECRET,
    db: {
      getUserId: async (t) => (t === "tok-ada" ? "user-ada" : null),
      rpc: async (fn, args) => {
        calls.push([fn, args]);
        const a = rpcAnswers[fn];
        if (a instanceof Error) return { data: null, error: { message: a.message } };
        return { data: typeof a === "function" ? a(args) : (a ?? null), error: null };
      },
    },
  });
}

const req = (path, body, token = "tok-ada") =>
  new Request(`https://coffeemeeting.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
const called = (fn) => calls.filter((c) => c[0] === fn);
let passed = 0;
async function test(name, fn) {
  reset();
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

const breakfast = (await load("/api/checkout-breakfast.ts")).POST;
const subscription = (await load("/api/checkout-subscription.ts")).POST;
const cancel = (await load("/api/cancel-invitation.ts")).POST;
const founderCancel = (await load("/api/founder-cancel-meetup.ts")).POST;
const closeAccount = (await load("/api/close-account.ts")).POST;
const portal = (await load("/api/billing-portal.ts")).POST;
const webhook = (await load("/api/stripe-webhook.ts")).POST;

await test("senza accesso: 401", async () => {
  const r = await breakfast(req("/api/checkout-breakfast", { invitationId: 7 }, null));
  assert.equal(r.status, 401);
  assert.equal(called("svc_prepare_breakfast_checkout").length, 0);
});

await test("checkout della colazione", async () => {
  rpcAnswers.svc_prepare_breakfast_checkout = [{ amount_cents: 800, starts_at: "2026-10-06T05:45:00Z", respond_by: "2026-10-04T18:00:00Z", venue_name: "Bar Esempio" }];
  rpcAnswers.svc_get_stripe_customer = [{ stripe_customer_id: null, email: "ada@e.it", first_name: "Ada" }];
  const r = await breakfast(req("/api/checkout-breakfast", { invitationId: 7 }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { url: "https://checkout.stripe.test/cs_1" });
  const [, params] = stripeCalls.find((c) => c[0] === "sessions.create");
  assert.equal(params.mode, "payment");
  assert.equal(params.customer, "cus_1");
  assert.equal(params.line_items[0].price_data.unit_amount, 800);
  assert.match(params.line_items[0].price_data.product_data.name, /martedì 6 ottobre/);
  assert.match(params.line_items[0].price_data.product_data.name, /7:45/);
  assert.equal(params.success_url, "https://coffeemeeting.test/invito/7?pagamento=ok");
  assert.equal(params.payment_intent_data.metadata.invitation_id, "7");
  assert.deepEqual(called("svc_set_stripe_customer")[0][1], { p_profile_id: "user-ada", p_customer_id: "cus_1" });
  assert.deepEqual(called("svc_record_checkout")[0][1], { p_session_id: "cs_1", p_invitation_id: 7, p_profile_id: "user-ada", p_amount_cents: 800 });
});

await test("abbonamento necessario: 400 con codice", async () => {
  rpcAnswers.svc_prepare_breakfast_checkout = new Error('ERROR: subscription_required');
  const r = await breakfast(req("/api/checkout-breakfast", { invitationId: 7 }));
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: "subscription_required" });
  assert.equal(stripeCalls.length, 0);
});

await test("richiesta non valida", async () => {
  const r = await breakfast(req("/api/checkout-breakfast", { invitationId: "7" }));
  assert.equal(r.status, 400);
});

await test("checkout dell'abbonamento annuale", async () => {
  rpcAnswers.svc_prepare_subscription_checkout = 9900;
  rpcAnswers.svc_get_stripe_customer = [{ stripe_customer_id: "cus_9", email: "ada@e.it", first_name: "Ada" }];
  const r = await subscription(req("/api/checkout-subscription", { plan: "yearly" }));
  assert.equal(r.status, 200);
  const [, params] = stripeCalls.find((c) => c[0] === "sessions.create");
  assert.equal(params.mode, "subscription");
  assert.equal(params.customer, "cus_9");
  assert.equal(params.line_items[0].price_data.recurring.interval, "year");
  assert.equal(params.line_items[0].price_data.unit_amount, 9900);
  assert.equal(params.subscription_data.metadata.profile_id, "user-ada");
  assert.equal(stripeCalls.filter((c) => c[0] === "customers.create").length, 0);
});

await test("piano non valido", async () => {
  const r = await subscription(req("/api/checkout-subscription", { plan: "weekly" }));
  assert.deepEqual(await r.json(), { error: "invalid_plan" });
});

await test("disdetta con rimborso", async () => {
  rpcAnswers.svc_cancel_invitation = [{ free: true, refund_payment_intent_id: "pi_1", refund_amount_cents: 800 }];
  const r = await cancel(req("/api/cancel-invitation", { invitationId: 7 }));
  assert.deepEqual(await r.json(), { free: true, refundedCents: 800, refundFailed: false });
  assert.equal(stripeCalls.find((c) => c[0] === "refunds.create")[1].payment_intent, "pi_1");
  assert.deepEqual(called("svc_mark_refunded")[0][1], { p_payment_intent_id: "pi_1", p_refund_id: "re_1" });
});

await test("disdetta tardiva: nessun rimborso", async () => {
  rpcAnswers.svc_cancel_invitation = [{ free: false, refund_payment_intent_id: null, refund_amount_cents: null }];
  const r = await cancel(req("/api/cancel-invitation", { invitationId: 7 }));
  assert.deepEqual(await r.json(), { free: false, refundedCents: null, refundFailed: false });
  assert.equal(stripeCalls.length, 0);
});

await test("rimborso che non parte: segnalato, disdetta valida", async () => {
  rpcAnswers.svc_cancel_invitation = [{ free: true, refund_payment_intent_id: "pi_1", refund_amount_cents: 800 }];
  failRefund = true;
  const r = await cancel(req("/api/cancel-invitation", { invitationId: 7 }));
  assert.deepEqual(await r.json(), { free: true, refundedCents: null, refundFailed: true });
  assert.equal(called("svc_mark_refunded").length, 0);
});

await test("il fondatore annulla un tavolo: rimborsi", async () => {
  rpcAnswers.svc_founder_cancel_meetup = [{ refund_payment_intent_id: "pi_1" }, { refund_payment_intent_id: "pi_2" }];
  const r = await founderCancel(req("/api/founder-cancel-meetup", { meetupId: 3 }));
  assert.deepEqual(await r.json(), { refunded: 2, refundFailed: 0 });
  assert.deepEqual(called("svc_founder_cancel_meetup")[0][1], { p_meetup_id: 3, p_founder_id: "user-ada" });
});

await test("chi non è fondatore non annulla", async () => {
  rpcAnswers.svc_founder_cancel_meetup = new Error("not_allowed");
  const r = await founderCancel(req("/api/founder-cancel-meetup", { meetupId: 3 }));
  assert.equal(r.status, 403);
});

await test("chiusura dell'account: rimborso e abbonamento fermato", async () => {
  rpcAnswers.svc_close_account = [
    { refund_payment_intent_id: "pi_1", stripe_subscription_id: null },
    { refund_payment_intent_id: null, stripe_subscription_id: "sub_1" },
  ];
  const r = await closeAccount(req("/api/close-account", {}));
  assert.deepEqual(await r.json(), { refunded: 1, refundFailed: 0 });
  const upd = stripeCalls.find((c) => c[0] === "subscriptions.update");
  assert.deepEqual(upd.slice(1), ["sub_1", { cancel_at_period_end: true }]);
});

await test("portale di Stripe", async () => {
  rpcAnswers.svc_get_stripe_customer = [{ stripe_customer_id: "cus_9", email: "ada@e.it", first_name: "Ada" }];
  const r = await portal(req("/api/billing-portal", {}));
  assert.deepEqual(await r.json(), { url: "https://billing.stripe.test/p" });
  assert.equal(stripeCalls.find((c) => c[0] === "portal.create")[1].return_url, "https://coffeemeeting.test/account");
});

// ---- Webhook ----
const stripeForSign = new Stripe("sk_test_finto");
function signed(event) {
  const payload = JSON.stringify(event);
  const header = stripeForSign.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return new Request("https://coffeemeeting.test/api/stripe-webhook", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
}
const evt = (id, type, object) => ({ id, object: "event", type, data: { object }, api_version: "2025-01-01", created: 1, livemode: false, pending_webhooks: 0, request: null });

await test("webhook con firma sbagliata: 400", async () => {
  const r = await webhook(new Request("https://coffeemeeting.test/api/stripe-webhook", { method: "POST", headers: { "stripe-signature": "t=1,v1=xx" }, body: "{}" }));
  assert.equal(r.status, 400);
  assert.equal(calls.length, 0);
});

await test("webhook: colazione pagata e confermata", async () => {
  rpcAnswers.svc_register_stripe_event = true;
  rpcAnswers.svc_payment_succeeded = "confirmed";
  const r = await webhook(signed(evt("evt_1", "checkout.session.completed", { id: "cs_1", object: "checkout.session", mode: "payment" })));
  assert.equal(r.status, 200);
  assert.deepEqual(called("svc_payment_succeeded")[0][1], { p_session_id: "cs_1", p_payment_intent_id: "pi_1", p_card_brand: "visa", p_card_last4: "4242" });
  assert.equal(stripeCalls.filter((c) => c[0] === "refunds.create").length, 0);
});

await test("webhook: pagamento arrivato quando l'invito non vale più → rimborso", async () => {
  rpcAnswers.svc_register_stripe_event = true;
  rpcAnswers.svc_payment_succeeded = "refund";
  await webhook(signed(evt("evt_2", "checkout.session.completed", { id: "cs_1", object: "checkout.session", mode: "payment" })));
  assert.equal(stripeCalls.find((c) => c[0] === "refunds.create")[1].payment_intent, "pi_1");
});

await test("webhook ripetuto: ignorato", async () => {
  rpcAnswers.svc_register_stripe_event = false;
  const r = await webhook(signed(evt("evt_1", "checkout.session.completed", { id: "cs_1", object: "checkout.session", mode: "payment" })));
  assert.deepEqual(await r.json(), { received: true, duplicate: true });
  assert.equal(called("svc_payment_succeeded").length, 0);
});

await test("webhook: carta rifiutata con ultime 4 cifre", async () => {
  rpcAnswers.svc_register_stripe_event = true;
  await webhook(signed(evt("evt_3", "payment_intent.payment_failed", {
    id: "pi_9", object: "payment_intent",
    last_payment_error: { message: "La carta è stata rifiutata.", payment_method: { card: { brand: "visa", last4: "0002" } } },
  })));
  assert.deepEqual(called("svc_payment_failed")[0][1], { p_payment_intent_id: "pi_9", p_session_id: "cs_1", p_card_brand: "visa", p_card_last4: "0002", p_message: "La carta è stata rifiutata." });
});

await test("webhook: abbonamento aggiornato (fine periodo dalla voce)", async () => {
  rpcAnswers.svc_register_stripe_event = true;
  await webhook(signed(evt("evt_4", "customer.subscription.updated", {
    id: "sub_1", object: "subscription", customer: "cus_1", status: "active", cancel_at_period_end: true, metadata: { profile_id: "user-ada" },
    items: { data: [{ price: { recurring: { interval: "month" } }, current_period_end: 1793000000 }] },
  })));
  assert.deepEqual(called("svc_upsert_subscription")[0][1], {
    p_stripe_subscription_id: "sub_1", p_stripe_customer_id: "cus_1", p_profile_id: "user-ada", p_plan: "monthly",
    p_stripe_status: "active", p_current_period_end: new Date(1793000000 * 1000).toISOString(), p_cancel_at_period_end: true,
  });
});

await test("webhook: errore durante l'elaborazione → evento dimenticato, 500", async () => {
  rpcAnswers.svc_register_stripe_event = true;
  rpcAnswers.svc_payment_succeeded = new Error("connessione persa");
  const r = await webhook(signed(evt("evt_5", "checkout.session.completed", { id: "cs_1", object: "checkout.session", mode: "payment" })));
  assert.equal(r.status, 500);
  assert.deepEqual(called("svc_forget_stripe_event")[0][1], { p_event_id: "evt_5" });
});

await test("variabili d'ambiente mancanti: 503", async () => {
  setDeps(null);
  const saved = { ...process.env };
  delete process.env.SUPABASE_URL; delete process.env.VITE_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.STRIPE_SECRET_KEY;
  const r = await breakfast(req("/api/checkout-breakfast", { invitationId: 7 }));
  process.env = saved;
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: "payments_unavailable" });
});

await vite.close();
console.log(`\nTUTTI I ${passed} TEST DELLE FUNZIONI SERVER SONO PASSATI`);
