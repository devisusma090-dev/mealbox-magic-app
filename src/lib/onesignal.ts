/**
 * OneSignal Web Push (v16) — background notifications for staff/admin devices,
 * even when the browser tab is closed. The app id is stored in store settings
 * so the owner can configure it without a redeploy.
 */
type OneSignalApi = {
  init: (opts: Record<string, unknown>) => Promise<void>;
  User: { PushSubscription: { optedIn?: boolean; id?: string | null; optIn: () => Promise<void>; optOut: () => Promise<void> } };
  Notifications: { permission: boolean; requestPermission: () => Promise<void> };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: OneSignalApi) => void | Promise<void>>;
    __mb91_onesignal_app?: string;
  }
}

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById("onesignal-sdk")) return resolve();
    const s = document.createElement("script");
    s.id = "onesignal-sdk";
    s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the notification service."));
    document.head.appendChild(s);
  });
}

async function withOneSignal(appId: string): Promise<OneSignalApi> {
  await loadSdk();
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  return new Promise((resolve) => {
    window.OneSignalDeferred!.push(async (OneSignal) => {
      if (window.__mb91_onesignal_app !== appId) {
        window.__mb91_onesignal_app = appId;
        await OneSignal.init({
          appId,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
          allowLocalhostAsSecureOrigin: true,
        });
      }
      resolve(OneSignal);
    });
  });
}

export async function isSubscribed(appId: string) {
  if (!appId || typeof window === "undefined") return false;
  try {
    const os = await withOneSignal(appId);
    return Boolean(os.User.PushSubscription.optedIn);
  } catch {
    return false;
  }
}

export async function subscribeToOrderAlerts(appId: string) {
  const os = await withOneSignal(appId);
  if (!os.Notifications.permission) await os.Notifications.requestPermission();
  await os.User.PushSubscription.optIn();
  return Boolean(os.User.PushSubscription.optedIn);
}

export async function unsubscribeFromOrderAlerts(appId: string) {
  const os = await withOneSignal(appId);
  await os.User.PushSubscription.optOut();
  return false;
}
