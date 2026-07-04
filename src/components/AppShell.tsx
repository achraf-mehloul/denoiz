import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Activity, Bluetooth, Database, Settings, Play, Sparkles, GitCompare, LineChart } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ble } from "@/lib/bluetooth";
import { StatusBar } from "./StatusBar";

const nav = [
  { to: "/", label: "Moniteur", icon: Activity },
  { to: "/bluetooth", label: "Bluetooth", icon: Bluetooth },
  { to: "/sessions", label: "Sessions", icon: Database },
  { to: "/replay", label: "Relecture", icon: Play },
  { to: "/compare", label: "Comparer", icon: GitCompare },
  { to: "/correction", label: "Correction", icon: Sparkles },
  { to: "/analytics", label: "Analyse", icon: LineChart },
  { to: "/settings", label: "Réglages", icon: Settings },
] as const;

export function AppShell() {
  const loc = useLocation();
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = ble.subscribe(() => setTick((t) => t + 1));
    return () => { unsub(); };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <StatusBar />
      <div className="flex-1 flex min-w-0">
        <aside className="hidden md:flex w-60 lg:w-64 shrink-0 flex-col border-r border-border/60 glass">
          <Link to="/" className="px-5 py-4 flex items-center gap-3 border-b border-border/60 hover:opacity-90">
            <motion.div
              layoutId="denoiz-logo"
              className="h-10 w-10 rounded-lg overflow-hidden ring-1 ring-primary/40 glow-primary shrink-0"
            >
              <img src="/denoiz-logo.jpg" alt="Denoiz" className="h-full w-full object-cover" />
            </motion.div>
            <div className="min-w-0">
              <div className="font-display text-lg tracking-tight">Denoiz</div>
              <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Clean Signal · Safe Life</div>
            </div>
          </Link>
          <nav className="p-3 flex-1 space-y-0.5 overflow-y-auto">
            {nav.map((n) => {
              const active = loc.pathname === n.to;
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"}`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-md bg-primary/10 border border-primary/20"
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    />
                  )}
                  <Icon className="h-4 w-4 relative z-10" />
                  <span className="relative z-10">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            <Outlet />
          </main>
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 glass overflow-x-auto no-scrollbar flex">
            {nav.map((n) => {
              const active = loc.pathname === n.to;
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to} className={`shrink-0 flex-1 min-w-[4.5rem] flex flex-col items-center justify-center py-2 text-[9px] uppercase tracking-widest ${active ? "text-primary" : "text-muted-foreground"}`}>
                  <Icon className="h-4 w-4 mb-0.5" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
