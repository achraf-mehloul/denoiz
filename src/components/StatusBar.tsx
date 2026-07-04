// Persistent thin bar shown above every route. Displays connection state,
// BPM, throughput, demo mode toggle, and theme switch — the "always-on"
// operator strip that gives the app a native-monitor feel.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, BluetoothConnected, BluetoothOff, Moon, Sun, PlayCircle, PauseCircle, Heart } from "lucide-react";
import { ble } from "@/lib/bluetooth";
import { signal } from "@/lib/signal";
import { theme } from "@/lib/theme";
import { demo } from "@/lib/demo";

export function StatusBar() {
  const [, tick] = useState(0);
  useEffect(() => {
    const u1 = ble.subscribe(() => tick((t) => t + 1));
    const u2 = signal.subscribe(() => tick((t) => t + 1));
    const u3 = theme.subscribe(() => tick((t) => t + 1));
    const u4 = demo.subscribe(() => tick((t) => t + 1));
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => { u1(); u2(); u3(); u4(); clearInterval(id); };
  }, []);

  const snap = signal.snapshot();
  const live = ble.isLive();
  const demoOn = demo.state.active;
  const bpm = snap.bpm;
  const throughput = ble.throughput;

  return (
    <div className="sticky top-0 z-40 h-9 border-b border-border/60 backdrop-blur-xl bg-background/70">
      <div className="h-full max-w-[1600px] mx-auto flex items-center gap-3 px-3 md:px-6 text-[11px] text-mono">
        <div className="flex items-center gap-1.5 min-w-0">
          <motion.span
            key={live || demoOn ? "on" : "off"}
            initial={{ scale: 0.6 }} animate={{ scale: 1 }}
            className={`h-1.5 w-1.5 rounded-full ${live || demoOn ? "bg-[oklch(0.78_0.18_155)]" : "bg-muted-foreground"} ${live || demoOn ? "pulse-dot" : ""}`}
          />
          {live ? (
            <BluetoothConnected className="h-3 w-3 text-[oklch(0.78_0.18_155)]" />
          ) : (
            <BluetoothOff className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="uppercase tracking-widest truncate max-w-[9rem]">
            {demoOn ? "Demo" : live ? ble.device?.name ?? "Live" : ble.state}
          </span>
        </div>

        <span className="text-muted-foreground/40">|</span>

        <div className="flex items-center gap-1.5">
          <Heart className={`h-3 w-3 ${bpm > 0 ? "text-primary" : "text-muted-foreground"}`} />
          <AnimatePresence mode="popLayout">
            <motion.span
              key={bpm}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 6, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="tabular-nums"
            >{bpm > 0 ? bpm : "—"}</motion.span>
          </AnimatePresence>
          <span className="text-muted-foreground">bpm</span>
        </div>

        <span className="hidden sm:inline text-muted-foreground/40">|</span>
        <div className="hidden sm:flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <span className="tabular-nums">{throughput > 0 ? throughput.toFixed(1) : "—"}</span>
          <span className="text-muted-foreground">pkt/s</span>
        </div>

        {snap.recording && (
          <>
            <span className="hidden md:inline text-muted-foreground/40">|</span>
            <span className="hidden md:inline-flex items-center gap-1.5 text-[oklch(0.70_0.20_25)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.70_0.20_25)] pulse-dot" />
              REC
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => demo.toggle()}
            title={demoOn ? "Arrêter le mode démo" : "Activer le mode démo"}
            className={`inline-flex items-center gap-1 px-2 h-6 rounded-full border text-[10px] uppercase tracking-widest transition-colors ${demoOn ? "bg-primary/20 text-primary border-primary/40" : "border-border/60 text-muted-foreground hover:text-foreground"}`}
          >
            {demoOn ? <PauseCircle className="h-3 w-3" /> : <PlayCircle className="h-3 w-3" />}
            Démo
          </button>
          <button
            onClick={() => theme.toggle()}
            title="Basculer le thème"
            className="h-6 w-6 rounded-full border border-border/60 text-muted-foreground hover:text-foreground flex items-center justify-center"
          >
            {theme.current === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}
