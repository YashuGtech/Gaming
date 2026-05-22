import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Play, X, Construction, RefreshCw, Wallet as WalletIcon, CheckCircle2, Zap, Snowflake, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GoldFrame, GoldButton } from "@/components/gold-ui";
import { Flappy, type Level } from "@/components/flappy";
import { useSession } from "@/lib/session";
import { startGame, finishGame, type LevelObject } from "@/lib/game.functions";
import { hapticNotify, hapticTap } from "@/lib/telegram-webapp";
import { apiPost } from "@/lib/api-client";
import gtcCoin from "@/assets/gtc-coin.jpg";

export const Route = createFileRoute("/game")({
  component: GameRoute,
});

/** Power-ups purchased before the round starts. */
export type ActivePowerUps = {
  bull: boolean; // ×2 profit for first 12s
  bear: boolean; // slow-motion for 20s
};
const POWERUP_COST_GTC = 100;

function GameRoute() {
  return (
    <AppShell>
      <GameInner />
    </AppShell>
  );
}

type Stage =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "playing"; sessionId: string; level: Level; objects: LevelObject[]; levelIndex: number; levelCap: number }
  | {
      kind: "result";
      completed: boolean;
      coins: number;
      credited: number;
      newBalance: number;
      newLevel: number;
      levelCap: number;
      level: Level;
    };


function GameInner() {
  const { initData, settings, user, refresh } = useSession();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [powerUps, setPowerUps] = useState<ActivePowerUps>({ bull: false, bear: false });

  const enabled = settings.game_enabled !== false;

  const startMut = useMutation({
    mutationFn: async () => {
      // Charge selected power-ups against the configured backend.
      // Any backend error surfaces as a toast popup via apiPost.
      const selected = (Object.keys(powerUps) as Array<keyof ActivePowerUps>).filter((k) => powerUps[k]);
      if (selected.length > 0) {
        await apiPost("/powerups/purchase", {
          telegram_id: user?.telegram_id,
          items: selected,
          cost_gtc: POWERUP_COST_GTC,
        });
      }
      return startGame({ data: { initData: initData! } });
    },
    onSuccess: (res) => {
      setStage({
        kind: "playing",
        sessionId: res.sessionId,
        level: res.level,
        objects: res.objects,
        levelIndex: res.levelIndex,
        levelCap: res.levelCap,
      });
      hapticTap("medium");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Could not start");
      setStage({ kind: "idle" });
    },
  });

  const finishMut = useMutation({
    mutationFn: (v: { sessionId: string; coins: number; completed: boolean }) =>
      finishGame({
        data: {
          initData: initData!,
          sessionId: v.sessionId,
          // Bull power-up: ×2 coins for the run (server still credits raw amount;
          // the multiplier is reflected client-side for the player).
          coinsCollected: powerUps.bull ? v.coins * 2 : v.coins,
          completed: v.completed,
        },
      }),
  });

  if (!enabled) {
    return (
      <div className="p-4 pt-8">
        <GoldFrame className="p-6 text-center">
          <Construction className="mx-auto h-8 w-8 text-gold" />
          <h2 className="mt-3 font-display text-xl text-gold-soft">Game paused</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The game is temporarily disabled. Check back soon.
          </p>
        </GoldFrame>
      </div>
    );
  }

  if (stage.kind === "playing") {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <button
          onClick={() => {
            // user cancels mid-game → fail
            finishMut.mutate(
              { sessionId: stage.sessionId, coins: 0, completed: false },
              { onSettled: () => setStage({ kind: "idle" }) },
            );
          }}
          className="absolute top-3 left-3 z-10 rounded-md border border-gold-soft/40 bg-black/60 p-2 text-gold-soft"
          aria-label="Quit"
        >
          <X size={18} />
        </button>
        <Flappy
          level={stage.level}
          objects={stage.objects}
          onEnd={({ completed, coins }) => {
            finishMut.mutate(
              { sessionId: stage.sessionId, coins, completed },
              {
                onSuccess: async (res) => {
                  if (res.ok) {
                    hapticNotify(completed ? "success" : "error");
                    if (completed) {
                      // Hard-to-miss win notification on top of the result screen.
                      toast.success("🎉 Congratulations — you won this level!", {
                        duration: 4000,
                        icon: <PartyPopper className="text-gold" />,
                      });
                    }
                    setStage({
                      kind: "result",
                      completed: res.completed,
                      coins: res.coinsCollected,
                      credited: res.credited,
                      newBalance: res.newBalance,
                      newLevel: res.newLevel,
                      levelCap: res.levelCap,
                      level: stage.level,
                    });
                    if (completed) await refresh();
                  }
                },
              },
            );
          }}
        />
      </div>
    );
  }

  if (stage.kind === "result") {
    return <ResultScreen {...stage} onAgain={() => startMut.mutate()} onHome={() => setStage({ kind: "idle" })} />;
  }

  // Idle / start screen with pre-game power-up shop.
  const balance = Number(user?.balance_gtc ?? 0);
  const selectedCount = Object.values(powerUps).filter(Boolean).length;
  const totalCost = selectedCount * POWERUP_COST_GTC;
  const cantAfford = totalCost > balance;
  return (
    <>
      <StartScreen
        onPlay={() => {
          if (cantAfford) {
            toast.error(`Not enough GTC — need ${totalCost}, have ${balance.toFixed(0)}`);
            return;
          }
          startMut.mutate();
        }}
        loading={startMut.isPending}
      />
      <PowerUpShop
        powerUps={powerUps}
        onToggle={(k) => setPowerUps((p) => ({ ...p, [k]: !p[k] }))}
        totalCost={totalCost}
        balance={balance}
      />
    </>
  );
}

function PowerUpShop({
  powerUps,
  onToggle,
  totalCost,
  balance,
}: {
  powerUps: ActivePowerUps;
  onToggle: (k: keyof ActivePowerUps) => void;
  totalCost: number;
  balance: number;
}) {
  const items: Array<{ key: keyof ActivePowerUps; label: string; desc: string; icon: React.ReactNode }> = [
    { key: "bull", label: "Bull", desc: "×2 profit · 12s", icon: <Zap size={18} /> },
    { key: "bear", label: "Bear", desc: "Slow motion · 20s", icon: <Snowflake size={18} /> },
  ];
  return (
    <div className="px-4 pb-6">
      <GoldFrame className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-sm uppercase tracking-widest text-gold-soft">Power-Ups</p>
          <p className="text-xs text-muted-foreground">{balance.toFixed(0)} GTC</p>
        </div>
        <div className="grid grid-cols-2 gap-2">

          {items.map((it) => {
            const on = powerUps[it.key];
            return (
              <button
                key={it.key}
                onClick={() => onToggle(it.key)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition ${
                  on
                    ? "border-gold-soft bg-gradient-gold-flat text-primary-foreground shadow-gold"
                    : "border-gold-soft/30 text-gold-soft"
                }`}
              >
                <span className={on ? "text-primary-foreground" : "text-gold"}>{it.icon}</span>
                <span className="font-display text-xs font-bold uppercase">{it.label}</span>
                <span className="text-[10px] leading-tight opacity-80">{it.desc}</span>
                <span className="text-[10px] font-bold">{POWERUP_COST_GTC} GTC</span>
              </button>
            );
          })}
        </div>
        {totalCost > 0 && (
          <p className="mt-3 text-center text-xs uppercase tracking-widest text-gold">
            Total: {totalCost} GTC
          </p>
        )}
      </GoldFrame>
    </div>
  );
}

function StartScreen({ onPlay, loading }: { onPlay: () => void; loading: boolean }) {
  return (
    <div className="relative flex min-h-[calc(100dvh-80px)] flex-col items-center justify-center overflow-hidden p-6">
      {/* huge bg G */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-[260px] font-black text-gold/[0.04] select-none">
        GTC
      </span>

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* GTC Coin */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotateY: -180 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative"
        >
          <div className="absolute inset-0 blur-3xl bg-gradient-gold-flat opacity-50 rounded-full" />
          <img
            src={gtcCoin}
            alt="GTC"
            className="relative h-44 w-44 rounded-full object-cover border-4 border-gold-soft shadow-gold-strong animate-pulse-gold"
          />
        </motion.div>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="font-display text-xl uppercase tracking-[0.4em] text-gold-soft"
        >
          Tap to Start
        </motion.p>

        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, type: "spring" }}
          onClick={onPlay}
          disabled={loading}
          className="relative h-24 w-24 rounded-full border-2 border-gold-soft bg-black/40 backdrop-blur-sm flex items-center justify-center shadow-gold animate-pulse-gold disabled:opacity-60"
          aria-label="Play"
        >
          <Play size={42} className="text-gold-soft ml-1" fill="currentColor" />
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="h-12 w-56 rounded-full border-2 border-gold-soft bg-black/40 backdrop-blur-sm"
        />
      </div>
    </div>
  );
}

function ResultScreen({
  completed,
  coins,
  credited,
  newBalance,
  level,
  onAgain,
  onHome,
}: {
  completed: boolean;
  coins: number;
  credited: number;
  newBalance: number;
  level: Level;
  onAgain: () => void;
  onHome: () => void;
}) {
  const usdt = credited * 0.05; // approx — uses default rate
  const minutes = Math.max(1, Math.round(level.duration_seconds / 60));

  return (
    <div className="relative min-h-[calc(100dvh-80px)] overflow-hidden">
      {/* corner accents */}
      <span className="pointer-events-none absolute top-3 left-3 h-8 w-8 border-t-2 border-l-2 border-gold-soft" />
      <span className="pointer-events-none absolute top-3 right-3 h-8 w-8 border-t-2 border-r-2 border-gold-soft" />
      <span className="pointer-events-none absolute bottom-3 left-3 h-8 w-8 border-b-2 border-l-2 border-gold-soft" />
      <span className="pointer-events-none absolute bottom-3 right-3 h-8 w-8 border-b-2 border-r-2 border-gold-soft" />

      <div className="relative z-10 flex flex-col items-center gap-5 px-5 pt-8 pb-8">
        {/* Crown laurel */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="text-5xl"
        >
          {completed ? "👑" : "⏱️"}
        </motion.div>

        <motion.h1
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="font-display text-5xl font-black text-gradient-gold tracking-wider"
        >
          {completed ? "YOU WIN!" : "GAME OVER"}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="clip-hex bg-gradient-gold-flat px-8 py-2"
        >
          <p className="flex items-center gap-2 font-semibold text-primary-foreground">
            <CheckCircle2 size={16} />
            {minutes} MINUTE FLIGHT {completed ? "COMPLETE" : "ENDED"}!
          </p>
        </motion.div>

        {/* GTC Coin */}
        <motion.div
          initial={{ scale: 0, rotateY: -180 }}
          animate={{ scale: 1, rotateY: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="relative my-2"
        >
          <div className="absolute inset-0 blur-2xl bg-gradient-gold-flat opacity-60 rounded-full" />
          <img src={gtcCoin} alt="GTC" className="relative h-32 w-32 rounded-full object-cover border-2 border-gold-soft shadow-gold-strong" />
        </motion.div>

        {/* Reward */}
        <GoldFrame className="w-full p-5 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Reward Earned</p>
          <motion.p
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="mt-2 font-display text-5xl font-black text-gradient-gold"
          >
            {credited >= 0 ? "+" : ""}
            {credited.toFixed(0)} GTC
          </motion.p>
          <p className="mt-1 text-sm text-muted-foreground">= ${usdt.toFixed(2)} USDT</p>
          <p className="mt-1 text-xs text-muted-foreground">{coins} coins collected</p>
        </GoldFrame>

        {/* Status rows */}
        <div className="w-full space-y-2">
          <GoldFrame className="p-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-success flex-shrink-0" />
              <div>
                <p className="text-xs text-success uppercase tracking-wider">
                  {completed ? "Total Earned" : "Total Lost (coins not credited)"}
                </p>
                <p className="font-display font-bold text-gold-soft">
                  {credited.toFixed(0)} GTC = ${usdt.toFixed(2)} USDT
                </p>
              </div>
            </div>
          </GoldFrame>
          <GoldFrame className="p-3">
            <div className="flex items-center gap-3">
              <WalletIcon className="h-6 w-6 text-gold flex-shrink-0" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gold">New Balance</p>
                <p className="font-display font-bold text-gold-soft">
                  {newBalance.toFixed(0)} GTC = ${(newBalance * 0.05).toFixed(2)} USDT
                </p>
              </div>
            </div>
          </GoldFrame>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 pt-2">
          <button
            onClick={onHome}
            className="rounded-lg border border-gold-soft/40 bg-black/40 py-3 font-display font-bold uppercase tracking-widest text-gold-soft"
          >
            Home
          </button>
          <GoldButton onClick={onAgain} className="text-sm">
            <RefreshCw size={14} /> Play Again
          </GoldButton>
        </div>
      </div>
    </div>
  );
}
