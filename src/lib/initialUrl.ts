// Copia dell'URL d'arrivo, presa prima che il client Supabase ripulisca l'hash del link.
// Va importato per primo in main.tsx.
export const INITIAL_URL_PARAMS = new URLSearchParams(
  `${window.location.search.slice(1)}&${window.location.hash.slice(1)}`,
);
