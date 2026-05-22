/**
 * Telegram WebApp SDK bridge — client-only.
 * Loads the WebApp script and exposes initData + user info.
 */
import { useEffect, useState } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          user?: { id: number; username?: string; first_name?: string };
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        setHeaderColor?: (c: string) => void;
        setBackgroundColor?: (c: string) => void;
        HapticFeedback?: {
          impactOccurred: (s: "light" | "medium" | "heavy") => void;
          notificationOccurred: (s: "error" | "success" | "warning") => void;
        };
        showAlert?: (msg: string) => void;
      };
    };
  }
}

export function useTelegramWebApp() {
  const [initData, setInitData] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const attach = () => {
      const tg = window.Telegram?.WebApp;
      if (tg && tg.initData) {
        tg.ready();
        tg.expand();
        tg.setBackgroundColor?.("#0a0a0a");
        tg.setHeaderColor?.("#0a0a0a");
        if (!cancelled) {
          setInitData(tg.initData);
          setReady(true);
        }
        return true;
      }
      return false;
    };

    // Script may already be there
    if (attach()) return;

    const existing = document.getElementById("tg-webapp-script");
    if (!existing) {
      const s = document.createElement("script");
      s.id = "tg-webapp-script";
      s.src = "https://telegram.org/js/telegram-web-app.js";
      s.async = true;
      s.onload = () => {
        if (!attach() && !cancelled) {
          // Outside Telegram → enable dev mode for local previewing
          setDevMode(true);
          setReady(true);
        }
      };
      s.onerror = () => {
        if (!cancelled) {
          setDevMode(true);
          setReady(true);
        }
      };
      document.head.appendChild(s);
    } else {
      // Wait a tick
      setTimeout(() => {
        if (!attach() && !cancelled) {
          setDevMode(true);
          setReady(true);
        }
      }, 200);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return { initData, ready, devMode };
}

export function hapticTap(kind: "light" | "medium" | "heavy" = "light") {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(kind);
  } catch {
    /* noop */
  }
}

export function hapticNotify(kind: "success" | "error" | "warning") {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(kind);
  } catch {
    /* noop */
  }
}
