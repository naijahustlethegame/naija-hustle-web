/** Fixed-cap rAF loop. dt is clamped so tab switches never cause huge jumps. */
export class Loop {
  private raf = 0; private last = 0; private running = false;
  constructor(private update: (dt: number) => void, private render: () => void) {}
  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      this.update(Math.min((now - this.last) / 1000, 0.05)); this.last = now;
      this.render(); this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
}
