// Turns the 3D source renders in .photo-src/ (from scripts/renders.mjs) into photographs with an
// OpenRouter image model, keeping each house's geometry, then writes them to public/photos/.
//
//   node scripts/photos.mjs --dry            count the jobs and estimate the cost, no requests
//   node scripts/photos.mjs --only casa      only sources whose name contains "casa"
//   node scripts/photos.mjs --force          redo photos that already exist
//   node scripts/photos.mjs --index          only rebuild index.json and rooms.json from public/photos
//
// The key is read from .env.local (OPENROUTER_API_KEY) and never printed.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, ".photo-src");
const OUT = path.join(ROOT, "public", "photos");
const RAW = path.join(SRC, "raw");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(RAW, { recursive: true });

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const MODEL = opt("--model", "google/gemini-nano-banana-2.1");
const ONLY = opt("--only", "");
const CONCURRENCY = Number(opt("--jobs", "3"));
const EST_PER_IMAGE = Number(opt("--est", "0.06"));

function key() {
  const f = path.join(ROOT, ".env.local");
  const line = fs.existsSync(f) ? fs.readFileSync(f, "utf8").split(/\r?\n/).find((l) => l.startsWith("OPENROUTER_API_KEY=")) : null;
  const k = line?.slice("OPENROUTER_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!k) { console.error("No OPENROUTER_API_KEY in .env.local"); process.exit(1); }
  return k;
}

const villas = JSON.parse(fs.readFileSync(path.join(SRC, "villas.json"), "utf8"));
const byId = Object.fromEntries(villas.map((v) => [v.id, v]));

/* ---------- describing a villa in words ---------- */

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : mx === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function colourName(hex) {
  const [h, s, l] = hexToHsl(hex);
  if (l > 0.93) return "bright white";
  if (s < 0.12) return l > 0.8 ? "warm white" : l > 0.55 ? "pale grey" : l > 0.3 ? "slate grey" : "charcoal";
  if (h < 20 || h > 340) return l > 0.75 ? "pale coral" : "terracotta";
  if (h < 45) return l > 0.8 ? "warm sand" : l > 0.6 ? "light tan" : "clay";
  if (h < 70) return l > 0.8 ? "cream" : "ochre";
  if (h < 170) return l > 0.8 ? "pale sage" : "sage green";
  if (h < 260) return l > 0.8 ? "pale blue-grey" : "blue-grey";
  return "mauve";
}

function roofPhrase(v) {
  const kinds = v.roofs.filter((r) => r !== "roofdeck");
  const c = colourName(v.style.roof);
  const tile = /terracotta|clay/.test(c) ? "terracotta clay barrel-tile" : /slate|charcoal|blue-grey/.test(c) ? "dark grey architectural shingle" : "light grey";
  if (kinds.every((k) => k === "flat")) return "flat roofs with crisp parapets (no pitched roof)";
  const k = kinds.includes("hip") ? "hip" : kinds.includes("gable") ? "gable" : "pitched";
  return `a ${tile} ${k} roof`;
}

const FLOORS = { oak: "wide-plank natural white-oak", walnut: "dark walnut", travertine: "honed ivory travertine", concrete: "polished concrete" };

function houseFacts(v) {
  return `${v.name}, ${v.tagline.toLowerCase()} in Sabal Grove, a small gated luxury enclave in Lake Harbor, Florida. ` +
    `${v.levels > 1 ? "Two storeys" : "Single storey"}, ${roofPhrase(v)}, smooth ${colourName(v.style.stucco)} stucco walls, ` +
    `${colourName(v.style.trim)} window frames${v.pool ? ", a private pool" : ""}.`;
}

const KEEP_EXT = "Keep the exact building from the render: the same massing and number of storeys, the same roof form, the same window, door and garage positions and proportions, the same driveway, pool, terraces, lawn, hedges and palm positions, and the same camera position, height, lens and framing. Do not add storeys, wings, towers or extra buildings.";
const KEEP_INT = "Keep the exact room from the render: the same walls, openings, window and door positions, ceiling height, camera position and lens, and the same furniture pieces in the same places and at the same sizes. Do not add or remove walls or windows.";
const FINISH = "Professional real-estate photography, full-frame camera, vertical lines kept straight, natural colour, crisp believable detail with real-world imperfections. No people, no text overlays, no watermark, no borders.";

function prompt(name) {
  const kind = name.replace(/\.jpg$/, "").split("-").at(-1);
  const v = byId[name.replace(/-(front|rear|aerial|living|kitchen|primary|bath)\.jpg$/, "")];
  if (v) {
    const facts = houseFacts(v);
    if (kind === "front") return `Turn this 3D render into a real photograph of the street side of ${facts} ${KEEP_EXT} Make every material real: hand-troweled stucco, real glass with reflections, a pavered driveway, a manicured St. Augustine lawn, mature palms and clipped hedges, a clean asphalt street with a concrete kerb. Light: blue hour just after sunset, a soft gradient sky, warm 2700 K light glowing from the windows, landscape uplights on the palms. ${FINISH} 24 mm tilt-shift lens.`;
    if (kind === "rear") return `Turn this 3D render into a real photograph of the garden and pool side of ${facts} ${KEEP_EXT} Keep the pool's exact shape and position. Make it real: turquoise pool water with gentle ripples and underwater lights, travertine pool deck, outdoor furniture with real fabric, real glass sliders showing the lit interior, mature palms. Light: twilight, warm interior glow, soft sky. ${FINISH} 24 mm lens.`;
    if (kind === "aerial") return `Turn this 3D render into a real drone photograph of ${facts} ${KEEP_EXT} Keep the whole site layout exactly: the house footprint and roof, the pool, the driveway, lawns, trees, the neighbouring houses and the street where they are. Real materials, real grass texture and tree canopies with natural variation, soft late-morning sun. ${FINISH}`;
    const room = { living: "great room / living room", kitchen: "kitchen", primary: "primary bedroom", bath: "primary bathroom" }[kind];
    const dress = {
      living: "a deep sofa and armchairs in real linen, a wool rug, a coffee table with a few art books and a vase of branches",
      kitchen: "flat-panel cabinetry, a marble island and backsplash, integrated appliances, pendant lights, bar stools",
      primary: "a tailored upholstered bed with crisp white linen and a throw, bedside lamps, a soft rug",
      bath: "a freestanding stone bath, a frameless glass shower, large-format stone tiles, a floating vanity with brushed brass fittings",
    }[kind];
    return `Turn this 3D render into a real interior photograph of the ${room} in ${facts} ${KEEP_INT} Finish it to a high standard: ${FLOORS[v.style.floor]} floors, smooth painted plaster walls, recessed downlights, ${dress}. Styled but uncluttered. Daylight through the windows, with the garden, palms and pool visible outside; warm lamps on. Architectural Digest interior photography, 18 mm lens, ${FINISH}`;
  }
  const estate = {
    gate: "the gated entrance to Sabal Grove, a small luxury enclave, seen from Harbor Boulevard, a six-lane palm-lined boulevard in Lake Harbor, Florida. Keep the white perimeter wall with stone piers, the two stone monument walls reading SABAL GROVE, the gatehouse under its flat canopy, the pavered entry court, the palms, the cars and the road markings exactly where they are.",
    street: "the private palm-lined lane inside Sabal Grove, a small gated enclave of modern villas in Lake Harbor, Florida. Keep the lane, sidewalks, royal palms, street lamps, houses and the turning circle exactly where they are.",
    skyline: "the downtown Lake Harbor skyline across a calm lake, seen from the lakeside lawn of Sabal Grove. Keep the towers' positions, heights and silhouettes, the palms and the dock in the foreground.",
    aerial: "Sabal Grove, a gated enclave of six villas between a golf course and a lake, with a city around it. Keep the whole layout: the lane, the six houses and pools, the golf fairway, the lake, the boulevard and the city blocks exactly where they are.",
  }[kind];
  const light = kind === "aerial" ? "soft late-morning sun, a drone photograph" : "blue hour just after sunset, warm street and window lights, a soft gradient sky";
  return `Turn this 3D render into a real photograph of ${estate} Make every material real: real asphalt, concrete, stone, glass and foliage with natural variation. Light: ${light}. ${FINISH}`;
}

/* ---------- the requests ---------- */

const sources = fs.readdirSync(SRC).filter((f) => f.endsWith(".jpg") && (!ONLY || f.includes(ONLY))).sort();
const todo = flag("--index") ? [] : sources.filter((f) => flag("--force") || !fs.existsSync(path.join(OUT, f)));
console.log(`${todo.length} of ${sources.length} renders to photograph with ${MODEL}; estimate about $${(todo.length * EST_PER_IMAGE).toFixed(2)} at $${EST_PER_IMAGE}/image`);
if (flag("--dry")) { for (const f of todo) console.log(" ", f); process.exit(0); }

const KEY = todo.length ? key() : null;
const costs = fs.existsSync(path.join(SRC, "costs.json")) ? JSON.parse(fs.readFileSync(path.join(SRC, "costs.json"), "utf8")) : {};

async function generate(file) {
  const src = fs.readFileSync(path.join(SRC, file)).toString("base64");
  const body = {
    model: MODEL,
    modalities: ["image", "text"],
    image_config: { aspect_ratio: "3:2" },
    usage: { include: true },
    messages: [{ role: "user", content: [{ type: "text", text: prompt(file) }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${src}` } }] }],
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "HTTP-Referer": "http://localhost:5190", "X-Title": "Sabal Grove" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`${r.status} ${j.error?.message ?? JSON.stringify(j).slice(0, 300)}`);
      const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!url) throw new Error(`no image in reply: ${JSON.stringify(j.choices?.[0]?.message ?? j).slice(0, 300)}`);
      const [, b64] = url.split(",");
      const raw = path.join(RAW, file.replace(/\.jpg$/, ".png"));
      fs.writeFileSync(raw, Buffer.from(b64, "base64"));
      execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "84", "-Z", "1800", raw, "--out", path.join(OUT, file)], { stdio: "ignore" });
      costs[file] = j.usage?.cost ?? null;
      console.log(`photo ${file}${j.usage?.cost != null ? `  $${j.usage.cost.toFixed(4)}` : ""}`);
      return;
    } catch (e) {
      console.log(`retry ${file} (${attempt}/3): ${String(e.message).slice(0, 240)}`);
      await new Promise((res) => setTimeout(res, 2500 * attempt));
    }
  }
  console.log(`FAILED ${file}`);
}

const queue = [...todo];
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
  while (queue.length) await generate(queue.shift());
}));
fs.writeFileSync(path.join(SRC, "costs.json"), JSON.stringify(costs, null, 1));
const spent = Object.values(costs).reduce((a, c) => a + (c ?? 0), 0);
console.log(`spent so far on photos: $${spent.toFixed(2)}`);

/* ---------- index for the app ---------- */

const ORDER = ["front", "rear", "aerial", "living", "kitchen", "primary", "bath"];
const have = new Set(fs.readdirSync(OUT).filter((f) => f.endsWith(".jpg")));
const index = {};
const rooms = {};
for (const v of villas) {
  index[v.id] = ORDER.map((k) => `${v.id}-${k}.jpg`).filter((f) => have.has(f));
  // the room each interior photo shows, matching scripts/renders.mjs
  const find = {
    living: v.rooms.find((r) => r.type === "living"),
    kitchen: v.rooms.find((r) => r.type === "kitchen"),
    primary: v.rooms.find((r) => r.type === "primary"),
    bath: v.rooms.find((r) => r.type === "bath" && /primary/i.test(r.name)) ?? v.rooms.find((r) => r.type === "bath"),
  };
  rooms[v.id] = Object.fromEntries(Object.entries(find).filter(([k, r]) => r && have.has(`${v.id}-${k}.jpg`)).map(([k, r]) => [r.id, `${v.id}-${k}.jpg`]));
}
index.estate = ["gate", "street", "skyline", "aerial"].map((k) => `estate-${k}.jpg`).filter((f) => have.has(f));
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1));
fs.writeFileSync(path.join(OUT, "rooms.json"), JSON.stringify(rooms, null, 1));
console.log("wrote public/photos/index.json and rooms.json");
