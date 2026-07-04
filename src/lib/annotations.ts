// Waveform annotations — user notes anchored to a sample index inside a
// stored session. Persisted in localStorage keyed by session id (small
// footprint, decoupled from the IndexedDB session store).

export type Annotation = {
  id: string;
  sampleIndex: number;
  text: string;
  createdAt: number;
};

const KEY = "denoiz.annotations";

function readAll(): Record<string, Annotation[]> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Annotation[]>; }
  catch { return {}; }
}
function writeAll(map: Record<string, Annotation[]>) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* noop */ }
}

export function listAnnotations(sessionId: string): Annotation[] {
  return readAll()[sessionId] ?? [];
}
export function addAnnotation(sessionId: string, sampleIndex: number, text: string): Annotation {
  const all = readAll();
  const list = all[sessionId] ?? [];
  const a: Annotation = { id: crypto.randomUUID(), sampleIndex, text, createdAt: Date.now() };
  list.push(a);
  list.sort((x, y) => x.sampleIndex - y.sampleIndex);
  all[sessionId] = list;
  writeAll(all);
  return a;
}
export function removeAnnotation(sessionId: string, id: string) {
  const all = readAll();
  all[sessionId] = (all[sessionId] ?? []).filter((a) => a.id !== id);
  writeAll(all);
}
