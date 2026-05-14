// User-configurable calibration applied to incoming signal samples.
// Persisted in localStorage so it survives PWA restarts.

export type Calibration = {
  enabled: boolean;
  gain: number;   // multiplier (mV per raw unit)
  offset: number; // additive offset in mV
  updatedAt: number;
};

const KEY = "denex.calibration";
type Listener = (c: Calibration) => void;

class CalibrationStore {
  private state: Calibration = { enabled: false, gain: 1, offset: 0, updatedAt: 0 };
  private listeners = new Set<Listener>();

  constructor() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...this.state, ...(JSON.parse(raw) as Calibration) };
    } catch { /* noop */ }
  }

  get() { return this.state; }
  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  private emit() { for (const l of this.listeners) l(this.state); }

  set(patch: Partial<Calibration>) {
    const next = { ...this.state, ...patch, updatedAt: Date.now() };
    if (!Number.isFinite(next.gain) || next.gain === 0) next.gain = 1;
    if (!Number.isFinite(next.offset)) next.offset = 0;
    this.state = next;
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* noop */ }
    this.emit();
  }

  reset() { this.set({ enabled: false, gain: 1, offset: 0 }); }

  apply(v: number): number {
    if (!this.state.enabled) return v;
    return v * this.state.gain + this.state.offset;
  }
}

export const calibration = new CalibrationStore();
