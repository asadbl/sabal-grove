import { ArrowRight, ArrowUpRight, Box, Images, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CITY } from "../data/city";
import { AMENITIES, COMMUNITY, LOTS } from "../data/community";
import type { BuiltVilla } from "../data/dsl";
import { focusOf } from "../lib/focus";
import { interiorArea } from "../lib/plan";
import { area, len, price } from "../lib/units";
import { useStore, type TimeOfDay } from "../store";
import { Mark, SALES_EMAIL, Status } from "./brand";
import { captionPhotos, stillUrl, useEstatePhotos, usePhoto, usePhotos, useRoomPhotos } from "./photos";
import { PlanThumb } from "./PlanThumb";

/** The photo of a shot when scripts/photos.mjs has made one, else the still rendered from our own 3D model;
 *  the floor plan stands in until either exists. */
const PHOTO_OF: Record<string, string> = { aerial: "estate-aerial", gate: "estate-gate" };
function Still({ name, alt, villa, className = "" }: { name: string; alt: string; villa?: BuiltVilla; className?: string }) {
  const photo = usePhoto(PHOTO_OF[name] ?? (villa ? `${name}-front` : name));
  const [failed, setFailed] = useState(false);
  if (photo === undefined) return <div className={`bg-paper-2 ${className}`} role="img" aria-label={alt} />;
  if (failed) {
    return (
      <div className={`grid place-items-center bg-paper-2 ${className}`} role="img" aria-label={alt}>
        {villa ? <PlanThumb villa={villa} className="h-[70%] w-[70%]" /> : <Mark className="size-12 opacity-60" />}
      </div>
    );
  }
  return <img src={photo ?? stillUrl(name)} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}

function enterExplore(extra: Record<string, unknown> = {}) {
  useStore.getState().set({ layout: "explore", villaId: null, picked: null, place: null, selection: null, mode: "lights", ...extra });
}

function EnterButton({ className = "", children = "Enter the 3D experience" }: { className?: string; children?: ReactNode }) {
  return (
    <button type="button" className={`btn btn-lamp group ${className}`} onClick={() => enterExplore()}>
      <Box className="size-[18px]" strokeWidth={1.75} />
      {children}
      <ArrowRight className="size-[18px] transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5" strokeWidth={2} />
    </button>
  );
}

const HOURS: [TimeOfDay, string][] = [["day", "Day"], ["dusk", "Dusk"], ["night", "Night"]];

const ESTATE_CAPTION: Record<string, string> = {
  gate: "The gatehouse off Harbor Boulevard",
  street: "Sabal Grove Lane, from the gate",
  skyline: "The Harbor skyline across Heron Lake",
  aerial: "Sabal Grove from above",
};
function caption(url: string) {
  const f = url.split("/").pop()!.replace(/\.jpg$/, "");
  if (f.startsWith("estate-")) return ESTATE_CAPTION[f.slice(7)] ?? "Sabal Grove";
  const v = LOTS.find((l) => f.startsWith(l.villa.id))?.villa;
  return v ? `${v.name}, ${v.address}` : "Sabal Grove";
}

/** Crossfading photographs with a slow push-in. The next frame is decoded before it fades up. */
function HeroSlides({ photos, onIndex }: { photos: string[]; onIndex: (i: number) => void }) {
  const [shots, setShots] = useState([{ i: 0, n: 0 }]);
  useEffect(() => {
    let n = 0, cur = 0, live = true;
    const t = setInterval(() => {
      const next = (cur + 1) % photos.length;
      const img = new Image();
      img.src = photos[next];
      img.decode().catch(() => {}).then(() => {
        if (!live) return;
        cur = next; n += 1;
        setShots((s) => [...s.slice(-1), { i: next, n }]);
        onIndex(next);
      });
    }, 6500);
    return () => { live = false; clearInterval(t); };
  }, [photos, onIndex]);
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-ink">
      {shots.map(({ i, n }) => (
        <img key={n} src={photos[i]} alt="" decoding="async" fetchPriority={n === 0 ? "high" : "auto"} className={`kb absolute inset-0 size-full object-cover ${n % 2 ? "kb-alt" : ""}`} />
      ))}
    </div>
  );
}

function Hero({ photos }: { photos: string[] }) {
  const time = useStore((s) => s.time);
  const set = useStore((s) => s.set);
  const [shown, setShown] = useState(0);
  const avail = LOTS.filter((l) => l.villa.status === "Available").length;
  const from = Math.min(...LOTS.map((l) => l.villa.price));
  return (
    <section id="top" className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden text-paper">
      {photos.length > 0 && <HeroSlides photos={photos} onIndex={setShown} />}
      {/* Scrims keep the type legible over whatever the flyover is passing. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(14,20,16,.55)_0%,rgba(14,20,16,0)_22%,rgba(14,20,16,.08)_38%,rgba(14,20,16,.86)_100%)] lg:bg-[linear-gradient(180deg,rgba(14,20,16,.55)_0%,rgba(14,20,16,0)_22%,rgba(14,20,16,0)_42%,rgba(14,20,16,.78)_100%)]" />
      <div className="relative mx-auto w-full max-w-[1320px] px-5 pb-10 sm:px-8 sm:pb-14 lg:px-12">
        <h1 className="hero-in max-w-[13ch] text-balance font-display text-[clamp(46px,8.4vw,104px)] leading-[0.98] tracking-[-0.025em]">
          Six villas. One gated lane.
        </h1>
        <div className="hero-in hero-in-2 mt-6 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="max-w-[44ch] text-[17px] leading-relaxed text-paper/85 sm:text-[19px]">
              Between the 7th fairway and Heron Lake, with the Harbor skyline across the water. Walk through every room in 3D before you visit.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <EnterButton className="!min-h-[52px] !px-6 text-[16px]" />
              <a href="#residences" className="btn btn-on-dark !min-h-[52px] !px-6 text-[16px]">View the residences</a>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <p className="text-[14px] text-paper/80 tnum">
              <MapPin className="mr-1 inline size-4 align-[-3px]" strokeWidth={1.75} />
              {COMMUNITY.place} · {avail} of {LOTS.length} available · from {price(from)}
            </p>
            {photos.length > 0 ? (
              <p className="flex items-center gap-3 text-[13px] text-paper/75" aria-live="polite">
                <span key={shown} className="rise">{caption(photos[shown])}</span>
                <span className="flex gap-1.5" aria-hidden>
                  {photos.map((p, i) => <span key={p} className={`h-1 rounded-full transition-[width,background-color] duration-500 ${i === shown ? "w-5 bg-paper" : "w-1.5 bg-paper/40"}`} />)}
                </span>
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-paper/75">Live model, change the hour</span>
                <div className="seg seg-dark" role="group" aria-label="Time of day">
                  {HOURS.map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={time === id} onClick={() => set({ time: id })}>{label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Header({ solid }: { solid: boolean }) {
  return (
    <header className={`fixed inset-x-0 top-0 z-20 transition-[background-color,box-shadow,color] duration-300 ease-[var(--ease-out-quart)] ${solid ? "bg-paper text-ink shadow-[0_1px_0_var(--color-line)]" : "text-paper"}`}>
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8 lg:px-12">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Sabal Grove, back to top">
          <Mark className="size-9" />
          <span className="font-display text-[21px] leading-none">Sabal Grove</span>
        </a>
        <nav className={`hidden items-center gap-7 text-[15px] font-medium md:flex ${solid ? "text-ink-2" : "text-paper/85"}`}>
          <a href="#residences" className="nav-link">Residences</a>
          <a href="#arrival" className="nav-link">Arrival</a>
          <a href="#inside" className="nav-link">In 3D</a>
          <a href="#visit" className="nav-link">Visit</a>
        </nav>
        <button type="button" className={`btn !min-h-10 !px-4 text-[14px] ${solid ? "btn-primary" : "btn-on-dark"}`} onClick={() => enterExplore()}>
          <Box className="size-4" strokeWidth={1.75} /> <span className="hidden sm:inline">Enter 3D</span><span className="sm:hidden">3D</span>
        </button>
      </div>
    </header>
  );
}

function Intro() {
  const villas = LOTS.map((l) => l.villa);
  const prices = villas.map((v) => v.price);
  const units = useStore((s) => s.units);
  const facts: [string, string][] = [
    ["Homes", `${villas.length}, each one different`],
    ["Lots", `${len(COMMUNITY.lotWidth, units)} × ${len(COMMUNITY.lotDepth, units)}`],
    ["Prices", `${price(Math.min(...prices))} to ${price(Math.max(...prices))}`],
    ["Bedrooms", `${Math.min(...villas.map((v) => v.beds))} to ${Math.max(...villas.map((v) => v.beds))}`],
    ["Pools", `${villas.filter((v) => v.pool).length} of ${villas.length} homes`],
    ["Entry", "Gatehouse and keypad"],
  ];
  return (
    <section className="mx-auto grid max-w-[1320px] gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12 lg:gap-12 lg:px-12">
      <p className="text-pretty font-display text-[clamp(26px,3.3vw,40px)] leading-[1.22] tracking-[-0.012em] lg:col-span-7">
        Sabal Grove is a single private street of six homes. The north side backs onto the 7th fairway, the south side looks across Heron Lake, and royal palms line both sidewalks from the gate to the turning circle.
      </p>
      <dl className="grid grid-cols-2 gap-x-6 self-end border-t border-line lg:col-span-5 lg:col-start-8">
        {facts.map(([k, v]) => (
          <div key={k} className="border-b border-line py-3.5">
            <dt className="text-[13.5px] text-ink-3">{k}</dt>
            <dd className="measure mt-0.5 text-[15px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Residence({ v, flip }: { v: BuiltVilla; flip: boolean }) {
  const units = useStore((s) => s.units);
  const enter = useStore((s) => s.enterVilla);
  const set = useStore((s) => s.set);
  const lot = LOTS.find((l) => l.villa.id === v.id)!;
  const photos = usePhotos(v.id).filter((p) => p.includes("/photos/"));
  const roomPhotos = useRoomPhotos(v.id);
  const specs: [string, string][] = [
    ["Bedrooms", String(v.beds)],
    ["Baths", String(v.baths)],
    ["Interior", area(interiorArea(v), units)],
    ["Storeys", String(v.levels)],
  ];
  return (
    <article className="grid items-center gap-7 lg:grid-cols-12 lg:gap-12">
      <button
        type="button"
        onClick={() => enter(v.id)}
        className={`group relative block overflow-hidden rounded-[22px] bg-paper-2 text-left shadow-[0_2px_4px_rgba(27,35,30,.06),0_30px_60px_-30px_rgba(27,35,30,.5)] lg:col-span-7 ${flip ? "lg:order-2" : ""}`}
        aria-label={`Tour ${v.name} in 3D`}
      >
        <Still name={v.id} alt={`${v.name} from the street`} villa={v} className="aspect-[3/2] w-full transition-transform duration-700 ease-[var(--ease-out-quart)] group-hover:scale-[1.025]" />
        <span className="absolute left-4 top-4 rounded-full bg-card shadow-[0_2px_8px_-2px_rgba(27,35,30,.35)]"><Status s={v.status} /></span>
        <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3.5 py-2 text-[13.5px] font-semibold text-paper transition-[background-color] duration-150 group-hover:bg-ink">
          <Box className="size-4" strokeWidth={1.75} /> Tour in 3D
        </span>
      </button>
      <div className={`lg:col-span-5 ${flip ? "lg:order-1" : ""}`}>
        <p className="text-[14px] text-ink-3">{v.address} · Lot {lot.number} · {v.view} view</p>
        <h3 className="mt-1.5 font-display text-[clamp(32px,3.6vw,46px)] leading-[1.04] tracking-[-0.015em]">{v.name}</h3>
        <p className="mt-3 font-display text-[26px] leading-none tnum">{price(v.price)}</p>
        <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-ink-2">{v.blurb}</p>
        <dl className="mt-6 grid grid-cols-2 gap-3 border-y border-line py-4 sm:grid-cols-4">
          {specs.map(([k, val]) => (
            <div key={k}>
              <dt className="text-[12.5px] text-ink-3">{k}</dt>
              <dd className="measure mt-0.5 text-[15px] text-ink">{val}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {v.features.map((f) => <li key={f} className="rounded-full bg-paper-2 px-3 py-1 text-[13px] font-medium text-ink-2">{f}</li>)}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <button type="button" className="btn btn-primary" onClick={() => enter(v.id)}>
            <Box className="size-[18px]" strokeWidth={1.75} /> Tour in 3D
          </button>
          {photos.length > 0 && (
            <button type="button" className="btn btn-quiet" onClick={() => set({ viewer: { photos: captionPhotos(v, photos, roomPhotos), i: 0 } })}>
              <Images className="size-[18px]" strokeWidth={1.75} /> {photos.length} photos
            </button>
          )}
          <button type="button" className="btn btn-quiet" onClick={() => { enter(v.id); set({ mode: "plan", level: 0 }); }}>Floor plan and sizes</button>
        </div>
      </div>
    </article>
  );
}

function Residences() {
  const [onlyAvailable, setOnly] = useState(false);
  const villas = useMemo(() => LOTS.map((l) => l.villa).filter((v) => !onlyAvailable || v.status === "Available").sort((a, b) => b.price - a.price), [onlyAvailable]);
  return (
    <section id="residences" className="scroll-mt-16 border-t border-line">
      <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <h2 className="max-w-[16ch] text-balance font-display text-[clamp(38px,5vw,64px)] leading-[1.02] tracking-[-0.02em]">The residences</h2>
          <button type="button" className="chip" aria-pressed={onlyAvailable} onClick={() => setOnly(!onlyAvailable)}>Available now only</button>
        </div>
        <div className="mt-14 flex flex-col gap-20 sm:gap-28">
          {villas.map((v, i) => <Residence key={v.id} v={v} flip={i % 2 === 1} />)}
        </div>
      </div>
    </section>
  );
}

/* ---------- arrival: a site plan drawn from the same data as the 3D model ---------- */

const MAP = { x0: -124, x1: 92, z0: -78, z1: 92 };
const BOULEVARD_X = CITY.boulevard.x;
const BOULEVARD_W = CITY.boulevard.width;
const GATE = AMENITIES.find((a) => a.id === "gate") ?? { x: COMMUNITY.streetX0 - 14, z: 0 };

function SitePlan({ active }: { active: number }) {
  const W = MAP.x1 - MAP.x0, H = MAP.z1 - MAP.z0;
  const X = (x: number) => x - MAP.x0, Y = (z: number) => z - MAP.z0;
  const sw = COMMUNITY.streetWidth / 2;
  const cul = COMMUNITY.cul;
  const stops: [number, number][] = [
    [BOULEVARD_X, 34],
    [GATE.x, GATE.z],
    [(COMMUNITY.streetX0 + COMMUNITY.streetX1) / 2 - 10, 0],
    [cul.x, cul.z],
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Site plan of Sabal Grove: Harbor Boulevard to the west, the gatehouse, Sabal Grove Lane with three lots on each side, the turning circle, the fairway to the north and Heron Lake to the south.">
      <rect width={W} height={H} fill="#24533f" />
      {/* fairway and lake */}
      <path d={`M0 0 H${W} V${Y(COMMUNITY.golfZ + 2)} C${W * 0.6} ${Y(COMMUNITY.golfZ - 6)} ${W * 0.35} ${Y(COMMUNITY.golfZ + 6)} 0 ${Y(COMMUNITY.golfZ)} Z`} fill="#2f6a4f" />
      <path d={`M0 ${Y(COMMUNITY.lakeZ + 4)} C${W * 0.3} ${Y(COMMUNITY.lakeZ - 2)} ${W * 0.7} ${Y(COMMUNITY.lakeZ + 6)} ${W} ${Y(COMMUNITY.lakeZ)} V${H} H0 Z`} fill="#2a5966" />
      {/* boulevard */}
      <rect x={X(BOULEVARD_X) - BOULEVARD_W / 2} y={0} width={BOULEVARD_W} height={H} fill="#e9e2d4" opacity={0.22} />
      <line x1={X(BOULEVARD_X)} y1={0} x2={X(BOULEVARD_X)} y2={H} stroke="#f6f2ea" strokeOpacity={0.5} strokeWidth={0.5} strokeDasharray="3 3" />
      {/* lane and turning circle */}
      <rect x={X(BOULEVARD_X) + BOULEVARD_W / 2} y={Y(-sw)} width={X(COMMUNITY.streetX1) - X(BOULEVARD_X) - BOULEVARD_W / 2} height={sw * 2} fill="#e9e2d4" opacity={0.28} />
      <circle cx={X(cul.x)} cy={Y(cul.z)} r={cul.r} fill="#e9e2d4" opacity={0.28} />
      <circle cx={X(cul.x)} cy={Y(cul.z)} r={5.2} fill="#2f6a4f" />
      {/* lots and houses */}
      {LOTS.map((l) => {
        const f = focusOf(l);
        const r = l.rect;
        return (
          <g key={l.villa.id}>
            <rect x={X(r.x0)} y={Y(r.z0)} width={r.x1 - r.x0} height={r.z1 - r.z0} fill="none" stroke="#f6f2ea" strokeOpacity={0.28} strokeWidth={0.5} />
            <rect x={X(f.rect.x0)} y={Y(f.rect.z0)} width={f.rect.x1 - f.rect.x0} height={f.rect.z1 - f.rect.z0} fill="#f6f2ea" opacity={0.9} rx={0.6} />
            <text x={X((r.x0 + r.x1) / 2)} y={Y(l.side === "N" ? r.z0 + 4.5 : r.z1 - 2)} textAnchor="middle" fontSize={4} fill="#f6f2ea" fillOpacity={0.75} fontFamily="var(--font-sans)">{l.number}</text>
          </g>
        );
      })}
      {/* gatehouse */}
      <rect x={X(GATE.x) - 1.6} y={Y(GATE.z + 6.5)} width={3.2} height={2.4} fill="#f0a43a" />
      {/* route */}
      <path
        d={`M${X(BOULEVARD_X)} ${H} L${X(BOULEVARD_X)} ${Y(1.5)} L${X(cul.x - cul.r)} ${Y(1.5)}`}
        fill="none" stroke="#f0a43a" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 3.2"
      />
      {stops.map(([x, z], i) => (
        <g key={i} transform={`translate(${X(x)} ${Y(z)})`}>
          <circle r={i === active ? 5.4 : 4.4} fill={i === active ? "#f0a43a" : "#1b231e"} stroke="#f0a43a" strokeWidth={0.8} style={{ transition: "r 200ms" }} />
          <text y={1.7} textAnchor="middle" fontSize={4.6} fontWeight={700} fill={i === active ? "#1b231e" : "#f6f2ea"} fontFamily="var(--font-sans)">{i + 1}</text>
        </g>
      ))}
      <text x={X(BOULEVARD_X) - 4} y={14} fontSize={4.2} fill="#f6f2ea" fillOpacity={0.8} transform={`rotate(-90 ${X(BOULEVARD_X) - 4} 14)`} textAnchor="end" fontFamily="var(--font-sans)">Harbor Boulevard</text>
      <text x={W - 4} y={10} fontSize={4.4} fill="#f6f2ea" fillOpacity={0.7} textAnchor="end" fontFamily="var(--font-sans)">Fairway 7</text>
      <text x={W - 4} y={H - 6} fontSize={4.4} fill="#f6f2ea" fillOpacity={0.7} textAnchor="end" fontFamily="var(--font-sans)">Heron Lake</text>
      <g transform={`translate(${W - 10} ${H * 0.42})`} fill="#f6f2ea" fillOpacity={0.7}>
        <path d="M0 -6 L2.2 1 L0 -0.4 L-2.2 1 Z" />
        <text y={6.5} fontSize={3.6} textAnchor="middle" fontFamily="var(--font-sans)">N</text>
      </g>
    </svg>
  );
}

function Arrival() {
  const [active, setActive] = useState(0);
  const units = useStore((s) => s.units);
  const gate = AMENITIES.find((a) => a.id === "gate");
  const park = AMENITIES.find((a) => a.id === "park");
  const steps: { title: string; text: string; place?: string }[] = [
    { title: "Harbor Boulevard", text: "Leave the boulevard at the stone piers and the Sabal Grove sign. It is the only turning between the golf club and the lake." },
    { title: gate?.name ?? "Entrance gate", text: `${gate?.note ?? "Gatehouse and keypad entry"}. Residents drive straight through; visitors are met at the gatehouse, which is also the sales office.`, place: "gate" },
    { title: COMMUNITY.street, text: `${len(COMMUNITY.streetX1 - COMMUNITY.streetX0, units)} of quiet lane under royal palms, with sidewalks on both sides and three homes on each.` },
    { title: park?.name ?? "Pocket park", text: `${park?.note ?? "Fountain and benches"}. The lane ends here, so there is never through traffic.`, place: "park" },
  ];
  return (
    <section id="arrival" className="scroll-mt-16 bg-grove text-paper">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12 lg:px-12">
        <div className="lg:col-span-5">
          <h2 className="max-w-[14ch] text-balance font-display text-[clamp(38px,5vw,64px)] leading-[1.02] tracking-[-0.02em]">How you arrive</h2>
          <p className="mt-5 max-w-[44ch] text-[17px] leading-relaxed text-paper/80">
            One gated way in, one quiet lane, and water and fairway on every other side.
          </p>
          <ol className="mt-10 flex flex-col">
            {steps.map((s, i) => (
              <li key={s.title} className="border-t border-paper/15 last:border-b">
                <button
                  type="button"
                  className="flex w-full items-start gap-4 py-5 text-left"
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => (s.place ? enterExplore({ place: s.place }) : setActive(i))}
                >
                  <span className={`measure mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[13px] transition-colors duration-200 ${active === i ? "bg-lamp text-ink" : "border border-paper/35 text-paper/80"}`}>{i + 1}</span>
                  <span>
                    <span className="block text-[18px] font-semibold">{s.title}</span>
                    <span className="mt-1 block max-w-[46ch] text-[15.5px] leading-relaxed text-paper/75">{s.text}</span>
                    {s.place && <span className="mt-2 inline-flex items-center gap-1 text-[14px] font-semibold text-lamp">See it in 3D <ArrowRight className="size-4" strokeWidth={2} /></span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-5 lg:col-span-7 lg:pt-4">
          <div className="overflow-hidden rounded-[22px] ring-1 ring-paper/10">
            <SitePlan active={active} />
          </div>
          <Still name="gate" alt="The Sabal Grove gatehouse and the start of the lane, rendered from the 3D model" className="aspect-[16/8] w-full rounded-[22px]" />
        </div>
      </div>
    </section>
  );
}

function Inside() {
  const panels = [
    { name: "lights", title: "Switch on any room", text: "Tap a room and its lights come on, from the garage to the pool deck. See how each home reads at dusk before you choose." },
    { name: "plan", title: "Measure everything", text: "Every room carries its size and area, and every sofa, bed and island its width, depth and height." },
    { name: "walk", title: "Walk through the front door", text: "Step inside at eye height, turn, open doors and climb the stairs, in feet or metres." },
  ];
  return (
    <section id="inside" className="scroll-mt-16 border-t border-line">
      <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 className="max-w-[15ch] text-balance font-display text-[clamp(38px,5vw,64px)] leading-[1.02] tracking-[-0.02em] lg:col-span-7">Every room, before you visit</h2>
          <div className="lg:col-span-5">
            <p className="max-w-[46ch] text-[17px] leading-relaxed text-ink-2">The whole street is built to scale in 3D, down to the furniture. It runs in the browser on an iPad, a phone or a desktop.</p>
          </div>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-12">
          {panels.map((p, i) => (
            <figure key={p.name} className={i === 0 ? "md:col-span-12 lg:col-span-7 lg:row-span-2" : "md:col-span-6 lg:col-span-5"}>
              <Still name={p.name} alt={`${p.title}, rendered from the 3D model`} className={`w-full rounded-[20px] ${i === 0 ? "aspect-[4/3] lg:aspect-auto lg:h-[calc(100%-88px)]" : "aspect-[16/9]"}`} />
              <figcaption className="mt-3.5">
                <span className="block text-[18px] font-semibold">{p.title}</span>
                <span className="mt-1 block max-w-[52ch] text-[15px] leading-relaxed text-ink-2">{p.text}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <EnterButton className="mt-12 !min-h-[52px] !px-6 text-[16px]" />
      </div>
    </section>
  );
}

function Setting() {
  const places = AMENITIES.filter((a) => a.id === "golf" || a.id === "lake" || a.id === "park");
  return (
    <section className="relative overflow-hidden bg-ink text-paper">
      <Still name="aerial" alt="Sabal Grove from above at dusk, between the fairway and Heron Lake" className="absolute inset-0 size-full opacity-80" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,20,16,.86)_0%,rgba(14,20,16,.55)_48%,rgba(14,20,16,.1)_100%)]" />
      <div className="relative mx-auto max-w-[1320px] px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
        <h2 className="max-w-[13ch] text-balance font-display text-[clamp(38px,5vw,64px)] leading-[1.02] tracking-[-0.02em]">Fairway on one side, water on the other</h2>
        <ul className="mt-10 max-w-[520px] divide-y divide-paper/15 border-y border-paper/15">
          {places.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-6 py-4">
              <div>
                <p className="text-[17px] font-semibold">{a.name}</p>
                <p className="mt-0.5 text-[15px] leading-relaxed text-paper/75">{a.note}</p>
              </div>
              <button type="button" className="btn btn-on-dark !min-h-10 shrink-0 !px-4 text-[14px]" onClick={() => enterExplore({ place: a.id })}>Show in 3D</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Visit() {
  return (
    <section id="visit" className="scroll-mt-16 bg-paper-2">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12 lg:px-12">
        <div className="lg:col-span-7">
          <h2 className="max-w-[14ch] text-balance font-display text-[clamp(38px,5vw,64px)] leading-[1.02] tracking-[-0.02em]">Visit Sabal Grove</h2>
          <p className="mt-5 max-w-[50ch] text-[17px] leading-relaxed text-ink-2">
            The sales office at the gatehouse is open Thursday to Monday, 10 to 5. Tell us which homes you walked through here and we will have them open for you.
          </p>
        </div>
        <div className="flex flex-col items-start gap-5 lg:col-span-5 lg:items-end lg:self-end">
          <a className="btn btn-primary !min-h-[52px] !px-6 text-[16px]" href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Tour at Sabal Grove")}`}>
            Email the sales office <ArrowUpRight className="size-[18px]" strokeWidth={2} />
          </a>
          <p className="text-[15px] text-ink-2"><MapPin className="mr-1 inline size-4 align-[-3px]" strokeWidth={1.75} />{COMMUNITY.street}, {COMMUNITY.place}</p>
        </div>
      </div>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-8 text-[13px] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <span className="flex items-center gap-2"><Mark className="size-6" /> Sabal Grove</span>
          <span className="max-w-[70ch]">Photographs are visualisations made from the 3D model, not of finished homes. Floor plans, furniture sizes and lot dimensions are drawn to scale; final measurements are confirmed on the survey at contract.</span>
        </div>
      </footer>
    </section>
  );
}

export function Landing() {
  const scroller = useRef<HTMLDivElement>(null);
  const [solid, setSolid] = useState(false);
  const photos = useEstatePhotos();
  const covered = photos.length > 0;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const on = () => {
      const h = el.clientHeight;
      setSolid(el.scrollTop > h - 72);
      // The 3D flyover only renders while it is on screen and not covered by the photographs.
      const visible = el.scrollTop < h && !covered;
      if (useStore.getState().heroVisible !== visible) useStore.getState().set({ heroVisible: visible });
    };
    on();
    el.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { el.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, [covered]);

  // In-page anchors scroll the landing, not the window.
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a[href^='#']");
    if (!a) return;
    const t = scroller.current?.querySelector(a.getAttribute("href")!);
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div ref={scroller} onClick={onClick} className="scroll-soft absolute inset-0 z-40 overflow-y-auto overscroll-contain">
      <Header solid={solid} />
      <Hero photos={photos} />
      <div className="relative bg-paper">
        <Intro />
        <Residences />
        <Arrival />
        <Inside />
        <Setting />
        <Visit />
      </div>
    </div>
  );
}
