import { Loader2 } from "lucide-react";
import gtcCoin from "@/assets/gtc-coin.jpg";

export function GoldLoader({ label }: { label?: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 rounded-full bg-gradient-gold-flat blur-2xl opacity-60 animate-pulse-gold" />
        <img
          src={gtcCoin}
          alt="GTC"
          className="relative h-24 w-24 rounded-full object-cover border-2 border-gold-soft shadow-gold-strong animate-spin-slow"
          style={{ animation: "spin 2.4s linear infinite" }}
        />
      </div>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <Loader2 className="h-4 w-4 animate-spin text-gold" />
    </div>
  );
}
