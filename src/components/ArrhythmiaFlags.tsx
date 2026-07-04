import { AlertTriangle, CheckCircle2, HeartPulse } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ArrhythmiaFlag } from "@/lib/analytics";

export function ArrhythmiaFlags({ flags }: { flags: ArrhythmiaFlag[] }) {
  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {flags.map((f) => {
          const color = f.level === "alert"
            ? "text-[oklch(0.70_0.20_25)] border-[oklch(0.65_0.22_25)]/40 bg-[oklch(0.65_0.22_25)]/8"
            : f.level === "watch"
              ? "text-[oklch(0.78_0.16_70)] border-[oklch(0.78_0.16_70)]/40 bg-[oklch(0.78_0.16_70)]/8"
              : "text-[oklch(0.78_0.18_155)] border-[oklch(0.78_0.18_155)]/40 bg-[oklch(0.78_0.18_155)]/8";
          const Icon = f.level === "normal" ? CheckCircle2 : f.level === "alert" ? AlertTriangle : HeartPulse;
          return (
            <motion.div
              key={f.key}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className={`rounded-lg border px-3 py-2.5 flex items-start gap-2.5 ${color}`}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-[11px] opacity-80 mt-0.5">{f.detail}</div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
