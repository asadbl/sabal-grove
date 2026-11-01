import { CATALOG } from "./catalog";
import type {
  Block, Item, Opening, OpeningKind, Pool, RoofKind, Room, RoomType, Side, Stair, Villa,
} from "./types";
import { LEVEL_HEIGHT } from "./types";

type Rect = [number, number, number, number];

const OUTDOOR: RoomType[] = ["terrace", "balcony", "pooldeck", "driveway", "garden"];
const WALL_GAP = 0.14;

const HEADS: Record<OpeningKind, [number, number]> = {
  door: [0, 2.15],
  double: [0, 2.4],
  slider: [0, 2.5],
  garage: [0, 2.35],
  opening: [0, 2.6],
  window: [0.9, 2.3],
};

const WIDTHS: Record<OpeningKind, number> = {
  door: 0.9, double: 1.8, slider: 3.0, garage: 4.8, opening: 1.6, window: 1.6,
};

interface ItemOpts {
  wall?: Side;
  /** Centre of the item along the wall, measured from the room's min corner. */
  along?: number;
  /** Extra distance from the wall. */
  off?: number;
  /** Centre of the item, measured from the room's min corner. */
  x?: number;
  z?: number;
  rot?: number;
  size?: [number, number, number];
  tone?: string;
  label?: string;
  y?: number;
}

export class VillaBuilder {
  rooms = new Map<string, Room>();
  openings: Opening[] = [];
  items: Item[] = [];
  stairs: Stair[] = [];
  blocks: Block[] = [];
  opens = new Set<string>();
  noWindows = new Set<string>();
  pool?: Pool;

  room(id: string, name: string, type: RoomType, r: Rect, o: { level?: number; covered?: boolean; windows?: boolean } = {}) {
    this.rooms.set(id, {
      id, name, type,
      level: o.level ?? 0,
      x0: r[0], z0: r[1], x1: r[2], z1: r[3],
      outdoor: OUTDOOR.includes(type),
      covered: o.covered,
    });
    if (o.windows === false) this.noWindows.add(id);
    return this;
  }

  get(id: string) {
    const r = this.rooms.get(id);
    if (!r) throw new Error(`unknown room ${id}`);
    return r;
  }

  /** No wall between two rooms: one open space. */
  open(a: string, b: string) {
    this.opens.add([a, b].sort().join("|"));
    return this;
  }

  /** A door on the wall two rooms share. `at` is an absolute coordinate along that wall. */
  door(a: string, b: string, o: { at?: number; width?: number; kind?: OpeningKind } = {}) {
    const A = this.get(a), B = this.get(b);
    const kind = o.kind ?? "door";
    let axis: "x" | "z", c: number, lo: number, hi: number;
    if (Math.abs(A.x1 - B.x0) < 1e-6 || Math.abs(A.x0 - B.x1) < 1e-6) {
      axis = "z";
      c = Math.abs(A.x1 - B.x0) < 1e-6 ? A.x1 : A.x0;
      lo = Math.max(A.z0, B.z0); hi = Math.min(A.z1, B.z1);
    } else if (Math.abs(A.z1 - B.z0) < 1e-6 || Math.abs(A.z0 - B.z1) < 1e-6) {
      axis = "x";
      c = Math.abs(A.z1 - B.z0) < 1e-6 ? A.z1 : A.z0;
      lo = Math.max(A.x0, B.x0); hi = Math.min(A.x1, B.x1);
    } else throw new Error(`rooms ${a} and ${b} share no wall`);
    if (hi - lo < 0.5) throw new Error(`rooms ${a} and ${b} share too little wall`);
    const width = Math.min(o.width ?? WIDTHS[kind], hi - lo - 0.2);
    const at = o.at ?? (lo + hi) / 2;
    const [sill, head] = HEADS[kind];
    this.openings.push({ id: `${a}-${b}-${this.openings.length}`, level: A.level, kind, axis, c, at, width, sill, head, rooms: [a, b] });
    return this;
  }

  /** An opening in an exterior wall: front door, slider, garage door or window. */
  ext(room: string, side: Side, o: { at?: number; width?: number; kind?: OpeningKind; sill?: number; head?: number } = {}) {
    const R = this.get(room);
    const kind = o.kind ?? "window";
    const axis = side === "front" || side === "back" ? "x" : "z";
    const c = side === "front" ? R.z0 : side === "back" ? R.z1 : side === "left" ? R.x0 : R.x1;
    const lo = axis === "x" ? R.x0 : R.z0, hi = axis === "x" ? R.x1 : R.z1;
    const width = Math.min(o.width ?? WIDTHS[kind], hi - lo - 0.3);
    const [sill, head] = HEADS[kind];
    this.openings.push({
      id: `${room}-${side}-${this.openings.length}`, level: R.level, kind, axis, c,
      at: o.at ?? (lo + hi) / 2, width, sill: o.sill ?? sill, head: o.head ?? head, rooms: [room, null],
    });
    return this;
  }

  item(kind: string, room: string, o: ItemOpts = {}) {
    const cat = CATALOG[kind];
    if (!cat) throw new Error(`unknown item ${kind}`);
    const R = this.get(room);
    const size = o.size ?? cat.size;
    const d = size[1];
    let x: number, z: number, rot = ((o.rot ?? 0) * Math.PI) / 180;
    const off = WALL_GAP + (o.off ?? 0);
    if (o.wall) {
      const alongX = o.wall === "front" || o.wall === "back";
      const along = o.along ?? (alongX ? (R.x1 - R.x0) / 2 : (R.z1 - R.z0) / 2);
      if (o.wall === "front") { rot = 0; z = R.z0 + off + d / 2; x = R.x0 + along; }
      else if (o.wall === "back") { rot = Math.PI; z = R.z1 - off - d / 2; x = R.x0 + along; }
      else if (o.wall === "left") { rot = Math.PI / 2; x = R.x0 + off + d / 2; z = R.z0 + along; }
      else { rot = -Math.PI / 2; x = R.x1 - off - d / 2; z = R.z0 + along; }
    } else {
      x = R.x0 + (o.x ?? (R.x1 - R.x0) / 2);
      z = R.z0 + (o.z ?? (R.z1 - R.z0) / 2);
    }
    this.items.push({
      id: `${room}-${kind}-${this.items.length}`,
      kind, label: o.label ?? cat.label, room, level: R.level,
      x, z, y: R.level * LEVEL_HEIGHT + (o.y ?? 0), rot, size, tone: o.tone, solid: !!cat.solid,
    });
    return this;
  }

  stair(level: number, r: Rect, dir: Stair["dir"]) {
    this.stairs.push({ level, x0: r[0], z0: r[1], x1: r[2], z1: r[3], dir });
    return this;
  }

  block(level: number, r: Rect, roof: RoofKind) {
    this.blocks.push({ level, x0: r[0], z0: r[1], x1: r[2], z1: r[3], roof });
    return this;
  }

  setPool(p: Pool) {
    this.pool = p;
    return this;
  }
}

export type VillaMeta = Omit<Villa, "rooms" | "openings" | "stairs" | "blocks" | "pool" | "items" | "bounds">;

export interface BuiltVilla extends Villa {
  opens: Set<string>;
  noWindows: Set<string>;
}

export function defineVilla(meta: VillaMeta, build: (b: VillaBuilder) => void): BuiltVilla {
  const b = new VillaBuilder();
  build(b);
  const rooms = [...b.rooms.values()];
  const xs = rooms.flatMap((r) => [r.x0, r.x1]);
  const zs = rooms.flatMap((r) => [r.z0, r.z1]);
  if (b.pool) { xs.push(b.pool.x0, b.pool.x1); zs.push(b.pool.z0, b.pool.z1); }
  return {
    ...meta,
    rooms,
    openings: b.openings,
    stairs: b.stairs,
    blocks: b.blocks,
    pool: b.pool,
    items: b.items,
    opens: b.opens,
    noWindows: b.noWindows,
    bounds: { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) },
  };
}
