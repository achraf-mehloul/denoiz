// Demo playback engine — streams the bundled ecg_signal.json into the
// signal store as if it were live BLE data. Off by default; the user
// enables it explicitly from the global status bar or the dashboard.

import { signal, SAMPLE_RATE } from "./signal";

type DemoState = { active: boolean; loaded: boolean; error: string | null };
type Listener = (s: DemoState) => void;

const DEMO_URL = "/demo-ecg.json";
const SCALE = 0.01; // raw MIT-BIH-like units → mV

class DemoPlayer {
  state: DemoState = { active: false, loaded: false, error: null };
  private samples: Float32Array = new Float32Array(0);
  private srcRate = 360;
  private idx = 0;
  private raf = 0;
  private lastTs = 0;
  private lastBpmTs = 0;
  private rrAccum: number[] = [];
  private prevSign = 0;
  private lastR = 0;
  private listeners = new Set<Listener>();

  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  private emit() { for (const l of this.listeners) l(this.state); }

  async load(): Promise<void> {
    if (this.state.loaded) return;
    try {
      const res = await fetch(DEMO_URL);
      const data = (await res.json()) as { signal: number[]; sampleRate?: number };
      this.samples = Float32Array.from(data.signal.map((v) => v * SCALE));
      this.srcRate = data.sampleRate ?? 360;
      this.state = { ...this.state, loaded: true, error: null };
      this.emit();
    } catch (e) {
      this.state = { ...this.state, error: (e as Error).message };
      this.emit();
      throw e;
    }
  }

  async start(): Promise<void> {
    if (this.state.active) return;
    await this.load();
    this.state = { ...this.state, active: true };
    this.idx = 0;
    this.lastTs = performance.now();
    this.lastBpmTs = 0;
    this.rrAccum = [];
    this.prevSign = 0;
    this.lastR = 0;
    signal.start();
    this.emit();
    this.tick();
  }

  stop(): void {
    if (!this.state.active) return;
    cancelAnimationFrame(this.raf);
    this.state = { ...this.state, active: false };
    signal.stop();
    this.emit();
  }

  toggle(): void { this.state.active ? this.stop() : this.start(); }

  private tick = () => {
    if (!this.state.active) return;
    const now = performance.now();
    const dt = now - this.lastTs;
    this.lastTs = now;
    // Push at the source sample rate, resampled to SAMPLE_RATE (250).
    const stride = this.srcRate / SAMPLE_RATE;
    const nSamples = Math.max(1, Math.round((dt / 1000) * SAMPLE_RATE));
    for (let i = 0; i < nSamples; i++) {
      const src = this.samples[Math.floor(this.idx) % this.samples.length];
      signal.pushSample(src);
      // Naive R-peak detection on the demo signal to emit BPM ticks that
      // feel authentic (crossing 0.35 mV upward + refractory).
      const sign = src > 0.35 ? 1 : 0;
      if (this.prevSign === 0 && sign === 1) {
        const nowMs = performance.now();
        if (this.lastR > 0) {
          const rr = nowMs - this.lastR;
          if (rr > 250 && rr < 2000) {
            this.rrAccum.push(rr);
            if (this.rrAccum.length > 8) this.rrAccum.shift();
            signal.pushRr([rr]);
          }
        }
        this.lastR = nowMs;
      }
      this.prevSign = sign;
      this.idx += stride;
    }
    this.raf = requestAnimationFrame(this.tick);
  };
}

export const demo = new DemoPlayer();
