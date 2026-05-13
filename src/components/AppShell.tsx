import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Activity, Bluetooth, Database, Settings, Heart, Play, Sparkles } from "lucide-react";
import logo from "@/assets/denex-logo.jpg";
import { useEffect, useState } from "react";
import { ble } from "@/lib/bluetooth";

const nav = [
  { to: "/", label: "Dashboard", icon: Activity },
  { to: "/bluetooth", label: "Bluetooth", icon: Bluetooth },
  { to: "/sessions", label: "Sessions", icon: Database },
  { to: "/replay", label: "Replay", icon: Play },
  { to: "/correction", label: "Correction", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell() {
  const loc = useLocation();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsub = ble.subscribe(() => setTick((t) => t + 1));
    return () => { unsub(); };
  }, []);
  const connected = ble.state === "connected";

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/60 glass">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-border/60">
          <div className="h-9 w-9 rounded-lg overflow-hidden ring-1 ring-primary/40 glow-primary">
            <img src={logo} alt="Denex" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">DENEX</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Clean Signal</div>
          </div>
        </div>
        <nav className="p-3 flex-1 space-y-1" key={tick}>
          {nav.map((n) => {
            const active = loc.pathname === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"}`}
              >
                <Icon className="h-4 w-4" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border/60">
          <div className="rounded-lg bg-secondary/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Device</span>
              <span className={`text-[10px] text-mono ${connected ? "text-[oklch(0.78_0.18_155)]" : "text-muted-foreground"}`}>
                {connected ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Heart className={`h-4 w-4 ${connected ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-mono text-sm">{connected ? `${ble.device?.name ?? "BLE"}` : "No device"}</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border/60 glass">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Denex" className="h-7 w-7 rounded-md object-cover ring-1 ring-primary/40" />
            <span className="font-semibold tracking-wide">DENEX</span>
          </div>
          <span className={`text-[10px] text-mono ${connected ? "text-[oklch(0.78_0.18_155)]" : "text-muted-foreground"}`}>{connected ? "ONLINE" : "OFFLINE"}</span>
        </header>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
        <nav className="md:hidden flex border-t border-border/60 glass overflow-x-auto">
          {nav.map((n) => {
            const active = loc.pathname === n.to;
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} className={`flex-1 min-w-[4.5rem] flex flex-col items-center justify-center py-2 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon className="h-4 w-4 mb-0.5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
