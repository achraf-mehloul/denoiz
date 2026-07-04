// Live waveform with optional overlay of detected R-peaks (Pan-Tompkins).

import { useEffect, useRef } from "react";
import { signal, BUFFER_SIZE } from "@/lib/signal";
import { detectQrs } from "@/lib/analytics";

type Channel = "original" | "noisy" | "filtered";

type Props = {
  color: string;
  label: string;
  unit?: string;
  height?: number;
  channel: Channel;
  amplitude?: number;
  showPeaks?: boolean;
};

export function EcgWaveform({ color, label, unit = "mV", height = 180, channel, amplitude = 1, showPeaks = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const ctx = canvas.getContext("2d")!;
    let dpr = window.devicePixelRatio || 1;
    let width = 0;
    const h = height;
    let buf = new Float32Array(0);
    let peaks: number[] = [];
    let peakTick = 0;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = container.clientWidth;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const samples = Math.min(BUFFER_SIZE, Math.max(64, Math.floor(width * 1.5)));
      buf = new Float32Array(samples);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const draw = () => {
      signal.renderInto(channel, buf);
      ctx.clearRect(0, 0, width, h);

      ctx.strokeStyle = "oklch(0.55 0.02 220 / 8%)";
      ctx.lineWidth = 1;
      const grid = 24;
      for (let x = 0; x < width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

      let max = 0;
      for (let i = 0; i < buf.length; i++) {
        const a = Math.abs(buf[i]);
        if (a > max) max = a;
      }
      const scale = max > 0 ? ((h / 2 - 8) / max) * amplitude : 0;

      if (showPeaks && (peakTick++ % 6 === 0)) peaks = detectQrs(buf);

      ctx.beginPath();
      const mid = h / 2;
      const xStep = width / Math.max(1, buf.length - 1);
      for (let i = 0; i < buf.length; i++) {
        const y = mid - buf[i] * scale;
        const x = i * xStep;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (showPeaks) {
        ctx.fillStyle = "oklch(0.78 0.18 155)";
        for (const p of peaks) {
          const x = p * xStep;
          const y = mid - buf[p] * scale;
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [color, height, channel, amplitude, showPeaks]);

  return (
    <div className="rounded-xl glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full pulse-dot" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
          <h3 className="text-sm font-medium tracking-wide">{label}</h3>
          {showPeaks && <span className="text-[10px] uppercase tracking-[0.2em] text-[oklch(0.78_0.18_155)] ml-1">R-peaks</span>}
        </div>
        <span className="text-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{unit} · 250Hz</span>
      </div>
      <div ref={containerRef} style={{ height }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
