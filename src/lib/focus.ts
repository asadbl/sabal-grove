import * as THREE from "three";
import { lotOf, toWorld, type Lot } from "../data/community";
import { LEVEL_HEIGHT } from "../data/types";

export interface Focus {
  center: THREE.Vector3;
  radius: number;
  height: number;
  /** World-space building rect (indoor rooms only). */
  rect: { x0: number; z0: number; x1: number; z1: number };
}

export function focusOf(lot: Lot): Focus {
  const ind = lot.villa.rooms.filter((r) => !r.outdoor);
  const x0 = Math.min(...ind.map((r) => r.x0)), x1 = Math.max(...ind.map((r) => r.x1));
  const z0 = Math.min(...ind.map((r) => r.z0)), z1 = Math.max(...ind.map((r) => r.z1));
  const [ax, az] = toWorld(lot, x0, z0), [bx, bz] = toWorld(lot, x1, z1);
  const rect = { x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz) };
  const height = lot.villa.levels * LEVEL_HEIGHT + 1.2;
  return {
    center: new THREE.Vector3((rect.x0 + rect.x1) / 2, 0, (rect.z0 + rect.z1) / 2),
    radius: Math.hypot(rect.x1 - rect.x0, rect.z1 - rect.z0) / 2,
    height,
    rect,
  };
}

export const focusById = (id: string) => focusOf(lotOf(id));

/** Azimuth that puts the villa's street side toward the viewer. */
export const frontAzimuth = (lot: Lot) => (lot.side === "S" ? Math.PI : 0);
