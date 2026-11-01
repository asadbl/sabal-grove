export type Side = "front" | "back" | "left" | "right";

export type RoomType =
  | "living" | "kitchen" | "dining" | "bedroom" | "primary" | "bath" | "powder"
  | "office" | "hall" | "entry" | "stair" | "landing" | "garage" | "laundry"
  | "closet" | "media" | "pantry" | "terrace" | "balcony" | "pooldeck" | "driveway" | "garden";

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  level: number;
  x0: number; z0: number; x1: number; z1: number;
  outdoor: boolean;
  /** Covered outdoor space: gets a roof slab on posts. */
  covered?: boolean;
}

export type OpeningKind = "door" | "double" | "slider" | "garage" | "opening" | "window";

export interface Opening {
  id: string;
  level: number;
  kind: OpeningKind;
  /** The wall runs along this axis. "x" means the wall sits at z = c. */
  axis: "x" | "z";
  c: number;
  /** Centre of the opening along the wall. */
  at: number;
  width: number;
  sill: number;
  head: number;
  rooms: [string, string | null];
}

export interface Stair {
  level: number;
  x0: number; z0: number; x1: number; z1: number;
  /** Direction of ascent. */
  dir: "+x" | "-x" | "+z" | "-z";
}

export type RoofKind = "flat" | "hip" | "gable" | "roofdeck";

export interface Block {
  level: number;
  x0: number; z0: number; x1: number; z1: number;
  roof: RoofKind;
}

export interface Pool {
  x0: number; z0: number; x1: number; z1: number;
  depth: number;
  spa?: { x0: number; z0: number; x1: number; z1: number };
}

export interface Item {
  id: string;
  kind: string;
  label: string;
  room: string;
  level: number;
  x: number; z: number; y: number;
  rot: number;
  size: [number, number, number];
  tone?: string;
  solid: boolean;
}

export interface VillaStyle {
  stucco: string;
  trim: string;
  roof: string;
  accent: string;
  wood: string;
  fabric: string;
  fabric2: string;
  floor: "oak" | "walnut" | "travertine" | "concrete";
}

export interface Villa {
  id: string;
  name: string;
  address: string;
  tagline: string;
  blurb: string;
  price: number;
  status: "Available" | "Reserved" | "Sold";
  beds: number;
  baths: number;
  levels: number;
  lot: number;
  view: "Golf" | "Lake";
  style: VillaStyle;
  rooms: Room[];
  openings: Opening[];
  stairs: Stair[];
  blocks: Block[];
  pool?: Pool;
  items: Item[];
  features: string[];
  /** Footprint bounds of everything built, local coords. */
  bounds: { x0: number; z0: number; x1: number; z1: number };
}

export const LEVEL_HEIGHT = 3.2;
export const CEILING = 2.95;
