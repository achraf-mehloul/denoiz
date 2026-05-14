// CSV / JSON exporters for live and stored ECG streams.
// Exports always include rich session metadata, calibration state, BLE
// telemetry, and a simple integrity checksum so consumers can validate
// the file structure before parsing the channels.

import type { Session } from "./db";
import { calibration } from "./calibration";
import { ble } from "./bluetooth";

const APP_VERSION = "0.3.0";
const FORMAT_VERSION = "denex.session.v2";

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ExportPayload = {
  id: string;
  label: string;
  startedAt: number;
  durationMs: number;
  sampleRate: number;
  avgBpm?: number;
  deviceName?: string;
  original: Float32Array;
  noisy: Float32Array;
  filtered: Float32Array;
};

function buildMetadata(p: ExportPayload) {
  const cal = calibration.get();
  return {
    format: FORMAT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    session: {
      id: p.id,
      label: p.label,
      startedAt: new Date(p.startedAt).toISOString(),
      durationMs: p.durationMs,
      sampleRate: p.sampleRate,
      samples: p.original.length,
      avgBpm: p.avgBpm ?? null,
    },
    device: {
      name: p.deviceName ?? null,
      bleState: ble.state,
      throughputPktSec: ble.throughput,
      avgIntervalMs: ble.avgIntervalMs,
      jitterMs: ble.jitterMs,
      packetLossPct: ble.packetLoss,
      battery: ble.battery,
    },
    calibration: {
      enabled: cal.enabled,
      gain: cal.gain,
      offset: cal.offset,
      updatedAt: cal.updatedAt ? new Date(cal.updatedAt).toISOString() : null,
    },
  };
}

function checksum(arr: Float32Array): string {
  // FNV-1a over the raw bytes for a fast, dependency-free integrity hash.
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function exportCsv(p: ExportPayload, opts: { decimals?: number } = {}) {
  const dec = opts.decimals ?? 5;
  const meta = buildMetadata(p);
  const header: string[] = [];
  header.push(`# ${FORMAT_VERSION}`);
  header.push(`# exported_at=${meta.exportedAt}`);
  header.push(`# device=${meta.device.name ?? ""} state=${meta.device.bleState}`);
  header.push(`# sample_rate=${p.sampleRate} samples=${p.original.length}`);
  header.push(`# calibration_enabled=${meta.calibration.enabled} gain=${meta.calibration.gain} offset=${meta.calibration.offset}`);
  header.push(`# ble_jitter_ms=${meta.device.jitterMs} loss_pct=${meta.device.packetLossPct} throughput_pkt_s=${meta.device.throughputPktSec}`);
  header.push(`# checksum_original=${checksum(p.original)}`);
  header.push("index,time_s,original_mV,noisy_mV,filtered_mV");
  const rows: string[] = [header.join("\n")];
  const n = Math.min(p.original.length, p.noisy.length, p.filtered.length);
  for (let i = 0; i < n; i++) {
    const t = (i / p.sampleRate).toFixed(4);
    rows.push(`${i},${t},${p.original[i].toFixed(dec)},${p.noisy[i].toFixed(dec)},${p.filtered[i].toFixed(dec)}`);
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  download(`${safeName(p.label)}.csv`, blob);
}

export function exportJson(p: ExportPayload) {
  const meta = buildMetadata(p);
  const payload = {
    ...meta,
    integrity: {
      checksumOriginal: checksum(p.original),
      checksumNoisy: checksum(p.noisy),
      checksumFiltered: checksum(p.filtered),
      algorithm: "fnv1a-32",
    },
    channels: {
      original: Array.from(p.original).map((v) => +v.toFixed(5)),
      noisy: Array.from(p.noisy).map((v) => +v.toFixed(5)),
      filtered: Array.from(p.filtered).map((v) => +v.toFixed(5)),
    },
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  download(`${safeName(p.label)}.json`, blob);
}

export function fromSession(s: Session): ExportPayload {
  return {
    id: s.id,
    label: `denex-session-${new Date(s.startedAt).toISOString().replace(/[:.]/g, "-")}`,
    startedAt: s.startedAt,
    durationMs: s.durationMs,
    sampleRate: s.sampleRate,
    avgBpm: s.avgBpm,
    deviceName: s.deviceName,
    original: s.original,
    noisy: s.noisy,
    filtered: s.filtered,
  };
}

function safeName(s: string) {
  return s.replace(/[^a-z0-9_\-.]/gi, "_");
}
