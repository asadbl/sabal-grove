import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { lotOf } from "../data/community";
import { LEVEL_HEIGHT } from "../data/types";
import { villaGeo } from "../lib/villaGeo";
import { useStore } from "../store";

/** Held directions from the on-screen pad and the keyboard. */
export const walkInput = { f: 0, b: 0, l: 0, r: 0 };
/** Tap-to-walk goal, villa-local. */
export const walkGoal: { x: number; z: number; level: number } | { x: null } = { x: null };

export function setWalkGoal(x: number, z: number, level: number) {
  Object.assign(walkGoal, { x, z, level });
}

const EYE = 1.62, R = 0.24;

export function Walker({ villaId }: { villaId: string }) {
  const lot = lotOf(villaId);
  const geo = useMemo(() => villaGeo(lot.villa), [lot]);
  const plan = geo.plan;
  const { camera, gl } = useThree();
  const st = useRef({ x: 0, z: 0, y: 0, yaw: 0, pitch: -0.05, level: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastRoom = useRef<string | null>(null);
  const lastPose = useRef(0);

  // Start a few steps outside the front door, which swings open to invite you in.
  useEffect(() => {
    const v = lot.villa;
    const door = v.openings.find((o) => o.level === 0 && o.axis === "x" && o.c === 0 && (o.kind === "double" || o.kind === "door") && !o.rooms[1]);
    const porch = v.rooms.find((r) => r.id === "porch");
    const z = (porch ? porch.z0 : 0) - 3.2;
    st.current = { x: door?.at ?? 6, z, y: 0, yaw: 0, pitch: -0.02, level: 0 };
    const leaf = door && geo.doors.find((d) => d.id === door.id || d.id === door.id + ":l");
    const t = leaf && setTimeout(() => {
      const ids = leaf.id.endsWith(":l") ? [leaf.id, leaf.id.replace(/:l$/, ":r")] : [leaf.id];
      useStore.setState((s) => ({ doors: { ...s.doors, ...Object.fromEntries(ids.map((i) => [i, true])) } }));
    }, 700);
    Object.assign(walkGoal, { x: null });
    const cam = camera as THREE.PerspectiveCamera;
    const prevFov = cam.fov;
    cam.fov = 68; cam.updateProjectionMatrix();
    return () => { if (t) clearTimeout(t); cam.fov = prevFov; cam.updateProjectionMatrix(); };
  }, [lot, camera, geo]);

  // Dev-only: place the eye exactly, for the photo source renders.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.assign(window, {
      __walkSet: (x: number, z: number, yaw: number, pitch = -0.04, level = 0) => {
        Object.assign(st.current, { x, z, yaw, pitch, level, y: plan.levelBase(level) });
        Object.assign(walkGoal, { x: null });
      },
    });
  }, [plan]);

  // Drag to look.
  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      st.current.yaw += dx * 0.0042;
      st.current.pitch = THREE.MathUtils.clamp(st.current.pitch - dy * 0.0035, -1.1, 0.9);
      d.x = e.clientX; d.y = e.clientY;
    };
    const up = () => { drag.current = null; };
    const key = (e: KeyboardEvent, v: number) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") walkInput.f = v;
      if (k === "s" || k === "arrowdown") walkInput.b = v;
      if (k === "a" || k === "arrowleft") walkInput.l = v;
      if (k === "d" || k === "arrowright") walkInput.r = v;
    };
    const kd = (e: KeyboardEvent) => key(e, 1), ku = (e: KeyboardEvent) => key(e, 0);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      Object.assign(walkInput, { f: 0, b: 0, l: 0, r: 0 });
    };
  }, [gl]);

  const blocked = (x: number, z: number, level: number) => {
    const v = lot.villa;
    const b = v.bounds;
    if (x < b.x0 - 3 || x > b.x1 + 3 || z < -8 || z > b.z1 + 2) return true;
    if (level > 0 && !plan.roomAt(level, x, z) && !v.stairs.some((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1)) return true;
    const doors = useStore.getState().doors;
    for (const s of geo.solids) {
      if (s.level !== level) continue;
      if (x + R > s.x0 && x - R < s.x1 && z + R > s.z0 && z - R < s.z1) return true;
    }
    for (const d of geo.doors) {
      if (doors[d.id] || Math.round(d.y / LEVEL_HEIGHT) !== level) continue;
      const o = d.opening;
      const a = o.at - o.width / 2, e = o.at + o.width / 2;
      const r = o.axis === "x" ? { x0: a, x1: e, z0: o.c - 0.08, z1: o.c + 0.08 } : { x0: o.c - 0.08, x1: o.c + 0.08, z0: a, z1: e };
      if (x + R > r.x0 && x - R < r.x1 && z + R > r.z0 && z - R < r.z1) return true;
    }
    return false;
  };

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    const turn = walkInput.r - walkInput.l;
    s.yaw -= turn * dt * 1.5;
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    let mx = 0, mz = 0;
    const fwd = walkInput.f - walkInput.b;
    if (fwd) {
      mx = fx * fwd * 1.7 * dt; mz = fz * fwd * 1.7 * dt;
      Object.assign(walkGoal, { x: null });
    } else if (walkGoal.x !== null) {
      const g = walkGoal as { x: number; z: number };
      const dx = g.x - s.x, dz = g.z - s.z, d = Math.hypot(dx, dz);
      if (d < 0.15) Object.assign(walkGoal, { x: null });
      else {
        const want = Math.atan2(dx, dz);
        let diff = want - s.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        s.yaw += diff * Math.min(1, dt * 5);
        const sp = Math.min(d, 2.2 * dt) * (Math.abs(diff) < 0.9 ? 1 : 0.3);
        mx = (dx / d) * sp; mz = (dz / d) * sp;
      }
    }
    // resolve level from the floor under us, including stairs
    const tryLevel = (x: number, z: number) => {
      const onStair = lot.villa.stairs.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
      if (!onStair) return s.level;
      const y = plan.floorAt(0, x, z);
      return y > LEVEL_HEIGHT * 0.5 ? 1 : 0;
    };
    if (mx) { const nx = s.x + mx; if (!blocked(nx, s.z, tryLevel(nx, s.z))) s.x = nx; else Object.assign(walkGoal, { x: null }); }
    if (mz) { const nz = s.z + mz; if (!blocked(s.x, nz, tryLevel(s.x, nz))) s.z = nz; else Object.assign(walkGoal, { x: null }); }
    s.level = tryLevel(s.x, s.z);
    const onStair = lot.villa.stairs.some((q) => s.x > q.x0 && s.x < q.x1 && s.z > q.z0 && s.z < q.z1);
    const floorY = onStair ? plan.floorAt(0, s.x, s.z) : plan.levelBase(s.level);
    s.y += (floorY - s.y) * Math.min(1, dt * 10);

    // villa-local to world
    const c = Math.cos(lot.rotY), sn = Math.sin(lot.rotY);
    const wx = lot.pos[0] + s.x * c + s.z * sn, wz = lot.pos[2] - s.x * sn + s.z * c;
    camera.position.set(wx, s.y + EYE, wz);
    camera.rotation.set(s.pitch, s.yaw + lot.rotY + Math.PI, 0, "YXZ");

    // HUD state, at most ten times a second
    const now = performance.now();
    if (now - lastPose.current > 100) {
      lastPose.current = now;
      const room = plan.roomAt(s.level, s.x, s.z)?.id ?? null;
      const store = useStore.getState();
      let near: string | null = null, best = 2.2;
      for (const d of geo.doors) {
        if (Math.round(d.y / LEVEL_HEIGHT) !== s.level) continue;
        const o = d.opening;
        const ox = o.axis === "x" ? o.at : o.c, oz = o.axis === "x" ? o.c : o.at;
        const dx = ox - s.x, dz = oz - s.z, dist = Math.hypot(dx, dz);
        if (dist < best && (dx * fx + dz * fz) / Math.max(dist, 0.01) > 0.35) { best = dist; near = d.id; }
      }
      const patch: Partial<typeof store> = { walkPose: { x: s.x, z: s.z, yaw: s.yaw, level: s.level } };
      if (room !== lastRoom.current) { lastRoom.current = room; patch.walkRoom = room; }
      if (near !== store.nearDoor) patch.nearDoor = near;
      store.set(patch);
    }
  });

  return null;
}
