/** Fixed geometry of the junction. All traffic flows left to right and stops at the line. */
export const TOP = 160;          // top edge of the road
export const BOTTOM = 372;       // bottom edge of the road
export const STOP_X = 836;       // the stop line; a car's front bumper sits here
export const LANE_Y = [196, 264, 332];
export const HOME_Y = 470;       // where the hawker waits on the pavement
export const LIGHT_X = 922;
export const PLAYER_SPEED = 250;
/** Anton is bundled in the app (see globals.css); the rest are fallbacks. */
export const DISPLAY_FONT = "Anton, Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";

/**
 * The three billboards behind the road. Each face is a sellable ad space (3:1, like a real roadside board).
 * 264 x 88 each, 10% bigger than before, with 60px of skyline showing between them.
 * Pass an image per id to renderBackdrop to fill one; blank for now.
 */
export const AD_SLOTS = [
  { id: "ad1", x: 24, y: 58, w: 264, h: 88 },
  { id: "ad2", x: 348, y: 58, w: 264, h: 88 },
  { id: "ad3", x: 672, y: 58, w: 264, h: 88 },
] as const;
export type AdSlotId = (typeof AD_SLOTS)[number]["id"];
