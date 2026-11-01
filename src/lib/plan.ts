import type { BuiltVilla } from "../data/dsl";
import type { Opening, Room } from "../data/types";
import { LEVEL_HEIGHT } from "../data/types";

export const T_EXT = 0.24;
export const T_INT = 0.12;

export interface WallSeg {
  level: number;
  axis: "x" | "z";
  c: number;
  s: number;
  e: number;
  /** Room on the low-coordinate side and the high side; null is outside. */
  lo: Room | null;
  hi: Room | null;
  exterior: boolean;
  t: number;
  openings: Opening[];
}

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export interface Plan {
  villa: BuiltVilla;
  walls: WallSeg[];
  openings: Opening[];
  wallHeight: (level: number) => number;
  levelBase: (level: number) => number;
  indoor: Room[];
  roomAt: (level: number, x: number, z: number) => Room | undefined;
  /** Floor height at a point for walking, or null outside the house's walkable floors. */
  floorAt: (level: number, x: number, z: number) => number;
}

const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;
const key = (n: number) => Math.round(n * 1000);

export function rectMinus(r: Rect, h: Rect): Rect[] {
  const ix0 = Math.max(r.x0, h.x0), ix1 = Math.min(r.x1, h.x1);
  const iz0 = Math.max(r.z0, h.z0), iz1 = Math.min(r.z1, h.z1);
  if (ix0 >= ix1 || iz0 >= iz1) return [r];
  const out: Rect[] = [];
  if (r.z0 < iz0) out.push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: iz0 });
  if (iz1 < r.z1) out.push({ x0: r.x0, z0: iz1, x1: r.x1, z1: r.z1 });
  if (r.x0 < ix0) out.push({ x0: r.x0, z0: iz0, x1: ix0, z1: iz1 });
  if (ix1 < r.x1) out.push({ x0: ix1, z0: iz0, x1: r.x1, z1: iz1 });
  return out;
}

export function rectsMinus(rs: Rect[], hs: Rect[]): Rect[] {
  let cur = rs;
  for (const h of hs) cur = cur.flatMap((r) => rectMinus(r, h));
  return cur.filter((r) => r.x1 - r.x0 > 0.01 && r.z1 - r.z0 > 0.01);
}

const WINDOW_RULES: Partial<Record<Room["type"], { frac: number; min: number; max: number; sill: number; head: number }>> = {
  living: { frac: 0.55, min: 1.4, max: 3.6, sill: 0.45, head: 2.5 },
  dining: { frac: 0.55, min: 1.4, max: 3.0, sill: 0.45, head: 2.5 },
  primary: { frac: 0.5, min: 1.4, max: 3.0, sill: 0.6, head: 2.4 },
  kitchen: { frac: 0.45, min: 1.2, max: 2.6, sill: 1.05, head: 2.3 },
  bedroom: { frac: 0.45, min: 1.0, max: 2.2, sill: 0.8, head: 2.3 },
  office: { frac: 0.45, min: 1.0, max: 2.2, sill: 0.8, head: 2.3 },
  entry: { frac: 0.3, min: 0.6, max: 1.0, sill: 0.3, head: 2.3 },
  landing: { frac: 0.35, min: 0.8, max: 1.4, sill: 0.9, head: 2.3 },
  stair: { frac: 0.3, min: 0.6, max: 1.2, sill: 0.9, head: 2.3 },
  hall: { frac: 0.25, min: 0.6, max: 1.0, sill: 0.9, head: 2.3 },
  bath: { frac: 0.3, min: 0.6, max: 1.1, sill: 1.4, head: 2.1 },
  powder: { frac: 0.3, min: 0.5, max: 0.7, sill: 1.5, head: 2.1 },
  garage: { frac: 0.25, min: 0.8, max: 1.2, sill: 1.6, head: 2.2 },
};

export function buildPlan(villa: BuiltVilla): Plan {
  const indoor = villa.rooms.filter((r) => !r.outdoor);
  const openings: Opening[] = [...villa.openings];
  const levels = villa.levels;
  const wallHeight = (level: number) => (level < levels - 1 ? LEVEL_HEIGHT : 3.0);
  const levelBase = (level: number) => level * LEVEL_HEIGHT;

  type Edge = { axis: "x" | "z"; c: number; s: number; e: number; room: Room; side: "lo" | "hi"; level: number };
  const groups = new Map<string, Edge[]>();
  for (const r of indoor) {
    const es: Edge[] = [
      { axis: "x", c: r.z0, s: r.x0, e: r.x1, room: r, side: "hi", level: r.level },
      { axis: "x", c: r.z1, s: r.x0, e: r.x1, room: r, side: "lo", level: r.level },
      { axis: "z", c: r.x0, s: r.z0, e: r.z1, room: r, side: "hi", level: r.level },
      { axis: "z", c: r.x1, s: r.z0, e: r.z1, room: r, side: "lo", level: r.level },
    ];
    for (const e of es) {
      const k = `${e.level}:${e.axis}:${key(e.c)}`;
      const g = groups.get(k);
      if (g) g.push(e); else groups.set(k, [e]);
    }
  }

  const walls: WallSeg[] = [];
  for (const g of groups.values()) {
    const pts = [...new Set(g.flatMap((e) => [key(e.s), key(e.e)]))].sort((a, b) => a - b).map((n) => n / 1000);
    let cur: WallSeg | null = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], m = (a + b) / 2;
      const lo = g.find((e) => e.side === "lo" && e.s <= m && e.e >= m)?.room ?? null;
      const hi = g.find((e) => e.side === "hi" && e.s <= m && e.e >= m)?.room ?? null;
      let has = !!(lo || hi);
      if (lo && hi && villa.opens.has([lo.id, hi.id].sort().join("|"))) has = false;
      if (!has) { cur = null; continue; }
      if (cur && eq(cur.e, a) && cur.lo === lo && cur.hi === hi) { cur.e = b; continue; }
      const exterior: boolean = !lo || !hi;
      cur = { level: g[0].level, axis: g[0].axis, c: g[0].c, s: a, e: b, lo, hi, exterior, t: exterior ? T_EXT : T_INT, openings: [] };
      walls.push(cur);
    }
  }

  const fits = (o: Opening, w: WallSeg) =>
    o.level === w.level && o.axis === w.axis && eq(o.c, w.c) && o.at - o.width / 2 >= w.s - 0.01 && o.at + o.width / 2 <= w.e + 0.01;

  for (const w of walls) w.openings = openings.filter((o) => fits(o, w));

  // Openings that straddle two merged pieces of the same wall line: attach to the piece holding the centre.
  for (const o of openings) {
    if (walls.some((w) => w.openings.includes(o))) continue;
    const w = walls.find((w) => w.level === o.level && w.axis === o.axis && eq(w.c, o.c) && o.at >= w.s && o.at <= w.e);
    if (w) w.openings.push(o);
  }

  // Windows on exterior walls that the plan left blank.
  for (const w of walls) {
    if (!w.exterior || w.openings.length) continue;
    const room = (w.lo ?? w.hi)!;
    if (villa.noWindows.has(room.id)) continue;
    const rule = WINDOW_RULES[room.type];
    const len = w.e - w.s;
    if (!rule || len < rule.min + 0.6) continue;
    const width = Math.min(rule.max, Math.max(rule.min, len * rule.frac), len - 0.6);
    const o: Opening = {
      id: `auto-${room.id}-${w.axis}-${key(w.c)}-${key(w.s)}`, level: w.level, kind: "window",
      axis: w.axis, c: w.c, at: (w.s + w.e) / 2, width, sill: rule.sill, head: rule.head, rooms: [room.id, null],
    };
    openings.push(o);
    w.openings.push(o);
  }
  for (const w of walls) w.openings.sort((a, b) => a.at - b.at);

  const roomAt = (level: number, x: number, z: number) =>
    villa.rooms.find((r) => r.level === level && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && !(r.outdoor && level === 0 && r.type === "garden"));

  const floorAt = (level: number, x: number, z: number) => {
    for (const s of villa.stairs) {
      if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) {
        const t = s.dir === "+z" ? (z - s.z0) / (s.z1 - s.z0)
          : s.dir === "-z" ? (s.z1 - z) / (s.z1 - s.z0)
          : s.dir === "+x" ? (x - s.x0) / (s.x1 - s.x0) : (s.x1 - x) / (s.x1 - s.x0);
        const steps = 17;
        return levelBase(s.level) + (Math.min(steps, Math.floor(t * steps) + 1) / steps) * LEVEL_HEIGHT;
      }
    }
    return levelBase(level);
  };

  return { villa, walls, openings, wallHeight, levelBase, indoor, roomAt, floorAt };
}

const cache = new Map<string, Plan>();
export function planOf(villa: BuiltVilla) {
  let p = cache.get(villa.id);
  if (!p) { p = buildPlan(villa); cache.set(villa.id, p); }
  return p;
}

export const area = (r: Rect) => (r.x1 - r.x0) * (r.z1 - r.z0);

export function interiorArea(villa: BuiltVilla) {
  return villa.rooms.filter((r) => !r.outdoor && r.type !== "garage").reduce((s, r) => s + area(r), 0);
}
