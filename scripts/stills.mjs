// Renders marketing stills from the live 3D model into public/stills/.
// Needs the dev server running (npm run dev). Usage: node scripts/stills.mjs [name ...]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../public/stills");
const URL = process.env.URL ?? "http://127.0.0.1:5190/?still=1";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9335;
const W = 1600, H = 1000;
fs.mkdirSync(OUT, { recursive: true });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sabal-stills-"));
const proc = spawn(CHROME, ["--headless=new", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets = [];
for (let i = 0; i < 60 && !targets.length; i++) { try { targets = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).filter((t) => t.type === "page"); } catch { /* starting */ } await sleep(200); }
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const run = async (js) => { const r = await send("Runtime.evaluate", { expression: js, awaitPromise: true }); if (r.result?.exceptionDetails) errors.push(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); };

await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: URL });
await sleep(10000);

const st = (o) => `window.__store.getState().set(${JSON.stringify(o)})`;
const reset = (time) => `(window.__store.getState().villaId && window.__store.getState().leaveVilla(), ${st({ layout: "explore", villaId: null, picked: null, place: null, selection: null, mode: "lights", time })})`;
const villas = ["casa-palma", "villa-coral", "the-cypress", "villa-sable", "heron-house", "villa-laguna"];

/** name -> [setup js, settle ms] */
const SHOTS = {
  ...Object.fromEntries(villas.map((v) => [v, [`${reset("day")}; setTimeout(() => window.__frameVilla(${JSON.stringify(v)}, { dist: 3.0, polar: 1.12, az: Math.PI - 0.62, y: 2.2 }), 1500)`, 6000]])),
  aerial: [`${reset("dusk")}; setTimeout(() => window.__frameAt([-82, 62, -66], [34, 8, 150]), 1500)`, 7000],
  gate: [`${reset("day")}; setTimeout(() => window.__frameAt([-128, 12, 24], [-70, 2, -1]), 1500)`, 6000],
  lights: [`${reset("dusk")}; window.__store.getState().enterVilla("villa-sable"); ${st({ level: 0 })}`, 7000],
  plan: [`${reset("day")}; window.__store.getState().enterVilla("casa-palma"); ${st({ mode: "plan", level: 0 })}`, 7000],
  walk: [`${reset("dusk")}; window.__store.getState().enterVilla("casa-palma"); ${st({ mode: "walk", level: 0 })}; setTimeout(() => window.__walkTo(9.5, 2.6, 0), 1500)`, 10000],
};

const want = process.argv.slice(2);
for (const [name, [js, wait]] of Object.entries(SHOTS)) {
  if (want.length && !want.includes(name)) continue;
  await run(js);
  await sleep(wait);
  const { result } = await send("Page.captureScreenshot", { format: "jpeg", quality: 84 });
  fs.writeFileSync(path.join(OUT, `${name}.jpg`), Buffer.from(result.data, "base64"));
  console.log("still", name);
}
if (errors.length) console.log(errors.slice(0, 10).join("\n"));
ws.close();
proc.kill();
await sleep(600);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock; the OS temp dir cleans up */ }
process.exit(0);
