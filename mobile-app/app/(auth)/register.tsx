import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { KABISIG_TERMS_VERSION, userService } from "@kabisig/shared";
import { BrandBlock, FeedbackBanner, FormInput, FullScreenPopup, PrimaryButton, Screen, SurfaceCard } from "../../src/components";
import { TermsAgreementModal } from "../../src/components/TermsAgreement";
import { useAuth } from "../../src/hooks/AuthProvider";
import { useGoogleAuth } from "../../src/hooks/useGoogleAuth";
import { theme } from "../../src/theme";

const scheduleDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const scheduleTimes = ["6:00 AM", "8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM", "6:00 PM", "8:00 PM"];

function to24Hour(label: string) {
  const [time, suffix] = label.split(" ");
  const [hourText, minuteText] = time.split(":");
  let hour = Number(hourText);
  if (suffix === "PM" && hour < 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, "0")}:${(minuteText || "00").padStart(2, "0")}`;
}

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
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.dark ? theme.colors.card : "#F8FAFC", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.dark ? theme.colors.border : "#E2E8F0" }}>
        <Text style={{ fontWeight: "900", color: "#DB4437", fontSize: 15 }}>G</Text>
      </View>
      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 15 }}>{disabled ? "Google sign-in..." : "Continue with Google"}</Text>
    </Pressable>
  );
}

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const { selectedRole, setSelectedRole, register } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [workingDays, setWorkingDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [startTime, setStartTime] = useState("8:00 AM");
  const [endTime, setEndTime] = useState("5:00 PM");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);
  const [termsMode, setTermsMode] = useState<"email" | "google" | null>(null);
  const [popupError, setPopupError] = useState<string | null>(null);
  const [redirectToLoginAfterPopup, setRedirectToLoginAfterPopup] = useState(false);

  useEffect(() => {
    if (params.role === "provider" || params.role === "customer") {
      setSelectedRole(params.role);
    }
  }, [params.role, setSelectedRole]);

  const role = ((params.role === "provider" || selectedRole === "provider") ? "provider" : "customer") as "customer" | "provider";
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const { startGoogleSignIn, googleReady, busy: googleBusy } = useGoogleAuth({
    role,
    intent: "register",
    onSuccess: () => {
      setTermsMode(null);
      router.replace("/(tabs)/home");
    },
    onError: (message) => {
      setTermsMode(null);
      setFeedback({ type: "error", title: "Google registration failed", message });
      setPopupError(message);
    }
  });

  function validateAccountDetails() {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      return "Please fill in all required registration fields before continuing.";
    }
    if (password !== confirmPassword) {
      return "Password and confirmation password do not match.";
    }
    if (password.length < 6) {
      return "Use at least 6 characters so Firebase can create the account.";
    }
    return null;
  }

  function showValidationError(title: string, message: string) {
    setFeedback({ type: "error", title, message });
    setPopupError(message);
  }

  async function handleRegister() {
    try {
      const accountError = validateAccountDetails();
      if (accountError) {
        showValidationError("Missing registration details", accountError);
        return;
      }
      setLoading(true);
      setFeedback({ type: "info", title: role === "provider" ? "Preparing application" : "Creating account", message: "Setting up your Kabisig profile..." });
      const createdUser = await register({ fullName, email, password, role });
      if (createdUser) {
        await userService.updateUserDocument(createdUser.id, {
          termsAcceptedAt: new Date().toISOString(),
          termsVersion: KABISIG_TERMS_VERSION
        });
      }
      if (createdUser?.role === "provider") {
        await userService.updateProviderProfile(createdUser.id, {
          availability: workingDays.map((day) => ({
            day,
            start: to24Hour(startTime),
            end: to24Hour(endTime),
            available: true
          }))
        });
      }
      const nextRoute = createdUser?.role === "provider" ? "/provider/onboarding" : "/(tabs)/home";
      router.replace(nextRoute as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      setFeedback({ type: "error", title: "Registration failed", message });
      setPopupError(message);
      setRedirectToLoginAfterPopup(message.toLowerCase().includes("already registered"));
    } finally {
      setLoading(false);
      setTermsMode(null);
    }
  }

  return (
    <Screen style={{ backgroundColor: theme.colors.background, paddingHorizontal: 0, paddingTop: 0 }}>
      <LinearGradient colors={["#071A34", "#0B2E5E", "#1287DB"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ marginHorizontal: -20, marginTop: -20, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 120, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }}>
        <View style={{ gap: 18, alignItems: "center" }}>
          <BrandBlock compact size={118} />
          <View style={{ gap: 8, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 32, fontWeight: "900", textAlign: "center" }}>
              {role === "provider" ? "Apply as a skilled worker" : "Create customer account"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.86)", lineHeight: 22, textAlign: "center" }}>
              {role === "provider"
                ? "Create your account first, then continue directly to skilled worker onboarding."
                : "Create your customer account and start booking trusted local services."}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 20, marginTop: -84, gap: 14 }}>
        <SurfaceCard style={{ gap: 14 }}>
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FormInput label="First name" value={firstName} onChangeText={setFirstName} required />
            </View>
            <View style={{ flex: 1 }}>
              <FormInput label="Last name" value={lastName} onChangeText={setLastName} required />
            </View>
          </View>
          <FormInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" required />
          <FormInput label="Password" value={password} onChangeText={setPassword} secureTextEntry required />
          <FormInput label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry required />
          {role === "customer" ? (
            <View style={{ borderRadius: 18, padding: 14, backgroundColor: theme.colors.surfaceAlt, flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
                  Mobile number is optional and can be added later from Profile.
                </Text>
              </View>
            </View>
          ) : null}
          {role === "provider" ? (
            <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt }}>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Initial working schedule</Text>
              <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
                Choose your usual workdays and time window. You can adjust this later in your worker profile.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {scheduleDays.map((day) => {
                  const active = workingDays.includes(day);
                  return (
                    <Pressable
                      key={day}
                      onPress={() =>
                        setWorkingDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]))
                      }
                      style={{
                        borderRadius: 16,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: active ? theme.colors.primary : theme.colors.card,
                        borderWidth: 1,
                        borderColor: active ? theme.colors.primary : theme.colors.border
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800" }}>{day}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.textLight, fontWeight: "700", marginBottom: 8 }}>Start time</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {scheduleTimes.slice(0, 5).map((time) => {
                      const active = startTime === time;
                      return (
                        <Pressable
                          key={`start-${time}`}
                          onPress={() => setStartTime(time)}
                          style={{
                            borderRadius: 14,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            backgroundColor: active ? theme.colors.primary : theme.colors.card,
                            borderWidth: 1,
                            borderColor: active ? theme.colors.primary : theme.colors.border
                          }}
                        >
                          <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "700", fontSize: 12 }}>{time}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.textLight, fontWeight: "700", marginBottom: 8 }}>End time</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {scheduleTimes.slice(3).map((time) => {
                      const active = endTime === time;
                      return (
                        <Pressable
                          key={`end-${time}`}
                          onPress={() => setEndTime(time)}
                          style={{
                            borderRadius: 14,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            backgroundColor: active ? theme.colors.accent : theme.colors.card,
                            borderWidth: 1,
                            borderColor: active ? theme.colors.accent : theme.colors.border
                          }}
                        >
                          <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "700", fontSize: 12 }}>{time}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            </SurfaceCard>
          ) : null}
          <PrimaryButton
            label={loading ? "Creating..." : role === "provider" ? "Apply Now" : "Create account"}
            onPress={() => setTermsMode("email")}
            disabled={loading}
          />
          {role === "customer" ? (
            <>
              <GoogleButton disabled={googleBusy} onPress={() => {
                if (googleBusy) return;
                setTermsMode("google");
              }} />
              {googleBusy ? <FeedbackBanner type="info" title="Google registration in progress" message="Finishing your Google account setup..." /> : null}
            </>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Pressable onPress={() => router.push({ pathname: "/(auth)/login", params: { role } })}>
              <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>Already have an account?</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(auth)/role-selection")}>
              <Text style={{ color: theme.colors.textMuted, fontWeight: "800" }}>Change role</Text>
            </Pressable>
          </View>
        </SurfaceCard>
      </View>

      <FullScreenPopup
        visible={!!popupError}
        tone="error"
        icon="alert-circle"
        title="Registration error"
        message={popupError || ""}
        dismissLabel={redirectToLoginAfterPopup ? "Go to sign in" : "Fix details"}
        onDismiss={() => {
          setPopupError(null);
          if (redirectToLoginAfterPopup) {
            setRedirectToLoginAfterPopup(false);
            router.replace({ pathname: "/(auth)/login", params: { role } });
          }
        }}
      />

      <TermsAgreementModal
        visible={termsMode !== null}
        onClose={() => setTermsMode(null)}
        title="Agree before creating your account"
        subtitle="Read the full Kabisig Terms and Agreement, scroll to the bottom, and check the box before registration continues."
        agreeLabel={role === "provider" ? "Accept and apply" : "Accept and create account"}
        onAgree={() => {
          if (termsMode === "email") {
            void handleRegister();
            return;
          }

          if (role !== "customer") {
            const message = "Skilled worker accounts must use email and password, then complete onboarding and admin verification.";
            setFeedback({ type: "error", title: "Google registration unavailable", message });
            setPopupError(message);
            setTermsMode(null);
            return;
          }

          if (!googleReady) {
            const message = "The Google auth request is still preparing. Tap Continue with Google again in a moment.";
            setFeedback({ type: "info", title: "Preparing Google sign-up", message });
            setPopupError(message);
            setTermsMode(null);
            return;
          }

          void startGoogleSignIn();
        }}
      />
    </Screen>
  );
}
