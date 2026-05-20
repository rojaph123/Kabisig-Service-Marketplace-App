import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import {
  bookingService,
  bookingChangeRequestService,
  communityPostService,
  formatBookingReference,
  formatReadableDateTime,
  notificationService,
  paymentService,
  providerPortfolioService,
  reviewService,
  userService,
  type Booking,
  type BookingChangeRequest,
  type MediaAttachment,
  type Review,
  type User
} from "@kabisig/shared";
import { Avatar, BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, ImageUploadField, LoadingState, MapPreviewModal, MediaPreviewModal, MultiMediaPickerField, PrimaryButton, StatusBadge, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";
import { readableAppError } from "../src/utils/errors";
import { googleMapsEmbedUrl, googleMapsExternalUrl } from "../src/utils/maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const providerActions: Record<string, string | null> = {
  Pending: "Accepted",
  Accepted: "On the Way",
  "On the Way": "In Progress",
  "In Progress": null,
  Completed: null,
  Cancelled: null
};

async function createNotificationQuietly(data: Parameters<typeof notificationService.createNotification>[0]) {
  try {
    await notificationService.createNotification(data);
  } catch (error) {
    console.warn("Notification write skipped:", error);
  }
}

function reviewRoute(bookingId: string) {
  return `/booking-review?bookingId=${encodeURIComponent(bookingId)}&source=completion`;
}

const bookingStatusSteps = ["Pending", "Accepted", "On the Way", "In Progress", "Completed", "Reviewed"] as const;

function bookingStepState(status: Booking["status"], reviewed: boolean, step: (typeof bookingStatusSteps)[number]) {
  if (status === "Cancelled") return step === "Pending" ? "done" : "waiting";
  if (step === "Reviewed") return reviewed ? "done" : status === "Completed" ? "current" : "waiting";

  const currentIndex = bookingStatusSteps.indexOf(status as (typeof bookingStatusSteps)[number]);
  const stepIndex = bookingStatusSteps.indexOf(step);
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "waiting";
}

export default function BookingDetailScreen() {
  const params = useLocalSearchParams<{ bookingId?: string; backTo?: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const keyboardOffset = Platform.OS === "ios" ? Math.max(insets.top, 12) : 0;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [providerUser, setProviderUser] = useState<User | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [changeRequests, setChangeRequests] = useState<BookingChangeRequest[]>([]);
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);
  const [showActionOverlay, setShowActionOverlay] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [showEditBookingForm, setShowEditBookingForm] = useState(false);
  const [beforeProof, setBeforeProof] = useState("");
  const [afterProof, setAfterProof] = useState("");
  const [proofNotes, setProofNotes] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash on Service");
  const [completionProgress, setCompletionProgress] = useState<{ title: string; message: string } | null>(null);
  const [statusProgress, setStatusProgress] = useState<{ title: string; message: string } | null>(null);
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAttachments, setEditAttachments] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      if (!params.bookingId) return;
      const next = await bookingService.getBookingById(params.bookingId);
      setBooking(next);
      if (next) {
        const [customerDoc, providerDoc, requests, reviewDoc] = await Promise.all([
          userService.getUserDocument(next.customerId),
          userService.getUserDocument(next.providerId),
          bookingChangeRequestService.getRequestsByBooking(next.bookingId),
          reviewService.getReviewForBooking(next.bookingId, next.customerId)
        ]);
        setCustomer(customerDoc);
        setProviderUser(providerDoc);
        setChangeRequests(requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setExistingReview(reviewDoc);
      }
    }

    void load();
  }, [params.bookingId]);

  const timeline = useMemo(() => {
    if (!booking) return [];

    return [
      { label: "Created", value: formatReadableDateTime(booking.createdAt) },
      { label: "Scheduled", value: booking.scheduledAt },
      { label: "Last Updated", value: formatReadableDateTime(booking.updatedAt) }
    ];
  }, [booking]);

  const nextProviderStatus = booking ? providerActions[booking.status] : null;
  const isProvider = user?.role === "provider";
  const isCustomer = user?.role === "customer";
  const canViewProviderPhone = isCustomer && ["Accepted", "On the Way", "In Progress", "Completed"].includes(booking?.status || "");
  const canViewCustomerContact = isProvider && ["Accepted", "On the Way", "In Progress", "Completed"].includes(booking?.status || "");
  const waitingForCustomerAcceptanceConfirmation = isProvider && booking?.status === "Accepted" && !booking?.customerAcceptanceConfirmedAt;
  const canEditBookingDetails = isCustomer && booking?.status === "Pending";
  const counterpartName = isProvider ? customer?.fullName || "Customer" : providerUser?.fullName || "Provider";
  const hasPendingChangeRequest = changeRequests.some((request) => request.status === "Pending" && request.type === "reschedule");
  const minimumBookingAmount = booking?.amount || 0;
  const finalAmountValue = Number(paymentAmount.replace(/[^\d.]/g, ""));
  const proofChecklist = [
    { label: "Before photo", done: Boolean(beforeProof) },
    { label: "After photo", done: Boolean(afterProof) },
    { label: "Final amount", done: Boolean(paymentAmount.trim()) && Number.isFinite(finalAmountValue) && finalAmountValue >= minimumBookingAmount },
    { label: "Completion notes", done: Boolean(proofNotes.trim()) }
  ];
  const proofChecklistComplete = proofChecklist.every((item) => item.done);

  async function refreshBooking() {
    if (!params.bookingId) return;
    const next = await bookingService.getBookingById(params.bookingId);
    setBooking(next);
    if (next) {
      const [requests, reviewDoc] = await Promise.all([
        bookingChangeRequestService.getRequestsByBooking(next.bookingId),
        reviewService.getReviewForBooking(next.bookingId, next.customerId)
      ]);
      setChangeRequests(requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setExistingReview(reviewDoc);
    }
  }

  async function ensurePaymentForCompletedBooking(activeBooking: Booking, options?: { amount?: number; method?: string }) {
    const existingPayment = await paymentService.getPaymentByBookingId(activeBooking.bookingId);
    if (existingPayment) {
      const nextAmount = options?.amount || activeBooking.amount;
      const nextMethod = options?.method?.trim() || existingPayment.method || "Cash on Service";
      if (existingPayment.amount !== nextAmount || existingPayment.method !== nextMethod) {
        await paymentService.updatePayment(existingPayment.paymentId, {
          amount: nextAmount,
          method: nextMethod
        });
      }
      if (existingPayment.status !== "Paid") {
        await paymentService.updatePaymentStatus(existingPayment.paymentId, "Paid");
      }
      return existingPayment.paymentId;
    }

    return paymentService.createPayment({
      bookingId: activeBooking.bookingId,
      customerId: activeBooking.customerId,
      providerId: activeBooking.providerId,
      amount: options?.amount || activeBooking.amount,
      method: options?.method?.trim() || "Cash on Service",
      status: "Paid",
      createdAt: new Date().toISOString()
    });
  }

  function openEditBookingForm() {
    if (!booking) return;
    setEditAddress(booking.address || "");
    setEditNotes(booking.notes || "");
    setEditAttachments(
      ((booking.attachmentItems?.length ? booking.attachmentItems.map((item) => item.url) : booking.attachments) || []).filter(Boolean)
    );
    setShowEditBookingForm(true);
  }

  async function handleEditBookingDetails() {
    if (!booking || !user) return;
    if (!editAddress.trim()) {
      setFeedback({
        type: "error",
        title: "Complete address needed",
        message: "Please enter the complete service address before saving changes."
      });
      return;
    }

    setUpdating(true);
    setFeedback({ type: "info", title: "Saving changes", message: "Updating your submitted booking details." });
    try {
      await bookingService.updateBooking(booking.bookingId, {
        address: editAddress.trim(),
        notes: editNotes.trim(),
        attachments: editAttachments
      });
      if (booking.providerId) {
        await createNotificationQuietly({
          userId: booking.providerId,
          type: "booking_updated",
          title: "Booking details updated",
          body: `${user.fullName} updated the address, notes, or attachments for ${booking.serviceName}.`,
          isRead: false,
          route: `/booking-detail?bookingId=${booking.bookingId}`,
          createdAt: new Date().toISOString()
        });
      }
      setShowEditBookingForm(false);
      setFeedback({
        type: "success",
        title: "Booking updated",
        message: "Your submitted booking details were updated successfully."
      });
      await refreshBooking();
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Update failed",
        message: readableAppError(error, "We could not update this booking right now.")
      });
    } finally {
      setUpdating(false);
    }
  }

  async function handleCompleteWithProof() {
    if (!booking || !user) return;
    if (!beforeProof || !afterProof) {
      setFeedback({
        type: "error",
        title: "Proof of work needed",
        message: "Please add one before photo and one after photo before marking this job completed."
      });
      return;
    }

    const parsedAmount = Number(paymentAmount.replace(/[^\d.]/g, ""));
    if (!proofNotes.trim()) {
      setFeedback({
        type: "error",
        title: "Completion notes needed",
        message: "Please add a short summary of the work completed before closing this job."
      });
      return;
    }
    if (!paymentAmount.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFeedback({
        type: "error",
        title: "Payment amount needed",
        message: "Please enter the final payment amount before completing this job."
      });
      return;
    }
    if (parsedAmount < booking.amount) {
      setFeedback({
        type: "error",
        title: "Amount is too low",
        message: `The final payment cannot be below the agreed price of ₱${booking.amount.toLocaleString()}.`
      });
      return;
    }

    const finalAmount = parsedAmount;

    setUpdating(true);
    setCompletionProgress({
      title: "Preparing completion",
      message: "Checking proof photos and payment details."
    });
    setFeedback({ type: "info", title: "Completing job", message: "Saving proof of work and payment details." });
    try {
      let proofSaved = false;
      setCompletionProgress({
        title: "Uploading proof",
        message: "Saving before and after photos to the provider portfolio."
      });
      try {
        await providerPortfolioService.addPortfolioItem(user.id, {
          title: `${booking.serviceName} proof of work`,
          description: [formatBookingReference(booking), proofNotes.trim()].filter(Boolean).join(" - "),
          beforePhoto: beforeProof,
          afterPhoto: afterProof
        });
        proofSaved = true;
      } catch (error) {
        console.warn("Portfolio proof sync skipped during completion:", error);
      }

      setCompletionProgress({
        title: "Updating booking",
        message: "Marking the job as complete for the customer."
      });
      await bookingService.updateBooking(booking.bookingId, { status: "Completed" });

      setCompletionProgress({
        title: "Syncing payment",
        message: "Reflecting payment details in the customer account."
      });
      try {
        await communityPostService.deletePostsForCompletedBooking(booking.bookingId);
      } catch (error) {
        console.warn("Community post cleanup skipped after completion:", error);
      }
      await ensurePaymentForCompletedBooking(booking, { amount: finalAmount, method: paymentMethod });

      setCompletionProgress({
        title: "Notifying customer",
        message: "Preparing the smooth handoff to the review page."
      });
      await createNotificationQuietly({
        userId: booking.customerId,
        type: "payment_paid",
        title: "Payment updated",
        body: `${booking.serviceName} is complete. Payment of ₱${finalAmount.toLocaleString()} is now reflected in your account.`,
        isRead: false,
        route: "/(tabs)/payments",
        createdAt: new Date().toISOString()
      });
      await createNotificationQuietly({
        userId: booking.customerId,
        type: "booking_status_update",
        title: "Job completed",
        body: `${booking.serviceName} was marked complete with proof of work. Please share your service feedback.`,
        isRead: false,
        route: reviewRoute(booking.bookingId),
        createdAt: new Date().toISOString()
      });

      setCompletionProgress({
        title: "Job completed",
        message: "The customer will be guided to leave service feedback."
      });
      setShowCompletionForm(false);
      setBeforeProof("");
      setAfterProof("");
      setProofNotes("");
      setPaymentAmount("");
      setPaymentMethod("Cash on Service");
      setFeedback({
        type: "success",
        title: "Job completed",
        message: proofSaved
          ? "Proof of work was added to your portfolio and payment details were reflected to the customer."
          : "The job and payment were completed. Portfolio proof could not be saved right now, so you can add it again later from your portfolio."
      });
      setShowActionOverlay(true);
      setTimeout(() => setShowActionOverlay(false), 1200);
      await refreshBooking();
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Completion failed",
        message: readableAppError(error, "We could not complete this job right now.")
      });
    } finally {
      setUpdating(false);
      setCompletionProgress(null);
    }
  }

  async function handleProviderStatusUpdate(nextStatus: string) {
    if (!booking || !user) return;
    setUpdating(true);
    setStatusProgress({
      title: `Marking as ${nextStatus}`,
      message: "Please wait while we update the booking and notify the customer."
    });
    setFeedback({ type: "info", title: "Updating booking", message: "Please wait while we update the booking status." });
    try {
      setStatusProgress({
        title: `Marking as ${nextStatus}`,
        message: "Saving the new booking status."
      });
      await bookingService.updateBooking(booking.bookingId, {
        status: nextStatus as Booking["status"],
        ...(nextStatus === "Accepted"
          ? {
              workerAcceptedAt: new Date().toISOString(),
            }
          : {})
      });

      if (nextStatus === "Completed") {
        try {
          await communityPostService.deletePostsForCompletedBooking(booking.bookingId);
        } catch (error) {
          console.warn("Community post cleanup skipped after completion:", error);
        }
        setStatusProgress({
          title: "Syncing payment",
          message: "Updating the customer payment record."
        });
        try {
          await ensurePaymentForCompletedBooking(booking);
          await createNotificationQuietly({
            userId: booking.customerId,
            type: "payment_paid",
            title: "Payment updated",
            body: `${booking.serviceName} is marked complete and your payment record is now paid.`,
            isRead: false,
            route: "/(tabs)/payments",
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          console.warn("Payment sync skipped after status update:", error);
        }
        setFeedback({
          type: "success",
          title: "Job completed",
          message: "The booking was completed and the payment record has been reflected in earnings and payments."
        });
      } else {
        setFeedback({
          type: "success",
          title: "Booking updated",
          message: `${booking.serviceName} is now marked as ${nextStatus}.`
        });
      }

      setStatusProgress({
        title: "Notifying customer",
        message: "Sending the latest job progress notification."
      });
      await createNotificationQuietly({
        userId: booking.customerId,
        type: "booking_status_update",
        title: nextStatus === "Completed" ? "Job completed" : nextStatus === "Accepted" ? "Worker accepted your booking" : "Booking updated",
        body: nextStatus === "Completed"
          ? `${booking.serviceName} is complete. Please share your service feedback.`
          : nextStatus === "Accepted"
            ? `${booking.serviceName} was accepted by the worker. Please confirm this booking on your side.`
            : `${booking.serviceName} is now marked as ${nextStatus}.`,
        isRead: false,
        route: nextStatus === "Completed" ? reviewRoute(booking.bookingId) : undefined,
        createdAt: new Date().toISOString()
      });
      setShowActionOverlay(true);
      setTimeout(() => setShowActionOverlay(false), 1200);
      await refreshBooking();
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Status update failed",
        message: readableAppError(error, "We could not update this booking right now.")
      });
    } finally {
      setUpdating(false);
      setStatusProgress(null);
    }
  }

  if (!booking) {
    return (
      <FixedScreen header={<BackHeader title="Booking Details" onBack={() => router.back()} />}>
        <LoadingState label="Loading booking details..." />
      </FixedScreen>
    );
  }

  const bookingMedia = ((booking.attachmentItems?.length ? booking.attachmentItems : booking.attachments || []) as (MediaAttachment | string)[]);

  return (
    <FixedScreen
      header={
        <>
          <BackHeader title="Booking Details" onBack={() => (params.backTo ? router.replace(params.backTo as never) : router.back())} />
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
          <MapPreviewModal
            visible={showMapPreview}
            title="Pinned booking location"
            subtitle={booking.address || booking.location}
            mapUrl={googleMapsEmbedUrl(booking.location || booking.address)}
            onClose={() => setShowMapPreview(false)}
            onOpenExternal={() => void Linking.openURL(googleMapsExternalUrl(booking.location || booking.address))}
          />
          <MediaPreviewModal visible={!!previewUri} uri={previewUri} title="Booking Attachment" onClose={() => setPreviewUri(null)} />
          <Modal visible={showEditBookingForm} transparent animationType="fade" onRequestClose={() => setShowEditBookingForm(false)}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={keyboardOffset}
            >
              <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.66)", justifyContent: "flex-end", paddingHorizontal: 18, paddingTop: 18, paddingBottom: Math.max(insets.bottom, 18) }}>
                <SurfaceCard style={{ maxHeight: "88%", gap: 14 }}>
                <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>Edit booking details</Text>
                <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
                  You can edit the customer-provided details while the booking is still pending. Worker, service, schedule, time, and GPS pin stay locked.
                </Text>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
                  <View style={{ borderRadius: 18, padding: 14, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, gap: 8 }}>
                    <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Locked booking information</Text>
                    <Text style={{ color: theme.colors.textMuted }}>Worker: {providerUser?.fullName || "Not assigned yet"}</Text>
                    <Text style={{ color: theme.colors.textMuted }}>Service: {booking.serviceName}</Text>
                    <Text style={{ color: theme.colors.textMuted }}>Schedule: {booking.scheduledAt}</Text>
                  </View>
                  <FormInput
                    label="Complete service address"
                    value={editAddress}
                    onChangeText={setEditAddress}
                    placeholder="House/Unit, Street, Barangay, City, Province"
                    multiline
                    style={{ minHeight: 82, textAlignVertical: "top" }}
                  />
                  <FormInput
                    label="Work details or notes"
                    value={editNotes}
                    onChangeText={setEditNotes}
                    placeholder="Describe the issue, scope, access notes, or instructions."
                    multiline
                    style={{ minHeight: 104, textAlignVertical: "top" }}
                  />
                  <MultiMediaPickerField
                    label="Attached photos or videos"
                    values={editAttachments}
                    onChange={setEditAttachments}
                    helper="Update photos or videos that help the worker understand the job."
                    maxSizeMb={8}
                    onError={(message) =>
                      setFeedback({
                        type: "error",
                        title: "Attachment issue",
                        message
                      })
                    }
                  />
                </ScrollView>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => setShowEditBookingForm(false)}
                    disabled={updating}
                    style={{ flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleEditBookingDetails()}
                    disabled={updating || !editAddress.trim()}
                    style={{ flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: "center", backgroundColor: theme.colors.primary, opacity: updating || !editAddress.trim() ? 0.55 : 1 }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900" }}>{updating ? "Saving..." : "Save changes"}</Text>
                  </Pressable>
                </View>
                </SurfaceCard>
              </View>
            </KeyboardAvoidingView>
          </Modal>
          <Modal visible={showCompletionForm} transparent animationType="fade" onRequestClose={() => setShowCompletionForm(false)}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={keyboardOffset}
            >
              <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.66)", justifyContent: "flex-end", paddingHorizontal: 18, paddingTop: 18, paddingBottom: Math.max(insets.bottom, 18) }}>
                <SurfaceCard style={{ maxHeight: "88%", gap: 14 }}>
                <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>Complete job</Text>
                <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
                  Add proof of work before completion. These before and after photos will also be added to your portfolio.
                </Text>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
                  <View style={{ borderRadius: 18, padding: 14, backgroundColor: theme.colors.surfaceAlt, gap: 10 }}>
                    <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Proof checklist</Text>
                    <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
                      Complete each item below before the final completion step to keep records clear for the customer and admin.
                    </Text>
                    <View style={{ gap: 8 }}>
                      {proofChecklist.map((item) => (
                        <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Ionicons
                            name={item.done ? "checkmark-circle" : "ellipse-outline"}
                            size={18}
                            color={item.done ? theme.colors.success : theme.colors.textMuted}
                          />
                          <Text style={{ color: item.done ? theme.colors.text : theme.colors.textMuted, fontWeight: item.done ? "800" : "700" }}>
                            {item.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <ImageUploadField label="Before photo" value={beforeProof} onChange={setBeforeProof} required compact />
                  <ImageUploadField label="After photo" value={afterProof} onChange={setAfterProof} required compact />
                  <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
                    Why we need this: proof photos protect both customer and worker by showing the work condition before and after completion.
                  </Text>
                  <FormInput
                    label="Proof notes"
                    value={proofNotes}
                    onChangeText={setProofNotes}
                    multiline
                    placeholder="Describe what was completed."
                    style={{ minHeight: 82, textAlignVertical: "top" }}
                    helper="Add a short summary of the completed work for the customer and admin records."
                  />
                  <FormInput
                    label="Final payment amount"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    keyboardType="numeric"
                    placeholder={`Minimum ₱${booking.amount.toLocaleString()}`}
                  />
                  <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
                    Enter the actual agreed amount. It cannot be lower than the booking starting price and will appear in both customer and provider payment details.
                  </Text>
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: "800" }}>Payment method</Text>
                    <View
                      style={{
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.surfaceAlt,
                        paddingVertical: 14,
                        paddingHorizontal: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10
                      }}
                    >
                      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Cash on Service</Text>
                      <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
                    </View>
                  </View>
                </ScrollView>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => setShowCompletionForm(false)}
                    disabled={updating}
                    style={{ flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleCompleteWithProof()}
                    disabled={updating || !proofChecklistComplete}
                    style={{ flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: "center", backgroundColor: theme.colors.success, opacity: updating || !proofChecklistComplete ? 0.65 : 1 }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900" }}>{updating ? "Saving..." : "Complete"}</Text>
                  </Pressable>
                </View>
              </SurfaceCard>
              {updating && completionProgress ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    backgroundColor: "rgba(15,23,42,0.42)",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24
                  }}
                >
                  <SurfaceCard style={{ width: "100%", maxWidth: 340, alignItems: "center", paddingVertical: 28 }}>
                    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.infoSoft, alignItems: "center", justifyContent: "center" }}>
                      <ActivityIndicator size="large" color={theme.colors.info} />
                    </View>
                    <Text style={{ color: theme.colors.text, fontSize: 21, fontWeight: "900", marginTop: 14, textAlign: "center" }}>
                      {completionProgress.title}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, textAlign: "center" }}>{completionProgress.message}</Text>
                  </SurfaceCard>
                </View>
              ) : null}
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </>
      }
    >

      <SurfaceCard style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ backgroundColor: theme.dark ? theme.colors.primaryLight : theme.colors.primaryDark, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: "#fff" }}>{booking.serviceName}</Text>
              <Text style={{ color: "rgba(255,255,255,0.76)" }}>{formatBookingReference(booking)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 12 }}>
                Last updated {formatReadableDateTime(booking.updatedAt)}
              </Text>
            </View>
            <StatusBadge status={booking.status} />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { label: "Amount", value: `₱${booking.amount.toLocaleString()}` },
              { label: "Schedule", value: booking.scheduledAt },
              { label: "Category", value: booking.serviceCategoryId }
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  borderRadius: 18,
                  padding: 12,
                  backgroundColor: "rgba(255,255,255,0.12)"
                }}
              >
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700" }}>{item.label}</Text>
                <Text style={{ color: "#fff", fontWeight: "800", marginTop: 6 }} numberOfLines={2}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ padding: 18, gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Pressable
              disabled={!((isProvider ? customer?.profilePhoto : providerUser?.profilePhoto) || "")}
              onPress={() => setPreviewUri((isProvider ? customer?.profilePhoto : providerUser?.profilePhoto) || null)}
            >
              <Avatar image={(isProvider ? customer?.profilePhoto : providerUser?.profilePhoto) || ""} size={48} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textLight, fontSize: 12, fontWeight: "700" }}>
                {isProvider ? "Customer" : "Provider"}
              </Text>
              <Text style={{ color: theme.colors.text, fontWeight: "800", marginTop: 4 }}>{counterpartName}</Text>
            </View>
          </View>

          {!isProvider ? (
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: theme.colors.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name="call-outline" size={18} color={theme.colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textLight, fontSize: 12, fontWeight: "700" }}>Worker contact number</Text>
                <Text style={{ color: canViewProviderPhone ? theme.colors.text : theme.colors.textMuted, marginTop: 4 }}>
                {canViewProviderPhone ? providerUser?.phone || "No contact number saved yet." : "Visible after the booking is accepted."}
                </Text>
              </View>
            </View>
          ) : null}

          {isProvider ? (
            <>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: theme.colors.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Ionicons name="call-outline" size={18} color={theme.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.textLight, fontSize: 12, fontWeight: "700" }}>Customer contact number</Text>
                  <Text style={{ color: canViewCustomerContact ? theme.colors.text : theme.colors.textMuted, marginTop: 4 }}>
                    {canViewCustomerContact ? customer?.phone || "No contact number saved yet." : "Visible after you accept the booking."}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: theme.colors.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Ionicons name="mail-outline" size={18} color={theme.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.textLight, fontSize: 12, fontWeight: "700" }}>Customer email</Text>
                  <Text style={{ color: canViewCustomerContact ? theme.colors.text : theme.colors.textMuted, marginTop: 4 }}>
                    {canViewCustomerContact ? customer?.email || "No email saved yet." : "Visible after you accept the booking."}
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {[
            { icon: "calendar-outline", label: booking.scheduledAt },
            { icon: "location-outline", label: booking.address || booking.location }
          ].map((item) => (
            <View key={item.label} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: theme.colors.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={theme.colors.primaryDark} />
              </View>
              <Text style={{ color: theme.colors.text, flex: 1 }}>{item.label}</Text>
            </View>
          ))}

          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Complete address</Text>
            <Text style={{ color: theme.colors.textMuted }}>{booking.address || "Address not provided."}</Text>
          </View>

          <Pressable
            onPress={() => setShowMapPreview(true)}
            style={{
              borderRadius: 18,
              padding: 14,
              backgroundColor: theme.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.colors.border
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: theme.colors.card, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="map-outline" size={18} color={theme.colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Preview exact location in app</Text>
                <Text style={{ color: theme.colors.textMuted }} numberOfLines={1}>
                  {booking.location || booking.address}
                </Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color={theme.colors.primaryDark} />
            </View>
          </Pressable>

          <View
            style={{
              borderRadius: 18,
              padding: 14,
              backgroundColor: theme.colors.surfaceAlt
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Work details</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              {booking.notes || "No additional booking notes were provided."}
            </Text>
          </View>

          {bookingMedia.length ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Attached photos or videos</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {bookingMedia.map((item, index) => {
                  const uri = typeof item === "string" ? item : item.url;
                  return (
                    <Pressable key={`${uri}-${index}`} onPress={() => setPreviewUri(uri)}>
                      <Image
                        source={{ uri }}
                        style={{ width: 84, height: 84, borderRadius: 16, backgroundColor: theme.colors.surfaceAlt }}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Booking status timeline</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
          Track the booking from request to review so both customer and worker know what should happen next.
        </Text>
        <View style={{ gap: 0, marginTop: 4 }}>
          {bookingStatusSteps.map((step, index) => {
            const state = bookingStepState(booking.status, Boolean(existingReview), step);
            const active = state === "done" || state === "current";
            return (
              <View key={step} style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ alignItems: "center" }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.primary : theme.colors.border
                    }}
                  >
                    <Ionicons
                      name={state === "done" ? "checkmark" : state === "current" ? "ellipse" : "ellipse-outline"}
                      size={state === "current" ? 10 : 16}
                      color={active ? "#fff" : theme.colors.textMuted}
                    />
                  </View>
                  {index < bookingStatusSteps.length - 1 ? (
                    <View style={{ width: 2, height: 24, backgroundColor: active ? theme.colors.primarySoft : theme.colors.border }} />
                  ) : null}
                </View>
                <View style={{ flex: 1, paddingBottom: index < bookingStatusSteps.length - 1 ? 12 : 0 }}>
                  <Text style={{ color: active ? theme.colors.text : theme.colors.textMuted, fontWeight: "900" }}>{step}</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {step === "Reviewed" && !existingReview && booking.status === "Completed"
                      ? "Waiting for customer feedback"
                      : state === "current"
                        ? "Current step"
                        : state === "done"
                          ? "Done"
                          : "Upcoming"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        {booking.status === "Cancelled" ? (
          <Text style={{ color: theme.colors.danger, fontWeight: "800" }}>This booking was cancelled, so the normal timeline stopped.</Text>
        ) : null}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Activity timeline</Text>
        {timeline.map((item) => (
          <View key={item.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{item.label}</Text>
            <Text style={{ color: theme.colors.textMuted, flexShrink: 1, textAlign: "right" }}>{item.value}</Text>
          </View>
        ))}
      </SurfaceCard>

      {existingReview ? (
        <SurfaceCard style={{ gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Customer feedback</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {Array.from({ length: 5 }, (_, index) => (
              <Ionicons
                key={`review-star-${index}`}
                name={index < existingReview.rating ? "star" : "star-outline"}
                size={18}
                color="#FACC15"
              />
            ))}
            <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{existingReview.rating}/5</Text>
          </View>
          <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
            {existingReview.comment || "The customer submitted a rating without a written comment."}
          </Text>
          {existingReview.mediaUrls?.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {existingReview.mediaUrls.map((uri, index) => (
                <Pressable key={`${uri}-${index}`} onPress={() => setPreviewUri(uri)}>
                  <Image source={{ uri }} style={{ width: 84, height: 84, borderRadius: 16, backgroundColor: theme.colors.surfaceAlt }} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </SurfaceCard>
      ) : null}

      {changeRequests.length ? (
        <SurfaceCard>
          <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Change requests</Text>
          {changeRequests.slice(0, 3).map((request) => (
            <View key={request.requestId} style={{ borderRadius: 18, padding: 14, backgroundColor: theme.colors.surfaceAlt, gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <Text style={{ color: theme.colors.text, fontWeight: "900", textTransform: "capitalize" }}>
                  {request.type}
                </Text>
                <StatusBadge status={request.status} />
              </View>
              {request.requestedScheduledAt ? (
                <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>
                  Requested: {request.requestedScheduledAt}
                </Text>
              ) : null}
              <Text style={{ color: theme.colors.textMuted }}>{request.reason}</Text>
            </View>
          ))}
        </SurfaceCard>
      ) : null}

      {canEditBookingDetails ? (
        <PrimaryButton
          label="Edit booking details"
          icon="create-outline"
          disabled={updating}
          onPress={openEditBookingForm}
        />
      ) : null}

      {isProvider || booking.providerId ? (
        <PrimaryButton
          label={`Chat with ${counterpartName.split(" ")[0] || "contact"}`}
          icon="chatbubble-ellipses-outline"
          onPress={() =>
            router.push({
              pathname: "/chat",
              params: { bookingId: booking.bookingId, otherId: isProvider ? booking.customerId : booking.providerId }
            })
          }
        />
      ) : null}

      {isProvider && nextProviderStatus ? (
        <PrimaryButton
          label={`Mark as ${nextProviderStatus}`}
          icon="checkmark-circle-outline"
          disabled={updating || waitingForCustomerAcceptanceConfirmation}
          onPress={() => void handleProviderStatusUpdate(nextProviderStatus)}
          style={{ backgroundColor: theme.colors.success }}
        />
      ) : null}

      {waitingForCustomerAcceptanceConfirmation ? (
        <Text style={{ color: theme.colors.textMuted, textAlign: "center", fontWeight: "700" }}>
          Waiting for customer confirmation before you can mark this booking as On the Way.
        </Text>
      ) : null}

      {isProvider && booking.status === "In Progress" ? (
        <PrimaryButton
          label="Add proof & payment details"
          icon="camera-outline"
          disabled={updating}
          onPress={() => {
            setPaymentAmount(String(booking.amount || ""));
            setShowCompletionForm(true);
          }}
          style={{ backgroundColor: theme.colors.success }}
        />
      ) : null}

      {booking.status !== "Completed" && booking.status !== "Cancelled" ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/booking-change-request" as never,
                params: { bookingId: booking.bookingId, type: "reschedule" }
              })
            }
            disabled={hasPendingChangeRequest || updating}
            style={{
              flex: 1,
              borderRadius: 18,
              paddingVertical: 15,
              paddingHorizontal: 12,
              alignItems: "center",
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.primary,
              opacity: hasPendingChangeRequest ? 0.55 : 1
            }}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: "900", textAlign: "center" }}>Request reschedule</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/booking-change-request" as never,
                params: { bookingId: booking.bookingId, type: "cancellation" }
              })
            }
            disabled={updating}
            style={{
              flex: 1,
              borderRadius: 18,
              paddingVertical: 15,
              paddingHorizontal: 12,
              alignItems: "center",
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.danger,
              opacity: updating ? 0.55 : 1
            }}
          >
            <Text style={{ color: theme.colors.danger, fontWeight: "900", textAlign: "center" }}>Cancel booking</Text>
          </Pressable>
        </View>
      ) : null}

      {hasPendingChangeRequest ? (
        <Text style={{ color: theme.colors.textMuted, textAlign: "center", fontWeight: "700" }}>
          A pending reschedule request is already waiting for the other party.
        </Text>
      ) : null}

      {isCustomer && booking.status === "Completed" ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/booking-request",
              params: { providerId: booking.providerId, categoryId: booking.serviceCategoryId }
            })
          }
          style={{
            borderRadius: 18,
            paddingVertical: 15,
            paddingHorizontal: 18,
            alignItems: "center",
            backgroundColor: theme.colors.primary
          }}
        >
          <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>Book Again</Text>
        </Pressable>
      ) : null}

      {booking.status === "Completed" && isCustomer ? (
        <PrimaryButton
          label="Leave feedback"
          icon="star-outline"
          onPress={() =>
            router.push({
              pathname: "/booking-review",
              params: { bookingId: booking.bookingId }
            })
          }
        />
      ) : null}

      <PrimaryButton
        label="Need help with this booking?"
        icon="help-buoy-outline"
        onPress={() => router.push("/help")}
        style={{ backgroundColor: theme.colors.info }}
      />

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/booking-complaint",
            params: { bookingId: booking.bookingId }
          })
        }
        style={{
          borderRadius: 18,
          paddingVertical: 15,
          paddingHorizontal: 18,
          alignItems: "center",
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border
        }}
      >
        <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Report an issue</Text>
      </Pressable>

      <FullScreenPopup
        visible={!!statusProgress}
        tone="info"
        icon="hourglass-outline"
        title={statusProgress?.title || "Updating booking"}
        message={statusProgress?.message || "Please wait while we update the booking."}
      />

      <FullScreenPopup
        visible={showActionOverlay}
        title="Status updated"
        message="The booking workflow has been updated successfully."
      />
    </FixedScreen>
  );
}
