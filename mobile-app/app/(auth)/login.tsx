import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, TextInput, type TextInputProps, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { KABISIG_TERMS_VERSION, userService, type User } from "@kabisig/shared";
import { BrandBlock, FeedbackBanner, FullScreenPopup, LaunchScreen, PrimaryButton, Screen, SurfaceCard } from "../../src/components";
import { TermsAgreementModal } from "../../src/components/TermsAgreement";
import { useAuth } from "../../src/hooks/AuthProvider";
import { useGoogleAuth } from "../../src/hooks/useGoogleAuth";
import { theme } from "../../src/theme";

type LoginUser = User & { onboardingCompleted?: boolean; approvalStatus?: string };

function GoogleButton({ disabled, onPress }: { disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        borderRadius: 20,
        paddingVertical: 15,
        paddingHorizontal: 18,
        backgroundColor: theme.dark ? theme.colors.surfaceAlt : "#FFFFFF",
        borderWidth: 1,
        borderColor: theme.dark ? theme.colors.border : "#DCE8F8",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        opacity: disabled ? 0.62 : 1
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: theme.dark ? theme.colors.card : "#F8FAFC",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: theme.dark ? theme.colors.border : "#E2E8F0"
        }}
      >
        <Text style={{ fontWeight: "900", color: "#DB4437", fontSize: 15 }}>G</Text>
      </View>
      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 15 }}>{disabled ? "Google sign-in..." : "Continue with Google"}</Text>
    </Pressable>
  );
}

function AuthField({
  label,
  error,
  style,
  autoCorrect,
  ...inputProps
}: TextInputProps & { label: string; error?: boolean }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: theme.colors.text, fontSize: 10, fontWeight: "900" }}>{label}</Text>
      <TextInput
        {...inputProps}
        autoCorrect={autoCorrect ?? false}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          {
            minHeight: 38,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.card,
            color: theme.colors.text,
            paddingHorizontal: 11,
            paddingVertical: 7,
            fontSize: 13
          },
          style
        ]}
      />
    </View>
  );
}

function blurActiveElementOnWeb() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const active = document.activeElement as HTMLElement | null;
  active?.blur?.();
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const { selectedRole, setSelectedRole, signIn, signOut, error, refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);
  const [popupError, setPopupError] = useState<string | null>(null);
  const [pendingTermsUser, setPendingTermsUser] = useState<LoginUser | null>(null);
  const [redirectToRegisterAfterPopup, setRedirectToRegisterAfterPopup] = useState(false);

  useEffect(() => {
    if (params.role === "provider" || params.role === "customer") {
      setSelectedRole(params.role);
    }
    setFeedback(null);
    setPopupError(null);
  }, [params.role, setSelectedRole]);

  useEffect(() => {
    if (error && loading) {
      setPopupError(error);
      setFeedback({ type: "error", title: "Login failed", message: error });
    }
  }, [error, loading]);

  const role = ((params.role === "provider" || selectedRole === "provider") ? "provider" : "customer") as "customer" | "provider";
  const roleCopy = useMemo(
    () =>
      role === "provider"
        ? { title: "Skilled Worker Access", subtitle: "Sign in to manage jobs, schedules, earnings, and approvals in one place." }
        : { title: "Customer sign in", subtitle: "Book trusted local help and keep your services organized." },
    [role]
  );

  const { startGoogleSignIn, cancelGoogleSignIn, googleReady, busy: googleBusy } = useGoogleAuth({
    role,
    intent: "login",
    onSuccess: (signedInUser) => {
      if (!signedInUser.termsAcceptedAt) {
        setPendingTermsUser(signedInUser);
        return;
      }
      routeAfterLogin(signedInUser);
    },
    onError: (message) => {
      const shouldRedirectToRegister = message.toLowerCase().includes("use create account first");
      setRedirectToRegisterAfterPopup(shouldRedirectToRegister);
      setFeedback({ type: "error", title: "Google sign-in failed", message });
      setPopupError(message);
    }
  });

  function routeAfterLogin(signedInUser: LoginUser) {
    const nextRoute =
      signedInUser.role === "provider"
        ? !signedInUser.onboardingCompleted
          ? "/provider/onboarding"
          : signedInUser.approvalStatus !== "Approved"
            ? "/provider/pending"
            : "/(tabs)/home"
        : "/(tabs)/home";
    blurActiveElementOnWeb();
    router.replace(nextRoute as never);
  }

  async function acceptLoginTerms() {
    if (!pendingTermsUser) return;
    await userService.updateUserDocument(pendingTermsUser.id, {
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: KABISIG_TERMS_VERSION
    });
    await refreshUser();
    const acceptedUser = {
      ...pendingTermsUser,
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: KABISIG_TERMS_VERSION
    };
    setPendingTermsUser(null);
    routeAfterLogin(acceptedUser);
  }

  async function continueLogin() {
    try {
      setLoading(true);
      setFeedback({ type: "info", title: "Signing you in", message: "Preparing your Kabisig workspace..." });
      const signedInUser = await signIn({ email, password, role });
      if (!signedInUser.termsAcceptedAt) {
        setPendingTermsUser(signedInUser);
        return;
      }
      routeAfterLogin(signedInUser);
    } catch (loginError) {
      const nextMessage = loginError instanceof Error ? loginError.message : "We could not sign you in right now.";
      setRedirectToRegisterAfterPopup(false);
      setFeedback({ type: "error", title: "Login failed", message: nextMessage });
      setPopupError(nextMessage);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LaunchScreen />;
  }

  return (
    <Screen style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 0, gap: 0, paddingBottom: 48 }}>
      <LinearGradient
        colors={["#071A34", "#0B2E5E", "#1287DB"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 22, paddingTop: 42, paddingBottom: 70, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}
      >
        <View style={{ gap: 10, alignItems: "center" }}>
          <BrandBlock compact size={96} />
          <View style={{ gap: 5, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center" }}>{roleCopy.title}</Text>
            <Text style={{ color: "rgba(255,255,255,0.86)", lineHeight: 18, fontSize: 12, textAlign: "center" }}>{roleCopy.subtitle}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, marginTop: -46, gap: 8 }}>
        <SurfaceCard style={{ gap: 7, padding: 11 }}>
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
          <AuthField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" placeholder={`${role}@kabisig.app`} />
          <AuthField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your password" />
          <PrimaryButton
            label={loading ? "Signing in..." : "Sign in"}
            onPress={() => {
              setPopupError(null);
              setFeedback(null);
              void continueLogin();
            }}
            disabled={loading}
          />
          {role === "customer" ? (
            <>
              <GoogleButton
                disabled={googleBusy}
                onPress={() => {
                  if (googleBusy) return;
                  if (!googleReady) {
                    setFeedback({ type: "info", title: "Preparing Google sign-in", message: "The Google auth request is still loading. Try again in a moment." });
                    return;
                  }
                  void startGoogleSignIn();
                }}
              />
              {googleBusy ? <FeedbackBanner type="info" title="Google sign-in in progress" message="Finishing your Google authentication session..." /> : null}
            </>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Pressable onPress={() => {
              blurActiveElementOnWeb();
              router.push("/(auth)/forgot-password");
            }}>
              <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>Forgot password?</Text>
            </Pressable>
            <Pressable onPress={() => {
              blurActiveElementOnWeb();
              router.push({ pathname: "/(auth)/register", params: { role } });
            }}>
              <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>{role === "provider" ? "Apply Now" : "Create account"}</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => {
            blurActiveElementOnWeb();
            router.push("/(auth)/role-selection");
          }}>
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
        dismissLabel={redirectToRegisterAfterPopup ? "Create account" : "Try again"}
        onDismiss={() => {
          cancelGoogleSignIn();
          setPopupError(null);
          setFeedback(null);
          if (redirectToRegisterAfterPopup) {
            setRedirectToRegisterAfterPopup(false);
            blurActiveElementOnWeb();
            router.replace({ pathname: "/(auth)/register", params: { role } });
          }
        }}
      />

      <TermsAgreementModal
        visible={!!pendingTermsUser}
        title="Terms required before continuing"
        subtitle="This account has not accepted the latest Kabisig Terms and Agreement yet. Read the full agreement and confirm to continue."
        agreeLabel="Accept and sign in"
        onClose={() => {
          setPendingTermsUser(null);
          void signOut();
        }}
        onAgree={() => void acceptLoginTerms()}
      />
    </Screen>
  );
}
