import type { JunctionId } from "./junctions";
import type { ItemId } from "./types";

/**
 * The starting junction's markets sit on untarred dirt roads; the richer ones are tarred.
 * Every junction has its own three markets. A run goes to one of them at random, so you
 * never know which until you are standing at the start. Better markets stock dearer goods
 * and drop bigger cash, and they charge more to get in.
 */
export type Look = {
  skyTop: string; skyBottom: string; sun: string; sunX: number;
  skyline: "shacks" | "blocks" | "glass";
  skylineColors: string[]; lit: string;
  ground: [string, string];            // far and near
  road: string;
  surface?: "dirt";                    // untarred road: ruts, potholes, and mud when it rains. Tarred when left out.
  shopWalls: string[]; awnings: [string, string]; door: string;
  umbrellas: string[]; goods: string[];
  mix: [number, number, number];       // share of roadside shops, stalls and trees
  tree: "leafy" | "palm";
  bus: { body: string; label: string };
  gate: { board: string; post: string; trim: string; text: string };
};

export type Market = {
  id: string;
  junction: JunctionId;
  name: string;
  blurb: string;
  tier: 1 | 2 | 3;
  fee: number;                          // paid up front, win or lose
  items: Partial<Record<ItemId, number>>; // what you can pick up here, as weights
  cash: [number, number, number];       // the three cash bundle sizes
  cashChance: number;                   // chance that a pickup is cash
  look: Look;
};

/** The fine for getting caught is twice the entry fee, so dearer markets also cost more to lose. */
export const fineFor = (m: Market) => m.fee * 2; // same as the server

const cheap = { cash: [30, 60, 120] as [number, number, number] };
const mid = { cash: [60, 120, 300] as [number, number, number] };
const rich = { cash: [150, 350, 800] as [number, number, number] };

export const MARKETS: Market[] = [
  // ---------------------------------------------------------------- Ojuelegba: street markets
  {
    id: "mushin", junction: "ojuelegba", name: "Mushin Market", tier: 1, fee: 100, ...cheap, cashChance: 0.2,
    blurb: "Cheap to enter, small prizes.",
    items: { water: 0.4, fruit: 0.25, snack: 0.2, bread: 0.15 },
    look: {
      skyTop: "#ffd36b", skyBottom: "#ff9a5a", sun: "rgba(255,255,255,.4)", sunX: 700,
      skyline: "shacks", skylineColors: ["#b85c2f", "#c9703a", "#8d5a3b", "#a8452f", "#d9a441"], lit: "rgba(255,236,170,.65)",
      ground: ["#bba878", "#d9c493"], road: "#8b6742", surface: "dirt",
      shopWalls: ["#a85a55", "#c4894f", "#8d5a3b", "#7d9a6b"], awnings: ["#e4382f", "#fff8e1"], door: "#3b2a1a",
      umbrellas: ["#e4382f", "#0e8f4e", "#f2c200", "#2b6cb0"], goods: ["#ff8a3d", "#f2c200", "#0e8f4e", "#e4382f", "#ff8a3d"],
      mix: [0.4, 0.45, 0.15], tree: "leafy",
      bus: { body: "#f7b500", label: "GOD DEY" },
      gate: { board: "#fff8e1", post: "#0e8f4e", trim: "#e4382f", text: "MUSHIN MARKET" },
    },
  },
  {
    id: "oshodi", junction: "ojuelegba", name: "Oshodi Market", tier: 1, fee: 140, ...cheap, cashChance: 0.22,
    blurb: "Lots of water, drinks and hot bread.",
    items: { water: 0.3, drink: 0.25, snack: 0.2, bread: 0.15, fruit: 0.1 },
    look: {
      skyTop: "#e8b27a", skyBottom: "#d98866", sun: "rgba(255,225,170,.5)", sunX: 220,
      skyline: "blocks", skylineColors: ["#8a4b4f", "#a85a55"], lit: "rgba(255,236,170,.65)",
      ground: ["#b09c78", "#c9b58a"], road: "#7e5d3d", surface: "dirt",
      shopWalls: ["#a85a55", "#8a4b4f", "#c4894f", "#6f8aa0"], awnings: ["#2b6cb0", "#fff8e1"], door: "#3b2a1a",
      umbrellas: ["#2b6cb0", "#e4382f", "#f2c200", "#0e8f4e"], goods: ["#f2c200", "#e4382f", "#4aa3df", "#ff8a3d", "#f2f2f2"],
      mix: [0.5, 0.3, 0.2], tree: "leafy",
      bus: { body: "#f7b500", label: "OSHODI" },
      gate: { board: "#fff8e1", post: "#2b6cb0", trim: "#f2c200", text: "OSHODI MARKET" },
    },
  },
  {
    id: "yaba", junction: "ojuelegba", name: "Yaba Market", tier: 1, fee: 200, ...cheap, cashChance: 0.24,
    blurb: "Snacks and drinks, and some chargers.",
    items: { drink: 0.3, snack: 0.3, water: 0.2, bread: 0.1, charger: 0.1 },
    look: {
      skyTop: "#ffd98a", skyBottom: "#ff9a7a", sun: "rgba(255,255,255,.45)", sunX: 760,
      skyline: "blocks", skylineColors: ["#7f8c9d", "#6a7482", "#8d97a3"], lit: "rgba(214,232,247,.75)",
      ground: ["#c2bfae", "#d6d3c3"], road: "#876a4a", surface: "dirt",
      shopWalls: ["#6f8aa0", "#7d9a6b", "#c4894f", "#a85a55"], awnings: ["#7a3fb0", "#fff8e1"], door: "#2a2630",
      umbrellas: ["#7a3fb0", "#2b6cb0", "#e4382f", "#f2c200"], goods: ["#f2c200", "#7a3fb0", "#2fbf71", "#e4382f", "#4aa3df"],
      mix: [0.5, 0.35, 0.15], tree: "leafy",
      bus: { body: "#f7b500", label: "YABA" },
      gate: { board: "#fff8e1", post: "#7a3fb0", trim: "#f2c200", text: "YABA MARKET" },
    },
  },

  // ---------------------------------------------------------------- Obalende: trading hubs
  {
    id: "balogun", junction: "obalende", name: "Balogun Market", tier: 2, fee: 230, ...mid, cashChance: 0.24,
    blurb: "A big market with a bit of everything.",
    items: { drink: 0.3, snack: 0.25, water: 0.15, bread: 0.15, charger: 0.15 },
    look: {
      skyTop: "#9fc6e8", skyBottom: "#e6eef2", sun: "rgba(255,255,255,.7)", sunX: 700,
      skyline: "blocks", skylineColors: ["#7d8896", "#6a7482", "#8d97a3", "#5f6a78"], lit: "rgba(214,232,247,.75)",
      ground: ["#b8b8b2", "#cfcfc7"], road: "#35373d",
      shopWalls: ["#a85a55", "#6f8aa0", "#c4894f", "#7d9a6b"], awnings: ["#e4382f", "#fff8e1"], door: "#3b2a1a",
      umbrellas: ["#e4382f", "#0e8f4e", "#f2c200", "#2b6cb0"], goods: ["#e4382f", "#f2c200", "#0e8f4e", "#ff8a3d", "#4aa3df"],
      mix: [0.55, 0.3, 0.15], tree: "leafy",
      bus: { body: "#f7b500", label: "GOD DEY" },
      gate: { board: "#fff8e1", post: "#0e8f4e", trim: "#e4382f", text: "BALOGUN MARKET" },
    },
  },
  {
    id: "idumota", junction: "obalende", name: "Idumota Market", tier: 2, fee: 340, ...mid, cashChance: 0.26,
    blurb: "Chargers and a few gadgets.",
    items: { snack: 0.3, drink: 0.3, charger: 0.2, gadget: 0.1, bread: 0.1 },
    look: {
      skyTop: "#ffd29a", skyBottom: "#f08f7a", sun: "rgba(255,240,200,.55)", sunX: 180,
      skyline: "blocks", skylineColors: ["#9a5a4f", "#b36a58", "#8a4b4f"], lit: "rgba(255,236,170,.7)",
      ground: ["#c4ad8a", "#d8c6a2"], road: "#2f3036",
      shopWalls: ["#b36a58", "#9a5a4f", "#c4894f", "#6f8aa0"], awnings: ["#2b6cb0", "#fff8e1"], door: "#2f1f14",
      umbrellas: ["#2b6cb0", "#e4382f", "#f2c200", "#7a3fb0"], goods: ["#111111", "#e4382f", "#f2c200", "#4aa3df", "#9b6bff"],
      mix: [0.6, 0.3, 0.1], tree: "leafy",
      bus: { body: "#f7b500", label: "IDUMOTA" },
      gate: { board: "#fff8e1", post: "#b23a2f", trim: "#f7b500", text: "IDUMOTA MARKET" },
    },
  },
  {
    id: "computer", junction: "obalende", name: "Computer Village", tier: 2, fee: 490, ...mid, cashChance: 0.28,
    blurb: "Chargers and gadgets. Costs more to enter.",
    items: { charger: 0.4, gadget: 0.2, drink: 0.15, snack: 0.15, bread: 0.1 },
    look: {
      skyTop: "#7fb2e0", skyBottom: "#dfeaf3", sun: "rgba(255,255,255,.75)", sunX: 760,
      skyline: "blocks", skylineColors: ["#5f6a78", "#7d8896", "#4f5b6a"], lit: "rgba(160,225,255,.8)",
      ground: ["#a9adb4", "#c3c7cd"], road: "#2c2e34",
      shopWalls: ["#5f6a78", "#2b6cb0", "#7d8896", "#1f9fb0"], awnings: ["#2b6cb0", "#e9f1f7"], door: "#1c2430",
      umbrellas: ["#2b6cb0", "#7a3fb0", "#1f9fb0", "#e4382f"], goods: ["#2b6cb0", "#111111", "#e4382f", "#9b6bff", "#2fbf71"],
      mix: [0.6, 0.3, 0.1], tree: "leafy",
      bus: { body: "#2b6cb0", label: "IKEJA" },
      gate: { board: "#eef4fa", post: "#2b6cb0", trim: "#2fbf71", text: "COMPUTER VILLAGE" },
    },
  },

  // ---------------------------------------------------------------- Lekki: malls and craft markets
  {
    id: "craft", junction: "lekki", name: "Lekki Craft Market", tier: 3, fee: 600, ...rich, cashChance: 0.26,
    blurb: "Sunglasses and perfume. Rich buyers pay well.",
    items: { drink: 0.3, shades: 0.3, snack: 0.2, perfume: 0.1, gadget: 0.1 },
    look: {
      skyTop: "#4fb0f2", skyBottom: "#d3f0ff", sun: "rgba(255,255,255,.85)", sunX: 780,
      skyline: "blocks", skylineColors: ["#c8b79a", "#d8c9ad", "#b9a98c"], lit: "rgba(255,255,255,.7)",
      ground: ["#e3d9b8", "#efe8cf"], road: "#2c2e34",
      shopWalls: ["#e9d8b4", "#d9a441", "#8fc1a8", "#e8a1a1"], awnings: ["#2f9a4a", "#fff8e1"], door: "#4a3a28",
      umbrellas: ["#e8412c", "#2f9a4a", "#f2c200", "#1f9fb0"], goods: ["#e8412c", "#2f9a4a", "#f2c200", "#9b6bff", "#1f9fb0"],
      mix: [0.35, 0.4, 0.25], tree: "palm",
      bus: { body: "#eceff3", label: "BRT" },
      gate: { board: "#fff8e1", post: "#c2762f", trim: "#2f9a4a", text: "LEKKI CRAFT MARKET" },
    },
  },
  {
    id: "ikate", junction: "lekki", name: "Ikate Plaza", tier: 3, fee: 760, ...rich, cashChance: 0.28,
    blurb: "Gadgets, sunglasses and perfume.",
    items: { drink: 0.25, gadget: 0.25, shades: 0.2, perfume: 0.2, snack: 0.1 },
    look: {
      skyTop: "#ffb86b", skyBottom: "#e8647c", sun: "rgba(255,245,210,.6)", sunX: 200,
      skyline: "glass", skylineColors: ["#5fb8d9", "#1f6f98"], lit: "rgba(255,255,255,.35)",
      ground: ["#e5dfce", "#efeadb"], road: "#25272d",
      shopWalls: ["#dfe8ee", "#c9d8e2", "#e9e5d6", "#b9d3df"], awnings: ["#1f6f98", "#e9f4fa"], door: "#1d3f55",
      umbrellas: ["#1f6f98", "#f2c200", "#e8647c", "#2f9a4a"], goods: ["#9b6bff", "#f2c200", "#e8647c", "#1f9fb0", "#111111"],
      mix: [0.55, 0.2, 0.25], tree: "palm",
      bus: { body: "#eceff3", label: "BRT" },
      gate: { board: "#f4f8fb", post: "#1f6f98", trim: "#f2c200", text: "IKATE PLAZA" },
    },
  },
  {
    id: "vimall", junction: "lekki", name: "Victoria Island Mall", tier: 3, fee: 930, ...rich, cashChance: 0.3,
    blurb: "The most expensive entry, and the best things.",
    items: { perfume: 0.3, gadget: 0.3, shades: 0.2, drink: 0.15, snack: 0.05 },
    look: {
      skyTop: "#2f8fd8", skyBottom: "#bfe6ff", sun: "rgba(255,255,255,.85)", sunX: 140,
      skyline: "glass", skylineColors: ["#3a86b8", "#164f73"], lit: "rgba(255,255,255,.4)",
      ground: ["#e9e5d6", "#f4f1e6"], road: "#1f2126",
      shopWalls: ["#cfdce6", "#b9cbdb", "#e9e5d6", "#9fc0d4"], awnings: ["#111111", "#f2c200"], door: "#16212b",
      umbrellas: ["#111111", "#f2c200", "#1f6f98", "#e8647c"], goods: ["#f2c200", "#e8647c", "#9b6bff", "#111111", "#1f9fb0"],
      mix: [0.7, 0.1, 0.2], tree: "palm",
      bus: { body: "#eceff3", label: "BRT" },
      gate: { board: "#f4f8fb", post: "#111111", trim: "#f2c200", text: "VICTORIA ISLAND MALL" },
    },
  },
];

export const marketsFor = (j: JunctionId) => MARKETS.filter((m) => m.junction === j);
export const marketById = (id: string) => MARKETS.find((m) => m.id === id);

/** A random market from the junction's pool. Pass the last one to avoid sending you to the same place twice running. */
export function rollMarket(j: JunctionId, avoid?: string, rng: () => number = Math.random): Market {
  const pool = marketsFor(j);
  const opts = pool.length > 1 ? pool.filter((m) => m.id !== avoid) : pool;
  return opts[Math.floor(rng() * opts.length)];
}

export const feeRange = (j: JunctionId) => {
  const fs = marketsFor(j).map((m) => m.fee);
  return [Math.min(...fs), Math.max(...fs)] as const;
};
