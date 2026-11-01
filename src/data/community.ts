import { VILLAS } from "./villas";
import type { BuiltVilla } from "./dsl";

export const COMMUNITY = {
  name: "Sabal Grove",
  place: "Lake Harbor, Florida",
  street: "Sabal Grove Lane",
  streetWidth: 9,
  sidewalk: 2,
  verge: 1.5,
  lotWidth: 28,
  lotDepth: 38,
  setback: 8,
  /** World z of the front property lines (north lots at -frontLine). */
  frontLine: 8,
  streetX0: -62,
  streetX1: 50,
  cul: { x: 62, z: 0, r: 13 },
  golfZ: -46,
  lakeZ: 46,
};

export interface Lot {
  index: number;
  number: number;
  side: "N" | "S";
  x: number;
  villa: BuiltVilla;
  /** World transform of the villa's local frame. */
  pos: [number, number, number];
  rotY: number;
  /** World-space lot rectangle. */
  rect: { x0: number; z0: number; x1: number; z1: number };
}

const LOT_X = [-32, 0, 32];

export const LOTS: Lot[] = VILLAS.map((villa): Lot => {
  const index = villa.lot;
  const side: Lot["side"] = index < 3 ? "N" : "S";
  const x = LOT_X[index % 3];
  const { x0, x1 } = villa.bounds;
  const ox = -(x0 + x1) / 2;
  const front = COMMUNITY.frontLine + COMMUNITY.setback;
  const d = COMMUNITY.lotDepth, w = COMMUNITY.lotWidth;
  const rect = side === "S"
    ? { x0: x - w / 2, z0: COMMUNITY.frontLine, x1: x + w / 2, z1: COMMUNITY.frontLine + d }
    : { x0: x - w / 2, z0: -COMMUNITY.frontLine - d, x1: x + w / 2, z1: -COMMUNITY.frontLine };
  return {
    index,
    number: side === "N" ? [2, 4, 6][index] : [3, 5, 7][index - 3],
    side,
    x,
    villa,
    pos: side === "S" ? [x + ox, 0, front] : [x - ox, 0, -front],
    rotY: side === "S" ? 0 : Math.PI,
    rect,
  };
}).sort((a, b) => a.index - b.index);

export const lotOf = (villaId: string) => LOTS.find((l) => l.villa.id === villaId)!;

/** Villa-local point to world. */
export function toWorld(lot: Lot, x: number, z: number): [number, number] {
  return lot.rotY === 0 ? [lot.pos[0] + x, lot.pos[2] + z] : [lot.pos[0] - x, lot.pos[2] - z];
}

export const AMENITIES = [
  { id: "gate", name: "Entrance gate", x: -76, z: 0, note: "Staffed gatehouse off Harbor Boulevard, the only way in" },
  { id: "boulevard", name: "Harbor Boulevard", x: -100, z: -60, note: "Six-lane palm boulevard, 4 minutes to downtown Lake Harbor" },
  { id: "park", name: "Pocket park", x: 62, z: 0, note: "Fountain, benches and shade oaks around the turning circle" },
  { id: "golf", name: "Fairway 7", x: 0, z: -75, note: "Par 4, 382 yards, behind lots 2, 4 and 6" },
  { id: "lake", name: "Heron Lake", x: 0, z: 78, note: "Private dock and lakeside path behind lots 3, 5 and 7" },
  { id: "skyline", name: "Downtown", x: 60, z: 330, note: "The Lake Harbor skyline, across the water from every south lot" },
];
