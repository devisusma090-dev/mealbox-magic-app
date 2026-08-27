/**
 * Web Push notifications using the browser Notification API.
 * Works on desktop and on Android/Chrome installed PWAs without any
 * third-party push credentials.
 */
export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function pushNotify(title: string, body: string, tag?: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: tag ?? title, icon: "/favicon.ico" });
  } catch {
    /* notification failed silently */
  }
}

export function mapsUrl(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
