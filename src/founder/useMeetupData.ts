import { useCallback } from "react";
import {
  fetchBreakfastCounts,
  fetchMeetups,
  fetchMembers,
  fetchSettings,
  fetchSubscriptionStates,
  fetchVenues,
} from "./founderApi";
import { useAsync } from "./useAsync";

/** Tutto ciò che serve alle pagine dei tavoli, caricato in parallelo. */
export function useMeetupData() {
  const load = useCallback(async () => {
    const [members, meetups, venues, breakfasts, settings, subscriptions] = await Promise.all([
      fetchMembers(),
      fetchMeetups(),
      fetchVenues(),
      fetchBreakfastCounts(),
      fetchSettings(),
      fetchSubscriptionStates(),
    ]);
    return { members, meetups, venues, breakfasts, settings, subscriptions };
  }, []);
  return useAsync(load);
}
