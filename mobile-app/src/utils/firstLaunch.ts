import AsyncStorage from "@react-native-async-storage/async-storage";

const WELCOME_SEEN_KEY = "kabisig:welcomeSeen";

export async function hasSeenWelcomeScreen() {
  return (await AsyncStorage.getItem(WELCOME_SEEN_KEY)) === "true";
}

export async function markWelcomeScreenSeen() {
  await AsyncStorage.setItem(WELCOME_SEEN_KEY, "true");
}
