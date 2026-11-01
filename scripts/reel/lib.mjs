// Frame-exact screen recording of the Sabal Grove site in headless Chrome.
// The page runs on a virtual clock: each video frame advances requestAnimationFrame, timers,
// performance.now, Date.now and every CSS/Web animation by exactly 1/FPS, then the frame is captured.
import { spawn } from "node:child_process";
import fs from "node:fs";

const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SHIM = `(() => {
  const rRAF = window.requestAnimationFrame.bind(window), rCAF = window.cancelAnimationFrame.bind(window);
  const rNow = performance.now.bind(performance), rDateNow = Date.now.bind(Date);
  const rST = window.setTimeout.bind(window), rCT = window.clearTimeout.bind(window);
  const rSI = window.setInterval.bind(window), rCI = window.clearInterval.bind(window);
  let on = false, t = 0, dateBase = 0, rafQ = new Map(), rafId = 1, timerId = 1e7;
  const timers = new Map(), animT = new WeakMap();
  performance.now = () => (on ? t : rNow());
  Date.now = () => (on ? dateBase + t : rDateNow());
  window.requestAnimationFrame = (cb) => { if (!on) return rRAF(cb); const id = rafId++; rafQ.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { rafQ.delete(id); rCAF(id); };
  window.setTimeout = (cb, ms = 0, ...a) => { if (!on) return rST(cb, ms, ...a); const id = timerId++; timers.set(id, { due: t + Math.max(0, +ms || 0), cb, a, every: 0 }); return id; };
  window.setInterval = (cb, ms = 0, ...a) => { if (!on) return rSI(cb, ms, ...a); const id = timerId++; const e = Math.max(1, +ms || 0); timers.set(id, { due: t + e, cb, a, every: e }); return id; };
  window.clearTimeout = (id) => { if (timers.has(id)) timers.delete(id); else rCT(id); };
  window.clearInterval = (id) => { if (timers.has(id)) timers.delete(id); else rCI(id); };
  window.__vt = {
    start() { dateBase = rDateNow() - rNow(); t = rNow(); on = true; },
    now: () => t,
    async step(dt) {
      t += dt;
      for (let guard = 0; guard < 500; guard++) {
        let best = null;
        for (const [id, x] of timers) if (x.due <= t && (!best || x.due < best[1].due)) best = [id, x];
        if (!best) break;
        const [id, x] = best;
        if (x.every) x.due += x.every; else timers.delete(id);
        try { if (typeof x.cb === "function") x.cb(...x.a); } catch (e) { console.error(e); }
      }
      for (const a of document.getAnimations()) {
        let lt = animT.get(a);
        if (lt === undefined) { lt = a.currentTime ?? 0; a.pause(); } else lt += dt;
        animT.set(a, lt); a.currentTime = lt;
      }
      const q = rafQ; rafQ = new Map();
      for (const cb of q.values()) { try { cb(t); } catch (e) { console.error(e); } }
      await new Promise((r) => rRAF(() => rRAF(r)));
    },
  };
})();`;

// A white pointing hand with its fingertip at (0,0), plus a touch ring drawn while pressed.
const FINGER = `(() => {
  const NS = "http://www.w3.org/2000/svg";
  const box = document.createElement("div");
  box.id = "__finger";
  box.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;opacity:0;will-change:transform";
  box.innerHTML = \`
    <div id="__ring" style="position:absolute;left:-30px;top:-30px;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.28);border:2.5px solid rgba(255,255,255,.95);box-shadow:0 0 0 1px rgba(0,0,0,.18),0 4px 18px rgba(0,0,0,.25);opacity:0"></div>
    <div id="__ripple" style="position:absolute;left:-30px;top:-30px;width:60px;height:60px;border-radius:50%;border:3px solid rgba(255,255,255,.9);opacity:0"></div>
    <svg id="__hand" width="66" height="84" viewBox="0 0 66 84" style="position:absolute;left:-23px;top:-4px;overflow:visible;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35)) drop-shadow(0 1px 2px rgba(0,0,0,.3))">
      <g id="__shape">
        <rect x="16" y="2" width="14" height="50" rx="7"/>
        <rect x="9" y="38" width="46" height="42" rx="15"/>
        <rect x="29" y="30" width="12.5" height="28" rx="6.25"/>
        <rect x="40" y="34" width="12" height="26" rx="6"/>
        <rect x="50" y="40" width="11" height="24" rx="5.5"/>
        <rect x="0" y="44" width="12" height="28" rx="6" transform="rotate(-28 6 58)"/>
      </g>
      <use href="#__shape" fill="none" stroke="#1d2420" stroke-width="3.2"/>
      <use href="#__shape" fill="#fbfaf7"/>
      <path d="M29.5 44v10M41 46v10M51.5 50v8" stroke="#c9c4ba" stroke-width="1.6" stroke-linecap="round"/>
    </svg>\`;
  document.body.appendChild(box);
  window.__finger = (x, y, o) => {
    box.style.opacity = o.visible;
    box.style.transform = "translate(" + x + "px," + y + "px)";
    document.getElementById("__hand").style.transform = "scale(" + (o.pressed ? 0.92 : 1) + ")";
    document.getElementById("__hand").style.transformOrigin = "23px 4px";
    document.getElementById("__ring").style.opacity = o.pressed ? 1 : 0;
    const rp = document.getElementById("__ripple");
    if (o.ripple >= 0 && o.ripple <= 1) { rp.style.opacity = String(1 - o.ripple); rp.style.transform = "scale(" + (0.6 + o.ripple * 1.6) + ")"; } else rp.style.opacity = 0;
  };
})();`;

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export async function open({ out, width, height, dsf = 2, fps = 30, port = 9340, url = "http://127.0.0.1:5190/", record = true, every = 1 }) {
  fs.mkdirSync(out, { recursive: true });
  const proc = spawn(CH, ["--headless=new", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--hide-scrollbars", "--force-color-profile=srgb",
    `--remote-debugging-port=${port}`, `--user-data-dir=${out}/.chrome`, "about:blank"], { stdio: "ignore" });
  let targets;
  for (let i = 0; i < 80; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pending = new Map(); const logs = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("ERR " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(expr.slice(0, 80) + " -> " + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dsf, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: SHIM });
  await send("Page.navigate", { url });
  await sleep(9000);
  await run(FINGER);

  const dt = 1000 / fps;
  const f = { x: width * 0.7, y: height * 0.85, visible: 0, pressed: false, ripple: -1, button: false };
  let n = 0, rippleAt = -1;
  const api = {
    send, run, logs, fps, width, height, get count() { return n; },
    start: () => run("window.__vt.start()"),
    // One video frame: move the finger, advance the clock, capture.
    async frame() {
      const ripple = rippleAt >= 0 ? (n - rippleAt) / (0.45 * fps) : -1;
      if (ripple > 1) rippleAt = -1;
      await run(`window.__finger(${f.x.toFixed(2)}, ${f.y.toFixed(2)}, ${JSON.stringify({ visible: f.visible, pressed: f.pressed, ripple })})`);
      await run(`window.__vt.step(${dt})`);
      if (record && n % every === 0) {
        const { result } = await send("Page.captureScreenshot", { format: "jpeg", quality: 94 });
        fs.writeFileSync(`${out}/${String(n).padStart(5, "0")}.jpg`, Buffer.from(result.data, "base64"));
      }
      n++;
    },
    async wait(sec) { for (let i = 0, k = Math.round(sec * fps); i < k; i++) await api.frame(); },
    mouse: (type, extra = {}) => send("Input.dispatchMouseEvent", { type, x: f.x, y: f.y, button: f.button ? "left" : "none", buttons: f.button ? 1 : 0, clickCount: type === "mouseMoved" ? 0 : 1, ...extra }),
    async show(sec = 0.3) { for (let i = 0, k = Math.round(sec * fps); i < k; i++) { f.visible = Math.min(1, (i + 1) / k); await api.frame(); } f.visible = 1; },
    async hide(sec = 0.3) { for (let i = 0, k = Math.round(sec * fps); i < k; i++) { f.visible = 1 - (i + 1) / k; await api.frame(); } f.visible = 0; },
    place(x, y) { f.x = x; f.y = y; },
    // Glide the finger to (x, y); while pressed this is a drag.
    async move(x, y, sec, curve = ease) {
      const x0 = f.x, y0 = f.y, k = Math.max(1, Math.round(sec * fps));
      for (let i = 1; i <= k; i++) {
        const t = curve(i / k);
        f.x = x0 + (x - x0) * t; f.y = y0 + (y - y0) * t;
        await api.mouse("mouseMoved");
        await api.frame();
      }
    },
    async down() { f.pressed = true; f.button = true; await api.mouse("mousePressed"); },
    async up() { await api.mouse("mouseReleased"); f.pressed = false; f.button = false; },
    async tap(x, y, travel = 0.55, after = 0.35) {
      if (x !== undefined) await api.move(x, y, travel);
      await api.down(); rippleAt = n;
      await api.wait(0.12);
      await api.up();
      await api.wait(after);
    },
    async drag(points, sec, hold = 0.12) {
      await api.move(points[0][0], points[0][1], 0.45);
      await api.down(); await api.wait(hold);
      const per = sec / (points.length - 1);
      for (const p of points.slice(1)) await api.move(p[0], p[1], per, (t) => t);
      await api.wait(0.08); await api.up();
    },
    async press(x, y, sec) { await api.move(x, y, 0.45); await api.down(); rippleAt = n; await api.wait(sec); await api.up(); },
    async wheel(deltaY, steps, sec) { const k = Math.round(sec * fps); for (let i = 0; i < k; i++) { if (i < steps) await api.mouse("mouseWheel", { deltaX: 0, deltaY: deltaY / steps }); await api.frame(); } },
    // Centre of the first visible element whose text matches.
    async at(text, sel = "button,a,[role=switch]") {
      return run(`(() => { const re = new RegExp(${JSON.stringify(text)}); const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => re.test(e.textContent.trim()) || re.test(e.getAttribute("aria-label") ?? "")) ; if (!el) return null; const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
    },
    project: (x, y, z) => run(`window.__project(${x}, ${y}, ${z})`),
    close() { ws.close(); proc.kill(); },
  };
  return api;
}
