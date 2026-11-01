import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Lot } from "../data/community";
import { LEVEL_HEIGHT } from "../data/types";
import { villaMaterials, type VillaMats } from "../lib/materials";
import { isDrag } from "../lib/tap";
import { villaGeo, type DoorLeaf } from "../lib/villaGeo";
import { useStore } from "../store";
import { Furniture } from "./Furniture";
import { MatsContext } from "./matsContext";

const matsCache = new Map<string, VillaMats>();
export function matsFor(lot: Lot) {
  let m = matsCache.get(lot.villa.id);
  if (!m) { m = villaMaterials(lot.villa); matsCache.set(lot.villa.id, m); }
  return m;
}

const ZSCALE = { day: 0.22, dusk: 1, night: 1.15 };

function Parts({ parts, mats, shadows = true }: { parts: Map<string, THREE.BufferGeometry>; mats: VillaMats; shadows?: boolean }) {
  return (
    <>
      {[...parts].map(([k, g]) => (
        <mesh key={k} geometry={g} material={mats.get(k)} castShadow={shadows && k !== "ceiling" && k !== "rail" && k !== "water"} receiveShadow />
      ))}
    </>
  );
}

function Door({ d, mats }: { d: DoorLeaf; mats: VillaMats }) {
  const g = useRef<THREE.Group>(null);
  const amt = useRef(0);
  useFrame((_, dt) => {
    const open = useStore.getState().doors[d.id] ? 1 : 0;
    amt.current += (open - amt.current) * Math.min(1, dt * 5);
    const a = amt.current;
    if (!g.current) return;
    if (d.kind === "swing") {
      const sign = d.axis === "x" ? -d.swing * d.dir : d.swing * d.dir;
      g.current.rotation.y = (d.axis === "x" ? 0 : -Math.PI / 2) + sign * a * (95 * Math.PI / 180);
    } else if (d.kind === "slide") {
      g.current.position.set(d.x, d.y, d.z);
      const off = d.dir * d.width * 0.94 * a;
      if (d.axis === "x") g.current.position.x = d.x + off; else g.current.position.z = d.z + off;
    } else {
      g.current.scale.y = 1 - a * 0.92;
    }
  });
  const ud = { doorId: d.id };
  if (d.kind === "roll") {
    const out = 0.17;
    return (
      <group ref={g} position={[d.x, d.y + d.height, d.z]} rotation={[0, d.axis === "x" ? 0 : -Math.PI / 2, 0]}>
        <mesh position={[0, -d.height / 2, -out]} material={mats.get(d.mat)} userData={ud} castShadow receiveShadow>
          <boxGeometry args={[d.width, d.height, 0.05]} />
        </mesh>
        {[0.2, 0.4, 0.6, 0.8].map((t) => (
          <mesh key={t} position={[0, -d.height * t, -out - 0.026]} material={mats.get("trim")} userData={ud}>
            <boxGeometry args={[d.width - 0.02, 0.012, 0.004]} />
          </mesh>
        ))}
      </group>
    );
  }
  if (d.kind === "slide") {
    const w = d.width, h = d.height;
    return (
      <group ref={g} position={[d.x, d.y, d.z]} rotation={[0, d.axis === "x" ? 0 : -Math.PI / 2, 0]}>
        <group position={[(d.dir * w) / 2, h / 2, 0.035]}>
          <mesh material={mats.get("glass")} userData={ud}><boxGeometry args={[w - 0.08, h - 0.08, 0.012]} /></mesh>
          {[[0, h / 2 - 0.02, w, 0.04], [0, -h / 2 + 0.02, w, 0.04]].map(([x, y, sw, sh], i) => (
            <mesh key={i} position={[x, y, 0]} material={mats.get("frame")} userData={ud}><boxGeometry args={[sw, sh, 0.045]} /></mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[(s * w) / 2 - s * 0.02, 0, 0]} material={mats.get("frame")} userData={ud}><boxGeometry args={[0.04, h, 0.045]} /></mesh>
          ))}
        </group>
      </group>
    );
  }
  const w = d.width, h = d.height;
  return (
    <group ref={g} position={[d.x, d.y, d.z]} rotation={[0, d.axis === "x" ? 0 : -Math.PI / 2, 0]}>
      <mesh position={[(d.dir * w) / 2, h / 2, 0]} material={mats.get(d.mat)} userData={ud} castShadow receiveShadow>
        <boxGeometry args={[w - 0.01, h - 0.01, 0.045]} />
      </mesh>
      <mesh position={[d.dir * (w - 0.08), h * 0.47, 0.04]} material={mats.get("chrome")} userData={ud}>
        <boxGeometry args={[0.12, 0.02, 0.02]} />
      </mesh>
      <mesh position={[d.dir * (w - 0.08), h * 0.47, -0.04]} material={mats.get("chrome")} userData={ud}>
        <boxGeometry args={[0.12, 0.02, 0.02]} />
      </mesh>
    </group>
  );
}

export interface VillaProps {
  lot: Lot;
  active: boolean;
  /** Highest level drawn; Infinity draws everything. */
  maxLevel: number;
  roof: boolean;
  ceilings: boolean;
  furniture: boolean;
  onPick?: (e: ThreeEvent<MouseEvent>, local: THREE.Vector3, info: { itemId?: string; doorId?: string }) => void;
  onHover?: (over: boolean) => void;
}

export const Villa = memo(function Villa({ lot, active, maxLevel, roof, ceilings, furniture, onPick, onHover }: VillaProps) {
  const v = lot.villa;
  const geo = useMemo(() => villaGeo(v), [v]);
  const mats = matsFor(lot);
  const group = useRef<THREE.Group>(null);
  const cur = useRef<number[]>(mats.zoneIds.map(() => 0));
  const inv = useMemo(() => new THREE.Matrix4(), []);

  useLayoutEffect(() => {
    if (!group.current) return;
    group.current.updateWorldMatrix(true, false);
    inv.copy(group.current.matrixWorld).invert();
    mats.U.zInv.value.copy(inv);
  }, [mats, inv]);

  useFrame((_, dt) => {
    const st = useStore.getState();
    const lights = st.lights[v.id] ?? {};
    const k = Math.min(1, dt * 6);
    mats.zoneIds.forEach((z, i) => {
      const t = lights[z] ? 1 : 0;
      cur.current[i] += (t - cur.current[i]) * k;
      mats.U.zInfo.value[i].z = cur.current[i] < 0.002 ? 0 : cur.current[i];
    });
    // At eye level under a ceiling the same fixtures read brighter than from above, so walk-through runs them softer.
    const target = ZSCALE[st.time] * (ceilings ? 0.6 : 1);
    mats.U.zScale.value += (target - mats.U.zScale.value) * Math.min(1, dt * 3);
  });

  const handle = (e: ThreeEvent<MouseEvent>) => {
    if (!onPick) return;
    e.stopPropagation();
    if (isDrag(e)) return;
    let o: THREE.Object3D | null = e.object;
    let itemId: string | undefined, doorId: string | undefined;
    while (o && o !== group.current) {
      if (o.userData.itemId) itemId = o.userData.itemId;
      if (o.userData.doorId) doorId = o.userData.doorId;
      o = o.parent;
    }
    const local = e.point.clone().applyMatrix4(inv);
    onPick(e, local, { itemId, doorId });
  };

  const levels = geo.levels.map((p, i) => ({ p, i })).filter(({ i }) => i <= maxLevel);
  const items = furniture ? v.items.filter((it) => it.level <= maxLevel) : [];

  return (
    <group
      ref={group}
      position={lot.pos}
      rotation={[0, lot.rotY, 0]}
      onClick={handle}
      onPointerOver={onHover ? (e) => { e.stopPropagation(); onHover(true); } : undefined}
      onPointerOut={onHover ? () => onHover(false) : undefined}
    >
      <MatsContext.Provider value={mats}>
        {levels.map(({ p, i }) => <Parts key={`l${i}`} parts={p} mats={mats} />)}
        {levels.map(({ i }) => <mesh key={`g${i}`} geometry={geo.glass[i]} material={mats.get("glass")} renderOrder={2} />)}
        {ceilings && geo.ceilings.map((p, i) => i <= maxLevel && <Parts key={`c${i}`} parts={p} mats={mats} shadows={false} />)}
        {roof && <Parts parts={geo.roofs} mats={mats} />}
        <Parts parts={geo.site} mats={mats} />
        {geo.doors.filter((d) => Math.round(d.y / LEVEL_HEIGHT) <= maxLevel).map((d) => <Door key={d.id} d={d} mats={mats} />)}
        {items.map((it) => <Furniture key={it.id} it={it} />)}
        {active && null}
      </MatsContext.Provider>
    </group>
  );
});

export { matsCache };
