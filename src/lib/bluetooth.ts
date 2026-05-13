export type BleDevice = {
  id: string;
  name: string;
  rssi?: number;
  connected: boolean;
  battery?: number;
};

export type BleLog = { ts: number; level: "info" | "warn" | "error" | "ok"; msg: string };

type Listener = () => void;

type AnyBleDevice = {
  id: string;
  name?: string;
  gatt?: { connect: () => Promise<{ getPrimaryService: (s: string) => Promise<{ getCharacteristic: (c: string) => Promise<{ readValue: () => Promise<DataView> }> }> }>; disconnect: () => void };
  addEventListener: (type: string, cb: () => void) => void;
};

class BluetoothManager {
  device: AnyBleDevice | null = null;
  state: "idle" | "scanning" | "connecting" | "connected" | "disconnected" = "idle";
  rssi = 0;
  packetLoss = 0;
  battery = 0;
  logs: BleLog[] = [];
  listeners = new Set<Listener>();

  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  private emit() { this.listeners.forEach((l) => l()); }
  private log(level: BleLog["level"], msg: string) {
    this.logs = [{ ts: Date.now(), level, msg }, ...this.logs].slice(0, 60);
    this.emit();
  }

  isSupported() { return typeof navigator !== "undefined" && "bluetooth" in navigator; }

  async scanAndConnect() {
    if (!this.isSupported()) {
      this.log("error", "Web Bluetooth not supported in this browser.");
      return;
    }
    try {
      this.state = "scanning"; this.emit();
      this.log("info", "Requesting BLE device…");
      const device = await (navigator as Navigator & { bluetooth: { requestDevice: (o: object) => Promise<AnyBleDevice> } }).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["heart_rate", "battery_service", "device_information"],
      });
      this.device = device;
      this.log("ok", `Selected ${device.name ?? "Unknown device"}`);
      this.state = "connecting"; this.emit();
      const server = await device.gatt?.connect();
      if (!server) throw new Error("GATT connect failed");
      this.state = "connected";
      this.log("ok", `Connected to ${device.name ?? device.id}`);
      device.addEventListener("gattserverdisconnected", () => {
        this.state = "disconnected";
        this.log("warn", "Device disconnected");
        this.emit();
      });
      try {
        const batSvc = await server.getPrimaryService("battery_service");
        const batChar = await batSvc.getCharacteristic("battery_level");
        const val = await batChar.readValue();
        this.battery = val.getUint8(0);
      } catch { this.battery = 0; }
      this.emit();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      this.log("error", m);
      this.state = "idle";
      this.emit();
    }
  }

  disconnect() {
    try { this.device?.gatt?.disconnect(); } catch { /* noop */ }
    this.state = "idle";
    this.device = null;
    this.log("info", "Disconnected");
    this.emit();
  }
}

export const ble = new BluetoothManager();
