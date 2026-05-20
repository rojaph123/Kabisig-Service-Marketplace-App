import type { ProviderProfile, ServiceCategory } from "@kabisig/shared";

type ProviderRateSource = Pick<ProviderProfile, "serviceCategories" | "hourlyRate">;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function getProviderMinimumJobRate(provider: ProviderRateSource, categories: ServiceCategory[]) {
  const offeredServices = new Set(provider.serviceCategories.map(normalize));
  const matchingPrices = categories
    .filter((category) => offeredServices.has(normalize(category.id)) || offeredServices.has(normalize(category.name)))
    .map((category) => Number(category.startingPrice || 0))
    .filter((price) => price > 0);

  if (matchingPrices.length) return Math.min(...matchingPrices);
  return Number(provider.hourlyRate || 0);
}

export function formatProviderStartingRate(provider: ProviderRateSource, categories: ServiceCategory[]) {
  const rate = getProviderMinimumJobRate(provider, categories);
  return rate > 0 ? `From ₱${rate.toLocaleString()}` : "Rate pending";
}
