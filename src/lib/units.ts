export type Units = "imperial" | "metric";

const FT = 3.28084;

export function len(m: number, u: Units, precise = false) {
  if (u === "metric") return precise || m < 10 ? `${m.toFixed(2)} m` : `${m.toFixed(1)} m`;
  const totalIn = Math.round(m * FT * 12);
  const ft = Math.floor(totalIn / 12), inch = totalIn % 12;
  return inch ? `${ft}′ ${inch}″` : `${ft}′`;
}

/** Furniture-scale length: centimetres or inches. */
export function small(m: number, u: Units) {
  if (u === "metric") return `${Math.round(m * 100)} cm`;
  const inch = m * FT * 12;
  return `${inch >= 100 ? Math.round(inch) : Math.round(inch * 2) / 2}″`;
}

export function dims(w: number, d: number, u: Units) {
  return u === "metric" ? `${w.toFixed(2)} × ${d.toFixed(2)} m` : `${len(w, u)} × ${len(d, u)}`;
}

export function area(m2: number, u: Units) {
  return u === "metric"
    ? `${m2 < 100 ? m2.toFixed(1) : Math.round(m2).toLocaleString("en-US")} m²`
    : `${Math.round(m2 * FT * FT).toLocaleString("en-US")} sq ft`;
}

export function price(n: number) {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(n % 100_000 === 0 ? 1 : 2)}M`
    : `$${Math.round(n / 1000)}K`;
}

export const priceFull = (n: number) => `$${n.toLocaleString("en-US")}`;
