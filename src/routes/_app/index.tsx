import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Heart, Wifi, Battery, Timer, Cpu, Gauge, Signal, Circle, Square, Bluetooth, AlertTriangle, Sliders, Waves, ZapOff, TrendingUp } from "lucide-react";
import { EcgWaveform } from "@/components/EcgWaveform";
import { BpmHistory } from "@/components/BpmHistory";
import { StatTile } from "@/components/StatTile";
import { EmptyState } from "@/components/EmptyState";
import { ble } from "@/lib/bluetooth";
import { signal, SAMPLE_RATE } from "@/lib/signal";
import { calibration } from "@/lib/calibration";
import { saveSession } from "@/lib/db";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const u1 = ble.subscribe(() => setTick((t) => t + 1));
    const u2 = signal.subscribe(() => setTick((t) => t + 1));
    const u3 = calibration.subscribe(() => setTick((t) => t + 1));
    return () => { u1(); u2(); u3(); };
  }, []);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const live = ble.isLive();
  const reconnecting = ble.state === "reconnecting" || ble.state === "connecting" || ble.state === "discovering" || ble.state === "subscribing";
  const snap = signal.snapshot();
  const cal = calibration.get();
  const recordedSec = Math.floor(snap.recordedDurationMs / 1000);
  const hasAnyRealData = snap.hasBpm || snap.hasRawWaveform;

  const onToggleRecord = async () => {
    if (!signal.recording) { signal.startRecording(); return; }
    const r = signal.stopRecording();
    if (r.original.length < SAMPLE_RATE && r.bpm.length < 2) return;
    await saveSession({
      id: crypto.randomUUID(),
      startedAt: r.startedAt,
      durationMs: r.durationMs,
      avgBpm: snap.bpmAvg || snap.bpm,
      signalQuality: snap.quality,
      sampleRate: SAMPLE_RATE,
      samples: r.original.length,
      deviceName: ble.device?.name,
      original: r.original,
      noisy: r.noisy,
      filtered: r.filtered,
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Live monitor</div>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">Real-time ECG Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xl">Strict real-data mode. Visuals appear only after the connected sensor delivers verified packets.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
          <span className={`h-2 w-2 rounded-full pulse-dot ${live && hasAnyRealData ? "bg-[oklch(0.78_0.18_155)]" : reconnecting ? "bg-[oklch(0.78_0.16_70)]" : "bg-muted-foreground"}`} />
          <span className="text-xs text-mono uppercase tracking-widest">
            {live && hasAnyRealData ? "Live" : reconnecting ? ble.state : live ? "Awaiting data" : "Standby"}
          </span>
        </div>
      </div>

      {ble.state === "unsupported" && (
        <div className="rounded-xl glass p-4 flex items-start gap-3 border border-[oklch(0.65_0.22_25)]/40">
          <AlertTriangle className="h-5 w-5 text-[oklch(0.70_0.20_25)] mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Web Bluetooth unavailable</div>
            <div className="text-muted-foreground mt-1">Open Denex in a Chromium-based browser (Chrome, Edge, Opera) over HTTPS to pair a sensor.</div>
          </div>
        </div>
      )}

      {!live ? (
        <EmptyState
          icon={Bluetooth}
          title={reconnecting ? "Re-establishing link to sensor…" : "No sensor connected"}
          description="Pair a Bluetooth Low Energy sensor to begin streaming. Denex never fabricates data — every metric and waveform on this dashboard is sourced from a verified BLE packet."
          ctaLabel="Open Bluetooth Center"
          ctaTo="/bluetooth"
        />
      ) : !hasAnyRealData ? (
        <EmptyState
          icon={Waves}
          title="Awaiting first verified packet"
          description="The link is established. Denex will reveal metrics, waveforms and graphs as soon as the device transmits real measurements."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <StatTile label="BPM" value={snap.bpm > 0 ? String(snap.bpm) : "—"} unit="bpm" icon={Heart} accent />
            <StatTile label="Quality" value={snap.quality > 0 ? `${snap.quality}` : "—"} unit="%" icon={Signal} />
            <StatTile label="Avg BPM" value={snap.bpmAvg > 0 ? `${snap.bpmAvg}` : "—"} unit="bpm" icon={TrendingUp} hint={snap.bpmReceived > 0 ? `${snap.bpmMin}–${snap.bpmMax}` : undefined} />
            <StatTile label="Throughput" value={ble.throughput > 0 ? ble.throughput.toFixed(1) : "—"} unit="pkt/s" icon={Activity} />
            <StatTile label="Jitter" value={ble.jitterMs > 0 ? `${ble.jitterMs}` : "—"} unit="ms" icon={Gauge} />
            <StatTile label="Loss" value={`${ble.packetLoss.toFixed(1)}`} unit="%" icon={ZapOff} />
            <StatTile label="Battery" value={ble.battery > 0 ? `${ble.battery}` : "—"} unit="%" icon={Battery} />
            <StatTile label="Last pkt" value={snap.lastBpmAgeMs > 0 ? `${(snap.lastBpmAgeMs / 1000).toFixed(1)}` : "—"} unit="s" icon={Timer} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onToggleRecord}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${signal.recording ? "bg-[oklch(0.65_0.22_25)] text-white" : "bg-primary text-primary-foreground hover:opacity-90"}`}
            >
              {signal.recording ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4 fill-current" />}
              {signal.recording ? `Stop & save (${fmtSec(recordedSec)})` : "Start recording"}
            </button>
            <Link to="/settings" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary/40">
              <Sliders className="h-4 w-4" /> Calibration
            </Link>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5" />
                <span className="text-mono">{ble.device?.name ?? "BLE"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                <span className="text-mono uppercase">{cal.enabled ? `Cal ${cal.gain.toFixed(2)}× +${cal.offset.toFixed(2)}` : "Cal off"}</span>
              </div>
            </div>
          </div>

          {snap.hasBpm && (
            <div className="rounded-xl glass p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Heart rate trend</div>
                  <h3 className="text-sm font-medium mt-0.5">{snap.bpmReceived} measurements · last {(snap.lastBpmAgeMs / 1000).toFixed(1)}s ago</h3>
                </div>
                <div className="text-mono text-xs text-muted-foreground">min {snap.bpmMin} · max {snap.bpmMax}</div>
              </div>
              <BpmHistory data={signal.bpmHistory} />
            </div>
          )}

          {snap.hasRawWaveform ? (
            <div className="grid gap-4">
              <EcgWaveform label="Raw signal" color="oklch(0.78 0.15 215)" channel="original" height={200} />
              <EcgWaveform label="Filtered output" color="oklch(0.78 0.18 155)" channel="filtered" height={170} />
            </div>
          ) : (
            <div className="rounded-xl glass p-6 flex items-start gap-4">
              <Waves className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">No raw waveform stream</div>
                <div className="text-muted-foreground mt-1 max-w-2xl">
                  This sensor only exposes the standard Heart Rate measurement (BPM). To enable waveform rendering, declare the device's raw-stream characteristic UUID in <Link to="/settings" className="text-primary underline-offset-2 hover:underline">Settings → Bluetooth</Link>. Denex will subscribe to it on the next connection.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function fmtSec(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
