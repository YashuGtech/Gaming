import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Copy, Megaphone, Crown, Sparkles, Users, Bird } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GoldFrame, GoldButton } from "@/components/gold-ui";
import { useSession } from "@/lib/session";
import { hapticNotify } from "@/lib/telegram-webapp";
import { getMyReferrals } from "@/lib/referrals.functions";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

function Home() {
  const { user, initData, settings, announcements } = useSession();
  const refReward = Number(settings.refer_reward_gtc ?? 50);
  const rate = Number(settings.gtc_usdt_rate ?? 0.05);
  const refLink = user ? `https://t.me/GtechBNB_bot?start=${user.telegram_id}` : "";
  const usdt = ((user?.balance_gtc ?? 0) * rate).toFixed(2);

  const { data: refData } = useQuery({
    queryKey: ["my-referrals"],
    queryFn: () => getMyReferrals({ data: { initData: initData! } }),
    enabled: !!initData,
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(refLink);
      toast.success("Referral link copied");
      hapticNotify("success");
    } catch {
      toast.error("Copy failed");
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-4 p-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Welcome</p>
          <h1 className="font-display text-2xl text-gradient-gold">
            {user.first_name ?? user.username ?? "Player"}
          </h1>
        </div>
        {user.photo_url ? (
          <img
            src={user.photo_url}
            alt=""
            className="h-12 w-12 rounded-full border-2 border-gold-soft shadow-gold"
          />
        ) : (
          <div className="h-12 w-12 rounded-full border-2 border-gold-soft bg-gradient-gold-flat flex items-center justify-center font-display font-bold text-primary-foreground">
            {(user.first_name?.[0] ?? user.username?.[0] ?? "G").toUpperCase()}
          </div>
        )}
      </div>

      {/* Balance */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <GoldFrame glow className="p-5 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Your Balance</p>
          <p className="mt-2 font-display text-5xl font-bold text-gradient-gold">
            {user.balance_gtc.toFixed(0)}
            <span className="ml-2 text-xl text-gold-soft">GTC</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">≈ ${usdt} USDT</p>
        </GoldFrame>
      </motion.div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map((a) => (
            <GoldFrame key={a.id} className="p-4">
              <div className="flex items-start gap-3">
                <Megaphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-gold-soft">{a.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                </div>
              </div>
            </GoldFrame>
          ))}
        </div>
      )}

      {/* Referral */}
      <GoldFrame className="p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gold" />
          <h3 className="font-display font-semibold text-gold-soft">Invite & Earn</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Earn <span className="text-gold font-bold">{refReward} GTC</span> per friend who joins.
        </p>
        <div className="mt-3 flex gap-2">
          <code className="flex-1 truncate rounded-md border border-gold-soft/40 bg-black/40 px-3 py-2 text-xs text-gold-soft">
            {refLink}
          </code>
          <button
            onClick={copy}
            className="rounded-md bg-gradient-gold-flat px-3 py-2 text-primary-foreground"
            aria-label="Copy link"
          >
            <Copy size={16} />
          </button>
        </div>

        {/* Referral stats */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-gold-soft/30 bg-black/30 p-2 text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Referred</p>
            <p className="font-display text-lg text-gradient-gold">{refData?.count ?? 0}</p>
          </div>
          <div className="rounded-md border border-gold-soft/30 bg-black/30 p-2 text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Earned</p>
            <p className="font-display text-lg text-gradient-gold">
              {(refData?.totalEarned ?? 0).toFixed(0)} <span className="text-xs">GTC</span>
            </p>
          </div>
        </div>

        {refData && refData.referrals.length > 0 && (
          <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
            {refData.referrals.slice(0, 10).map((r) => (
              <div key={r.referred_id} className="flex items-center justify-between rounded border border-gold-soft/20 bg-black/20 px-2 py-1 text-xs">
                <span className="truncate text-gold-soft">
                  {r.first_name ?? r.username ?? `User ${r.referred_id}`}
                </span>
                <span className="text-gold font-bold">+{r.reward_gtc} GTC</span>
              </div>
            ))}
          </div>
        )}
      </GoldFrame>

      {/* Game CTAs */}
      <div className="space-y-3">
        <a href="/game" className="block">
          <GoldButton className="w-full text-base">
            <Sparkles className="h-4 w-4" />
            Play Flappy GTECH
          </GoldButton>
        </a>
        <a href="/flappy-classic" className="block">
          <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gold-soft/60 bg-black/60 px-6 py-3 font-display font-bold uppercase tracking-widest text-gold-soft transition-transform active:scale-[0.98] text-base">
            <Bird className="h-4 w-4" />
            Flappy Classic Level
          </button>
        </a>
      </div>

      {/* Admin shortcut */}
      <AdminLink />
    </div>
  );
}

function AdminLink() {
  const { admin } = useSession();
  if (!admin) return null;
  return (
    <a href="/admin" className="block">
      <GoldFrame className="p-3 text-center">
        <div className="flex items-center justify-center gap-2 text-gold-soft">
          <Crown size={16} />
          <span className="text-sm font-semibold uppercase tracking-widest">
            Admin Panel ({admin.role})
          </span>
        </div>
      </GoldFrame>
    </a>
  );
}
