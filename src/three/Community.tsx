import { Text } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import fontUrl from "@fontsource/young-serif/files/young-serif-latin-400-normal.woff?url";
import { CITY } from "../data/city";
import { COMMUNITY as C, LOTS, toWorld } from "../data/community";
import { NOISE_GLSL } from "../lib/glsl";
import { textures } from "../lib/materials";
import { site, type WRect } from "../lib/site";
import { isDrag } from "../lib/tap";
import { useStore } from "../store";
import { Vegetation, PLANT_INFO, type Plant } from "./Vegetation";


/** Maps textures in world metres (so every flat tiles at true scale and lines up with its
 *  neighbours), breaks up repetition with world-scale tone variation, and adds optional mowing stripes. */
function groundPatch(m: THREE.MeshStandardMaterial, opts: { stripes?: boolean; amount?: number } = {}) {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;")
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
        vec2 wuv = (modelMatrix * vec4(position, 1.0)).xz * vec2(1.0, -1.0);
        #ifdef USE_MAP
          vMapUv = (mapTransform * vec3(wuv, 1.0)).xy;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = (normalMapTransform * vec3(wuv, 1.0)).xy;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = (roughnessMapTransform * vec3(wuv, 1.0)).xy;
        #endif`,
      );
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vWP;\n${NOISE_GLSL}`)
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float gn = fbm2(vWP.xz * 0.035);
        diffuseColor.rgb *= mix(${(1 - (opts.amount ?? 0.22)).toFixed(2)}, ${(1 + (opts.amount ?? 0.22) * 0.5).toFixed(2)}, gn);
        ${opts.stripes ? "diffuseColor.rgb *= 0.93 + 0.1 * step(0.5, fract(vWP.x / 9.0));" : ""}`,
      );
  };
  m.customProgramCacheKey = () => `ground-${m.type}-${opts.stripes ? 1 : 0}-${opts.amount ?? 0.22}`;
  return m;
}

const FAIRWAY = (() => {
  const s = new THREE.Shape();
  s.moveTo(-78, 42); s.bezierCurveTo(-20, 47, 60, 46, 124, 38); s.lineTo(124, -30); s.bezierCurveTo(60, -22, -20, -26, -78, -28); s.closePath();
  return s;
})();

/** The estate's lawn, with a hole under every pool and spa so the basins read from above. */
const GROUND = (() => {
  const s = new THREE.Shape();
  const E = CITY.estate;
  s.moveTo(E.x0, -E.z0); s.lineTo(E.x0, -E.z1); s.lineTo(E.x1, -E.z1); s.lineTo(E.x1, -E.z0); s.closePath();
  for (const lot of LOTS) {
    const p = lot.villa.pool;
    if (!p) continue;
    for (const q of p.spa ? [p, p.spa] : [p]) {
      const t = 0.25;
      const pts = [[q.x0 - t, q.z0 - t], [q.x1 + t, q.z0 - t], [q.x1 + t, q.z1 + t], [q.x0 - t, q.z1 + t]].map(([x, z]) => toWorld(lot, x, z));
      const h = new THREE.Path();
      pts.forEach(([x, z], i) => (i ? h.lineTo(x, -z) : h.moveTo(x, -z)));
      h.closePath();
      s.holes.push(h);
    }
  }
  return s;
})();

/** Sabal Grove Lane from Harbor Boulevard to the turning circle, as one surface so nothing overlaps. */
const LANE = (() => {
  const sw = C.streetWidth / 2, cx = C.cul.x, r = C.cul.r;
  const a = Math.sqrt(r * r - sw * sw);
  const s = new THREE.Shape();
  const x0 = CITY.boulevard.x + CITY.boulevard.width / 2;
  s.moveTo(x0, -sw);
  s.lineTo(cx - a, -sw);
  s.absarc(cx, 0, r, Math.PI + Math.asin(sw / r), Math.PI - Math.asin(sw / r), false);
  s.lineTo(x0, sw);
  s.closePath();
  const island = new THREE.Path();
  island.absarc(cx, 0, 5.2, 0, Math.PI * 2, false);
  s.holes.push(island);
  return s;
})();

function Flat({ r, y, mat, onClick }: { r: WRect; y: number; mat: THREE.Material; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  return (
    <mesh position={[(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={mat} receiveShadow onClick={onClick}>
      <planeGeometry args={[r.x1 - r.x0, r.z1 - r.z0]} />
    </mesh>
  );
}

function useMats() {
  return useMemo(() => {
    const g = textures.grass(), a = textures.asphalt(), sw = textures.sidewalk(), pv = textures.pavers(), sd = textures.sand(), w = textures.water();
    const grass = groundPatch(new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normal, roughness: 1 }));
    const fairway = groundPatch(new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normal, roughness: 1, color: "#e9f0cf" }), { stripes: true, amount: 0.1 });
    const green = groundPatch(new THREE.MeshStandardMaterial({ map: g.map, roughness: 0.9, color: "#e2f0c2" }), { amount: 0.05 });
    const asphalt = groundPatch(new THREE.MeshStandardMaterial({ map: a.map, normalMap: a.normal, roughness: 0.92 }), { amount: 0.12 });
    const concrete = groundPatch(new THREE.MeshStandardMaterial({ map: sw.map, normalMap: sw.normal, roughness: 0.9 }), { amount: 0.06 });
    const pavers = groundPatch(new THREE.MeshStandardMaterial({ map: pv.map, normalMap: pv.normal, roughnessMap: pv.rough, roughness: 1 }), { amount: 0.08 });
    const sand = groundPatch(new THREE.MeshStandardMaterial({ map: sd.map, normalMap: sd.normal, roughness: 1 }), { amount: 0.1 });
    const mulch = groundPatch(new THREE.MeshStandardMaterial({ color: "#4a3527", roughness: 1 }), { amount: 0.3 });
    const water = groundPatch(new THREE.MeshPhysicalMaterial({ color: "#264a52", roughness: 0.08, metalness: 0.0, normalMap: w.normal, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 0.9, clearcoat: 1, clearcoatRoughness: 0.05 }), { amount: 0 }) as THREE.MeshPhysicalMaterial;
    const stone = new THREE.MeshStandardMaterial({ color: "#e4dccb", roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: "#2b2c2e", roughness: 0.5, metalness: 0.6 });
    const lampGlass = new THREE.MeshStandardMaterial({ color: "#fff2d6", emissive: "#ffcf8a", emissiveIntensity: 0 });
    const wood = new THREE.MeshStandardMaterial({ color: "#8c6a4c", roughness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: "#e0dace", roughness: 0.75 });
    const flag = new THREE.MeshStandardMaterial({ color: "#d94a3a", side: THREE.DoubleSide });
    const pool = new THREE.CanvasTexture((() => {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const x = c.getContext("2d")!;
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,214,150,0.9)"); g.addColorStop(0.4, "rgba(255,190,120,0.35)"); g.addColorStop(1, "rgba(255,170,90,0)");
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      return c;
    })());
    const glow = new THREE.MeshBasicMaterial({ map: pool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    for (const [m, s] of [[g, 6], [a, 4], [sw, 1.5], [pv, 1.5], [sd, 2]] as const) for (const t of [m.map, m.normal, m.rough]) t?.repeat.set(1 / s, 1 / s);
    return { grass, fairway, green, asphalt, concrete, pavers, sand, mulch, water, stone, dark, lampGlass, wood, white, flag, glow };
  }, []);
}

function Lamps({ list, mats, onPick }: { list: [number, number][]; mats: ReturnType<typeof useMats>; onPick: (e: ThreeEvent<MouseEvent>) => void }) {
  const pole = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null), glow = useRef<THREE.InstancedMesh>(null), arm = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    list.forEach(([x, z], i) => {
      const face = z > 0 ? -1 : 1;
      o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
      o.position.set(x, 2.25, z); o.updateMatrix(); pole.current!.setMatrixAt(i, o.matrix);
      o.position.set(x, 4.45, z + face * 0.45); o.updateMatrix(); arm.current!.setMatrixAt(i, o.matrix);
      o.position.set(x, 4.3, z + face * 0.85); o.updateMatrix(); head.current!.setMatrixAt(i, o.matrix);
      o.position.set(x, 0.12, z + face * 1.6); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.set(9, 9, 1); o.updateMatrix(); glow.current!.setMatrixAt(i, o.matrix);
    });
    for (const r of [pole, head, glow, arm]) r.current!.instanceMatrix.needsUpdate = true;
  }, [list]);
  useFrame((_, dt) => {
    const t = useStore.getState().time;
    const target = t === "night" ? 1 : t === "dusk" ? 0.7 : 0;
    mats.lampGlass.emissiveIntensity += (target * 6 - mats.lampGlass.emissiveIntensity) * Math.min(1, dt * 3);
    mats.glow.opacity += (target * 0.85 - mats.glow.opacity) * Math.min(1, dt * 3);
  });
  const n = list.length;
  return (
    <group onClick={onPick}>
      <instancedMesh ref={pole} args={[undefined, mats.dark, n]} castShadow><cylinderGeometry args={[0.06, 0.09, 4.5, 10]} /></instancedMesh>
      <instancedMesh ref={arm} args={[undefined, mats.dark, n]}><boxGeometry args={[0.06, 0.06, 0.95]} /></instancedMesh>
      <instancedMesh ref={head} args={[undefined, mats.lampGlass, n]}><boxGeometry args={[0.32, 0.12, 0.55]} /></instancedMesh>
      <instancedMesh ref={glow} args={[undefined, mats.glow, n]} renderOrder={3}><planeGeometry args={[1, 1]} /></instancedMesh>
    </group>
  );
}

export function Community({ onPickObject }: { onPickObject: (o: { kind: string; label: string; specs: [string, string][]; point: [number, number, number] }) => void }) {
  const S = useMemo(site, []);
  const M = useMats();
  const sw = C.streetWidth / 2;
  const units = useStore((s) => s.units);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const n = M.water.normalMap!;
    n.offset.set(t * 0.004, t * 0.006);
  });

  const pickPlant = (e: ThreeEvent<MouseEvent>, p: Plant) => {
    if (isDrag(e)) return;
    const info = PLANT_INFO[p.kind];
    const scale = p.kind === "hedge" ? 1 : p.s;
    const h = p.kind === "hedge" ? p.h ?? 1.8 : info.height * scale;
    const spread = p.kind === "hedge" ? Math.max(p.sx ?? 1, p.sz ?? 1) : info.spread * scale;
    onPickObject({
      kind: "plant", label: info.label, point: [e.point.x, e.point.y, e.point.z],
      specs: [["Height", fmt(h, units)], [p.kind === "hedge" ? "Length" : "Canopy", fmt(spread, units)], ["Note", info.note]],
    });
  };
  const pickLamp = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isDrag(e)) return;
    onPickObject({ kind: "lamp", label: "Street lantern", point: [e.point.x, e.point.y, e.point.z], specs: [["Height", fmt(4.5, units)], ["Spacing", fmt(36, units) + " each side"], ["Light", "3000 K LED, dusk to dawn"]] });
  };
  const pickStreet = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isDrag(e)) return;
    onPickObject({ kind: "street", label: C.street, point: [e.point.x, e.point.y, e.point.z], specs: [["Carriageway", fmt(C.streetWidth, units)], ["Sidewalks", `${fmt(C.sidewalk, units)} each side`], ["Length", fmt(C.streetX1 - C.streetX0, units)], ["Turning circle", `${fmt(C.cul.r * 2, units)} across`]] });
  };

  const sidewalkL = C.streetX1 - C.streetX0;
  return (
    <group>
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} material={M.grass} receiveShadow>
        <shapeGeometry args={[GROUND]} />
      </mesh>
      {/* street + turning circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0]} material={M.asphalt} receiveShadow onClick={pickStreet}>
        <shapeGeometry args={[LANE, 48]} />
      </mesh>
      <mesh position={[C.cul.x, 0.12, C.cul.z]} material={M.stone} receiveShadow castShadow>
        <cylinderGeometry args={[5.25, 5.3, 0.24, 64]} />
      </mesh>
      <mesh position={[C.cul.x, 0.245, C.cul.z]} rotation={[-Math.PI / 2, 0, 0]} material={M.grass} receiveShadow>
        <circleGeometry args={[5.05, 64]} />
      </mesh>
      {/* fountain */}
      <group position={[C.cul.x, 0.24, C.cul.z]}>
        <mesh material={M.stone} castShadow receiveShadow position={[0, 0.25, 0]}><cylinderGeometry args={[2.0, 2.1, 0.5, 48]} /></mesh>
        <mesh material={M.water} position={[0, 0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.85, 48]} /></mesh>
        <mesh material={M.stone} castShadow position={[0, 0.9, 0]}><cylinderGeometry args={[0.18, 0.28, 1.0, 20]} /></mesh>
        <mesh material={M.stone} castShadow position={[0, 1.45, 0]}><cylinderGeometry args={[0.8, 0.35, 0.18, 32]} /></mesh>
      </group>
      {/* curbs, verges and sidewalks */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[(C.streetX0 + C.streetX1) / 2, 0.06, s * (sw + 0.15)]} material={M.concrete} receiveShadow castShadow>
            <boxGeometry args={[sidewalkL, 0.12, 0.3]} />
          </mesh>
          <Flat r={{ x0: C.streetX0, z0: s > 0 ? sw + 1.8 : -sw - 3.3, x1: C.streetX1, z1: s > 0 ? sw + 3.3 : -sw - 1.8 }} y={0.04} mat={M.concrete} />
        </group>
      ))}
      <mesh position={[C.cul.x, 0.06, C.cul.z]} rotation={[-Math.PI / 2, 0, 0]} material={M.concrete} receiveShadow>
        <ringGeometry args={[C.cul.r, C.cul.r + 0.3, 64]} />
      </mesh>
      {S.aprons.map((d, i) => <Flat key={`d${i}`} r={d} y={0.08} mat={M.pavers} />)}
      {S.walks.map((d, i) => <Flat key={`w${i}`} r={d} y={0.08} mat={M.pavers} />)}
      {S.beds.map((d, i) => <Flat key={`b${i}`} r={d} y={0.015} mat={M.mulch} />)}

      {/* golf course */}
      <mesh position={[0, -0.02, -96]} rotation={[-Math.PI / 2, 0, 0]} material={M.fairway} receiveShadow>
        <shapeGeometry args={[FAIRWAY]} />
      </mesh>
      <mesh position={[78, -0.01, -84]} rotation={[-Math.PI / 2, 0, 0]} material={M.green} receiveShadow><circleGeometry args={[13, 48]} /></mesh>
      {[[56, -72, 7, 3.5, 0.3], [94, -96, 6, 3, -0.4], [-30, -78, 9, 4, 0.1], [12, -108, 7, 3, 0.6]].map(([x, z, a, b, r], i) => (
        <mesh key={i} position={[x, 0.0, z]} rotation={[-Math.PI / 2, 0, r]} scale={[a, b, 1]} material={M.sand} receiveShadow>
          <circleGeometry args={[1, 40]} />
        </mesh>
      ))}
      <group position={[80, 0, -82]}>
        <mesh material={M.white} castShadow position={[0, 1.15, 0]}><cylinderGeometry args={[0.025, 0.025, 2.3, 8]} /></mesh>
        <mesh material={M.flag} position={[0.28, 2.05, 0]}><planeGeometry args={[0.55, 0.36]} /></mesh>
      </group>
      <mesh position={[(CITY.estate.x0 + CITY.estate.x1) / 2 + 3, 0.0, C.golfZ - 9]} rotation={[-Math.PI / 2, 0, 0]} material={M.concrete} receiveShadow>
        <planeGeometry args={[CITY.estate.x1 - CITY.estate.x0 - 6, 2.4]} />
      </mesh>

      {/* lake */}
      <mesh position={[(CITY.lake.x0 + CITY.lake.x1) / 2, -0.6, (CITY.lake.z0 + CITY.lake.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={M.water}>
        <planeGeometry args={[CITY.lake.x1 - CITY.lake.x0, CITY.lake.z1 - CITY.lake.z0]} />
      </mesh>
      <mesh position={[(CITY.estate.x0 + CITY.estate.x1) / 2, -0.32, C.lakeZ + 2.4]} rotation={[-Math.PI / 2 + 0.12, 0, 0]} material={M.sand} receiveShadow>
        <planeGeometry args={[CITY.estate.x1 - CITY.estate.x0, 5]} />
      </mesh>
      <group position={[0, 0, C.lakeZ + 2]}>
        <mesh material={M.wood} receiveShadow castShadow position={[0, 0.15, 9]}><boxGeometry args={[2.4, 0.12, 18]} /></mesh>
        <mesh material={M.wood} receiveShadow castShadow position={[0, 0.15, 18]}><boxGeometry args={[9, 0.12, 4]} /></mesh>
        {[-1, 1].flatMap((s) => [3, 7, 11, 15, 19].map((z) => (
          <mesh key={`${s}${z}`} material={M.wood} castShadow position={[s * (z > 16 ? 4.3 : 1.1), -0.5, z]}><cylinderGeometry args={[0.1, 0.1, 1.4, 8]} /></mesh>
        )))}
      </group>

      {/* the gated entrance off Harbor Boulevard: monument walls, a pavered court and a staffed gatehouse */}
      <Flat r={{ x0: -86, z0: -C.streetWidth / 2, x1: -64, z1: C.streetWidth / 2 }} y={0.03} mat={M.pavers} />
      {[-1, 1].map((s) => (
        <group key={s}>
          {/* perimeter wall along the boulevard */}
          <mesh material={M.white} castShadow receiveShadow position={[-80, 1.2, s * 29]}><boxGeometry args={[0.4, 2.4, 34]} /></mesh>
          <mesh material={M.stone} castShadow position={[-80, 2.46, s * 29]}><boxGeometry args={[0.6, 0.12, 34]} /></mesh>
          {[12, 18, 24, 30, 36, 42].map((z) => (
            <mesh key={z} material={M.stone} castShadow position={[-80, 1.35, s * z]}><boxGeometry args={[0.7, 2.7, 0.7]} /></mesh>
          ))}
          {/* monument wall facing the boulevard */}
          <mesh material={M.stone} castShadow receiveShadow position={[-82.5, 0.95, s * 8.6]}><boxGeometry args={[0.7, 1.9, 6.6]} /></mesh>
          <mesh material={M.stone} castShadow position={[-82.5, 1.4, s * 12.2]}><boxGeometry args={[1.0, 2.8, 1.0]} /></mesh>
          <Text font={fontUrl} fontSize={0.58} color="#2b3a31" position={[-82.86, 1.08, s * 8.6]} rotation={[0, -Math.PI / 2, 0]} anchorX="center" anchorY="middle" letterSpacing={0.1}>
            SABAL GROVE
          </Text>
          {/* entry and exit barrier arms */}
          <mesh material={M.dark} position={[-69.5, 0.55, s * 4.1]}><boxGeometry args={[0.3, 1.1, 0.3]} /></mesh>
          <mesh material={M.white} position={[-69.5, 1.0, s * 2.15]}><boxGeometry args={[0.08, 0.08, 3.6]} /></mesh>
        </group>
      ))}
      <group position={[-72, 0, 0]}>
        <mesh material={M.stone} receiveShadow position={[0, 0.1, 0]}><boxGeometry args={[7, 0.2, 1.6]} /></mesh>
        <mesh material={M.white} castShadow receiveShadow position={[0, 1.5, 0]}><boxGeometry args={[3.2, 2.8, 1.4]} /></mesh>
        <mesh material={M.lampGlass} position={[0, 1.7, 0.71]}><boxGeometry args={[2.4, 1.0, 0.02]} /></mesh>
        <mesh material={M.lampGlass} position={[0, 1.7, -0.71]}><boxGeometry args={[2.4, 1.0, 0.02]} /></mesh>
        {/* canopy over both lanes */}
        <mesh material={M.white} castShadow position={[0, 4.75, 0]}><boxGeometry args={[7.5, 0.36, 11.5]} /></mesh>
        {[[-3.2, -5.2], [3.2, -5.2], [-3.2, 5.2], [3.2, 5.2]].map(([x, z]) => (
          <mesh key={`${x}${z}`} material={M.stone} castShadow position={[x, 2.3, z]}><boxGeometry args={[0.45, 4.6, 0.45]} /></mesh>
        ))}
      </group>

      {/* mailboxes and benches */}
      {S.mailboxes.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]} rotation={[0, m.r, 0]}>
          <mesh material={M.white} castShadow position={[0, 0.55, 0]}><boxGeometry args={[0.1, 1.1, 0.1]} /></mesh>
          <mesh material={M.dark} castShadow position={[0, 1.18, 0]}><boxGeometry args={[0.24, 0.26, 0.48]} /></mesh>
          <Text font={fontUrl} fontSize={0.12} color="#f3f1ec" position={[0.125, 1.18, 0]} rotation={[0, Math.PI / 2, 0]} anchorX="center" anchorY="middle">{String(m.n)}</Text>
        </group>
      ))}
      {S.benches.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.r, 0]}>
          <mesh material={M.wood} castShadow position={[0, 0.45, 0]}><boxGeometry args={[1.6, 0.06, 0.45]} /></mesh>
          <mesh material={M.wood} castShadow position={[0, 0.75, -0.2]}><boxGeometry args={[1.6, 0.4, 0.05]} /></mesh>
          <mesh material={M.dark} position={[0, 0.22, 0]}><boxGeometry args={[1.4, 0.44, 0.4]} /></mesh>
        </group>
      ))}

      <Lamps list={S.lamps} mats={M} onPick={pickLamp} />
      <Vegetation plants={S.plants} onPick={pickPlant} />
    </group>
  );
}

function fmt(m: number, u: "imperial" | "metric") {
  return u === "metric" ? `${m.toFixed(1)} m` : `${Math.round(m * 3.28084)} ft`;
}
