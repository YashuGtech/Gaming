/**
 * Game server functions.
 * Picks one of 20 procedural map templates per round, applies admin overrides
 * (duration + reward), tracks user progression up to a 100-level cap.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireUser } from "@/lib/auth-helpers.server";
import { MAP_TEMPLATES, pickMap } from "@/lib/maps.server";

const InitOnly = z.object({ initData: z.string().min(1).max(4096) });

export type LevelObject = {
  id: string;
  obj_type:
    | "pipe"
    | "coin"
    | "bear"
    | "spike"
    | "poll"
    | "wall"
    | "block"
    | "gate"
    | "blade"
    | "hammer"
    | "laser"
    | "shooter";
  x_time: number;
  y: number;
  props: Record<string, number | string | boolean>;
};

async function loadSettings() {
  const { data: rows } = await supabaseAdmin.from("settings").select("key, value");
  const map: Record<string, unknown> = {};
  (rows ?? []).forEach((r) => {
    map[r.key] = r.value;
  });
  return {
    enabled: map.game_enabled !== false,
    duration: Math.max(15, Math.min(300, Number(map.level_duration_seconds ?? 45))),
    rewardPerCoin: Math.max(0, Number(map.level_reward_per_coin ?? 1)),
    cap: Math.max(1, Math.min(1000, Number(map.level_cap ?? 100))),
  };
}

export const startGame = createServerFn({ method: "POST" })
  .inputValidator((input) => InitOnly.parse(input))
  .handler(async ({ data }) => {
    const { user } = await requireUser(data.initData);
    const settings = await loadSettings();
    if (!settings.enabled) throw new Error("Game is currently disabled by admin.");

    // User progression — current level 1..cap (current_level column added by 20260521 migration)
    const userAny = user as unknown as { current_level?: number; telegram_id: number };
    const levelIndex = Math.min(settings.cap, Math.max(1, userAny.current_level ?? 1));
    const template = pickMap(levelIndex, userAny.telegram_id);
    const objects = template.build(settings.duration).map((o, i) => ({
      id: `tpl_${template.id}_${i}`,
      obj_type: o.obj_type,
      x_time: o.x_time,
      y: o.y,
      props: o.props,
    })) as LevelObject[];

    const insertRow = {
      user_id: user.telegram_id,
      level_id: null,
      map_template_id: template.id,
      level_index: levelIndex,
      status: "in_progress",
    } as unknown as never;
    const { data: session } = await supabaseAdmin
      .from("game_sessions")
      .insert(insertRow)
      .select()
      .single();

    return {
      sessionId: session!.id,
      levelIndex,
      levelCap: settings.cap,
      mapTemplateId: template.id,
      level: {
        id: `tpl_${template.id}`,
        name: `Lv ${levelIndex} · ${template.name}`,
        duration_seconds: settings.duration,
        gravity: template.gravity,
        jump_strength: template.jump_strength,
        scroll_speed: template.scroll_speed,
        pipe_gap: template.pipe_gap,
        bg_color: template.bg_color,
        bg_kind: template.bg_kind,
        repeat_loop: false,
        reward_per_coin: settings.rewardPerCoin,
      },
      objects,
    };
  });

const CompleteInput = z.object({
  initData: z.string().min(1).max(4096),
  sessionId: z.string().uuid(),
  coinsCollected: z.number().int().min(0).max(10000),
  completed: z.boolean(),
});

export const finishGame = createServerFn({ method: "POST" })
  .inputValidator((input) => CompleteInput.parse(input))
  .handler(async ({ data }) => {
    const { user } = await requireUser(data.initData);
    const settings = await loadSettings();

    const { data: session } = await supabaseAdmin
      .from("game_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", user.telegram_id)
      .maybeSingle();

    if (!session) throw new Error("Session not found");
    if (session.status !== "in_progress") {
      return { ok: false as const, message: "Session already finalized" };
    }

    if (!data.completed) {
      await supabaseAdmin
        .from("game_sessions")
        .update({
          status: "failed",
          coins_pending: data.coinsCollected,
          coins_credited: 0,
          ended_at: new Date().toISOString(),
        })
        .eq("id", data.sessionId);
      return {
        ok: true as const,
        completed: false,
        coinsCollected: data.coinsCollected,
        credited: 0,
        newBalance: Number(user.balance_gtc),
        newLevel: (user as unknown as { current_level?: number }).current_level ?? 1,
        levelCap: settings.cap,
      };
    }

    const credited = data.coinsCollected * settings.rewardPerCoin;
    const { data: latestRaw } = await supabaseAdmin
      .from("users")
      .select("balance_gtc")
      .eq("telegram_id", user.telegram_id)
      .single();
    const latest = latestRaw as unknown as {
      balance_gtc: number | null;
      current_level?: number | null;
      levels_completed?: number | null;
    } | null;
    const newBal = Number(latest?.balance_gtc ?? 0) + credited;
    const oldLevel = Number(latest?.current_level ?? (user as unknown as { current_level?: number }).current_level ?? 1);
    const newLevel = Math.min(settings.cap, oldLevel + 1);
    const completedCount = Number(latest?.levels_completed ?? 0) + 1;

    const userUpdate = {
      balance_gtc: newBal,
      current_level: newLevel,
      levels_completed: completedCount,
    } as unknown as never;
    await supabaseAdmin
      .from("users")
      .update(userUpdate)
      .eq("telegram_id", user.telegram_id);


    await supabaseAdmin
      .from("game_sessions")
      .update({
        status: "completed",
        coins_pending: 0,
        coins_credited: data.coinsCollected,
        ended_at: new Date().toISOString(),
      })
      .eq("id", data.sessionId);

    await supabaseAdmin.from("transactions").insert({
      user_id: user.telegram_id,
      kind: "game_reward",
      amount_gtc: credited,
      balance_after: newBal,
      ref_id: data.sessionId,
      note: `Lv ${oldLevel} · ${data.coinsCollected} coins`,
    });

    return {
      ok: true as const,
      completed: true,
      coinsCollected: data.coinsCollected,
      credited,
      newBalance: newBal,
      newLevel,
      levelCap: settings.cap,
    };
  });

/** Public — list the 20 map templates (no objects) for admin preview. */
export const listMapTemplates = createServerFn({ method: "GET" }).handler(async () => {
  return MAP_TEMPLATES.map((m) => ({
    id: m.id,
    name: m.name,
    bg_color: m.bg_color,
    pipe_gap: m.pipe_gap,
    scroll_speed: m.scroll_speed,
  }));
});
