// Builds the 15-second cut from the long capture: picks the shots in cuts-15.json and links their frames into a new folder.
// Usage: node scripts/reel/cut.mjs reel/frames reel/frames-15
import fs from "node:fs";
import path from "node:path";
const [src, dst] = process.argv.slice(2).map((p) => path.resolve(p));
const { fps, marks } = JSON.parse(fs.readFileSync(`${src}/marks.json`, "utf8"));
const cuts = JSON.parse(fs.readFileSync(new URL("./cuts-15.json", import.meta.url), "utf8"));
fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(dst)) if (/^\d{5}\.jpg$/.test(f)) fs.unlinkSync(path.join(dst, f));
const out = [];
let n = 0;
for (const c of cuts) {
  const start = marks.find((m) => m.key === c.from).frame + Math.round(c.at * fps);
  out.push({ key: c.key, frame: n });
  for (let i = 0, k = Math.round(c.dur * fps); i < k; i++, n++) {
    fs.symlinkSync(path.join(src, `${String(start + i).padStart(5, "0")}.jpg`), path.join(dst, `${String(n).padStart(5, "0")}.jpg`));
  }
}
fs.writeFileSync(`${dst}/marks.json`, JSON.stringify({ fps, frames: n, marks: out }, null, 1));
console.log("cut", n, "frames", (n / fps).toFixed(2) + "s");
