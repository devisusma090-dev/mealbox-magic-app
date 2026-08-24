export async function adminDb(passcode: string) {
  const expected = process.env["ADMIN_PASSCODE"];
  if (!expected || !passcode || passcode !== expected) {
    throw new Error("Invalid admin passcode");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function randomOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
