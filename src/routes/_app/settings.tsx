import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ble } from "@/lib/bluetooth";
import { calibration } from "@/lib/calibration";
import { clearAllSessions } from "@/lib/db";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const KEY = "denex.prefs";
type Prefs = { sweep: number; gain: number; keepAwake: boolean };
const defaultPrefs = (): Prefs => ({ sweep: 2.2, gain: 1, keepAwake: false });
const loadPrefs = (): Prefs => {
  try { return { ...defaultPrefs(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return defaultPrefs(); }
};
const savePrefs = (p: Prefs) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* noop */ } };

function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(() => (typeof window === "undefined" ? defaultPrefs() : loadPrefs()));
  const [, setTick] = useState(0);
  const [rawUuid, setRawUuid] = useState<string>(ble.rawCharUuid ?? "");
  useEffect(() => { savePrefs(prefs); }, [prefs]);
  useEffect(() => {
    const u = ble.subscribe(() => setTick((t) => t + 1));
    const c = calibration.subscribe(() => setTick((t) => t + 1));
    return () => { u(); c(); };
  }, []);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (k: string) => Promise<{ release: () => Promise<void> }> } };
    if (prefs.keepAwake && nav.wakeLock) {
      nav.wakeLock.request("screen").then((l) => { lock = l; }).catch(() => { /* noop */ });
    }
    return () => { lock?.release().catch(() => {}); };
  }, [prefs.keepAwake]);

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  const cal = calibration.get();

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Configuration</div>
        <h1 className="text-2xl md:text-3xl font-semibold mt-1">Settings</h1>
      </div>

      <Section title="Calibration" badge={cal.enabled ? { label: "Active", tone: "ok" } : { label: "Inactive", tone: "muted" }}>
        <div className="text-xs text-muted-foreground -mt-2">Map raw sensor units to millivolts. Persisted locally and applied to every incoming sample in real time.</div>
        <Toggle label="Enable calibration" value={cal.enabled} onChange={(v) => calibration.set({ enabled: v })} />
        <Row label="Gain" hint={`${cal.gain.toFixed(3)} mV / unit`}>
          <input type="range" min={0.001} max={5} step={0.001} value={cal.gain} onChange={(e) => calibration.set({ gain: +e.target.value })} className="w-full accent-[oklch(0.78_0.15_190)]" />
        </Row>
        <Row label="Offset" hint={`${cal.offset.toFixed(3)} mV`}>
          <input type="range" min={-2} max={2} step={0.001} value={cal.offset} onChange={(e) => calibration.set({ offset: +e.target.value })} className="w-full accent-[oklch(0.78_0.15_190)]" />
        </Row>
        <div className="flex gap-2">
          <button onClick={() => calibration.reset()} className="px-3 py-1.5 rounded border border-border text-xs hover:bg-secondary/40">Reset to identity</button>
          <div className="ml-auto text-mono text-xs text-muted-foreground self-center">y = {cal.gain.toFixed(3)} · x + {cal.offset.toFixed(3)}</div>
        </div>
      </Section>

      <Section title="Waveform">
        <Row label="Sweep speed" hint={`${prefs.sweep.toFixed(1)} mm/s`}>
          <input type="range" min={0.8} max={5} step={0.1} value={prefs.sweep} onChange={(e) => set("sweep", +e.target.value)} className="w-full accent-[oklch(0.78_0.15_190)]" />
        </Row>
        <Row label="Display amplitude" hint={`${prefs.gain.toFixed(2)}x`}>
          <input type="range" min={0.5} max={2} step={0.05} value={prefs.gain} onChange={(e) => set("gain", +e.target.value)} className="w-full accent-[oklch(0.78_0.15_190)]" />
        </Row>
      </Section>

      <Section title="Bluetooth">
        <Toggle label="Auto-reconnect to last device" value={ble.autoReconnect} onChange={(v) => ble.setAutoReconnect(v)} />
        <Row label="Saved device" hint={ble.savedDeviceName() ?? "None"}>
          <button
            onClick={() => ble.forgetDevice()}
            disabled={!ble.savedDeviceName()}
            className="px-3 py-1.5 rounded border border-border text-xs hover:bg-secondary/40 disabled:opacity-30"
          >Forget device</button>
        </Row>
        <Row label="Raw stream UUID" hint="Optional · 128-bit characteristic streaming Float32 LE samples">
          <div className="flex gap-2">
            <input
              type="text"
              value={rawUuid}
              onChange={(e) => setRawUuid(e.target.value)}
              placeholder="00002a37-0000-1000-8000-00805f9b34fb"
              className="flex-1 px-3 py-1.5 rounded border border-border bg-background text-mono text-xs"
            />
            <button onClick={() => ble.setRawCharUuid(rawUuid || null)} className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs">Save</button>
          </div>
        </Row>
      </Section>

      <Section title="Application">
        <Toggle label="Keep screen awake during sessions" value={prefs.keepAwake} onChange={(v) => set("keepAwake", v)} />
        <Row label="Local storage" hint="IndexedDB · sessions are kept on-device only">
          <button
            onClick={async () => { if (confirm("Delete all stored sessions?")) await clearAllSessions(); }}
            className="px-3 py-1.5 rounded border border-border text-xs hover:bg-secondary/40"
          >Clear all sessions</button>
        </Row>
      </Section>

      <Section title="About">
        <div className="text-sm text-muted-foreground leading-relaxed">
          Denex is a frontend-only ECG monitoring platform built for biomedical engineering workflows.
          Real-data only — no synthetic generators, no demo mode. All data lives in your browser.
        </div>
        <div className="mt-3 text-mono text-xs text-muted-foreground">v0.3.0 · build live</div>
      </Section>
    </div>
  );
}

function Section({ title, children, badge }: { title: string; children: React.ReactNode; badge?: { label: string; tone: "ok" | "muted" } }) {
  return (
    <div className="rounded-xl glass p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium tracking-wide">{title}</h2>
        {badge && (
          <span className={`text-[10px] text-mono uppercase tracking-widest px-2 py-0.5 rounded-full ${badge.tone === "ok" ? "bg-[oklch(0.78_0.18_155)]/15 text-[oklch(0.78_0.18_155)]" : "bg-secondary/40 text-muted-foreground"}`}>{badge.label}</span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid md:grid-cols-3 gap-3 items-center">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground text-mono mt-0.5">{hint}</div>}
      </div>
      <div className="md:col-span-2">{children}</div>
    </div>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm">{label}</div>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-primary" : "bg-secondary"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background transition-transform ${value ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
