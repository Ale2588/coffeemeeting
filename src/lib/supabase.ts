import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Client Supabase, oppure null se mancano le variabili d'ambiente (vedi .env.example).
 * Flusso "implicit": il link via email funziona anche se si apre in un browser diverso
 * da quello in cui è stato chiesto (tipico sul telefono, dall'app di posta).
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;
