import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

/** Il sottoinsieme di Supabase che usano le funzioni server (sostituibile nei test). */
export type Db = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  getUserId: (accessToken: string) => Promise<string | null>;
};

export type Deps = { db: Db; stripe: Stripe; webhookSecret: string };

let override: Deps | null = null;

/** Solo per i test. */
export function setDeps(deps: Deps | null): void {
  override = deps;
}

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) throw new ConfigError(name);
  return value;
}

export class ConfigError extends Error {
  constructor(name: string) {
    super(`Variabile d'ambiente mancante: ${name}`);
  }
}

let cached: Deps | null = null;

export function deps(): Deps {
  if (override) return override;
  if (cached) return cached;
  const admin = createClient(env("SUPABASE_URL", "VITE_SUPABASE_URL").replace(/\/rest\/v1\/?$/, ""), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  cached = {
    db: {
      rpc: (fn, args) => admin.rpc(fn, args),
      getUserId: async (token) => {
        const { data, error } = await admin.auth.getUser(token);
        return error ? null : (data.user?.id ?? null);
      },
    },
    stripe: new Stripe(env("STRIPE_SECRET_KEY")),
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  };
  return cached;
}
