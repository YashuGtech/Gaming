/**
 * Flappy GTECH canvas engine — premium gold visuals matching the reference.
 * Pipes have gold gradient + caps, bears are glowing gold coin-bears,
 * coins are bright gold, backgrounds rotate through painted themes,
 * and SFX play on flap/coin/hit/win.
 */
import { useEffect, useRef, useState } from "react";
import type { LevelObject } from "@/lib/game.functions";
import { sfx } from "@/lib/sfx";
import bg1Url from "@/assets/flappy-bg/bg1.jpg";
import bg2Url from "@/assets/flappy-bg/bg2.jpg";
import bg3Url from "@/assets/flappy-bg/bg3.jpg";
import bullUrl from "@/assets/bull.png";
import bearUrl from "@/assets/bear.png";

// Kept for backwards compat with existing level configs in DB.
export type BgKind = "sunset_city" | "night_city" | "nebula" | "desert" | "neon_grid" | "aurora";

const KOMMODO_BG_URLS = [bg1Url, bg2Url, bg3Url];

// Module-level image cache so we decode each background once.
const bgImageCache: HTMLImageElement[] = [];
function getBgImages(): HTMLImageElement[] {
  if (bgImageCache.length === 0 && typeof window !== "undefined") {
    for (const url of KOMMODO_BG_URLS) {
      const img = new Image();
      img.src = url;
      bgImageCache.push(img);
    }
  }
  return bgImageCache;
}

let bullImg: HTMLImageElement | null = null;
let bearImg: HTMLImageElement | null = null;
function getBullImg() {
  if (!bullImg && typeof window !== "undefined") {
    bullImg = new Image();
    bullImg.src = bullUrl;
  }
  return bullImg;
}
function getBearImg() {
  if (!bearImg && typeof window !== "undefined") {
    bearImg = new Image();
    bearImg.src = bearUrl;
  }
  return bearImg;
}

export type Level = {
  id: string;
  name: string;
  duration_seconds: number;
  gravity: number;
  jump_strength: number;
  scroll_speed: number;
  pipe_gap: number;
  bg_color: string;
  bg_kind?: BgKind;
  repeat_loop: boolean;
  reward_per_coin: number;
};

type FlappyProps = {
  level: Level;
  objects: LevelObject[];
  onEnd: (result: { completed: boolean; coins: number }) => void;
};

const BIRD_X_RATIO = 0.28;
const BIRD_SIZE = 32;
const PIPE_W = 64;
const PIPE_CAP_H = 22;
const PIPE_CAP_OVERHANG = 8;
const COIN_R = 14;
const BEAR_R = 22;
const SPIKE_W = 30;
const SPIKE_H = 36;

type Active = LevelObject & { spawnX: number; consumed?: boolean };

export function Flappy({ level, objects, onEnd }: FlappyProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [coins, setCoins] = useState(0);
  const [timeLeft, setTimeLeft] = useState(level.duration_seconds);
  const ended = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    const bgKind: BgKind = level.bg_kind ?? "night_city";
    // Pick one of the 3 kommodo backgrounds deterministically from the
    // level config — same level always renders against the same backdrop.
    const bgImages = getBgImages();
    const bgPickSeed = (level.id || level.name || bgKind)
      .split("")
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const heroBg = bgImages[bgPickSeed % bgImages.length] ?? bgImages[0];

    const bird = { x: W * BIRD_X_RATIO, y: H / 2, vy: 0 };
    let coinCount = 0;
    let lastT = performance.now();
    let runTime = 0;
    let raf = 0;
    let active: Active[] = [];
    let nextIdx = 0;
    const sortedObjs = [...objects].sort((a, b) => a.x_time - b.x_time);

    // ── Persistent entities (bull chase + corner bear shooter) ─────
    // Bull spawns off-screen-left at t=0, chases the bird along the floor.
    // Phase 1 (0-10s) = normal speed. Phase 2 (10-20s) = x2 speed. Despawns after 20s.
    const bull = { x: -80, y: H - 40, alive: true, baseSpeed: SCROLL_PX_PER_SEC_INIT() };
    function SCROLL_PX_PER_SEC_INIT() { return level.scroll_speed * 60; }
    // Corner bear shoots arrows + laser beams that travel toward the bird.
    type Proj = { x: number; y: number; vx: number; vy: number; kind: "arrow" | "laser"; life: number };
    const projectiles: Proj[] = [];
    let lastBearShot = 0;
    const bearCorner = { x: W - 46, y: 46 };

    const flap = () => {
      if (ended.current) return;
      bird.vy = level.jump_strength * 60;
      sfx.flap();
    };

    const onPointer = () => flap();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    canvas.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);

    const stop = (completed: boolean) => {
      if (ended.current) return;
      ended.current = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      if (completed) sfx.win();
      else sfx.hit();
      onEnd({ completed, coins: coinCount });
    };

    /* ── BACKGROUNDS ─────────────────────────────────────────────── */
    const drawSky = (top: string, mid: string, bot: string) => {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, top);
      g.addColorStop(0.55, mid);
      g.addColorStop(1, bot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };

    const drawStars = (count: number, seed: number) => {
      ctx.fillStyle = "rgba(255,240,200,0.85)";
      for (let i = 0; i < count; i++) {
        const x = ((Math.sin(i * seed) + 1) * 0.5 * W) % W;
        const y = ((Math.cos(i * (seed + 0.3)) + 1) * 0.5 * H * 0.55) % (H * 0.55);
        const r = (i % 3 === 0) ? 1.4 : 0.8;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawSkyline = (yBase: number, color: string, parallax: number, density: number, seed: number) => {
      ctx.fillStyle = color;
      const shift = (runTime * level.scroll_speed * 60 * parallax) % 80;
      let x = -shift;
      let i = seed;
      while (x < W + 80) {
        const w = 24 + ((Math.sin(i * 1.7) + 1) * 18);
        const h = 40 + ((Math.cos(i * 1.3) + 1) * density);
        ctx.fillRect(x, yBase - h, w, h);
        // window lights
        ctx.save();
        ctx.fillStyle = "rgba(255,200,90,0.55)";
        for (let wy = yBase - h + 6; wy < yBase - 4; wy += 7) {
          for (let wx = x + 3; wx < x + w - 3; wx += 5) {
            if ((wx * 7 + wy * 3 + i) % 5 === 0) ctx.fillRect(wx, wy, 2, 3);
          }
        }
        ctx.restore();
        ctx.fillStyle = color;
        x += w + 2;
        i += 0.7;
      }
    };

    const drawDunes = (yBase: number, color: string, parallax: number, amp: number) => {
      const shift = runTime * level.scroll_speed * 60 * parallax;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) {
        const y = yBase + Math.sin((x + shift) * 0.012) * amp + Math.sin((x + shift) * 0.04) * (amp * 0.3);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    };

    const drawGrid = () => {
      ctx.strokeStyle = "rgba(212,162,76,0.08)";
      ctx.lineWidth = 1;
      const grid = 32;
      const shift = (runTime * level.scroll_speed * 60) % grid;
      for (let x = -shift; x < W; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    };

    const drawBg = () => {
      // Always render one of the 3 kommodo backgrounds. If the image hasn't
      // decoded yet on the first frame, fall back to a dark fill so we never
      // flash white.
      if (heroBg && heroBg.complete && heroBg.naturalWidth > 0) {
        // cover-fit: scale to fill the canvas while preserving aspect ratio.
        const iw = heroBg.naturalWidth;
        const ih = heroBg.naturalHeight;
        const scale = Math.max(W / iw, H / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        // Slow horizontal parallax so the scene feels alive.
        const drift = ((runTime * level.scroll_speed * 18) % Math.max(1, dw - W));
        const dx = -drift;
        const dy = (H - dh) / 2;
        ctx.drawImage(heroBg, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#0a0a14";
        ctx.fillRect(0, 0, W, H);
      }
      // Subtle vignette so foreground entities stay readable.
      const vg = ctx.createLinearGradient(0, 0, 0, H);
      vg.addColorStop(0, "rgba(0,0,0,0.35)");
      vg.addColorStop(0.55, "rgba(0,0,0,0.05)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    };

    /* ── ENTITIES ────────────────────────────────────────────────── */
    const goldGradV = (x: number) => {
      const g = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
      g.addColorStop(0, "#6e4a14");
      g.addColorStop(0.15, "#a87828");
      g.addColorStop(0.5, "#fde08a");
      g.addColorStop(0.85, "#a87828");
      g.addColorStop(1, "#6e4a14");
      return g;
    };

    const drawPipe = (x: number, gapY: number, gap: number) => {
      const topH = gapY - gap / 2;
      const botY = gapY + gap / 2;
      const grad = goldGradV(x);

      // Top pipe body
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, PIPE_W, topH - PIPE_CAP_H);
      // Top cap
      ctx.fillRect(x - PIPE_CAP_OVERHANG, topH - PIPE_CAP_H, PIPE_W + PIPE_CAP_OVERHANG * 2, PIPE_CAP_H);

      // Bottom pipe body
      ctx.fillRect(x, botY + PIPE_CAP_H, PIPE_W, H - (botY + PIPE_CAP_H));
      // Bottom cap
      ctx.fillRect(x - PIPE_CAP_OVERHANG, botY, PIPE_W + PIPE_CAP_OVERHANG * 2, PIPE_CAP_H);

      // Highlight strip
      ctx.fillStyle = "rgba(255,245,200,0.4)";
      ctx.fillRect(x + 6, 0, 3, topH - PIPE_CAP_H);
      ctx.fillRect(x + 6, botY + PIPE_CAP_H, 3, H - (botY + PIPE_CAP_H));

      // Outline
      ctx.strokeStyle = "rgba(60,40,10,0.8)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x, 0, PIPE_W, topH - PIPE_CAP_H);
      ctx.strokeRect(x - PIPE_CAP_OVERHANG, topH - PIPE_CAP_H, PIPE_W + PIPE_CAP_OVERHANG * 2, PIPE_CAP_H);
      ctx.strokeRect(x, botY + PIPE_CAP_H, PIPE_W, H - (botY + PIPE_CAP_H));
      ctx.strokeRect(x - PIPE_CAP_OVERHANG, botY, PIPE_W + PIPE_CAP_OVERHANG * 2, PIPE_CAP_H);
    };

    const drawCoin = (x: number, y: number) => {
      const grad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, COIN_R);
      grad.addColorStop(0, "#fff1b8");
      grad.addColorStop(0.5, "#f2d27a");
      grad.addColorStop(1, "#8a6420");
      // glow
      ctx.save();
      ctx.shadowColor = "rgba(255,210,90,0.85)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, COIN_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "#d4a24c";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#3a2a10";
      ctx.font = `bold ${Math.round(COIN_R * 0.95)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("G", x, y + 1);
    };

    const drawBear = (x: number, y: number) => {
      // Glowing gold ring (matches reference: bear-coin with halo)
      ctx.save();
      ctx.shadowColor = "rgba(255,200,80,0.9)";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "#f2d27a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, BEAR_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // Inner coin
      const grad = ctx.createRadialGradient(x - 4, y - 4, 3, x, y, BEAR_R - 2);
      grad.addColorStop(0, "#fde7a8");
      grad.addColorStop(0.7, "#c89438");
      grad.addColorStop(1, "#5a3a10");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, BEAR_R - 2, 0, Math.PI * 2);
      ctx.fill();
      // Bear silhouette
      ctx.fillStyle = "#3a2208";
      ctx.beginPath();
      ctx.arc(x, y + 1, BEAR_R * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // Ears
      ctx.beginPath();
      ctx.arc(x - 8, y - 8, 4, 0, Math.PI * 2);
      ctx.arc(x + 8, y - 8, 4, 0, Math.PI * 2);
      ctx.fill();
      // Snout
      ctx.fillStyle = "#a87828";
      ctx.beginPath();
      ctx.arc(x, y + 5, 4, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawSpike = (x: number, y: number) => {
      const g = ctx.createLinearGradient(x - SPIKE_W / 2, y, x + SPIKE_W / 2, y);
      g.addColorStop(0, "#7a5a20");
      g.addColorStop(0.5, "#f2d27a");
      g.addColorStop(1, "#7a5a20");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - SPIKE_W / 2, y + SPIKE_H / 2);
      ctx.lineTo(x, y - SPIKE_H / 2);
      ctx.lineTo(x + SPIKE_W / 2, y + SPIKE_H / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#3a2208";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };

    /* ── NEW OBSTACLE TYPES ──────────────────────────────────────── */
    const WALL_W = 26;
    const BLOCK_S = 44;
    const BLADE_R = 26;
    const HAMMER_LEN = 90;
    const SHOOTER_W = 36;

    const drawWall = (x: number, yMid: number, oscAmp: number) => {
      const yc = yMid + (oscAmp ? Math.sin(runTime * 2.2) * oscAmp * H : 0);
      const h = H * 0.5;
      const grad = ctx.createLinearGradient(x, 0, x + WALL_W, 0);
      grad.addColorStop(0, "#5a4014"); grad.addColorStop(0.5, "#d4a24c"); grad.addColorStop(1, "#5a4014");
      ctx.fillStyle = grad;
      ctx.fillRect(x, yc - h / 2, WALL_W, h);
      ctx.strokeStyle = "#2a1c08"; ctx.lineWidth = 1.4;
      ctx.strokeRect(x, yc - h / 2, WALL_W, h);
      return { x, y: yc - h / 2, w: WALL_W, h };
    };
    const drawBlock = (x: number, y: number) => {
      const g = ctx.createLinearGradient(x, y - BLOCK_S / 2, x, y + BLOCK_S / 2);
      g.addColorStop(0, "#fde08a"); g.addColorStop(1, "#7a5618");
      ctx.fillStyle = g;
      ctx.fillRect(x - BLOCK_S / 2, y - BLOCK_S / 2, BLOCK_S, BLOCK_S);
      ctx.strokeStyle = "#2a1c08"; ctx.lineWidth = 1.4;
      ctx.strokeRect(x - BLOCK_S / 2, y - BLOCK_S / 2, BLOCK_S, BLOCK_S);
      return { x: x - BLOCK_S / 2, y: y - BLOCK_S / 2, w: BLOCK_S, h: BLOCK_S };
    };
    const drawGate = (x: number, y: number) => {
      // Two pillars with narrow horizontal opening band
      const halfGap = 70;
      ctx.fillStyle = "#a87828";
      ctx.fillRect(x - 8, 0, 16, y - halfGap);
      ctx.fillRect(x - 8, y + halfGap, 16, H - (y + halfGap));
      ctx.strokeStyle = "#fde08a"; ctx.lineWidth = 2;
      ctx.strokeRect(x - 8, 0, 16, y - halfGap);
      ctx.strokeRect(x - 8, y + halfGap, 16, H - (y + halfGap));
      return { x: x - 8, top: y - halfGap, bot: y + halfGap };
    };
    const drawBlade = (x: number, y: number, speed: number) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(runTime * speed);
      ctx.fillStyle = "#e6e6ea";
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(BLADE_R, -6); ctx.lineTo(BLADE_R, 6);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = "#3a2a10";
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    };
    const drawHammer = (x: number, amp: number, period: number) => {
      const ang = Math.sin((runTime / period) * Math.PI * 2) * amp;
      ctx.save(); ctx.translate(x, 0); ctx.rotate(ang);
      ctx.strokeStyle = "#a87828"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, HAMMER_LEN); ctx.stroke();
      ctx.fillStyle = "#d4a24c";
      ctx.fillRect(-22, HAMMER_LEN, 44, 26);
      ctx.strokeStyle = "#2a1c08"; ctx.lineWidth = 1.4;
      ctx.strokeRect(-22, HAMMER_LEN, 44, 26);
      ctx.restore();
      // hit center in world coords
      const hx = x + Math.sin(ang) * (HAMMER_LEN + 13);
      const hy = Math.cos(ang) * (HAMMER_LEN + 13);
      return { hx, hy };
    };
    const drawLaser = (x: number, y: number, on: number, off: number) => {
      const period = on + off;
      const phase = runTime % period;
      const active = phase < on;
      ctx.strokeStyle = active ? "rgba(255,210,90,0.95)" : "rgba(255,210,90,0.18)";
      ctx.lineWidth = active ? 6 : 2;
      ctx.shadowColor = "rgba(255,140,40,0.8)"; ctx.shadowBlur = active ? 18 : 0;
      ctx.beginPath(); ctx.moveTo(x, y - 80); ctx.lineTo(x, y + 80); ctx.stroke();
      ctx.shadowBlur = 0;
      // emitter caps
      ctx.fillStyle = "#7a5a20";
      ctx.fillRect(x - 8, y - 86, 16, 6);
      ctx.fillRect(x - 8, y + 80, 16, 6);
      return active ? { x: x - 3, y: y - 80, w: 6, h: 160 } : null;
    };
    const drawShooter = (x: number, y: number, rate: number, o: Active) => {
      // emits arrows toward bird at "rate" per second
      const interval = 1 / Math.max(0.2, rate);
      const last = Number(o.props._last ?? -interval);
      if (runTime - last >= interval && x > 0 && x < W) {
        const dx = bird.x - x, dy = bird.y - y;
        const len = Math.hypot(dx, dy) || 1;
        const sp = 220;
        projectiles.push({ x, y, vx: (dx / len) * sp, vy: (dy / len) * sp, kind: "arrow", life: 3 });
        o.props._last = runTime;
      }
      ctx.fillStyle = "#7a5a20";
      ctx.fillRect(x - SHOOTER_W / 2, y - 14, SHOOTER_W, 28);
      ctx.fillStyle = "#fde08a";
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    };

    /* ── BULL (chases) + CORNER BEAR (shoots) ────────────────────── */
    const bullSprite = getBullImg();
    const bearSprite = getBearImg();
    const drawBull = () => {
      if (!bull.alive) return;
      const size = 84;
      if (bullSprite && bullSprite.complete && bullSprite.naturalWidth > 0) {
        ctx.save();
        ctx.shadowColor = "rgba(255,80,200,0.7)"; ctx.shadowBlur = 18;
        ctx.drawImage(bullSprite, bull.x - size / 2, bull.y - size / 2, size, size);
        ctx.restore();
      } else {
        ctx.fillStyle = "#3a2208";
        ctx.fillRect(bull.x - 26, bull.y - 18, 52, 26);
      }
    };
    const drawCornerBear = () => {
      const size = 96;
      if (bearSprite && bearSprite.complete && bearSprite.naturalWidth > 0) {
        ctx.save();
        ctx.shadowColor = "rgba(255,80,200,0.6)"; ctx.shadowBlur = 14;
        ctx.drawImage(bearSprite, bearCorner.x - size / 2, bearCorner.y - size / 2, size, size);
        ctx.restore();
      } else {
        ctx.fillStyle = "#3a2208";
        ctx.beginPath(); ctx.arc(bearCorner.x, bearCorner.y, 22, 0, Math.PI * 2); ctx.fill();
      }
    };
    const drawProjectile = (p: Proj) => {
      if (p.kind === "arrow") {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = "#fde08a";
        ctx.fillRect(-12, -1.5, 22, 3);
        ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(16, 0); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.strokeStyle = "rgba(255,80,200,0.95)"; ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(255,80,200,0.8)"; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    const drawBird = () => {
      ctx.save();
      ctx.translate(bird.x, bird.y);
      const rot = Math.max(-0.5, Math.min(1, bird.vy / 500));
      ctx.rotate(rot);
      ctx.shadowColor = "rgba(255,210,90,0.95)";
      ctx.shadowBlur = 20;
      const grad = ctx.createRadialGradient(-4, -4, 3, 0, 0, BIRD_SIZE / 2);
      grad.addColorStop(0, "#fff1b8");
      grad.addColorStop(0.6, "#f2d27a");
      grad.addColorStop(1, "#8a6420");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#3a2a10"; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.fillStyle = "#3a2a10";
      ctx.font = "bold 16px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("G", 0, 1);
      ctx.restore();
    };

    const SCROLL_PX_PER_SEC = level.scroll_speed * 60;
    const SPAWN_LEAD_PX = W;
    const SPAWN_LEAD_SEC = SPAWN_LEAD_PX / SCROLL_PX_PER_SEC;
    bull.baseSpeed = SCROLL_PX_PER_SEC * 0.45;

    const aabb = (ax: number, ay: number, aw: number, ah: number, br: number) =>
      bird.x + br > ax && bird.x - br < ax + aw && bird.y + br > ay && bird.y - br < ay + ah;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      runTime += dt;
      setTimeLeft(Math.max(0, Math.ceil(level.duration_seconds - runTime)));

      bird.vy += level.gravity * 60 * dt * 60;
      bird.y += bird.vy * dt;

      if (bird.y - BIRD_SIZE / 2 < 0 || bird.y + BIRD_SIZE / 2 > H) {
        return stop(false);
      }

      while (nextIdx < sortedObjs.length && sortedObjs[nextIdx].x_time <= runTime + SPAWN_LEAD_SEC) {
        const obj = sortedObjs[nextIdx];
        const offsetSec = obj.x_time - runTime;
        const spawnX = W + offsetSec * SCROLL_PX_PER_SEC;
        active.push({ ...obj, spawnX });
        nextIdx++;
      }

      drawBg();

      active = active.filter((o) => {
        o.spawnX -= SCROLL_PX_PER_SEC * dt;
        const x = o.spawnX;
        const y = o.y * H;

        if (x < -120) return false;

        if (o.obj_type === "pipe") {
          const gap = Number(o.props.gap ?? level.pipe_gap);
          drawPipe(x, y, gap);
          if (
            bird.x + BIRD_SIZE / 2 > x &&
            bird.x - BIRD_SIZE / 2 < x + PIPE_W &&
            (bird.y - BIRD_SIZE / 2 < y - gap / 2 || bird.y + BIRD_SIZE / 2 > y + gap / 2)
          ) stop(false);
        } else if (o.obj_type === "coin") {
          if (!o.consumed) {
            drawCoin(x, y);
            const dx = bird.x - x, dy = bird.y - y;
            if (dx * dx + dy * dy < (BIRD_SIZE / 2 + COIN_R) ** 2) {
              o.consumed = true; coinCount++; setCoins(coinCount); sfx.coin();
            }
          }
        } else if (o.obj_type === "bear") {
          drawBear(x, y);
          const dx = bird.x - x, dy = bird.y - y;
          if (dx * dx + dy * dy < (BIRD_SIZE / 2 + BEAR_R) ** 2) stop(false);
        } else if (o.obj_type === "spike" || o.obj_type === "poll") {
          drawSpike(x, y);
          if (Math.abs(bird.x - x) < SPIKE_W / 2 + BIRD_SIZE / 2 &&
              Math.abs(bird.y - y) < SPIKE_H / 2 + BIRD_SIZE / 2) stop(false);
        } else if (o.obj_type === "wall") {
          const b = drawWall(x, y, Number(o.props.osc ?? 0));
          if (aabb(b.x, b.y, b.w, b.h, BIRD_SIZE / 2)) stop(false);
        } else if (o.obj_type === "block") {
          const b = drawBlock(x, y);
          if (aabb(b.x, b.y, b.w, b.h, BIRD_SIZE / 2)) stop(false);
        } else if (o.obj_type === "gate") {
          const g = drawGate(x, y);
          if (bird.x + BIRD_SIZE / 2 > g.x && bird.x - BIRD_SIZE / 2 < g.x + 16 &&
              (bird.y - BIRD_SIZE / 2 < g.top || bird.y + BIRD_SIZE / 2 > g.bot)) stop(false);
        } else if (o.obj_type === "blade") {
          drawBlade(x, y, Number(o.props.speed ?? 4));
          const dx = bird.x - x, dy = bird.y - y;
          if (dx * dx + dy * dy < (BIRD_SIZE / 2 + BLADE_R - 4) ** 2) stop(false);
        } else if (o.obj_type === "hammer") {
          const h = drawHammer(x, Number(o.props.amp ?? 0.5), Number(o.props.period ?? 1.6));
          const dx = bird.x - h.hx, dy = bird.y - h.hy;
          if (dx * dx + dy * dy < (BIRD_SIZE / 2 + 22) ** 2) stop(false);
        } else if (o.obj_type === "laser") {
          const hit = drawLaser(x, y, Number(o.props.on ?? 1), Number(o.props.off ?? 1));
          if (hit && aabb(hit.x, hit.y, hit.w, hit.h, BIRD_SIZE / 2)) stop(false);
        } else if (o.obj_type === "shooter") {
          drawShooter(x, y, Number(o.props.rate ?? 1.2), o);
        }

        return true;
      });

      /* ── Bull chase: ONE 10-second x2-speed chase per level ─────── */
      if (bull.alive) {
        if (runTime > 10) bull.alive = false;
        else {
          const sp = bull.baseSpeed * 2; // always x2 during the single chase window
          const targetX = bird.x - 50;
          bull.x += Math.sign(targetX - bull.x) * sp * dt;
          bull.y = H - 40 + Math.sin(runTime * 8) * 2;
          drawBull();
          if (Math.abs(bird.x - bull.x) < 30 && Math.abs(bird.y - bull.y) < 28) stop(false);
        }
      }

      /* ── Corner bear shooter ───────────────────────────────────── */
      drawCornerBear();
      const bearInterval = 1.6; // generous so user can escape
      if (runTime - lastBearShot >= bearInterval) {
        lastBearShot = runTime;
        const dx = bird.x - bearCorner.x, dy = bird.y - bearCorner.y;
        const len = Math.hypot(dx, dy) || 1;
        const sp = 180; // slow → easy escape
        const kind: "arrow" | "laser" = Math.random() > 0.5 ? "arrow" : "laser";
        projectiles.push({ x: bearCorner.x, y: bearCorner.y, vx: (dx / len) * sp, vy: (dy / len) * sp, kind, life: 4 });
      }

      /* ── Projectiles ───────────────────────────────────────────── */
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0 || p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) {
          projectiles.splice(i, 1); continue;
        }
        drawProjectile(p);
        const dx = bird.x - p.x, dy = bird.y - p.y;
        if (dx * dx + dy * dy < (BIRD_SIZE / 2 + 6) ** 2) stop(false);
      }

      drawBird();

      // HUD shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, W, 38);

      if (runTime >= level.duration_seconds) {
        if (level.repeat_loop) {
          runTime = 0;
          nextIdx = 0;
          active = [];
        } else {
          return stop(true);
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-2 text-gold-soft">
        <div className="font-display text-sm">
          🪙 <span className="text-gold-soft">{coins}</span>
        </div>
        <div className="font-display text-sm">
          ⏱ <span className="text-gold-soft">{timeLeft}s</span>
        </div>
      </div>
    </div>
  );
}
