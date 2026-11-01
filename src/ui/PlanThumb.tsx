import type { BuiltVilla } from "../data/dsl";

/** Floor plan drawn from the villa's own data, street side at the bottom. */
export function PlanThumb({
  villa, level = 0, className, pose, onTap, lit, active,
}: {
  villa: BuiltVilla; level?: number; className?: string;
  pose?: { x: number; z: number; yaw: number } | null;
  onTap?: (x: number, z: number) => void;
  lit?: Record<string, boolean>;
  active?: string | null;
}) {
  const rooms = villa.rooms.filter((r) => r.level === level && r.type !== "garden" && !(r.type === "driveway" && r.z0 < 0));
  const pool = level === 0 ? villa.pool : undefined;
  const xs = rooms.flatMap((r) => [r.x0, r.x1]).concat(pool ? [pool.x0, pool.x1] : []);
  const zs = rooms.flatMap((r) => [r.z0, r.z1]).concat(pool ? [pool.z0, pool.z1] : []);
  const x0 = Math.min(...xs) - 0.6, x1 = Math.max(...xs) + 0.6, z0 = Math.min(...zs) - 0.6, z1 = Math.max(...zs) + 0.6;
  const X = (x: number) => x1 - x, Y = (z: number) => z1 - z;
  const W = x1 - x0, H = z1 - z0;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`${villa.name} floor plan, ${level ? "upper" : "ground"} floor`}
      onClick={onTap ? (e) => {
        const svg = e.currentTarget, pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
        onTap(x1 - p.x, z1 - p.y);
      } : undefined}
    >
      {rooms.filter((r) => r.outdoor).map((r) => (
        <rect key={r.id} x={X(r.x1)} y={Y(r.z1)} width={r.x1 - r.x0} height={r.z1 - r.z0} fill={lit?.[r.id] ? "#f6d9a6" : "#e6dfcf"} />
      ))}
      {pool && <rect x={X(pool.x1)} y={Y(pool.z1)} width={pool.x1 - pool.x0} height={pool.z1 - pool.z0} rx={0.3} fill={lit?.pooldeck ? "#7fd3e6" : "#8cc3cf"} />}
      {pool?.spa && <rect x={X(pool.spa.x1)} y={Y(pool.spa.z1)} width={pool.spa.x1 - pool.spa.x0} height={pool.spa.z1 - pool.spa.z0} rx={0.3} fill="#8cc3cf" />}
      {rooms.filter((r) => !r.outdoor).map((r) => (
        <rect
          key={r.id} x={X(r.x1)} y={Y(r.z1)} width={r.x1 - r.x0} height={r.z1 - r.z0}
          fill={active === r.id ? "#d4f2f7" : lit?.[r.id] ? "#fbe3b4" : "#fffdf8"} stroke="#1b231e" strokeWidth={0.16}
        />
      ))}
      {villa.stairs.filter((s) => s.level === level || s.level === level - 1).map((s, i) => {
        const n = 9, along = s.dir === "+z" || s.dir === "-z";
        return (
          <g key={i} stroke="#46524a" strokeWidth={0.05}>
            {Array.from({ length: n }, (_, k) => along
              ? <line key={k} x1={X(s.x1)} x2={X(s.x0)} y1={Y(s.z0 + ((s.z1 - s.z0) * (k + 0.5)) / n)} y2={Y(s.z0 + ((s.z1 - s.z0) * (k + 0.5)) / n)} />
              : <line key={k} y1={Y(s.z1)} y2={Y(s.z0)} x1={X(s.x0 + ((s.x1 - s.x0) * (k + 0.5)) / n)} x2={X(s.x0 + ((s.x1 - s.x0) * (k + 0.5)) / n)} />)}
          </g>
        );
      })}
      {pose && (
        <g transform={`translate(${X(pose.x)} ${Y(pose.z)}) rotate(${(-pose.yaw * 180) / Math.PI + 180})`}>
          <path d="M0 0 L-1.6 -3.4 A3.6 3.6 0 0 1 1.6 -3.4 Z" fill="#1fb6cf" opacity={0.35} transform="scale(1 -1)" />
          <circle r={0.55} fill="#0b5f6d" stroke="white" strokeWidth={0.18} />
        </g>
      )}
    </svg>
  );
}
