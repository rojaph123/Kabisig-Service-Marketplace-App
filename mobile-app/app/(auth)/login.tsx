import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BrandBlock, FeedbackBanner, FormInput, FullScreenPopup, PrimaryButton, Screen, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { useGoogleAuth } from "../../src/hooks/useGoogleAuth";
import { theme } from "../../src/theme";

function GoogleButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 20,
        paddingVertical: 15,
        paddingHorizontal: 18,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#DCE8F8",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 12
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "#F8FAFC",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "#E2E8F0"
        }}
      >
        <Text style={{ fontWeight: "900", color: "#DB4437", fontSize: 15 }}>G</Text>
      </View>
      <Text style={{ color: "#0F172A", fontWeight: "900", fontSize: 15 }}>Continue with Google</Text>
    </Pressable>
  );
}

function TermsOverlay({
  visible,
  onAgree,
  onClose,
  mode
}: {
  visible: boolean;
  onAgree: () => void;
  onClose: () => void;
  mode: "login" | "google";
}) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.48)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <SurfaceCard style={{ width: "100%", maxWidth: 380, gap: 16 }}>
          <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: "#E7F2FF", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="document-text-outline" size={24} color="#0F6FDB" />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "900" }}>Terms and agreement</Text>
            <Text style={{ color: theme.colors.textMuted, lineHeight: 21 }}>
              Before {mode === "google" ? "continuing with Google" : "signing in"}, please agree that Kabisig may store your account,
              booking, notification, and communication data to operate the platform properly.
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={onClose} style={{ flex: 1, borderRadius: 18, paddingVertical: 14, alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}>
              <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onAgree} style={{ flex: 1, borderRadius: 18, paddingVertical: 14, alignItems: "center", backgroundColor: theme.colors.primary }}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Agree</Text>
            </Pressable>
          </View>
        </SurfaceCard>
      </View>
    </Modal>
  );
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const { selectedRole, setSelectedRole, signIn, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);
  const [termsMode, setTermsMode] = useState<"login" | "google" | null>(null);
  const [popupError, setPopupError] = useState<string | null>(null);

  useEffect(() => {
    if (params.role === "provider" || params.role === "customer") {
      setSelectedRole(params.role);
    }
  }, [params.role, setSelectedRole]);

  useEffect(() => {
    if (error) {
      setPopupError(error);
      setFeedback({ type: "error", title: "Login failed", message: error });
    }
  }, [error]);

  const role = ((params.role === "provider" || selectedRole === "provider") ? "provider" : "customer") as "customer" | "provider";
  const roleCopy = useMemo(
    () =>
      role === "provider"
        ? { title: "Provider sign in", subtitle: "Manage jobs, schedules, earnings, and approvals in one place." }
        : { title: "Customer sign in", subtitle: "Book trusted local help and keep your services organized." },
    [role]
  );

  const { startGoogleSignIn, googleReady, busy: googleBusy } = useGoogleAuth({
    role,
    intent: "login",
    onSuccess: () => {
      setTermsMode(null);
      router.replace("/" as never);
    },
    onError: (message) => {
      setTermsMode(null);
      setFeedback({ type: "error", title: "Google sign-in failed", message });
      setPopupError(message);
    }
  });

  async function continueLogin() {
    try {
      setLoading(true);
      setFeedback({ type: "info", title: "Signing you in", message: "Preparing your Kabisig workspace..." });
      const signedInUser = await signIn({ email, password, role });
      const nextRoute =
        signedInUser.role === "provider"
          ? !signedInUser.onboardingCompleted
            ? "/provider/onboarding"
            : signedInUser.approvalStatus !== "Approved"
              ? "/provider/pending"
              : "/(tabs)/home"
          : "/(tabs)/home";
      router.replace(nextRoute as never);
    } catch (loginError) {
      const nextMessage = loginError instanceof Error ? loginError.message : "We could not sign you in right now.";
      setFeedback({ type: "error", title: "Login failed", message: nextMessage });
      setPopupError(nextMessage);
    } finally {
      setLoading(false);
      setTermsMode(null);
    }
  }

  return (
    <Screen style={{ backgroundColor: "#EAF4FF", paddingHorizontal: 0, paddingTop: 0 }}>
      <LinearGradient
        colors={["#071A34", "#0B2E5E", "#1287DB"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ marginHorizontal: -20, marginTop: -20, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 120, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }}
      >
        <View style={{ gap: 18, alignItems: "center" }}>
          <BrandBlock compact size={118} />
          <View style={{ gap: 8, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 32, fontWeight: "900", textAlign: "center" }}>{roleCopy.title}</Text>
            <Text style={{ color: "rgba(255,255,255,0.86)", lineHeight: 22, textAlign: "center" }}>{roleCopy.subtitle}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 20, marginTop: -84, gap: 14 }}>
        <SurfaceCard style={{ gap: 14 }}>
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
          {error && !feedback ? <FeedbackBanner type="error" title="Login failed" message={error} /> : null}
          <FormInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" placeholder={`${role}@kabisig.app`} />
          <FormInput label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your password" />
          <PrimaryButton label={loading ? "Signing in..." : "Sign in"} onPress={() => setTermsMode("login")} disabled={loading} />
          <GoogleButton onPress={() => setTermsMode("google")} />
          {googleBusy ? <FeedbackBanner type="info" title="Google sign-in in progress" message="Finishing your Google authentication session..." /> : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
              <Text style={{ color: "#0F6FDB", fontWeight: "800" }}>Forgot password?</Text>
            </Pressable>
            <Pressable onPress={() => router.push({ pathname: "/(auth)/register", params: { role } })}>
              <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>Create account</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => router.push("/(auth)/role-selection")}>
            <Text style={{ color: theme.colors.textMuted, textAlign: "center", fontWeight: "700" }}>Change role</Text>
          </Pressable>
        </SurfaceCard>
      </View>

      <FullScreenPopup
        visible={!!popupError}
        tone="error"
        icon="alert-circle"
        title="Sign-in error"
        message={popupError || ""}
        dismissLabel="Try again"
        onDismiss={() => {
          setPopupError(null);
          setTermsMode(null);
        }}
      />

      <TermsOverlay
        visible={termsMode !== null}
        mode={termsMode ?? "login"}
        onClose={() => setTermsMode(null)}
        onAgree={() => {
          if (termsMode === "google") {
            if (!googleReady) {
              setFeedback({ type: "info", title: "Preparing Google sign-in", message: "The Google auth request is still loading. Tap Continue with Google again in a moment." });
              setTermsMode(null);
              return;
            }
            void startGoogleSignIn();
          } else {
            void continueLogin();
          }
        }}
      />
    </Screen>
  );
}
