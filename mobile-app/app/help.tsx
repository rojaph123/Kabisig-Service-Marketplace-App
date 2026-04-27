import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { messagingService, notificationService } from "@kabisig/shared";
import { BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, PrimaryButton, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";

const faqs = [
  ["How do bookings work?", "Customers choose a service, preferred schedule, provider, and location. Providers then review availability and respond from their jobs dashboard."],
  ["How do I contact support?", "Use the support form below, start a support chat, or send an email. Important service issues can also be escalated through complaints or reports."],
  ["How do providers appear to customers?", "Approved providers only appear when their availability schedule is active. Ratings and profile details also become visible on the customer side."],
  ["How do complaints work?", "Complaints are connected to bookings so the admin team can review the booking history, the provider involved, and the issue details in context."]
];

export default function HelpScreen() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  async function sendSupportMessage() {
    if (!user || !subject.trim() || !message.trim()) {
      setFeedback({
        type: "error",
        title: "Missing support details",
        message: "Please add a subject and message first."
      });
      return;
    }

    setSending(true);
    try {
      const supportThreadId = await messagingService.getOrCreateThread(`support-${user.id}`, [user.id, "admin-support"]);
      await messagingService.sendMessage(supportThreadId, user.id, `[${subject.trim()}] ${message.trim()}`);
      await notificationService.createNotification({
        userId: user.id,
        type: "support_request_sent",
        title: "Support request sent",
        body: "Your support request has been sent to the Kabisig admin team.",
        isRead: false,
        createdAt: new Date().toISOString()
      });
      setSubject("");
      setMessage("");
      setFeedback({
        type: "success",
        title: "Support request sent",
        message: "Your message was sent to the support team. Opening the support thread now."
      });
      setShowSuccessOverlay(true);
      setTimeout(() => {
        setShowSuccessOverlay(false);
        router.push({ pathname: "/chat", params: { threadId: supportThreadId } });
      }, 700);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Support request failed",
        message: "We couldn't send your support request right now."
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <FixedScreen
      style={{ backgroundColor: theme.colors.background }}
      header={<BackHeader title="Help & Support" onBack={() => router.back()} />}
    >
      {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
      <FullScreenPopup visible={showSuccessOverlay} title="Support request sent" message="Your message was sent to the Kabisig support team." />

      <SurfaceCard style={{ backgroundColor: theme.colors.primarySoft }}>
        <Text style={{ color: theme.colors.primaryDark, fontSize: 18, fontWeight: "800" }}>Need help with a booking, provider, payment, or account?</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 21 }}>
          Kabisig support is designed to keep issues connected to the right booking and role, so customers, providers, and admins can resolve them faster.
        </Text>
      </SurfaceCard>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable
          onPress={() => void Linking.openURL("mailto:support@kabisig.app?subject=Kabisig%20Support")}
          style={{ flex: 1, borderRadius: 22, padding: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, gap: 8 }}
        >
          <Ionicons name="mail-outline" size={20} color={theme.colors.primaryDark} />
          <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Email support</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>support@kabisig.app</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/notifications")}
          style={{ flex: 1, borderRadius: 22, padding: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, gap: 8 }}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.colors.accent} />
          <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Start support chat</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Route your concern to admin</Text>
        </Pressable>
      </View>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "800" }}>Send a support request</Text>
        <View style={{ marginTop: 12, gap: 12 }}>
          <FormInput label="Subject" value={subject} onChangeText={setSubject} placeholder="Booking issue, schedule conflict, payment question..." />
          <FormInput
            label="Message"
            value={message}
            onChangeText={setMessage}
            multiline
            style={{ minHeight: 120, textAlignVertical: "top" }}
            placeholder="Tell us what happened and what help you need."
          />
          <PrimaryButton label={sending ? "Sending..." : "Send to support"} onPress={() => void sendSupportMessage()} disabled={sending} />
        </View>
      </SurfaceCard>

      <View style={{ gap: 12 }}>
        <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "800" }}>Frequently asked questions</Text>
        {faqs.map(([question, answer]) => (
          <SurfaceCard key={question}>
            <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{question}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 8, lineHeight: 20 }}>{answer}</Text>
          </SurfaceCard>
        ))}
      </View>
    </FixedScreen>
  );
}
