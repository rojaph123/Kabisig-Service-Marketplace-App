import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { bookingService, reviewService, userService, type Booking, type Review } from "@kabisig/shared";
import { BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, LoadingState, MultiMediaPickerField, PrimaryButton, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";

export default function BookingReviewScreen() {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  useEffect(() => {
    if (!params.bookingId) return;
    void bookingService.getBookingById(params.bookingId).then(setBooking);
  }, [params.bookingId]);

  async function handleSubmitReview() {
    if (!booking || !user) return;

    setLoading(true);
    setFeedback(null);
    try {
      await reviewService.createReview({
        bookingId: booking.bookingId,
        customerId: user.id,
        providerId: booking.providerId,
        rating,
        comment,
        mediaUrls,
        createdAt: new Date().toISOString()
      } as Omit<Review, "reviewId"> & { mediaUrls?: string[] });

      const avg = await reviewService.getProviderAverageRating(booking.providerId);
      await userService.updateProviderProfile(booking.providerId, { rating: avg });

      setFeedback({
        type: "success",
        title: "Thank you for your feedback",
        message: "Your review has been saved and the provider rating has been updated."
      });
      setShowSuccessOverlay(true);

      setTimeout(() => {
        setShowSuccessOverlay(false);
        router.push("/(tabs)/bookings");
      }, 900);
    } catch (error) {
      console.error("Review error:", error);
      setFeedback({
        type: "error",
        title: "Feedback not submitted",
        message: "We could not save your feedback right now. Please try again."
      });
    } finally {
      setLoading(false);
    }
  }

  if (!booking) {
    return (
      <FixedScreen header={<BackHeader title="Leave Feedback" onBack={() => router.back()} />}>
        <LoadingState label="Loading booking details..." />
      </FixedScreen>
    );
  }

  return (
    <FixedScreen
      header={<BackHeader title="Leave Feedback" onBack={() => router.back()} />}
      footer={<PrimaryButton label={loading ? "Submitting..." : "Submit feedback"} onPress={() => void handleSubmitReview()} disabled={loading} />}
    >
      {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
      <FullScreenPopup visible={showSuccessOverlay} title="Feedback saved" message="Thank you for sharing your experience with Kabisig." />

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 16 }}>{booking.serviceName}</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>#{booking.bookingId.replace(/^booking-/, "")}</Text>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 16 }}>Rate this service</Text>
        <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-between" }}>
          {[1, 2, 3, 4, 5].map((star) => {
            const selected = rating >= star;
            return (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: selected ? theme.colors.accent : theme.colors.border
                }}
              >
                <Text style={{ color: selected ? theme.colors.textOnAccent : theme.colors.text, fontWeight: "900", fontSize: 18 }}>
                  {star}★
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>

      <FormInput
        label="Your feedback"
        value={comment}
        onChangeText={setComment}
        multiline
        style={{ minHeight: 110, textAlignVertical: "top" }}
        placeholder="Share what went well, what could improve, and anything future customers should know."
      />
      <MultiMediaPickerField
        label="Add review photos"
        values={mediaUrls}
        onChange={setMediaUrls}
        helper="Attach work photos to help future customers see the provider's completed work."
        maxSizeMb={8}
      />
    </FixedScreen>
  );
}
