import * as THREE from "three";
import type { BuiltVilla } from "../data/dsl";
import { LEVEL_HEIGHT } from "../data/types";
import * as TX from "./textures";

export const MAX_ZONES = 28;

/* ---------- textures, built once ---------- */

type TexSet = { map: THREE.Texture; normal?: THREE.Texture; rough?: THREE.Texture };
const texCache = new Map<string, TexSet>();

function tex(key: string, metres: number, make: () => TexSet): TexSet {
  let t = texCache.get(key);
  if (!t) {
    t = make();
    for (const x of [t.map, t.normal, t.rough]) x?.repeat.set(1 / metres, 1 / metres);
    texCache.set(key, t);
  }
  return t;
}

export const textures = {
  oak: () => tex("oak", 2.4, () => TX.wood("#c9a07a", 1)),
  walnut: () => tex("walnut", 2.4, () => TX.wood("#8a6448", 2)),
  travertine: () => tex("travertine", 1.8, () => TX.stone("#e6dcc8", 3, "#cbbfa8", 3)),
  marble: () => tex("marble", 1.2, () => TX.stone("#eeeeea", 2, "#d8d8d2", 5)),
  bathTile: () => tex("bathTile", 0.9, () => TX.stone("#f0efeb", 6, "#d2d0ca", 6)),
  poolTile: () => tex("poolTile", 0.6, () => TX.stone("#5fb3c9", 8, "#d9eef3", 7)),
  concrete: () => tex("concrete", 3, () => TX.concrete("#c4c0b8", 6)),
  sidewalk: () => tex("sidewalk", 1.5, () => TX.concrete("#cfcac0", 16)),
  pavers: () => tex("pavers", 1.5, () => TX.pavers("#cdbfa5", 3)),
  deckWood: () => tex("deckWood", 2.4, () => TX.wood("#9c7553", 4)),
  grass: () => tex("grass", 6, () => TX.grass(4)),
  asphalt: () => tex("asphalt", 4, () => TX.asphalt(5)),
  stucco: () => tex("stucco", 2, () => TX.stucco(7)),
  roofClay: () => tex("roofClay", 2.4, () => TX.roofTiles("#b0603c", true, 8)),
  roofSlate: () => tex("roofSlate", 2.4, () => TX.roofTiles("#7d878c", false, 9)),
  roofFlat: () => tex("roofFlat", 3, () => TX.concrete("#bdb8ae", 21)),
  water: () => tex("water", 3, () => TX.waterNormal(13)),
  sand: () => tex("sand", 2, () => TX.sand(14)),
};

/* ---------- zone lighting ---------- */

export interface ZoneUniforms {
  zRect: { value: THREE.Vector4[] };
  zInfo: { value: THREE.Vector4[] };
  zColor: { value: THREE.Color[] };
  zCount: { value: number };
  zInv: { value: THREE.Matrix4 };
  zScale: { value: number };
}

export function makeZoneUniforms(): ZoneUniforms {
  return {
    zRect: { value: Array.from({ length: MAX_ZONES }, () => new THREE.Vector4()) },
    zInfo: { value: Array.from({ length: MAX_ZONES }, () => new THREE.Vector4()) },
    zColor: { value: Array.from({ length: MAX_ZONES }, () => new THREE.Color()) },
    zCount: { value: 0 },
    zInv: { value: new THREE.Matrix4() },
    zScale: { value: 1 },
  };
}

const ZONE_COMMON = /* glsl */ `
#define MAX_ZONES ${MAX_ZONES}
uniform vec4 zRect[MAX_ZONES];
uniform vec4 zInfo[MAX_ZONES];
uniform vec3 zColor[MAX_ZONES];
uniform int zCount;
uniform float zScale;
varying vec3 vZP;
varying vec3 vZN;

vec3 zoneLight(vec3 p, vec3 n) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < MAX_ZONES; i++) {
    if (i >= zCount) break;
    vec4 inf = zInfo[i];
    if (inf.z < 0.002) continue;
    vec4 r = zRect[i];
    if (p.x < r.x - 0.02 || p.x > r.z + 0.02 || p.z < r.y - 0.02 || p.z > r.w + 0.02) continue;
    if (p.y < inf.x - 0.06 || p.y > inf.y) continue;
    vec2 c = 0.5 * (r.xy + r.zw);
    vec2 hs = max(0.5 * (r.zw - r.xy), vec2(0.01));
    vec3 L = vec3(c.x, abs(inf.w), c.y) - p;
    float d = length(L);
    L /= max(d, 0.001);
    float lam = max(dot(n, L), 0.0) * 0.75 + 0.3;
    vec2 q = abs(p.xz - c) / hs;
    float edge = 1.0 - 0.5 * smoothstep(0.25, 1.0, max(q.x, q.y));
    float fall = 1.0 / (1.0 + 0.05 * d * d);
    acc += zColor[i] * inf.z * lam * edge * fall;
  }
  return acc * zScale;
}

float zoneAt(vec3 p, bool indoorOnly) {
  float m = 0.0;
  for (int i = 0; i < MAX_ZONES; i++) {
    if (i >= zCount) break;
    vec4 inf = zInfo[i];
    if (indoorOnly && inf.w < 0.0) continue;
    vec4 r = zRect[i];
    if (p.x < r.x - 0.16 || p.x > r.z + 0.16 || p.z < r.y - 0.16 || p.z > r.w + 0.16) continue;
    if (p.y < inf.x - 0.06 || p.y > inf.y + 0.1) continue;
    m = max(m, inf.z);
  }
  return m;
}
`;

/** emit: 0 none, 1 warm fixture, 2 window glass (indoor rooms only), 3 pool water. */
export function zonePatch<M extends THREE.Material>(mat: M, U: ZoneUniforms, emit = 0): M {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 zInv;\nvarying vec3 vZP;\nvarying vec3 vZN;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        {
          vec4 zp = vec4(transformed, 1.0);
          vec3 zn = objectNormal;
          #ifdef USE_INSTANCING
            zp = instanceMatrix * zp;
            zn = mat3(instanceMatrix) * zn;
          #endif
          vZP = (zInv * (modelMatrix * zp)).xyz;
          vZN = mat3(zInv) * (mat3(modelMatrix) * zn);
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${ZONE_COMMON}`)
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        reflectedLight.directDiffuse += zoneLight(vZP, normalize(vZN)) * diffuseColor.rgb;`,
      );
    if (emit) {
      const e = emit === 1
        ? "totalEmissiveRadiance += vec3(1.0, 0.8, 0.55) * zoneAt(vZP, false) * 9.0;"
        : emit === 2
          ? "totalEmissiveRadiance += vec3(1.0, 0.72, 0.42) * zoneAt(vZP, true) * 1.6 * zScale;"
          : "totalEmissiveRadiance += vec3(0.25, 0.85, 1.0) * zoneAt(vZP, false) * 1.8;";
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\n${e}`,
      );
    }
  };
  mat.customProgramCacheKey = () => `zone-${emit}`;
  return mat;
}

/* ---------- per-villa material set ---------- */

export interface VillaMats {
  U: ZoneUniforms;
  zoneIds: string[];
  get: (name: string) => THREE.Material;
  tone: (hex: string, rough?: number, metal?: number) => THREE.Material;
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);

export function villaMaterials(villa: BuiltVilla): VillaMats {
  const U = makeZoneUniforms();
  const zoneIds: string[] = [];
  villa.rooms.forEach((r, i) => {
    if (i >= MAX_ZONES) return;
    zoneIds.push(r.id);
    U.zRect.value[i].set(r.x0, r.z0, r.x1, r.z1);
    const base = r.level * LEVEL_HEIGHT;
    const top = r.outdoor ? base + 9 : base + 3.0;
    const ly = r.outdoor ? -(base + 3.6) : base + 2.7;
    U.zInfo.value[i].set(base - 0.02, top, 0, ly);
    const c = r.outdoor
      ? (r.type === "pooldeck" ? new THREE.Color(1.0, 0.78, 0.56).multiplyScalar(1.6) : new THREE.Color(1.0, 0.74, 0.48).multiplyScalar(1.7))
      : new THREE.Color(1.0, 0.7, 0.42).multiplyScalar(2.0);
    U.zColor.value[i].copy(c);
  });
  U.zCount.value = zoneIds.length;

  const s = villa.style;
  const cache = new Map<string, THREE.Material>();
  const P = <M extends THREE.Material>(m: M, emit = 0) => zonePatch(m, U, emit);

  const floorFor = (kind: string) => {
    const t = kind === "walnut" ? textures.walnut() : kind === "oak" ? textures.oak() : kind === "concrete" ? textures.concrete() : textures.travertine();
    return P(std({ map: t.map, normalMap: t.normal, roughnessMap: t.rough, roughness: 1, normalScale: new THREE.Vector2(0.5, 0.5) }));
  };

  const defs: Record<string, () => THREE.Material> = {
    "floor:main": () => floorFor(s.floor),
    "floor:wood": () => floorFor(s.floor === "travertine" ? "oak" : s.floor),
    "floor:bath": () => { const t = textures.bathTile(); return P(std({ map: t.map, normalMap: t.normal, roughnessMap: t.rough, roughness: 1 })); },
    "floor:garage": () => { const t = textures.concrete(); return P(std({ map: t.map, normalMap: t.normal, roughness: 0.85, color: "#d8d4cc" })); },
    "deck:stone": () => { const t = textures.travertine(); return P(std({ map: t.map, normalMap: t.normal, roughnessMap: t.rough, roughness: 1, color: "#f4efe6" })); },
    "deck:wood": () => { const t = textures.deckWood(); return P(std({ map: t.map, normalMap: t.normal, roughnessMap: t.rough, roughness: 1 })); },
    pavers: () => { const t = textures.pavers(); return P(std({ map: t.map, normalMap: t.normal, roughnessMap: t.rough, roughness: 1 })); },
    wall: () => { const t = textures.stucco(); return P(std({ color: "#f3f0ea", map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(0.15, 0.15), roughness: 0.92 })); },
    stucco: () => { const t = textures.stucco(); return P(std({ color: s.stucco, map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95 })); },
    cap: () => P(std({ color: "#3a3936", roughness: 0.9 })),
    trim: () => P(std({ color: s.trim, roughness: 0.55, metalness: 0.15 })),
    soffit: () => P(std({ color: "#f4f1ea", roughness: 0.9 })),
    ceiling: () => P(std({ color: "#f7f5f0", roughness: 0.95 })),
    "roof:tile": () => { const t = s.roof === "#5d6a70" ? textures.roofSlate() : textures.roofClay(); return P(std({ map: t.map, normalMap: t.normal, roughness: 0.8, color: s.roof === "#5d6a70" ? "#ffffff" : "#ffffff" })); },
    "roof:flat": () => { const t = textures.roofFlat(); return P(std({ map: t.map, normalMap: t.normal, roughness: 0.95, color: s.roof })); },
    glass: () => P(new THREE.MeshPhysicalMaterial({ color: "#a9c4cc", roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide }), 2),
    frame: () => P(std({ color: s.trim, roughness: 0.4, metalness: 0.5 })),
    door: () => P(std({ color: s.wood, roughness: 0.6 })),
    "door:int": () => P(std({ color: "#f1eee8", roughness: 0.55 })),
    "door:garage": () => P(std({ color: s.trim === "#ffffff" || s.trim === "#f5efe4" || s.trim === "#f4ece0" ? "#ece8e0" : "#3a3b3d", roughness: 0.5, metalness: 0.2 })),
    water: () => { const t = textures.water(); return P(new THREE.MeshPhysicalMaterial({ color: "#4cc0d6", roughness: 0.05, normalMap: t.normal, normalScale: new THREE.Vector2(0.3, 0.3), transparent: true, opacity: 0.62, envMapIntensity: 1.4, clearcoat: 1 }), 3); },
    poolTile: () => { const t = textures.poolTile(); return P(std({ map: t.map, normalMap: t.normal, roughness: 0.4 }), 3); },
    coping: () => P(std({ color: "#ece5d6", roughness: 0.8 })),
    stair: () => P(std({ color: s.wood, roughness: 0.55 })),
    rail: () => P(new THREE.MeshPhysicalMaterial({ color: "#cfe3e8", roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false })),
    fixture: () => P(std({ color: "#fff8ec", roughness: 0.3, emissive: "#000000" }), 1),
    wood: () => P(std({ color: s.wood, roughness: 0.55 })),
    woodDark: () => P(std({ color: "#4a3a2c", roughness: 0.6 })),
    fabric: () => P(std({ color: s.fabric, roughness: 0.95 })),
    fabric2: () => P(std({ color: s.fabric2, roughness: 0.95 })),
    linen: () => P(std({ color: "#f6f3ec", roughness: 0.95 })),
    rug: () => P(std({ color: new THREE.Color(s.fabric).lerp(new THREE.Color(s.fabric2), 0.25).getStyle(), roughness: 1 })),
    metal: () => P(std({ color: "#2d2e30", roughness: 0.45, metalness: 0.7 })),
    chrome: () => P(std({ color: "#d9dcdf", roughness: 0.15, metalness: 1 })),
    ceramic: () => P(std({ color: "#fbfbf8", roughness: 0.15 })),
    counter: () => { const t = textures.marble(); return P(std({ map: t.map, roughness: 0.25 })); },
    cabinet: () => P(std({ color: s.floor === "walnut" ? "#2f3236" : s.floor === "travertine" ? "#e9e3d6" : "#dcd3c3", roughness: 0.5 })),
    screen: () => P(std({ color: "#0c0d0f", roughness: 0.15, metalness: 0.2 })),
    leaf: () => P(std({ color: "#5b7a3a", roughness: 0.8 })),
    pot: () => P(std({ color: "#b0704a", roughness: 0.85 })),
    tire: () => P(std({ color: "#18191a", roughness: 0.9 })),
    carGlass: () => P(std({ color: "#1b2329", roughness: 0.05, metalness: 0.4 })),
    steel: () => P(std({ color: "#9aa0a5", roughness: 0.35, metalness: 0.8 })),
    cushion: () => P(std({ color: "#ece6da", roughness: 0.95 })),
    parasol: () => P(std({ color: "#f1ece2", roughness: 0.9, side: THREE.DoubleSide })),
    fire: () => P(std({ color: "#ff9a3c", emissive: "#ff7a1a", emissiveIntensity: 2 })),
  };

  const get = (name: string) => {
    let m = cache.get(name);
    if (!m) {
      const d = defs[name];
      if (!d) throw new Error(`no material ${name}`);
      m = d();
      cache.set(name, m);
    }
    return m;
  };
  const tone = (hex: string, rough = 0.35, metal = 0.4) => {
    const k = `tone:${hex}:${rough}:${metal}`;
    let m = cache.get(k);
    if (!m) { m = P(new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough, metalness: metal, clearcoat: metal > 0.3 ? 1 : 0, clearcoatRoughness: 0.1 })); cache.set(k, m); }
    return m;
  };
  return { U, zoneIds, get, tone };
}
