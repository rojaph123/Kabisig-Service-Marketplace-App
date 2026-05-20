import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { bookingService, complaintService, formatBookingReference, type Booking } from "@kabisig/shared";
import { BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, LoadingState, PrimaryButton, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";

const complaintTypes = [
  "Quality of work",
  "Provider did not show up",
  "Rude behavior",
  "Overcharging",
  "Incomplete service",
  "Safety concerns",
  "Other"
];

export default function BookingComplaintScreen() {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [complaintType, setComplaintType] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  useEffect(() => {
    if (!params.bookingId) return;
    void bookingService.getBookingById(params.bookingId).then(setBooking);
  }, [params.bookingId]);

  async function handleSubmitComplaint() {
    if (!booking || !user || !complaintType || !description.trim()) {
      setFeedback({
        type: "error",
        title: "Missing complaint details",
        message: "Please fill in all fields before submitting your complaint."
      });
      return;
    }

    setLoading(true);
    try {
      await complaintService.createComplaint({
        bookingId: booking.bookingId,
        submittedBy: user.id,
        targetUserId: booking.providerId,
        type: complaintType,
        description,
        status: "Open",
        createdAt: new Date().toISOString()
      });

      setFeedback({
        type: "success",
        title: "Complaint submitted",
        message: "Our admin team will review your complaint soon."
      });
      setShowSuccessOverlay(true);
      setTimeout(() => {
        setShowSuccessOverlay(false);
        router.push("/(tabs)/bookings");
      }, 900);
    } catch (error) {
      console.error("Complaint error:", error);
      setFeedback({
        type: "error",
        title: "Complaint not submitted",
        message: "We could not file your complaint right now."
      });
    } finally {
      setLoading(false);
    }
  }

  if (!booking) {
    return (
      <FixedScreen header={<BackHeader title="File a Complaint" onBack={() => router.back()} />}>
        <LoadingState label="Loading booking details..." />
      </FixedScreen>
    );
  }

  return (
    <FixedScreen header={<BackHeader title="File a Complaint" onBack={() => router.back()} />}>
      {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
      <FullScreenPopup visible={showSuccessOverlay} title="Complaint submitted" message="Your report has been sent to the Kabisig admin team." />

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 16 }}>{booking.serviceName}</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>{formatBookingReference(booking)}</Text>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 16 }}>Type of complaint</Text>
        <View style={{ marginTop: 12, gap: 10 }}>
          {complaintTypes.map((type) => {
            const selected = complaintType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setComplaintType(type)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: selected ? theme.colors.primarySoft : theme.colors.card,
                  borderWidth: 1,
                  borderColor: selected ? theme.colors.primary : theme.colors.border
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {selected ? <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: theme.colors.primary }} /> : null}
                </View>
                <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{type}</Text>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>

      <FormInput
        label="Describe the issue"
        value={description}
        onChangeText={setDescription}
        multiline
        style={{ minHeight: 120, textAlignVertical: "top" }}
        placeholder="Explain what happened, how it affected the service, and what the admin team should review."
      />

      <PrimaryButton label={loading ? "Submitting..." : "Submit complaint"} onPress={() => void handleSubmitComplaint()} disabled={loading} />
    </FixedScreen>
  );
}
