import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Activity, Signal, Battery, Gauge, ZapOff, Timer, TrendingUp, Circle, Square, Bluetooth, Waves, Sliders, Camera, PlayCircle, RefreshCw } from "lucide-react";
import { EcgWaveform } from "@/components/EcgWaveform";
import { BpmHistory } from "@/components/BpmHistory";
import { StatTile } from "@/components/StatTile";
import { EmptyState } from "@/components/EmptyState";
import { HrvPanel } from "@/components/HrvPanel";
import { ArrhythmiaFlags } from "@/components/ArrhythmiaFlags";
import { ble } from "@/lib/bluetooth";
import { signal, SAMPLE_RATE } from "@/lib/signal";
import { calibration } from "@/lib/calibration";
import { saveSession } from "@/lib/db";
import { computeHrv, evaluateArrhythmia } from "@/lib/analytics";
import { snapshotNode } from "@/lib/snapshot";
import { demo } from "@/lib/demo";
import { notify, notifyEnabled } from "@/lib/notify";
import { fmtSec } from "@/lib/format";

export const Route = createFileRoute("/_app/")({ component: Dashboard });

function Dashboard() {
  const [, setTick] = useState(0);
  const dashRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStart = useRef<number | null>(null);

  useEffect(() => {
    const u1 = ble.subscribe(() => setTick((t) => t + 1));
    const u2 = signal.subscribe(() => setTick((t) => t + 1));
    const u3 = calibration.subscribe(() => setTick((t) => t + 1));
    const u4 = demo.subscribe(() => setTick((t) => t + 1));
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => { u1(); u2(); u3(); u4(); clearInterval(id); };
  }, []);

  // Observe hero card for sticky mini-waveform trigger
  useEffect(() => {
    if (!heroRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0.15 }
    );
    obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  // Pull-to-refresh: swipe down at top of scroll → reconnect BLE
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      pullStart.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (pullStart.current === null) return;
      const dy = e.touches[0].clientY - pullStart.current;
      if (dy > 0) setPull(Math.min(dy * 0.5, 90));
    };
    const onEnd = async () => {
      if (pullStart.current === null) return;
      const p = pull;
      pullStart.current = null;
      if (p > 60 && !refreshing) {
        setRefreshing(true);
        try { await ble.reconnect(); } catch { /* noop */ }
        setTimeout(() => { setRefreshing(false); setPull(0); }, 800);
      } else {
        setPull(0);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pull, refreshing]);

  // Alert on disconnect during recording
  const prevLive = useRef(false);
  useEffect(() => {
    const live = ble.isLive();
    if (prevLive.current && !live && signal.recording && notifyEnabled()) {
      notify("Denoiz — Capteur déconnecté", "L'enregistrement en cours a perdu la connexion Bluetooth.");
    }
    prevLive.current = live;
  });

  const live = ble.isLive() || demo.state.active;
  const snap = signal.snapshot();
  const cal = calibration.get();
  const recordedSec = Math.floor(snap.recordedDurationMs / 1000);
  const hasAnyRealData = snap.hasBpm || snap.hasRawWaveform;

  const hrv = useMemo(() => computeHrv(signal.bpmHistory), [signal.bpmHistory.length]);
  const flags = useMemo(() => evaluateArrhythmia(snap.bpm, hrv), [snap.bpm, hrv]);

  const onToggleRecord = async () => {
    if (!signal.recording) { signal.startRecording(); return; }
    const r = signal.stopRecording();
    if (r.original.length < SAMPLE_RATE && r.bpm.length < 2) return;
    await saveSession({
      id: crypto.randomUUID(), startedAt: r.startedAt, durationMs: r.durationMs,
      avgBpm: snap.bpmAvg || snap.bpm, signalQuality: snap.quality, sampleRate: SAMPLE_RATE,
      samples: r.original.length, deviceName: demo.state.active ? "Démo" : ble.device?.name,
      original: r.original, noisy: r.noisy, filtered: r.filtered,
    });
  };

  const onSnapshot = async () => {
    if (!dashRef.current) return;
    await snapshotNode(dashRef.current, `denoiz-${Date.now()}.png`, {
      title: "Rapport ECG Denoiz",
      bpm: snap.bpm, duration: `${fmtSec(recordedSec)}`, device: ble.device?.name ?? "Live",
      timestamp: new Date().toLocaleString(),
    });
  };

  return (
    <div ref={dashRef} className="p-4 md:p-8 space-y-5 max-w-[1600px] mx-auto">
      {/* Pull-to-refresh indicator (mobile) */}
      <AnimatePresence>
        {(pull > 8 || refreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: Math.min(pull, 90) - 24 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed top-9 inset-x-0 z-30 flex justify-center pointer-events-none"
          >
            <div className="rounded-full glass px-3 py-1.5 flex items-center gap-2 text-[10px] uppercase tracking-widest">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} style={{ transform: refreshing ? undefined : `rotate(${pull * 4}deg)` }} />
              {refreshing ? "Reconnexion…" : pull > 60 ? "Relâcher pour reconnecter" : "Tirer pour reconnecter"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky mini-waveform when hero scrolls off (mobile) */}
      <AnimatePresence>
        {!heroVisible && hasAnyRealData && snap.hasRawWaveform && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="md:hidden fixed top-9 inset-x-0 z-20 h-14 glass border-b border-border/60 px-3 flex items-center gap-3"
          >
            <div className="flex items-baseline gap-1 shrink-0">
              <Heart className={`h-3.5 w-3.5 ${snap.bpm > 0 ? "text-primary heartbeat" : "text-muted-foreground"}`} />
              <span className="text-mono font-display text-lg text-primary tabular-nums">{snap.bpm || "—"}</span>
              <span className="text-[9px] text-muted-foreground">bpm</span>
            </div>
            <div className="flex-1 h-full py-1.5 min-w-0">
              <EcgWaveform label="" color="oklch(0.78 0.18 155)" channel="filtered" height={40} compact />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Moniteur temps réel</div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl mt-1 tracking-tighter">Tableau de bord ECG</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end" data-snapshot-exclude="true">
          {!live && (
            <button onClick={() => demo.start()} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/40 text-primary text-xs">
              <PlayCircle className="h-3.5 w-3.5" /> Démo
            </button>
          )}
          <button onClick={onSnapshot} disabled={!hasAnyRealData} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs disabled:opacity-40 hover:bg-secondary/40">
            <Camera className="h-3.5 w-3.5" /> <span className="hidden xs:inline sm:inline">Snapshot PNG</span><span className="sm:hidden">PNG</span>
          </button>
        </div>
      </div>

      {!live ? (
        <EmptyState
          illustration="ble"
          title="Aucun capteur connecté"
          description="Appairez un capteur Bluetooth Low Energy pour commencer le streaming. Chaque mesure affichée provient exclusivement d'un paquet vérifié en provenance du matériel — ou du mode démo si activé."
          ctaLabel="Ouvrir le centre Bluetooth"
          ctaTo="/bluetooth"
        />
      ) : !hasAnyRealData ? (
        <EmptyState icon={Waves} title="En attente du premier paquet" description="Le lien est établi. Denoiz révélera les métriques et les ondes dès que le capteur transmettra." />
      ) : (
        <>
          {/* Mobile Hero-BPM (huge) — collapses into the bento grid on md+ */}
          <div ref={heroRef} className="md:hidden rounded-3xl glass p-6 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Rythme cardiaque</div>
              <Heart className={`h-6 w-6 ${snap.bpm > 0 ? "text-primary heartbeat" : "text-muted-foreground"}`} />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={snap.bpm}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-display text-[104px] leading-none text-primary tracking-tighter tabular-nums"
                >
                  {snap.bpm > 0 ? snap.bpm : "—"}
                </motion.span>
              </AnimatePresence>
              <span className="text-mono text-base text-muted-foreground">bpm</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-[11px] text-mono">
              <div><div className="text-muted-foreground uppercase tracking-widest text-[9px]">Moy</div><div className="text-foreground text-base">{snap.bpmAvg || "—"}</div></div>
              <div><div className="text-muted-foreground uppercase tracking-widest text-[9px]">Min</div><div className="text-foreground text-base">{snap.bpmMin || "—"}</div></div>
              <div><div className="text-muted-foreground uppercase tracking-widest text-[9px]">Max</div><div className="text-foreground text-base">{snap.bpmMax || "—"}</div></div>
            </div>
            <div className="absolute -right-10 -bottom-10 h-52 w-52 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          </div>

          {/* Bento grid — mixed sizes (desktop keeps original hero card) */}
          <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-3 auto-rows-[minmax(0,auto)]">
            <motion.div
              layout
              className="hidden md:flex col-span-2 md:col-span-3 lg:col-span-4 lg:row-span-2 rounded-2xl glass p-6 flex-col justify-between overflow-hidden relative"
            >
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Rythme cardiaque</div>
                <Heart className={`h-5 w-5 ${snap.bpm > 0 ? "text-primary heartbeat" : "text-muted-foreground"}`} />
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="font-display text-6xl md:text-7xl text-primary tracking-tighter">{snap.bpm > 0 ? snap.bpm : "—"}</span>
                <span className="text-mono text-sm text-muted-foreground">bpm</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">
                Moyenne {snap.bpmAvg || "—"} · plage {snap.bpmMin || "—"}–{snap.bpmMax || "—"}
              </div>
              <div className="absolute -right-8 -bottom-8 h-40 w-40 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
            </motion.div>

            <StatTile label="Qualité" value={snap.quality > 0 ? `${snap.quality}` : "—"} unit="%" icon={Signal} />
            <StatTile label="Débit" value={ble.throughput > 0 ? ble.throughput.toFixed(1) : "—"} unit="pkt/s" icon={Activity} />
            <StatTile label="Jitter" value={ble.jitterMs > 0 ? `${ble.jitterMs}` : "—"} unit="ms" icon={Gauge} />
            <StatTile label="Perte" value={`${ble.packetLoss.toFixed(1)}`} unit="%" icon={ZapOff} />
            <StatTile label="Batterie" value={ble.battery > 0 ? `${ble.battery}` : "—"} unit="%" icon={Battery} />
            <StatTile label="Dernier" value={snap.lastBpmAgeMs > 0 ? `${(snap.lastBpmAgeMs / 1000).toFixed(1)}` : "—"} unit="s" icon={Timer} />
            <StatTile label="Moy BPM" value={snap.bpmAvg > 0 ? `${snap.bpmAvg}` : "—"} unit="bpm" icon={TrendingUp} accent />

            <div className="col-span-2 md:col-span-6 lg:col-span-8 rounded-2xl glass p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Analyse HRV — 2 min</div>
                <span className="text-[10px] text-muted-foreground text-mono">{hrv.count} RR</span>
              </div>
              <HrvPanel metrics={hrv} />
            </div>

            <div className="col-span-2 md:col-span-6 lg:col-span-4 rounded-2xl glass p-4">
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-3">Détection d'arythmie</div>
              <ArrhythmiaFlags flags={flags} />
            </div>
          </div>

          {/* Desktop control row (mobile uses FAB below) */}
          <div className="hidden md:flex flex-wrap items-center gap-2" data-snapshot-exclude="true">
            <button
              onClick={onToggleRecord}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${signal.recording ? "bg-[oklch(0.65_0.22_25)] text-white" : "bg-primary text-primary-foreground hover:opacity-90 glow-primary"}`}
            >
              {signal.recording ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4 fill-current" />}
              {signal.recording ? `Arrêter & sauver (${fmtSec(recordedSec)})` : "Démarrer l'enregistrement"}
            </button>
            <Link to="/settings" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm hover:bg-secondary/40">
              <Sliders className="h-4 w-4" /> Calibration
            </Link>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground text-mono">
              {cal.enabled ? `Cal ${cal.gain.toFixed(2)}× +${cal.offset.toFixed(2)}` : "Cal off"}
            </div>
          </div>

          {snap.hasBpm && (
            <div className="rounded-2xl glass p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Tendance HR</div>
                  <h3 className="text-sm font-medium mt-0.5">{snap.bpmReceived} mesures</h3>
                </div>
                <div className="text-mono text-xs text-muted-foreground">min {snap.bpmMin} · max {snap.bpmMax}</div>
              </div>
              <BpmHistory data={signal.bpmHistory} />
            </div>
          )}

          {snap.hasRawWaveform ? (
            <div className="grid gap-3">
              <EcgWaveform label="Signal brut" color="oklch(0.78 0.15 215)" channel="original" height={200} showPeaks />
              <EcgWaveform label="Signal filtré" color="oklch(0.78 0.18 155)" channel="filtered" height={170} />
            </div>
          ) : (
            <div className="rounded-2xl glass p-6 flex items-start gap-4">
              <Waves className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Aucun flux d'onde brut</div>
                <div className="text-muted-foreground mt-1 max-w-2xl">
                  Ce capteur n'expose que la mesure standard Heart Rate. Renseignez l'UUID de caractéristique brute dans <Link to="/settings" className="text-primary underline-offset-2 hover:underline">Réglages → Bluetooth</Link>, ou activez le <button onClick={() => demo.start()} className="text-primary underline-offset-2 hover:underline">mode démo</button>.
                </div>
              </div>
            </div>
          )}

          {/* Mobile REC FAB */}
          <motion.button
            data-snapshot-exclude="true"
            onClick={onToggleRecord}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileTap={{ scale: 0.92 }}
            className={`md:hidden fixed right-4 z-30 h-16 w-16 rounded-full shadow-2xl flex items-center justify-center ${signal.recording ? "bg-[oklch(0.65_0.22_25)] text-white" : "bg-primary text-primary-foreground glow-primary"}`}
            style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
            aria-label={signal.recording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
          >
            {signal.recording ? (
              <div className="flex flex-col items-center leading-none">
                <Square className="h-5 w-5" />
                <span className="text-[9px] text-mono mt-0.5">{fmtSec(recordedSec)}</span>
              </div>
            ) : (
              <Circle className="h-6 w-6 fill-current" />
            )}
          </motion.button>
        </>
      )}

      {!live && ble.state === "unsupported" && (
        <div className="rounded-xl glass p-4 flex items-start gap-3 border border-[oklch(0.65_0.22_25)]/40">
          <Bluetooth className="h-5 w-5 text-[oklch(0.70_0.20_25)] mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Web Bluetooth indisponible</div>
            <div className="text-muted-foreground mt-1">Ouvrez Denoiz dans un navigateur Chromium (Chrome, Edge, Opera) via HTTPS pour appairer un capteur.</div>
          </div>
        </div>
      )}
    </div>
  );
}
