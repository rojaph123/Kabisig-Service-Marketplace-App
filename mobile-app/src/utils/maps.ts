const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

function normalizeLocation(value: string) {
  return value.trim();
}

function parseCoordinates(value: string) {
  const match = normalizeLocation(value).match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (!match) return null;

  return {
    latitude: match[1],
    longitude: match[3],
  };
}

export function googleMapsEmbedUrl(location: string) {
  const normalized = normalizeLocation(location);
  const query = encodeURIComponent(normalized);

  if (!GOOGLE_MAPS_API_KEY) {
    const coords = parseCoordinates(normalized);
    const embedQuery = coords ? `${coords.latitude},${coords.longitude}` : query;
    const zoom = coords ? 18 : 16;
    return `https://maps.google.com/maps?q=${embedQuery}&z=${zoom}&output=embed`;
  }

  const coords = parseCoordinates(normalized);
  if (coords) {
    return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${coords.latitude},${coords.longitude}&zoom=18&maptype=roadmap`;
  }

  return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${query}&zoom=16&maptype=roadmap`;
}

export function googleMapsExternalUrl(location: string) {
  const normalized = normalizeLocation(location);
  const query = encodeURIComponent(normalized);
  const coords = parseCoordinates(normalized);

  if (coords) {
    return `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
