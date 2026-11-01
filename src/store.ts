import { create } from "zustand";
import type { Units } from "./lib/units";
import { VILLAS } from "./data/villas";

export type TimeOfDay = "day" | "dusk" | "night";
export type Mode = "lights" | "plan" | "walk";

export type Selection =
  | { type: "item"; villaId: string; itemId: string }
  | { type: "room"; villaId: string; roomId: string }
  | { type: "object"; kind: string; label: string; specs: [string, string][]; point: [number, number, number] }
  | null;

interface State {
  /** landing = the scrolling advertisement over a live flyover; explore = the full-screen 3D console. */
  layout: "landing" | "explore";
  /** The landing hero is on screen, so its flyover should keep rendering. */
  heroVisible: boolean;
  /** ?still=1 renders the scene with no interface, for capturing marketing stills. */
  still: boolean;
  villaId: string | null;
  hoverVilla: string | null;
  /** Villa chosen on the neighbourhood map, before going inside. */
  picked: string | null;
  /** Amenity the map should fly to. */
  place: string | null;
  walkRoom: string | null;
  nearDoor: string | null;
  walkPose: { x: number; z: number; yaw: number; level: number } | null;
  mode: Mode;
  level: number;
  time: TimeOfDay;
  units: Units;
  lights: Record<string, Record<string, boolean>>;
  doors: Record<string, boolean>;
  selection: Selection;
  showDims: boolean;
  panelOpen: boolean;
  filters: { beds: number; pool: boolean | null; levels: number | null; status: "any" | "available" };
  focusRoom: string | null;
  walkTarget: string | null;
  /** Fullscreen photo viewer: the photos it pages through and the one showing. */
  viewer: { photos: { src: string; caption: string }[]; i: number } | null;

  set: (p: Partial<State>) => void;
  enterVilla: (id: string) => void;
  leaveVilla: () => void;
  toggleLight: (villaId: string, zone: string) => void;
  setAllLights: (villaId: string, on: boolean) => void;
  scene: (villaId: string, zones: string[]) => void;
  toggleDoor: (id: string) => void;
}

/** A believable evening for every house: some rooms lit, some dark. */
const EVENING: Record<string, string[]> = {
  "casa-palma": ["living", "kitchen", "lanai", "pooldeck", "primary", "front", "entry"],
  "villa-sable": ["kitchen", "dining", "living", "terrace", "pooldeck", "bed3", "primary", "balcony", "front"],
  "the-cypress": ["kitchen", "living", "porch", "lanai", "bed2"],
  "villa-coral": ["living", "dining", "kitchen", "loggia", "pooldeck", "roofdeck", "primary", "bed4", "front"],
  "heron-house": ["living", "dining", "kitchen", "porch", "terrace"],
  "villa-laguna": ["kitchen", "living", "pooldeck", "balcony", "primary", "media", "front", "entry"],
};

const initialLights = () => Object.fromEntries(VILLAS.map((v) => [v.id, Object.fromEntries((EVENING[v.id] ?? []).map((z) => [z, true]))]));

export const useStore = create<State>((set) => ({
  layout: "landing",
  heroVisible: true,
  still: new URLSearchParams(window.location.search).has("still"),
  villaId: null,
  hoverVilla: null,
  picked: null,
  place: null,
  walkRoom: null,
  nearDoor: null,
  walkPose: null,
  viewer: null,
  mode: "lights",
  level: 0,
  time: "dusk",
  units: "imperial",
  lights: initialLights(),
  doors: {},
  selection: null,
  showDims: false,
  panelOpen: true,
  filters: { beds: 0, pool: null, levels: null, status: "any" },
  focusRoom: null,
  walkTarget: null,

  set: (p) => set(p),
  enterVilla: (id) => {
    const v = VILLAS.find((x) => x.id === id);
    set({ villaId: id, layout: "explore", mode: "lights", level: (v?.levels ?? 1) - 1, selection: null, focusRoom: null, hoverVilla: null, picked: null, walkRoom: null, nearDoor: null });
  },
  leaveVilla: () => set((s) => ({ picked: s.villaId, villaId: null, mode: "lights", selection: null, focusRoom: null, walkRoom: null, nearDoor: null })),
  toggleLight: (villaId, zone) =>
    set((s) => ({ lights: { ...s.lights, [villaId]: { ...s.lights[villaId], [zone]: !s.lights[villaId]?.[zone] } } })),
  setAllLights: (villaId, on) =>
    set((s) => {
      const v = VILLAS.find((x) => x.id === villaId)!;
      return { lights: { ...s.lights, [villaId]: Object.fromEntries(v.rooms.map((r) => [r.id, on])) } };
    }),
  scene: (villaId, zones) => set((s) => ({ lights: { ...s.lights, [villaId]: Object.fromEntries(zones.map((z) => [z, true])) } })),
  // Both leaves of a double door move together.
  toggleDoor: (id) => set((s) => {
    const base = id.replace(/:[lr]$/, "");
    const open = !s.doors[id];
    return { doors: base === id ? { ...s.doors, [id]: open } : { ...s.doors, [base + ":l"]: open, [base + ":r"]: open } };
  }),
}));

export const EVENING_SCENE = EVENING;
