// Local notifications via the standard Notification API. Frontend-only —
// no push server required. Used to alert on device disconnection during a
// recording so the user can react even if the tab is backgrounded.

const KEY = "denoiz.notify";

export function notifySupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}
export function notifyEnabled(): boolean {
  if (!notifySupported()) return false;
  return Notification.permission === "granted" && localStorage.getItem(KEY) === "1";
}
export async function requestNotify(): Promise<boolean> {
  if (!notifySupported()) return false;
  const p = await Notification.requestPermission();
  const ok = p === "granted";
  localStorage.setItem(KEY, ok ? "1" : "0");
  return ok;
}
export function setNotifyEnabled(v: boolean) {
  localStorage.setItem(KEY, v ? "1" : "0");
}
export function notify(title: string, body: string, tag = "denoiz") {
  if (!notifyEnabled()) return;
  try {
    new Notification(title, { body, tag, icon: "/denoiz-logo.jpg", badge: "/denoiz-logo.jpg" });
  } catch { /* noop */ }
}
