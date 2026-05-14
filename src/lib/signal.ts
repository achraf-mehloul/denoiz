// Central signal store — STRICT REAL DATA ONLY.
//
// Samples and BPM measurements only enter this store from the BLE adapter
// (`pushSample`, `pushBpm`). There is no synthetic generator, no fallback
// waveform, no demo mode. Until a real packet arrives every getter returns
// neutral values and the dashboard is expected to render an empty state.

import { SignalPipeline, defaultFilterParams, type FilterParams } from "./dsp";
import { calibration } from "./calibration";

export const SAMPLE_RATE = 250; // assumed Hz when raw waveform is streamed
export const BUFFER_SECONDS = 12;
export const BUFFER_SIZE = SAMPLE_RATE * BUFFER_SECONDS;
export const BPM_HISTORY_MAX = 240; // ~ a few minutes of HR samples

type Listener = () => void;

export type BpmPoint = { t: number; bpm: number };

export type SignalSnapshot = {
  bpm: number;
  bpmAvg: number;
  bpmMin: number;
  bpmMax: number;
  quality: number;
  hasRawWaveform: boolean;
  hasBpm: boolean;
  samplesReceived: number;
  bpmReceived: number;
  lastSampleAgeMs: number;
  lastBpmAgeMs: number;
  streaming: boolean;
  recording: boolean;
  recordedSamples: number;
  recordedDurationMs: number;
};

class SignalStore {
  // Triple-channel ring buffers (raw waveform if device exposes one).
  original = new Float32Array(BUFFER_SIZE);
  noisy = new Float32Array(BUFFER_SIZE);
  filtered = new Float32Array(BUFFER_SIZE);
  head = 0;

  // Live state.
  bpm = 0;
  bpmHistory: BpmPoint[] = [];
  quality = 0;
  streaming = false;

  samplesReceived = 0;
  bpmReceived = 0;
  lastSampleTs = 0;
  lastBpmTs = 0;
  bpmIntervalMs = 0;

  // Recording.
  recording = false;
  recStart = 0;
  recOriginal: number[] = [];
  recNoisy: number[] = [];
  recFiltered: number[] = [];
  recBpm: BpmPoint[] = [];

  // Filter pipeline used live for the "filtered" channel.
  filterParams: FilterParams = defaultFilterParams();
  pipeline = new SignalPipeline(this.filterParams, SAMPLE_RATE);

  private listeners = new Set<Listener>();

  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  private emit() { for (const l of this.listeners) l(); }

  setFilterParams(p: FilterParams) {
    this.filterParams = p;
    this.pipeline.update(p);
    this.emit();
  }

  // BLE adapter pushes a real heart-rate measurement here.
  pushBpm(bpm: number) {
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    const now = performance.now();
    if (this.lastBpmTs > 0) {
      this.bpmIntervalMs = now - this.lastBpmTs;
      const expected = 60_000 / Math.max(bpm, 30);
      const ratio = Math.min(this.bpmIntervalMs, expected) / Math.max(this.bpmIntervalMs, expected);
      this.quality = Math.round(Math.max(40, Math.min(100, ratio * 100)));
    } else {
      this.quality = 100;
    }
    this.lastBpmTs = now;
    this.bpm = Math.round(bpm);
    this.bpmReceived++;
    const point: BpmPoint = { t: Date.now(), bpm: this.bpm };
    this.bpmHistory.push(point);
    if (this.bpmHistory.length > BPM_HISTORY_MAX) this.bpmHistory.shift();
    if (this.recording) this.recBpm.push(point);
    this.emit();
  }

  // BLE adapter pushes a raw ECG sample (already converted to mV by the
  // device or its driver). Optional channel — many BLE sensors only expose
  // BPM. When called, the buffers fill with REAL data only.
  pushSample(raw: number) {
    if (!Number.isFinite(raw)) return;
    const v = calibration.apply(raw);
    const filtered = this.pipeline.process(v);
    this.write(v, v, filtered);
    this.samplesReceived++;
    this.lastSampleTs = performance.now();
    this.streaming = true;
    if (this.recording) {
      this.recOriginal.push(v);
      this.recNoisy.push(v);
      this.recFiltered.push(filtered);
    }
    this.emit();
  }

  start() {
    // Marks the store as actively expecting data. No synthetic generation.
    this.streaming = true;
    this.emit();
  }

  stop() {
    this.streaming = false;
    this.bpm = 0;
    this.quality = 0;
    this.lastBpmTs = 0;
    this.lastSampleTs = 0;
    this.bpmIntervalMs = 0;
    this.original.fill(0); this.noisy.fill(0); this.filtered.fill(0);
    this.head = 0;
    this.samplesReceived = 0;
    this.pipeline.reset();
    this.emit();
  }

  reset() {
    this.stop();
    this.bpmHistory = [];
    this.bpmReceived = 0;
    this.emit();
  }

  private write(o: number, n: number, f: number) {
    this.original[this.head] = o;
    this.noisy[this.head] = n;
    this.filtered[this.head] = f;
    this.head = (this.head + 1) % BUFFER_SIZE;
  }

  // Render a window of `width` samples into a destination Float32Array
  // by sub-sampling the ring buffer (most-recent on the right).
  renderInto(channel: "original" | "noisy" | "filtered", dst: Float32Array) {
    const src = this[channel];
    const len = dst.length;
    for (let i = 0; i < len; i++) {
      const idx = (this.head - len + i + BUFFER_SIZE) % BUFFER_SIZE;
      dst[i] = src[idx];
    }
  }

  getSampleAt(channel: "original" | "noisy" | "filtered", offsetFromHead: number): number {
    const src = this[channel];
    const idx = (this.head + offsetFromHead + BUFFER_SIZE) % BUFFER_SIZE;
    return src[idx];
  }

  startRecording() {
    if (this.recording) return;
    this.recording = true;
    this.recStart = Date.now();
    this.recOriginal = [];
    this.recNoisy = [];
    this.recFiltered = [];
    this.recBpm = [];
    this.emit();
  }

  stopRecording() {
    this.recording = false;
    const out = {
      original: Float32Array.from(this.recOriginal),
      noisy: Float32Array.from(this.recNoisy),
      filtered: Float32Array.from(this.recFiltered),
      bpm: this.recBpm.slice(),
      durationMs: Date.now() - this.recStart,
      startedAt: this.recStart,
    };
    this.recOriginal = []; this.recNoisy = []; this.recFiltered = []; this.recBpm = [];
    this.emit();
    return out;
  }

  snapshot(): SignalSnapshot {
    const now = performance.now();
    let avg = 0, min = Infinity, max = -Infinity;
    for (const p of this.bpmHistory) {
      avg += p.bpm;
      if (p.bpm < min) min = p.bpm;
      if (p.bpm > max) max = p.bpm;
    }
    if (this.bpmHistory.length > 0) avg = avg / this.bpmHistory.length;
    else { min = 0; max = 0; }
    return {
      bpm: this.bpm,
      bpmAvg: Math.round(avg),
      bpmMin: Math.round(min),
      bpmMax: Math.round(max),
      quality: this.quality,
      hasRawWaveform: this.samplesReceived > 0,
      hasBpm: this.bpmReceived > 0,
      samplesReceived: this.samplesReceived,
      bpmReceived: this.bpmReceived,
      lastSampleAgeMs: this.lastSampleTs ? Math.round(now - this.lastSampleTs) : -1,
      lastBpmAgeMs: this.lastBpmTs ? Math.round(now - this.lastBpmTs) : -1,
      streaming: this.streaming,
      recording: this.recording,
      recordedSamples: this.recOriginal.length,
      recordedDurationMs: this.recording ? Date.now() - this.recStart : 0,
    };
  }
}

export const signal = new SignalStore();
