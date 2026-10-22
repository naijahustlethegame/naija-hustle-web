import { api } from "@/lib/api";
import { emptyStock, ITEM_IDS } from "@/game/engine/items";
import type { ItemId, Stock } from "@/game/engine/types";

const any = (s: Stock) => ITEM_IDS.some((k) => s[k] !== 0);

/**
 * Batches the player's actions for the server, which owns money and stock.
 * Requests go out one after another (tray, then sales, then losses), so the server never sees a sale before its stock.
 * `onError` runs when the server refuses something: reload the real state.
 */
export class Sync {
  private tray = emptyStock(); private lost = emptyStock();
  private sales: { item: string; price: number }[] = []; private hits = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();
  constructor(private onError: () => void) {}

  moveTray(id: ItemId, n: number) { this.tray[id] += n; this.later(800); }
  sale(item: ItemId, price: number) { this.sales.push({ item, price }); this.later(3000); }
  hit() { this.hits++; this.later(400); }
  lose(id: ItemId) { this.lost[id]++; this.later(400); }
  private later(ms: number) { if (!this.timer) this.timer = setTimeout(() => this.flush(), ms); }

  flush(keepalive = false): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const { tray, lost, sales, hits } = this;
    this.tray = emptyStock(); this.lost = emptyStock(); this.sales = []; this.hits = 0;
    if (!any(tray) && !any(lost) && !sales.length && !hits) return this.chain;
    return (this.chain = this.chain.then(async () => {
      try {
        if (any(tray)) await api.tray(tray, keepalive);
        for (let i = 0; i < sales.length; i += 25) await api.sales(sales.slice(i, i + 25), keepalive);
        if (hits || any(lost)) await api.hit(Math.min(hits, 5), lost, keepalive);
      } catch { this.onError(); }
    }));
  }
}
