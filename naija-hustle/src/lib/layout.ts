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
 * The two billboards behind the road. Each face is a sellable ad space, 408 x 102 (4:1).
 * Room is tight on every side, which is why they are this size and no bigger:
 *   - the HUD panels (money, light status) cover the top 42px of the canvas, so the height is capped at 102;
 *   - the pavement they stand on ends at the road (TOP = 160);
 *   - the traffic light head sits at x 903-941, so the boards stop at x 882 (frame 888).
 * Pass an image per id to renderBackdrop to fill one; blank for now.
 */
export const AD_SLOTS = [
  { id: "ad1", x: 18, y: 50, w: 408, h: 102 },
  { id: "ad2", x: 474, y: 50, w: 408, h: 102 },
] as const;
export type AdSlotId = (typeof AD_SLOTS)[number]["id"];

/**
 * What to ask advertisers for. Every board has the same 4:1 face (408 x 102 in game units).
 * The master is 1600 x 400, about 4x the slot, so it stays sharp on retina and downscales cleanly.
 * The standard IAB "Billboard" unit (970 x 250) is 3.88:1, so existing creatives work: about 3% is cropped top and bottom.
 * Use these to validate uploads: reject anything whose ratio is not within about 5% of 4:1.
 */
export const AD_SPEC = { ratio: 4, width: 1600, height: 400, minWidth: 800, minHeight: 200, maxBytes: 400_000 } as const;
