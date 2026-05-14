import { useEffect, useRef } from "react";
import { signal, BUFFER_SIZE } from "@/lib/signal";

type Channel = "original" | "noisy" | "filtered";

type Props = {
  color: string;
  label: string;
  unit?: string;
  height?: number;
  channel: Channel;
  amplitude?: number;
  samplesPerPixel?: number;
};

// Renders the ring buffer for `channel` directly. Pure visualization of
// data that already exists in `signal` — no synthetic motion is added when
// the buffer is empty.
export function EcgWaveform({
  color,
  label,
  unit = "mV",
  height = 180,
  channel,
  amplitude = 1,
  samplesPerPixel = 1,
}: Props) {
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

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = container.clientWidth;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const samples = Math.min(BUFFER_SIZE, Math.max(64, Math.floor(width * samplesPerPixel)));
      buf = new Float32Array(samples);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const draw = () => {
      signal.renderInto(channel, buf);
      ctx.clearRect(0, 0, width, h);

      // Grid.
      ctx.strokeStyle = "rgba(120,160,180,0.07)";
      ctx.lineWidth = 1;
      const grid = 24;
      for (let x = 0; x < width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

      // Auto-scale based on visible data.
      let max = 0;
      for (let i = 0; i < buf.length; i++) {
        const a = Math.abs(buf[i]);
        if (a > max) max = a;
      }
      const scale = max > 0 ? ((h / 2 - 8) / max) * amplitude : 0;

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

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [color, height, channel, amplitude, samplesPerPixel]);

  return (
    <div className="rounded-xl glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full pulse-dot" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
          <h3 className="text-sm font-medium tracking-wide">{label}</h3>
        </div>
        <span className="text-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{unit} · 250Hz</span>
      </div>
      <div ref={containerRef} style={{ height }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
