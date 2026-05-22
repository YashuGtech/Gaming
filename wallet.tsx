import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, ArrowDownToLine, ArrowUpFromLine, History, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GoldFrame, GoldButton } from "@/components/gold-ui";
import { QrCanvas } from "@/components/qr-canvas";
import { useSession } from "@/lib/session";
import { getWallet, submitDeposit } from "@/lib/wallet.functions";
import { hapticNotify } from "@/lib/telegram-webapp";

export const Route = createFileRoute("/wallet")({
  component: WalletRoute,
});

function WalletRoute() {
  return (
    <AppShell>
      <Wallet />
    </AppShell>
  );
}

function Wallet() {
  const { initData, user } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"deposit" | "history">("deposit");

  const { data, isLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => getWallet({ data: { initData: initData! } }),
    enabled: !!initData,
  });

  if (!user) return null;

  return (
    <div className="space-y-4 p-4 pt-6">
      <h1 className="font-display text-3xl text-gradient-gold">Wallet</h1>

      <GoldFrame glow className="p-5 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Balance</p>
        <p className="mt-2 font-display text-4xl font-bold text-gradient-gold">
          {(data?.balance_gtc ?? user.balance_gtc).toFixed(2)}
          <span className="ml-2 text-lg text-gold-soft">GTC</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          ≈ ${((data?.balance_gtc ?? user.balance_gtc) * (data?.rate ?? 0.05)).toFixed(2)} USDT
        </p>
      </GoldFrame>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setTab("deposit")}
          className={`rounded-lg border px-3 py-2.5 text-sm font-semibold uppercase tracking-wider ${tab === "deposit" ? "border-gold-soft bg-gradient-gold-flat text-primary-foreground" : "border-gold-soft/30 text-muted-foreground"}`}
        >
          <ArrowDownToLine className="mx-auto h-4 w-4" />
          Deposit
        </button>
        <button
          onClick={() => setTab("history")}
          className={`rounded-lg border px-3 py-2.5 text-sm font-semibold uppercase tracking-wider ${tab === "history" ? "border-gold-soft bg-gradient-gold-flat text-primary-foreground" : "border-gold-soft/30 text-muted-foreground"}`}
        >
          <History className="mx-auto h-4 w-4" />
          History
        </button>
      </div>

      {tab === "deposit" ? (
        <DepositPanel
          rate={data?.rate ?? 0.05}
          depositAddress={data?.depositAddress ?? "0xe724D2800Cf0Af62aB7f3e08f2f6AD32900c1491"}
          onSubmitted={() => {
            qc.invalidateQueries({ queryKey: ["wallet"] });
          }}
        />
      ) : (
        <HistoryPanel deposits={data?.deposits ?? []} transactions={data?.transactions ?? []} loading={isLoading} />
      )}

      {/* Withdraw — coming soon */}
      <GoldFrame className="p-4 text-center opacity-70">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <ArrowUpFromLine size={16} />
          <span className="text-sm font-semibold uppercase tracking-widest">Withdraw — Coming Soon</span>
        </div>
      </GoldFrame>
    </div>
  );
}

function DepositPanel({
  rate,
  depositAddress,
  onSubmitted,
}: {
  rate: number;
  depositAddress: string;
  onSubmitted: () => void;
}) {
  const { initData } = useSession();
  const [txHash, setTxHash] = useState("");
  const [amountUsdt, setAmountUsdt] = useState("");
  const cleanTxHash = txHash.trim();
  const cleanAmount = Number(amountUsdt);

  const submitMut = useMutation({
    mutationFn: () =>
      submitDeposit({
        data: {
          initData: initData!,
          txHash: cleanTxHash,
          declaredAmountUsdt: cleanAmount,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message);
        hapticNotify("success");
        setTxHash("");
        setAmountUsdt("");
        onSubmitted();
      } else {
        toast.error(res.message);
        hapticNotify("error");
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Submission failed");
      hapticNotify("error");
    },
  });
  const canSubmit = cleanTxHash.length >= 8 && cleanTxHash.length <= 120 && cleanAmount > 0 && !submitMut.isPending;

  const copy = async () => {
    await navigator.clipboard.writeText(depositAddress);
    toast.success("Address copied");
    hapticNotify("success");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <GoldFrame className="p-5">
        <h3 className="text-center font-display text-lg text-gold-soft">Send GTC to</h3>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          BSC network (BEP-20) · Rate: 1 GTC = ${rate.toFixed(3)} USDT
        </p>
        <div className="mt-4 flex justify-center">
          <QrCanvas value={depositAddress} size={200} />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-md border border-gold-soft/40 bg-black/40 p-2">
          <code className="flex-1 break-all text-xs text-gold-soft">{depositAddress}</code>
          <button onClick={copy} className="rounded bg-gradient-gold-flat p-2 text-primary-foreground" aria-label="Copy">
            <Copy size={14} />
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Only send GTC (BEP-20) to this address. Other tokens will be lost.
        </p>
      </GoldFrame>

      <GoldFrame className="p-5">
        <h3 className="font-display text-lg text-gold-soft">Submit transaction</h3>
        <p className="mt-1 text-xs text-muted-foreground">After sending, paste your TX hash to credit your balance.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-gold">Amount (USDT equivalent)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amountUsdt}
              onChange={(e) => setAmountUsdt(e.target.value)}
              placeholder="10.00"
              className="mt-1 w-full rounded-md border border-gold-soft/40 bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-gold">Transaction hash</label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x..."
              className="mt-1 w-full rounded-md border border-gold-soft/40 bg-black/40 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-gold"
            />
          </div>
          <GoldButton
            onClick={() => submitMut.mutate()}
            disabled={!canSubmit}
            className="w-full"
          >
            {submitMut.isPending ? "Submitting…" : "Submit Deposit Request"}
          </GoldButton>
        </div>
      </GoldFrame>
    </motion.div>
  );
}

function HistoryPanel({
  deposits,
  transactions,
  loading,
}: {
  deposits: Array<{
    id: string;
    amount_gtc: number;
    amount_usdt: number;
    tx_hash: string;
    status: string;
    created_at: string;
    admin_note: string | null;
  }>;
  transactions: Array<{
    id: string;
    kind: string;
    amount_gtc: number;
    balance_after: number;
    note: string | null;
    created_at: string;
  }>;
  loading: boolean;
}) {
  if (loading) return <p className="text-center text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 font-display text-sm uppercase tracking-widest text-gold-soft">Deposits</h3>
        {deposits.length === 0 ? (
          <p className="text-xs text-muted-foreground">No deposits yet.</p>
        ) : (
          <div className="space-y-2">
            {deposits.map((d) => (
              <GoldFrame key={d.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-bold text-gold-soft">+{d.amount_gtc.toFixed(2)} GTC</p>
                    <p className="text-[11px] text-muted-foreground">
                      ${d.amount_usdt.toFixed(2)} · {new Date(d.created_at).toLocaleString()}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">{d.tx_hash.slice(0, 14)}…{d.tx_hash.slice(-6)}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                {d.admin_note && <p className="mt-1 text-[11px] italic text-muted-foreground">Note: {d.admin_note}</p>}
              </GoldFrame>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-display text-sm uppercase tracking-widest text-gold-soft">Activity</h3>
        {transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => (
              <GoldFrame key={t.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gold">{t.kind.replace("_", " ")}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </p>
                    {t.note && <p className="text-[11px] text-muted-foreground">{t.note}</p>}
                  </div>
                  <p
                    className={`font-display font-bold ${t.amount_gtc >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {t.amount_gtc >= 0 ? "+" : ""}
                    {t.amount_gtc.toFixed(2)}
                  </p>
                </div>
              </GoldFrame>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: typeof Clock; label: string; cls: string }> = {
    pending: { icon: Clock, label: "Pending", cls: "text-gold bg-gold/10 border-gold/30" },
    auto_approved: { icon: CheckCircle2, label: "Verified", cls: "text-success bg-success/10 border-success/30" },
    approved: { icon: CheckCircle2, label: "Approved", cls: "text-success bg-success/10 border-success/30" },
    rejected: { icon: XCircle, label: "Rejected", cls: "text-destructive bg-destructive/10 border-destructive/30" },
  };
  const m = map[status] ?? map.pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${m.cls}`}>
      <Icon size={10} />
      {m.label}
    </span>
  );
}
