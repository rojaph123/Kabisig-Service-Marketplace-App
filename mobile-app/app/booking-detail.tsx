import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Linking, Pressable, Text, View } from "react-native";
import {
  bookingService,
  notificationService,
  paymentService,
  userService,
  type Booking,
  type MediaAttachment,
  type User
} from "@kabisig/shared";
import { Avatar, BackHeader, EmptyState, FeedbackBanner, FixedScreen, FullScreenPopup, LoadingState, MapPreviewModal, MediaPreviewModal, PrimaryButton, StatusBadge, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";

const providerActions: Record<string, string | null> = {
  Pending: "Accepted",
  Accepted: "On the Way",
  "On the Way": "In Progress",
  "In Progress": "Completed",
  Completed: null,
  Cancelled: null
};

function cleanBookingNumber(bookingId: string) {
  return bookingId.replace(/^booking-/, "");
}

function mapsUrl(location: string) {
  const normalized = location.trim();
  const coordsMatch = normalized.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (coordsMatch) {
    return `https://www.openstreetmap.org/export/embed.html?bbox=${Number(coordsMatch[3]) - 0.01}%2C${Number(coordsMatch[1]) - 0.01}%2C${Number(coordsMatch[3]) + 0.01}%2C${Number(coordsMatch[1]) + 0.01}&layer=mapnik&marker=${coordsMatch[1]}%2C${coordsMatch[3]}`;
  }
  return `https://www.openstreetmap.org/export/embed.html?search=${encodeURIComponent(normalized)}`;
}

function mapsExternalUrl(location: string) {
  const normalized = location.trim();
  const coordsMatch = normalized.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (coordsMatch) {
    return `https://www.openstreetmap.org/?mlat=${coordsMatch[1]}&mlon=${coordsMatch[3]}#map=18/${coordsMatch[1]}/${coordsMatch[3]}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(normalized)}`;
}

export default function BookingDetailScreen() {
  const params = useLocalSearchParams<{ bookingId?: string; backTo?: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [providerUser, setProviderUser] = useState<User | null>(null);
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);
  const [showActionOverlay, setShowActionOverlay] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!params.bookingId) return;
      const next = await bookingService.getBookingById(params.bookingId);
      setBooking(next);
      if (next) {
        const [customerDoc, providerDoc] = await Promise.all([
          userService.getUserDocument(next.customerId),
          userService.getUserDocument(next.providerId)
        ]);
        setCustomer(customerDoc);
        setProviderUser(providerDoc);
      }
    }

    void load();
  }, [params.bookingId]);

  const timeline = useMemo(() => {
    if (!booking) return [];

    return [
      { label: "Created", value: booking.createdAt },
      { label: "Scheduled", value: booking.scheduledAt },
      { label: "Last Updated", value: booking.updatedAt }
    ];
  }, [booking]);

  const nextProviderStatus = booking ? providerActions[booking.status] : null;
  const isProvider = user?.role === "provider";
  const isCustomer = user?.role === "customer";
  const counterpartName = isProvider ? customer?.fullName || "Customer" : providerUser?.fullName || "Provider";

  async function refreshBooking() {
    if (!params.bookingId) return;
    const next = await bookingService.getBookingById(params.bookingId);
    setBooking(next);
  }

  async function ensurePaymentForCompletedBooking(activeBooking: Booking) {
    const existingPayment = await paymentService.getPaymentByBookingId(activeBooking.bookingId);
    if (existingPayment) {
      if (existingPayment.status !== "Paid") {
        await paymentService.updatePaymentStatus(existingPayment.paymentId, "Paid");
      }
      return existingPayment.paymentId;
    }

    return paymentService.createPayment({
      bookingId: activeBooking.bookingId,
      customerId: activeBooking.customerId,
      providerId: activeBooking.providerId,
      amount: activeBooking.amount,
      method: "Cash on Service",
      status: "Paid",
      createdAt: new Date().toISOString()
    });
  }

  async function handleProviderStatusUpdate(nextStatus: string) {
    if (!booking || !user) return;
    setUpdating(true);
    setFeedback({ type: "info", title: "Updating booking", message: "Please wait while we update the booking status." });
    try {
      await bookingService.updateBooking(booking.bookingId, { status: nextStatus as Booking["status"] });

      if (nextStatus === "Completed") {
        await ensurePaymentForCompletedBooking(booking);
        await notificationService.createNotification({
          userId: booking.customerId,
          type: "payment_paid",
          title: "Payment updated",
          body: `${booking.serviceName} is marked complete and your payment record is now paid.`,
          isRead: false,
          route: "/(tabs)/payments",
          createdAt: new Date().toISOString()
        });
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

      await notificationService.createNotification({
        userId: booking.customerId,
        type: "booking_status_update",
        title: "Booking updated",
        body: `${booking.serviceName} is now marked as ${nextStatus}.`,
        isRead: false,
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
        message: "We could not update this booking right now."
      });
    } finally {
      setUpdating(false);
    }
  }

  async function handleCancelBooking() {
    if (!booking || !user) return;
    setUpdating(true);
    try {
      await bookingService.cancelBooking(booking.bookingId);
      await notificationService.createNotification({
        userId: booking.providerId,
        type: "booking_cancelled",
        title: "Booking cancelled",
        body: `${booking.serviceName} was cancelled by the customer.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });
      setFeedback({
        type: "success",
        title: "Booking cancelled",
        message: "The provider has been notified that this request was cancelled."
      });
      await refreshBooking();
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Cancellation failed",
        message: "We could not cancel this booking right now."
      });
    } finally {
      setUpdating(false);
    }
  }

  if (!booking) {
    return (
      <FixedScreen header={<BackHeader title="Booking Details" onBack={() => router.back()} />}>
        <LoadingState label="Loading booking details..." />
      </FixedScreen>
    );
  }

  const bookingMedia = ((booking.attachmentItems?.length ? booking.attachmentItems : booking.attachments || []) as Array<MediaAttachment | string>);

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
            mapUrl={mapsUrl(booking.location || booking.address)}
            onClose={() => setShowMapPreview(false)}
            onOpenExternal={() => void Linking.openURL(mapsExternalUrl(booking.location || booking.address))}
          />
          <MediaPreviewModal visible={!!previewUri} uri={previewUri} title="Booking Attachment" onClose={() => setPreviewUri(null)} />
        </>
      }
    >

      <SurfaceCard style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ backgroundColor: theme.colors.primaryDark, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: "#fff" }}>{booking.serviceName}</Text>
              <Text style={{ color: "rgba(255,255,255,0.76)" }}>#{cleanBookingNumber(booking.bookingId)}</Text>
            </View>
            <StatusBadge status={booking.status} />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { label: "Amount", value: `PHP ${booking.amount.toLocaleString()}` },
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
        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Activity timeline</Text>
        {timeline.map((item) => (
          <View key={item.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{item.label}</Text>
            <Text style={{ color: theme.colors.textMuted, flexShrink: 1, textAlign: "right" }}>{item.value}</Text>
          </View>
        ))}
      </SurfaceCard>

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

      {isProvider && nextProviderStatus ? (
        <PrimaryButton
          label={`Mark as ${nextProviderStatus}`}
          icon="checkmark-circle-outline"
          disabled={updating}
          onPress={() => void handleProviderStatusUpdate(nextProviderStatus)}
          style={{ backgroundColor: theme.colors.success }}
        />
      ) : null}

      {isCustomer && booking.status === "Pending" ? (
        <Pressable
          onPress={() => void handleCancelBooking()}
          disabled={updating}
          style={{
            borderRadius: 18,
            paddingVertical: 15,
            paddingHorizontal: 18,
            alignItems: "center",
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.danger
          }}
        >
          <Text style={{ color: theme.colors.danger, fontWeight: "800" }}>Cancel booking</Text>
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
        visible={showActionOverlay}
        title="Status updated"
        message="The booking workflow has been updated successfully."
      />
    </FixedScreen>
  );
}
