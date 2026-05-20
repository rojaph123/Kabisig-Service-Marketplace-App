import * as Location from "expo-location";

const LOCATION_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), LOCATION_TIMEOUT_MS);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

export async function requestCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    return { granted: false, label: "Location permission not granted" };
  }

  const position = await withTimeout(
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true
    }),
    "Location request timed out. Please try again."
  );
  return {
    granted: true,
    label: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
    coords: position.coords
  };
}
