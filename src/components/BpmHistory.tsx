import { useEffect, useRef } from "react";
import type { BpmPoint } from "@/lib/signal";

type Props = {
  data: BpmPoint[];
  height?: number;
  color?: string;
};

export function BpmHistory({ data, height = 140, color = "oklch(0.78 0.15 190)" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const h = height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, h);
    ctx.strokeStyle = "rgba(120,160,180,0.08)";
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

    if (data.length < 2) return;
    let min = Infinity, max = -Infinity;
    for (const p of data) { if (p.bpm < min) min = p.bpm; if (p.bpm > max) max = p.bpm; }
    if (min === max) { min -= 5; max += 5; }
    const pad = 10;
    const scaleY = (h - pad * 2) / (max - min);
    const stepX = width / (data.length - 1);

    // Area fill.
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < data.length; i++) {
      const y = h - pad - (data[i].bpm - min) * scaleY;
      ctx.lineTo(i * stepX, y);
    }
    ctx.lineTo(width, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "oklch(0.78 0.15 190 / 30%)");
    grad.addColorStop(1, "oklch(0.78 0.15 190 / 0%)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Line.
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = h - pad - (data[i].bpm - min) * scaleY;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [data, height, color]);

  return (
    <div ref={containerRef} style={{ height }} className="w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
