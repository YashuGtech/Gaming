/**
 * Referral tracking — list a user's referrals + summary.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireUser } from "@/lib/auth-helpers.server";

const InitOnly = z.object({ initData: z.string().min(1).max(4096) });

export const getMyReferrals = createServerFn({ method: "POST" })
  .inputValidator((input) => InitOnly.parse(input))
  .handler(async ({ data }) => {
    const { user } = await requireUser(data.initData);

    const { data: refs } = await supabaseAdmin
      .from("referrals")
      .select("referred_id, reward_gtc, created_at")
      .eq("referrer_id", user.telegram_id)
      .order("created_at", { ascending: false })
      .limit(100);

    const ids = (refs ?? []).map((r) => Number(r.referred_id));
    let userMap = new Map<number, { username: string | null; first_name: string | null }>();
    if (ids.length) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("telegram_id, username, first_name")
        .in("telegram_id", ids);
      (users ?? []).forEach((u) => {
        userMap.set(Number(u.telegram_id), {
          username: u.username,
          first_name: u.first_name,
        });
      });
    }

    const totalEarned = (refs ?? []).reduce((sum, r) => sum + Number(r.reward_gtc), 0);

    return {
      count: refs?.length ?? 0,
      totalEarned,
      referrals: (refs ?? []).map((r) => {
        const u = userMap.get(Number(r.referred_id));
        return {
          referred_id: Number(r.referred_id),
          username: u?.username ?? null,
          first_name: u?.first_name ?? null,
          reward_gtc: Number(r.reward_gtc),
          created_at: r.created_at,
        };
      }),
    };
  });
