import type { ProviderProfile } from "@kabisig/shared";

type ProviderCard = ProviderProfile & { userId: string; responseTimeMinutes?: number };

function isAvailableNow(provider: ProviderCard) {
  return provider.availability?.some((slot) => slot.available) ?? false;
}

export function getProviderResponseTimeLabel(provider: ProviderCard) {
  const estimatedMinutes =
    typeof provider.responseTimeMinutes === "number" && provider.responseTimeMinutes > 0
      ? provider.responseTimeMinutes
      : isAvailableNow(provider)
        ? 10
        : provider.availability?.some((slot) => slot.available)
          ? 30
          : 120;

  if (estimatedMinutes <= 10) {
    return "Fast responder";
  }

  if (estimatedMinutes < 60) {
    return `Usually replies in ${Math.round(estimatedMinutes)} minutes`;
  }

  if (estimatedMinutes < 180) {
    return "Usually replies within 2 hours";
  }

  return "Usually replies within the day";
}
