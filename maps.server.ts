/**
 * 20 obstacle-typed map templates for Flappy GTECH.
 * Each template is a deterministic generator → returns objects placed by x_time.
 * Server-only: imported by game.functions.ts to avoid bundling RNG seed into client.
 */
import type { LevelObject } from "@/lib/game.functions";

export type BgKind = "sunset_city" | "night_city" | "nebula" | "desert" | "neon_grid" | "aurora";

export type MapTemplate = {
  id: number; // 1..20
  name: string;
  bg_color: string;
  bg_kind?: BgKind;
  gravity: number;
  jump_strength: number;
  scroll_speed: number;
  pipe_gap: number;
  /** Build the objects for a level of `duration` seconds. */
  build: (duration: number) => Omit<LevelObject, "id">[];
};

const rnd = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
};

const obj = (
  t: LevelObject["obj_type"],
  x_time: number,
  y: number,
  props: Record<string, number | string | boolean> = {},
): Omit<LevelObject, "id"> => ({ obj_type: t, x_time, y, props });

const coinLine = (start: number, end: number, y: number, step = 0.4) => {
  const out: Omit<LevelObject, "id">[] = [];
  for (let t = start; t <= end; t += step) out.push(obj("coin", t, y));
  return out;
};

const coinArc = (start: number, peak: number, end: number, yMin: number, yMax: number) => {
  const out: Omit<LevelObject, "id">[] = [];
  const steps = Math.max(4, Math.round((end - start) * 3));
  for (let i = 0; i <= steps; i++) {
    const t = start + ((end - start) * i) / steps;
    const k = (t - start) / (end - start);
    const y = yMax - (yMax - yMin) * Math.sin(k * Math.PI);
    out.push(obj("coin", t, y));
    void peak;
  }
  return out;
};

/* ─────────────────────────────────────────────────────────────────── */

export const MAP_TEMPLATES: MapTemplate[] = [
  // 1. Classic — alternating pipes
  {
    id: 1,
    name: "Classic Pipes",
    bg_color: "#0a0a0f",
    bg_kind: "sunset_city",
    gravity: 0.5,
    jump_strength: -8,
    scroll_speed: 2.5,
    pipe_gap: 170,
    build: (d) => {
      const r = rnd(101);
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 3; t < d - 2; t += 2.2) {
        o.push(obj("pipe", t, 0.3 + r() * 0.4));
        o.push(obj("coin", t + 1.1, 0.4 + r() * 0.3));
      }
      return o;
    },
  },
  // 2. Spike Forest
  {
    id: 2,
    name: "Spike Forest",
    bg_color: "#0f0a14",
    bg_kind: "night_city",
    gravity: 0.55,
    jump_strength: -8,
    scroll_speed: 2.6,
    pipe_gap: 200,
    build: (d) => {
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 2.5; t < d - 1; t += 1.4) {
        o.push(obj("spike", t, t % 2.8 < 1.4 ? 0.9 : 0.1));
        o.push(obj("coin", t + 0.7, 0.5));
      }
      return o;
    },
  },
  // 3. Bear Den
  {
    id: 3,
    name: "Bear Den",
    bg_color: "#150f0a",
    bg_kind: "nebula",
    gravity: 0.5,
    jump_strength: -8,
    scroll_speed: 2.3,
    pipe_gap: 180,
    build: (d) => {
      const r = rnd(303);
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 3; t < d - 2; t += 2.8) {
        o.push(obj("bear", t, 0.3 + r() * 0.4, { slow: true }));
        o.push(obj("coin", t + 1.4, 0.5));
      }
      return o;
    },
  },
  // 4. Tunnel Run — narrow pipe gaps
  {
    id: 4,
    name: "Tight Tunnels",
    bg_color: "#0a0f14",
    bg_kind: "desert",
    gravity: 0.55,
    jump_strength: -8.5,
    scroll_speed: 3,
    pipe_gap: 130,
    build: (d) => {
      const r = rnd(404);
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 3; t < d - 2; t += 1.8) {
        o.push(obj("pipe", t, 0.35 + r() * 0.3, { gap: 130 }));
      }
      return o;
    },
  },
  // 5. Coin Rain
  {
    id: 5,
    name: "Coin Rain",
    bg_color: "#100b04",
    bg_kind: "neon_grid",
    gravity: 0.45,
    jump_strength: -7.5,
    scroll_speed: 2.4,
    pipe_gap: 220,
    build: (d) => {
      const o: Omit<LevelObject, "id">[] = [];
      o.push(...coinLine(2, d - 2, 0.3, 0.35));
      o.push(...coinLine(2.2, d - 2, 0.7, 0.35));
      for (let t = 5; t < d - 3; t += 5) o.push(obj("pipe", t, 0.5));
      return o;
    },
  },
  // 6. Zigzag Spikes
  {
    id: 6,
    name: "Zigzag Spikes",
    bg_color: "#14080a",
    bg_kind: "aurora",
    gravity: 0.55,
    jump_strength: -8,
    scroll_speed: 2.8,
    pipe_gap: 170,
    build: (d) => {
      const o: Omit<LevelObject, "id">[] = [];
      let high = false;
      for (let t = 2; t < d - 1; t += 1.1) {
        o.push(obj("spike", t, high ? 0.15 : 0.85));
        high = !high;
      }
      o.push(...coinLine(2.5, d - 2, 0.5, 1.1));
      return o;
    },
  },
  // 7. Pole Maze
  {
    id: 7,
    name: "Pole Maze",
    bg_color: "#0c0c12",
    bg_kind: "sunset_city",
    gravity: 0.5,
    jump_strength: -8,
    scroll_speed: 2.7,
    pipe_gap: 200,
    build: (d) => {
      const r = rnd(707);
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 2; t < d - 1; t += 1.3) {
        o.push(obj("poll", t, r() * 0.9 + 0.05));
      }
      return o;
    },
  },
  // 8. Pipe + Spike combo
  {
    id: 8,
    name: "Iron & Steel",
    bg_color: "#0a0a0a",
    bg_kind: "night_city",
    gravity: 0.5,
    jump_strength: -8,
    scroll_speed: 2.6,
    pipe_gap: 180,
    build: (d) => {
      const r = rnd(808);
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 3; t < d - 2; t += 2.6) {
        o.push(obj("pipe", t, 0.3 + r() * 0.4));
        o.push(obj("spike", t + 1.3, 0.5));
      }
      return o;
    },
  },
  // 9. Moving Bears (faster)
  {
    id: 9,
    name: "Bear Stampede",
    bg_color: "#1a100a",
    bg_kind: "nebula",
    gravity: 0.5,
    jump_strength: -8.5,
    scroll_speed: 3.2,
    pipe_gap: 200,
    build: (d) => {
      const r = rnd(909);
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 2; t < d - 1; t += 1.5) {
        o.push(obj("bear", t, 0.2 + r() * 0.6));
      }
      o.push(...coinArc(3, 5, 7, 0.3, 0.7));
      return o;
    },
  },
  // 10. Coin Spiral
  {
    id: 10,
    name: "Coin Spiral",
    bg_color: "#0a0e12",
    bg_kind: "desert",
    gravity: 0.45,
    jump_strength: -7.5,
    scroll_speed: 2.4,
    pipe_gap: 220,
    build: (d) => {
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 2; t < d - 2; t += 0.3) {
        const k = (t * 0.8) % (Math.PI * 2);
        o.push(obj("coin", t, 0.5 + 0.35 * Math.sin(k)));
      }
      for (let t = 6; t < d - 3; t += 6) o.push(obj("pipe", t, 0.5));
      return o;
    },
  },
  // 11. Sky High pipes (low gaps)
  {
    id: 11,
    name: "Sky High",
    bg_color: "#06101a",
    bg_kind: "neon_grid",
    gravity: 0.55,
    jump_strength: -8.5,
    scroll_speed: 2.7,
    pipe_gap: 180,
    build: (d) => {
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 3; t < d - 2; t += 2) o.push(obj("pipe", t, 0.18));
      o.push(...coinLine(3.8, d - 2, 0.25, 2));
      return o;
    },
  },
  // 12. Floor Crawl
  {
    id: 12,
    name: "Floor Crawl",
    bg_color: "#0e0a06",
    bg_kind: "aurora",
    gravity: 0.55,
    jump_strength: -8.5,
    scroll_speed: 2.7,
    pipe_gap: 180,
    build: (d) => {
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 3; t < d - 2; t += 2) o.push(obj("pipe", t, 0.82));
      o.push(...coinLine(3.8, d - 2, 0.75, 2));
      return o;
    },
  },
  // 13. Mixed Mayhem — pipes/spikes/bears/walls/blocks
  {
    id: 13,
    name: "Mixed Mayhem",
    bg_color: "#101010",
    bg_kind: "sunset_city",
    gravity: 0.5,
    jump_strength: -8,
    scroll_speed: 2.8,
    pipe_gap: 175,
    build: (d) => {
      const r = rnd(1313);
      const o: Omit<LevelObject, "id">[] = [];
      const kinds: LevelObject["obj_type"][] = ["pipe", "spike", "bear", "wall", "block", "poll"];
      for (let t = 2.5; t < d - 1; t += 1.6) {
        o.push(obj(kinds[Math.floor(r() * kinds.length)], t, 0.2 + r() * 0.6));
        if (r() > 0.5) o.push(obj("coin", t + 0.8, 0.3 + r() * 0.4));
      }
      return o;
    },
  },
  // 14. Spike Tunnel + sliding walls
  {
    id: 14,
    name: "Spike Tunnel",
    bg_color: "#1a0a10",
    bg_kind: "night_city",
    gravity: 0.5,
    jump_strength: -8,
    scroll_speed: 2.6,
    pipe_gap: 220,
    build: (d) => {
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 2; t < d - 1; t += 1.0) {
        o.push(obj("spike", t, 0.05));
        o.push(obj("spike", t, 0.95));
      }
      for (let t = 4; t < d - 2; t += 3.2) o.push(obj("wall", t, 0.5, { osc: 0.25 }));
      o.push(...coinLine(2.5, d - 2, 0.5, 0.8));
      return o;
    },
  },
  // 15. Pipe Stairs
  {
    id: 15,
    name: "Pipe Stairs",
    bg_color: "#0a0a14",
    bg_kind: "nebula",
    gravity: 0.5,
    jump_strength: -8,
    scroll_speed: 2.6,
    pipe_gap: 180,
    build: (d) => {
      const o: Omit<LevelObject, "id">[] = [];
      let y = 0.2;
      for (let t = 3; t < d - 2; t += 2.2) {
        o.push(obj("pipe", t, y));
        y = y >= 0.8 ? 0.2 : y + 0.15;
      }
      return o;
    },
  },
  // 16. Rotating Blade gauntlet
  {
    id: 16,
    name: "Blade Gauntlet",
    bg_color: "#14100a",
    bg_kind: "desert",
    gravity: 0.5,
    jump_strength: -8,
    scroll_speed: 2.6,
    pipe_gap: 200,
    build: (d) => {
      const r = rnd(1616);
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 2; t < d - 1; t += 1.8) {
        o.push(obj("blade", t, 0.2 + r() * 0.6, { speed: 4 }));
        o.push(obj("coin", t + 0.9, 0.5));
      }
      return o;
    },
  },
  // 17. Swinging Hammers
  {
    id: 17,
    name: "Hammer Hall",
    bg_color: "#0a1410",
    bg_kind: "neon_grid",
    gravity: 0.5,
    jump_strength: -8,
    scroll_speed: 2.7,
    pipe_gap: 200,
    build: (d) => {
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 2; t < d - 1; t += 1.6) {
        o.push(obj("hammer", t, 0, { amp: 0.45, period: 1.8 }));
      }
      o.push(...coinArc(3, 6, 9, 0.35, 0.65));
      return o;
    },
  },
  // 18. Laser corridor
  {
    id: 18,
    name: "Laser Corridor",
    bg_color: "#0c0e0a",
    bg_kind: "aurora",
    gravity: 0.45,
    jump_strength: -7.5,
    scroll_speed: 2.4,
    pipe_gap: 240,
    build: (d) => {
      const r = rnd(1818);
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 2.5; t < d - 1; t += 2) {
        o.push(obj("laser", t, 0.2 + r() * 0.6, { on: 1.0, off: 1.0 }));
      }
      o.push(...coinLine(2.5, d - 2, 0.5, 0.6));
      return o;
    },
  },
  // 19. Arrow shooters + pipes
  {
    id: 19,
    name: "Arrow Tower",
    bg_color: "#100a14",
    bg_kind: "sunset_city",
    gravity: 0.5,
    jump_strength: -8,
    scroll_speed: 2.7,
    pipe_gap: 180,
    build: (d) => {
      const r = rnd(1919);
      const o: Omit<LevelObject, "id">[] = [];
      for (let t = 3; t < d - 2; t += 2.4) {
        o.push(obj("pipe", t, 0.3 + r() * 0.4));
        o.push(obj("shooter", t + 1.2, r() > 0.5 ? 0.1 : 0.9, { rate: 1.5 }));
      }
      return o;
    },
  },
  // 20. Boss arena — everything
  {
    id: 20,
    name: "Boss Arena",
    bg_color: "#1a0a0a",
    bg_kind: "night_city",
    gravity: 0.55,
    jump_strength: -8.5,
    scroll_speed: 3.1,
    pipe_gap: 160,
    build: (d) => {
      const r = rnd(2020);
      const o: Omit<LevelObject, "id">[] = [];
      const types: LevelObject["obj_type"][] = [
        "pipe", "spike", "bear", "poll", "wall", "block", "blade", "hammer", "laser", "shooter", "gate",
      ];
      for (let t = 2; t < d - 1; t += 1.2) {
        o.push(obj(types[Math.floor(r() * types.length)], t, 0.15 + r() * 0.7));
      }
      o.push(...coinLine(2.5, d - 2, 0.5, 1.5));
      return o;
    },
  },
];

/** Pick a deterministic map for a given level index 1..100. */
export function pickMap(levelIndex: number, seed = 0): MapTemplate {
  const r = rnd(seed + levelIndex * 7919);
  const idx = Math.floor(r() * MAP_TEMPLATES.length);
  return MAP_TEMPLATES[idx];
}
