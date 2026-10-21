import type { Kind } from "./types";

export type JunctionId = "ojuelegba" | "obalende" | "lekki";

export type Junction = {
  id: JunctionId;
  name: string;
  blurb: string;
  red: number;                  // seconds of red light, before randomness
  perLane: [number, number];    // cars queued per lane, min and max
  mix: Record<Kind, number>;    // how often each vehicle shows up
  skyTop: string;
  skyBottom: string;
  road: string;                 // asphalt colour
  pavement: string;             // pavement colour
};

export const JUNCTIONS: Record<JunctionId, Junction> = {
  ojuelegba: {
    id: "ojuelegba",
    name: "Ojuelegba",
    blurb: "Okadas and keke everywhere. Long light, small pay.",
    red: 24,
    perLane: [4, 6],
    mix: { okada: 5, keke: 4, danfo: 3, car: 2, jeep: 0.3 },
    skyTop: "#ffcf5c", skyBottom: "#ff9a5a",
    road: "#3f3a3c", pavement: "#d8b384",
  },
  obalende: {
    id: "obalende",
    name: "Obalende",
    blurb: "Danfo crowds and office cars. Snacks move fast here.",
    red: 19,
    perLane: [3, 5],
    mix: { okada: 2, keke: 2, danfo: 5, car: 3, jeep: 0.6 },
    skyTop: "#ffd98a", skyBottom: "#ff8f6b",
    road: "#35373d", pavement: "#bfc0bd",
  },
  lekki: {
    id: "lekki",
    name: "Lekki toll gate",
    blurb: "Jeeps and tinted glass. Short light, big pay when one rolls down.",
    red: 14,
    perLane: [3, 4],
    mix: { okada: 0.4, keke: 0, danfo: 0.5, car: 5, jeep: 3 },
    skyTop: "#ffb86b", skyBottom: "#e8647c",
    road: "#2c2e34", pavement: "#e9e5d6",
  },
};

export const JUNCTION_LIST: Junction[] = [JUNCTIONS.ojuelegba, JUNCTIONS.obalende, JUNCTIONS.lekki];
