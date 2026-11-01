// The reel's screen recording, scene by scene, against the dev server (npm run dev).
// Usage: node scripts/reel/story.mjs reel/frames [--preview]
import fs from "node:fs";
import { open } from "./lib.mjs";

const out = process.argv[2];
const preview = process.argv.includes("--preview");
const W = 834, H = 1194;
const r = await open({ out, width: W, height: H, dsf: preview ? 1 : 2, every: preview ? 3 : 1, port: preview ? 9343 : 9344 });
const marks = [];
const mark = (key) => { marks.push({ key, frame: r.count }); console.log("mark", key, r.count, `${(r.count / r.fps).toFixed(2)}s`); };
const S = (o) => r.run(`window.__store.getState().set(${JSON.stringify(o)})`);
const world = (vid, x, y, z) => r.run(`(() => { const l = window.__lots.find((l) => l.villa.id === ${JSON.stringify(vid)}); const [wx, wz] = window.__toWorld(l, ${x}, ${z}); return window.__project(wx, ${y}, wz); })()`);
const pose = () => r.run(`window.__store.getState().walkPose`);
const need = async (p, what) => { if (!p) throw new Error("not found: " + what); return p; };

await r.start();
r.place(W * 0.78, H * 0.92);

/* A. landing */
mark("landing");
await r.wait(0.3);
await r.show(0.3);
await r.move(W * 0.5, H * 0.8, 0.7);
await r.wait(0.3);
const enter = await need(await r.at("Enter the 3D experience"), "enter");
await r.tap(enter[0], enter[1], 0.6, 0.1);

/* B. neighbourhood */
mark("neighbourhood");
await r.move(W * 0.4, H * 0.66, 1.3);
await r.wait(0.7);
await r.drag([[W * 0.36, H * 0.66], [W * 0.5, H * 0.65], [W * 0.6, H * 0.66]], 1.7);
await r.wait(0.5);

/* C. into a home */
mark("enter");
const house = await world("casa-palma", 10, 2.6, 7);
await r.tap(house[0], house[1], 0.7, 0.2);
await r.move(W * 0.82, H * 0.3, 1.4);

/* D. lights */
mark("lights");
const night = await need(await r.at("^Night$"), "night");
await r.tap(night[0], night[1], 0.5, 0.6);
for (const [x, z] of [[9.5, 10.5], [9.5, 5.5], [16.5, 8]]) {
  const p = await world("casa-palma", x, 0.2, z);
  await r.tap(p[0], p[1], 0.55, 0.45);
}
await r.wait(0.3);
const dusk = await need(await r.at("^Dusk$"), "dusk");
await r.tap(dusk[0], dusk[1], 0.6, 0.5);

/* E. rotate */
mark("rotate");
const hide = await need(await r.at("Hide panel"), "hide panel");
await r.tap(hide[0], hide[1], 0.6, 0.5);
await r.drag([[W * 0.3, H * 0.55], [W * 0.5, H * 0.53], [W * 0.72, H * 0.55]], 1.8);
await r.wait(0.4);

/* F. plan and sizes */
mark("plan");
const plan = await need(await r.at("Plan & sizes"), "plan");
await r.tap(plan[0], plan[1], 0.6, 1.4);
const sofa = await world("casa-palma", 10.4, 0.5, 12.1);
await r.tap(sofa[0], sofa[1], 0.8, 1.4);

/* G. walk */
mark("walk");
const walk = await need(await r.at("Walk through"), "walk");
await r.tap(walk[0], walk[1], 0.6, 0.8);
const fwd = await need(await r.at("Walk forward"), "forward");
await r.move(fwd[0], fwd[1], 0.5);
await r.down();
for (let i = 0; i < 6 * r.fps; i++) { await r.frame(); const p = await pose(); if (p && p.z > 3.75) break; }
await r.up();
await r.wait(0.4);

/* H. real photo, and a door */
mark("photo");
const photo = await need(await r.at("^Photo$"), "photo button");
await r.tap(photo[0], photo[1], 0.6, 0.2);
await r.run(`window.__walkSet(8.25, 9.4, -Math.PI / 2, -0.03, 0)`);
await r.move(W * 0.55, H * 0.75, 0.8);
await r.wait(1.0);
const close = await need(await r.at("Close photos"), "close");
await r.tap(close[0], close[1], 0.6, 0.5);

mark("door");
await r.move(fwd[0], fwd[1], 0.5);
await r.down();
for (let i = 0; i < 4 * r.fps; i++) { await r.frame(); if (await r.run(`!!window.__store.getState().nearDoor`)) { const p = await pose(); if (p.x < 7.4) break; } }
await r.up();
await r.wait(0.3);
const door = await need(await r.at("Open door"), "open door");
await r.tap(door[0], door[1], 0.6, 0.8);
await r.move(fwd[0], fwd[1], 0.5);
await r.down();
for (let i = 0; i < 3.5 * r.fps; i++) { await r.frame(); const p = await pose(); if (p.x < 3.6) break; }
await r.up();
await r.hide(0.4);
await r.wait(0.4);
mark("end");

fs.writeFileSync(`${out}/marks.json`, JSON.stringify({ fps: r.fps, frames: r.count, marks }, null, 1));
console.log("frames", r.count, (r.count / r.fps).toFixed(2) + "s");
console.log(r.logs.filter((l) => !/Clock|PCFSoft/.test(l)).slice(0, 10).join("\n"));
r.close(); process.exit(0);
