import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { ApiError, fetchMyProfile, type MyProfile } from "../lib/api";

type State = { profile: MyProfile | null; loading: boolean; error: string | null };

export function useMyProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<State>({ profile: null, loading: true, error: null });

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const profile = await fetchMyProfile(userId);
      setState({ profile, loading: false, error: null });
    } catch (e) {
      setState({ profile: null, loading: false, error: e instanceof ApiError ? e.message : "Impossibile caricare i tuoi dati." });
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
