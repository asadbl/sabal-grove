// The reel's screen recording, scene by scene, against the dev server (npm run dev).
// Usage: node scripts/reel/story.mjs reel/frames [--preview]
import fs from "node:fs";
import { ease, open } from "./lib.mjs";

const out = process.argv[2];
const preview = process.argv.includes("--preview");
const W = 834, H = 1194;
const r = await open({ out, width: W, height: H, dsf: preview ? 1 : 2, every: preview ? 3 : 1, port: preview ? 9343 : 9344 });
const marks = [];
const mark = (key) => { marks.push({ key, frame: r.count }); console.log("mark", key, r.count, `${(r.count / r.fps).toFixed(2)}s`); };
const world = (vid, x, y, z) => r.run(`(() => { const l = window.__lots.find((l) => l.villa.id === ${JSON.stringify(vid)}); const [wx, wz] = window.__toWorld(l, ${x}, ${z}); return window.__project(wx, ${y}, wz); })()`);
const pose = () => r.run(`window.__store.getState().walkPose`);
const need = async (p, what) => { if (!p) throw new Error("not found: " + what); return p; };
const PAGE = ".scroll-soft.overflow-y-auto", PLACES = "nav[aria-label=Places]";
const place = (name) => r.at(name, `${PLACES} button`);

// A finger swipe on a scroller: the page follows the finger while it touches, then glides to rest.
async function swipe(sel, axis, to, sec, x, y) {
  const prop = axis === "y" ? "scrollTop" : "scrollLeft";
  const from = await r.run(`document.querySelector(${JSON.stringify(sel)}).${prop}`);
  const dist = to - from;
  const reach = Math.sign(dist) * Math.min(Math.abs(dist), axis === "y" ? 460 : 280);
  await r.move(x, y, 0.35);
  r.touch(true);
  const contact = 0.4;
  await r.each(sec, async (t) => {
    await r.run(`document.querySelector(${JSON.stringify(sel)}).${prop} = ${from + dist * ease(t)}`);
    if (t <= contact) {
      const k = ease(t / contact);
      r.place(axis === "y" ? x : x - reach * k, axis === "y" ? y - reach * k : y);
    } else r.touch(false);
  });
  r.touch(false);
}

await r.start();
r.place(W * 0.78, H * 0.92);

/* A. landing */
mark("landing");
await r.wait(0.4);
await r.show(0.3);
await r.move(W * 0.62, H * 0.8, 0.8);
await r.wait(1.2);

/* B. the homes, and their photos */
mark("homes");
await swipe(PAGE, "y", 1930, 1.7, W * 0.62, H * 0.86);
await r.wait(1.0);
mark("photos");
const photos = await need(await r.at("7 photos"), "photos");
await r.tap(photos[0], photos[1], 0.7, 1.1);
const next = await need(await r.at("Next photo"), "next");
await r.tap(next[0], next[1], 0.7, 1.7);
await r.tap(next[0], next[1], 0.3, 1.2);
const closePh = await need(await r.at("Close photos"), "close photos");
await r.tap(closePh[0], closePh[1], 0.6, 0.4);

/* C. the rest of the page, then into 3D */
mark("scroll");
await swipe(PAGE, "y", 8380, 2.4, W * 0.55, H * 0.85);
await r.wait(0.7);
await swipe(PAGE, "y", 10450, 1.4, W * 0.55, H * 0.85);
await r.wait(0.6);
const enter3d = await need(await r.at("3D", "header button"), "enter 3d");
await r.tap(enter3d[0], enter3d[1], 0.8, 0.2);

/* D. the neighbourhood */
mark("neighbourhood");
await r.move(W * 0.4, H * 0.6, 1.2);
await r.wait(0.6);
await r.drag([[W * 0.36, H * 0.6], [W * 0.5, H * 0.59], [W * 0.6, H * 0.6]], 1.7);
await r.wait(0.4);

/* E. a tour: the gate, the park, the lake */
mark("gate");
const gate = await need(await place("^Entrance"), "entrance");
await r.tap(gate[0], gate[1], 0.8, 2.3);
mark("park");
const park = await need(await place("^Park"), "park");
await r.tap(park[0], park[1], 0.8, 2.1);
mark("lake");
await swipe(PLACES, "x", 400, 1.0, W * 0.7, H * 0.96);
const lake = await need(await place("^Heron Lake"), "lake");
await r.tap(lake[0], lake[1], 0.5, 1.9);

/* F. Casa Palma and its pool */
mark("pool");
await swipe(PLACES, "x", 0, 1.0, W * 0.3, H * 0.96);
const palma = await need(await place("^Casa Palma"), "casa palma");
await r.tap(palma[0], palma[1], 0.5, 1.6);
await r.drag([[W * 0.82, H * 0.2], [W * 0.55, H * 0.21], [W * 0.3, H * 0.2]], 2.0);
await r.wait(1.0);

/* G. into the home */
mark("enter");
const inside = await need(await r.at("Go inside"), "go inside");
await r.tap(inside[0], inside[1], 0.8, 0.2);
await r.move(W * 0.82, H * 0.3, 1.4);

/* H. lights */
mark("lights");
const night = await need(await r.at("^Night$"), "night");
await r.tap(night[0], night[1], 0.5, 0.6);
for (const [x, z] of [[9.5, 10.5], [9.5, 5.5], [16.5, 8]]) {
  const p = await world("casa-palma", x, 0.2, z);
  await r.tap(p[0], p[1], 0.55, 0.45);
}
await r.wait(0.4);
const dusk = await need(await r.at("^Dusk$"), "dusk");
await r.tap(dusk[0], dusk[1], 0.6, 0.5);

/* I. rotate */
mark("rotate");
const hide = await need(await r.at("Hide panel"), "hide panel");
await r.tap(hide[0], hide[1], 0.6, 0.5);
await r.drag([[W * 0.3, H * 0.55], [W * 0.5, H * 0.53], [W * 0.72, H * 0.55]], 1.8);
await r.wait(0.4);

/* J. plan and sizes */
mark("plan");
const plan = await need(await r.at("Plan & sizes"), "plan");
await r.tap(plan[0], plan[1], 0.6, 1.4);
const sofa = await world("casa-palma", 10.4, 0.5, 12.1);
await r.tap(sofa[0], sofa[1], 0.8, 1.4);

/* K. walk */
mark("walk");
const walk = await need(await r.at("Walk through"), "walk");
await r.tap(walk[0], walk[1], 0.6, 0.8);
const fwd = await need(await r.at("Walk forward"), "forward");
await r.move(fwd[0], fwd[1], 0.5);
await r.down();
for (let i = 0; i < 6 * r.fps; i++) { await r.frame(); const p = await pose(); if (p && p.z > 3.75) break; }
await r.up();
await r.wait(0.4);

/* L. a real photo; behind it, step over to the garden doors */
mark("photo");
const photo = await need(await r.at("^Photo$"), "photo button");
await r.tap(photo[0], photo[1], 0.6, 0.2);
await r.run(`window.__walkSet(11.2, 13.0, 0, -0.1, 0)`);
await r.move(W * 0.55, H * 0.75, 0.8);
await r.wait(1.0);
const close = await need(await r.at("Close photos"), "close");
await r.tap(close[0], close[1], 0.6, 0.5);

/* M. slide the door open and walk out to the pool */
mark("door");
const door = await need(await r.at("Open door"), "open door");
await r.tap(door[0], door[1], 0.6, 0.9);
await r.move(fwd[0], fwd[1], 0.5);
await r.down();
for (let i = 0; i < 5 * r.fps; i++) { await r.frame(); const p = await pose(); if (p.z > 17.3) break; }
await r.up();
await r.wait(0.3);
await r.drag([[W * 0.62, H * 0.45], [W * 0.5, H * 0.46], [W * 0.38, H * 0.45]], 1.6);
await r.hide(0.4);
await r.wait(0.8);
mark("end");

fs.writeFileSync(`${out}/marks.json`, JSON.stringify({ fps: r.fps, frames: r.count, marks }, null, 1));
console.log("frames", r.count, (r.count / r.fps).toFixed(2) + "s");
console.log(r.logs.filter((l) => !/Clock|PCFSoft/.test(l)).slice(0, 10).join("\n"));
r.close(); process.exit(0);
