/**
 * The city around Sabal Grove. Everything is generated from one street grid so the ground shader,
 * the towers and the traffic agree on where roads are.
 */
export const CITY = {
  /** Block pitch and road width, metres. Road centrelines sit at x ≡ ox and z ≡ oz (mod grid). */
  grid: 120,
  road: 20,
  sidewalk: 4,
  ox: -100,
  oz: 280,
  boulevard: { x: -100, width: 30, median: 6, name: "Harbor Boulevard" },
  /** The gated estate: lawns, lots and the golf course. The city ground stops at its edge. */
  estate: { x0: -86, x1: 128, z0: -184, z1: 46 },
  lake: { x0: -420, x1: 420, z0: 46, z1: 262 },
  radius: 1050,
};

export interface Tower { x: number; z: number; w: number; d: number; h: number; seed: number; kind: 0 | 1 | 2 }

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const overlaps = (a: { x0: number; x1: number; z0: number; z1: number }, x0: number, z0: number, x1: number, z1: number, pad = 0) =>
  x1 > a.x0 - pad && x0 < a.x1 + pad && z1 > a.z0 - pad && z0 < a.z1 + pad;

/** Height range by district: the downtown skyline across the lake, mid-rise to the west, lower elsewhere. */
function district(x: number, z: number): [number, number, number] {
  if (z > CITY.lake.z1) {
    const core = Math.exp(-((x - 60) ** 2) / (2 * 260 ** 2));
    return [40 + core * 50, 90 + core * 130, 0];
  }
  if (x < CITY.estate.x0) return [16, 70, 1];
  if (z < CITY.estate.z0) return [12, 46, 2];
  return [10, 38, 2];
}

let cached: Tower[] | null = null;

export function towers(): Tower[] {
  if (cached) return cached;
  const r = rng(4021);
  const out: Tower[] = [];
  const { grid: P, road, sidewalk } = CITY;
  const n = Math.ceil(CITY.radius / P) + 1;
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const cx = CITY.ox + (i + 0.5) * P, cz = CITY.oz + (j + 0.5) * P;
      if (Math.hypot(cx, cz - 60) > CITY.radius) continue;
      const westEdge = Math.abs(cx - P / 2 - CITY.boulevard.x) < 1 ? CITY.boulevard.width / 2 : road / 2;
      const eastEdge = Math.abs(cx + P / 2 - CITY.boulevard.x) < 1 ? CITY.boulevard.width / 2 : road / 2;
      const x0 = cx - P / 2 + westEdge + sidewalk + 2, x1 = cx + P / 2 - eastEdge - sidewalk - 2;
      const z0 = cz - P / 2 + road / 2 + sidewalk + 2, z1 = cz + P / 2 - road / 2 - sidewalk - 2;
      if (overlaps(CITY.estate, x0, z0, x1, z1, 6) || overlaps(CITY.lake, x0, z0, x1, z1, 4)) continue;
      const [hMin, hMax, kind] = district(cx, cz);
      // Split the block into one, two or four parcels.
      const split = r();
      const cells: [number, number, number, number][] = split < 0.25
        ? [[x0, z0, x1, z1]]
        : split < 0.55
          ? [[x0, z0, (x0 + x1) / 2 - 3, z1], [(x0 + x1) / 2 + 3, z0, x1, z1]]
          : [[x0, z0, (x0 + x1) / 2 - 3, (z0 + z1) / 2 - 3], [(x0 + x1) / 2 + 3, z0, x1, (z0 + z1) / 2 - 3],
             [x0, (z0 + z1) / 2 + 3, (x0 + x1) / 2 - 3, z1], [(x0 + x1) / 2 + 3, (z0 + z1) / 2 + 3, x1, z1]];
      for (const [a, b, c, d] of cells) {
        const w = c - a, dd = d - b;
        const h = hMin + (hMax - hMin) * r() ** 1.6;
        // downtown is mostly curtain wall; elsewhere a mix of office and residential towers
        const roll = r();
        const k = (kind === 0 ? (roll < 0.7 ? 0 : roll < 0.85 ? 1 : 2) : kind === 1 ? (roll < 0.35 ? 0 : roll < 0.65 ? 1 : 2) : (roll < 0.15 ? 0 : roll < 0.35 ? 1 : 2)) as Tower["kind"];
        if (h > 55 && w > 26 && dd > 26) {
          // podium plus a slimmer tower set back from the street
          out.push({ x: (a + c) / 2, z: (b + d) / 2, w, d: dd, h: 9 + r() * 6, seed: r(), kind: 1 });
          const tw = w * (0.5 + r() * 0.25), td = dd * (0.5 + r() * 0.25);
          out.push({ x: a + w / 2 + (r() - 0.5) * (w - tw) * 0.6, z: b + dd / 2 + (r() - 0.5) * (dd - td) * 0.6, w: tw, d: td, h, seed: r(), kind: k });
        } else {
          const m = 2 + r() * 4;
          out.push({ x: (a + c) / 2, z: (b + d) / 2, w: w - m, d: dd - m, h, seed: r(), kind: k });
        }
      }
    }
  }
  cached = out;
  return out;
}

/** Lanes that carry traffic: [axis, centreline coordinate, direction, from, to]. */
export function lanes(): { axis: "x" | "z"; c: number; dir: 1 | -1; a: number; b: number }[] {
  const B = CITY.boulevard.x;
  const L: ReturnType<typeof lanes> = [];
  // Harbor Boulevard, three lanes each way; northbound (−z) runs on the east side.
  for (const [off, dir] of [[4.6, -1], [7.9, -1], [11.2, -1], [-4.6, 1], [-7.9, 1], [-11.2, 1]] as const) L.push({ axis: "z", c: B + off, dir, a: -900, b: 40 });
  // Eastbound traffic keeps to the +z side of an east-west street; southbound to the −x side of a north-south one.
  const ew = (z: number, a: number, b: number) => L.push({ axis: "x", c: z + 2.8, dir: 1, a, b }, { axis: "x", c: z - 2.8, dir: -1, a, b });
  const ns = (x: number, a: number, b: number) => L.push({ axis: "z", c: x - 2.8, dir: 1, a, b }, { axis: "z", c: x + 2.8, dir: -1, a, b });
  const west = B - CITY.boulevard.width / 2;
  ew(CITY.oz - 2 * CITY.grid, -900, west); // lakeshore drive
  ew(CITY.oz - 3 * CITY.grid, -900, west);
  ew(CITY.oz - 4 * CITY.grid, -900, 900); // north of the golf course
  ew(CITY.oz, -900, 900); // waterfront drive downtown
  ns(CITY.ox + 2 * CITY.grid, -900, CITY.lake.z0); // east avenue
  return L;
}
