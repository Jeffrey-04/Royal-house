import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "client" | "restaurant" | "courier";

export interface SessionState {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    session: null,
    user: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    const loadRole = async (userId: string): Promise<AppRole | null> => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      return (data?.role as AppRole) ?? null;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setState({ session: null, user: null, role: null, loading: false });
        return;
      }
      setState((s) => ({ ...s, session, user: session.user, loading: true }));
      // defer to avoid deadlock
      setTimeout(async () => {
        const role = await loadRole(session.user.id);
        if (mounted) setState({ session, user: session.user, role, loading: false });
      }, 0);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (!session?.user) {
        setState({ session: null, user: null, role: null, loading: false });
        return;
      }
      const role = await loadRole(session.user.id);
      if (mounted) setState({ session, user: session.user, role, loading: false });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
