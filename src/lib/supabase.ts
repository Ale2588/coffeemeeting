import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Accetta anche l'indirizzo copiato con "/rest/v1/" in fondo o con spazi. */
function normalizeUrl(raw: string | undefined): string | undefined {
  const url = raw?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  return url || undefined;
}

const url = normalizeUrl(import.meta.env.VITE_SUPABASE_URL);
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** Motivo per cui il client non è disponibile, da mostrare invece di una pagina bianca. */
export let supabaseConfigError: string | null = null;

function create(): SupabaseClient | null {
  if (!url || !anonKey) {
    supabaseConfigError = "Mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.";
    return null;
  }
  if (!/^https?:\/\//.test(url)) {
    supabaseConfigError = `VITE_SUPABASE_URL deve iniziare con https:// (valore attuale: "${url}").`;
    return null;
  }
  try {
    // Flusso "implicit": il link via email funziona anche se si apre in un browser diverso
    // da quello in cui è stato chiesto (tipico sul telefono, dall'app di posta).
    return createClient(url, anonKey, {
      auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch (e) {
    supabaseConfigError = `Configurazione di Supabase non valida: ${e instanceof Error ? e.message : String(e)}`;
    return null;
  }
}

export const supabase: SupabaseClient | null = create();
