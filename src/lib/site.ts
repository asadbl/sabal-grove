import { CITY } from "../data/city";
import { COMMUNITY as C, LOTS, toWorld, type Lot } from "../data/community";
import { rectsMinus } from "./plan";
import type { Plant } from "../three/Vegetation";

export interface WRect { x0: number; z0: number; x1: number; z1: number }

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Villa-local rect to world rect. */
export function rectW(lot: Lot, r: WRect): WRect {
  const [ax, az] = toWorld(lot, r.x0, r.z0);
  const [bx, bz] = toWorld(lot, r.x1, r.z1);
  return { x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz) };
}

export interface Site {
  plants: Plant[];
  lamps: [number, number][];
  /** Driveways (drawn by the villas themselves) and the aprons from the kerb that the site draws. */
  drives: WRect[];
  aprons: WRect[];
  walks: WRect[];
  beds: WRect[];
  mailboxes: { x: number; z: number; r: number; n: number }[];
  benches: { x: number; z: number; r: number }[];
}

let cached: Site | null = null;

export function site(): Site {
  if (cached) return cached;
  const r = rng(77);
  const plants: Plant[] = [];
  const drives: WRect[] = [], aprons: WRect[] = [], walks: WRect[] = [], beds: WRect[] = [];
  const mailboxes: Site["mailboxes"] = [];
  const benches: Site["benches"] = [];
  const add = (kind: Plant["kind"], x: number, z: number, s = 1) => plants.push({ kind, x, z, s: s * (0.88 + r() * 0.24), r: r() * Math.PI * 2 });

  const sw = C.streetWidth / 2;
  for (const lot of LOTS) {
    const v = lot.villa;
    const dir = lot.side === "S" ? 1 : -1;
    const drive = v.rooms.find((x) => x.type === "driveway" && x.z0 < 0)!;
    const dw = rectW(lot, drive);
    drives.push(dw);
    // apron from the curb to the lot line
    const apron = dir > 0 ? { x0: dw.x0, z0: sw, x1: dw.x1, z1: C.frontLine } : { x0: dw.x0, z0: -C.frontLine, x1: dw.x1, z1: -sw };
    drives.push(apron);
    aprons.push(apron);
    // front walk from the sidewalk to the front door
    const door = v.openings.find((o) => o.level === 0 && (o.kind === "double" || o.kind === "door") && !o.rooms[1] && o.axis === "x" && o.c === 0)!;
    const porch = v.rooms.find((x) => x.id === "porch");
    const zEnd = porch ? porch.z0 : 0;
    walks.push(rectW(lot, { x0: door.at - 0.7, z0: -C.setback, x1: door.at + 0.7, z1: zEnd }));
    walks.push(dir > 0 ? { ...rectW(lot, { x0: door.at - 0.7, z0: 0, x1: door.at + 0.7, z1: 1 }), z0: C.frontLine - 1.6, z1: C.frontLine } : { ...rectW(lot, { x0: door.at - 0.7, z0: 0, x1: door.at + 0.7, z1: 1 }), z0: -C.frontLine, z1: -C.frontLine + 1.6 });

    // foundation beds and shrubs along the front wall
    const front = v.rooms.filter((x) => !x.outdoor && x.level === 0 && x.z0 === 0);
    for (const room of front) {
      const opens = v.openings.filter((o) => o.level === 0 && o.axis === "x" && o.c === 0 && o.kind !== "window");
      let x = room.x0 + 0.7;
      while (x < room.x1 - 0.4) {
        const blocked = opens.some((o) => Math.abs(o.at - x) < o.width / 2 + 0.6) || (porch && x > porch.x0 - 0.4 && x < porch.x1 + 0.4);
        if (!blocked) {
          const [wx, wz] = toWorld(lot, x, -0.95);
          add(r() > 0.8 ? "bloom" : "shrub", wx, wz, 0.9);
        }
        x += 1.35;
      }
      // keep mulch off porches and terraces so two surfaces never share a plane
      const outdoor = v.rooms.filter((x) => x.outdoor && x.level === 0);
      const bedRects = rectsMinus([{ x0: room.x0, z0: -1.7, x1: room.x1, z1: -0.15 }], outdoor);
      for (const b of bedRects) beds.push(rectW(lot, b));
    }

    // front-yard shade tree on the side away from the driveway
    const houseCx = (v.bounds.x0 + v.bounds.x1) / 2;
    const driveLeft = (drive.x0 + drive.x1) / 2 < houseCx;
    const tx = driveLeft ? Math.max(...v.rooms.filter((x) => x.z0 <= 0 && !x.outdoor).map((x) => x.x1)) - 3 : drive.x1 + 4;
    const [ox, oz] = toWorld(lot, tx, -4.6);
    add("oak", ox, oz, 0.8);

    // palms around the pool deck and garden
    const deck = v.rooms.find((x) => x.type === "pooldeck") ?? v.rooms.find((x) => x.id === "terrace" || x.id === "garden");
    if (deck) {
      const pts: [number, number][] = [[deck.x0 - 1.2, deck.z1 - 1], [deck.x1 + 1.2, deck.z1 - 2], [deck.x1 + 1.4, deck.z0 + 1.5]];
      for (const [px, pz] of pts) { const [wx, wz] = toWorld(lot, px, pz); add("sabal", wx, wz, 0.95); }
      const [bx, bz] = toWorld(lot, deck.x0 - 1.4, (deck.z0 + deck.z1) / 2);
      add("bloom", bx, bz, 1.2);
    }

    // privacy hedges on the side lot lines, from behind the front yard to the back
    const L = lot.rect;
    const zA = lot.side === "S" ? L.z0 + 5 : L.z0 + 4, zB = lot.side === "S" ? L.z1 - 4 : L.z1 - 5;
    for (const hx of [L.x0 + 0.6, L.x1 - 0.6]) {
      plants.push({ kind: "hedge", x: hx, z: (zA + zB) / 2, s: 1, r: 0, sx: 0.9, sz: zB - zA, h: 1.8 });
    }
    // mailbox at the curb
    const [mx] = toWorld(lot, door.at + 1.6, 0);
    mailboxes.push({ x: mx, z: dir * (sw + 1.1), r: dir > 0 ? Math.PI : 0, n: lot.number });
  }

  // royal palms down both verges, skipping driveway aprons
  for (const side of [-1, 1]) {
    for (let x = C.streetX0 + 6; x < C.streetX1; x += 13) {
      const z = side * (sw + 1.05);
      if (drives.some((d) => x > d.x0 - 2 && x < d.x1 + 2 && Math.sign(d.z0 + d.z1) === side)) continue;
      if (walks.some((d) => x > d.x0 - 1.5 && x < d.x1 + 1.5 && Math.sign(d.z0 + d.z1) === side)) continue;
      add("royal", x, z, 1);
    }
  }

  // oaks in the gaps between lots
  for (const lot of LOTS) {
    if (lot.index % 3 === 2) continue;
    const gx = lot.rect.x1 + 2;
    for (let z = Math.min(lot.rect.z0, lot.rect.z1) + 10; z < Math.max(lot.rect.z0, lot.rect.z1) - 4; z += 12) add("oak", gx, z, 0.75);
  }

  // turning-circle park
  const cul = C.cul;
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    if (Math.cos(ang) < -0.75) continue;
    add(a % 3 === 0 ? "royal" : "oak", cul.x + Math.cos(ang) * (cul.r + 6), cul.z + Math.sin(ang) * (cul.r + 6), 0.9);
  }
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    add("bloom", cul.x + Math.cos(ang) * 3.6, cul.z + Math.sin(ang) * 3.6, 0.9);
  }
  benches.push({ x: cul.x + 18, z: cul.z - 6, r: -Math.PI / 2 - 0.3 }, { x: cul.x + 18, z: cul.z + 6, r: -Math.PI / 2 + 0.3 }, { x: cul.x + 9, z: cul.z - 15, r: 0.2 });

  // entrance
  for (const s of [-1, 1]) {
    add("royal", C.streetX0 + 2, s * 8, 1.05);
    add("royal", C.streetX0 + 7, s * 8.5, 1.05);
    for (let i = 0; i < 6; i++) add("bloom", C.streetX0 + 1 + i * 1.2, s * 6.4, 0.9);
  }

  // the golf course's own tree line, inside the estate
  for (let x = -76; x <= 120; x += 12 + r() * 8) add(r() > 0.35 ? "oak" : "sabal", x, -150 - r() * 22, 1 + r() * 0.3);
  for (const [cx, cz] of [[-40, -96], [-34, -100], [40, -70], [46, -64], [100, -104]]) add(r() > 0.5 ? "sabal" : "oak", cx, cz, 1);
  // Harbor Boulevard: royal palms down the median and along both kerbs near the gate
  const B = CITY.boulevard;
  for (let z = -760; z <= 24; z += 15) add("royal", B.x, z + r() * 2, 1.05);
  for (let z = -120; z <= 24; z += 14) for (const sx of [-1, 1]) {
    if (sx > 0 && Math.abs(z) < 16) continue; // keep the gate approach open
    add("royal", B.x + sx * (B.width / 2 + 1.8), z + 7, 1);
  }
  // the estate's west edge behind its perimeter wall
  for (let z = -40; z <= 40; z += 9) if (Math.abs(z) > 14) add("sabal", CITY.estate.x0 + 4.5, z + r() * 2, 0.95);
  // east greenbelt between the turning circle and the avenue
  for (let z = -40; z <= 40; z += 13) add(r() > 0.5 ? "oak" : "sabal", CITY.estate.x1 - 6 - r() * 8, z, 1);
  // lake-edge palms behind the south lots
  for (let x = -44; x <= 44; x += 11) add("sabal", x + r() * 3, C.lakeZ + 3.5 + r() * 2, 1);
  // golf-side palms behind the north lots
  for (let x = -40; x <= 44; x += 16) add("sabal", x + r() * 4, C.golfZ - 3 - r() * 2, 1);

  const lamps: [number, number][] = [];
  for (let x = C.streetX0 + 12, i = 0; x < C.streetX1; x += 18, i++) {
    const z = (i % 2 ? 1 : -1) * (sw + 1.05);
    if (drives.some((d) => x > d.x0 - 1.5 && x < d.x1 + 1.5 && Math.sign(d.z0 + d.z1) === Math.sign(z))) continue;
    lamps.push([x, z]);
  }
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2 + 0.3;
    if (Math.cos(ang) < -0.7) continue;
    lamps.push([cul.x + Math.cos(ang) * (cul.r + 1.6), cul.z + Math.sin(ang) * (cul.r + 1.6)]);
  }

  cached = { plants, lamps, drives, aprons, walks, beds, mailboxes, benches };
  return cached;
}
