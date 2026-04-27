import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { BrandBlock, FeedbackBanner, FormInput, PrimaryButton, Screen, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";
import { Ionicons } from "@expo/vector-icons";

export default function ForgotPasswordScreen() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  async function handleReset() {
    try {
      setLoading(true);
      await sendPasswordReset(email);
      setSent(true);
      setFeedback({
        type: "success",
        title: "Reset link prepared",
        message: "If this email exists, Firebase will send a password reset email."
      });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Reset request failed",
        message: error instanceof Error ? error.message : "We could not process that reset request."
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={{ backgroundColor: theme.colors.background }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: theme.colors.card,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: theme.colors.border
          }}
        >
          <Ionicons name="arrow-back-outline" size={20} color={theme.colors.text} />
        </Pressable>
        <BrandBlock compact />
      </View>

      <SurfaceCard style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ backgroundColor: theme.colors.primaryDark, padding: 24, gap: 10 }}>
          <Text style={{ color: "rgba(255,255,255,0.76)", fontWeight: "700", letterSpacing: 0.8 }}>ACCOUNT RECOVERY</Text>
          <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900" }}>
            Reset your password
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.84)", lineHeight: 21 }}>
            Enter your email address and we will prepare your reset flow through Firebase Authentication.
          </Text>
        </View>

        <View style={{ padding: 20, gap: 14 }}>
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
          <FormInput label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <PrimaryButton
            label={loading ? "Preparing..." : sent ? "Reset link prepared" : "Send reset link"}
            onPress={() => void handleReset()}
            disabled={loading}
          />
        </View>
      </SurfaceCard>
    </Screen>
  );
}
