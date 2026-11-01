import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useStore } from "../store";

/** Fullscreen photographs, paged with the arrows, a swipe or the keyboard. */
export function Viewer() {
  const viewer = useStore((s) => s.viewer);
  const set = useStore((s) => s.set);
  const close = useRef<HTMLButtonElement>(null);
  const touch = useRef<number | null>(null);
  const n = viewer?.photos.length ?? 0;
  const go = (d: number) => viewer && set({ viewer: { ...viewer, i: (viewer.i + d + n) % n } });

  useEffect(() => {
    if (!viewer) return;
    close.current?.focus();
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") set({ viewer: null });
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  if (!viewer) return null;
  const p = viewer.photos[viewer.i];
  const nav = "pointer-events-auto grid size-12 place-items-center rounded-full bg-paper/12 text-paper backdrop-blur hover:bg-paper/25";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.caption}
      className="rise fixed inset-0 z-[60] flex flex-col bg-[#0b0f0c]/[.97] text-paper backdrop-blur-md"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <p className="min-w-0 truncate text-[15px] font-semibold">{p.caption}</p>
        <div className="flex items-center gap-3">
          {n > 1 && <span className="text-[13px] text-paper/60 tnum">{viewer.i + 1} / {n}</span>}
          <button ref={close} type="button" className={nav} onClick={() => set({ viewer: null })} aria-label="Close photos"><X className="size-5" /></button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 px-2 pb-2 sm:px-16 sm:pb-6">
        <img key={p.src} src={p.src} alt={p.caption} className="rise size-full object-contain" />
        {n > 1 && (
          <div className="pointer-events-none absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between">
            <button type="button" className={nav} onClick={() => go(-1)} aria-label="Previous photo"><ChevronLeft className="size-6" /></button>
            <button type="button" className={nav} onClick={() => go(1)} aria-label="Next photo"><ChevronRight className="size-6" /></button>
          </div>
        )}
      </div>
      <p className="px-4 pb-4 text-center text-[12.5px] text-paper/50 sm:px-6">Visualisation made from the 3D model</p>
    </div>
  );
}
