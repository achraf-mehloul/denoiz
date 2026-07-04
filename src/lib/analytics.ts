// Real-time analytics: HRV metrics, Pan-Tompkins QRS detection, and
// arrhythmia flags derived from the live signal store.

import type { BpmPoint } from "./signal";

export type HrvMetrics = {
  count: number;
  rmssd: number; // ms
  sdnn: number;  // ms
  pnn50: number; // %
  meanRr: number; // ms
  meanHr: number; // bpm
};

export function computeHrv(bpm: BpmPoint[], windowMs = 120_000): HrvMetrics {
  if (bpm.length < 3) return { count: 0, rmssd: 0, sdnn: 0, pnn50: 0, meanRr: 0, meanHr: 0 };
  const cutoff = bpm[bpm.length - 1].t - windowMs;
  const rr: number[] = [];
  for (const p of bpm) {
    if (p.t < cutoff) continue;
    if (p.bpm <= 0) continue;
    rr.push(60_000 / p.bpm);
  }
  if (rr.length < 3) return { count: rr.length, rmssd: 0, sdnn: 0, pnn50: 0, meanRr: 0, meanHr: 0 };
  const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
  let sq = 0, diff2 = 0, nn50 = 0;
  for (let i = 0; i < rr.length; i++) sq += (rr[i] - mean) ** 2;
  for (let i = 1; i < rr.length; i++) {
    const d = rr[i] - rr[i - 1];
    diff2 += d * d;
    if (Math.abs(d) > 50) nn50++;
  }
  const sdnn = Math.sqrt(sq / rr.length);
  const rmssd = Math.sqrt(diff2 / (rr.length - 1));
  const pnn50 = (nn50 / (rr.length - 1)) * 100;
  return {
    count: rr.length,
    rmssd: +rmssd.toFixed(1),
    sdnn: +sdnn.toFixed(1),
    pnn50: +pnn50.toFixed(1),
    meanRr: +mean.toFixed(1),
    meanHr: +(60_000 / mean).toFixed(1),
  };
}

// Pan-Tompkins style QRS detection (simplified, single-pass).
// Returns sample indices where R-peaks are detected inside `buffer`.
export function detectQrs(buffer: Float32Array, fs = 250): number[] {
  const n = buffer.length;
  if (n < fs) return [];
  // 1. Derivative
  const d = new Float32Array(n);
  for (let i = 2; i < n - 2; i++) {
    d[i] = (2 * buffer[i + 2] + buffer[i + 1] - buffer[i - 1] - 2 * buffer[i - 2]) / 8;
  }
  // 2. Squaring
  const sq = new Float32Array(n);
  for (let i = 0; i < n; i++) sq[i] = d[i] * d[i];
  // 3. Moving-window integration (window ~150ms)
  const w = Math.max(1, Math.round(0.15 * fs));
  const mw = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += sq[i];
    if (i >= w) acc -= sq[i - w];
    mw[i] = acc / w;
  }
  // 4. Adaptive threshold
  let peakLevel = 0, noiseLevel = 0;
  for (let i = 0; i < Math.min(n, fs * 2); i++) if (mw[i] > peakLevel) peakLevel = mw[i];
  let threshold = 0.35 * peakLevel;
  const minRr = Math.round(0.25 * fs); // 240 bpm max
  const peaks: number[] = [];
  let lastPeak = -minRr;
  for (let i = 1; i < n - 1; i++) {
    if (mw[i] > threshold && mw[i] > mw[i - 1] && mw[i] >= mw[i + 1] && i - lastPeak >= minRr) {
      // Refine to true R inside a small window
      const from = Math.max(0, i - Math.floor(w / 2));
      const to = Math.min(n - 1, i + Math.floor(w / 2));
      let bestIdx = i, bestVal = -Infinity;
      for (let j = from; j <= to; j++) {
        const v = Math.abs(buffer[j]);
        if (v > bestVal) { bestVal = v; bestIdx = j; }
      }
      peaks.push(bestIdx);
      lastPeak = bestIdx;
      peakLevel = 0.875 * peakLevel + 0.125 * mw[i];
      threshold = noiseLevel + 0.35 * (peakLevel - noiseLevel);
    } else {
      noiseLevel = 0.875 * noiseLevel + 0.125 * mw[i];
    }
  }
  return peaks;
}

export type ArrhythmiaLevel = "normal" | "watch" | "alert";
export type ArrhythmiaFlag = {
  key: "tachycardia" | "bradycardia" | "irregular" | "no_signal";
  label: string;
  level: ArrhythmiaLevel;
  detail: string;
};

export function evaluateArrhythmia(bpm: number, hrv: HrvMetrics): ArrhythmiaFlag[] {
  const flags: ArrhythmiaFlag[] = [];
  if (bpm <= 0) {
    flags.push({ key: "no_signal", label: "Aucun signal", level: "watch", detail: "En attente d'une mesure valide." });
    return flags;
  }
  if (bpm > 100) flags.push({ key: "tachycardia", label: "Tachycardie", level: bpm > 130 ? "alert" : "watch", detail: `${bpm} bpm — supérieur au seuil physiologique de repos (100 bpm).` });
  else if (bpm < 50) flags.push({ key: "bradycardia", label: "Bradycardie", level: bpm < 40 ? "alert" : "watch", detail: `${bpm} bpm — inférieur au seuil physiologique de repos (50 bpm).` });
  if (hrv.count >= 8 && hrv.rmssd > 120) flags.push({ key: "irregular", label: "Rythme irrégulier", level: "watch", detail: `RMSSD ${hrv.rmssd} ms — variabilité anormalement élevée.` });
  if (flags.length === 0) flags.push({ key: "no_signal", label: "Rythme sinusal normal", level: "normal", detail: `${bpm} bpm dans la plage physiologique 50–100.` });
  return flags;
}
