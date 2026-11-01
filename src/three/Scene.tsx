import { AdaptiveEvents, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { LOTS, lotOf, type Lot } from "../data/community";
import { LEVEL_HEIGHT } from "../data/types";
import { focusOf } from "../lib/focus";
import { planOf } from "../lib/plan";
import { useStore } from "../store";
import { Atmosphere } from "./Atmosphere";
import { CameraRig } from "./CameraRig";
import { City } from "./City";
import { Community } from "./Community";
import { ItemDims, Pins, PlanLabels, Shell } from "./Overlays";
import { Villa } from "./Villa";
import { setWalkGoal, Walker } from "./Walker";

function Villas() {
  const villaId = useStore((s) => s.villaId);
  const mode = useStore((s) => s.mode);
  const level = useStore((s) => s.level);

  const pick = useCallback((lot: Lot) => (e: ThreeEvent<MouseEvent>, local: THREE.Vector3, info: { itemId?: string; doorId?: string }) => {
    const s = useStore.getState();
    const v = lot.villa;
    if (!s.villaId) { s.enterVilla(v.id); return; }
    if (s.villaId !== v.id) return;
    const lvl = Math.max(0, Math.min(v.levels - 1, Math.floor((local.y + 0.6) / LEVEL_HEIGHT)));
    const plan = planOf(v);
    if (s.mode === "walk") {
      if (info.doorId) { s.toggleDoor(info.doorId); return; }
      const n = e.face?.normal;
      if (n && Math.abs(n.y) > 0.6) setWalkGoal(local.x, local.z, lvl);
      return;
    }
    if (info.doorId && s.mode === "lights") { s.toggleDoor(info.doorId); return; }
    if (s.mode === "plan") {
      if (info.itemId) { s.set({ selection: { type: "item", villaId: v.id, itemId: info.itemId } }); return; }
      const room = plan.roomAt(Math.min(lvl, s.level), local.x, local.z);
      s.set({ selection: room ? { type: "room", villaId: v.id, roomId: room.id } : null });
      return;
    }
    const room = plan.roomAt(Math.min(lvl, s.level), local.x, local.z) ?? v.rooms.find((r) => r.level === 0 && local.x >= r.x0 && local.x <= r.x1 && local.z >= r.z0 && local.z <= r.z1);
    if (room) s.toggleLight(v.id, room.id);
  }, []);
  const picks = useMemo(() => Object.fromEntries(LOTS.map((l) => [l.villa.id, pick(l)])), [pick]);
  const hovers = useMemo(() => Object.fromEntries(LOTS.map((l) => [l.villa.id, (over: boolean) => {
    const s = useStore.getState();
    if (s.villaId) return;
    s.set({ hoverVilla: over ? l.villa.id : s.hoverVilla === l.villa.id ? null : s.hoverVilla });
    document.body.style.cursor = over ? "pointer" : "";
  }])), []);

  return (
    <>
      {LOTS.map((lot) => {
        const active = lot.villa.id === villaId;
        const walk = active && mode === "walk";
        return (
          <Villa
            key={lot.villa.id}
            lot={lot}
            active={active}
            maxLevel={active && !walk ? level : 9}
            roof={!active || walk}
            ceilings={walk}
            furniture={active}
            onPick={picks[lot.villa.id]}
            onHover={villaId ? undefined : hovers[lot.villa.id]}
          />
        );
      })}
    </>
  );
}

function Highlights() {
  const villaId = useStore((s) => s.villaId);
  const hover = useStore((s) => s.hoverVilla);
  const picked = useStore((s) => s.picked);
  if (villaId) return null;
  return <>{LOTS.map((lot) => <Shell key={lot.villa.id} lot={lot} strength={picked === lot.villa.id ? 1 : hover === lot.villa.id ? 0.7 : 0} />)}</>;
}

/** A light grade pulls the palette toward photography: less saturation, a touch more contrast, soft edges. */
function Effects({ quality }: { quality: number }) {
  return (
    <EffectComposer multisampling={quality > 0.6 ? 4 : 0} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.75} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <HueSaturation saturation={-0.14} />
      <BrightnessContrast contrast={0.06} />
      <Vignette offset={0.32} darkness={0.42} />
    </EffectComposer>
  );
}

/** Dev-only: aim the orbit camera directly, for the photo source renders. */
function DevView() {
  const controls = useThree((s) => s.controls) as unknown as { setLookAt: (...a: (number | boolean)[]) => void } | null;
  useEffect(() => {
    if (!import.meta.env.DEV || !controls) return;
    Object.assign(window, { __view: (p: number[], t: number[]) => controls.setLookAt(p[0], p[1], p[2], t[0], t[1], t[2], false) });
  }, [controls]);
  return null;
}

/** A deep near plane keeps distant coplanar surfaces from shimmering; walking needs it close. */
function NearPlane({ walk }: { walk: boolean }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.near = walk ? 0.08 : 0.8;
    camera.far = walk ? 1800 : 3200;
    camera.updateProjectionMatrix();
  }, [camera, walk]);
  return null;
}

export function Scene({ panel }: { panel: { right: number; bottom: number } }) {
  const villaId = useStore((s) => s.villaId);
  const layout = useStore((s) => s.layout);
  const mode = useStore((s) => s.mode);
  const set = useStore((s) => s.set);
  const [dpr, setDpr] = useState(Math.min(2, window.devicePixelRatio || 1));
  const [quality, setQuality] = useState(1);

  const focus = useMemo<{ c: [number, number, number]; r: number }>(() => {
    if (!villaId) return { c: [6, 0, 0], r: 120 };
    const f = focusOf(lotOf(villaId));
    return { c: [f.center.x, 0, f.center.z], r: Math.max(26, f.radius * 1.6) };
  }, [villaId]);

  const onObject = useCallback((o: { kind: string; label: string; specs: [string, string][]; point: [number, number, number] }) => {
    const s = useStore.getState();
    if (s.villaId) return;
    s.set({ selection: { type: "object", ...o } });
  }, []);

  return (
    <Canvas
      shadows
      flat
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 38, near: 0.8, far: 3200, position: [120, 90, 120] }}
      onPointerMissed={() => set({ selection: null })}
    >
      <PerformanceMonitor
        bounds={() => [42, 58]}
        flipflops={3}
        onDecline={() => { setDpr((d) => Math.max(1, d - 0.25)); setQuality((q) => Math.max(0.2, q - 0.3)); }}
        onIncline={() => { setDpr((d) => Math.min(Math.min(2, window.devicePixelRatio || 1), d + 0.25)); setQuality((q) => Math.min(1, q + 0.2)); }}
      />
      <AdaptiveEvents />
      <Suspense fallback={null}>
        <Atmosphere focus={focus.c} radius={focus.r} />
        <NearPlane walk={!!villaId && mode === "walk"} />
        <DevView />
        <City />
        <Community onPickObject={onObject} />
        <Villas />
        <Highlights />
        {!villaId && layout === "explore" && !useStore.getState().still && <Pins />}
        {villaId && mode === "plan" && <PlanLabels villaId={villaId} />}
        {villaId && mode !== "walk" && <ItemDims />}
        {villaId && mode === "walk" && <Walker villaId={villaId} />}
        <CameraRig panel={panel} />
        <Effects quality={quality} />
      </Suspense>
    </Canvas>
  );
}
