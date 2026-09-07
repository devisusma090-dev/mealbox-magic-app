/**
 * OneSignal REST push — background alerts to subscribed staff devices even
 * when the browser tab is closed. Credentials live in server secrets.
 */
export async function sendStaffPush(title: string, message: string, url?: string) {
  const appId = process.env['ONESIGNAL_APP_ID'];
  const apiKey = process.env['ONESIGNAL_REST_API_KEY'];
  if (!appId || !apiKey) return false;

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ["Subscribed Users"],
        headings: { en: title },
        contents: { en: message },
        ...(url ? { url } : {}),
        priority: 10,
      }),
    });
    if (!res.ok) {
      console.error(`[onesignal] push failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 400)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[onesignal] push error", err);
    return false;
  }
}
