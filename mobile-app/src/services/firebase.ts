import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";
import { setFirebaseConfig, type FirebaseConfig } from "@kabisig/shared";

declare const require: (moduleName: string) => any;

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required Firebase environment variable: ${name}`);
  }

  return value;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: requireEnv("EXPO_PUBLIC_FIREBASE_API_KEY", process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: requireEnv(
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
  ),
  projectId: requireEnv(
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
  ),
  storageBucket: requireEnv(
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
  ),
  messagingSenderId: requireEnv(
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  ),
  appId: requireEnv("EXPO_PUBLIC_FIREBASE_APP_ID", process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
};

setFirebaseConfig(firebaseConfig);

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createFirebaseAuth(): Auth {
  if (Platform.OS === "web") {
    return getAuth(firebaseApp);
  }

  try {
    const authReactNative = require("@firebase/auth") as {
      getAuth: typeof getAuth;
      initializeAuth: (app: typeof firebaseApp, deps?: { persistence?: unknown }) => Auth;
      getReactNativePersistence: (storage: unknown) => unknown;
    };
    const ReactNativeAsyncStorage = require("@react-native-async-storage/async-storage").default;

    try {
      return authReactNative.initializeAuth(firebaseApp, {
        persistence: authReactNative.getReactNativePersistence(ReactNativeAsyncStorage),
      });
    } catch {
      return authReactNative.getAuth(firebaseApp);
    }
  } catch {
    return getAuth(firebaseApp);
  }
}

export const firebaseAuth = createFirebaseAuth();
export const firestore = getFirestore(firebaseApp);

export const googleSignInConfig = {
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || "",
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || ""
};
