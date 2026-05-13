import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Database, Download, Trash2, Plus, Play } from "lucide-react";
import { listSessions, saveSession, deleteSession, type Session } from "@/lib/db";

export const Route = createFileRoute("/_app/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  const [items, setItems] = useState<Session[]>([]);
  const refresh = () => listSessions().then(setItems).catch(() => setItems([]));
  useEffect(() => { refresh(); }, []);

  const addDemo = async () => {
    await saveSession({
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      durationMs: Math.floor(60_000 + Math.random() * 600_000),
      avgBpm: Math.round(65 + Math.random() * 20),
      signalQuality: Math.round(85 + Math.random() * 14),
      samples: Math.floor(15_000 + Math.random() * 80_000),
    });
    refresh();
  };

  const remove = async (id: string) => { await deleteSession(id); refresh(); };

  const exportJson = (s: Session) => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `denex-session-${s.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const fmtDur = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60); const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Archive</div>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">Sessions</h1>
        </div>
        <button onClick={addDemo} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> New session
        </button>
      </div>

      <div className="rounded-xl glass overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border/60">
          <div className="col-span-4">Started</div>
          <div className="col-span-2">Duration</div>
          <div className="col-span-2">Avg BPM</div>
          <div className="col-span-2">Quality</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {items.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
            <Database className="h-8 w-8 opacity-40" />
            No sessions stored locally.
          </div>
        ) : items.map((s) => (
          <div key={s.id} className="grid grid-cols-12 items-center px-5 py-3 text-sm border-b border-border/40 last:border-0 hover:bg-secondary/20">
            <div className="col-span-4 text-mono">{new Date(s.startedAt).toLocaleString()}</div>
            <div className="col-span-2 text-mono">{fmtDur(s.durationMs)}</div>
            <div className="col-span-2 text-mono">{s.avgBpm}</div>
            <div className="col-span-2">
              <div className="flex items-center gap-2">
                <div className="h-1 w-20 rounded bg-background overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${s.signalQuality}%` }} />
                </div>
                <span className="text-xs text-mono text-muted-foreground">{s.signalQuality}%</span>
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-end gap-1.5">
              <button className="p-2 rounded hover:bg-secondary/60" title="Replay"><Play className="h-3.5 w-3.5" /></button>
              <button onClick={() => exportJson(s)} className="p-2 rounded hover:bg-secondary/60" title="Export"><Download className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(s.id)} className="p-2 rounded hover:bg-secondary/60 text-[oklch(0.70_0.20_25)]" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
