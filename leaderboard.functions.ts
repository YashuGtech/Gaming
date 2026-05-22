/**
 * Leaderboard server functions (public to logged-in users).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireUser } from "@/lib/auth-helpers.server";

const Input = z.object({ initData: z.string().min(1).max(4096) });

export type LbRow = {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  value: number;
  is_premium: boolean;
  level: number;
  badge: "diamond" | "gold" | "silver" | "bronze" | null;
};

function badgeFor(balance: number): LbRow["badge"] {
  if (balance >= 10000) return "diamond";
  if (balance >= 1000) return "gold";
  if (balance >= 250) return "silver";
  if (balance >= 50) return "bronze";
  return null;
}

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }) => {
    await requireUser(data.initData);

    // Top by balance
    const { data: topBal } = await supabaseAdmin
      .from("users")
      .select("telegram_id, username, first_name, balance_gtc, is_premium")
      .eq("banned", false)
      .order("balance_gtc", { ascending: false })
      .limit(50);

    // Levels reached per user — count of distinct completed levels.
    const { data: sessions } = await supabaseAdmin
      .from("game_sessions")
      .select("user_id, level_id, status")
      .eq("status", "completed");
    const levelMap = new Map<number, Set<string>>();
    (sessions ?? []).forEach((s: { user_id: number | string; level_id: string | null; status: string }) => {
      const uid = Number(s.user_id);
      if (!levelMap.has(uid)) levelMap.set(uid, new Set());
      levelMap.get(uid)!.add(String(s.level_id));
    });
    const levelOf = (id: number) => levelMap.get(id)?.size ?? 0;

    // Top by referral count — aggregate from referrals table.
    const { data: refRows } = await supabaseAdmin
      .from("referrals")
      .select("referrer_id");
    const counts = new Map<number, number>();
    (refRows ?? []).forEach((r: { referrer_id: number | string }) => {
      const id = Number(r.referrer_id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    const topRefIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);

    type UserRow = {
      telegram_id: number | string;
      username: string | null;
      first_name: string | null;
      balance_gtc: number | string;
      is_premium: boolean | null;
    };

    let topRefRows: LbRow[] = [];
    if (topRefIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("telegram_id, username, first_name, balance_gtc, is_premium")
        .in(
          "telegram_id",
          topRefIds.map(([id]) => id),
        );
      const userMap = new Map(
        ((users ?? []) as UserRow[]).map((u) => [Number(u.telegram_id), u]),
      );
      topRefRows = topRefIds
        .map(([id, count]) => {
          const u = userMap.get(id);
          if (!u) return null;
          return {
            telegram_id: id,
            username: u.username,
            first_name: u.first_name,
            value: count,
            is_premium: !!u.is_premium,
            level: levelOf(id),
            badge: badgeFor(Number(u.balance_gtc)),
          } as LbRow;
        })
        .filter((x): x is LbRow => x !== null);
    }

    const topBalRows: LbRow[] = ((topBal ?? []) as UserRow[]).map((u) => ({
      telegram_id: Number(u.telegram_id),
      username: u.username,
      first_name: u.first_name,
      value: Number(u.balance_gtc),
      is_premium: !!u.is_premium,
      level: levelOf(Number(u.telegram_id)),
      badge: badgeFor(Number(u.balance_gtc)),
    }));

    return { topBalance: topBalRows, topReferrers: topRefRows };
  });
