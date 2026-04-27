export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

let runtimeFirebaseConfig: FirebaseConfig | null = null;

export function setFirebaseConfig(config: FirebaseConfig) {
  runtimeFirebaseConfig = { ...config };
}

export function hasFirebaseConfig() {
  return Boolean(
    runtimeFirebaseConfig?.apiKey &&
      runtimeFirebaseConfig?.projectId &&
      runtimeFirebaseConfig?.appId
  );
}

export const getFirebaseConfig = (): FirebaseConfig => {
  if (!runtimeFirebaseConfig) {
    throw new Error(
      "Firebase config has not been initialized. The host app must call setFirebaseConfig() before using shared Firebase services."
    );
  }

  return runtimeFirebaseConfig;
};

export default getFirebaseConfig;
