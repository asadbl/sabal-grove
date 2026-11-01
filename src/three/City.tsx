import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CITY, lanes, towers } from "../data/city";
import { NOISE_GLSL } from "../lib/glsl";
import { useStore } from "../store";

/** 0 by day, about 0.5 at dusk, 1 at night; drives lit windows, street glow and headlights. */
const NIGHT = { value: 0 };
const NIGHT_OF = { day: 0, dusk: 0.55, night: 1 };

const f = (n: number) => n.toFixed(2);

/* ---------- ground: streets, sidewalks and plazas, all drawn from the grid ---------- */

const CITY_GROUND = (() => {
  const s = new THREE.Shape();
  const R = 2400;
  s.moveTo(-R, -R); s.lineTo(R, -R); s.lineTo(R, R); s.lineTo(-R, R); s.closePath();
  // One hole tracing the estate and the lake together: two holes sharing an edge break triangulation.
  const E = CITY.estate, L = CITY.lake;
  const pts: [number, number][] = [[E.x0, E.z0], [E.x1, E.z0], [E.x1, L.z0], [L.x1, L.z0], [L.x1, L.z1], [L.x0, L.z1], [L.x0, L.z0], [E.x0, L.z0]];
  const h = new THREE.Path();
  pts.forEach(([x, z], i) => (i ? h.lineTo(x, -z) : h.moveTo(x, -z))); // shape y is world −z once laid flat
  h.closePath();
  s.holes.push(h);
  return s;
})();

function groundMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.92 });
  const B = CITY.boulevard;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = NIGHT;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vWP;\nuniform float uNight;\n${NOISE_GLSL}`)
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec2 p = vec2(vWP.x, vWP.z);
        const float P = ${f(CITY.grid)};
        vec2 q = mod(p - vec2(${f(CITY.ox)}, ${f(CITY.oz)}) + P * 0.5, P) - P * 0.5;
        float dx = abs(q.x), dz = abs(q.y);
        float bm = abs(p.x - ${f(B.x)});
        bool blvd = bm < ${f(B.width / 2 + 0.5)};
        float hx = blvd ? ${f(B.width / 2)} : ${f(CITY.road / 2)};
        float hz = ${f(CITY.road / 2)};
        float n = fbm2(p * 0.3);
        float grain = vn(p * 9.0);
        bool inNS = dx < hx, inEW = dz < hz;
        vec3 paint = vec3(0.7, 0.7, 0.67), amber = vec3(0.78, 0.6, 0.22);
        vec3 col;
        float rough = 0.9;
        if (inNS || inEW) {
          col = vec3(0.16, 0.165, 0.17) * (0.86 + 0.24 * n + 0.08 * grain);
          if (inNS && !inEW) {
            if (blvd) {
              if (bm < ${f(B.median / 2)}) {
                col = bm < ${f(B.median / 2 - 0.35)} ? vec3(0.42, 0.4, 0.33) * (0.8 + 0.4 * n) : vec3(0.72, 0.7, 0.66);
              } else {
                float lane = mod(bm - ${f(B.median / 2)}, 3.3);
                if (lane < 0.12 && bm > ${f(B.median / 2 + 1)} && bm < ${f(B.width / 2 - 1)} && mod(p.y, 12.0) < 3.0) col = paint;
                if (abs(bm - ${f(B.width / 2 - 0.5)}) < 0.08 || abs(bm - ${f(B.median / 2 + 0.5)}) < 0.08) col = paint;
              }
            } else if (dx < 0.08 || abs(dx - 0.28) < 0.07) col = amber;
            if (dz < hz + 4.0 && mod(p.x, 1.2) < 0.6 && dx < hx - 0.6) col = paint; // crosswalk
            if (dz > hz + 4.0 && dz < hz + 4.5 && dx < hx - 0.6 && (blvd ? bm > ${f(B.median / 2)} : true)) col = paint; // stop line
          }
          if (inEW && !inNS) {
            if (dz < 0.08 || abs(dz - 0.28) < 0.07) col = amber;
            if (dx < hx + 4.0 && mod(p.y, 1.2) < 0.6 && dz < hz - 0.6) col = paint;
          }
          rough = 0.85;
        } else if (dx < hx + ${f(CITY.sidewalk)} || dz < hz + ${f(CITY.sidewalk)}) {
          col = vec3(0.5, 0.49, 0.46) * (0.9 + 0.14 * n + 0.05 * grain);
          if (fract(p.x / 1.5) < 0.025 || fract(p.y / 1.5) < 0.025) col *= 0.86;
          if (dx < hx + 0.3 || dz < hz + 0.3) col = vec3(0.6, 0.59, 0.56);
        } else {
          // block interiors: courtyards and parking, darker and patchier than the sidewalks
          float patchy = vn(p * 0.06);
          col = mix(vec3(0.36, 0.35, 0.33), vec3(0.47, 0.45, 0.41), patchy) * (0.88 + 0.18 * n + 0.06 * grain);
          if (fract(p.x / 3.0) < 0.012 || fract(p.y / 3.0) < 0.012) col *= 0.92;
          // parking bays
          float bay = step(0.62, vn(floor(p / 24.0) + 7.0));
          if (bay > 0.5 && fract(p.x / 2.7) < 0.05 && fract(p.y / 12.0) > 0.15 && fract(p.y / 12.0) < 0.55) col = vec3(0.7);
        }
        diffuseColor.rgb = col;`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = rough;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        // street lights every 30 m along every kerb
        float lx = abs(dx - (hx + 0.6)), lz = mod(p.y, 30.0) - 15.0;
        float gx = abs(dz - (hz + 0.6)), gz = mod(p.x, 30.0) - 15.0;
        float pool = exp(-(lx * lx + lz * lz) / 22.0) + exp(-(gx * gx + gz * gz) / 22.0);
        totalEmissiveRadiance += vec3(1.0, 0.68, 0.38) * pool * 0.1 * uNight;`,
      );
  };
  m.customProgramCacheKey = () => "city-ground";
  return m;
}

/* ---------- towers ---------- */

function facadeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = NIGHT;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSeed;\nattribute float aKind;\nvarying vec3 vFP;\nvarying vec3 vFN;\nvarying float vSeed;\nvarying float vKind;")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        {
          vec4 fp = vec4(transformed, 1.0);
          vec3 fn = objectNormal;
          #ifdef USE_INSTANCING
            fp = instanceMatrix * fp;
            fn = mat3(instanceMatrix) * fn;
          #endif
          vFP = (modelMatrix * fp).xyz;
          vFN = normalize(mat3(modelMatrix) * fn);
          vSeed = aSeed; vKind = aKind;
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uNight;\nvarying vec3 vFP;\nvarying vec3 vFN;\nvarying float vSeed;\nvarying float vKind;\n${NOISE_GLSL}`)
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 FN = normalize(vFN);
        float roof = step(0.6, FN.y);
        vec2 fuv = abs(FN.x) > 0.5 ? vec2(vFP.z, vFP.y) : vec2(vFP.x, vFP.y);
        float kind = vKind;
        float bayW = kind < 0.5 ? 1.5 : kind < 1.5 ? 1.8 : 3.4;
        float flH = kind < 0.5 ? 3.7 : kind < 1.5 ? 3.6 : 3.1;
        vec2 cell = vec2(fuv.x / bayW, fuv.y / flH);
        vec2 fc = fract(cell);
        float floorTone = 0.9 + 0.1 * h21(vec2(floor(cell.y), vSeed * 13.0));
        float glass;
        vec3 wall, glassCol;
        if (kind < 0.5) {
          // unitised curtain wall: thin mullions, a dark spandrel at each slab
          glass = step(0.035, fc.x) * step(0.16, fc.y);
          wall = vec3(0.32, 0.34, 0.35);
          glassCol = mix(vec3(0.2, 0.27, 0.31), vec3(0.3, 0.35, 0.33), vSeed) * floorTone;
          glassCol = mix(glassCol, vec3(0.09, 0.11, 0.13), (1.0 - step(0.16, fc.y)) * step(0.035, fc.x));
        } else if (kind < 1.5) {
          // precast office: ribbon windows between stone bands
          glass = step(0.06, fc.x) * step(0.34, fc.y) * step(fc.y, 0.88);
          wall = mix(vec3(0.6, 0.57, 0.51), vec3(0.48, 0.47, 0.45), vSeed);
          glassCol = vec3(0.12, 0.15, 0.17) * floorTone;
        } else {
          // residential tower: floor-to-ceiling glass behind pale slab edges
          float slab = 1.0 - step(0.13, fc.y);
          glass = step(0.07, fc.x) * step(fc.x, 0.93) * (1.0 - slab);
          wall = mix(vec3(0.74, 0.72, 0.68), vec3(0.6, 0.58, 0.55), vSeed) * (1.0 - 0.1 * slab);
          glassCol = mix(vec3(0.14, 0.18, 0.2), vec3(0.2, 0.24, 0.25), vSeed) * floorTone;
        }
        // the ground floor is a darker lobby or shopfront band
        float base = step(fuv.y, 4.6) * (1.0 - roof);
        glass = mix(glass, step(0.06, fract(fuv.x / 6.0)), base);
        glass *= (1.0 - roof);
        float tone = 0.92 + 0.12 * vn(vec2(cell.x * 0.37, cell.y * 0.21) + vSeed * 40.0);
        diffuseColor.rgb = mix(wall, glassCol * tone, glass);
        if (roof > 0.5) diffuseColor.rgb = vec3(0.36, 0.36, 0.35) * (0.85 + 0.25 * vn(vFP.xz * 0.15));`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.82, 0.1, glass);")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = glass * (kind < 0.5 ? 0.75 : 0.45);")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float pick = h21(floor(cell) + vSeed * 97.0);
        float lit = step(0.58, pick) * glass * (1.0 - base * 0.4);
        vec3 warm = mix(vec3(1.0, 0.76, 0.48), vec3(0.85, 0.9, 1.0), step(0.85, h21(floor(cell) + 5.3)));
        totalEmissiveRadiance += warm * lit * (0.35 + 0.8 * h21(floor(cell) * 1.7 + 3.1)) * uNight;`,
      );
  };
  m.customProgramCacheKey = () => "city-facade";
  return m;
}

function Towers() {
  const list = useMemo(towers, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(list.map((t) => t.seed)), 1));
    g.setAttribute("aKind", new THREE.InstancedBufferAttribute(new Float32Array(list.map((t) => t.kind)), 1));
    return g;
  }, [list]);
  const mat = useMemo(facadeMaterial, []);
  useLayoutEffect(() => {
    const m = ref.current!;
    const o = new THREE.Object3D();
    list.forEach((t, i) => {
      o.position.set(t.x, -0.05, t.z);
      o.scale.set(t.w, t.h, t.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [list]);
  return <instancedMesh ref={ref} args={[geo, mat, list.length]} castShadow receiveShadow />;
}

/* ---------- traffic ---------- */

const CAR_COLORS = ["#f2f2ef", "#1c1d20", "#8e9397", "#2b3a4f", "#c7c9cb", "#5a1f22", "#111214", "#d9d4c8"];

/** A sedan from its side profile: body and glasshouse extruded across the width, plus wheels. */
function carGeometry() {
  const tint = (g: THREE.BufferGeometry, k: number) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute("uv");
    ng.setAttribute("color", new THREE.Float32BufferAttribute(new Array(ng.attributes.position.count * 3).fill(k), 3));
    return ng;
  };
  const extrude = (pts: [number, number][], width: number) => {
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 1 });
    g.translate(0, 0, -width / 2);
    g.rotateY(-Math.PI / 2);
    return g;
  };
  const body = extrude([[-2.36, 0.3], [2.3, 0.3], [2.38, 0.6], [2.2, 0.8], [0.95, 0.92], [-1.75, 0.94], [-2.3, 0.84], [-2.4, 0.56]], 1.74);
  const glass = extrude([[0.9, 0.93], [0.2, 1.38], [-1.0, 1.4], [-1.7, 0.95]], 1.5);
  const wheels: THREE.BufferGeometry[] = [];
  for (const x of [-0.84, 0.84]) for (const z of [-1.45, 1.42]) {
    const w = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14);
    w.rotateZ(Math.PI / 2);
    w.translate(x, 0.34, z);
    wheels.push(tint(w, 0.05));
  }
  return mergeGeometries([tint(body, 1), tint(glass, 0.1), ...wheels])!;
}

function lightGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-0.62, 0.62]) {
    const head = new THREE.BoxGeometry(0.34, 0.12, 0.05); head.translate(sx, 0.78, 2.36);
    const tail = new THREE.BoxGeometry(0.34, 0.12, 0.05); tail.translate(sx, 0.82, -2.36);
    head.setAttribute("color", new THREE.Float32BufferAttribute(new Array(head.attributes.position.count * 3).fill(0).map((_, i) => [1, 0.95, 0.85][i % 3] * 3), 3));
    tail.setAttribute("color", new THREE.Float32BufferAttribute(new Array(tail.attributes.position.count * 3).fill(0).map((_, i) => [1, 0.08, 0.05][i % 3] * 2.5), 3));
    parts.push(head, tail);
  }
  return mergeGeometries(parts)!;
}

interface Car { lane: number; t: number }

function Traffic() {
  const L = useMemo(lanes, []);
  const cars = useMemo(() => {
    const out: Car[] = [];
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    L.forEach((l, i) => {
      const len = l.b - l.a;
      const n = Math.max(2, Math.round(len / (l.axis === "z" && Math.abs(l.c - CITY.boulevard.x) < 20 ? 55 : 120)));
      for (let k = 0; k < n; k++) out.push({ lane: i, t: (k + r() * 0.6) / n });
    });
    return out;
  }, [L]);
  const speeds = useMemo(() => L.map((_, i) => 11 + ((i * 37) % 7)), [L]);
  const body = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(carGeometry, []);
  const lgeo = useMemo(lightGeometry, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.55 }), []);
  const lmat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, toneMapped: false }), []);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    cars.forEach((_, i) => body.current!.setColorAt(i, c.set(CAR_COLORS[(i * 5) % CAR_COLORS.length])));
    body.current!.instanceColor!.needsUpdate = true;
  }, [cars]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    const b = body.current, li = lights.current;
    if (!b || !li) return;
    cars.forEach((car, i) => {
      const l = L[car.lane];
      const len = l.b - l.a;
      car.t = (car.t + (speeds[car.lane] * step) / len) % 1;
      const s = l.dir > 0 ? l.a + car.t * len : l.b - car.t * len;
      o.scale.setScalar(0.94 + ((i * 13) % 7) * 0.025);
      if (l.axis === "z") { o.position.set(l.c, 0, s); o.rotation.set(0, l.dir > 0 ? 0 : Math.PI, 0); }
      else { o.position.set(s, 0, l.c); o.rotation.set(0, l.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0); }
      o.updateMatrix();
      b.setMatrixAt(i, o.matrix);
      li.setMatrixAt(i, o.matrix);
    });
    b.instanceMatrix.needsUpdate = true;
    li.instanceMatrix.needsUpdate = true;
    lmat.opacity = Math.min(1, NIGHT.value * 1.3);
    li.visible = lmat.opacity > 0.02;
  });
  return (
    <group>
      <instancedMesh ref={body} args={[geo, mat, cars.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={lights} args={[lgeo, lmat, cars.length]} frustumCulled={false} />
    </group>
  );
}

/* ---------- the city ---------- */

export function City() {
  const ground = useMemo(groundMaterial, []);
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cfc8bb", roughness: 0.85 }), []);
  useFrame((_, dt) => {
    const t = NIGHT_OF[useStore.getState().time];
    NIGHT.value += (t - NIGHT.value) * Math.min(1, dt * 2.5);
  });
  const L = CITY.lake;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} material={ground} receiveShadow>
        <shapeGeometry args={[CITY_GROUND]} />
      </mesh>
      {/* seawalls along both shores outside the estate */}
      <mesh material={stone} position={[0, -0.45, L.z1 + 0.6]} receiveShadow><boxGeometry args={[L.x1 - L.x0, 1.0, 1.2]} /></mesh>
      <mesh material={stone} position={[(L.x0 + CITY.estate.x0) / 2, -0.45, L.z0 - 0.6]} receiveShadow><boxGeometry args={[CITY.estate.x0 - L.x0, 1.0, 1.2]} /></mesh>
      <mesh material={stone} position={[(CITY.estate.x1 + L.x1) / 2, -0.45, L.z0 - 0.6]} receiveShadow><boxGeometry args={[L.x1 - CITY.estate.x1, 1.0, 1.2]} /></mesh>
      <Towers />
      <Traffic />
    </group>
  );
}
