import type { Kind } from "./types";

export type JunctionId = "ojuelegba" | "obalende" | "lekki";

export type Junction = {
  id: JunctionId;
  name: string;
  blurb: string;
  red: number;                  // seconds of red light, before randomness
  tier: 1 | 2 | 3;              // 1 = first junction. Higher tiers are faster and pay more.
  perLane: [number, number];    // cars queued per lane, min and max (the queue also keeps filling while the light is red)
  flow: number;                 // how thick the traffic is while the light is green
  jam: number;                  // chance of a go-slow hold-up on a normal light
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
    blurb: "Lots of okadas and keke. Long red light, small money.",
    red: 24, tier: 1,
    perLane: [8, 10],
    flow: 0.6, jam: 0.1,
    mix: { okada: 5, keke: 4, danfo: 3, car: 2, jeep: 0.3 },
    skyTop: "#ffcf5c", skyBottom: "#ff9a5a",
    road: "#3f3a3c", pavement: "#d8b384",
  },
  obalende: {
    id: "obalende",
    name: "Obalende",
    blurb: "Danfos and office cars. Busy roads, so go-slows are common.",
    red: 19, tier: 2,
    perLane: [8, 10],
    flow: 1, jam: 0.4,
    mix: { okada: 2, keke: 2, danfo: 5, car: 3, jeep: 0.6 },
    skyTop: "#ffd98a", skyBottom: "#ff8f6b",
    road: "#35373d", pavement: "#bfc0bd",
  },
  lekki: {
    id: "lekki",
    name: "Lekki toll gate",
    blurb: "Jeeps and nice cars. Short red light, big money, always busy.",
    red: 14, tier: 3,
    perLane: [7, 9],
    flow: 1.3, jam: 0.6,
    mix: { okada: 0.4, keke: 0, danfo: 0.5, car: 5, jeep: 3 },
    skyTop: "#ffb86b", skyBottom: "#e8647c",
    road: "#2c2e34", pavement: "#e9e5d6",
  },
};

export const JUNCTION_LIST: Junction[] = [JUNCTIONS.ojuelegba, JUNCTIONS.obalende, JUNCTIONS.lekki];
