import { CameraControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { AMENITIES, lotOf } from "../data/community";
import { LEVEL_HEIGHT } from "../data/types";
import { focusOf, frontAzimuth } from "../lib/focus";
import { useStore } from "../store";

/** The landing flyover, a closed loop: down Harbor Boulevard, in through the gate, low along the lane
 *  past the villas, round the turning circle, out over Heron Lake to the skyline, then back up high
 *  over the estate. Each key is [position, look-at]. */
const FLIGHT: [number, number, number][][] = [
  [[-100, 34, -140], [-100, 4, -20]],
  [[-114, 17, -42], [-76, 3, 0]],
  [[-92, 10, 12], [-40, 3, 0]],
  [[-30, 12, 19], [22, 3, -2]],
  [[40, 15, 22], [64, 2, 0]],
  [[84, 30, 22], [60, 50, 300]],
  [[22, 58, 64], [40, 70, 320]],
  [[-64, 84, 36], [4, 0, -16]],
];
const FLIGHT_POS = new THREE.CatmullRomCurve3(FLIGHT.map((k) => new THREE.Vector3(...k[0])), true, "centripetal");
const FLIGHT_AT = new THREE.CatmullRomCurve3(FLIGHT.map((k) => new THREE.Vector3(...k[1])), true, "centripetal");
const FLIGHT_SECONDS = 96;

const sph = (target: THREE.Vector3, dist: number, polar: number, az: number) =>
  new THREE.Vector3(
    target.x + dist * Math.sin(polar) * Math.sin(az),
    target.y + dist * Math.cos(polar),
    target.z + dist * Math.sin(polar) * Math.cos(az),
  );

export function CameraRig({ panel }: { panel: { right: number; bottom: number } }) {
  const ref = useRef<CameraControls>(null);
  const { camera, size } = useThree();
  const setFrameloop = useThree((s) => s.setFrameloop);
  const heroVisible = useStore((s) => s.heroVisible);
  const flight = useRef(0.08);
  const layout = useStore((s) => s.layout);
  const villaId = useStore((s) => s.villaId);
  const mode = useStore((s) => s.mode);
  const level = useStore((s) => s.level);
  const picked = useStore((s) => s.picked);
  const focusRoom = useStore((s) => s.focusRoom);
  const place = useStore((s) => s.place);
  const offset = useRef({ x: 0, y: 0 });

  // Shift the projection so the scene centres in the part of the screen the panels leave free.
  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const tx = panel.right / 2;
    // The tall landing lens has sky to spare; lower the window so the estate fills more of it.
    const tall = layout === "landing" && size.width / Math.max(1, size.height) < 1.2;
    const ty = panel.bottom / 2 + (tall ? size.height * 0.16 : 0);
    const k = Math.min(1, dt * 4);
    offset.current.x += (tx - offset.current.x) * k;
    offset.current.y += (ty - offset.current.y) * k;
    if (Math.abs(offset.current.x) < 0.5 && Math.abs(offset.current.y) < 0.5) {
      if (cam.view) cam.clearViewOffset();
    } else {
      cam.setViewOffset(size.width, size.height, offset.current.x, offset.current.y, size.width, size.height);
    }
  });

  // Framing distances are tuned for landscape; tall, narrow free areas need the camera further back.
  const freeAspect = Math.max(0.3, (size.width - panel.right) / Math.max(1, size.height - panel.bottom));
  const fit = Math.max(1, 1.35 / freeAspect);
  // A villa has to fit inside the unobstructed part of the frame. The view offset shifts the picture
  // but keeps the full-canvas field of view, so measure what's left in fov units on each axis.
  const spanH = (size.width / Math.max(1, size.height)) * ((size.width - panel.right) / Math.max(1, size.width));
  const spanV = (size.height - panel.bottom) / Math.max(1, size.height);
  const villaFit = Math.max(1, 0.95 / Math.max(0.2, Math.min(spanH, spanV)));

  // Nothing to draw while the landing hero is scrolled out of view.
  useEffect(() => {
    setFrameloop(layout === "landing" && !heroVisible ? "never" : "always");
  }, [layout, heroVisible, setFrameloop]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.smoothTime = 0.55;
    if (layout === "landing") { c.enabled = false; return; }
    if (mode === "walk" && villaId) { c.enabled = false; return; }
    c.enabled = true;
    const target = new THREE.Vector3();
    if (villaId) {
      const lot = lotOf(villaId);
      const f = focusOf(lot);
      const y = level * LEVEL_HEIGHT;
      target.set(f.center.x, y, f.center.z);
      let dist = Math.max(26, f.radius * 2.3) * villaFit;
      if (focusRoom) {
        const r = lot.villa.rooms.find((x) => x.id === focusRoom);
        if (r) {
          const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
          const w = lot.rotY === 0 ? [lot.pos[0] + cx, lot.pos[2] + cz] : [lot.pos[0] - cx, lot.pos[2] - cz];
          target.set(w[0], r.level * LEVEL_HEIGHT, w[1]);
          dist = Math.max(9, Math.hypot(r.x1 - r.x0, r.z1 - r.z0) * 1.6) * villaFit;
        }
      }
      const az = frontAzimuth(lot);
      if (mode === "plan") {
        c.minPolarAngle = 0; c.maxPolarAngle = 0.35;
        c.minDistance = 8; c.maxDistance = 90 * villaFit;
        c.setLookAt(...sph(target, dist * 1.3, 0.0001, az).toArray(), ...target.toArray(), true);
      } else {
        c.minPolarAngle = 0.05; c.maxPolarAngle = 1.35;
        c.minDistance = 6; c.maxDistance = 110 * villaFit;
        c.setLookAt(...sph(target, dist, 0.88, az + 0.55).toArray(), ...target.toArray(), true);
      }
      return;
    }
    c.minPolarAngle = 0.15; c.maxPolarAngle = 1.38;
    c.minDistance = 14; c.maxDistance = 420 * fit;
    const am = place ? AMENITIES.find((a) => a.id === place) : null;
    if (am && !picked) {
      target.set(am.x, 0, am.z);
      const away = Math.atan2(am.x, am.z);
      c.setLookAt(...sph(target, (am.id === "golf" || am.id === "lake" ? 120 : 55) * fit, 0.95, away + Math.PI + 0.4).toArray(), ...target.toArray(), true);
      return;
    }
    const id = picked;
    if (id) {
      const lot = lotOf(id);
      const f = focusOf(lot);
      target.copy(f.center);
      c.setLookAt(...sph(target, 46 * fit, 0.95, frontAzimuth(lot) + 0.6).toArray(), ...target.toArray(), true);
      return;
    }
    // From the north-west: the lots in front, Heron Lake beyond them and the skyline across the water.
    target.set(10, 0, 40);
    c.setLookAt(...sph(target, 175 * fit, 1.1, Math.PI + 0.55).toArray(), ...target.toArray(), true);
  }, [layout, villaId, mode, level, picked, focusRoom, place, fit, villaFit]);

  // Landing flyover. Tall screens pull back along the look direction so the lane stays in frame.
  useFrame((_, dt) => {
    const c = ref.current;
    const st = useStore.getState();
    if (!c || st.layout !== "landing" || st.still) return;
    flight.current = (flight.current + Math.min(dt, 0.1) / FLIGHT_SECONDS) % 1;
    const at = FLIGHT_AT.getPointAt(flight.current);
    const pos = FLIGHT_POS.getPointAt(flight.current);
    c.setLookAt(pos.x, pos.y, pos.z, at.x, at.y, at.z, false);
  });

  // On tall screens the flyover keeps its landscape width by opening the vertical field of view,
  // rather than pulling back into the towers around the estate.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const base = 38;
    const want = layout === "landing" && aspect < 1.2
      ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base / 2)) * (1.33 / aspect)))
      : base;
    const walking = cam.fov === 68; // the Walker owns the lens while it is mounted
    if (layout !== "landing" && walking) return;
    cam.fov = Math.min(80, want);
    cam.updateProjectionMatrix();
  }, [layout, size, camera]);

  // Hooks for scripts/stills.mjs.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const c = ref.current;
    if (!c) return;
    Object.assign(window, {
      __frameAt: (p: [number, number, number], t: [number, number, number]) => c.setLookAt(...p, ...t, false),
      __frameVilla: (id: string, o: { dist?: number; polar?: number; az?: number; y?: number } = {}) => {
        const lot = lotOf(id);
        const f = focusOf(lot);
        const t = f.center.clone().setY(o.y ?? 2.4);
        const p = sph(t, (o.dist ?? 2.5) * f.radius, o.polar ?? 1.28, frontAzimuth(lot) + (o.az ?? 0.5));
        return c.setLookAt(...p.toArray(), ...t.toArray(), false);
      },
    });
  }, []);

  return <CameraControls ref={ref} makeDefault dollySpeed={0.6} truckSpeed={1.2} />;
}
