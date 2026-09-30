import { ApiError, client, toApiError } from "./api";

/** Chiama una funzione server su Vercel (api/) con il token dell'utente collegato. */
export async function callServer<T>(path: string, body: unknown = {}): Promise<T> {
  const { data } = await client().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw toApiError({ message: "not_authenticated" });
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Connessione assente. Controlla la rete e riprova.");
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw toApiError({ message: json.error ?? "server_error" });
  return json;
}
