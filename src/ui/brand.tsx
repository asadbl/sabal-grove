import type { BuiltVilla } from "../data/dsl";

export const SALES_EMAIL = "sales@sabalgrove.example";

export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#1f4d3a" />
      <path d="M16 26 C16 20 16.5 15 17 11" stroke="#f6f2ea" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M17 11 C13 8 9 9 6.5 12 M17 11 C20 7.5 24 7.5 26.5 10.5 M17 11 C15.5 7 16 5 18 3.5 M17 11 C12 11 9.5 14.5 9 17 M17 11 C22 11 24.5 14 25 17" stroke="#f0a43a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Status({ s, className = "" }: { s: BuiltVilla["status"]; className?: string }) {
  const tone = s === "Available" ? "bg-ok/12 text-ok" : s === "Reserved" ? "bg-warn/14 text-warn" : "bg-sold/12 text-sold";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${tone} ${className}`}><span className="size-1.5 rounded-full bg-current" />{s}</span>;
}
