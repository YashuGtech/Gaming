/**
 * App-wide session context. Bootstraps the Telegram user once and
 * exposes user/admin/settings/announcements to every route.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useTelegramWebApp } from "@/lib/telegram-webapp";
import { bootstrapUser } from "@/lib/auth.functions";

type SessionUser = {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  is_premium: boolean | null;
  balance_gtc: number;
  banned: boolean;
};

type SessionData = {
  user: SessionUser | null;
  admin: { role: "main" | "secondary" } | null;
  settings: Record<string, string | number | boolean | null>;
  announcements: Array<{ id: string; title: string; body: string; created_at: string }>;
};

type SessionCtx = SessionData & {
  initData: string | null;
  loading: boolean;
  error: string | null;
  devMode: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { initData, ready, devMode } = useTelegramWebApp();
  const [state, setState] = useState<SessionData>({
    user: null,
    admin: null,
    settings: {},
    announcements: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await bootstrapUser({ data: { initData: id } });
      setState({
        user: res.user as SessionUser | null,
        admin: res.admin,
        settings: res.settings,
        announcements: res.announcements as SessionData["announcements"],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (initData) {
      void load(initData);
    } else if (devMode) {
      // Dev preview outside Telegram → show a friendly notice instead of crashing
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, initData, devMode]);

  return (
    <Ctx.Provider
      value={{
        ...state,
        initData,
        loading,
        error,
        devMode,
        refresh: async () => {
          if (initData) await load(initData);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}
