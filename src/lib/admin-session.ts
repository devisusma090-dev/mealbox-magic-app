export const ADMIN_PASSCODE_KEY = "mb91_admin_passcode";

export function getAdminPasscode(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(ADMIN_PASSCODE_KEY) ?? "";
}

export function clearAdminPasscode() {
  if (typeof window !== "undefined") sessionStorage.removeItem(ADMIN_PASSCODE_KEY);
}
