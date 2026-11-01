import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { LOTS, lotOf, toWorld, type Lot } from "../data/community";
import { LEVEL_HEIGHT, type Room } from "../data/types";
import { focusOf } from "../lib/focus";
import { area, dims, len, price, small } from "../lib/units";
import { useStore } from "../store";

export const SURVEY = "#1fb6cf";

/* ---------- glass highlight around a building ---------- */

const shellVert = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const shellFrag = /* glsl */ `
uniform vec3 uColor; uniform float uTime; uniform float uH; uniform float uAlpha;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() {
  float fres = pow(1.0 - abs(dot(vN, vV)), 2.0);
  float y = (vP.y + 0.5);
  float floors = smoothstep(0.035, 0.0, abs(fract(y * uH / 3.2) - 0.5) - 0.47);
  float sweep = smoothstep(0.08, 0.0, abs(fract(uTime * 0.25) - y)) * 0.9;
  float grid = smoothstep(0.02, 0.0, abs(fract((vP.x + vP.z) * 6.0) - 0.5) - 0.48) * 0.25;
  float a = (0.10 + fres * 0.55 + floors * 0.35 + sweep * 0.5 + grid * 0.2) * uAlpha;
  gl_FragColor = vec4(uColor * (1.0 + sweep), a);
}`;

export function Shell({ lot, strength }: { lot: Lot; strength: number }) {
  const f = useMemo(() => focusOf(lot), [lot]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: shellVert, fragmentShader: shellFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(SURVEY) }, uTime: { value: 0 }, uH: { value: f.height }, uAlpha: { value: 0 } },
  }), [f.height]);
  useFrame(({ clock }, dt) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uAlpha.value += (strength - mat.uniforms.uAlpha.value) * Math.min(1, dt * 6);
  });
  const w = f.rect.x1 - f.rect.x0 + 0.6, d = f.rect.z1 - f.rect.z0 + 0.6;
  return (
    <mesh position={[f.center.x, f.height / 2, f.center.z]} scale={[w, f.height, d]} material={mat} renderOrder={5} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}

/* ---------- price pins over each home ---------- */

export function Pins() {
  const picked = useStore((s) => s.picked);
  const hover = useStore((s) => s.hoverVilla);
  const set = useStore((s) => s.set);
  return (
    <>
      {LOTS.map((lot) => {
        const f = focusOf(lot);
        const v = lot.villa;
        const on = picked === v.id || hover === v.id;
        return (
          <Html key={v.id} position={[f.center.x, f.height + 3.2, f.center.z]} center zIndexRange={[9, 2]}>
            <button
              type="button"
              className={`pin ${on ? "pin-on" : ""} ${v.status !== "Available" ? "pin-muted" : ""}`}
              onClick={(e) => { e.stopPropagation(); useStore.getState().enterVilla(v.id); }}
              onPointerEnter={() => set({ hoverVilla: v.id })}
              onPointerLeave={() => set({ hoverVilla: null })}
            >
              <span className={`pin-dot pin-${v.status.toLowerCase()}`} />
              <span className="pin-price">{price(v.price)}</span>
              <span className="pin-name">{v.name}</span>
            </button>
          </Html>
        );
      })}
    </>
  );
}

/* ---------- dimension lines ---------- */

type P3 = [number, number, number];

export function DimLine({ a, b, label, color = SURVEY, tick = 0.25, normal = [0, 1, 0] as P3 }: { a: P3; b: P3; label: string; color?: string; tick?: number; normal?: P3 }) {
  const n = new THREE.Vector3(...normal).multiplyScalar(tick);
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  return (
    <group>
      <Line points={[a, b]} color={color} lineWidth={2} depthTest={false} renderOrder={10} />
      <Line points={[A.clone().sub(n).toArray(), A.clone().add(n).toArray()]} color={color} lineWidth={2} depthTest={false} renderOrder={10} />
      <Line points={[B.clone().sub(n).toArray(), B.clone().add(n).toArray()]} color={color} lineWidth={2} depthTest={false} renderOrder={10} />
      <Html position={mid.toArray()} center zIndexRange={[9, 2]} style={{ pointerEvents: "none" }}>
        <span className="dim-label">{label}</span>
      </Html>
    </group>
  );
}

const W3 = (lot: Lot, x: number, y: number, z: number): P3 => { const [wx, wz] = toWorld(lot, x, z); return [wx, y, wz]; };

/** Room names, sizes and areas, plus overall dimensions, for the plan view. */
export function PlanLabels({ villaId }: { villaId: string }) {
  const lot = lotOf(villaId);
  const level = useStore((s) => s.level);
  const units = useStore((s) => s.units);
  const sel = useStore((s) => s.selection);
  const set = useStore((s) => s.set);
  const v = lot.villa;
  const y = level * LEVEL_HEIGHT + 0.05;
  const rooms = v.rooms.filter((r) => r.level === level && r.type !== "garden");
  const ind = rooms.filter((r) => !r.outdoor);
  const x0 = Math.min(...ind.map((r) => r.x0)), x1 = Math.max(...ind.map((r) => r.x1));
  const z0 = Math.min(...ind.map((r) => r.z0)), z1 = Math.max(...ind.map((r) => r.z1));
  const selRoom = sel?.type === "room" && sel.villaId === villaId ? v.rooms.find((r) => r.id === sel.roomId) : null;
  const itemRoom = sel?.type === "item" && sel.villaId === villaId ? v.items.find((i) => i.id === sel.itemId)?.room : null;
  return (
    <group>
      {rooms.map((r) => {
        const w = r.x1 - r.x0, d = r.z1 - r.z0;
        const small_ = w * d < 7;
        return (
          <Html key={r.id} position={W3(lot, (r.x0 + r.x1) / 2, y + 0.2, (r.z0 + r.z1) / 2)} center zIndexRange={[8, 1]}>
            <button
              type="button"
              className={`room-tag ${r.outdoor ? "room-out" : ""} ${small_ ? "room-small" : ""} ${selRoom?.id === r.id ? "room-on" : ""} ${itemRoom === r.id ? "room-faded" : ""}`}
              onClick={(e) => { e.stopPropagation(); set({ selection: { type: "room", villaId, roomId: r.id } }); }}
            >
              <span className="room-name">{r.name}</span>
              {!small_ && <span className="room-dim">{dims(w, d, units)}</span>}
              <span className="room-area">{area(w * d, units)}</span>
            </button>
          </Html>
        );
      })}
      <DimLine a={W3(lot, x0, y, z0 - 1.6)} b={W3(lot, x1, y, z0 - 1.6)} label={len(x1 - x0, units)} normal={[0, 0, 1]} />
      <DimLine a={W3(lot, x0 - 1.6, y, z0)} b={W3(lot, x0 - 1.6, y, z1)} label={len(z1 - z0, units)} normal={[1, 0, 0]} />
      {selRoom && <RoomDims lot={lot} r={selRoom} />}
    </group>
  );
}

function RoomDims({ lot, r }: { lot: Lot; r: Room }) {
  const units = useStore((s) => s.units);
  const y = r.level * LEVEL_HEIGHT + 0.08;
  const pts: P3[] = [W3(lot, r.x0, y, r.z0), W3(lot, r.x1, y, r.z0), W3(lot, r.x1, y, r.z1), W3(lot, r.x0, y, r.z1), W3(lot, r.x0, y, r.z0)];
  return (
    <group>
      <Line points={pts} color={SURVEY} lineWidth={3} depthTest={false} renderOrder={9} />
      <DimLine a={W3(lot, r.x0, y, r.z0 + 0.45)} b={W3(lot, r.x1, y, r.z0 + 0.45)} label={len(r.x1 - r.x0, units)} normal={[0, 0, 1]} tick={0.15} />
      <DimLine a={W3(lot, r.x0 + 0.45, y, r.z0)} b={W3(lot, r.x0 + 0.45, y, r.z1)} label={len(r.z1 - r.z0, units)} normal={[1, 0, 0]} tick={0.15} />
    </group>
  );
}

/** Wireframe box and width / depth / height callouts on the selected piece of furniture. */
export function ItemDims() {
  const sel = useStore((s) => s.selection);
  const units = useStore((s) => s.units);
  const mode = useStore((s) => s.mode);
  const pulse = useRef<THREE.Group>(null);
  if (sel?.type !== "item") return null;
  const lot = lotOf(sel.villaId);
  const it = lot.villa.items.find((i) => i.id === sel.itemId);
  if (!it) return null;
  const [W, D, H] = it.size;
  const m = new THREE.Matrix4().makeRotationY(lot.rotY).setPosition(...lot.pos)
    .multiply(new THREE.Matrix4().makeRotationY(it.rot).setPosition(it.x, it.y, it.z));
  const P = (x: number, y: number, z: number): P3 => new THREE.Vector3(x, y, z).applyMatrix4(m).toArray() as P3;
  const hw = W / 2, hd = D / 2;
  const c = [P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), P(-hw, H, -hd), P(hw, H, -hd), P(hw, H, hd), P(-hw, H, hd)];
  const edges: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const off = 0.18;
  return (
    <group ref={pulse}>
      {edges.map(([a, b], i) => <Line key={i} points={[c[a], c[b]]} color={SURVEY} lineWidth={1.5} dashed dashSize={0.08} gapSize={0.05} depthTest={false} renderOrder={9} />)}
      <DimLine a={P(-hw, 0.02, hd + off)} b={P(hw, 0.02, hd + off)} label={`W ${small(W, units)}`} tick={0.08} />
      <DimLine a={P(hw + off, 0.02, -hd)} b={P(hw + off, 0.02, hd)} label={`D ${small(D, units)}`} tick={0.08} />
      {/* From straight above a vertical line collapses to a point, so the height sits on the far corner. */}
      {H > 0.05 && (mode === "plan"
        ? <DimLine a={P(-hw - off, H, -hd - off)} b={P(-hw - off, H, -hd - off - 0.001)} label={`H ${small(H, units)}`} tick={0} />
        : <DimLine a={P(hw + off, 0, hd + off)} b={P(hw + off, H, hd + off)} label={`H ${small(H, units)}`} tick={0.08} normal={[1, 0, 0]} />)}
    </group>
  );
}
