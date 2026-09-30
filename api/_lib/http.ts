import { ConfigError, deps, type Db } from "./deps";

/** Errore con un codice che il client traduce in italiano (vedi src/lib/api.ts). */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Codici sollevati dalle funzioni SQL con `raise exception '<codice>'`.
const KNOWN = [
  "not_found",
  "not_allowed",
  "meetup_cancelled",
  "already_paid",
  "invitation_expired",
  "subscription_required",
  "already_subscribed",
  "invalid_plan",
  "not_cancellable",
  "too_late",
  "not_editable",
];

/** Chiama una funzione SQL; gli errori noti diventano 400 con il loro codice. */
export async function rpc<T>(db: Db, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    const code = KNOWN.find((k) => error.message.includes(k));
    if (code) throw new HttpError(code === "not_found" ? 404 : code === "not_allowed" ? 403 : 400, code);
    throw new Error(`${fn}: ${error.message}`);
  }
  return data as T;
}

export async function requireUser(request: Request, db: Db): Promise<string> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "not_authenticated");
  const id = await db.getUserId(token);
  if (!id) throw new HttpError(401, "not_authenticated");
  return id;
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "invalid_request");
  }
}

/** Indirizzo del sito da cui arriva la richiesta, per i ritorni da Stripe. */
export function origin(request: Request): string {
  return process.env.SITE_URL?.replace(/\/+$/, "") ?? new URL(request.url).origin;
}

/** Avvolge un handler: dipendenze, errori noti e log di quelli imprevisti. */
export function handle(fn: (request: Request, d: ReturnType<typeof deps>) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await fn(request, deps());
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code }, e.status);
      if (e instanceof ConfigError) {
        console.error(e.message);
        return json({ error: "payments_unavailable" }, 503);
      }
      console.error(e);
      return json({ error: "server_error" }, 500);
    }
  };
}
