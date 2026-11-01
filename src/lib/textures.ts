import * as THREE from "three";

/* Procedural, tileable textures. Every generator works in [0,1) texture space and
   wraps, so nothing seams when repeated across a street or a 9-metre room. */

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function periodicNoise(P: number, seed: number) {
  const r = rng(seed);
  const g = new Float32Array(P * P);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (u: number, v: number) => {
    const x = u * P, y = v * P;
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P;
    const x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
    const a = g[y0 * P + x0], b = g[y0 * P + x1], c = g[y1 * P + x0], d = g[y1 * P + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

function fbm(base: number, octaves: number, seed: number) {
  const ns = Array.from({ length: octaves }, (_, i) => periodicNoise(base << i, seed + i * 101));
  return (u: number, v: number) => {
    let s = 0, a = 0.5, n = 0;
    for (const f of ns) { s += f(u, v) * a; n += a; a *= 0.5; }
    return s / n;
  };
}

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const c = new THREE.Color(h);
  return [c.r * 255, c.g * 255, c.b * 255].map((v) => Math.round(v)) as RGB;
};

interface Out { map: THREE.Texture; normal?: THREE.Texture; rough?: THREE.Texture }

function make(size: number, fill: (u: number, v: number) => { c: RGB; h?: number; r?: number; a?: number }, opts: { normal?: number; rough?: boolean; alpha?: boolean } = {}): Out {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const H = opts.normal ? new Float32Array(size * size) : null;
  const R = opts.rough ? new Uint8ClampedArray(size * size) : null;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = fill(x / size, y / size);
      const i = (y * size + x) * 4;
      img.data[i] = o.c[0]; img.data[i + 1] = o.c[1]; img.data[i + 2] = o.c[2];
      img.data[i + 3] = opts.alpha ? Math.round((o.a ?? 1) * 255) : 255;
      if (H) H[y * size + x] = o.h ?? 0;
      if (R) R[y * size + x] = Math.round((o.r ?? 0.8) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  const out: Out = { map };
  if (H && opts.normal) {
    const nc = document.createElement("canvas");
    nc.width = nc.height = size;
    const nctx = nc.getContext("2d")!;
    const nimg = nctx.createImageData(size, size);
    const s = opts.normal;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const l = H[y * size + ((x - 1 + size) % size)], r = H[y * size + ((x + 1) % size)];
        const u = H[((y - 1 + size) % size) * size + x], d = H[((y + 1) % size) * size + x];
        let nx = (l - r) * s, ny = (d - u) * s, nz = 1;
        const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
        const i = (y * size + x) * 4;
        nimg.data[i] = (nx * 0.5 + 0.5) * 255; nimg.data[i + 1] = (ny * 0.5 + 0.5) * 255;
        nimg.data[i + 2] = (nz * 0.5 + 0.5) * 255; nimg.data[i + 3] = 255;
      }
    }
    nctx.putImageData(nimg, 0, 0);
    out.normal = new THREE.CanvasTexture(nc);
  }
  if (R) {
    const rc = document.createElement("canvas");
    rc.width = rc.height = size;
    const rctx = rc.getContext("2d")!;
    const rimg = rctx.createImageData(size, size);
    for (let i = 0; i < R.length; i++) { rimg.data[i * 4 + 1] = R[i]; rimg.data[i * 4 + 3] = 255; }
    rctx.putImageData(rimg, 0, 0);
    out.rough = new THREE.CanvasTexture(rc);
  }
  for (const t of [out.map, out.normal, out.rough]) {
    if (!t) continue;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.generateMipmaps = true;
  }
  return out;
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

/** Wood planks running along u. One texture covers 2.4 m. */
export function wood(tone: string, seed = 1): Out {
  const base = hex(tone);
  const r = rng(seed);
  const rows = 13;
  const boards: { cut: number; k: number }[][] = [];
  for (let i = 0; i < rows; i++) {
    const cuts: { cut: number; k: number }[] = [];
    let u = r() * 0.5;
    while (cuts.length < 3) { cuts.push({ cut: u % 1, k: 0.82 + r() * 0.3 }); u += 0.3 + r() * 0.4; }
    boards.push(cuts.sort((a, b) => a.cut - b.cut));
  }
  const grain = periodicNoise(8, seed + 7);
  const fine = fbm(16, 3, seed + 3);
  return make(1024, (u, v) => {
    const row = Math.floor(v * rows), fv = v * rows - row;
    const cuts = boards[row];
    let bi = cuts.findIndex((c) => c.cut > u);
    if (bi < 0) bi = 0;
    const board = cuts[(bi + cuts.length - 1) % cuts.length];
    const nearCut = Math.min(...cuts.map((c) => Math.abs(c.cut - u)));
    const g = grain(u * 1.5 + row * 0.37, (row + fv * 0.9) / rows * 3);
    const lines = Math.sin((fv * 9 + g * 6 + u * 2) * Math.PI) * 0.5 + 0.5;
    let k = board.k * (0.9 + lines * 0.12) * (0.92 + fine(u, v) * 0.16);
    let h = 0.6 + lines * 0.05;
    if (fv < 0.035 || fv > 0.965 || nearCut < 0.0015) { k *= 0.55; h = 0; }
    return { c: mul(base, k), h, r: 0.55 + (1 - lines) * 0.15 };
  }, { normal: 3, rough: true });
}

/** Square stone tiles: n per texture side. */
export function stone(tone: string, n: number, grout: string, seed = 2): Out {
  const base = hex(tone), gr = hex(grout);
  const mott = fbm(4, 5, seed);
  const vein = fbm(8, 4, seed + 9);
  const r = rng(seed + 4);
  const tint = Array.from({ length: n * n }, () => 0.93 + r() * 0.1);
  return make(1024, (u, v) => {
    const tx = Math.floor(u * n), ty = Math.floor(v * n);
    const fx = u * n - tx, fy = v * n - ty;
    const edge = Math.min(fx, fy, 1 - fx, 1 - fy);
    const m = mott(u, v), vv = vein(u, v);
    const k = tint[ty * n + tx] * (0.9 + m * 0.18) * (1 - Math.max(0, 0.1 - Math.abs(vv - 0.5)) * 1.5);
    if (edge < 0.006) return { c: gr, h: 0, r: 0.9 };
    return { c: mul(base, k), h: 0.7 + m * 0.05, r: 0.35 + m * 0.2 };
  }, { normal: 4, rough: true });
}

export function pavers(tone: string, seed = 3): Out {
  const base = hex(tone);
  const r = rng(seed);
  const rows = 10, cols = 5;
  const tint = Array.from({ length: rows * cols * 2 }, () => 0.86 + r() * 0.2);
  const n = fbm(8, 4, seed);
  return make(512, (u, v) => {
    const row = Math.floor(v * rows), fv = v * rows - row;
    const off = row % 2 ? 0.5 / cols : 0;
    const uu = (u + off) % 1;
    const col = Math.floor(uu * cols), fu = uu * cols - col;
    const edge = Math.min(fu, 1 - fu, (fv) * 0.5, (1 - fv) * 0.5);
    if (edge < 0.02) return { c: mul(base, 0.55), h: 0, r: 0.95 };
    return { c: mul(base, tint[row * cols + col] * (0.92 + n(u, v) * 0.16)), h: 0.6, r: 0.8 };
  }, { normal: 3, rough: true });
}

export function grass(seed = 4): Out {
  // St. Augustine lawn: olive, slightly sun-bleached, never the saturated green of a game.
  const a = hex("#66773f"), b = hex("#859257"), c = hex("#525f34");
  const n1 = fbm(8, 5, seed), n2 = fbm(64, 2, seed + 5);
  const r = rng(seed + 11);
  const speck = Array.from({ length: 4096 }, () => r());
  return make(1024, (u, v) => {
    const t = n1(u, v), s = n2(u, v);
    let col = mix(a, b, Math.min(1, Math.max(0, (t - 0.35) * 2)));
    col = mix(col, c, Math.max(0, s - 0.55) * 1.6);
    const sp = speck[(Math.floor(u * 256) + Math.floor(v * 256) * 7) % 4096];
    if (sp > 0.94) col = mul(col, 1.18);
    if (sp < 0.04) col = mul(col, 0.78);
    return { c: col, h: s, r: 0.95 };
  }, { normal: 1.5 });
}

export function asphalt(seed = 5): Out {
  const base = hex("#5a5c5e");
  const n = fbm(16, 4, seed);
  const r = rng(seed);
  return make(512, (u, v) => {
    const k = 0.85 + n(u, v) * 0.3 + (r() > 0.92 ? 0.25 : 0) - (r() > 0.95 ? 0.2 : 0);
    return { c: mul(base, k), h: r(), r: 0.9 };
  }, { normal: 0.6 });
}

export function concrete(tone = "#c9c4ba", seed = 6): Out {
  const base = hex(tone);
  const n = fbm(8, 5, seed);
  return make(512, (u, v) => {
    const m = n(u, v);
    const joint = Math.min(u, 1 - u, v, 1 - v) < 0.004;
    return { c: mul(base, joint ? 0.7 : 0.9 + m * 0.18), h: joint ? 0 : 0.5 + m * 0.1, r: 0.85 };
  }, { normal: 2 });
}

export function stucco(seed = 7): Out {
  const n = fbm(32, 4, seed);
  return make(512, (u, v) => {
    const m = n(u, v);
    const k = 235 + m * 20;
    return { c: [k, k, k], h: m, r: 0.9 };
  }, { normal: 2.5 });
}

/** Barrel clay tiles; rows along v. */
export function roofTiles(tone: string, barrel: boolean, seed = 8): Out {
  const base = hex(tone);
  const r = rng(seed);
  const rows = 12, cols = 10;
  const tint = Array.from({ length: rows * cols }, () => 0.8 + r() * 0.32);
  const n = fbm(8, 3, seed);
  return make(512, (u, v) => {
    const row = Math.floor(v * rows), fv = v * rows - row;
    const off = barrel ? 0 : (row % 2) * 0.5 / cols;
    const uu = (u + off) % 1;
    const col = Math.floor(uu * cols), fu = uu * cols - col;
    const curve = barrel ? Math.sin(fu * Math.PI) : 1 - Math.abs(fu - 0.5) * 0.2;
    const lap = fv > 0.88 ? 0.7 : 1;
    const k = tint[row * cols + col] * (0.75 + curve * 0.3) * lap * (0.92 + n(u, v) * 0.14);
    return { c: mul(base, k), h: curve * 0.8 + (fv > 0.88 ? -0.4 : 0), r: 0.75 };
  }, { normal: 5 });
}

/** Clusters of leaves on transparent ground, for canopies and shrubs. A dense core keeps the card
 *  solid through the mip chain so canopies don't dissolve into specks at a distance. */
export function leaves(tones: string[], seed = 9, density = 260): Out {
  const cols = tones.map(hex);
  const r = rng(seed);
  const cv = document.createElement("canvas");
  cv.width = cv.height = 512;
  const ctx = cv.getContext("2d")!;
  const dark = cols.reduce((a, c) => (c[0] + c[1] + c[2] < a[0] + a[1] + a[2] ? c : a), cols[0]);
  ctx.fillStyle = `rgb(${dark[0] * 0.8},${dark[1] * 0.8},${dark[2] * 0.8})`;
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = r() * 120;
    ctx.beginPath();
    ctx.arc(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, 50 + r() * 50, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < density; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 225;
    const x = 256 + Math.cos(a) * d, y = 256 + Math.sin(a) * d;
    const c = cols[Math.floor(r() * cols.length)];
    const k = 0.75 + r() * 0.5 - (1 - d / 225) * 0.15;
    ctx.fillStyle = `rgb(${c[0] * k},${c[1] * k},${c[2] * k})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r() * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 10 + r() * 12, 4.5 + r() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return { map };
}

/** One palm frond: a midrib with leaflets, drawn along v. */
export function frond(seed = 10): Out {
  const r = rng(seed);
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 512;
  const ctx = cv.getContext("2d")!;
  ctx.strokeStyle = "#6f7d3a"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 512); ctx.stroke();
  for (let y = 10; y < 500; y += 7) {
    const t = y / 512;
    const len = 58 * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (0.85 + r() * 0.25);
    for (const s of [-1, 1]) {
      const g = 98 + r() * 34;
      ctx.strokeStyle = `rgb(${72 + r() * 28},${g},${46 + r() * 18})`;
      ctx.lineWidth = 3 + r() * 2;
      ctx.beginPath();
      ctx.moveTo(64, y);
      ctx.quadraticCurveTo(64 + s * len * 0.6, y + 6, 64 + s * len, y + 18 + r() * 8);
      ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return { map };
}

export function bark(tone: string, seed = 11): Out {
  const base = hex(tone);
  const n = fbm(8, 4, seed);
  return make(256, (u, v) => {
    const s = Math.sin((u * 18 + n(u, v * 0.3) * 4) * Math.PI) * 0.5 + 0.5;
    return { c: mul(base, 0.7 + s * 0.4), h: s, r: 0.95 };
  }, { normal: 4 });
}

export function palmTrunk(seed = 12): Out {
  const base = hex("#9b917f");
  const n = fbm(8, 3, seed);
  return make(256, (u, v) => {
    const ring = Math.pow(Math.abs(Math.sin(v * 40 * Math.PI)), 6);
    return { c: mul(base, 0.85 + n(u, v) * 0.2 - ring * 0.25), h: 1 - ring, r: 0.95 };
  }, { normal: 3 });
}

export function waterNormal(seed = 13): Out {
  const n = fbm(4, 5, seed);
  return make(512, (u, v) => ({ c: [255, 255, 255], h: n(u, v) }), { normal: 6 });
}

export function sand(seed = 14): Out {
  const base = hex("#e3d3ae");
  const n = fbm(16, 4, seed);
  return make(256, (u, v) => ({ c: mul(base, 0.92 + n(u, v) * 0.14), h: n(u, v), r: 1 }), { normal: 2 });
}
