import { useEffect, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { useAuth } from "./AuthProvider";
import { googleSignInConfig } from "../services/firebase";

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth({
  role,
  intent,
  onSuccess,
  onError,
}: {
  role: "customer" | "provider";
  intent: "login" | "register";
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const isExpoGo = Constants.executionEnvironment === "storeClient";
  const nativeRedirectUri = Platform.OS === "web" ? undefined : (makeRedirectUri({ useProxy: isExpoGo } as any) as string);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleSignInConfig.expoClientId,
    iosClientId: googleSignInConfig.iosClientId,
    androidClientId: googleSignInConfig.androidClientId || googleSignInConfig.expoClientId,
    scopes: ["profile", "email"],
    selectAccount: true,
    redirectUri: nativeRedirectUri,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === "success") {
      const params = "params" in response ? response.params : {};
      const authentication = "authentication" in response ? response.authentication : null;
      const idToken = params?.id_token ?? authentication?.idToken;
      const accessToken = params?.access_token ?? authentication?.accessToken;

      setBusy(true);
      void signInWithGoogle({ role, intent, idToken, accessToken })
        .then(() => onSuccess())
        .catch((error) => onError(error instanceof Error ? error.message : "Google sign-in failed."))
        .finally(() => setBusy(false));
      return;
    }

    if (response.type === "error") {
      setBusy(false);
      onError("Google sign-in failed. Please try again.");
      return;
    }

    if (response.type === "cancel" || response.type === "dismiss") {
      setBusy(false);
      onError("Google sign-in was cancelled before it could finish.");
    }
  }, [intent, onError, onSuccess, response, role, signInWithGoogle]);

  async function startGoogleSignIn() {
    try {
      if (Platform.OS === "web" && !googleSignInConfig.expoClientId) {
        throw new Error("Google web client ID is missing from the environment.");
      }

      if (Platform.OS === "ios" && !googleSignInConfig.iosClientId) {
        throw new Error("Google iOS client ID is missing from the environment.");
      }

      if (Platform.OS === "android" && !googleSignInConfig.androidClientId) {
        throw new Error("Google Android client ID is missing from the environment.");
      }

      setBusy(true);

      if (Platform.OS === "web") {
        await signInWithGoogle({ role, intent, usePopup: true });
        onSuccess();
        return;
      }

      setBusy(false);
      const promptOptions = (isExpoGo ? { useProxy: true, showInRecents: true } : { showInRecents: true }) as any;
      await promptAsync(promptOptions);
    } catch (error) {
      setBusy(false);
      onError(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  }

  return {
    startGoogleSignIn,
    googleReady: Platform.OS === "web" ? true : Boolean(request),
    busy,
  };
}
