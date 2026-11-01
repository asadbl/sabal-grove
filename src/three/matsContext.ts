import { createContext, useContext } from "react";
import type { VillaMats } from "../lib/materials";

export const MatsContext = createContext<VillaMats | null>(null);
export const useMats = () => {
  const m = useContext(MatsContext);
  if (!m) throw new Error("no villa materials");
  return m;
};
