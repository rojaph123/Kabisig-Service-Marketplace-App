import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { useAuth } from "./AuthProvider";
import { googleSignInConfig } from "../services/firebase";
import { type User } from "@kabisig/shared";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_PROMPT_TIMEOUT_MS = 45000;

export function useGoogleAuth({
  role,
  intent,
  onSuccess,
  onError,
}: {
  role: "customer" | "provider";
  intent: "login" | "register";
  onSuccess: (user: User) => void;
  onError: (message: string) => void;
}) {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const promptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeGoogleConfiguredRef = useRef(false);
  const handledResponseRef = useRef<string | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  function clearPromptTimeout() {
    if (promptTimeoutRef.current) {
      clearTimeout(promptTimeoutRef.current);
      promptTimeoutRef.current = null;
    }
  }

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Platform.OS === "web" ? googleSignInConfig.webClientId || googleSignInConfig.expoClientId : undefined,
    webClientId: Platform.OS === "web" ? googleSignInConfig.webClientId || googleSignInConfig.expoClientId : undefined,
    iosClientId: googleSignInConfig.iosClientId,
    androidClientId: googleSignInConfig.androidClientId,
    scopes: ["profile", "email"],
    selectAccount: true,
  });

  useEffect(() => {
    if (!response) return;
    const responseKey =
      response.type === "success"
        ? `${response.type}:${JSON.stringify("params" in response ? response.params : {})}`
        : response.type;

    if (handledResponseRef.current === responseKey) {
      return;
    }
    handledResponseRef.current = responseKey;
    clearPromptTimeout();

    if (response.type === "success") {
      const params = "params" in response ? response.params : {};
      const authentication = "authentication" in response ? response.authentication : null;
      const idToken = params?.id_token ?? authentication?.idToken;
      const accessToken = params?.access_token ?? authentication?.accessToken;

      if (!idToken && !accessToken) {
        onErrorRef.current("Google did not return an auth token. Check the Android OAuth client and app SHA fingerprints.");
        setBusy(false);
        return;
      }

      setBusy(true);
      void signInWithGoogle({ role, intent, idToken, accessToken })
        .then((user) => onSuccessRef.current(user))
        .catch((error) => onErrorRef.current(error instanceof Error ? error.message : "Google sign-in failed."))
        .finally(() => setBusy(false));
      return;
    }

    if (response.type === "error") {
      const params = "params" in response ? response.params : {};
      const description =
        params?.error_description ||
        params?.error ||
        "Google rejected this sign-in request. Check the Android OAuth client, package name, and SHA fingerprints in Google Cloud/Firebase.";
      setBusy(false);
      void WebBrowser.dismissBrowser();
      onErrorRef.current(description);
      return;
    }

    if (response.type === "cancel" || response.type === "dismiss") {
      setBusy(false);
      onErrorRef.current("Google sign-in was cancelled before it could finish.");
    }
  }, [intent, response, role, signInWithGoogle]);

  useEffect(() => {
    return () => clearPromptTimeout();
  }, []);

  function configureNativeGoogle() {
    if (nativeGoogleConfiguredRef.current || Platform.OS === "web") return;
    const webClientId = googleSignInConfig.webClientId || googleSignInConfig.expoClientId;
    if (!webClientId) {
      throw new Error("Google web client ID is missing. Native Google sign-in needs the Web client ID for Firebase.");
    }
    GoogleSignin.configure({
      webClientId,
      iosClientId: googleSignInConfig.iosClientId || undefined,
      scopes: ["profile", "email"],
      offlineAccess: false
    });
    nativeGoogleConfiguredRef.current = true;
  }

  async function startNativeGoogleSignIn() {
    configureNativeGoogle();
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    await GoogleSignin.signOut().catch(() => undefined);
    const result = await GoogleSignin.signIn();
    if (result.type !== "success") {
      throw new Error("Google sign-in was cancelled before it could finish.");
    }
    const tokens = await GoogleSignin.getTokens();
    const idToken = result.data.idToken || tokens.idToken;
    if (!idToken && !tokens.accessToken) {
      throw new Error("Google did not return an auth token. Check your Web client ID and Android SHA fingerprints.");
    }
    return await signInWithGoogle({ role, intent, idToken, accessToken: tokens.accessToken });
  }

  function formatNativeGoogleError(error: unknown) {
    const errorCode = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (errorCode === statusCodes.SIGN_IN_CANCELLED) return "Google sign-in was cancelled before it could finish.";
    if (errorCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return "Google Play Services is not available or needs to be updated on this phone.";
    if (errorCode === statusCodes.IN_PROGRESS) return "Google sign-in is already running. Close the Google screen, then try again.";
    return error instanceof Error ? error.message : "Google sign-in failed.";
  }

  async function startGoogleSignIn() {
    if (busy) return;
    try {
      if (Platform.OS === "web" && !(googleSignInConfig.webClientId || googleSignInConfig.expoClientId)) {
        throw new Error("Google web client ID is missing from the environment.");
      }

      if (Platform.OS === "ios" && !googleSignInConfig.iosClientId) {
        throw new Error("Google iOS client ID is missing from the environment.");
      }

      if (Platform.OS === "android" && !googleSignInConfig.androidClientId) {
        throw new Error("Google Android client ID is missing from the environment.");
      }

      setBusy(true);
      handledResponseRef.current = null;

      if (Platform.OS === "web") {
        const hasDedicatedWebClientId = Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
        if (!hasDedicatedWebClientId) {
          const user = await signInWithGoogle({ role, intent, usePopup: true });
          onSuccess(user);
          setBusy(false);
          return;
        }

        if (!request) {
          throw new Error("Google sign-in is still loading. Please wait a moment and try again.");
        }
      }

      if (Platform.OS !== "web") {
        const user = await startNativeGoogleSignIn();
        onSuccess(user);
        setBusy(false);
        return;
      }

      promptTimeoutRef.current = setTimeout(() => {
        setBusy(false);
        void WebBrowser.dismissBrowser();
        onError("Google sign-in is taking too long. Please close the browser if it is still open, then try again.");
      }, GOOGLE_PROMPT_TIMEOUT_MS);
      const promptOptions = { showInRecents: true } as any;
      const result = await promptAsync(promptOptions);
      if (result.type === "dismiss" || result.type === "cancel") {
        clearPromptTimeout();
        setBusy(false);
      }
    } catch (error) {
      clearPromptTimeout();
      setBusy(false);
      void WebBrowser.dismissBrowser();
      onError(Platform.OS === "web" ? (error instanceof Error ? error.message : "Google sign-in failed.") : formatNativeGoogleError(error));
    }
  }

  return {
    startGoogleSignIn,
    cancelGoogleSignIn: () => {
      clearPromptTimeout();
      setBusy(false);
      void WebBrowser.dismissBrowser();
      if (Platform.OS !== "web") {
        void GoogleSignin.signOut().catch(() => undefined);
      }
    },
    googleReady: Platform.OS === "web" ? true : Boolean(request),
    busy,
  };
}
