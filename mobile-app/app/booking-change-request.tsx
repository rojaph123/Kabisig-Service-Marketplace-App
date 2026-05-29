import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import {
  bookingChangeRequestService,
  bookingService,
  notificationService,
  userService,
  type Booking,
  type BookingChangeRequestType,
  type ProviderProfile,
  type User,
} from "@kabisig/shared";
import { BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, LoadingState, PrimaryButton, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";
import { readableAppError } from "../src/utils/errors";
import { safeBack } from "../src/utils/navigation";

type ProviderCard = ProviderProfile & { userId: string };

function nextUpcomingDays() {
  return Array.from({ length: 21 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      key: date.toISOString().slice(0, 10),
      label: date.getDate().toString(),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
    };
  });
}

function buildTimeSlots(
  provider: ProviderCard | null,
  weekday: string,
  selectedDate: string,
  reservedSlots: string[],
  currentBooking?: Booking | null
) {
  const dateException = provider?.scheduleExceptions?.find((item) => item.unavailable && item.date === selectedDate);
  if (dateException) return [];
  const schedule = provider?.availability?.find((slot) => slot.day === weekday && slot.available);
  if (!schedule) return [];

  const [startHour] = schedule.start.split(":").map(Number);
  const [endHour] = schedule.end.split(":").map(Number);
  const slots: string[] = [];

  for (let hour = startHour; hour < endHour; hour += 1) {
    const suffix = hour >= 12 ? "PM" : "AM";
    const formatted = `${((hour + 11) % 12) + 1}:00 ${suffix}`;
    const now = new Date();
    const isToday = selectedDate === now.toISOString().slice(0, 10);
    const isPastHour = isToday && hour <= now.getHours();
    const isReservedByOtherBooking =
      reservedSlots.includes(formatted) &&
      !(currentBooking?.scheduledDate === selectedDate && currentBooking?.scheduledTime === formatted);
    if (!isPastHour && !isReservedByOtherBooking) {
      slots.push(formatted);
    }
  }

  return slots;
}

function formatRequestedSchedule(date: string, time: string) {
  const day = nextUpcomingDays().find((item) => item.key === date);
  if (!day || !time.trim()) return "";
  return `${day.month} ${day.label}, ${day.weekday} - ${time.trim()}`;
}

export default function BookingChangeRequestScreen() {
  const params = useLocalSearchParams<{ bookingId?: string; type?: BookingChangeRequestType }>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const compactGrid = width < 430;
  const requestType: BookingChangeRequestType = params.type === "reschedule" ? "reschedule" : "cancellation";
  const [booking, setBooking] = useState<Booking | null>(null);
  const [provider, setProvider] = useState<ProviderCard | null>(null);
  const [counterpart, setCounterpart] = useState<User | null>(null);
  const [reason, setReason] = useState("");
  const [requestedDate, setRequestedDate] = useState(nextUpcomingDays()[0].key);
  const [requestedTime, setRequestedTime] = useState("");
  const [reservedSlots, setReservedSlots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  useEffect(() => {
    async function load() {
      if (!params.bookingId) return;
      const nextBooking = await bookingService.getBookingById(params.bookingId);
      setBooking(nextBooking);
      if (nextBooking && user) {
        const targetUserId = user.id === nextBooking.customerId ? nextBooking.providerId : nextBooking.customerId;
        const [targetUser, providerProfile] = await Promise.all([
          userService.getUserDocument(targetUserId),
          userService.getProviderProfile(nextBooking.providerId),
        ]);
        setCounterpart(targetUser);
        setProvider(providerProfile ? { ...providerProfile, userId: nextBooking.providerId } : null);
      }
    }

    void load();
  }, [params.bookingId, user]);

  const dates = nextUpcomingDays();
  const selectedDateInfo = dates.find((item) => item.key === requestedDate) || dates[0];
  const selectedDateException = provider?.scheduleExceptions?.find((item) => item.unavailable && item.date === requestedDate);
  const availableSlots = useMemo(
    () => buildTimeSlots(provider, selectedDateInfo.weekday, requestedDate, reservedSlots, booking),
    [booking, provider, requestedDate, reservedSlots, selectedDateInfo.weekday]
  );

  const requestedScheduledAt = useMemo(
    () => formatRequestedSchedule(requestedDate, requestedTime),
    [requestedDate, requestedTime]
  );

  useEffect(() => {
    if (requestType !== "reschedule" || !booking?.providerId || !requestedDate) {
      setReservedSlots([]);
      return;
    }

    const unsubscribe = bookingService.subscribeReservedSlotTimes(booking.providerId, requestedDate, (times) => {
      setReservedSlots(times);
    });

    return unsubscribe;
  }, [booking?.providerId, requestType, requestedDate]);

  useEffect(() => {
    if (requestType !== "reschedule") return;
    if (availableSlots.length && !availableSlots.includes(requestedTime)) {
      setRequestedTime(availableSlots[0]);
    }
    if (!availableSlots.length) {
      setRequestedTime("");
    }
  }, [availableSlots, requestType, requestedTime]);

  async function handleSubmit() {
    if (!booking || !user) return;
    if (!reason.trim()) {
      setFeedback({
        type: "error",
        title: "Reason required",
        message: requestType === "reschedule" ? "Please add a clear reason so the other party can review this reschedule request." : "Please add a clear reason for this cancellation.",
      });
      return;
    }
    if (requestType === "reschedule" && (!requestedDate.trim() || !requestedTime.trim())) {
      setFeedback({
        type: "error",
        title: "New schedule required",
        message: "Please enter the requested date and time for this reschedule request.",
      });
      return;
    }

    const targetUserId = user.id === booking.customerId ? booking.providerId : booking.customerId;
    setSubmitting(true);
    setFeedback({
      type: "info",
      title: requestType === "reschedule" ? "Sending request" : "Cancelling booking",
      message: requestType === "reschedule" ? "Saving the request and notifying the other party." : "Cancelling the booking and notifying the other party."
    });

    try {
      if (requestType === "cancellation") {
        await bookingService.updateBooking(booking.bookingId, { status: "Cancelled" });
        await notificationService.createNotification({
          userId: targetUserId,
          type: "booking_status_update",
          title: "Booking cancelled",
          body: `${user.fullName} cancelled ${booking.serviceName}.`,
          isRead: false,
          route: `/booking-detail?bookingId=${booking.bookingId}`,
          createdAt: new Date().toISOString(),
        });
      } else {
        await bookingChangeRequestService.createRequest({
          bookingId: booking.bookingId,
          requestedBy: user.id,
          requestedByRole: user.role === "provider" ? "provider" : "customer",
          targetUserId,
          type: requestType,
          reason: reason.trim(),
          currentScheduledAt: booking.scheduledAt,
          requestedDate: requestedDate.trim(),
          requestedTime: requestedTime.trim(),
          requestedScheduledAt,
        });

        await notificationService.createNotification({
          userId: targetUserId,
          type: "booking_reschedule_requested",
          title: "Reschedule requested",
          body: `${user.fullName} requested to move ${booking.serviceName} to ${requestedScheduledAt}.`,
          isRead: false,
          route: `/booking-detail?bookingId=${booking.bookingId}`,
          createdAt: new Date().toISOString(),
        });
      }

      setShowSuccessOverlay(true);
      setFeedback({
        type: "success",
        title: requestType === "reschedule" ? "Request sent" : "Booking cancelled",
        message: requestType === "reschedule" ? "The other party has been notified about the reschedule request." : "The booking was cancelled and the other party has been notified.",
      });
      setTimeout(() => {
        setShowSuccessOverlay(false);
        router.replace({ pathname: "/booking-detail", params: { bookingId: booking.bookingId } });
      }, 1100);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: requestType === "reschedule" ? "Request failed" : "Cancellation failed",
        message: readableAppError(error, requestType === "reschedule" ? "We could not submit this request right now." : "We could not cancel this booking right now."),
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!booking) {
    return (
      <FixedScreen header={<BackHeader title="Booking Request" onBack={() => router.back()} />}>
        <LoadingState label="Loading booking..." />
      </FixedScreen>
    );
  }

  return (
    <FixedScreen
      header={
        <>
          <BackHeader title={requestType === "reschedule" ? "Request Reschedule" : "Cancel Booking"} onBack={() => router.back()} />
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
        </>
      }
      footer={
        <PrimaryButton
          label={submitting ? (requestType === "reschedule" ? "Sending request..." : "Cancelling booking...") : requestType === "reschedule" ? "Submit request" : "Cancel booking now"}
          icon={requestType === "reschedule" ? "calendar-outline" : "close-circle-outline"}
          disabled={submitting}
          onPress={() => void handleSubmit()}
        />
      }
    >
      <FullScreenPopup
        visible={showSuccessOverlay}
        title={requestType === "reschedule" ? "Request submitted" : "Booking cancelled"}
        message={requestType === "reschedule" ? "The other party can now review the reschedule request." : "The booking was cancelled successfully."}
      />

      <SurfaceCard style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 18,
              backgroundColor: requestType === "reschedule" ? theme.colors.primarySoft : theme.dark ? theme.colors.dangerSoft : "#FFE4EA",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={requestType === "reschedule" ? "calendar-outline" : "close-circle-outline"}
              size={22}
              color={requestType === "reschedule" ? theme.colors.primaryDark : theme.colors.danger}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>{booking.serviceName}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 3 }}>
              Current schedule: {booking.scheduledAt}
            </Text>
          </View>
        </View>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
          {requestType === "reschedule"
            ? "This reschedule request will be shared only with the other party linked to this booking."
            : "This will cancel the booking immediately after you submit it."}
        </Text>
        {requestType === "cancellation" ? (
          <View
            style={{
              borderRadius: 16,
              padding: 14,
              backgroundColor: theme.dark ? theme.colors.warningSoft : "#FFF4E5",
              borderWidth: 1,
              borderColor: theme.colors.warning,
              gap: 6
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Immediate cancellation</Text>
            <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
              The booking will be cancelled right away. The other party will only receive a cancellation notification.
            </Text>
          </View>
        ) : null}
      </SurfaceCard>

      {requestType === "reschedule" ? (
        <SurfaceCard style={{ gap: 12 }}>
          <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "900" }}>New requested schedule</Text>
          <Text style={{ color: theme.colors.textMuted }}>
            Choose from the provider available working days. Reserved times are hidden.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {dates.map((day) => {
              const canSelect = Boolean(provider?.availability.some((slot) => slot.day === day.weekday && slot.available));
              const active = requestedDate === day.key;
              return (
                <Pressable
                  key={day.key}
                  disabled={!canSelect}
                  onPress={() => setRequestedDate(day.key)}
                  style={{
                    width: compactGrid ? "30%" : "22%",
                    minWidth: compactGrid ? 82 : 72,
                    borderRadius: 20,
                    paddingVertical: 12,
                    alignItems: "center",
                    backgroundColor: active ? theme.colors.primary : canSelect ? theme.colors.surfaceAlt : theme.dark ? theme.colors.card : "#ECEFF3",
                    borderWidth: 1,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    opacity: canSelect ? 1 : 0.48,
                  }}
                >
                  <Text style={{ color: active ? "#fff" : theme.colors.textMuted, fontSize: 11, fontWeight: "700" }}>{day.weekday}</Text>
                  <Text style={{ color: active ? "#fff" : theme.colors.text, fontSize: 20, fontWeight: "900", marginTop: 4 }}>{day.label}</Text>
                  <Text style={{ color: active ? "#fff" : theme.colors.textLight, fontSize: 11 }}>{day.month}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Available time slots</Text>
          {selectedDateException ? (
            <View style={{ borderRadius: 16, padding: 12, backgroundColor: theme.dark ? theme.colors.warningSoft : "#FFF4E5", borderWidth: 1, borderColor: theme.colors.warning, gap: 4 }}>
              <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Provider unavailable on this date</Text>
              <Text style={{ color: theme.colors.textMuted }}>
                {selectedDateException.reason || "This date was blocked by the provider, so no reschedule times are available."}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {availableSlots.length ? (
              availableSlots.map((slot) => (
                <Pressable
                  key={slot}
                  onPress={() => setRequestedTime(slot)}
                  style={{
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: requestedTime === slot ? theme.colors.primary : theme.colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: requestedTime === slot ? theme.colors.primary : theme.colors.border,
                  }}
                >
                  <Text style={{ color: requestedTime === slot ? theme.colors.textOnPrimary : theme.colors.text, fontWeight: "700" }}>
                    {slot}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
                No free slots are available for this provider on the selected date.
              </Text>
            )}
          </View>
          {requestedScheduledAt ? (
            <View style={{ borderRadius: 16, padding: 14, backgroundColor: theme.colors.surfaceAlt }}>
              <Text style={{ color: theme.colors.textMuted, fontWeight: "700" }}>Preview</Text>
              <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 4 }}>{requestedScheduledAt}</Text>
            </View>
          ) : null}
        </SurfaceCard>
      ) : null}

      <FormInput
        label="Reason"
        value={reason}
        onChangeText={setReason}
        placeholder={requestType === "reschedule" ? "Explain why the schedule needs to change." : "Explain why this booking should be cancelled."}
        multiline
        required
        style={{ minHeight: 120, textAlignVertical: "top" }}
      />

      <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt, gap: 6 }}>
        <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Who will be notified?</Text>
        <Text style={{ color: theme.colors.textMuted }}>
          {counterpart?.fullName || "The other party"} will be notified.
        </Text>
      </SurfaceCard>

      <Pressable
        onPress={() => safeBack(booking ? `/booking-detail?bookingId=${booking.bookingId}` : "/(tabs)/bookings")}
        style={{
          borderRadius: 18,
          paddingVertical: 15,
          alignItems: "center",
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Keep booking unchanged</Text>
      </Pressable>
    </FixedScreen>
  );
}
