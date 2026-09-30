import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type PublicPrices = { breakfastCents: number | null; monthlyCents: number | null; yearlyCents: number | null };

const NONE: PublicPrices = { breakfastCents: null, monthlyCents: null, yearlyCents: null };

/** Prezzi per le pagine pubbliche: null (segnaposto) finché il fondatore non li rende pubblici. */
export function usePublicPrices(): PublicPrices {
  const [prices, setPrices] = useState<PublicPrices>(NONE);
  useEffect(() => {
    if (!supabase) return;
    supabase.rpc("public_prices").then(({ data, error }) => {
      const r = !error && Array.isArray(data) ? (data[0] as { breakfast_cents: number | null; monthly_cents: number | null; yearly_cents: number | null } | undefined) : undefined;
      if (r) setPrices({ breakfastCents: r.breakfast_cents, monthlyCents: r.monthly_cents, yearlyCents: r.yearly_cents });
    });
  }, []);
  return prices;
}
