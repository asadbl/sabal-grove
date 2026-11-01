import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as TX from "../lib/textures";

export type PlantKind = "oak" | "royal" | "sabal" | "shrub" | "bloom" | "hedge";

export interface Plant { kind: PlantKind; x: number; z: number; s: number; r: number; sx?: number; sz?: number; h?: number }

export const PLANT_INFO: Record<PlantKind, { label: string; height: number; spread: number; note: string }> = {
  oak: { label: "Southern live oak", height: 8.5, spread: 9, note: "Quercus virginiana, evergreen shade tree" },
  royal: { label: "Royal palm", height: 13.5, spread: 6, note: "Roystonea regia, lines Sabal Grove Lane" },
  sabal: { label: "Sabal palm", height: 7, spread: 4.5, note: "Sabal palmetto, the Florida state tree" },
  shrub: { label: "Podocarpus shrub", height: 1.3, spread: 1.4, note: "Foundation planting, clipped twice a year" },
  bloom: { label: "Bougainvillea", height: 1.6, spread: 1.8, note: "Flowers magenta most of the year" },
  hedge: { label: "Clusia hedge", height: 1.8, spread: 0.9, note: "Privacy hedge on the lot lines" },
};

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Leaf cards scattered through an ellipsoid; normals point outward so the canopy shades softly. */
function canopy(n: number, c: THREE.Vector3, rad: THREE.Vector3, card: number, seed: number, droop = 0) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, z = 0;
    do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const p = new THREE.Vector3(c.x + x * rad.x, c.y + y * rad.y - droop * (x * x + z * z), c.z + z * rad.z);
    const g = new THREE.PlaneGeometry(card * (0.8 + r() * 0.4), card * (0.8 + r() * 0.4));
    g.rotateX(r() * Math.PI); g.rotateY(r() * Math.PI); g.rotateZ(r() * Math.PI);
    g.translate(p.x, p.y, p.z);
    const nrm = g.attributes.normal as THREE.BufferAttribute;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    for (let k = 0; k < pos.count; k++) {
      const v = new THREE.Vector3(pos.getX(k) - c.x, (pos.getY(k) - c.y) * 1.4, pos.getZ(k) - c.z).normalize();
      v.y += 0.35; v.normalize();
      nrm.setXYZ(k, v.x, v.y, v.z);
      const shade = 0.55 + 0.45 * Math.min(1, Math.max(0, (pos.getY(k) - (c.y - rad.y)) / (rad.y * 2))) * (0.85 + r() * 0.3);
      col.setRGB(shade, shade, shade);
      colors.push(col.r, col.g, col.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    parts.push(g);
  }
  return mergeGeometries(parts)!;
}

/** Lumpy inner mass behind the leaf cards; darker underneath so the canopy reads as a volume. */
function core(c: THREE.Vector3, rad: THREE.Vector3, seed: number) {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const ph = seed * 1.7;
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = 1 + 0.16 * Math.sin(x * 4.1 + ph) * Math.sin(y * 3.7 + ph * 0.5) * Math.sin(z * 4.3 + ph * 1.3);
    pos.setXYZ(i, c.x + x * rad.x * n, c.y + y * rad.y * n, c.z + z * rad.z * n);
    const sh = 0.45 + 0.55 * (y * 0.5 + 0.5);
    colors.push(sh, sh, sh);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

function trunk(h: number, r0: number, r1: number, lean = 0) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 10, 6, true);
  g.translate(0, h / 2, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / h;
    pos.setX(i, pos.getX(i) + Math.sin(y * Math.PI * 0.5) * lean);
  }
  g.computeVertexNormals();
  return g;
}

function frondGeo(len: number, width: number, droop: number) {
  const seg = 10;
  const g = new THREE.PlaneGeometry(width, len, 1, seg);
  g.translate(0, len / 2, 0);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = -pos.getZ(i) / len;
    pos.setY(i, Math.sin(t * Math.PI * 0.55) * len * 0.35 - t * t * droop);
    const fold = Math.abs(pos.getX(i)) / (width / 2);
    pos.setY(i, pos.getY(i) - fold * 0.18 * t);
  }
  g.computeVertexNormals();
  return g;
}

function palmCrown(n: number, len: number, seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const g = frondGeo(len * (0.85 + r() * 0.25), len * 0.42, len * (0.5 + r() * 0.5));
    g.rotateX(-(0.1 + r() * 0.5));
    g.rotateY((i / n) * Math.PI * 2 + r() * 0.3);
    parts.push(g);
  }
  for (let i = 0; i < 5; i++) {
    const g = frondGeo(len * 0.7, len * 0.35, 0.1);
    g.rotateX(-1.1 - r() * 0.3);
    g.rotateY(r() * Math.PI * 2);
    parts.push(g);
  }
  return mergeGeometries(parts)!;
}

interface Species { trunk?: THREE.BufferGeometry; crown: THREE.BufferGeometry; trunkMat?: THREE.Material; crownMat: THREE.Material; extras?: { geo: THREE.BufferGeometry; mat: THREE.Material }[] }

let speciesCache: Record<string, Species> | null = null;
function species(): Record<string, Species> {
  if (speciesCache) return speciesCache;
  const leafTex = TX.leaves(["#4c5e33", "#5f7140", "#73804b", "#3d4c2b"], 9, 1100).map;
  const shrubTex = TX.leaves(["#4a6339", "#5b7444", "#6c8250"], 15, 1000).map;
  const bloomTex = TX.leaves(["#c43a86", "#e0569c", "#5a8a44", "#a8306f"], 16, 1000).map;
  const frondTex = TX.frond(10).map;
  const barkT = TX.bark("#6b5a48", 11);
  const palmT = TX.palmTrunk(12);
  const leafMat = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, alphaTest: 0.35, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85 });
  const coreMat = (color: string) => new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 1 });
  const barkMat = new THREE.MeshStandardMaterial({ map: barkT.map, normalMap: barkT.normal, roughness: 0.95 });
  const palmTrunkMat = new THREE.MeshStandardMaterial({ map: palmT.map, normalMap: palmT.normal, roughness: 0.9, color: "#d8d2c4" });
  const royalTrunkMat = new THREE.MeshStandardMaterial({ color: "#b8b3a8", normalMap: palmT.normal, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.8 });
  const frondMat = new THREE.MeshStandardMaterial({ map: frondTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
  const shaftMat = new THREE.MeshStandardMaterial({ color: "#5f7d3a", roughness: 0.6 });

  const oakTrunk = mergeGeometries([
    trunk(3.4, 0.32, 0.2),
    (() => { const g = trunk(2.6, 0.16, 0.08, 0.2); g.rotateZ(0.7); g.translate(0.1, 2.6, 0); return g; })(),
    (() => { const g = trunk(2.4, 0.15, 0.07, 0.2); g.rotateZ(-0.6); g.rotateY(2); g.translate(0, 2.8, 0.1); return g; })(),
    (() => { const g = trunk(2.2, 0.14, 0.07, 0.1); g.rotateX(0.6); g.translate(0, 3.0, 0); return g; })(),
  ].map((g) => g.toNonIndexed()))!;
  const oakCrown = mergeGeometries([
    canopy(230, new THREE.Vector3(0, 5.6, 0), new THREE.Vector3(3.9, 2.0, 3.9), 2.1, 21, 0.05),
    canopy(90, new THREE.Vector3(1.4, 6.6, 0.6), new THREE.Vector3(2.2, 1.4, 2.2), 1.8, 22),
    canopy(90, new THREE.Vector3(-1.5, 6.4, -0.8), new THREE.Vector3(2.2, 1.4, 2.2), 1.8, 23),
  ])!;
  const oakCore = mergeGeometries([
    core(new THREE.Vector3(0, 5.5, 0), new THREE.Vector3(3.3, 1.6, 3.3), 1),
    core(new THREE.Vector3(1.4, 6.5, 0.6), new THREE.Vector3(1.8, 1.1, 1.8), 2),
    core(new THREE.Vector3(-1.5, 6.3, -0.8), new THREE.Vector3(1.8, 1.1, 1.8), 3),
  ])!;

  const royalTrunk = (() => {
    const g = new THREE.CylinderGeometry(0.22, 0.3, 11, 14, 8, true);
    g.translate(0, 5.5, 0);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 11;
      const k = 1 + Math.sin(y * Math.PI) * 0.18;
      pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  })();
  const shaft = new THREE.CylinderGeometry(0.2, 0.24, 1.6, 12);
  shaft.translate(0, 11.8, 0);
  const royalCrown = palmCrown(14, 3.6, 31);
  royalCrown.translate(0, 12.5, 0);

  const sabalTrunk = trunk(5.6, 0.24, 0.2, 0.35);
  const sabalCrown = palmCrown(16, 2.4, 41);
  sabalCrown.translate(0.35, 5.7, 0);

  const shrubG = canopy(34, new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(0.75, 0.6, 0.75), 0.85, 51);
  const bloomG = canopy(40, new THREE.Vector3(0, 0.8, 0), new THREE.Vector3(0.9, 0.75, 0.9), 0.9, 52);
  const shrubCore = core(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(0.62, 0.5, 0.62), 4);
  const bloomCore = core(new THREE.Vector3(0, 0.78, 0), new THREE.Vector3(0.75, 0.62, 0.75), 5);

  const hedgeG = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  hedgeG.translate(0, 0.5, 0);
  const hedgeT = TX.stone("#56703f", 12, "#435833", 61);
  const hedgeMat = new THREE.MeshStandardMaterial({ map: hedgeT.map, normalMap: hedgeT.normal, normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.95 });
  hedgeT.map.repeat.set(1, 1);

  speciesCache = {
    oak: { trunk: oakTrunk, trunkMat: barkMat, crown: oakCrown, crownMat: leafMat(leafTex), extras: [{ geo: oakCore, mat: coreMat("#47573a") }] },
    royal: { trunk: royalTrunk, trunkMat: royalTrunkMat, crown: royalCrown, crownMat: frondMat, extras: [{ geo: shaft, mat: shaftMat }] },
    sabal: { trunk: sabalTrunk, trunkMat: palmTrunkMat, crown: sabalCrown, crownMat: frondMat },
    shrub: { crown: shrubG, crownMat: leafMat(shrubTex), extras: [{ geo: shrubCore, mat: coreMat("#46603a") }] },
    bloom: { crown: bloomG, crownMat: leafMat(bloomTex), extras: [{ geo: bloomCore, mat: coreMat("#4f7a3c") }] },
    hedge: { crown: hedgeG, crownMat: hedgeMat },
  };
  return speciesCache;
}

function Instanced({ geo, mat, plants, onPick, sway = 0 }: { geo: THREE.BufferGeometry; mat: THREE.Material; plants: Plant[]; onPick?: (e: ThreeEvent<MouseEvent>, p: Plant) => void; sway?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    plants.forEach((p, i) => {
      o.position.set(p.x, 0, p.z);
      o.rotation.set(0, p.r, 0);
      if (p.kind === "hedge") o.scale.set(p.sx ?? 1, p.h ?? 1.6, p.sz ?? 1);
      else o.scale.setScalar(p.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [plants]);
  useFrame(({ clock }) => {
    if (!sway || !ref.current) return;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.6) * sway * 0.002;
  });
  if (!plants.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geo, mat, plants.length]}
      castShadow
      receiveShadow
      onClick={onPick ? (e) => { e.stopPropagation(); if (e.instanceId !== undefined) onPick(e, plants[e.instanceId]); } : undefined}
    />
  );
}

export function Vegetation({ plants, onPick }: { plants: Plant[]; onPick?: (e: ThreeEvent<MouseEvent>, p: Plant) => void }) {
  const S = useMemo(species, []);
  const by = useMemo(() => {
    const m: Record<string, Plant[]> = {};
    for (const p of plants) (m[p.kind] ??= []).push(p);
    return m;
  }, [plants]);
  return (
    <group>
      {Object.entries(by).map(([k, list]) => {
        const sp = S[k];
        return (
          <group key={k}>
            {sp.trunk && sp.trunkMat && <Instanced geo={sp.trunk} mat={sp.trunkMat} plants={list} onPick={onPick} />}
            {sp.extras?.map((x, i) => <Instanced key={i} geo={x.geo} mat={x.mat} plants={list} onPick={onPick} />)}
            <Instanced geo={sp.crown} mat={sp.crownMat} plants={list} onPick={onPick} />
          </group>
        );
      })}
    </group>
  );
}
