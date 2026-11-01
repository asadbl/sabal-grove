import {
  ArrowDown, ArrowUp, Camera, ChevronLeft, DoorClosed, DoorOpen, Footprints, Lightbulb, LightbulbOff, Moon, RotateCcw, RotateCw,
  Ruler, Sun, Sunset, X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { AMENITIES, COMMUNITY, LOTS, lotOf } from "../data/community";
import { CATALOG } from "../data/catalog";
import type { BuiltVilla } from "../data/dsl";
import { area as rectArea, interiorArea, planOf } from "../lib/plan";
import { site } from "../lib/site";
import { area, dims, len, price, priceFull, small } from "../lib/units";
import { EVENING_SCENE, useStore, type Mode, type TimeOfDay } from "../store";
import { setWalkGoal, walkInput } from "../three/Walker";
import { Mark, SALES_EMAIL } from "./brand";
import { ROOM_ICON } from "./icons";
import { PlanThumb } from "./PlanThumb";
import { captionPhotos, usePhotos, useRoomPhotos } from "./photos";

const TIMES: { id: TimeOfDay; label: string; icon: typeof Sun }[] = [
  { id: "day", label: "Day", icon: Sun }, { id: "dusk", label: "Dusk", icon: Sunset }, { id: "night", label: "Night", icon: Moon },
];

function TopRight() {
  const time = useStore((s) => s.time);
  const units = useStore((s) => s.units);
  const set = useStore((s) => s.set);
  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
      <div className="seg surface !rounded-full" role="group" aria-label="Time of day">
        {TIMES.map(({ id, label, icon: I }) => (
          <button key={id} type="button" aria-pressed={time === id} onClick={() => set({ time: id })} title={label}>
            <I className="size-[17px]" strokeWidth={1.75} /><span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
      <div className="seg surface !rounded-full" role="group" aria-label="Units">
        <button type="button" aria-pressed={units === "imperial"} onClick={() => set({ units: "imperial" })}>ft</button>
        <button type="button" aria-pressed={units === "metric"} onClick={() => set({ units: "metric" })}>m</button>
      </div>
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`surface pointer-events-auto flex min-h-0 flex-col overflow-hidden ${className}`}>{children}</section>;
}

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div className="flex gap-1 border-b border-line px-3 pt-2" role="tablist">
      {items.map(([id, label]) => (
        <button
          key={id} type="button" role="tab" aria-selected={value === id} onClick={() => onChange(id)}
          className={`-mb-px min-h-11 border-b-2 px-3 text-[14.5px] font-semibold transition-colors duration-150 ${value === id ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
        >{label}</button>
      ))}
    </div>
  );
}

/* ================= neighbourhood ================= */

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex items-baseline justify-between gap-4 py-2.5"><dt className="text-[14px] text-ink-2">{k}</dt><dd className="measure text-[14px] text-ink">{v}</dd></div>;
}

function Console() {
  const [tab, setTab] = useState<"overview" | "lots" | "objects">("overview");
  const units = useStore((s) => s.units);
  const set = useStore((s) => s.set);
  const S = useMemo(() => site(), []);
  const counts = useMemo(() => {
    const c: Record<string, number> & { hedgeLen?: number } = {};
    for (const p of S.plants) c[p.kind] = (c[p.kind] ?? 0) + 1;
    const hedge = S.plants.filter((p) => p.kind === "hedge").reduce((s, p) => s + (p.sz ?? 0), 0);
    c.hedgeLen = hedge;
    return c as Record<string, number> & { hedgeLen: number };
  }, [S]);
  const land = LOTS.length * COMMUNITY.lotWidth * COMMUNITY.lotDepth;
  const built = LOTS.reduce((s, l) => s + l.villa.rooms.filter((r) => !r.outdoor && r.level === 0).reduce((a, r) => a + rectArea(r), 0), 0);
  const pools = LOTS.filter((l) => l.villa.pool);
  const poolArea = pools.reduce((s, l) => s + rectArea(l.villa.pool!), 0);
  return (
    <Panel className="max-h-full">
      <div className="px-4 pb-1 pt-4">
        <h2 className="font-display text-[21px] leading-tight">Neighbourhood console</h2>
        <p className="text-[13.5px] text-ink-3">Every lot, tree and lamp, measured. Tap anything on the map.</p>
      </div>
      <Tabs value={tab} onChange={setTab} items={[["overview", "Overview"], ["lots", "Lots"], ["objects", "Objects"]]} />
      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {tab === "overview" && (
          <dl className="divide-y divide-line">
            <Row k="Homes" v={`${LOTS.length} · ${LOTS.filter((l) => l.villa.status === "Available").length} available`} />
            <Row k="Land, all lots" v={area(land, units)} />
            <Row k="Built footprint" v={`${area(built, units)} · ${Math.round((built / land) * 100)}%`} />
            <Row k="Pools" v={`${pools.length} · ${area(poolArea, units)} of water`} />
            <Row k="Street" v={`${len(COMMUNITY.streetX1 - COMMUNITY.streetX0, units)} long, ${len(COMMUNITY.streetWidth, units)} wide`} />
            <Row k="Sidewalks" v={`${len(COMMUNITY.sidewalk, units)} each side`} />
            <Row k="Trees" v={(counts.oak ?? 0) + (counts.royal ?? 0) + (counts.sabal ?? 0)} />
            <Row k="Street lanterns" v={S.lamps.length} />
            {AMENITIES.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                <div><p className="text-[14px] font-semibold">{a.name}</p><p className="text-[13px] text-ink-3">{a.note}</p></div>
                <button type="button" className="chip !min-h-9 shrink-0" onClick={() => set({ place: a.id, picked: null })}>Fly to</button>
              </div>
            ))}
          </dl>
        )}
        {tab === "lots" && (
          <table className="mt-2 w-full text-left text-[13.5px]">
            <thead><tr className="text-ink-3"><th className="py-2 font-semibold">Lot</th><th className="font-semibold">Home</th><th className="font-semibold">Size</th><th className="text-right font-semibold">Price</th></tr></thead>
            <tbody className="divide-y divide-line">
              {[...LOTS].sort((a, b) => a.number - b.number).map((l) => (
                <tr key={l.villa.id} className="cursor-pointer hover:bg-paper-2" onClick={() => set({ picked: l.villa.id, place: null })}>
                  <td className="measure py-2.5">{l.number}</td>
                  <td><p className="font-semibold">{l.villa.name}</p><p className="text-[12.5px] text-ink-3">{l.villa.status} · {area(interiorArea(l.villa), units)} inside</p></td>
                  <td className="measure text-[12.5px]">{dims(COMMUNITY.lotWidth, COMMUNITY.lotDepth, units)}</td>
                  <td className="measure text-right">{price(l.villa.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "objects" && (
          <dl className="divide-y divide-line">
            <Row k="Royal palms" v={counts.royal ?? 0} />
            <Row k="Southern live oaks" v={counts.oak ?? 0} />
            <Row k="Sabal palms" v={counts.sabal ?? 0} />
            <Row k="Shrubs and bougainvillea" v={(counts.shrub ?? 0) + (counts.bloom ?? 0)} />
            <Row k="Privacy hedge" v={len(counts.hedgeLen, units)} />
            <Row k="Street lanterns" v={S.lamps.length} />
            <Row k="Mailboxes" v={S.mailboxes.length} />
            <Row k="Park benches" v={S.benches.length} />
            <Row k="Driveways" v={LOTS.length} />
            <p className="pt-3 text-[13.5px] text-ink-3">Tap any tree, lantern or the street itself to see its height and spread.</p>
          </dl>
        )}
      </div>
    </Panel>
  );
}

function Places() {
  const picked = useStore((s) => s.picked);
  const place = useStore((s) => s.place);
  const set = useStore((s) => s.set);
  const items: { id: string; label: string; sub?: string; villa?: boolean }[] = [
    { id: "gate", label: "Entrance" },
    ...[...LOTS].sort((a, b) => a.x - b.x || a.number - b.number).map((l) => ({ id: l.villa.id, label: l.villa.name, sub: price(l.villa.price), villa: true })),
    { id: "park", label: "Park" }, { id: "golf", label: "Fairway 7" }, { id: "lake", label: "Heron Lake" },
  ];
  return (
    <nav className="surface pointer-events-auto flex max-w-full gap-1 overflow-x-auto p-1.5 scroll-soft" aria-label="Places">
      {items.map((it) => {
        const on = it.villa ? picked === it.id : place === it.id && !picked;
        return (
          <button
            key={it.id} type="button" aria-pressed={on}
            onClick={() => set(it.villa ? { picked: it.id, place: null } : { place: it.id, picked: null })}
            className={`flex min-h-12 shrink-0 flex-col items-start justify-center rounded-xl px-3.5 text-left transition-colors duration-150 ${on ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
          >
            <span className="text-[14px] font-semibold leading-tight">{it.label}</span>
            {it.sub && <span className={`measure text-[12px] ${on ? "text-paper/75" : "text-ink-3"}`}>{it.sub}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function PickedCard({ v }: { v: BuiltVilla }) {
  const units = useStore((s) => s.units);
  const set = useStore((s) => s.set);
  const enter = useStore((s) => s.enterVilla);
  const photos = usePhotos(v.id);
  return (
    <Panel className="rise w-[min(360px,calc(100vw-24px))]">
      <div className="relative aspect-[16/9] bg-paper-2">
        {photos[0] ? <img src={photos[0]} alt={v.name} className="size-full object-cover" /> : <PlanThumb villa={v} className="size-full p-4" />}
        <button type="button" onClick={() => set({ picked: null })} className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-card/90 hover:bg-card" aria-label="Close"><X className="size-4" /></button>
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between"><p className="font-display text-[24px] tnum">{price(v.price)}</p><p className="text-[13px] font-semibold text-ink-3">{v.status}</p></div>
        <h3 className="font-display text-[18px]">{v.name}</h3>
        <p className="text-[14px] text-ink-2">{v.beds} bd · {v.baths} ba · {area(interiorArea(v), units)} · {v.levels === 2 ? "2 storeys" : "1 storey"}{v.pool ? " · pool" : ""}</p>
        <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => enter(v.id)}><Footprints className="size-[18px]" strokeWidth={1.75} /> Go inside</button>
      </div>
    </Panel>
  );
}

function ObjectCard() {
  const sel = useStore((s) => s.selection);
  const set = useStore((s) => s.set);
  if (sel?.type !== "object") return null;
  return (
    <Panel className="rise w-[min(320px,calc(100vw-24px))] p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[18px] leading-tight">{sel.label}</h3>
        <button type="button" onClick={() => set({ selection: null })} className="-m-1 grid size-9 place-items-center rounded-full hover:bg-paper-2" aria-label="Close"><X className="size-4" /></button>
      </div>
      <dl className="mt-2 divide-y divide-line">
        {sel.specs.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2"><dt className="text-[13.5px] text-ink-3">{k}</dt><dd className={`text-right text-[14px] ${k === "Note" || k === "Light" ? "" : "measure"}`}>{v}</dd></div>
        ))}
      </dl>
    </Panel>
  );
}

/* ================= inside a villa ================= */

function LightsTab({ v }: { v: BuiltVilla }) {
  const lights = useStore((s) => s.lights[v.id] ?? {});
  const toggle = useStore((s) => s.toggleLight);
  const all = useStore((s) => s.setAllLights);
  const scene = useStore((s) => s.scene);
  const set = useStore((s) => s.set);
  const level = useStore((s) => s.level);
  const onCount = v.rooms.filter((r) => lights[r.id]).length;
  const groups: [string, BuiltVilla["rooms"]][] = [
    ...Array.from({ length: v.levels }, (_, i) => [v.levels > 1 ? (i ? "Upstairs" : "Downstairs") : "Inside", v.rooms.filter((r) => !r.outdoor && r.level === i)] as [string, BuiltVilla["rooms"]]),
    ["Outside", v.rooms.filter((r) => r.outdoor)],
  ];
  return (
    <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      <div className="sticky top-0 z-[1] -mx-4 flex flex-wrap gap-2 bg-card px-4 py-3">
        <button type="button" className="btn btn-lamp !min-h-10 !px-4 text-[14px]" onClick={() => all(v.id, true)}><Lightbulb className="size-4" strokeWidth={2} /> All on</button>
        <button type="button" className="btn btn-quiet !min-h-10 !px-4 text-[14px]" onClick={() => scene(v.id, EVENING_SCENE[v.id] ?? [])}>Evening</button>
        <button type="button" className="btn btn-quiet !min-h-10 !px-4 text-[14px]" onClick={() => all(v.id, false)}><LightbulbOff className="size-4" strokeWidth={2} /> All off</button>
      </div>
      <p className="mb-1 text-[13px] text-ink-3 tnum">{onCount} of {v.rooms.length} zones on</p>
      {groups.map(([g, rooms]) => rooms.length > 0 && (
        <div key={g} className="mt-3">
          <p className="label mb-1">{g}</p>
          <ul className="divide-y divide-line">
            {rooms.map((r) => {
              const I = ROOM_ICON[r.type];
              const on = !!lights[r.id];
              return (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl transition-colors duration-150 ${on ? "bg-lamp text-[#2a1a04]" : "bg-paper-2 text-ink-3"}`}><I className="size-[18px]" strokeWidth={1.75} /></span>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => set({ focusRoom: r.id, ...(r.level > level ? { level: r.level } : {}) })}>
                    <span className="block truncate text-[14.5px] font-semibold">{r.name}</span>
                    <span className="block text-[12.5px] text-ink-3">{on ? "On" : "Off"}</span>
                  </button>
                  <button type="button" role="switch" aria-checked={on} aria-label={`${r.name} lights`} className="switch" onClick={() => toggle(v.id, r.id)} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RoomsTab({ v }: { v: BuiltVilla }) {
  const units = useStore((s) => s.units);
  const set = useStore((s) => s.set);
  const sel = useStore((s) => s.selection);
  const roomPhotos = useRoomPhotos(v.id);
  const inside = interiorArea(v);
  const garage = v.rooms.filter((r) => r.type === "garage").reduce((s, r) => s + rectArea(r), 0);
  const out = v.rooms.filter((r) => r.outdoor && r.type !== "garden" && r.type !== "driveway").reduce((s, r) => s + rectArea(r), 0);
  return (
    <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      <dl className="grid grid-cols-3 gap-2 py-3">
        {[["Inside", area(inside, units)], ["Garage", garage ? area(garage, units) : "Carport"], ["Outdoor", area(out, units)]].map(([k, val]) => (
          <div key={k} className="rounded-xl bg-paper-2 px-3 py-2"><dt className="text-[12px] text-ink-3">{k}</dt><dd className="measure text-[13.5px]">{val}</dd></div>
        ))}
      </dl>
      {Array.from({ length: v.levels }, (_, lv) => (
        <div key={lv} className="mt-2">
          {v.levels > 1 && <p className="label mb-1">{lv ? "Upstairs" : "Downstairs"}</p>}
          <ul className="divide-y divide-line">
            {v.rooms.filter((r) => r.level === lv && r.type !== "garden").map((r) => {
              const I = ROOM_ICON[r.type];
              const on = sel?.type === "room" && sel.roomId === r.id;
              return (
                <li key={r.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2 text-left transition-colors duration-150 ${on ? "bg-survey/10" : "hover:bg-paper-2"}`}
                    onClick={() => set({ mode: "plan", level: r.level, focusRoom: r.id, selection: { type: "room", villaId: v.id, roomId: r.id } })}
                  >
                    <I className="ml-1 size-[18px] shrink-0 text-ink-3" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{r.name}</span>
                    <span className="measure text-right text-[12.5px] text-ink-2">{dims(r.x1 - r.x0, r.z1 - r.z0, units)}<br /><span className="text-ink-3">{area(rectArea(r), units)}</span></span>
                  </button>
                  {roomPhotos[r.id] && (
                    <button type="button" className="size-11 shrink-0 overflow-hidden rounded-lg" aria-label={`Photo of the ${r.name}`} onClick={() => set({ viewer: { photos: [{ src: roomPhotos[r.id], caption: `${v.name}: ${r.name}` }], i: 0 } })}>
                      <img src={roomPhotos[r.id]} alt="" className="size-full object-cover" loading="lazy" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function DetailsTab({ v }: { v: BuiltVilla }) {
  const units = useStore((s) => s.units);
  const photos = usePhotos(v.id);
  const roomPhotos = useRoomPhotos(v.id);
  const set = useStore((s) => s.set);
  const lot = lotOf(v.id);
  return (
    <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-4 pb-5">
      {photos.length > 0 && (
        <div className="-mx-4 mt-0 flex snap-x gap-2 overflow-x-auto px-4 py-3 scroll-soft">
          {photos.map((p, i) => (
            <button key={p} type="button" className="shrink-0 snap-start overflow-hidden rounded-xl" aria-label={`Open photo ${i + 1} of ${photos.length}`} onClick={() => set({ viewer: { photos: captionPhotos(v, photos, roomPhotos), i } })}>
              <img src={p} alt="" className="h-36 w-56 object-cover transition-transform duration-300 hover:scale-[1.03]" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 font-display text-[28px] tnum">{priceFull(v.price)}</p>
      <p className="text-[14px] text-ink-2">{v.status} · Lot {lot.number} · {v.address}</p>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{v.blurb}</p>
      <dl className="mt-4 divide-y divide-line border-y border-line">
        {[
          ["Bedrooms", v.beds], ["Bathrooms", v.baths], ["Storeys", v.levels], ["Inside", area(interiorArea(v), units)],
          ["Lot", `${dims(COMMUNITY.lotWidth, COMMUNITY.lotDepth, units)} · ${area(COMMUNITY.lotWidth * COMMUNITY.lotDepth, units)}`],
          ...(v.pool ? [["Pool", `${dims(v.pool.x1 - v.pool.x0, v.pool.z1 - v.pool.z0, units)}, ${len(v.pool.depth, units)} deep`]] : []),
          ["View", v.view === "Golf" ? "7th fairway" : "Heron Lake"],
        ].map(([k, val]) => (
          <div key={String(k)} className="flex items-baseline justify-between gap-4 py-2.5"><dt className="text-[14px] text-ink-2">{k}</dt><dd className="measure text-right text-[14px]">{val}</dd></div>
        ))}
      </dl>
      <ul className="mt-4 flex flex-wrap gap-1.5">{v.features.map((f) => <li key={f} className="rounded-full bg-paper-2 px-2.5 py-1 text-[13px] font-medium text-ink-2">{f}</li>)}</ul>
      <a className="btn btn-primary mt-5 w-full" href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`Tour of ${v.name}`)}`}>Ask for a tour</a>
    </div>
  );
}

function VillaPanel({ v }: { v: BuiltVilla }) {
  const [tab, setTab] = useState<"lights" | "rooms" | "details">("lights");
  return (
    <Panel className="max-h-full">
      <Tabs value={tab} onChange={setTab} items={[["lights", "Lights"], ["rooms", "Rooms & sizes"], ["details", "Details"]]} />
      {tab === "lights" && <LightsTab v={v} />}
      {tab === "rooms" && <RoomsTab v={v} />}
      {tab === "details" && <DetailsTab v={v} />}
    </Panel>
  );
}

const MODES: { id: Mode; label: string; icon: typeof Ruler }[] = [
  { id: "lights", label: "Lights", icon: Lightbulb },
  { id: "plan", label: "Plan & sizes", icon: Ruler },
  { id: "walk", label: "Walk through", icon: Footprints },
];

function ModeBar({ v }: { v: BuiltVilla }) {
  const mode = useStore((s) => s.mode);
  const level = useStore((s) => s.level);
  const set = useStore((s) => s.set);
  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
      <div className="seg surface !rounded-full" role="group" aria-label="View">
        {MODES.map(({ id, label, icon: I }) => (
          <button key={id} type="button" aria-pressed={mode === id} onClick={() => set({ mode: id, selection: null, focusRoom: null })} className="!min-h-11 !px-4">
            <I className="size-[18px]" strokeWidth={1.75} />{label}
          </button>
        ))}
      </div>
      {v.levels > 1 && mode !== "walk" && (
        <div className="seg surface !rounded-full" role="group" aria-label="Floor">
          <button type="button" aria-pressed={level === 0} onClick={() => set({ level: 0, focusRoom: null })} className="!min-h-11">Ground</button>
          <button type="button" aria-pressed={level === 1} onClick={() => set({ level: 1, focusRoom: null })} className="!min-h-11">Upper</button>
        </div>
      )}
    </div>
  );
}

function ItemCard({ v }: { v: BuiltVilla }) {
  const sel = useStore((s) => s.selection);
  const roomPhotos = useRoomPhotos(v.id);
  const units = useStore((s) => s.units);
  const set = useStore((s) => s.set);
  if (sel?.type === "item") {
    const it = v.items.find((i) => i.id === sel.itemId);
    if (!it) return null;
    const room = v.rooms.find((r) => r.id === it.room);
    const [W, D, H] = it.size;
    return (
      <Panel className="rise w-[min(340px,calc(100vw-24px))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-display text-[19px] leading-tight">{it.label}</h3><p className="text-[13.5px] text-ink-3">{room?.name}</p></div>
          <button type="button" onClick={() => set({ selection: null })} className="-m-1 grid size-9 place-items-center rounded-full hover:bg-paper-2" aria-label="Close"><X className="size-4" /></button>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[["Width", W], ["Depth", D], ["Height", H]].map(([k, val]) => (
            <div key={k as string} className="rounded-xl bg-survey/10 px-3 py-2"><dt className="text-[12px] font-semibold text-survey-ink">{k}</dt><dd className="measure text-[15px]">{small(val as number, units)}</dd></div>
          ))}
        </dl>
        <p className="mt-2 text-[12.5px] text-ink-3">Footprint {area(W * D, units)}. {CATALOG[it.kind]?.solid ? "" : "Not counted as an obstacle when you walk through."}</p>
      </Panel>
    );
  }
  if (sel?.type === "room") {
    const r = v.rooms.find((x) => x.id === sel.roomId);
    if (!r) return null;
    const items = v.items.filter((i) => i.room === r.id);
    const photo = roomPhotos[r.id];
    return (
      <Panel className="rise w-[min(340px,calc(100vw-24px))] p-4">
        {photo && (
          <button type="button" className="-mx-4 -mt-4 mb-3 block w-[calc(100%+32px)] overflow-hidden" aria-label={`Open the photo of the ${r.name}`} onClick={() => set({ viewer: { photos: [{ src: photo, caption: `${v.name}: ${r.name}` }], i: 0 } })}>
            <img src={photo} alt="" className="aspect-[16/9] w-full object-cover" />
          </button>
        )}
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-display text-[19px] leading-tight">{r.name}</h3><p className="measure text-[13.5px] text-ink-2">{dims(r.x1 - r.x0, r.z1 - r.z0, units)} · {area(rectArea(r), units)}</p></div>
          <button type="button" onClick={() => set({ selection: null })} className="-m-1 grid size-9 place-items-center rounded-full hover:bg-paper-2" aria-label="Close"><X className="size-4" /></button>
        </div>
        {items.length > 0 && (
          <ul className="scroll-soft mt-2 max-h-40 divide-y divide-line overflow-y-auto">
            {items.map((it) => (
              <li key={it.id}>
                <button type="button" className="flex w-full items-baseline justify-between gap-3 py-2 text-left hover:text-survey-ink" onClick={() => set({ selection: { type: "item", villaId: v.id, itemId: it.id } })}>
                  <span className="text-[14px]">{it.label}</span>
                  <span className="measure text-[12.5px] text-ink-3">{small(it.size[0], units)} × {small(it.size[1], units)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  }
  return null;
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="surface pointer-events-none rounded-full px-4 py-2 text-[13.5px] text-ink-2">{children}</p>;
}

function hold(dir: keyof typeof walkInput) {
  return {
    onPointerDown: (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); walkInput[dir] = 1; },
    onPointerUp: () => { walkInput[dir] = 0; },
    onPointerCancel: () => { walkInput[dir] = 0; },
    onLostPointerCapture: () => { walkInput[dir] = 0; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

function WalkHud({ v }: { v: BuiltVilla }) {
  const room = useStore((s) => s.walkRoom);
  const near = useStore((s) => s.nearDoor);
  const doors = useStore((s) => s.doors);
  const pose = useStore((s) => s.walkPose);
  const units = useStore((s) => s.units);
  const toggle = useStore((s) => s.toggleDoor);
  const set = useStore((s) => s.set);
  const lights = useStore((s) => s.lights[v.id]);
  const roomPhotos = useRoomPhotos(v.id);
  const r = v.rooms.find((x) => x.id === room);
  const photo = r ? roomPhotos[r.id] : null;
  const padBtn = "grid size-14 select-none place-items-center rounded-2xl bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,.1),0_10px_24px_-10px_rgba(0,0,0,.45)] border border-line active:bg-paper-2";
  return (
    <>
      <div className="absolute inset-x-0 top-[72px] flex items-center justify-center px-3">
        {r && (
          <p className="surface rise flex items-baseline gap-2 rounded-full px-4 py-2" key={r.id}>
            <span className="font-semibold">{r.name}</span>
            <span className="measure text-[13px] text-ink-2">{dims(r.x1 - r.x0, r.z1 - r.z0, units)}</span>
          </p>
        )}
        {r && photo && (
          <button type="button" className="btn surface pointer-events-auto rise ml-2 !min-h-10 !px-4 text-[14px]" onClick={() => set({ viewer: { photos: [{ src: photo, caption: `${v.name}: ${r.name}` }], i: 0 } })}>
            <Camera className="size-4" strokeWidth={1.75} /> Photo
          </button>
        )}
      </div>
      <div className="pointer-events-auto absolute bottom-4 left-4 grid grid-cols-3 gap-2" aria-label="Move">
        <span />
        <button type="button" className={padBtn} aria-label="Walk forward" {...hold("f")}><ArrowUp className="size-6" strokeWidth={2} /></button>
        <span />
        <button type="button" className={padBtn} aria-label="Turn left" {...hold("l")}><RotateCcw className="size-6" strokeWidth={2} /></button>
        <button type="button" className={padBtn} aria-label="Step back" {...hold("b")}><ArrowDown className="size-6" strokeWidth={2} /></button>
        <button type="button" className={padBtn} aria-label="Turn right" {...hold("r")}><RotateCw className="size-6" strokeWidth={2} /></button>
      </div>
      <div className="pointer-events-auto absolute bottom-4 right-4 w-[min(240px,40vw)]">
        <div className="surface overflow-hidden p-2">
          <PlanThumb villa={v} level={pose?.level ?? 0} pose={pose} lit={lights} active={room} className="block max-h-[220px] w-full" onTap={(x, z) => setWalkGoal(x, z, pose?.level ?? 0)} />
          <p className="px-1 pt-1 text-[12px] text-ink-3">Tap the plan to walk there</p>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-[150px] flex justify-center px-3 lg:bottom-6">
        {near ? (
          <button type="button" className="btn btn-primary pointer-events-auto rise shadow-lg" onClick={() => toggle(near)}>
            {doors[near] ? <DoorClosed className="size-[18px]" strokeWidth={1.75} /> : <DoorOpen className="size-[18px]" strokeWidth={1.75} />}
            {doors[near] ? "Close door" : "Open door"}
          </button>
        ) : (
          <Hint>Drag to look around · tap the floor to walk there · tap a door to open it</Hint>
        )}
      </div>
      <div className="pointer-events-auto absolute right-4 top-[72px]">
        <button type="button" className="btn surface !min-h-10 !px-4 text-[14px]" onClick={() => set({ mode: "lights" })}>Leave walk</button>
      </div>
    </>
  );
}

/* ================= shell ================= */

export function Explore({ portrait }: { portrait: boolean }) {
  const villaId = useStore((s) => s.villaId);
  const picked = useStore((s) => s.picked);
  const mode = useStore((s) => s.mode);
  const set = useStore((s) => s.set);
  const leave = useStore((s) => s.leaveVilla);
  const panelOpen = useStore((s) => s.panelOpen);
  const sel = useStore((s) => s.selection);
  const v = villaId ? lotOf(villaId).villa : null;
  const p = picked ? lotOf(picked).villa : null;
  const plan = v ? planOf(v) : null;
  void plan;
  const walk = mode === "walk" && v;

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="btn surface !min-h-11 !rounded-full !px-3.5 text-[14.5px]"
            onClick={() => (v ? leave() : set({ layout: "landing", picked: null, place: null, selection: null, heroVisible: true }))}
          >
            <ChevronLeft className="size-5" strokeWidth={2} /> {v ? "Neighbourhood" : "Home"}
          </button>
          <div className="surface hidden min-w-0 items-center gap-2.5 !rounded-full py-1.5 pl-1.5 pr-4 md:flex">
            <Mark className="size-8" />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-[16px]">{v ? v.name : "Sabal Grove"}</p>
              <p className="truncate text-[12.5px] text-ink-3">{v ? `${v.address} · ${price(v.price)}` : `${LOTS.length} homes · ${COMMUNITY.place}`}</p>
            </div>
          </div>
        </div>
        <TopRight />
      </div>

      {/* neighbourhood */}
      {!v && (
        <>
          {!portrait && (
            <div className="absolute bottom-24 right-4 top-[76px] flex w-[340px] flex-col">
              <Console />
            </div>
          )}
          <div className="absolute inset-x-3 bottom-3 flex justify-center sm:inset-x-4 sm:bottom-4">
            <Places />
          </div>
          <div className={`absolute left-3 flex flex-col gap-3 sm:left-4 ${portrait ? "bottom-24" : "bottom-24"}`}>
            {p && <div className="pointer-events-auto"><PickedCard v={p} /></div>}
            {sel?.type === "object" && <div className="pointer-events-auto"><ObjectCard /></div>}
          </div>
        </>
      )}

      {/* inside a villa */}
      {v && !walk && (
        <>
          <div className={portrait
            ? `absolute inset-x-3 bottom-20 flex flex-col transition-[height] duration-200 ${panelOpen ? "h-[42vh]" : "h-12"}`
            : "absolute bottom-20 right-4 top-[76px] flex w-[340px] flex-col"}>
            {portrait && (
              <button type="button" className="surface pointer-events-auto mb-2 self-center !rounded-full px-4 py-1.5 text-[13px] font-semibold" onClick={() => set({ panelOpen: !panelOpen })}>
                {panelOpen ? "Hide panel" : "Show lights & rooms"}
              </button>
            )}
            {(!portrait || panelOpen) && <VillaPanel v={v} />}
          </div>
          <div className="absolute inset-x-3 bottom-3 flex justify-center sm:bottom-4">
            <ModeBar v={v} />
          </div>
          <div className="absolute left-3 top-[76px] flex flex-col gap-2 sm:left-4">
            <div className="pointer-events-auto"><ItemCard v={v} /></div>
          </div>
          {!sel && !portrait && (
            <div className="absolute inset-x-0 bottom-[84px] flex justify-center pr-[360px]">
              <Hint>{mode === "lights" ? "Tap any room to switch its lights" : "Tap furniture for its size · tap a floor for the room"}</Hint>
            </div>
          )}
        </>
      )}
      {walk && <WalkHud v={v} />}
    </div>
  );
}
