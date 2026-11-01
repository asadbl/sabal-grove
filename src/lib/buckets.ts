import * as THREE from "three";

type V3 = [number, number, number];
interface Data { p: number[]; n: number[]; uv: number[] }

export interface FaceKeys { px?: string; nx?: string; py?: string; ny?: string; pz?: string; nz?: string }

/** Accumulates faces per material key, then emits one BufferGeometry per key. */
export class Buckets {
  data = new Map<string, Data>();

  private d(key: string) {
    let x = this.data.get(key);
    if (!x) { x = { p: [], n: [], uv: [] }; this.data.set(key, x); }
    return x;
  }

  /** Planar polygon, fan-triangulated, world-planar UVs from the dominant normal axis. */
  poly(key: string, pts: V3[], n: V3, uvs?: [number, number][]) {
    const d = this.d(key);
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    const uv = (p: V3): [number, number] => (ay >= ax && ay >= az ? [p[0], p[2]] : ax >= az ? [p[2], p[1]] : [p[0], p[1]]);
    for (let i = 1; i < pts.length - 1; i++) {
      for (const j of [0, i, i + 1]) {
        const p = pts[j];
        d.p.push(p[0], p[1], p[2]);
        d.n.push(n[0], n[1], n[2]);
        const t = uvs ? uvs[j] : uv(p);
        d.uv.push(t[0], t[1]);
      }
    }
  }

  /** Polygon with its normal computed from winding, flipped to face upward when `up` is set. */
  plane(key: string, pts: V3[], up = false) {
    const a = new THREE.Vector3(...pts[0]), b = new THREE.Vector3(...pts[1]), c = new THREE.Vector3(...pts[2]);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    let P = pts;
    if (up && n.y < 0) { P = [...pts].reverse(); n.negate(); }
    const e = new THREE.Vector3(...P[1]).sub(new THREE.Vector3(...P[0])).normalize();
    const s = new THREE.Vector3().crossVectors(n, e).normalize();
    const uvs = P.map((p) => { const v = new THREE.Vector3(...p); return [v.dot(e), v.dot(s)] as [number, number]; });
    this.poly(key, P, [n.x, n.y, n.z], uvs);
  }

  box(min: V3, max: V3, f: FaceKeys) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return;
    if (f.px) this.poly(f.px, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]);
    if (f.nx) this.poly(f.nx, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);
    if (f.py) this.poly(f.py, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0]);
    if (f.ny) this.poly(f.ny, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
    if (f.pz) this.poly(f.pz, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
    if (f.nz) this.poly(f.nz, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
  }

  /** Same key on every face. */
  solid(min: V3, max: V3, key: string, skipBottom = true) {
    this.box(min, max, { px: key, nx: key, py: key, ny: skipBottom ? undefined : key, pz: key, nz: key });
  }

  build() {
    const out = new Map<string, THREE.BufferGeometry>();
    for (const [k, d] of this.data) {
      if (!d.p.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(d.p, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(d.n, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(d.uv, 2));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      out.set(k, g);
    }
    return out;
  }
}
