// PNG snapshot of any DOM node, with an embedded metadata footer so the
// exported image is self-describing when shared or attached to a report.

import { toPng } from "html-to-image";

export type SnapshotMeta = {
  title: string;
  bpm?: number;
  duration?: string;
  device?: string;
  timestamp?: string;
};

export async function snapshotNode(node: HTMLElement, filename: string, meta: SnapshotMeta): Promise<void> {
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: "#0b1418",
    cacheBust: true,
    filter: (el) => !(el instanceof HTMLElement && el.dataset.snapshotExclude === "true"),
  });
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((res) => { img.onload = () => res(); });
  const footerH = 96;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height + footerH * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b1418";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = "#0f1a1f";
  ctx.fillRect(0, img.height, canvas.width, footerH * 2);
  ctx.fillStyle = "#5cb7c7";
  ctx.font = "bold 22px 'JetBrains Mono', ui-monospace";
  ctx.fillText("DENOIZ", 32, img.height + 40);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "16px 'JetBrains Mono', ui-monospace";
  ctx.fillText(meta.title, 32, img.height + 68);
  const meta2 = [meta.bpm ? `${meta.bpm} bpm` : "", meta.duration ?? "", meta.device ?? "", meta.timestamp ?? new Date().toLocaleString()].filter(Boolean).join("  •  ");
  ctx.fillStyle = "rgba(200,220,230,0.55)";
  ctx.font = "13px 'JetBrains Mono', ui-monospace";
  ctx.fillText(meta2, 32, img.height + 92);
  ctx.fillText("Clean Signal, Safe Life", 32, img.height + 132);
  await new Promise<void>((res) => {
    canvas.toBlob((blob) => {
      if (!blob) return res();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => { URL.revokeObjectURL(url); res(); }, 800);
    }, "image/png");
  });
}
