import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Heart, Wifi, Battery, Timer, Cpu, Gauge, Signal } from "lucide-react";
import { EcgWaveform } from "@/components/EcgWaveform";
import { StatTile } from "@/components/StatTile";
import { EcgEngine } from "@/lib/ecg";
import { ble } from "@/lib/bluetooth";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const engine = useMemo(() => new EcgEngine(72), []);
  const lastRef = useRef(performance.now());
  const stateRef = useRef({ original: 0, noisy: 0, filtered: 0 });

  const [bpm, setBpm] = useState(72);
  const [quality, setQuality] = useState(96);
  const [latency, setLatency] = useState(12);
  const [elapsed, setElapsed] = useState(0);
  const [bleTick, setBleTick] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => ble.subscribe(() => setBleTick((t) => t + 1)) as unknown as undefined, []);

  useEffect(() => {
    const id = setInterval(() => {
      setBpm((b) => Math.round((b * 0.85 + (68 + Math.random() * 8) * 0.15) * 10) / 10);
      setQuality((q) => Math.max(80, Math.min(99, q + (Math.random() - 0.5) * 1.2)));
      setLatency((l) => Math.max(6, Math.min(40, l + (Math.random() - 0.5) * 2)));
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { engine.bpm = Math.round(bpm); }, [bpm, engine]);

  const sampleOriginal = () => {
    const now = performance.now();
    const dt = (now - lastRef.current) / 1000;
    lastRef.current = now;
    stateRef.current = engine.step(dt);
    return stateRef.current.original;
  };
  const sampleNoisy = () => stateRef.current.noisy;
  const sampleFiltered = () => stateRef.current.filtered;

  const fmtTime = (s: number) => {
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const connected = ble.state === "connected";
  void bleTick;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Live monitor</div>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">Real-time ECG Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
          <span className={`h-2 w-2 rounded-full pulse-dot ${connected ? "bg-[oklch(0.78_0.18_155)]" : "bg-muted-foreground"}`} />
          <span className="text-xs text-mono uppercase tracking-widest">{connected ? "Streaming" : "Standby"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatTile label="BPM" value={bpm.toFixed(0)} unit="bpm" icon={Heart} accent />
        <StatTile label="Signal" value={quality.toFixed(0)} unit="%" icon={Signal} />
        <StatTile label="Latency" value={latency.toFixed(0)} unit="ms" icon={Gauge} />
        <StatTile label="Session" value={fmtTime(elapsed)} icon={Timer} />
        <StatTile label="Battery" value={connected ? `${ble.battery || 87}` : "—"} unit="%" icon={Battery} />
        <StatTile label="Bluetooth" value={connected ? "Linked" : "Idle"} icon={Wifi} />
        <StatTile label="AI Engine" value="Ready" icon={Cpu} hint="Filter v2.1" />
        <StatTile label="Channels" value="3" unit="lead" icon={Activity} />
      </div>

      <div className="grid gap-4">
        <EcgWaveform label="Original ECG" color="oklch(0.78 0.15 215)" getSample={sampleOriginal} height={200} />
        <EcgWaveform label="Noisy ECG" color="oklch(0.70 0.20 35)" getSample={sampleNoisy} height={170} amplitude={1} />
        <EcgWaveform label="Filtered ECG" color="oklch(0.78 0.18 155)" getSample={sampleFiltered} height={170} />
      </div>
    </div>
  );
}
