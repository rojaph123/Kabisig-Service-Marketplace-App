export function readableAppError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const normalized = raw.toLowerCase();

  if (normalized.includes("permission-denied") || normalized.includes("missing or insufficient permissions")) {
    return "Your account does not have permission to do this yet. Please refresh the app, check that you are signed in with the correct role, or ask the admin to update your access.";
  }

  if (normalized.includes("network") || normalized.includes("unavailable") || normalized.includes("offline")) {
    return "The connection looks unstable. Please check your internet connection and try again.";
  }

  if (normalized.includes("not-found") || normalized.includes("not found")) {
    return "We could not find that record anymore. It may have been updated or removed.";
  }

  return raw || fallback;
}
