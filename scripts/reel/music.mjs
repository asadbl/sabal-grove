// Generates the reel's soundtrack with Lyria 3 through OpenRouter. The key is read from the project's .env.local and never printed.
import fs from "node:fs";
const KEY = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").match(/^OPENROUTER_API_KEY=(.+)$/m)[1].trim();
// Usage: node scripts/reel/music.mjs [seconds] [file]; writes reel/<file>, music.mp3 by default.
const seconds = Number(process.argv[2] ?? 50), file = process.argv[3] ?? "music.mp3";
const model = "google/lyria-3-pro-preview";
const shape = seconds <= 20
  ? "starts straight on the beat with no intro, one punchy lift at second 7"
  : `a tight clean kick from second 3, light shaker, a subtle riser into a lift around second ${Math.round(seconds * 0.4)} and a second, fuller lift around second ${Math.round(seconds * 0.7)}`;
const prompt = `Instrumental only, no vocals. A ${seconds}-second modern luxury real-estate promo track for an Instagram reel: warm, confident, polished deep house with soft felt-piano chords, airy pads, ${shape}, 118 BPM, major key, cinematic and premium, sunset Florida mood. Ends on a clean, resolved final chord with a short tail.`;
const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model, stream: true, modalities: ["text", "audio"], audio: { format: "wav" }, messages: [{ role: "user", content: prompt }], usage: { include: true } }),
});
if (!r.ok) { console.log(r.status, await r.text()); process.exit(1); }
// Server-sent events: audio arrives as base64 chunks in choices[0].delta.audio.data.
const chunks = []; let text = ""; let usage = null; let format = null; let buf = ""; const keys = new Set();
const dec = new TextDecoder();
for await (const part of r.body) {
  buf += dec.decode(part, { stream: true });
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") continue;
    let j; try { j = JSON.parse(data); } catch { continue; }
    if (j.error) console.log("error", JSON.stringify(j.error).slice(0, 300));
    const d = j.choices?.[0]?.delta ?? {};
    Object.keys(d).forEach((k) => keys.add(k));
    if (d.audio?.data) chunks.push(d.audio.data);
    if (d.audio?.format) format = d.audio.format;
    if (d.content) text += d.content;
    if (j.usage) usage = j.usage;
  }
}
const bytes = Buffer.concat(chunks.map((c) => Buffer.from(c, "base64")));
fs.mkdirSync(new URL("../../reel/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`../../reel/${file}`, import.meta.url), bytes);
console.log("delta keys", [...keys].join(","), "audio bytes", bytes.length, "format", format, "cost", usage?.cost);
console.log(text.slice(0, 400));
