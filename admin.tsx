import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  CreditCard,
  Megaphone,
  Settings as SettingsIcon,
  Map,
  ShieldCheck,
  Download,
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
  Search,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GoldFrame, GoldButton } from "@/components/gold-ui";
import { useSession } from "@/lib/session";
import {
  getAdminOverview,
  listUsers,
  approveDeposit,
  rejectDeposit,
  updateSettings,
  upsertAnnouncement,
  deleteAnnouncement,
  adjustBalance,
  setUserBanned,
  addSecondaryAdmin,
  removeSecondaryAdmin,
} from "@/lib/admin.functions";
import { deleteLevel } from "@/lib/levels.functions";
import { exportFrontendZip } from "@/lib/export.functions";

export const Route = createFileRoute("/admin")({
  component: AdminRoute,
});

type Tab = "dashboard" | "users" | "deposits" | "announcements" | "settings" | "levels" | "admins";

function AdminRoute() {
  return (
    <AppShell>
      <AdminPanel />
    </AppShell>
  );
}

function AdminPanel() {
  const { admin, initData } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");

  const qc = useQueryClient();
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview({ data: { initData: initData! } }),
    enabled: !!initData && !!admin,
  });

  if (!admin) {
    return (
      <div className="p-4 pt-8">
        <GoldFrame className="p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-gold" />
          <h2 className="mt-3 font-display text-xl text-gold-soft">Forbidden</h2>
          <p className="mt-1 text-sm text-muted-foreground">This page is admin-only.</p>
          <button onClick={() => navigate({ to: "/" })} className="mt-4 text-sm text-gold-soft underline">
            Back to home
          </button>
        </GoldFrame>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: "dashboard", label: "Dash", icon: LayoutDashboard },
    { id: "deposits", label: "Deposits", icon: CreditCard },
    { id: "users", label: "Users", icon: Users },
    { id: "levels", label: "Levels", icon: Map },
    { id: "announcements", label: "Posts", icon: Megaphone },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    ...(admin.role === "main" ? [{ id: "admins" as Tab, label: "Admins", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="space-y-4 p-4 pt-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="rounded-md border border-gold-soft/40 p-1.5 text-gold-soft">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gold">{admin.role} admin</p>
          <h1 className="font-display text-2xl text-gradient-gold">Admin Panel</h1>
        </div>
      </div>

      <div className="-mx-2 overflow-x-auto px-2">
        <div className="flex gap-2 pb-2">
          {tabs.map((t) => {
            const Ic = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wider ${active ? "border-gold-soft bg-gradient-gold-flat text-primary-foreground" : "border-gold-soft/30 text-muted-foreground"}`}
              >
                <Ic size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {overview.isLoading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
      {overview.error && (
        <p className="text-center text-sm text-destructive">{(overview.error as Error).message}</p>
      )}

      {overview.data && tab === "dashboard" && <Dashboard data={overview.data} />}
      {overview.data && tab === "deposits" && (
        <DepositsTab
          deposits={overview.data.deposits}
          onChange={() => {
            void qc.invalidateQueries({ queryKey: ["admin-overview"] });
          }}
        />
      )}
      {tab === "users" && <UsersTab onChange={() => qc.invalidateQueries({ queryKey: ["admin-overview"] })} />}
      {overview.data && tab === "levels" && (
        <LevelsTab levels={overview.data.levels} onChange={() => qc.invalidateQueries({ queryKey: ["admin-overview"] })} />
      )}
      {overview.data && tab === "announcements" && (
        <AnnouncementsTab
          items={overview.data.announcements}
          onChange={() => qc.invalidateQueries({ queryKey: ["admin-overview"] })}
        />
      )}
      {overview.data && tab === "settings" && (
        <SettingsTab
          settings={overview.data.settings}
          onChange={() => qc.invalidateQueries({ queryKey: ["admin-overview"] })}
        />
      )}
      {overview.data && tab === "admins" && admin.role === "main" && (
        <AdminsTab
          admins={overview.data.admins}
          mainAdminId={Number(initData ? "" : "")}
          onChange={() => qc.invalidateQueries({ queryKey: ["admin-overview"] })}
        />
      )}
    </div>
  );
}

function Dashboard({ data }: { data: Awaited<ReturnType<typeof getAdminOverview>> }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <GoldFrame className="p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-gold">Users</p>
          <p className="font-display text-3xl font-bold text-gradient-gold">{data.stats.totalUsers}</p>
        </GoldFrame>
        <GoldFrame className="p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-gold">Pending</p>
          <p className="font-display text-3xl font-bold text-gradient-gold">{data.stats.pendingDeposits}</p>
        </GoldFrame>
      </div>
      <GoldFrame className="p-3">
        <h3 className="mb-2 font-display text-sm uppercase tracking-widest text-gold-soft">Recent admin actions</h3>
        {data.recentLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing logged.</p>
        ) : (
          <div className="space-y-1">
            {data.recentLogs.map((l) => (
              <p key={l.id} className="text-xs text-muted-foreground">
                <span className="text-gold-soft">{l.action}</span> {l.target ?? ""} ·{" "}
                {new Date(l.created_at).toLocaleString()}
              </p>
            ))}
          </div>
        )}
      </GoldFrame>
    </div>
  );
}

function DepositsTab({
  deposits,
  onChange,
}: {
  deposits: Awaited<ReturnType<typeof getAdminOverview>>["deposits"];
  onChange: () => void;
}) {
  const { initData } = useSession();
  const approveMut = useMutation({
    mutationFn: (id: string) => approveDeposit({ data: { initData: initData!, depositId: id } }),
    onSuccess: (r) => {
      toast.success(`Approved · +${r.credited.toFixed(2)} GTC`);
      onChange();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const rejectMut = useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      rejectDeposit({ data: { initData: initData!, depositId: v.id, reason: v.reason } }),
    onSuccess: () => {
      toast.success("Rejected");
      setReasonId(null);
      setReason("");
      onChange();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-2">
      {deposits.length === 0 && <p className="text-center text-sm text-muted-foreground">No deposits.</p>}
      {deposits.map((d) => (
        <GoldFrame key={d.id} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-gold-soft">+{d.amount_gtc.toFixed(2)} GTC</p>
              <p className="text-[11px] text-muted-foreground">
                @{d.username ?? d.first_name ?? d.user_id} · ${d.amount_usdt.toFixed(2)}
              </p>
              <a
                href={`https://bscscan.com/tx/${d.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="block truncate font-mono text-[10px] text-gold-soft/70 underline"
              >
                {d.tx_hash}
              </a>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Status: <span className="text-gold">{d.status}</span>
              </p>
            </div>
            {d.status === "pending" && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => approveMut.mutate(d.id)}
                  className="rounded bg-success/20 px-2 py-1 text-success"
                  aria-label="Approve"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setReasonId(d.id)}
                  className="rounded bg-destructive/20 px-2 py-1 text-destructive"
                  aria-label="Reject"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          {reasonId === d.id && (
            <div className="mt-2 space-y-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason"
                className="w-full rounded border border-gold-soft/40 bg-black/40 px-2 py-1 text-xs"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => rejectMut.mutate({ id: d.id, reason })}
                  disabled={!reason.trim()}
                  className="flex-1 rounded bg-destructive/30 px-2 py-1 text-xs"
                >
                  Confirm reject
                </button>
                <button onClick={() => setReasonId(null)} className="flex-1 rounded bg-card px-2 py-1 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </GoldFrame>
      ))}
    </div>
  );
}

function UsersTab({ onChange }: { onChange: () => void }) {
  const { initData } = useSession();
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => listUsers({ data: { initData: initData!, search: search || undefined } }),
    enabled: !!initData,
  });
  const adjMut = useMutation({
    mutationFn: (v: { userId: number; delta: number }) =>
      adjustBalance({ data: { initData: initData!, userId: v.userId, delta: v.delta, note: "Admin adjustment" } }),
    onSuccess: () => {
      toast.success("Balance updated");
      q.refetch();
      onChange();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const banMut = useMutation({
    mutationFn: (v: { userId: number; banned: boolean }) =>
      setUserBanned({ data: { initData: initData!, userId: v.userId, banned: v.banned } }),
    onSuccess: () => {
      toast.success("Updated");
      q.refetch();
    },
  });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username or telegram_id"
          className="w-full rounded-md border border-gold-soft/40 bg-black/40 px-8 py-2 text-sm"
        />
      </div>
      {(q.data ?? []).map((u) => (
        <GoldFrame key={u.telegram_id} className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display font-bold text-gold-soft">@{u.username ?? u.first_name ?? u.telegram_id}</p>
              <p className="text-[11px] text-muted-foreground">id: {u.telegram_id}</p>
              {u.banned && <p className="text-[10px] text-destructive uppercase">Banned</p>}
            </div>
            <div className="text-right">
              <p className="font-display font-bold text-gradient-gold">{u.balance_gtc.toFixed(0)} GTC</p>
              <div className="mt-1 flex gap-1">
                <button
                  onClick={() => {
                    const v = prompt("Adjust balance by (e.g. +100 or -50)", "+0");
                    const n = v ? Number(v) : NaN;
                    if (!isNaN(n) && n !== 0) adjMut.mutate({ userId: u.telegram_id, delta: n });
                  }}
                  className="rounded bg-gold/20 px-2 py-0.5 text-[10px] text-gold-soft"
                >
                  ± GTC
                </button>
                <button
                  onClick={() => banMut.mutate({ userId: u.telegram_id, banned: !u.banned })}
                  className="rounded bg-destructive/20 px-2 py-0.5 text-[10px] text-destructive"
                >
                  {u.banned ? "Unban" : "Ban"}
                </button>
              </div>
            </div>
          </div>
        </GoldFrame>
      ))}
    </div>
  );
}

function LevelsTab({
  levels,
  onChange,
}: {
  levels: Awaited<ReturnType<typeof getAdminOverview>>["levels"];
  onChange: () => void;
}) {
  const { initData } = useSession();
  const delMut = useMutation({
    mutationFn: (id: string) => deleteLevel({ data: { initData: initData!, id } }),
    onSuccess: () => {
      toast.success("Deleted");
      onChange();
    },
  });
  return (
    <div className="space-y-2">
      <Link to="/admin/level/new">
        <GoldButton className="w-full">
          <Plus size={16} /> New Level
        </GoldButton>
      </Link>
      {levels.map((l) => (
        <GoldFrame key={l.id} className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display font-bold text-gold-soft">{l.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {l.duration_seconds}s · gap {l.pipe_gap} · weight {l.weight} ·{" "}
                {l.enabled ? <span className="text-success">enabled</span> : <span className="text-destructive">disabled</span>}
                {l.repeat_loop && " · 🔁"}
              </p>
            </div>
            <div className="flex gap-1">
              <Link
                to="/admin/level/$id"
                params={{ id: l.id }}
                className="rounded bg-gold/20 p-1.5 text-gold-soft"
              >
                <Pencil size={14} />
              </Link>
              <button
                onClick={() => confirm(`Delete "${l.name}"?`) && delMut.mutate(l.id)}
                className="rounded bg-destructive/20 p-1.5 text-destructive"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </GoldFrame>
      ))}
    </div>
  );
}

function AnnouncementsTab({
  items,
  onChange,
}: {
  items: Awaited<ReturnType<typeof getAdminOverview>>["announcements"];
  onChange: () => void;
}) {
  const { initData } = useSession();
  const [editing, setEditing] = useState<{ id?: string; title: string; body: string; active: boolean } | null>(null);
  const saveMut = useMutation({
    mutationFn: () =>
      upsertAnnouncement({
        data: {
          initData: initData!,
          id: editing!.id,
          title: editing!.title,
          body: editing!.body,
          active: editing!.active,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      onChange();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteAnnouncement({ data: { initData: initData!, id } }),
    onSuccess: () => {
      toast.success("Deleted");
      onChange();
    },
  });

  return (
    <div className="space-y-2">
      {!editing && (
        <GoldButton
          onClick={() => setEditing({ title: "", body: "", active: true })}
          className="w-full"
        >
          <Plus size={16} /> New post
        </GoldButton>
      )}
      {editing && (
        <GoldFrame className="space-y-2 p-3">
          <input
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            placeholder="Title"
            className="w-full rounded border border-gold-soft/40 bg-black/40 px-2 py-1 text-sm"
          />
          <textarea
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            placeholder="Body"
            rows={4}
            className="w-full rounded border border-gold-soft/40 bg-black/40 px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
            />{" "}
            Active
          </label>
          <div className="flex gap-2">
            <GoldButton onClick={() => saveMut.mutate()} disabled={!editing.title.trim() || !editing.body.trim()} className="flex-1 text-xs">
              Save
            </GoldButton>
            <button onClick={() => setEditing(null)} className="flex-1 rounded bg-card px-3 py-2 text-xs">
              Cancel
            </button>
          </div>
        </GoldFrame>
      )}
      {items.map((a) => (
        <GoldFrame key={a.id} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="font-display font-bold text-gold-soft">{a.title}</p>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{a.body}</p>
              <p className="mt-1 text-[10px] uppercase text-muted-foreground">
                {a.active ? <span className="text-success">active</span> : <span className="text-destructive">hidden</span>}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setEditing(a)} className="rounded bg-gold/20 p-1.5 text-gold-soft">
                <Pencil size={12} />
              </button>
              <button
                onClick={() => confirm("Delete?") && delMut.mutate(a.id)}
                className="rounded bg-destructive/20 p-1.5 text-destructive"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </GoldFrame>
      ))}
    </div>
  );
}

function SettingsTab({
  settings,
  onChange,
}: {
  settings: Record<string, string | number | boolean | null>;
  onChange: () => void;
}) {
  const { initData } = useSession();
  const [duration, setDuration] = useState(String(settings.level_duration_seconds ?? 45));
  const [reward, setReward] = useState(String(settings.level_reward_per_coin ?? 1));

  const mut = useMutation({
    mutationFn: () =>
      updateSettings({
        data: {
          initData: initData!,
          level_duration_seconds: Number(duration),
          level_reward_per_coin: Number(reward),
        },
      }),
    onSuccess: () => {
      toast.success("Settings updated");
      onChange();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <GoldFrame className="space-y-3 p-4">
      <p className="text-[11px] text-muted-foreground">
        Admin can edit the level <span className="text-gold">timer</span> and per-coin{" "}
        <span className="text-gold">prize</span>. Maps are auto-generated (20 templates across 100 levels).
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="uppercase tracking-widest text-gold">Timer (seconds)</span>
          <input
            type="number"
            min={15}
            max={300}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="mt-1 w-full rounded border border-gold-soft/40 bg-black/40 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="uppercase tracking-widest text-gold">Prize per coin (GTC)</span>
          <input
            type="number"
            step="0.1"
            min={0}
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            className="mt-1 w-full rounded border border-gold-soft/40 bg-black/40 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <GoldButton onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full">
        {mut.isPending ? "Saving…" : "Save"}
      </GoldButton>
    </GoldFrame>
  );
}



function AdminsTab({
  admins,
  onChange,
}: {
  admins: Awaited<ReturnType<typeof getAdminOverview>>["admins"];
  mainAdminId: number;
  onChange: () => void;
}) {
  const { initData } = useSession();
  const [newId, setNewId] = useState("");
  const [exporting, setExporting] = useState(false);

  const addMut = useMutation({
    mutationFn: () => addSecondaryAdmin({ data: { initData: initData!, telegramId: Number(newId) } }),
    onSuccess: () => {
      toast.success("Added");
      setNewId("");
      onChange();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const remMut = useMutation({
    mutationFn: (id: number) => removeSecondaryAdmin({ data: { initData: initData!, telegramId: id } }),
    onSuccess: () => {
      toast.success("Removed");
      onChange();
    },
  });

  const doExport = async () => {
    setExporting(true);
    try {
      const r = await exportFrontendZip({ data: { initData: initData! } });
      const bin = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bin], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${(r.size / 1024).toFixed(0)} KB`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <GoldFrame className="p-4">
        <h3 className="mb-2 font-display text-sm uppercase tracking-widest text-gold-soft">
          Add secondary admin
        </h3>
        <div className="flex gap-2">
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="Telegram user ID"
            className="flex-1 rounded border border-gold-soft/40 bg-black/40 px-2 py-1.5 text-sm"
            inputMode="numeric"
          />
          <GoldButton
            onClick={() => addMut.mutate()}
            disabled={!/^\d+$/.test(newId) || addMut.isPending}
            className="text-xs"
          >
            Add
          </GoldButton>
        </div>
      </GoldFrame>

      <div className="space-y-1">
        {admins.map((a) => (
          <GoldFrame key={a.telegram_id} className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display font-bold text-gold-soft">{a.telegram_id}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.role}</p>
              </div>
              {a.role !== "main" && (
                <button
                  onClick={() => confirm("Remove admin?") && remMut.mutate(Number(a.telegram_id))}
                  className="rounded bg-destructive/20 p-1.5 text-destructive"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </GoldFrame>
        ))}
      </div>

      <GoldFrame className="p-4">
        <h3 className="mb-2 font-display text-sm uppercase tracking-widest text-gold-soft">
          Export frontend (Netlify ZIP)
        </h3>
        <p className="text-xs text-muted-foreground">
          Download the static frontend source bundled with Netlify config. Backend stays on Lovable Cloud.
        </p>
        <GoldButton onClick={doExport} disabled={exporting} className="mt-3 w-full">
          <Download size={14} /> {exporting ? "Bundling…" : "Download ZIP"}
        </GoldButton>
      </GoldFrame>
    </div>
  );
}
