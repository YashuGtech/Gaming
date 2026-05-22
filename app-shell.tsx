import { Outlet, useRouter } from "@tanstack/react-router";
import { ReactNode, useEffect } from "react";
import { useSession } from "@/lib/session";
import { BottomNav } from "@/components/bottom-nav";
import { GoldLoader } from "@/components/gold-loader";
import { GoldFrame } from "@/components/gold-ui";

export function AppShell({ children }: { children?: ReactNode }) {
  const { loading, error, user, devMode, refresh } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !devMode) {
      // ignore — error component handles it
    }
  }, [loading, user, devMode, router]);

  if (loading) return <GoldLoader label="Authenticating with Telegram…" />;

  if (devMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <GoldFrame className="max-w-md p-6 text-center" glow>
          <h1 className="font-display text-3xl text-gradient-gold">GTech Fantasy</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This app runs inside Telegram. Open it from{" "}
            <a
              href="https://t.me/GtechBNB_bot"
              className="text-gold-soft underline"
              target="_blank"
              rel="noreferrer"
            >
              @GtechBNB_bot
            </a>{" "}
            to play.
          </p>
        </GoldFrame>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <GoldFrame className="max-w-sm p-6 text-center">
          <h1 className="font-display text-xl text-gold-soft">Authentication failed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error ?? "Unknown error"}</p>
          <button
            onClick={() => void refresh()}
            className="mt-4 rounded-md bg-gradient-gold-flat px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Retry
          </button>
        </GoldFrame>
      </div>
    );
  }

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md pb-20 bg-circuit">
      {children ?? <Outlet />}
      <BottomNav />
    </div>
  );
}
