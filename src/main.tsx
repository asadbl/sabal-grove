import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { useStore } from "./store";
import { LOTS, toWorld } from "./data/community";
import { setWalkGoal } from "./three/Walker";

// Dev-only handles for the capture scripts in scripts/.
if (import.meta.env.DEV) Object.assign(window, { __store: useStore, __walkTo: setWalkGoal, __lots: LOTS, __toWorld: toWorld });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
