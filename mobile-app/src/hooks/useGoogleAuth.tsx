import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { authService, User } from "@kabisig/shared";

WebBrowser.maybeCompleteAuthSession();

interface UseGoogleAuthParams {
  role: "customer" | "provider";
  intent: "login" | "register";
  onSuccess: (user: User) => void;
  onError: (message: string) => void;
}

export function useGoogleAuth({ role, intent, onSuccess, onError }: UseGoogleAuthParams) {
  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  // Get Google client IDs from environment
  const expoClientId = process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

  // Initialize Google auth request
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId,
    iosClientId,
    androidClientId,
    scopes: ["profile", "email"],
  });

  // Handle auth response
  useEffect(() => {
    if (response?.type === "success") {
      handleGoogleSuccess(response.authentication);
    } else if (response?.type === "error") {
      onError(response.error?.message || "Google sign-in was cancelled");
    }
  }, [response]);

  // Check if Google is configured
  useEffect(() => {
    const isConfigured = !!(expoClientId || iosClientId || androidClientId);
    setGoogleReady(isConfigured);
    if (!isConfigured) {
      console.warn("Google Sign-In not configured: missing client IDs in environment");
    }
  }, [expoClientId, iosClientId, androidClientId]);

  async function handleGoogleSuccess(auth: any) {
    try {
      setBusy(true);

      // Extract tokens
      const { idToken, accessToken } = auth;

      // Complete Google authentication
      const result = await authService.completeGoogleAuth({
        role,
        intent,
        idToken,
        accessToken,
        usePopup: false,
      });

      onSuccess(result.appUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google authentication failed";
      onError(message);
      console.error("Google auth error:", error);
    } finally {
      setBusy(false);
    }
  }

  async function startGoogleSignIn() {
    if (!googleReady || !request) {
      onError("Google Sign-In is not configured. Please check your environment variables.");
      return;
    }

    try {
      setBusy(true);
      const result = await promptAsync();
      if (result?.type !== "success") {
        setBusy(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start Google sign-in";
      onError(message);
      setBusy(false);
    }
  }

  return {
    startGoogleSignIn,
    googleReady,
    busy,
  };
}
