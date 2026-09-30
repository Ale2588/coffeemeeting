import { client, toApiError } from "./api";
import { callServer } from "./serverApi";

export type Plan = "monthly" | "yearly";

export type MySubscription = {
  plan: Plan | null;
  stripeStatus: string | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  active: boolean;
  needsSubscription: boolean;
  confirmedBreakfasts: number;
  reminderOn: string | null;
  monthlyCents: number;
  yearlyCents: number;
};

type Row = {
  plan: Plan | null;
  stripe_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  active: boolean;
  needs_subscription: boolean;
  confirmed_breakfasts: number;
  reminder_on: string | null;
  monthly_cents: number;
  yearly_cents: number;
};

export async function fetchMySubscription(): Promise<MySubscription> {
  const { data, error } = await client().rpc("my_subscription");
  if (error) throw toApiError(error);
  const r = (data as Row[])[0];
  return {
    plan: r.plan,
    stripeStatus: r.stripe_status,
    periodEnd: r.current_period_end ? new Date(r.current_period_end) : null,
    cancelAtPeriodEnd: r.cancel_at_period_end,
    active: r.active,
    needsSubscription: r.needs_subscription,
    confirmedBreakfasts: r.confirmed_breakfasts,
    reminderOn: r.reminder_on,
    monthlyCents: r.monthly_cents,
    yearlyCents: r.yearly_cents,
  };
}

/** Stato leggibile dell'abbonamento, per la pagina dell'iscritto. */
export type SubscriptionView =
  | { kind: "not_needed" }
  | { kind: "inactive" }
  | { kind: "expired" }
  | { kind: "active"; plan: Plan; renewsOn: Date | null }
  | { kind: "ending"; plan: Plan; endsOn: Date | null }
  | { kind: "past_due"; plan: Plan };

export function subscriptionView(s: MySubscription): SubscriptionView {
  if (s.active && s.plan) {
    if (s.stripeStatus === "past_due") return { kind: "past_due", plan: s.plan };
    if (s.cancelAtPeriodEnd) return { kind: "ending", plan: s.plan, endsOn: s.periodEnd };
    return { kind: "active", plan: s.plan, renewsOn: s.periodEnd };
  }
  if (s.plan) return { kind: "expired" };
  return s.needsSubscription ? { kind: "inactive" } : { kind: "not_needed" };
}

export async function startSubscriptionCheckout(plan: Plan): Promise<string> {
  const { url } = await callServer<{ url: string }>("checkout-subscription", { plan });
  return url;
}

export async function openBillingPortal(): Promise<string> {
  const { url } = await callServer<{ url: string }>("billing-portal");
  return url;
}

export async function remindLater(): Promise<string> {
  const { data, error } = await client().rpc("remind_subscription_later");
  if (error) throw toApiError(error);
  return data as string;
}

export async function closeAccount(): Promise<{ refunded: number; refundFailed: number }> {
  return callServer("close-account");
}

export async function reopenAccount(): Promise<void> {
  const { error } = await client().rpc("reopen_my_account");
  if (error) throw toApiError(error);
}
