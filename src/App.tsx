import { useEffect, useState } from "react";
import { Scene } from "./three/Scene";
import { useStore } from "./store";
import { Explore } from "./ui/Explore";
import { Landing } from "./ui/Landing";
import { Viewer } from "./ui/Viewer";

function useViewport() {
  const [s, setS] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setS({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return s;
}

export default function App() {
  const layout = useStore((s) => s.layout);
  const villaId = useStore((s) => s.villaId);
  const mode = useStore((s) => s.mode);
  const panelOpen = useStore((s) => s.panelOpen);
  const still = useStore((s) => s.still);
  const { w, h } = useViewport();
  const portrait = w < 900 && h > w * 0.9;
  const panel = layout === "landing" || still || (villaId && mode === "walk") ? { right: 0, bottom: 0 }
    : portrait ? { right: 0, bottom: villaId && panelOpen ? Math.round(h * 0.42) + 80 : 70 }
    : { right: 356, bottom: 0 };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#c9dbe8]">
      <div className="absolute inset-0">
        <Scene panel={panel} />
      </div>
      {!still && layout === "landing" && <Landing />}
      {!still && layout === "explore" && <Explore portrait={portrait} />}
      <Viewer />
    </div>
  );
}
