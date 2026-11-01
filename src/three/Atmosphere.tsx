import { Environment, Lightformer, Sky, Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useStore, type TimeOfDay } from "../store";

interface Look {
  sunEl: number; sunAz: number; sun: string; sunI: number; hemiSky: string; hemiGround: string; hemiI: number;
  env: number; fog: string; fogNear: number; fogFar: number; turbidity: number; rayleigh: number; exposure: number;
}

export const LOOKS: Record<TimeOfDay, Look> = {
  day: { sunEl: 52, sunAz: 215, sun: "#fff4e2", sunI: 2.6, hemiSky: "#cfe0f5", hemiGround: "#7a7d62", hemiI: 0.6, env: 0.85, fog: "#c9d6df", fogNear: 320, fogFar: 1900, turbidity: 4, rayleigh: 1.1, exposure: 1 },
  dusk: { sunEl: 15, sunAz: 250, sun: "#ffbd85", sunI: 2.8, hemiSky: "#a9b2d8", hemiGround: "#7a6a56", hemiI: 0.85, env: 0.9, fog: "#c9a99a", fogNear: 280, fogFar: 1600, turbidity: 8, rayleigh: 2.6, exposure: 1.05 },
  night: { sunEl: 38, sunAz: 120, sun: "#9fb4ff", sunI: 0.3, hemiSky: "#34477a", hemiGround: "#1a1d26", hemiI: 0.22, env: 0.16, fog: "#0d1424", fogNear: 260, fogFar: 1500, turbidity: 1, rayleigh: 0.2, exposure: 1.1 },
};

export function sunDir(t: TimeOfDay) {
  const L = LOOKS[t];
  const el = (L.sunEl * Math.PI) / 180, az = (L.sunAz * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
}

/** Directional sun whose shadow frustum follows the subject. */
export function Atmosphere({ focus, radius }: { focus: [number, number, number]; radius: number }) {
  const time = useStore((s) => s.time);
  const L = LOOKS[time];
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const { scene } = useThree();
  const target = useMemo(() => new THREE.Object3D(), []);
  const dir = useMemo(() => sunDir(time), [time]);

  useEffect(() => {
    scene.fog = new THREE.Fog(L.fog, L.fogNear, L.fogFar);
    scene.environmentIntensity = L.env;
    scene.add(target);
    return () => { scene.remove(target); };
  }, [scene, L, target]);

  useFrame(() => {
    const s = sun.current;
    if (!s) return;
    target.position.set(...focus);
    s.target = target;
    s.position.set(focus[0] + dir.x * 160, focus[1] + dir.y * 160, focus[2] + dir.z * 160);
    const cam = s.shadow.camera;
    const r = radius;
    if (cam.right !== r) {
      cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
      cam.near = 1; cam.far = 400;
      cam.updateProjectionMatrix();
    }
  });

  // Moon at night lights from the moon's side; the sun's elevation drives the sky dome.
  const skySun = time === "night" ? new THREE.Vector3(0.2, -0.25, -1) : dir.clone().multiplyScalar(100);

  return (
    <>
      <Sky key={time} distance={9000} sunPosition={skySun} turbidity={L.turbidity} rayleigh={L.rayleigh} mieCoefficient={0.005} mieDirectionalG={0.85} />
      {time === "night" && <Stars radius={600} depth={80} count={3000} factor={6} fade speed={0.3} />}
      <hemisphereLight ref={hemi} args={[L.hemiSky, L.hemiGround, L.hemiI]} />
      <directionalLight
        ref={sun}
        color={L.sun}
        intensity={L.sunI}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <Environment key={`env-${time}`} frames={1} resolution={256} environmentIntensity={L.env}>
        <Sky distance={4500} sunPosition={skySun} turbidity={L.turbidity} rayleigh={L.rayleigh} mieCoefficient={0.005} mieDirectionalG={0.85} />
        {time !== "night" && <Lightformer form="circle" intensity={time === "day" ? 4 : 2} color={L.sun} position={dir.clone().multiplyScalar(40).toArray()} scale={12} />}
        <Lightformer form="rect" intensity={time === "night" ? 0.2 : 1} color={L.hemiSky} position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} />
        <Lightformer form="rect" intensity={time === "night" ? 0.05 : 0.5} color={L.hemiGround} position={[0, -10, 0]} rotation-x={-Math.PI / 2} scale={[80, 80, 1]} />
      </Environment>
    </>
  );
}
