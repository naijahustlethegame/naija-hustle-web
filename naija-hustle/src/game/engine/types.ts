export type Kind = "okada" | "keke" | "danfo" | "car" | "jeep" | "walker";
export type Entity = {
  id: number; kind: Kind; x: number; y: number; w: number; h: number;
  vx: number; price: number; sold: boolean; vehicle: boolean; tint: string;
};
export const W = 960, H = 540;
