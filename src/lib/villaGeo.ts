import * as THREE from "three";
import type { BuiltVilla } from "../data/dsl";
import type { Opening, Room } from "../data/types";
import { CEILING, LEVEL_HEIGHT } from "../data/types";
import { Buckets } from "./buckets";
import { planOf, rectsMinus, type Plan, type Rect, type WallSeg } from "./plan";

export interface DoorLeaf {
  id: string;
  opening: Opening;
  kind: "swing" | "slide" | "roll";
  /** Hinge (swing), panel start (slide) or panel centre (roll) in villa-local coords. */
  x: number; y: number; z: number;
  axis: "x" | "z";
  width: number;
  height: number;
  /** Leaf extends from the hinge along +axis (1) or -axis (-1). */
  dir: 1 | -1;
  /** Which side of the wall the leaf swings toward: +1 the high side. */
  swing: 1 | -1;
  mat: string;
}

export interface Rect2 { x0: number; z0: number; x1: number; z1: number; level: number }

export interface VillaGeo {
  plan: Plan;
  /** Per level: walls, floors, slabs, stairs, fixtures. */
  levels: Map<string, THREE.BufferGeometry>[];
  ceilings: Map<string, THREE.BufferGeometry>[];
  glass: THREE.BufferGeometry[];
  roofs: Map<string, THREE.BufferGeometry>;
  site: Map<string, THREE.BufferGeometry>;
  doors: DoorLeaf[];
  /** Static obstacles for walking, per level. */
  solids: Rect2[];
  /** Fixture points for bloom-lit downlights, villa-local. */
  height: number;
}

const ROOF_K = Math.tan((24 * Math.PI) / 180);
const OV = 0.6;

function floorKey(r: Room, mainIsStone: boolean) {
  switch (r.type) {
    case "bath": case "powder": case "laundry": return "floor:bath";
    case "garage": return "floor:garage";
    case "bedroom": case "primary": case "office": case "closet": case "media": case "landing": return mainIsStone ? "floor:wood" : "floor:main";
    case "terrace": case "pooldeck": return "deck:stone";
    case "balcony": return "deck:wood";
    case "driveway": return "pavers";
    default: return "floor:main";
  }
}

export function buildVillaGeo(villa: BuiltVilla): VillaGeo {
  const plan = planOf(villa);
  const L = villa.levels;
  const lv = Array.from({ length: L }, () => new Buckets());
  const ceil = Array.from({ length: L }, () => new Buckets());
  const glass = Array.from({ length: L }, () => new Buckets());
  const roofs = new Buckets();
  const site = new Buckets();
  const doors: DoorLeaf[] = [];
  const solids: Rect2[] = [];
  const mainIsStone = villa.style.floor === "travertine";

  /* ---- walls ---- */
  const touches = (w: WallSeg, at: number) =>
    plan.walls.some((o) => o !== w && o.level === w.level && o.axis === w.axis && Math.abs(o.c - w.c) < 0.005 && (Math.abs(o.s - at) < 0.005 || Math.abs(o.e - at) < 0.005));

  for (const w of plan.walls) {
    const B = lv[w.level];
    const y0 = plan.levelBase(w.level), h = plan.wallHeight(w.level), y1 = y0 + h;
    const ht = w.t / 2;
    const s = w.s - (touches(w, w.s) ? 0 : ht), e = w.e + (touches(w, w.e) ? 0 : ht);
    const loK = w.lo ? "wall" : "stucco", hiK = w.hi ? "wall" : "stucco";
    const piece = (a: number, b: number, ya: number, yb: number, ends = true) => {
      if (b - a < 0.005 || yb - ya < 0.005) return;
      if (w.axis === "x") {
        B.box([a, ya, w.c - ht], [b, yb, w.c + ht], { nz: loK, pz: hiK, py: "cap", px: ends ? "wall" : undefined, nx: ends ? "wall" : undefined, ny: "wall" });
        if (ya < y0 + 1.2) solids.push({ x0: a, z0: w.c - ht, x1: b, z1: w.c + ht, level: w.level });
      } else {
        B.box([w.c - ht, ya, a], [w.c + ht, yb, b], { nx: loK, px: hiK, py: "cap", pz: ends ? "wall" : undefined, nz: ends ? "wall" : undefined, ny: "wall" });
        if (ya < y0 + 1.2) solids.push({ x0: w.c - ht, z0: a, x1: w.c + ht, z1: b, level: w.level });
      }
    };
    let cur = s;
    for (const o of w.openings) {
      const a = o.at - o.width / 2, b = o.at + o.width / 2;
      piece(cur, a, y0, y1);
      if (o.head < h - 0.01) piece(a, b, y0 + o.head, y1, false);
      if (o.sill > 0.01) piece(a, b, y0, y0 + o.sill, false);
      openingDetail(o, w, y0, lv[w.level], glass[w.level], doors, villa);
      cur = b;
    }
    piece(cur, e, y0, y1);
  }

  /* ---- floors, slabs, ceilings ---- */
  const stairHoles = (level: number): Rect[] => villa.stairs.filter((s) => s.level === level - 1).map((s) => ({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1 }));
  const coveredAbove = (r: Room) => villa.rooms.some((u) => u.level === r.level + 1 && !u.outdoor && (r.x0 + r.x1) / 2 > u.x0 && (r.x0 + r.x1) / 2 < u.x1 && (r.z0 + r.z1) / 2 > u.z0 && (r.z0 + r.z1) / 2 < u.z1);
  const poolRects: Rect[] = [];
  if (villa.pool) {
    const p = villa.pool;
    poolRects.push({ x0: p.x0 - 0.35, z0: p.z0 - 0.35, x1: p.x1 + 0.35, z1: p.z1 + 0.35 });
    if (p.spa) poolRects.push({ x0: p.spa.x0 - 0.3, z0: p.spa.z0 - 0.3, x1: p.spa.x1 + 0.3, z1: p.spa.z1 + 0.3 });
  }

  for (const r of villa.rooms) {
    const base = plan.levelBase(r.level);
    const fk = floorKey(r, mainIsStone);
    if (r.type === "garden") continue;
    if (r.level === 0) {
      const B = r.outdoor ? site : lv[0];
      const rects = rectsMinus([r], r.type === "pooldeck" ? poolRects : []);
      const top = r.outdoor ? 0.0 : 0.02;
      for (const q of rects) B.box([q.x0, top - 0.1, q.z0], [q.x1, top, q.z1], { py: fk, px: "coping", nx: "coping", pz: "coping", nz: "coping" });
    } else {
      const holes = r.type === "landing" ? stairHoles(r.level) : [];
      for (const q of rectsMinus([r], holes)) {
        lv[r.level].box([q.x0, base - 0.25, q.z0], [q.x1, base + 0.02, q.z1], {
          py: fk, ny: r.outdoor ? "soffit" : "ceiling", px: "stucco", nx: "stucco", pz: "stucco", nz: "stucco",
        });
      }
      if (r.outdoor) railing(r, plan, lv[r.level], solids);
    }
    if (!r.outdoor) {
      if (!coveredAbove(r)) {
        const y = base + CEILING;
        ceil[r.level].poly("ceiling", [[r.x0, y, r.z0], [r.x1, y, r.z0], [r.x1, y, r.z1], [r.x0, y, r.z1]], [0, -1, 0]);
      }
      fixtures(r, base, lv[r.level]);
    } else if (r.covered) {
      coveredRoof(r, site, roofs, villa);
    }
  }

  /* ---- stairs ---- */
  for (const st of villa.stairs) {
    const B = lv[st.level];
    const base = plan.levelBase(st.level);
    const N = 17, rise = LEVEL_HEIGHT / N;
    const alongZ = st.dir === "+z" || st.dir === "-z";
    const len = alongZ ? st.z1 - st.z0 : st.x1 - st.x0;
    const run = len / N;
    for (let i = 0; i < N; i++) {
      const t0 = st.dir === "+z" || st.dir === "+x" ? i * run : len - (i + 1) * run;
      const top = base + (i + 1) * rise;
      if (alongZ) B.box([st.x0, top - Math.min(top - base, 0.35), st.z0 + t0], [st.x1, top, st.z0 + t0 + run], { py: "stair", pz: "stair", nz: "stair", px: "wall", nx: "wall", ny: "wall" });
      else B.box([st.x0 + t0, top - Math.min(top - base, 0.35), st.z0], [st.x0 + t0 + run, top, st.z1], { py: "stair", px: "stair", nx: "stair", pz: "wall", nz: "wall", ny: "wall" });
    }
    // glass guards on the open long sides, both levels
    const sides: [number, number, number, number][] = alongZ
      ? [[st.x0, st.z0, st.x0, st.z1], [st.x1, st.z0, st.x1, st.z1]]
      : [[st.x0, st.z0, st.x1, st.z0], [st.x0, st.z1, st.x1, st.z1]];
    for (const [ax, az, bx, bz] of sides) {
      const nearWall = plan.walls.some((w) => w.level === st.level && (alongZ ? w.axis === "z" && Math.abs(w.c - ax) < 0.3 : w.axis === "x" && Math.abs(w.c - az) < 0.3));
      if (nearWall) continue;
      const g = 0.02;
      if (alongZ) {
        B.solid([ax - g, base, az], [ax + g, base + LEVEL_HEIGHT + 1.0, bz], "rail");
        solids.push({ x0: ax - 0.05, z0: az, x1: ax + 0.05, z1: bz, level: st.level });
        solids.push({ x0: ax - 0.05, z0: az, x1: ax + 0.05, z1: bz, level: st.level + 1 });
      } else {
        B.solid([ax, base, az - g], [bx, base + LEVEL_HEIGHT + 1.0, az + g], "rail");
        solids.push({ x0: ax, z0: az - 0.05, x1: bx, z1: az + 0.05, level: st.level });
        solids.push({ x0: ax, z0: az - 0.05, x1: bx, z1: az + 0.05, level: st.level + 1 });
      }
    }
    // guard across the bottom end of the hole on the upper level
    const ub = base + LEVEL_HEIGHT;
    const gEnd: [number, number, number, number] = st.dir === "+z" ? [st.x0, st.z0, st.x1, st.z0] : st.dir === "-z" ? [st.x0, st.z1, st.x1, st.z1] : st.dir === "+x" ? [st.x0, st.z0, st.x0, st.z1] : [st.x1, st.z0, st.x1, st.z1];
    if (gEnd[1] === gEnd[3]) {
      lv[st.level + 1].solid([gEnd[0], ub, gEnd[1] - 0.02], [gEnd[2], ub + 1.0, gEnd[1] + 0.02], "rail");
      solids.push({ x0: gEnd[0], z0: gEnd[1] - 0.05, x1: gEnd[2], z1: gEnd[1] + 0.05, level: st.level + 1 });
    } else {
      lv[st.level + 1].solid([gEnd[0] - 0.02, ub, gEnd[1]], [gEnd[0] + 0.02, ub + 1.0, gEnd[3]], "rail");
      solids.push({ x0: gEnd[0] - 0.05, z0: gEnd[1], x1: gEnd[0] + 0.05, z1: gEnd[3], level: st.level + 1 });
    }
  }

  /* ---- pool ---- */
  if (villa.pool) {
    const p = villa.pool;
    const basin = (q: Rect, depth: number) => {
      const t = 0.25, wy = -0.1;
      site.box([q.x0, -depth - 0.1, q.z0], [q.x1, -depth, q.z1], { py: "poolTile" });
      site.box([q.x0 - t, -depth, q.z0 - t], [q.x0, 0, q.z1 + t], { px: "poolTile" });
      site.box([q.x1, -depth, q.z0 - t], [q.x1 + t, 0, q.z1 + t], { nx: "poolTile" });
      site.box([q.x0, -depth, q.z0 - t], [q.x1, 0, q.z0], { pz: "poolTile" });
      site.box([q.x0, -depth, q.z1], [q.x1, 0, q.z1 + t], { nz: "poolTile" });
      site.poly("water", [[q.x0, wy, q.z1], [q.x1, wy, q.z1], [q.x1, wy, q.z0], [q.x0, wy, q.z0]], [0, 1, 0]);
      const c = 0.35;
      site.box([q.x0 - c, -0.08, q.z0 - c], [q.x1 + c, 0.04, q.z0], { py: "coping", nz: "coping", pz: "coping" });
      site.box([q.x0 - c, -0.08, q.z1], [q.x1 + c, 0.04, q.z1 + c], { py: "coping", nz: "coping", pz: "coping" });
      site.box([q.x0 - c, -0.08, q.z0], [q.x0, 0.04, q.z1], { py: "coping", px: "coping", nx: "coping" });
      site.box([q.x1, -0.08, q.z0], [q.x1 + c, 0.04, q.z1], { py: "coping", px: "coping", nx: "coping" });
      solids.push({ x0: q.x0, z0: q.z0, x1: q.x1, z1: q.z1, level: 0 });
    };
    basin(p, p.depth);
    if (p.spa) basin(p.spa, 0.9);
  }

  /* ---- roofs ---- */
  for (const b of villa.blocks) {
    const top = plan.levelBase(b.level) + plan.wallHeight(b.level);
    const X0 = b.x0 - OV, X1 = b.x1 + OV, Z0 = b.z0 - OV, Z1 = b.z1 + OV;
    if (b.roof === "roofdeck") {
      // parapet cap only; the terrace slab and its glass guard come from the outdoor room
      continue;
    }
    if (b.roof === "flat") {
      roofs.box([b.x0 - 0.35, top, b.z0 - 0.35], [b.x1 + 0.35, top + 0.34, b.z1 + 0.35], { py: "roof:flat", ny: "soffit", px: "trim", nx: "trim", pz: "trim", nz: "trim" });
      continue;
    }
    const W = X1 - X0, D = Z1 - Z0;
    const eave = top - OV * ROOF_K;
    if (b.roof === "hip") {
      const alongX = W >= D;
      const half = (alongX ? D : W) / 2;
      const R = eave + half * ROOF_K;
      if (alongX) {
        const zm = (Z0 + Z1) / 2, xa = X0 + half, xb = X1 - half;
        roofs.plane("roof:tile", [[X1, eave, Z0], [X0, eave, Z0], [xa, R, zm], [xb, R, zm]], true);
        roofs.plane("roof:tile", [[X0, eave, Z1], [X1, eave, Z1], [xb, R, zm], [xa, R, zm]], true);
        roofs.plane("roof:tile", [[X0, eave, Z0], [X0, eave, Z1], [xa, R, zm]], true);
        roofs.plane("roof:tile", [[X1, eave, Z1], [X1, eave, Z0], [xb, R, zm]], true);
      } else {
        const xm = (X0 + X1) / 2, za = Z0 + half, zb = Z1 - half;
        roofs.plane("roof:tile", [[X0, eave, Z0], [X0, eave, Z1], [xm, R, zb], [xm, R, za]], true);
        roofs.plane("roof:tile", [[X1, eave, Z1], [X1, eave, Z0], [xm, R, za], [xm, R, zb]], true);
        roofs.plane("roof:tile", [[X1, eave, Z0], [X0, eave, Z0], [xm, R, za]], true);
        roofs.plane("roof:tile", [[X0, eave, Z1], [X1, eave, Z1], [xm, R, zb]], true);
      }
    } else {
      // gable, ridge along x
      const zm = (Z0 + Z1) / 2, R = eave + (D / 2) * ROOF_K;
      roofs.plane("roof:tile", [[X1, eave, Z0], [X0, eave, Z0], [X0, R, zm], [X1, R, zm]], true);
      roofs.plane("roof:tile", [[X0, eave, Z1], [X1, eave, Z1], [X1, R, zm], [X0, R, zm]], true);
      const apex = top + ((b.z1 - b.z0) / 2) * ROOF_K;
      for (const [x, sgn] of [[b.x0 - 0.12, -1], [b.x1 + 0.12, 1]] as const) {
        const pts: [number, number, number][] = [[x, top, b.z0 - 0.12], [x, top, b.z1 + 0.12], [x, apex + 0.1, (b.z0 + b.z1) / 2]];
        roofs.poly("stucco", sgn > 0 ? pts.reverse() : pts, [sgn, 0, 0]);
      }
      roofs.box([X0, R - 0.05, zm - 0.12], [X1, R + 0.1, zm + 0.12], { py: "trim", pz: "trim", nz: "trim", px: "trim", nx: "trim" });
    }
    // fascia and soffit
    const f = 0.05, fh = 0.22;
    roofs.box([X0 - f, eave - fh, Z0 - f], [X1 + f, eave, Z0], { nz: "trim", py: "trim", ny: "trim", px: "trim", nx: "trim" });
    roofs.box([X0 - f, eave - fh, Z1], [X1 + f, eave, Z1 + f], { pz: "trim", py: "trim", ny: "trim", px: "trim", nx: "trim" });
    if (b.roof === "hip") {
      roofs.box([X0 - f, eave - fh, Z0], [X0, eave, Z1], { nx: "trim", py: "trim", ny: "trim" });
      roofs.box([X1, eave - fh, Z0], [X1 + f, eave, Z1], { px: "trim", py: "trim", ny: "trim" });
    }
    roofs.poly("soffit", [[X0, top - 0.01, Z0], [X1, top - 0.01, Z0], [X1, top - 0.01, Z1], [X0, top - 0.01, Z1]], [0, -1, 0]);
  }

  /* ---- furniture obstacles ---- */
  for (const it of villa.items) {
    if (!it.solid) continue;
    const c = Math.abs(Math.cos(it.rot)), s = Math.abs(Math.sin(it.rot));
    const hw = (it.size[0] * c + it.size[1] * s) / 2, hd = (it.size[0] * s + it.size[1] * c) / 2;
    solids.push({ x0: it.x - hw, z0: it.z - hd, x1: it.x + hw, z1: it.z + hd, level: it.level });
  }

  const height = plan.levelBase(L - 1) + plan.wallHeight(L - 1) + 3;
  return {
    plan,
    levels: lv.map((b) => b.build()),
    ceilings: ceil.map((b) => b.build()),
    glass: glass.map((b) => b.build().get("glass") ?? new THREE.BufferGeometry()),
    roofs: roofs.build(),
    site: site.build(),
    doors,
    solids,
    height,
  };
}

function openingDetail(o: Opening, w: WallSeg, y0: number, B: Buckets, G: Buckets, doors: DoorLeaf[], villa: BuiltVilla) {
  const a = o.at - o.width / 2, b = o.at + o.width / 2;
  const ys = y0 + o.sill, yh = y0 + o.head;
  const c = o.c;
  const ax = o.axis;
  const box = (k: string, p0: number, p1: number, ya: number, yb: number, off0: number, off1: number) => {
    if (ax === "x") B.solid([p0, ya, c + off0], [p1, yb, c + off1], k, false);
    else B.solid([c + off0, ya, p0], [c + off1, yb, p1], k, false);
  };
  const pane = (p0: number, p1: number, ya: number, yb: number, off: number) => {
    if (ax === "x") G.poly("glass", [[p0, ya, c + off], [p1, ya, c + off], [p1, yb, c + off], [p0, yb, c + off]], [0, 0, 1]);
    else G.poly("glass", [[c + off, ya, p1], [c + off, ya, p0], [c + off, yb, p0], [c + off, yb, p1]], [1, 0, 0]);
  };
  const ft = 0.05, fd = 0.07;
  const sideOf = (roomId: string | null): 1 | -1 => {
    if (!roomId) return w.lo ? -1 : 1;
    const r = villa.rooms.find((x) => x.id === roomId)!;
    return (ax === "x" ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2) > c ? 1 : -1;
  };

  if (o.kind === "window") {
    box("frame", a, b, ys - ft, ys, -fd, fd);
    box("frame", a, b, yh, yh + ft, -fd, fd);
    box("frame", a - ft, a, ys - ft, yh + ft, -fd, fd);
    box("frame", b, b + ft, ys - ft, yh + ft, -fd, fd);
    const n = Math.max(1, Math.round(o.width / 1.3));
    for (let i = 1; i < n; i++) { const m = a + (o.width * i) / n; box("frame", m - 0.025, m + 0.025, ys, yh, -0.03, 0.03); }
    // exterior sill
    const out = w.lo ? 1 : -1;
    if (o.sill > 0.2) box("trim", a - 0.06, b + 0.06, ys - 0.06, ys - ft, out > 0 ? 0 : -w.t / 2 - 0.05, out > 0 ? w.t / 2 + 0.05 : 0);
    pane(a, b, ys, yh, 0);
    return;
  }
  if (o.kind === "opening") return;

  // casing around doors
  const ext = !o.rooms[1];
  const casing = ext ? "frame" : "door:int";
  const ht = w.t / 2 + 0.015;
  box(casing, a - 0.07, a, y0, yh, -ht, ht);
  box(casing, b, b + 0.07, y0, yh, -ht, ht);
  box(casing, a - 0.07, b + 0.07, yh, yh + 0.07, -ht, ht);

  const mk = (id: string, kind: DoorLeaf["kind"], hinge: number, dir: 1 | -1, width: number, mat: string, swing: 1 | -1) => {
    doors.push({
      id, opening: o, kind,
      x: ax === "x" ? hinge : c, y: y0, z: ax === "x" ? c : hinge,
      axis: ax, width, height: o.head, dir, swing, mat,
    });
  };
  if (o.kind === "door") {
    mk(o.id, "swing", a, 1, o.width, ext ? "door" : "door:int", sideOf(o.rooms[0]));
  } else if (o.kind === "double") {
    mk(o.id + ":l", "swing", a, 1, o.width / 2, ext ? "door" : "door:int", sideOf(o.rooms[0]));
    mk(o.id + ":r", "swing", b, -1, o.width / 2, ext ? "door" : "door:int", sideOf(o.rooms[0]));
  } else if (o.kind === "slider") {
    const half = o.width / 2;
    box("frame", a, b, y0, y0 + 0.04, -fd, fd);
    box("frame", a - 0.02, a + 0.04, y0, yh, -0.04, 0.04);
    box("frame", a + half - 0.03, a + half + 0.03, y0, yh, -0.06, -0.01);
    pane(a + 0.04, a + half - 0.03, y0 + 0.04, yh, -0.035);
    mk(o.id, "slide", b, -1, half, "frame", sideOf(o.rooms[0]));
  } else if (o.kind === "garage") {
    mk(o.id, "roll", o.at, 1, o.width, "door:garage", 1);
  }
}

function railing(r: Room, plan: Plan, B: Buckets, solids: Rect2[]) {
  const y = plan.levelBase(r.level);
  const edges: { axis: "x" | "z"; c: number; s: number; e: number }[] = [
    { axis: "x", c: r.z0, s: r.x0, e: r.x1 }, { axis: "x", c: r.z1, s: r.x0, e: r.x1 },
    { axis: "z", c: r.x0, s: r.z0, e: r.z1 }, { axis: "z", c: r.x1, s: r.z0, e: r.z1 },
  ];
  for (const ed of edges) {
    const shared = plan.indoor.filter((u) => u.level === r.level).reduce((sum, u) => {
      if (ed.axis === "x" && (Math.abs(u.z0 - ed.c) < 0.01 || Math.abs(u.z1 - ed.c) < 0.01)) return sum + Math.max(0, Math.min(u.x1, ed.e) - Math.max(u.x0, ed.s));
      if (ed.axis === "z" && (Math.abs(u.x0 - ed.c) < 0.01 || Math.abs(u.x1 - ed.c) < 0.01)) return sum + Math.max(0, Math.min(u.z1, ed.e) - Math.max(u.z0, ed.s));
      return sum;
    }, 0);
    if (shared > (ed.e - ed.s) * 0.5) continue;
    const g = 0.015;
    if (ed.axis === "x") {
      B.solid([ed.s, y, ed.c - g], [ed.e, y + 1.05, ed.c + g], "rail");
      B.solid([ed.s, y + 1.05, ed.c - 0.03], [ed.e, y + 1.09, ed.c + 0.03], "frame");
      solids.push({ x0: ed.s, z0: ed.c - 0.06, x1: ed.e, z1: ed.c + 0.06, level: r.level });
    } else {
      B.solid([ed.c - g, y, ed.s], [ed.c + g, y + 1.05, ed.e], "rail");
      B.solid([ed.c - 0.03, y + 1.05, ed.s], [ed.c + 0.03, y + 1.09, ed.e], "frame");
      solids.push({ x0: ed.c - 0.06, z0: ed.s, x1: ed.c + 0.06, z1: ed.e, level: r.level });
    }
  }
}

function fixtures(r: Room, base: number, B: Buckets) {
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  const nx = Math.max(1, Math.min(4, Math.round(w / 1.8))), nz = Math.max(1, Math.min(4, Math.round(d / 1.8)));
  const y = base + CEILING;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = r.x0 + (w * (i + 0.5)) / nx, z = r.z0 + (d * (j + 0.5)) / nz;
      B.box([x - 0.07, y - 0.012, z - 0.07], [x + 0.07, y, z + 0.07], { ny: "fixture", px: "fixture", nx: "fixture", pz: "fixture", nz: "fixture" });
    }
  }
}

function coveredRoof(r: Room, site: Buckets, roofs: Buckets, villa: BuiltVilla) {
  const y = 2.9;
  roofs.box([r.x0 - 0.2, y, r.z0 - 0.2], [r.x1 + 0.2, y + 0.24, r.z1 + 0.2], { py: "roof:flat", ny: "soffit", px: "trim", nx: "trim", pz: "trim", nz: "trim" });
  // posts on the corners away from the house
  const house = villa.rooms.filter((x) => !x.outdoor && x.level === 0);
  const touchesHouse = (x: number, z: number) => house.some((h) => x >= h.x0 - 0.05 && x <= h.x1 + 0.05 && z >= h.z0 - 0.05 && z <= h.z1 + 0.05);
  const xs = [r.x0 + 0.12, r.x1 - 0.12];
  const zs = [r.z0 + 0.12, r.z1 - 0.12];
  const span = r.x1 - r.x0;
  if (span > 6) xs.push((r.x0 + r.x1) / 2);
  for (const x of xs) for (const z of zs) {
    if (touchesHouse(x, z)) continue;
    site.solid([x - 0.1, 0, z - 0.1], [x + 0.1, y, z + 0.1], "trim");
  }
  for (const x of [r.x0 + 0.6, (r.x0 + r.x1) / 2, r.x1 - 0.6]) {
    roofs.box([x - 0.08, y - 0.015, (r.z0 + r.z1) / 2 - 0.08], [x + 0.08, y, (r.z0 + r.z1) / 2 + 0.08], { ny: "fixture" });
  }
}

const geoCache = new Map<string, VillaGeo>();
export function villaGeo(v: BuiltVilla) {
  let g = geoCache.get(v.id);
  if (!g) { g = buildVillaGeo(v); geoCache.set(v.id, g); }
  return g;
}
