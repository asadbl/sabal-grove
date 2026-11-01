import { memo, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Item } from "../data/types";
import { useMats } from "./matsContext";

type V3 = [number, number, number];

const geoCache = new Map<string, THREE.BufferGeometry>();
function rbox(w: number, h: number, d: number, r: number) {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${rr.toFixed(3)}`;
  let g = geoCache.get(k);
  if (!g) { g = rr > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d); geoCache.set(k, g); }
  return g;
}
function cyl(rt: number, rb: number, h: number, seg = 20) {
  const k = `c|${rt}|${rb}|${h}|${seg}`;
  let g = geoCache.get(k);
  if (!g) { g = new THREE.CylinderGeometry(rt, rb, h, seg); geoCache.set(k, g); }
  return g;
}
function sph(r: number, detail = 1) {
  const k = `s|${r}|${detail}`;
  let g = geoCache.get(k);
  if (!g) { g = new THREE.IcosahedronGeometry(r, detail); geoCache.set(k, g); }
  return g;
}

/** Rounded box: size [w, h, d] centred at p. */
function RB({ s, p, m, r = 0.02, rot }: { s: V3; p: V3; m: string; r?: number; rot?: V3 }) {
  const mats = useMats();
  return <mesh geometry={rbox(s[0], s[1], s[2], r)} material={m.startsWith("#") ? mats.tone(m, 0.6, 0) : mats.get(m)} position={p} rotation={rot} castShadow receiveShadow />;
}
function Cyl({ r, r2, h, p, m, rot, seg }: { r: number; r2?: number; h: number; p: V3; m: string; rot?: V3; seg?: number }) {
  const mats = useMats();
  return <mesh geometry={cyl(r, r2 ?? r, h, seg)} material={mats.get(m)} position={p} rotation={rot} castShadow receiveShadow />;
}
function Ball({ r, p, m, detail = 1 }: { r: number; p: V3; m: string; detail?: number }) {
  const mats = useMats();
  return <mesh geometry={sph(r, detail)} material={mats.get(m)} position={p} castShadow />;
}

function legs(W: number, D: number, H: number, m: string, inset = 0.06, t = 0.04) {
  const x = W / 2 - inset, z = D / 2 - inset;
  return [[-x, -z], [x, -z], [-x, z], [x, z]].map(([a, b], i) => <RB key={`l${i}`} s={[t, H, t]} p={[a, H / 2, b]} m={m} r={0.008} />);
}

function Pendant({ x, z, drop = 1.9 }: { x: number; z: number; drop?: number }) {
  return (
    <>
      <Cyl r={0.006} h={2.95 - drop - 0.12} p={[x, (2.95 + drop + 0.12) / 2, z]} m="metal" seg={6} />
      <Cyl r={0.05} r2={0.17} h={0.2} p={[x, drop + 0.1, z]} m="metal" />
      <Ball r={0.07} p={[x, drop, z]} m="fixture" />
    </>
  );
}

function Chair({ x, z, ry, seat = "fabric", frame = "wood" }: { x: number; z: number; ry: number; seat?: string; frame?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <RB s={[0.46, 0.06, 0.46]} p={[0, 0.46, 0]} m={seat} r={0.02} />
      <RB s={[0.46, 0.44, 0.05]} p={[0, 0.72, -0.2]} m={frame} r={0.02} />
      {legs(0.46, 0.46, 0.43, frame, 0.04, 0.035)}
    </group>
  );
}

function Sofa({ W, D, fab = "fabric", acc = "fabric2", frame }: { W: number; D: number; fab?: string; acc?: string; frame?: string }) {
  const n = W > 2 ? 3 : W > 1.2 ? 2 : 1;
  const arm = 0.2, cw = (W - arm * 2) / n;
  return (
    <>
      <RB s={[W, 0.36, D]} p={[0, 0.24, 0]} m={frame ?? fab} r={0.04} />
      <RB s={[W, 0.44, 0.2]} p={[0, 0.58, -D / 2 + 0.1]} m={frame ?? fab} r={0.05} />
      <RB s={[arm, 0.6, D]} p={[-W / 2 + arm / 2, 0.3, 0]} m={frame ?? fab} r={0.05} />
      <RB s={[arm, 0.6, D]} p={[W / 2 - arm / 2, 0.3, 0]} m={frame ?? fab} r={0.05} />
      {Array.from({ length: n }, (_, i) => (
        <group key={i}>
          <RB s={[cw - 0.02, 0.14, D - 0.28]} p={[-W / 2 + arm + cw * (i + 0.5), 0.48, 0.07]} m={fab} r={0.06} />
          <RB s={[cw - 0.04, 0.38, 0.16]} p={[-W / 2 + arm + cw * (i + 0.5), 0.7, -D / 2 + 0.27]} m={fab} r={0.07} rot={[-0.12, 0, 0]} />
        </group>
      ))}
      {n > 1 && <RB s={[0.4, 0.36, 0.12]} p={[-W / 2 + arm + 0.3, 0.68, -D / 2 + 0.42]} m={acc} r={0.06} rot={[-0.2, 0.2, 0]} />}
      {n > 1 && <RB s={[0.4, 0.36, 0.12]} p={[W / 2 - arm - 0.3, 0.68, -D / 2 + 0.42]} m={acc} r={0.06} rot={[-0.2, -0.2, 0]} />}
    </>
  );
}

const BOOK_TONES = ["#8c3b2f", "#2e4a5c", "#c8a45a", "#5b6b4e", "#e6dfcf", "#3b3a36", "#9b6a4a"];

function Body({ it }: { it: Item }) {
  const mats = useMats();
  const [W, D, H] = it.size;
  const k = it.kind;
  switch (k) {
    case "bed-king": case "bed-queen": case "bed-twin": {
      const pillows = k === "bed-twin" ? 1 : 2;
      return (
        <>
          <RB s={[W, 0.3, D]} p={[0, 0.15, 0]} m="wood" r={0.02} />
          <RB s={[W - 0.04, 0.24, D - 0.08]} p={[0, 0.42, 0.02]} m="linen" r={0.07} />
          <RB s={[W + 0.03, 0.09, D * 0.66]} p={[0, 0.53, D * 0.17]} m="fabric" r={0.045} />
          <RB s={[W + 0.04, 0.05, 0.5]} p={[0, 0.56, D * 0.42]} m="fabric2" r={0.025} />
          {Array.from({ length: pillows }, (_, i) => (
            <RB key={i} s={[pillows === 1 ? W * 0.7 : W * 0.42, 0.15, 0.48]} p={[pillows === 1 ? 0 : (i ? 1 : -1) * W * 0.23, 0.62, -D / 2 + 0.36]} m="linen" r={0.07} rot={[-0.25, 0, 0]} />
          ))}
          <RB s={[W + 0.12, H, 0.1]} p={[0, H / 2, -D / 2 + 0.05]} m="fabric2" r={0.03} />
        </>
      );
    }
    case "nightstand":
      return (
        <>
          <RB s={[W, H - 0.06, D]} p={[0, (H - 0.06) / 2 + 0.06, 0]} m="wood" r={0.015} />
          {legs(W, D, 0.06, "metal", 0.04, 0.03)}
          <Cyl r={0.05} r2={0.07} h={0.25} p={[0, H + 0.125, 0]} m="ceramic" />
          <Cyl r={0.1} r2={0.15} h={0.22} p={[0, H + 0.36, 0]} m="fixture" />
        </>
      );
    case "wardrobe":
      return (
        <>
          <RB s={[W, H, D]} p={[0, H / 2, 0]} m="cabinet" r={0.01} />
          {[-W / 4, 0, W / 4].map((x, i) => <RB key={i} s={[0.006, H - 0.1, 0.01]} p={[x, H / 2, D / 2 + 0.002]} m="metal" r={0} />)}
          {[-W / 8 - 0.03, W / 8 + 0.03, -W * 0.375 + 0.05, W * 0.375 - 0.05].map((x, i) => <RB key={`h${i}`} s={[0.015, 0.3, 0.025]} p={[x, H * 0.5, D / 2 + 0.015]} m="chrome" r={0.005} />)}
        </>
      );
    case "dresser": case "console": {
      const drawers = k === "dresser";
      return (
        <>
          {drawers ? <RB s={[W, H - 0.1, D]} p={[0, (H - 0.1) / 2 + 0.1, 0]} m="wood" r={0.015} /> : <RB s={[W, 0.04, D]} p={[0, H - 0.02, 0]} m="wood" r={0.01} />}
          {legs(W, D, drawers ? 0.1 : H - 0.04, drawers ? "metal" : "wood", 0.05, drawers ? 0.03 : 0.04)}
          {drawers && [0.3, 0.52].map((y) => <RB key={y} s={[W - 0.06, 0.006, 0.01]} p={[0, y + 0.1, D / 2 + 0.002]} m="metal" r={0} />)}
          <Cyl r={0.06} r2={0.08} h={0.3} p={[W * 0.3, H + 0.15, 0]} m="ceramic" />
          <Cyl r={0.11} r2={0.17} h={0.24} p={[W * 0.3, H + 0.42, 0]} m="fixture" />
          <RB s={[0.3, 0.04, 0.22]} p={[-W * 0.2, H + 0.02, 0]} m="#3b3a36" r={0.005} />
        </>
      );
    }
    case "desk":
      return (
        <>
          <RB s={[W, 0.04, D]} p={[0, H - 0.02, 0]} m="wood" r={0.01} />
          {legs(W, D, H - 0.04, "metal", 0.05, 0.035)}
          <RB s={[0.62, 0.37, 0.025]} p={[0, H + 0.33, -D / 2 + 0.18]} m="screen" r={0.01} />
          <RB s={[0.05, 0.16, 0.05]} p={[0, H + 0.08, -D / 2 + 0.2]} m="metal" r={0.01} />
          <RB s={[0.42, 0.015, 0.14]} p={[0, H + 0.008, 0.05]} m="#e6e4df" r={0.005} />
        </>
      );
    case "desk-chair":
      return (
        <>
          <RB s={[0.5, 0.08, 0.48]} p={[0, 0.48, 0.02]} m="fabric2" r={0.03} />
          <RB s={[0.48, 0.52, 0.06]} p={[0, 0.8, -0.22]} m="fabric2" r={0.03} rot={[-0.1, 0, 0]} />
          <Cyl r={0.025} h={0.4} p={[0, 0.24, 0]} m="metal" />
          <Cyl r={0.28} r2={0.3} h={0.03} p={[0, 0.04, 0]} m="metal" seg={5} />
        </>
      );
    case "sofa": case "outdoor-sofa":
      return <Sofa W={W} D={D} fab={k === "outdoor-sofa" ? "cushion" : "fabric"} frame={k === "outdoor-sofa" ? "woodDark" : undefined} />;
    case "armchair":
      return <Sofa W={W} D={D} fab="fabric2" acc="fabric" />;
    case "sofa-l":
      return (
        <>
          <group position={[0, 0, -D / 2 + 0.475]}><Sofa W={W} D={0.95} /></group>
          <group position={[W / 2 - 0.475, 0, 0.475]}>
            <RB s={[0.95, 0.36, D - 0.95]} p={[0, 0.24, 0]} m="fabric" r={0.04} />
            <RB s={[0.91, 0.14, D - 0.97]} p={[0, 0.48, 0]} m="fabric" r={0.06} />
          </group>
        </>
      );
    case "coffee-table":
      return (
        <>
          <RB s={[W, 0.05, D]} p={[0, H - 0.025, 0]} m="wood" r={0.02} />
          <RB s={[W - 0.1, 0.03, D - 0.1]} p={[0, 0.1, 0]} m="wood" r={0.01} />
          {legs(W, D, H - 0.05, "metal", 0.05, 0.03)}
          <RB s={[0.28, 0.06, 0.2]} p={[-W * 0.2, H + 0.03, 0]} m="#2e4a5c" r={0.005} />
          <Cyl r={0.12} r2={0.06} h={0.08} p={[W * 0.2, H + 0.04, 0]} m="ceramic" />
        </>
      );
    case "media-console":
      return (
        <>
          <RB s={[W, 0.46, D]} p={[0, 0.3, 0]} m="wood" r={0.015} />
          {legs(W, D, 0.07, "metal", 0.06, 0.03)}
          <RB s={[1.45, 0.83, 0.04]} p={[0, 0.53 + 0.415 + 0.04, -0.05]} m="screen" r={0.008} />
          <RB s={[0.3, 0.04, 0.2]} p={[0, 0.55, -0.05]} m="metal" r={0.005} />
        </>
      );
    case "media-screen":
      return (
        <>
          <RB s={[W, 0.08, D]} p={[0, 0.04, 0]} m="screen" r={0.01} />
          <RB s={[W, H - 0.1, 0.04]} p={[0, 0.6 + (H - 0.1) / 2, 0]} m="linen" r={0.005} />
          <RB s={[W + 0.06, 0.06, 0.06]} p={[0, 0.6 + H - 0.07, 0]} m="screen" r={0.005} />
        </>
      );
    case "rug":
      return <RB s={[W, 0.012, D]} p={[0, 0.026, 0]} m="rug" r={0.004} />;
    case "dining-table": case "outdoor-dining": {
      const per = W >= 2.1 ? 3 : 2;
      const outdoor = k === "outdoor-dining";
      return (
        <>
          <RB s={[W, 0.05, D]} p={[0, H - 0.025, 0]} m={outdoor ? "woodDark" : "wood"} r={0.015} />
          {legs(W, D, H - 0.05, outdoor ? "woodDark" : "wood", 0.1, 0.06)}
          {Array.from({ length: per }, (_, i) => {
            const x = -W / 2 + (W * (i + 0.5)) / per;
            return (
              <group key={i}>
                <Chair x={x} z={D / 2 + 0.28} ry={Math.PI} seat={outdoor ? "cushion" : "fabric"} frame={outdoor ? "metal" : "wood"} />
                <Chair x={x} z={-D / 2 - 0.28} ry={0} seat={outdoor ? "cushion" : "fabric"} frame={outdoor ? "metal" : "wood"} />
              </group>
            );
          })}
          {!outdoor && [-W / 3, 0, W / 3].map((x, i) => <Pendant key={i} x={x} z={0} drop={1.75} />)}
          <Cyl r={0.12} r2={0.08} h={0.12} p={[0, H + 0.06, 0]} m="ceramic" />
        </>
      );
    }
    case "dining-round":
      return (
        <>
          <Cyl r={W / 2} h={0.04} p={[0, H - 0.02, 0]} m="wood" seg={40} />
          <Cyl r={0.06} h={H - 0.04} p={[0, (H - 0.04) / 2, 0]} m="metal" />
          <Cyl r={0.3} h={0.03} p={[0, 0.015, 0]} m="metal" seg={30} />
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2 + Math.PI / 4, r = W / 2 + 0.25;
            return <Chair key={i} x={Math.sin(a) * r} z={Math.cos(a) * r} ry={a + Math.PI} />;
          })}
          <Pendant x={0} z={0} drop={1.8} />
        </>
      );
    case "kitchen-run":
      return (
        <>
          <RB s={[W, 0.82, D - 0.03]} p={[0, 0.51, -0.015]} m="cabinet" r={0.006} />
          <RB s={[W, 0.1, D - 0.08]} p={[0, 0.05, -0.04]} m="metal" r={0} />
          <RB s={[W + 0.02, 0.04, D + 0.01]} p={[0, 0.94, 0]} m="counter" r={0.006} />
          <RB s={[0.72, 0.012, 0.5]} p={[W * 0.2, 0.965, 0.03]} m="screen" r={0.004} />
          <RB s={[0.68, 0.02, 0.42]} p={[-W * 0.22, 0.95, 0.03]} m="chrome" r={0.004} />
          <Cyl r={0.015} h={0.32} p={[-W * 0.22, 1.12, -0.2]} m="chrome" seg={10} />
          <RB s={[W, 0.62, 0.02]} p={[0, 1.27, -D / 2 + 0.01]} m="counter" r={0} />
          <RB s={[W, 0.78, 0.35]} p={[0, 1.98, -D / 2 + 0.175]} m="cabinet" r={0.006} />
          <RB s={[0.8, 0.4, 0.45]} p={[W * 0.2, 1.75, -D / 2 + 0.24]} m="steel" r={0.01} />
          {(() => { const n = Math.max(2, Math.round(W / 0.6)); return Array.from({ length: n }, (_, i) => <RB key={i} s={[0.006, 0.7, 0.01]} p={[-W / 2 + (W * (i + 1)) / (n + 1), 0.5, D / 2 - 0.025]} m="metal" r={0} />); })()}
        </>
      );
    case "island":
      return (
        <>
          <RB s={[W, 0.86, D]} p={[0, 0.45, 0]} m="cabinet" r={0.006} />
          <RB s={[W + 0.1, 0.05, D + 0.12]} p={[0, 0.905, 0.06]} m="counter" r={0.008} />
          {[-W / 3, 0, W / 3].map((x, i) => (
            <group key={i}>
              <Cyl r={0.19} h={0.06} p={[x, 0.68, D / 2 + 0.38]} m="fabric2" />
              <Cyl r={0.02} h={0.65} p={[x, 0.33, D / 2 + 0.38]} m="metal" seg={8} />
              <Cyl r={0.2} h={0.02} p={[x, 0.01, D / 2 + 0.38]} m="metal" />
              <Pendant x={x} z={0} drop={1.9} />
            </group>
          ))}
          <Cyl r={0.15} r2={0.1} h={0.1} p={[W * 0.3, 0.98, -0.1]} m="ceramic" />
        </>
      );
    case "fridge":
      return (
        <>
          <RB s={[W, H, D]} p={[0, H / 2, 0]} m="steel" r={0.015} />
          <RB s={[0.006, H - 0.1, 0.01]} p={[0, H / 2, D / 2 + 0.003]} m="metal" r={0} />
          <RB s={[0.02, 0.6, 0.03]} p={[-0.05, H * 0.6, D / 2 + 0.02]} m="chrome" r={0.005} />
          <RB s={[0.02, 0.6, 0.03]} p={[0.05, H * 0.6, D / 2 + 0.02]} m="chrome" r={0.005} />
        </>
      );
    case "pantry": case "shelving": case "bookshelf": {
      const n = k === "bookshelf" ? 5 : 4;
      const mat = k === "shelving" ? "metal" : "wood";
      return (
        <>
          <RB s={[0.03, H, D]} p={[-W / 2 + 0.015, H / 2, 0]} m={mat} r={0} />
          <RB s={[0.03, H, D]} p={[W / 2 - 0.015, H / 2, 0]} m={mat} r={0} />
          {k !== "shelving" && <RB s={[W, H, 0.015]} p={[0, H / 2, -D / 2 + 0.008]} m={mat} r={0} />}
          {Array.from({ length: n + 1 }, (_, i) => <RB key={i} s={[W, 0.025, D]} p={[0, 0.06 + (i * (H - 0.08)) / n, 0]} m={mat} r={0} />)}
          {Array.from({ length: n }, (_, i) => {
            const y = 0.073 + (i * (H - 0.08)) / n;
            const cells = k === "bookshelf" ? 9 : 4;
            return Array.from({ length: cells }, (_, j) => {
              const seed = (i * 13 + j * 7 + it.id.length) % 7;
              if (k !== "bookshelf" && seed > 4) return null;
              const bw = k === "bookshelf" ? (W - 0.08) / cells - 0.005 : (W - 0.1) / cells - 0.05;
              const bh = k === "bookshelf" ? 0.2 + (seed % 3) * 0.04 : 0.18 + (seed % 2) * 0.1;
              return <RB key={`${i}-${j}`} s={[bw, bh, D * 0.75]} p={[-W / 2 + 0.05 + (j + 0.5) * ((W - 0.08) / cells), y + bh / 2, 0]} m={BOOK_TONES[seed]} r={0.004} />;
            });
          })}
        </>
      );
    }
    case "toilet":
      return (
        <>
          <RB s={[0.36, 0.4, 0.52]} p={[0, 0.2, 0.08]} m="ceramic" r={0.14} />
          <RB s={[0.38, 0.04, 0.48]} p={[0, 0.42, 0.1]} m="ceramic" r={0.02} />
          <RB s={[0.4, 0.4, 0.17]} p={[0, 0.58, -D / 2 + 0.085]} m="ceramic" r={0.03} />
        </>
      );
    case "vanity": case "vanity-double": {
      const sinks = k === "vanity-double" ? 2 : 1;
      return (
        <>
          <RB s={[W, 0.62, D]} p={[0, 0.49, 0]} m="wood" r={0.01} />
          <RB s={[W + 0.02, 0.04, D + 0.02]} p={[0, 0.82, 0]} m="counter" r={0.006} />
          {Array.from({ length: sinks }, (_, i) => {
            const x = sinks === 1 ? 0 : (i ? 1 : -1) * W / 4;
            return (
              <group key={i}>
                <RB s={[0.42, 0.12, 0.34]} p={[x, 0.9, 0.04]} m="ceramic" r={0.06} />
                <Cyl r={0.012} h={0.26} p={[x, 0.97, -D / 2 + 0.07]} m="chrome" seg={8} />
                <RB s={[Math.min(0.75, W / sinks - 0.1), 0.85, 0.02]} p={[x, 1.55, -D / 2 + 0.01]} m="chrome" r={0.01} />
                <Cyl r={0.04} h={0.2} p={[x, 2.1, -D / 2 + 0.06]} m="fixture" seg={12} />
              </group>
            );
          })}
        </>
      );
    }
    case "shower":
      return (
        <>
          <RB s={[W, 0.05, D]} p={[0, 0.025, 0]} m="ceramic" r={0.01} />
          <RB s={[W, 2.0, 0.012]} p={[0, 1.05, D / 2 - 0.006]} m="rail" r={0} />
          <RB s={[0.012, 2.0, D]} p={[W / 2 - 0.006, 1.05, 0]} m="rail" r={0} />
          <Cyl r={0.12} h={0.02} p={[0, 2.1, -D / 2 + 0.3]} m="chrome" />
          <Cyl r={0.01} h={0.3} p={[0, 2.12, -D / 2 + 0.15]} m="chrome" rot={[Math.PI / 2, 0, 0]} seg={8} />
        </>
      );
    case "tub":
      return (
        <>
          <RB s={[W, H, D]} p={[0, H / 2, 0]} m="ceramic" r={0.28} />
          <RB s={[W - 0.16, 0.02, D - 0.16]} p={[0, H - 0.04, 0]} m="#cfe2e6" r={0.005} />
          <Cyl r={0.015} h={0.9} p={[W / 2 + 0.12, 0.45, 0]} m="chrome" seg={8} />
        </>
      );
    case "laundry":
      return (
        <>
          {[-0.33, 0.33].map((x) => (
            <group key={x}>
              <RB s={[0.6, 0.86, 0.64]} p={[x, 0.43, 0]} m="ceramic" r={0.02} />
              <Cyl r={0.2} h={0.03} p={[x, 0.42, 0.32]} m="screen" rot={[Math.PI / 2, 0, 0]} seg={28} />
              <Cyl r={0.17} h={0.035} p={[x, 0.42, 0.32]} m="carGlass" rot={[Math.PI / 2, 0, 0]} seg={28} />
            </group>
          ))}
          <RB s={[W, 0.03, D]} p={[0, 0.89, 0]} m="counter" r={0.005} />
        </>
      );
    case "sedan": case "suv": {
      const tall = k === "suv";
      const body = it.tone ?? "#3c4a57";
      const L = W, Wd = D;
      const paint = mats.tone(body, 0.25, 0.6);
      return (
        <>
          <mesh geometry={rbox(L, tall ? 0.78 : 0.62, Wd, 0.16)} material={paint} position={[0, tall ? 0.72 : 0.6, 0]} castShadow receiveShadow />
          <mesh geometry={rbox(L * (tall ? 0.62 : 0.5), tall ? 0.62 : 0.5, Wd * 0.88, 0.14)} material={mats.get("carGlass")} position={[-L * 0.04, tall ? 1.38 : 1.12, 0]} castShadow />
          <mesh geometry={rbox(L * (tall ? 0.6 : 0.46), 0.05, Wd * 0.86, 0.02)} material={paint} position={[-L * 0.05, tall ? 1.7 : 1.38, 0]} />
          {[[L * 0.33, 1], [L * 0.33, -1], [-L * 0.32, 1], [-L * 0.32, -1]].map(([x, s], i) => (
            <group key={i} position={[x, 0.34, (s * Wd) / 2 - s * 0.12]}>
              <mesh geometry={cyl(0.34, 0.34, 0.24, 24)} material={mats.get("tire")} rotation={[Math.PI / 2, 0, 0]} castShadow />
              <mesh geometry={cyl(0.22, 0.22, 0.25, 16)} material={mats.get("chrome")} rotation={[Math.PI / 2, 0, 0]} />
            </group>
          ))}
          <RB s={[0.04, 0.08, Wd * 0.7]} p={[L / 2 - 0.01, tall ? 0.8 : 0.66, 0]} m="fixture" r={0.01} />
        </>
      );
    }
    case "bench":
      return (
        <>
          <RB s={[W, 0.05, D]} p={[0, H - 0.025, 0]} m="wood" r={0.01} />
          {legs(W, D, H - 0.05, "metal", 0.08, 0.04)}
        </>
      );
    case "plant":
      return (
        <>
          <Cyl r={0.22} r2={0.17} h={0.45} p={[0, 0.225, 0]} m="pot" />
          <Cyl r={0.025} r2={0.04} h={0.8} p={[0, 0.8, 0]} m="woodDark" seg={8} />
          <Ball r={0.3} p={[0, 1.3, 0]} m="leaf" />
          <Ball r={0.24} p={[0.15, 1.45, 0.08]} m="leaf" />
          <Ball r={0.22} p={[-0.12, 1.42, -0.1]} m="leaf" />
        </>
      );
    case "lounger":
      return (
        <>
          <RB s={[W, 0.08, D - 0.6]} p={[0, 0.3, 0.3]} m="wood" r={0.02} />
          {legs(W, D - 0.6, 0.26, "wood", 0.05, 0.05).map((l, i) => <group key={i} position={[0, 0, 0.3]}>{l}</group>)}
          <RB s={[W - 0.06, 0.08, D - 0.62]} p={[0, 0.38, 0.3]} m="cushion" r={0.03} />
          <RB s={[W - 0.06, 0.08, 0.7]} p={[0, 0.55, -D / 2 + 0.32]} m="cushion" r={0.03} rot={[0.55, 0, 0]} />
        </>
      );
    case "firepit":
      return (
        <>
          <RB s={[W, H - 0.02, D]} p={[0, (H - 0.02) / 2, 0]} m="coping" r={0.02} />
          <RB s={[W * 0.55, 0.04, D * 0.55]} p={[0, H, 0]} m="fire" r={0.02} />
        </>
      );
    case "parasol":
      return (
        <>
          <Cyl r={0.025} h={2.45} p={[0, 1.225, 0]} m="steel" seg={8} />
          <Cyl r={0.25} h={0.06} p={[0, 0.03, 0]} m="metal" />
          <mesh geometry={cyl(0.02, W / 2, 0.5, 10)} material={mats.get("parasol")} position={[0, 2.3, 0]} castShadow />
        </>
      );
    case "grill":
      return (
        <>
          <RB s={[W, 0.86, D]} p={[0, 0.43, 0]} m="steel" r={0.01} />
          <RB s={[W + 0.04, 0.04, D + 0.04]} p={[0, 0.9, 0]} m="counter" r={0.006} />
          <RB s={[0.8, 0.22, 0.5]} p={[-W * 0.18, 1.02, 0]} m="steel" r={0.08} />
        </>
      );
    default:
      return <RB s={[W, H, D]} p={[0, H / 2, 0]} m="wood" />;
  }
}

export const Furniture = memo(function Furniture({ it, children }: { it: Item; children?: ReactNode }) {
  const pos = useMemo(() => [it.x, it.y, it.z] as V3, [it]);
  return (
    <group position={pos} rotation={[0, it.rot, 0]} userData={{ itemId: it.id }}>
      <Body it={it} />
      {children}
    </group>
  );
});
