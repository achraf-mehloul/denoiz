import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bluetooth, BluetoothConnected, BluetoothSearching, Power, Signal, Battery, Activity } from "lucide-react";
import { ble } from "@/lib/bluetooth";

export const Route = createFileRoute("/_app/bluetooth")({
  component: BluetoothPage,
});

function BluetoothPage() {
  const [, setTick] = useState(0);
  const [rssi, setRssi] = useState(-62);
  const [loss, setLoss] = useState(0.4);

  useEffect(() => {
    const unsub = ble.subscribe(() => setTick((t) => t + 1));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setRssi((r) => Math.max(-95, Math.min(-40, r + (Math.random() - 0.5) * 4)));
      setLoss((l) => Math.max(0, Math.min(5, l + (Math.random() - 0.5) * 0.3)));
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const connected = ble.state === "connected";
  const supported = ble.isSupported();

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Connectivity</div>
        <h1 className="text-2xl md:text-3xl font-semibold mt-1">Bluetooth Device Center</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Pair, monitor and manage low-energy biomedical sensors over the Web Bluetooth API.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl glass p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ scale: connected ? [1, 1.05, 1] : 1 }}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`h-16 w-16 rounded-xl flex items-center justify-center ${connected ? "bg-primary/15 text-primary glow-primary" : "bg-secondary/40 text-muted-foreground"}`}
              >
                {connected ? <BluetoothConnected className="h-7 w-7" /> : ble.state === "scanning" ? <BluetoothSearching className="h-7 w-7" /> : <Bluetooth className="h-7 w-7" />}
              </motion.div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{ble.state}</div>
                <h2 className="text-xl font-semibold mt-1">{connected ? ble.device?.name ?? "Unnamed device" : "No device paired"}</h2>
                <div className="text-xs text-muted-foreground mt-1">{supported ? "Web Bluetooth supported" : "Web Bluetooth unavailable in this browser"}</div>
              </div>
            </div>
            <div className="flex gap-2">
              {!connected ? (
                <button
                  onClick={() => ble.scanAndConnect()}
                  disabled={!supported}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40"
                >
                  <BluetoothSearching className="h-4 w-4" />
                  Scan & connect
                </button>
              ) : (
                <button onClick={() => ble.disconnect()} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary/40">
                  <Power className="h-4 w-4" />
                  Disconnect
                </button>
              )}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4">
            <Metric icon={Signal} label="RSSI" value={`${rssi} dBm`} bar={Math.max(0, Math.min(100, ((rssi + 95) / 55) * 100))} />
            <Metric icon={Activity} label="Packet loss" value={`${loss.toFixed(2)} %`} bar={Math.max(0, 100 - loss * 20)} />
            <Metric icon={Battery} label="Battery" value={connected ? `${ble.battery || 87}%` : "—"} bar={connected ? ble.battery || 87 : 0} />
          </div>
        </div>

        <div className="rounded-xl glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium tracking-wide">BLE Logs</h3>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Live</span>
          </div>
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {ble.logs.length === 0 && <div className="text-xs text-muted-foreground">No events yet.</div>}
              {ble.logs.map((l) => (
                <motion.div
                  key={l.ts + l.msg}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2 text-xs text-mono"
                >
                  <span className="text-muted-foreground shrink-0">{new Date(l.ts).toLocaleTimeString()}</span>
                  <span className={
                    l.level === "error" ? "text-[oklch(0.70_0.20_25)]"
                    : l.level === "warn" ? "text-[oklch(0.78_0.16_70)]"
                    : l.level === "ok" ? "text-[oklch(0.78_0.18_155)]"
                    : "text-foreground/80"
                  }>
                    {l.msg}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, bar }: { icon: typeof Signal; label: string; value: string; bar: number }) {
  return (
    <div className="rounded-lg bg-secondary/30 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="text-mono text-xl mt-2">{value}</div>
      <div className="h-1 mt-3 rounded-full bg-background overflow-hidden">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${bar}%` }} />
      </div>
    </div>
  );
}
