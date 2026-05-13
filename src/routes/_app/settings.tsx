import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [speed, setSpeed] = useState(2.2);
  const [amp, setAmp] = useState(1);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [highPerf, setHighPerf] = useState(true);
  const [keepAwake, setKeepAwake] = useState(false);

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Configuration</div>
        <h1 className="text-2xl md:text-3xl font-semibold mt-1">Settings</h1>
      </div>

      <Section title="Waveform">
        <Row label="Sweep speed" hint={`${speed.toFixed(1)} mm/s`}>
          <input type="range" min={0.8} max={5} step={0.1} value={speed} onChange={(e) => setSpeed(+e.target.value)} className="w-full accent-[oklch(0.78_0.15_190)]" />
        </Row>
        <Row label="Amplitude gain" hint={`${amp.toFixed(2)}x`}>
          <input type="range" min={0.5} max={2} step={0.05} value={amp} onChange={(e) => setAmp(+e.target.value)} className="w-full accent-[oklch(0.78_0.15_190)]" />
        </Row>
      </Section>

      <Section title="Bluetooth">
        <Toggle label="Auto-reconnect to last device" value={autoReconnect} onChange={setAutoReconnect} />
        <Toggle label="High-throughput streaming" value={highPerf} onChange={setHighPerf} />
      </Section>

      <Section title="Application">
        <Toggle label="Keep screen awake during sessions" value={keepAwake} onChange={setKeepAwake} />
        <Row label="Storage" hint="Local IndexedDB · Encrypted at rest">
          <button className="px-3 py-1.5 rounded border border-border text-xs hover:bg-secondary/40">Clear cache</button>
        </Row>
      </Section>

      <Section title="About">
        <div className="text-sm text-muted-foreground leading-relaxed">
          Denex is a frontend-only ECG monitoring platform built for biomedical engineering workflows.
          Built with Web Bluetooth, IndexedDB and a streaming canvas renderer.
        </div>
        <div className="mt-3 text-mono text-xs text-muted-foreground">v0.1.0 · build live</div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl glass p-6">
      <h2 className="text-sm font-medium tracking-wide mb-4">{title}</h2>
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
