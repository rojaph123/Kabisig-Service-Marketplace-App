import * as Location from "expo-location";

export async function requestCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    return { granted: false, label: "Location permission not granted" };
  }

  const position = await Location.getCurrentPositionAsync({});
  return {
    granted: true,
    label: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
    coords: position.coords
  };
}

