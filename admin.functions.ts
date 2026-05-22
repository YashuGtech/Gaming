/**
 * Admin server functions.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin, logAdminAction } from "@/lib/auth-helpers.server";
import { verifyTokenTransfer } from "@/lib/bscscan.server";
import { sendBotMessage } from "@/lib/telegram.server";

const InitOnly = z.object({ initData: z.string().min(1).max(4096) });

export const getAdminOverview = createServerFn({ method: "POST" })
  .inputValidator((input) => InitOnly.parse(input))
  .handler(async ({ data }) => {
    const { admin } = await requireAdmin(data.initData);

    const [
      { count: totalUsers },
      { count: pendingDeposits },
      { data: recentDeposits },
      { data: settings },
      { data: announcements },
      { data: levels },
      { data: admins },
      { data: recentLogs },
    ] = await Promise.all([
      supabaseAdmin.from("users").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("deposits").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin
        .from("deposits")
        .select("*, users(username, first_name)")
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin.from("settings").select("key, value"),
      supabaseAdmin.from("announcements").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("levels").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("admins").select("*"),
      supabaseAdmin.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

    const settingsMap: Record<string, string | number | boolean | null> = {};
    (settings ?? []).forEach((s) => {
      settingsMap[s.key] = s.value as string | number | boolean | null;
    });

    return {
      role: admin!.role,
      stats: {
        totalUsers: totalUsers ?? 0,
        pendingDeposits: pendingDeposits ?? 0,
      },
      deposits: (recentDeposits ?? []).map((d) => ({
        id: d.id,
        user_id: d.user_id,
        username: (d.users as { username: string | null } | null)?.username ?? null,
        first_name: (d.users as { first_name: string | null } | null)?.first_name ?? null,
        amount_gtc: Number(d.amount_gtc),
        amount_usdt: Number(d.amount_usdt),
        tx_hash: d.tx_hash,
        status: d.status,
        created_at: d.created_at,
      })),
      settings: settingsMap,
      announcements: (announcements ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        active: a.active,
        created_at: a.created_at,
      })),
      levels: (levels ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        duration_seconds: l.duration_seconds,
        enabled: l.enabled,
        weight: l.weight,
        repeat_loop: l.repeat_loop,
        pipe_gap: l.pipe_gap,
        reward_per_coin: Number(l.reward_per_coin),
      })),
      admins: (admins ?? []).map((a) => ({
        telegram_id: a.telegram_id,
        role: a.role,
        added_by: a.added_by,
      })),
      recentLogs: (recentLogs ?? []).map((l) => ({
        id: l.id,
        admin_id: l.admin_id,
        action: l.action,
        target: l.target,
        created_at: l.created_at,
      })),
    };
  });

const ListUsersInput = z.object({
  initData: z.string().min(1).max(4096),
  search: z.string().max(100).optional(),
});

export const listUsers = createServerFn({ method: "POST" })
  .inputValidator((input) => ListUsersInput.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin(data.initData);
    let q = supabaseAdmin
      .from("users")
      .select("telegram_id, username, first_name, balance_gtc, banned, created_at")
      .order("balance_gtc", { ascending: false })
      .limit(200);
    if (data.search && data.search.trim()) {
      const s = data.search.trim();
      if (/^\d+$/.test(s)) q = q.eq("telegram_id", Number(s));
      else q = q.or(`username.ilike.%${s}%,first_name.ilike.%${s}%`);
    }
    const { data: rows } = await q;
    return (rows ?? []).map((r) => ({
      telegram_id: Number(r.telegram_id),
      username: r.username,
      first_name: r.first_name,
      balance_gtc: Number(r.balance_gtc),
      banned: !!r.banned,
      created_at: r.created_at,
    }));
  });

const ApproveDepositInput = z.object({
  initData: z.string().min(1).max(4096),
  depositId: z.string().uuid(),
});

export const approveDeposit = createServerFn({ method: "POST" })
  .inputValidator((input) => ApproveDepositInput.parse(input))
  .handler(async ({ data }) => {
    const { user: admin } = await requireAdmin(data.initData);

    const { data: dep } = await supabaseAdmin
      .from("deposits")
      .select("*")
      .eq("id", data.depositId)
      .single();
    if (!dep) throw new Error("Deposit not found");
    if (dep.status !== "pending") throw new Error("Deposit not pending");

    // Re-verify on chain
    const apiKey = process.env.BSCSCAN_API_KEY;
    let verification = { ok: false, reason: "no api key" } as { ok: boolean; reason?: string; amountToken?: number };
    if (apiKey) {
      const r = await verifyTokenTransfer(dep.tx_hash, apiKey);
      verification = r.ok
        ? { ok: true, amountToken: r.amountToken }
        : { ok: false, reason: r.reason };
    }

    // Use on-chain amount if available, else admin trusts the declared amount
    const credited = verification.ok && verification.amountToken ? verification.amountToken : Number(dep.amount_gtc);

    const { data: u } = await supabaseAdmin
      .from("users")
      .select("balance_gtc")
      .eq("telegram_id", dep.user_id)
      .single();
    const newBal = Number(u?.balance_gtc ?? 0) + credited;

    await supabaseAdmin
      .from("users")
      .update({ balance_gtc: newBal })
      .eq("telegram_id", dep.user_id);

    await supabaseAdmin
      .from("deposits")
      .update({
        status: "approved",
        amount_gtc: credited,
        reviewed_by: admin.telegram_id,
        reviewed_at: new Date().toISOString(),
        admin_note: verification.ok ? "Verified on-chain at approval" : `Manual approve: ${verification.reason}`,
      })
      .eq("id", dep.id);

    await supabaseAdmin.from("transactions").insert({
      user_id: dep.user_id,
      kind: "deposit",
      amount_gtc: credited,
      balance_after: newBal,
      ref_id: dep.id,
      note: `Approved by admin`,
    });

    await logAdminAction(admin.telegram_id, "approve_deposit", String(dep.id), {
      credited,
      tx_hash: dep.tx_hash,
    });

    // Notify user via bot
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      await sendBotMessage(
        Number(dep.user_id),
        `✅ <b>Deposit approved!</b>\n\n+${credited.toFixed(2)} GTC credited to your balance.\nNew balance: ${newBal.toFixed(2)} GTC`,
        token,
      );
    }

    return { ok: true as const, credited, newBalance: newBal };
  });

const RejectDepositInput = z.object({
  initData: z.string().min(1).max(4096),
  depositId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export const rejectDeposit = createServerFn({ method: "POST" })
  .inputValidator((input) => RejectDepositInput.parse(input))
  .handler(async ({ data }) => {
    const { user: admin } = await requireAdmin(data.initData);
    const { data: dep } = await supabaseAdmin
      .from("deposits")
      .select("*")
      .eq("id", data.depositId)
      .single();
    if (!dep) throw new Error("Deposit not found");
    if (dep.status !== "pending") throw new Error("Deposit not pending");

    await supabaseAdmin
      .from("deposits")
      .update({
        status: "rejected",
        admin_note: data.reason,
        reviewed_by: admin.telegram_id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", dep.id);

    await logAdminAction(admin.telegram_id, "reject_deposit", String(dep.id), { reason: data.reason });

    // Log to transaction history so user sees the rejection status
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("balance_gtc")
      .eq("telegram_id", dep.user_id)
      .single();
    const bal = Number(u?.balance_gtc ?? 0);
    await supabaseAdmin.from("transactions").insert({
      user_id: dep.user_id,
      kind: "admin_adjust",
      amount_gtc: 0,
      balance_after: bal,
      ref_id: dep.id,
      note: `Deposit rejected: ${data.reason}`,
    });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      await sendBotMessage(
        Number(dep.user_id),
        `❌ <b>Deposit rejected</b>\n\nTX: <code>${dep.tx_hash.slice(0, 14)}…</code>\nReason: ${data.reason}`,
        token,
      );
    }

    return { ok: true as const };
  });

// Admin can ONLY edit prize (reward per coin) and timer (level duration).
const UpdateSettingsInput = z.object({
  initData: z.string().min(1).max(4096),
  level_duration_seconds: z.number().int().min(15).max(300).optional(),
  level_reward_per_coin: z.number().min(0).max(1000).optional(),
});

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator((input) => UpdateSettingsInput.parse(input))
  .handler(async ({ data }) => {
    const { user: admin } = await requireAdmin(data.initData);
    const updates: Array<{ key: string; value: unknown }> = [];
    if (data.level_duration_seconds !== undefined)
      updates.push({ key: "level_duration_seconds", value: data.level_duration_seconds });
    if (data.level_reward_per_coin !== undefined)
      updates.push({ key: "level_reward_per_coin", value: data.level_reward_per_coin });
    for (const u of updates) {
      await supabaseAdmin
        .from("settings")
        .upsert({ key: u.key, value: u.value as never, updated_by: admin.telegram_id, updated_at: new Date().toISOString() });
    }
    await logAdminAction(admin.telegram_id, "update_settings", null, { updates });
    return { ok: true };
  });



const AnnouncementInput = z.object({
  initData: z.string().min(1).max(4096),
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  active: z.boolean().default(true),
});

export const upsertAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => AnnouncementInput.parse(input))
  .handler(async ({ data }) => {
    const { user: admin } = await requireAdmin(data.initData);
    if (data.id) {
      await supabaseAdmin
        .from("announcements")
        .update({ title: data.title, body: data.body, active: data.active })
        .eq("id", data.id);
    } else {
      await supabaseAdmin.from("announcements").insert({
        title: data.title,
        body: data.body,
        active: data.active,
        created_by: admin.telegram_id,
      });
    }
    await logAdminAction(admin.telegram_id, "upsert_announcement", data.id ?? null, { title: data.title });
    return { ok: true };
  });

const DeleteAnnouncementInput = z.object({
  initData: z.string().min(1).max(4096),
  id: z.string().uuid(),
});

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => DeleteAnnouncementInput.parse(input))
  .handler(async ({ data }) => {
    const { user: admin } = await requireAdmin(data.initData);
    await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    await logAdminAction(admin.telegram_id, "delete_announcement", data.id);
    return { ok: true };
  });

const AdjustBalanceInput = z.object({
  initData: z.string().min(1).max(4096),
  userId: z.number().int().positive(),
  delta: z.number().min(-1_000_000).max(1_000_000),
  note: z.string().max(500).default("Admin adjustment"),
});

export const adjustBalance = createServerFn({ method: "POST" })
  .inputValidator((input) => AdjustBalanceInput.parse(input))
  .handler(async ({ data }) => {
    const { user: admin } = await requireAdmin(data.initData);
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("balance_gtc")
      .eq("telegram_id", data.userId)
      .single();
    if (!u) throw new Error("User not found");
    const newBal = Number(u.balance_gtc) + data.delta;
    await supabaseAdmin.from("users").update({ balance_gtc: newBal }).eq("telegram_id", data.userId);
    await supabaseAdmin.from("transactions").insert({
      user_id: data.userId,
      kind: "admin_adjust",
      amount_gtc: data.delta,
      balance_after: newBal,
      note: data.note,
    });
    await logAdminAction(admin.telegram_id, "adjust_balance", String(data.userId), { delta: data.delta, note: data.note });
    return { ok: true, newBalance: newBal };
  });

const BanInput = z.object({
  initData: z.string().min(1).max(4096),
  userId: z.number().int().positive(),
  banned: z.boolean(),
});

export const setUserBanned = createServerFn({ method: "POST" })
  .inputValidator((input) => BanInput.parse(input))
  .handler(async ({ data }) => {
    const { user: admin } = await requireAdmin(data.initData);
    await supabaseAdmin.from("users").update({ banned: data.banned }).eq("telegram_id", data.userId);
    await logAdminAction(admin.telegram_id, data.banned ? "ban_user" : "unban_user", String(data.userId));
    return { ok: true };
  });

// ===== Admin management (main admin only) =====
const AddAdminInput = z.object({
  initData: z.string().min(1).max(4096),
  telegramId: z.number().int().positive(),
});

export const addSecondaryAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) => AddAdminInput.parse(input))
  .handler(async ({ data }) => {
    const { user: admin } = await requireAdmin(data.initData, true);
    await supabaseAdmin
      .from("admins")
      .upsert({ telegram_id: data.telegramId, role: "secondary", added_by: admin.telegram_id });
    await logAdminAction(admin.telegram_id, "add_admin", String(data.telegramId));
    return { ok: true };
  });

const RemoveAdminInput = z.object({
  initData: z.string().min(1).max(4096),
  telegramId: z.number().int().positive(),
});

export const removeSecondaryAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) => RemoveAdminInput.parse(input))
  .handler(async ({ data }) => {
    const { user: admin } = await requireAdmin(data.initData, true);
    await supabaseAdmin
      .from("admins")
      .delete()
      .eq("telegram_id", data.telegramId)
      .eq("role", "secondary");
    await logAdminAction(admin.telegram_id, "remove_admin", String(data.telegramId));
    return { ok: true };
  });
