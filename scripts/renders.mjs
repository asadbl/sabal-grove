// Renders the 3D source frames that scripts/photos.mjs turns into photographs.
// Needs the dev server (npm run dev) and Google Chrome. Usage: node scripts/renders.mjs [villaId ...]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, ".photo-src");
fs.mkdirSync(OUT, { recursive: true });
const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9336;
const W = 1536, H = 1024;
const proc = spawn(CH, ["--headless=new", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${OUT}/.chrome`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const run = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
};

await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: process.env.URL ?? "http://127.0.0.1:5190/" });
await sleep(9000);

// Hide every UI layer: keep only the canvas and its ancestors, and drop the Html overlays beside it.
const HIDE_UI = `(() => {
  const c = document.querySelector("canvas");
  let n = c;
  while (n && n !== document.body) {
    for (const s of n.parentElement.children) if (s !== n) s.style.visibility = "hidden";
    n = n.parentElement;
  }
  c.style.visibility = "visible";
})()`;

async function shot(file, setup, wait = 3200) {
  await run(setup);
  await sleep(wait);
  await run(HIDE_UI);
  await sleep(200);
  const { result } = await send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(result.data, "base64"));
  console.log("render", file);
}

// Camera helpers evaluated in the page: villa-local metres to world.
const PAGE = `
  window.__lot = (id) => window.__lots.find((l) => l.villa.id === id);
  window.__ext = (id, time, from, to) => {
    const s = window.__store.getState();
    s.set({ layout: "explore", villaId: null, picked: null, hoverVilla: null, place: null, selection: null, time });
    const lot = window.__lot(id);
    const [px, pz] = window.__toWorld(lot, from[0], from[2]);
    const [tx, tz] = window.__toWorld(lot, to[0], to[2]);
    setTimeout(() => window.__view([px, from[1], pz], [tx, to[1], tz]), 1200);
  };
  window.__room = (id, kind) => {
    const v = window.__lot(id).villa;
    const pick = {
      living: (r) => r.type === "living",
      kitchen: (r) => r.type === "kitchen",
      primary: (r) => r.type === "primary",
      bath: (r) => r.type === "bath" && /primary/i.test(r.name),
    }[kind];
    return v.rooms.find(pick) ?? (kind === "bath" ? v.rooms.find((r) => r.type === "bath") : null);
  };
  window.__int = (id, kind) => {
    const r = window.__room(id, kind);
    if (!r) return false;
    const s = window.__store.getState();
    s.enterVilla(id);
    s.set({ mode: "walk", time: "day" });
    s.setAllLights(id, true);
    // From the front corner, looking across the room toward the garden side.
    const x = r.x0 + 0.75, z = r.z0 + 0.75;
    const tx = r.x1 - 0.6, tz = r.z1 - 0.4;
    setTimeout(() => window.__walkSet(x, z, Math.atan2(tx - x, tz - z), -0.07, r.level), 1500);
    return true;
  };
`;
await run(PAGE);

// Design facts for the photo prompts.
const meta = await run(`window.__lots.map(({ villa: v }) => ({ id: v.id, name: v.name, tagline: v.tagline, blurb: v.blurb, levels: v.levels, pool: !!v.pool,
  style: v.style, roofs: [...new Set(v.blocks.map((b) => b.roof))], features: v.features,
  rooms: v.rooms.map((r) => ({ id: r.id, name: r.name, type: r.type, w: +(r.x1 - r.x0).toFixed(1), d: +(r.z1 - r.z0).toFixed(1) })) }))`);
fs.writeFileSync(path.join(OUT, "villas.json"), JSON.stringify(meta, null, 1));

const ids = process.argv.slice(2).length ? process.argv.slice(2) : await run(`window.__lots.map((l) => l.villa.id)`);
for (const vid of ids) {
  const b = await run(`(() => { const v = window.__lot(${JSON.stringify(vid)}).villa; return { ...v.bounds, levels: v.levels, pool: !!v.pool }; })()`);
  const cx = (b.x0 + b.x1) / 2, w = b.x1 - b.x0, d = b.z1;
  const h = b.levels > 1 ? 4.2 : 2.6;
  await shot(`${vid}-front.jpg`, `window.__ext(${JSON.stringify(vid)}, "dusk", [${cx + w * 0.32}, 1.9, -21], [${cx - w * 0.04}, ${h}, ${d * 0.3}])`, 4200);
  await shot(`${vid}-rear.jpg`, `window.__ext(${JSON.stringify(vid)}, "dusk", [${cx - w * 0.3}, 2.4, ${Math.min(d + 10, 29)}], [${cx + w * 0.05}, ${h * 0.7}, ${d * 0.55}])`, 4200);
  await shot(`${vid}-aerial.jpg`, `window.__ext(${JSON.stringify(vid)}, "day", [${b.x1 + 16}, 24, -16], [${cx}, 0, ${d * 0.45}])`, 4200);
  for (const kind of ["living", "kitchen", "primary", "bath"]) {
    const ok = await run(`window.__room(${JSON.stringify(vid)}, ${JSON.stringify(kind)}) ? true : false`);
    if (!ok) continue;
    await shot(`${vid}-${kind}.jpg`, `window.__int(${JSON.stringify(vid)}, ${JSON.stringify(kind)})`, 5200);
  }
  await run(`window.__store.getState().set({ villaId: null, mode: "lights" })`);
}

// The neighbourhood: the gate off the boulevard, the street, and the skyline over the lake.
await run(`window.__store.getState().set({ layout: "explore", villaId: null, picked: null, place: null, time: "dusk" })`);
await sleep(1500);
await shot("estate-gate.jpg", `window.__view([-112, 7, 26], [-74, 2, 0])`);
await shot("estate-street.jpg", `window.__view([-40, 3.2, -1.5], [40, 3, 2])`);
await shot("estate-skyline.jpg", `window.__store.getState().set({ time: "dusk" }), window.__view([-10, 9, 30], [70, 40, 420])`);
await shot("estate-aerial.jpg", `window.__store.getState().set({ time: "day" }), window.__view([-140, 120, -150], [10, 0, 30])`);

ws.close(); proc.kill();
process.exit(0);
