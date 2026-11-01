// Renders the reel's static layers from assets/assets.html: background with the iPad, screen mask, glass, captions, end card.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const HERE = new URL(".", import.meta.url).pathname;
const ROOT = path.resolve(HERE, "../..");
const dir = path.join(ROOT, "reel", "assets") + "/";
fs.mkdirSync(dir, { recursive: true });
// The layers use the site's fonts and two of its photos.
for (const [from, to] of [
  ["node_modules/@fontsource/young-serif/files/young-serif-latin-400-normal.woff2", "young-serif-latin-400-normal.woff2"],
  ["node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2", "hanken-grotesk-latin-wght-normal.woff2"],
  ["public/photos/villa-laguna-rear.jpg", "villa-laguna-rear.jpg"],
  ["public/photos/estate-aerial.jpg", "estate-aerial.jpg"],
  ["scripts/reel/assets/assets.html", "assets.html"],
]) fs.copyFileSync(path.join(ROOT, from), path.join(dir, to));
const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9345;
const proc = spawn(CH, ["--headless=new", "--hide-scrollbars", "--force-color-profile=srgb", "--allow-file-access-from-files", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}.chrome`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
// Captions for the long reel and the 15-second cut, one PNG per caption key.
const CAPS = ["captions.json", "cuts-15.json"].flatMap((f) => JSON.parse(fs.readFileSync(new URL(`./${f}`, import.meta.url), "utf8")));
const jobs = [["bg", {}], ["glass", {}], ["end", {}], ["mask", {}], ...CAPS.map((c) => [`cap-${c.key}`, { mode: "cap", eb: c.eb, ln: c.ln }])];
for (const [name, p] of jobs) {
  const qs = new URLSearchParams({ mode: p.mode ?? name, ...(p.eb ? { eb: p.eb, ln: p.ln } : {}) });
  await send("Page.navigate", { url: `file://${dir}assets.html?${qs}` });
  await sleep(900);
  const clip = name === "mask" ? { x: 0, y: 0, width: 900, height: 1288, scale: 1 } : undefined;
  const { result } = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip } : {}) });
  fs.writeFileSync(`${dir}${name}.png`, Buffer.from(result.data, "base64"));
  console.log("asset", name);
}
ws.close(); proc.kill(); process.exit(0);
