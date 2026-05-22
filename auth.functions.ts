/**
 * Telegram-auth server functions for GTech Fantasy.
 * Each protected fn takes { initData } as the auth proof and re-verifies it server-side.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyInitData, type TelegramUser } from "@/lib/telegram.server";

const InitDataSchema = z.object({
  initData: z.string().min(1).max(4096),
});

async function authenticate(initData: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  const verified = verifyInitData(initData, token);
  if (!verified) throw new Error("Invalid Telegram authentication");
  return verified;
}

async function upsertUser(tgUser: TelegramUser, startParam?: string) {
  // Insert or update user; handle referral on first insert only.
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("telegram_id, referrer_id")
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  if (!existing) {
    let referrerId: number | null = null;
    if (startParam && /^\d+$/.test(startParam)) {
      const candidate = Number(startParam);
      if (candidate !== tgUser.id) {
        const { data: refUser } = await supabaseAdmin
          .from("users")
          .select("telegram_id")
          .eq("telegram_id", candidate)
          .maybeSingle();
        if (refUser) referrerId = candidate;
      }
    }

    await supabaseAdmin.from("users").insert({
      telegram_id: tgUser.id,
      username: tgUser.username ?? null,
      first_name: tgUser.first_name ?? null,
      last_name: tgUser.last_name ?? null,
      photo_url: tgUser.photo_url ?? null,
      language_code: tgUser.language_code ?? null,
      is_premium: !!tgUser.is_premium,
      referrer_id: referrerId,
    });

    // Credit referrer
    if (referrerId) {
      const { data: settingRow } = await supabaseAdmin
        .from("settings")
        .select("value")
        .eq("key", "refer_reward_gtc")
        .maybeSingle();
      const reward = Number(settingRow?.value ?? 50);

      await supabaseAdmin.from("referrals").insert({
        referrer_id: referrerId,
        referred_id: tgUser.id,
        reward_gtc: reward,
      });

      const { data: refRow } = await supabaseAdmin
        .from("users")
        .select("balance_gtc")
        .eq("telegram_id", referrerId)
        .single();
      const newBal = Number(refRow?.balance_gtc ?? 0) + reward;
      await supabaseAdmin
        .from("users")
        .update({ balance_gtc: newBal })
        .eq("telegram_id", referrerId);
      await supabaseAdmin.from("transactions").insert({
        user_id: referrerId,
        kind: "referral_bonus",
        amount_gtc: reward,
        balance_after: newBal,
        note: `Referred ${tgUser.username ?? tgUser.id}`,
      });
    }
  } else {
    await supabaseAdmin
      .from("users")
      .update({
        username: tgUser.username ?? null,
        first_name: tgUser.first_name ?? null,
        last_name: tgUser.last_name ?? null,
        photo_url: tgUser.photo_url ?? null,
        is_premium: !!tgUser.is_premium,
        last_seen: new Date().toISOString(),
      })
      .eq("telegram_id", tgUser.id);
  }
}

export const bootstrapUser = createServerFn({ method: "POST" })
  .inputValidator((input) => InitDataSchema.parse(input))
  .handler(async ({ data }) => {
    const v = await authenticate(data.initData);
    await upsertUser(v.user, v.start_param);

    const [{ data: user }, { data: adminRow }, { data: settings }, { data: ann }] =
      await Promise.all([
        supabaseAdmin.from("users").select("*").eq("telegram_id", v.user.id).single(),
        supabaseAdmin.from("admins").select("role").eq("telegram_id", v.user.id).maybeSingle(),
        supabaseAdmin.from("settings").select("key, value"),
        supabaseAdmin
          .from("announcements")
          .select("*")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    const settingsMap: Record<string, string | number | boolean | null> = {};
    (settings ?? []).forEach((s) => {
      settingsMap[s.key] = s.value as string | number | boolean | null;
    });

    return {
      user,
      admin: adminRow ? { role: adminRow.role as "main" | "secondary" } : null,
      settings: settingsMap,
      announcements: ann ?? [],
    };
  });

