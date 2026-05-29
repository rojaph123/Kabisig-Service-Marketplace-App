import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { bookingService, formatBookingReference, reviewService, type Booking, type Review } from "@kabisig/shared";
import { AppHeader, BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, ImageUploadField, LoadingState, MultiMediaPickerField, PrimaryButton, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";

export default function BookingReviewScreen() {
  const params = useLocalSearchParams<{ bookingId?: string; source?: string }>();
  const { user } = useAuth();
  const hideBackHeader = params.source === "completion";
  const [booking, setBooking] = useState<Booking | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [beforePhoto, setBeforePhoto] = useState("");
  const [afterPhoto, setAfterPhoto] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  useEffect(() => {
    const bookingId = params.bookingId;
    if (!bookingId) return;
    void (async () => {
      const nextBooking = await bookingService.getBookingById(bookingId);
      setBooking(nextBooking);
      if (nextBooking && user?.id) {
        const nextReview = await reviewService.getReviewForBooking(nextBooking.bookingId, user.id);
        setExistingReview(nextReview);
      }
    })().catch((error) => {
      console.warn("Unable to load review details:", error);
    });
  }, [params.bookingId, user?.id]);

  async function handleSubmitReview() {
    if (!booking || !user) return;
    if (existingReview) {
      setFeedback({
        type: "success",
        title: "Feedback already submitted",
        message: "You have already reviewed this completed booking."
      });
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      await reviewService.createReview({
        bookingId: booking.bookingId,
        customerId: user.id,
        providerId: booking.providerId,
        rating,
        comment,
        mediaUrls: [beforePhoto, afterPhoto, ...mediaUrls].filter(Boolean),
        createdAt: new Date().toISOString()
      } as Omit<Review, "reviewId"> & { mediaUrls?: string[] });

      const savedReview = await reviewService.getReviewForBooking(booking.bookingId, user.id);
      setExistingReview(savedReview);

      setFeedback({
        type: "success",
        title: "Thank you for your feedback",
        message: "Your review has been saved successfully."
      });
      setShowSuccessOverlay(true);

      setTimeout(() => {
        setShowSuccessOverlay(false);
        router.replace({
          pathname: "/booking-detail",
          params: { bookingId: booking.bookingId, backTo: "/(tabs)/bookings" }
        });
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
      <FixedScreen header={hideBackHeader ? <AppHeader title="Leave Feedback" /> : <BackHeader title="Leave Feedback" onBack={() => router.back()} />}>
        <LoadingState label="Loading booking details..." />
      </FixedScreen>
    );
  }

  return (
    <FixedScreen
      header={hideBackHeader ? <AppHeader title="Leave Feedback" /> : <BackHeader title="Leave Feedback" onBack={() => router.back()} />}
      footer={
        existingReview ? (
          <PrimaryButton
            label={hideBackHeader ? "Open booking details" : "Back to bookings"}
            onPress={() =>
              hideBackHeader
                ? router.replace({
                    pathname: "/booking-detail",
                    params: { bookingId: booking.bookingId, backTo: "/(tabs)/bookings" }
                  })
                : router.replace("/(tabs)/bookings")
            }
          />
        ) : (
          <PrimaryButton label={loading ? "Submitting..." : "Submit feedback"} onPress={() => void handleSubmitReview()} disabled={loading} />
        )
      }
    >
      {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
      <FullScreenPopup
        visible={loading}
        tone="info"
        icon="hourglass-outline"
        title="Submitting review"
        message="Please wait while we save your rating and feedback."
      />
      <FullScreenPopup visible={showSuccessOverlay} title="Feedback saved" message="Thank you for sharing your experience with Kabisig." />

      {params.source === "completion" && !existingReview ? (
        <FeedbackBanner
          type="info"
          title="Job completed"
          message="Your worker marked the job complete. Please take a moment to rate the service."
        />
      ) : null}

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 16 }}>{booking.serviceName}</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>{formatBookingReference(booking)}</Text>
      </SurfaceCard>

      {existingReview ? (
        <SurfaceCard style={{ backgroundColor: theme.colors.successSoft, borderColor: theme.colors.success }}>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Feedback already submitted</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 6, lineHeight: 20 }}>
            Thank you. Your previous {existingReview.rating}/5 rating is already recorded for this booking.
          </Text>
        </SurfaceCard>
      ) : null}

      {!existingReview ? <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 16 }}>Rate this service</Text>
        <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-between" }}>
          {[1, 2, 3, 4, 5].map((star) => {
            const selected = rating >= star;
            return (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected ? (theme.dark ? theme.colors.warningSoft : "#FFF7D6") : theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: selected ? "#FACC15" : theme.colors.border
                }}
              >
                <Ionicons name={selected ? "star" : "star-outline"} size={24} color="#FACC15" />
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard> : null}

      {!existingReview ? (
        <>
          <FormInput
            label="Your feedback"
            value={comment}
            onChangeText={setComment}
            multiline
            style={{ minHeight: 110, textAlignVertical: "top" }}
            placeholder="Share what went well, what could improve, and anything future customers should know."
          />
          <SurfaceCard style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 16 }}>Before and after project/work</Text>
            <Text style={{ color: theme.colors.textMuted, lineHeight: 18, fontSize: 12 }}>
              Optional, but helpful for showing the actual result of the service.
            </Text>
            <View style={{ gap: 8 }}>
              <ImageUploadField label="Before photo" value={beforePhoto} onChange={setBeforePhoto} compact maxSizeMb={8} />
              <ImageUploadField label="After photo" value={afterPhoto} onChange={setAfterPhoto} compact maxSizeMb={8} />
            </View>
          </SurfaceCard>
          <MultiMediaPickerField
            label="Add more review photos"
            values={mediaUrls}
            onChange={setMediaUrls}
            helper="Attach work photos to help future customers see the provider's completed work."
            maxSizeMb={8}
          />
        </>
      ) : null}
    </FixedScreen>
  );
}
