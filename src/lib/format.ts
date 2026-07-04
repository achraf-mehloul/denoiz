export function fmtSec(s: number): string {
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
export function fmtMs(ms: number): string { return fmtSec(ms / 1000); }
export function fmtDur(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}m ${sec}s`;
}
