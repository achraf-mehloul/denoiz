import { motion } from "framer-motion";
import type { HrvMetrics } from "@/lib/analytics";

type Props = { metrics: HrvMetrics };

export function HrvPanel({ metrics }: Props) {
  const items = [
    { key: "rmssd", label: "RMSSD", value: metrics.rmssd, unit: "ms", hint: "Variabilité court-terme" },
    { key: "sdnn", label: "SDNN", value: metrics.sdnn, unit: "ms", hint: "Écart-type des RR" },
    { key: "pnn50", label: "pNN50", value: metrics.pnn50, unit: "%", hint: "RR successifs > 50 ms" },
    { key: "meanRr", label: "Mean RR", value: metrics.meanRr, unit: "ms", hint: `${metrics.meanHr} bpm moyen` },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {items.map((it, i) => (
        <motion.div
          key={it.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="rounded-lg bg-secondary/30 px-3 py-2.5"
        >
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{it.label}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-mono text-xl">{it.value > 0 ? it.value : "—"}</span>
            <span className="text-[10px] text-muted-foreground text-mono">{it.unit}</span>
          </div>
          <div className="text-[10px] text-muted-foreground/70 mt-0.5">{it.hint}</div>
        </motion.div>
      ))}
    </div>
  );
}
