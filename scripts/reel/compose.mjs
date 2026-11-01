// Puts the screen recording into the iPad, adds the captions, the end card and the soundtrack.
// Usage: node scripts/reel/compose.mjs <frames> <out.mp4> [--caps captions.json] [--music music-long.mp3] [--music-start 0] [--end 3.4] [--lead 0.15]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const [dir, out, ...rest] = process.argv.slice(2);
const opt = (name, def) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : def; };
const REEL = new URL("../../reel/", import.meta.url).pathname;
const A = `${REEL}assets/`;
const { fps, frames, marks } = JSON.parse(fs.readFileSync(`${dir}/marks.json`, "utf8"));
const caps = JSON.parse(fs.readFileSync(new URL(`./${opt("caps", "captions.json")}`, import.meta.url), "utf8"));
const music = `${REEL}${opt("music", "music-long.mp3")}`, musicStart = Number(opt("music-start", 0));
// Captions come in a little before their scene; hard cuts want them exactly on the cut.
const lead = Number(opt("lead", 0.15)), fadeD = lead > 0 ? 0.3 : 0.18;
const screenDur = frames / fps;
const END = Number(opt("end", 3.4)), XF = Math.min(0.6, END / 4);
const total = screenDur + END - XF;
const at = (k) => marks.find((m) => m.key === k).frame / fps;

const inputs = ["-framerate", String(fps), "-i", `${dir}/%05d.jpg`, "-i", `${A}bg.png`, "-i", `${A}mask.png`, "-i", `${A}glass.png`];
let f = `[0:v]scale=900:1288:flags=lanczos,format=rgba[s];[2:v]format=gray,loop=-1:1,trim=duration=${screenDur}[m];[s][m]alphamerge[sm];`;
f += `[1:v]loop=-1:1,trim=duration=${screenDur},fps=${fps}[bg];[bg][sm]overlay=90:320[v0];[3:v]loop=-1:1,trim=duration=${screenDur}[gl];[v0][gl]overlay[v1];`;
let last = "v1";
caps.forEach((c, i) => {
  const st = Math.max(0, at(c.key) - (i ? lead : 0));
  const next = caps[i + 1] ? at(caps[i + 1].key) - lead : screenDur - 0.5;
  inputs.push("-i", `${A}cap-${c.key}.png`);
  const k = 4 + i;
  const fin = i ? `fade=t=in:st=${st.toFixed(3)}:d=${fadeD}:alpha=1,` : "";
  f += `[${k}:v]format=rgba,loop=-1:1,trim=duration=${screenDur},${fin}fade=t=out:st=${(next - fadeD).toFixed(3)}:d=${fadeD}:alpha=1[c${i}];`;
  f += `[${last}][c${i}]overlay[v${i + 2}];`;
  last = `v${i + 2}`;
});
const endIdx = 4 + caps.length;
inputs.push("-loop", "1", "-t", String(END), "-framerate", String(fps), "-i", `${A}end.png`);
f += `[${endIdx}:v]format=rgba,fps=${fps},scale=1080:1920,setsar=1[end];[${last}]setsar=1,format=rgba[main];`;
f += `[main][end]xfade=transition=fade:duration=${XF}:offset=${(screenDur - XF).toFixed(3)},format=yuv420p[vout];`;
inputs.push("-ss", String(musicStart), "-i", music);
const musicIdx = endIdx + 1;
const fadeOut = Math.min(2.6, END * 0.8);
f += `[${musicIdx}:a]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=${musicStart > 0 ? 0.05 : 0.25},afade=t=out:st=${(total - fadeOut).toFixed(3)}:d=${fadeOut},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`;
const args = ["-y", "-loglevel", "error", "-stats", ...inputs, "-filter_complex", f, "-map", "[vout]", "-map", "[aout]",
  "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-r", String(fps),
  "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", total.toFixed(3), out];
console.log(`screen ${screenDur.toFixed(2)}s + end card -> ${total.toFixed(2)}s`);
execFileSync("ffmpeg", args, { stdio: "inherit" });
