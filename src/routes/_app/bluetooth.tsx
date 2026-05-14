import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bluetooth, BluetoothConnected, BluetoothSearching, Power, Signal, Battery, Activity, RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { ble } from "@/lib/bluetooth";

export const Route = createFileRoute("/_app/bluetooth")({
  component: BluetoothPage,
});

function BluetoothPage() {
  const [, setTick] = useState(0);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const unsub = ble.subscribe(() => setTick((t) => t + 1));
    return () => { unsub(); };
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (ble.nextReconnectAt > 0) setCountdown(Math.max(0, Math.ceil((ble.nextReconnectAt - Date.now()) / 1000)));
      else setCountdown(0);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const connected = ble.isLive();
  const reconnecting = ble.state === "reconnecting" || ble.state === "connecting" || ble.state === "discovering" || ble.state === "subscribing";
  const supported = ble.isSupported();
  const savedName = ble.savedDeviceName();

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Connectivity</div>
        <h1 className="text-2xl md:text-3xl font-semibold mt-1">Bluetooth Device Center</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Pair, monitor and manage low-energy biomedical sensors over the Web Bluetooth API. Denex auto-reconnects with exponential backoff and remembers your device across app restarts.</p>
      </div>

      {!supported && (
        <div className="rounded-xl glass p-4 flex items-start gap-3 border border-[oklch(0.65_0.22_25)]/40">
          <AlertTriangle className="h-5 w-5 text-[oklch(0.70_0.20_25)] mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Web Bluetooth not supported</div>
            <div className="text-muted-foreground mt-1">Use Chrome, Edge or Opera over HTTPS. iOS Safari does not expose Web Bluetooth.</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl glass p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ scale: connected ? [1, 1.05, 1] : 1 }}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`h-16 w-16 rounded-xl flex items-center justify-center ${connected ? "bg-primary/15 text-primary glow-primary" : reconnecting ? "bg-[oklch(0.78_0.16_70)]/15 text-[oklch(0.78_0.16_70)]" : "bg-secondary/40 text-muted-foreground"}`}
              >
                {connected ? <BluetoothConnected className="h-7 w-7" /> : reconnecting ? <BluetoothSearching className="h-7 w-7 animate-pulse" /> : <Bluetooth className="h-7 w-7" />}
              </motion.div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{ble.state}</div>
                <h2 className="text-xl font-semibold mt-1">
                  {connected
                    ? ble.device?.name ?? "Unnamed device"
                    : reconnecting
                      ? `Reconnecting to ${ble.device?.name ?? savedName ?? "device"}…`
                      : savedName
                        ? `Last paired: ${savedName}`
                        : "No device paired"}
                </h2>
                <div className="text-xs text-muted-foreground mt-1">
                  {reconnecting && countdown > 0 && `Next attempt in ${countdown}s · attempt ${ble.reconnectAttempts}`}
                  {!reconnecting && ble.lastError && <span className="text-[oklch(0.70_0.20_25)]">{ble.lastError}</span>}
                  {!reconnecting && !ble.lastError && (supported ? "Web Bluetooth ready" : "Web Bluetooth unavailable")}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!connected && (
                <button
                  onClick={() => ble.scanAndConnect()}
                  disabled={!supported}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40"
                >
                  <BluetoothSearching className="h-4 w-4" />
                  {savedName ? "Pair new device" : "Scan & connect"}
                </button>
              )}
              {!connected && savedName && (
                <button
                  onClick={() => ble.reconnectNow()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary/40"
                >
                  <RotateCcw className="h-4 w-4" /> Retry now
                </button>
              )}
              {connected && (
                <button onClick={() => ble.disconnect()} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary/40">
                  <Power className="h-4 w-4" /> Disconnect
                </button>
              )}
              {savedName && (
                <button onClick={() => ble.forgetDevice()} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:bg-secondary/40">
                  <Trash2 className="h-3.5 w-3.5" /> Forget
                </button>
              )}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4">
            <Metric icon={Signal} label="Packet loss" value={`${ble.packetLoss.toFixed(1)} %`} bar={Math.max(0, 100 - ble.packetLoss * 5)} />
            <Metric icon={Activity} label="Reconnect attempts" value={`${ble.reconnectAttempts}`} bar={Math.min(100, ble.reconnectAttempts * 12)} />
            <Metric icon={Battery} label="Battery" value={connected && ble.battery > 0 ? `${ble.battery}%` : "—"} bar={connected ? ble.battery : 0} />
          </div>

          <label className="mt-6 flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Auto-reconnect</div>
              <div className="text-xs text-muted-foreground mt-0.5">Backoff: 1s → 2s → 4s … capped at 30s. Restored on app start.</div>
            </div>
            <button
              onClick={() => ble.setAutoReconnect(!ble.autoReconnect)}
              className={`relative h-6 w-11 rounded-full transition-colors ${ble.autoReconnect ? "bg-primary" : "bg-secondary"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background transition-transform ${ble.autoReconnect ? "translate-x-5" : ""}`} />
            </button>
          </label>

          <div className="mt-4 text-xs text-muted-foreground">
            After recording, head to the <Link to="/sessions" className="text-primary underline-offset-2 hover:underline">Sessions</Link> page to replay or export.
          </div>
        </div>

        <div className="rounded-xl glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium tracking-wide">BLE Logs</h3>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Live</span>
          </div>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
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
                  }>{l.msg}</span>
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
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
      </div>
    </div>
  );
}
