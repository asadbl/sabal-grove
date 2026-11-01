// Puts the screen recording into the iPad, adds the captions, the end card and the soundtrack.
// Usage: node scripts/reel/compose.mjs reel/frames reel/sabal-grove-reel.mp4
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const [dir, out] = process.argv.slice(2);
const A = new URL("../../reel/assets/", import.meta.url).pathname;
const { fps, frames, marks } = JSON.parse(fs.readFileSync(`${dir}/marks.json`, "utf8"));
const caps = JSON.parse(fs.readFileSync(new URL("./captions.json", import.meta.url), "utf8"));
const screenDur = frames / fps;
const END = 3.4, XF = 0.6;
const total = screenDur + END - XF;
const at = (k) => marks.find((m) => m.key === k).frame / fps;

const inputs = ["-framerate", String(fps), "-i", `${dir}/%05d.jpg`, "-i", `${A}bg.png`, "-i", `${A}mask.png`, "-i", `${A}glass.png`];
let f = `[0:v]scale=900:1288:flags=lanczos,format=rgba[s];[2:v]format=gray,loop=-1:1,trim=duration=${screenDur}[m];[s][m]alphamerge[sm];`;
f += `[1:v]loop=-1:1,trim=duration=${screenDur},fps=${fps}[bg];[bg][sm]overlay=90:320[v0];[3:v]loop=-1:1,trim=duration=${screenDur}[gl];[v0][gl]overlay[v1];`;
let last = "v1";
caps.forEach((c, i) => {
  const st = Math.max(0, at(c.key) - (i ? 0.15 : 0));
  const next = caps[i + 1] ? at(caps[i + 1].key) - 0.15 : screenDur - 0.5;
  inputs.push("-i", `${A}cap${i}.png`);
  const k = 4 + i;
  f += `[${k}:v]format=rgba,loop=-1:1,trim=duration=${screenDur},fade=t=in:st=${st.toFixed(3)}:d=0.3:alpha=1,fade=t=out:st=${(next - 0.3).toFixed(3)}:d=0.3:alpha=1[c${i}];`;
  f += `[${last}][c${i}]overlay[v${i + 2}];`;
  last = `v${i + 2}`;
});
const endIdx = 4 + caps.length;
inputs.push("-loop", "1", "-t", String(END), "-framerate", String(fps), "-i", `${A}end.png`);
f += `[${endIdx}:v]format=rgba,fps=${fps},scale=1080:1920,setsar=1[end];[${last}]setsar=1,format=rgba[main];`;
f += `[main][end]xfade=transition=fade:duration=${XF}:offset=${(screenDur - XF).toFixed(3)},format=yuv420p[vout];`;
inputs.push("-i", new URL("../../reel/music.mp3", import.meta.url).pathname);
const musicIdx = endIdx + 1;
f += `[${musicIdx}:a]atrim=0:${total.toFixed(3)},afade=t=in:d=0.25,afade=t=out:st=${(total - 2.6).toFixed(3)}:d=2.6,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`;
const args = ["-y", "-loglevel", "error", "-stats", ...inputs, "-filter_complex", f, "-map", "[vout]", "-map", "[aout]",
  "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-r", String(fps),
  "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", total.toFixed(3), out];
console.log(`screen ${screenDur.toFixed(2)}s + end card -> ${total.toFixed(2)}s`);
execFileSync("ffmpeg", args, { stdio: "inherit" });
