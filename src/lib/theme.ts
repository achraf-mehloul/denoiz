// Persistent light/dark theme controller. Applied via a `dark` class on
// <html> to interoperate with the tailwind dark variant.

export type Theme = "dark" | "light";
const KEY = "denoiz.theme";
type Listener = (t: Theme) => void;

class ThemeStore {
  current: Theme = "dark";
  private listeners = new Set<Listener>();
  constructor() {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(KEY) as Theme | null;
      if (saved === "light" || saved === "dark") this.current = saved;
    } catch { /* noop */ }
    this.apply();
  }
  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  private emit() { for (const l of this.listeners) l(this.current); }
  set(t: Theme) {
    this.current = t;
    try { localStorage.setItem(KEY, t); } catch { /* noop */ }
    this.apply();
    this.emit();
  }
  toggle() { this.set(this.current === "dark" ? "light" : "dark"); }
  private apply() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (this.current === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }
}

export const theme = new ThemeStore();
