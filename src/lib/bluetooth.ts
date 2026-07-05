// Web Bluetooth manager — REAL data only, with broad device compatibility.
//
// Supports three scan modes:
//   • "hr"      — only devices advertising Heart Rate Service (default)
//   • "services"— filter by a user-provided list of service UUIDs
//   • "all"     — acceptAllDevices (discover anything in range, DIY/ESP32)
//
// Pipes:
//   • Heart Rate Service (0x180D) → BPM + RR-intervals into the signal store
//   • Optional custom raw-stream characteristic (Float32 little-endian
//     samples, configurable Service + Char UUIDs) → waveform buffers
//   • Battery Service (0x180F) when present
//
// Telemetry: jitter, throughput, packet age, battery, packet-loss heuristic,
// exponential-backoff auto-reconnect with persistent device id.

import { signal } from "./signal";

export type BleState =
  | "idle"
  | "scanning"
  | "connecting"
  | "discovering"
  | "subscribing"
  | "streaming"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "unsupported";

export type BleLog = { ts: number; level: "info" | "warn" | "error" | "ok"; msg: string };
export type ScanMode = "hr" | "services" | "all";
export type BrowserSupport = {
  supported: boolean;
  isIos: boolean;
  isSafari: boolean;
  isFirefox: boolean;
  isSecureContext: boolean;
  hint: string;
};

const STORAGE_KEY = "denex.ble.lastDevice";
const RAW_CHAR_KEY = "denex.ble.rawCharUuid";
const RAW_SVC_KEY = "denex.ble.rawSvcUuid";
const SCAN_MODE_KEY = "denex.ble.scanMode";
const SCAN_SVCS_KEY = "denex.ble.scanServices";
const AUTO_KEY = "denex.ble.autoReconnect";

type Listener = () => void;

type GattChar = {
  uuid: string;
  startNotifications: () => Promise<GattChar>;
  addEventListener: (t: string, cb: (ev: Event) => void) => void;
  readValue: () => Promise<DataView>;
  value?: DataView;
};
type GattService = {
  uuid: string;
  getCharacteristic: (uuid: string) => Promise<GattChar>;
  getCharacteristics?: () => Promise<GattChar[]>;
};
type GattServer = {
  connected: boolean;
  connect: () => Promise<GattServer>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<GattService>;
  getPrimaryServices?: () => Promise<GattService[]>;
};
type AnyBleDevice = {
  id: string;
  name?: string;
  gatt?: GattServer;
  addEventListener: (t: string, cb: () => void) => void;
  removeEventListener?: (t: string, cb: () => void) => void;
};

type BleNavigator = Navigator & {
  bluetooth: {
    requestDevice: (o: object) => Promise<AnyBleDevice>;
    getDevices?: () => Promise<AnyBleDevice[]>;
    getAvailability?: () => Promise<boolean>;
  };
};

class BluetoothManager {
  device: AnyBleDevice | null = null;
  state: BleState = "idle";
  battery = 0;
  packetLoss = 0;
  throughput = 0;
  jitterMs = 0;
  avgIntervalMs = 0;
  lastPacketTs = 0;
  hasRawStream = false;
  logs: BleLog[] = [];
  autoReconnect = true;
  reconnectAttempts = 0;
  nextReconnectAt = 0;
  lastError: string | null = null;
  rawCharUuid: string | null = null;
  rawSvcUuid: string | null = null;
  scanMode: ScanMode = "hr";
  scanServices: string[] = [];

  private listeners = new Set<Listener>();
  private hrChar: GattChar | null = null;
  private rawChar: GattChar | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalSamples: number[] = [];
  private windowStart = 0;
  private windowCount = 0;

  constructor() {
    if (typeof window !== "undefined") {
      this.loadPrefs();
      queueMicrotask(() => this.tryRestore());
    }
  }

  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  private emit() { for (const l of this.listeners) l(); }
  private log(level: BleLog["level"], msg: string) {
    this.logs = [{ ts: Date.now(), level, msg }, ...this.logs].slice(0, 200);
    this.emit();
  }

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  /** Detailed environment check with platform-specific guidance. */
  browserSupport(): BrowserSupport {
    if (typeof navigator === "undefined") {
      return { supported: false, isIos: false, isSafari: false, isFirefox: false, isSecureContext: false, hint: "" };
    }
    const ua = navigator.userAgent || "";
    const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    const isFirefox = /Firefox|FxiOS/i.test(ua);
    const supported = "bluetooth" in navigator;
    const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : false;
    let hint = "";
    if (!supported) {
      if (isIos) hint = "iOS/iPadOS does not expose Web Bluetooth in any browser. Use the Bluefy browser, or open Denoiz on Chrome/Edge desktop or Android.";
      else if (isSafari) hint = "Safari does not implement Web Bluetooth. Use Chrome, Edge, or Opera.";
      else if (isFirefox) hint = "Firefox does not enable Web Bluetooth by default. Use Chrome, Edge, or Opera.";
      else hint = "Your browser does not support Web Bluetooth. Try Chrome, Edge, or Opera over HTTPS.";
    } else if (!isSecureContext) {
      hint = "Web Bluetooth requires HTTPS or localhost.";
    }
    return { supported: supported && isSecureContext, isIos, isSafari, isFirefox, isSecureContext, hint };
  }

  setAutoReconnect(v: boolean) {
    this.autoReconnect = v;
    try { localStorage.setItem(AUTO_KEY, v ? "1" : "0"); } catch { /* noop */ }
    this.emit();
  }

  setScanMode(m: ScanMode) {
    this.scanMode = m;
    try { localStorage.setItem(SCAN_MODE_KEY, m); } catch { /* noop */ }
    this.emit();
  }

  setScanServices(list: string[]) {
    this.scanServices = list.map((s) => s.trim().toLowerCase()).filter(Boolean);
    try { localStorage.setItem(SCAN_SVCS_KEY, JSON.stringify(this.scanServices)); } catch { /* noop */ }
    this.emit();
  }

  setRawCharUuid(uuid: string | null) {
    this.rawCharUuid = uuid && uuid.trim() ? uuid.trim().toLowerCase() : null;
    try {
      if (this.rawCharUuid) localStorage.setItem(RAW_CHAR_KEY, this.rawCharUuid);
      else localStorage.removeItem(RAW_CHAR_KEY);
    } catch { /* noop */ }
    this.emit();
  }

  setRawSvcUuid(uuid: string | null) {
    this.rawSvcUuid = uuid && uuid.trim() ? uuid.trim().toLowerCase() : null;
    try {
      if (this.rawSvcUuid) localStorage.setItem(RAW_SVC_KEY, this.rawSvcUuid);
      else localStorage.removeItem(RAW_SVC_KEY);
    } catch { /* noop */ }
    this.emit();
  }

  private loadPrefs() {
    try {
      const a = localStorage.getItem(AUTO_KEY);
      if (a !== null) this.autoReconnect = a === "1";
      this.rawCharUuid = localStorage.getItem(RAW_CHAR_KEY);
      this.rawSvcUuid = localStorage.getItem(RAW_SVC_KEY);
      const sm = localStorage.getItem(SCAN_MODE_KEY) as ScanMode | null;
      if (sm === "hr" || sm === "services" || sm === "all") this.scanMode = sm;
      const svcs = localStorage.getItem(SCAN_SVCS_KEY);
      if (svcs) this.scanServices = JSON.parse(svcs) as string[];
    } catch { /* noop */ }
  }

  private persistDevice(d: AnyBleDevice) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: d.id, name: d.name ?? null, ts: Date.now() })); } catch { /* noop */ }
  }
  private loadPersisted(): { id: string; name: string | null } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as { id: string; name: string | null };
    } catch { return null; }
  }
  forgetDevice() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    this.log("info", "Forgot saved device");
    this.emit();
  }
  hasSavedDevice() { return this.loadPersisted() !== null; }
  savedDeviceName() { return this.loadPersisted()?.name ?? null; }

  async tryRestore() {
    if (!this.isSupported() || !this.autoReconnect) return;
    const saved = this.loadPersisted();
    if (!saved) return;
    const nav = navigator as BleNavigator;
    if (!nav.bluetooth.getDevices) return;
    try {
      const devices = await nav.bluetooth.getDevices();
      const match = devices.find((d) => d.id === saved.id);
      if (match) {
        this.log("info", `Restoring connection to ${match.name ?? saved.name ?? "device"}`);
        await this.attach(match);
      }
    } catch (e) {
      this.log("warn", `Restore failed: ${msg(e)}`);
    }
  }

  /** Build optionalServices list — every service we may want to access. */
  private buildOptionalServices(): string[] {
    const set = new Set<string>(["battery_service", "device_information", "heart_rate"]);
    for (const s of this.scanServices) set.add(s);
    if (this.rawSvcUuid) set.add(this.rawSvcUuid);
    if (this.rawCharUuid) set.add(this.rawCharUuid);
    return Array.from(set);
  }

  async scanAndConnect() {
    const sup = this.browserSupport();
    if (!sup.supported) {
      this.state = "unsupported";
      this.lastError = sup.hint;
      this.log("error", sup.hint || "Web Bluetooth unavailable");
      this.emit();
      return;
    }
    this.cancelReconnect();
    try {
      this.state = "scanning"; this.lastError = null; this.emit();
      const nav = navigator as BleNavigator;
      const optional = this.buildOptionalServices();
      let opts: object;
      if (this.scanMode === "all") {
        this.log("info", "Scanning ALL nearby BLE devices…");
        opts = { acceptAllDevices: true, optionalServices: optional };
      } else if (this.scanMode === "services" && this.scanServices.length > 0) {
        this.log("info", `Scanning by services: ${this.scanServices.join(", ")}`);
        opts = { filters: [{ services: this.scanServices }], optionalServices: optional };
      } else {
        this.log("info", "Scanning Heart Rate devices…");
        opts = { filters: [{ services: ["heart_rate"] }], optionalServices: optional };
      }
      const device = await nav.bluetooth.requestDevice(opts);
      this.persistDevice(device);
      await this.attach(device);
    } catch (e) {
      this.lastError = msg(e);
      this.log("error", this.lastError);
      this.state = "idle";
      this.emit();
    }
  }

  private resetStats() {
    this.intervalSamples = [];
    this.windowCount = 0;
    this.windowStart = performance.now();
    this.throughput = 0;
    this.jitterMs = 0;
    this.avgIntervalMs = 0;
    this.lastPacketTs = 0;
    this.packetLoss = 0;
  }

  private async attach(device: AnyBleDevice) {
    this.device = device;
    this.state = "connecting"; this.emit();
    try {
      const server = await device.gatt?.connect();
      if (!server) throw new Error("GATT connect failed");
      device.addEventListener("gattserverdisconnected", this.onDisconnected);

      this.state = "discovering"; this.emit();
      this.resetStats();
      this.hasRawStream = false;
      this.hrChar = null;
      this.rawChar = null;

      this.state = "subscribing"; this.emit();

      // Heart Rate Service — best-effort.
      try {
        const hrSvc = await server.getPrimaryService("heart_rate");
        const hrChar = await hrSvc.getCharacteristic("heart_rate_measurement");
        hrChar.addEventListener("characteristicvaluechanged", this.onHrChange);
        await hrChar.startNotifications();
        this.hrChar = hrChar;
        this.log("ok", "Subscribed to heart_rate_measurement");
      } catch (e) {
        this.log("warn", `HR service unavailable: ${msg(e)}`);
      }

      // Optional raw waveform characteristic — supports either a known
      // service UUID (fast path) or a brute-force search of every service.
      if (this.rawCharUuid) {
        try {
          let found: GattChar | null = null;
          if (this.rawSvcUuid) {
            try {
              const svc = await server.getPrimaryService(this.rawSvcUuid);
              found = await svc.getCharacteristic(this.rawCharUuid);
            } catch { /* fall through to scan */ }
          }
          if (!found) {
            const services = (await server.getPrimaryServices?.()) ?? [];
            for (const svc of services) {
              try {
                const chars = (await svc.getCharacteristics?.()) ?? [];
                const match = chars.find((c) => c.uuid.toLowerCase() === this.rawCharUuid);
                if (match) { found = match; break; }
              } catch { /* skip */ }
            }
          }
          if (found) {
            found.addEventListener("characteristicvaluechanged", this.onRawChange);
            await found.startNotifications();
            this.rawChar = found;
            this.hasRawStream = true;
            this.log("ok", `Subscribed to raw stream ${found.uuid}`);
          } else {
            this.log("warn", `Raw characteristic ${this.rawCharUuid} not found`);
          }
        } catch (e) {
          this.log("warn", `Raw subscription failed: ${msg(e)}`);
        }
      }

      // Battery (optional).
      try {
        const batSvc = await server.getPrimaryService("battery_service");
        const batChar = await batSvc.getCharacteristic("battery_level");
        const v = await batChar.readValue();
        this.battery = v.getUint8(0);
      } catch { this.battery = 0; }

      if (!this.hrChar && !this.rawChar) {
        this.log("warn", "No known characteristics on this device. Try setting a Raw Service/Char UUID in Settings.");
      }

      this.state = "streaming";
      this.reconnectAttempts = 0;
      signal.start();
      this.log("ok", `Connected to ${device.name ?? device.id}`);
      this.emit();
    } catch (e) {
      this.lastError = msg(e);
      this.log("error", `Connect failed: ${this.lastError}`);
      this.state = "disconnected";
      this.emit();
      this.scheduleReconnect();
    }
  }

  private trackPacket() {
    const now = performance.now();
    if (this.lastPacketTs > 0) {
      const dt = now - this.lastPacketTs;
      this.intervalSamples.push(dt);
      if (this.intervalSamples.length > 40) this.intervalSamples.shift();
      const mean = this.intervalSamples.reduce((a, b) => a + b, 0) / this.intervalSamples.length;
      this.avgIntervalMs = Math.round(mean);
      const variance = this.intervalSamples.reduce((a, b) => a + (b - mean) ** 2, 0) / this.intervalSamples.length;
      this.jitterMs = Math.round(Math.sqrt(variance));
    }
    this.lastPacketTs = now;
    this.windowCount++;
    if (this.windowStart === 0) this.windowStart = now;
    const elapsed = (now - this.windowStart) / 1000;
    if (elapsed >= 1) {
      this.throughput = +(this.windowCount / elapsed).toFixed(1);
      if (this.avgIntervalMs > 0) {
        const expected = Math.max(1, Math.round(elapsed * (1000 / this.avgIntervalMs)));
        this.packetLoss = +Math.max(0, Math.min(100, ((expected - this.windowCount) / expected) * 100)).toFixed(1);
      }
      this.windowStart = now;
      this.windowCount = 0;
    }
  }

  private onHrChange = (ev: Event) => {
    const target = ev.target as unknown as { value?: DataView };
    const v = target.value;
    if (!v || v.byteLength < 2) return;
    try {
      const flags = v.getUint8(0);
      const is16 = (flags & 0x1) === 0x1;
      const energyPresent = (flags & 0x8) === 0x8;
      const rrPresent = (flags & 0x10) === 0x10;
      let offset = 1;
      const bpm = is16 ? v.getUint16(offset, true) : v.getUint8(offset);
      offset += is16 ? 2 : 1;
      if (energyPresent) offset += 2;
      if (rrPresent) {
        const rrs: number[] = [];
        while (offset + 2 <= v.byteLength) {
          const rr1024 = v.getUint16(offset, true);
          offset += 2;
          const rrMs = (rr1024 / 1024) * 1000;
          if (rrMs > 200 && rrMs < 3000) rrs.push(rrMs);
        }
        if (rrs.length) signal.pushRr(rrs);
      }
      if (bpm > 0 && bpm < 300) {
        signal.pushBpm(bpm);
        this.trackPacket();
        this.emit();
      }
    } catch (e) {
      this.log("warn", `Bad HR packet: ${msg(e)}`);
    }
  };

  private onRawChange = (ev: Event) => {
    const target = ev.target as unknown as { value?: DataView };
    const v = target.value;
    if (!v || v.byteLength < 4) return;
    try {
      for (let i = 0; i + 4 <= v.byteLength; i += 4) {
        const sample = v.getFloat32(i, true);
        if (Number.isFinite(sample)) signal.pushSample(sample);
      }
      this.trackPacket();
      this.emit();
    } catch (e) {
      this.log("warn", `Bad raw packet: ${msg(e)}`);
    }
  };

  private onDisconnected = () => {
    this.log("warn", "Device disconnected");
    this.state = "disconnected";
    signal.stop();
    this.emit();
    if (this.autoReconnect) this.scheduleReconnect();
  };

  private scheduleReconnect() {
    if (!this.device || !this.autoReconnect) return;
    this.cancelReconnect();
    const delay = Math.min(30_000, 1000 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.nextReconnectAt = Date.now() + delay;
    this.state = "reconnecting"; this.emit();
    this.log("info", `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.reconnectNow(), delay);
  }
  private cancelReconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.nextReconnectAt = 0;
  }
  async reconnectNow() {
    if (!this.device) { await this.tryRestore(); return; }
    this.state = "connecting"; this.emit();
    try {
      const server = await this.device.gatt?.connect();
      if (!server) throw new Error("GATT connect failed");
      this.state = "streaming";
      this.reconnectAttempts = 0;
      signal.start();
      this.log("ok", "Reconnected");
      this.emit();
    } catch (e) {
      this.lastError = msg(e);
      this.log("error", `Reconnect failed: ${this.lastError}`);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.cancelReconnect();
    this.autoReconnect = false;
    try { this.device?.gatt?.disconnect(); } catch { /* noop */ }
    this.state = "idle";
    this.device = null;
    this.hrChar = null;
    this.rawChar = null;
    this.hasRawStream = false;
    signal.stop();
    this.log("info", "Disconnected by user");
    this.emit();
  }

  isLive(): boolean {
    return this.state === "streaming" || this.state === "connected";
  }
}

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export const ble = new BluetoothManager();
