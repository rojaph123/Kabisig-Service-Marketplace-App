import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs, router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Modal, Platform, Pressable, Text, View } from "react-native";
import { bookingService, messagingService, notificationService, reviewService, userService, type Booking } from "@kabisig/shared";
import { FullScreenPopup, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { useThemeMode } from "../../src/hooks/ThemeProvider";
import { theme } from "../../src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { readableAppError } from "../../src/utils/errors";

function formatServiceLabel(serviceName?: string) {
  const normalized = serviceName?.trim().toLowerCase();
  if (!normalized) return "the job";

  const serviceLabels: Record<string, string> = {
    electrician: "electrical work",
    plumber: "plumbing",
    welder: "welding",
    carpenter: "carpentry",
    "tile setter": "tile setting",
    roofer: "roofing",
    painter: "painting",
    "car mechanic": "car repair",
    "motor mechanic": "motorcycle repair",
    "aircon repair": "aircon repair"
  };

  return serviceLabels[normalized] || serviceName;
}

export default function TabsLayout() {
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const [messageCount, setMessageCount] = useState(0);
  const [jobCount, setJobCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [completedBookingPrompt, setCompletedBookingPrompt] = useState<Booking | null>(null);
  const [pendingReviewBooking, setPendingReviewBooking] = useState<Booking | null>(null);
  const [acceptedBookingPrompt, setAcceptedBookingPrompt] = useState<Booking | null>(null);
  const [acceptedBookingProviderName, setAcceptedBookingProviderName] = useState<string>("");
  const [acceptedBookingProviderPhoto, setAcceptedBookingProviderPhoto] = useState<string>("");
  const [completedBookingProviderName, setCompletedBookingProviderName] = useState<string>("");
  const [completedBookingProviderPhoto, setCompletedBookingProviderPhoto] = useState<string>("");
  const [acceptancePromptBusy, setAcceptancePromptBusy] = useState(false);
  const [acceptancePromptError, setAcceptancePromptError] = useState<string | null>(null);
  const [suppressedAcceptedBookingId, setSuppressedAcceptedBookingId] = useState<string | null>(null);
  const [acceptedBookingResultPopup, setAcceptedBookingResultPopup] = useState<{
    tone: "success" | "info";
    title: string;
    message: string;
  } | null>(null);
  const bookingStatusesRef = useRef<Record<string, Booking["status"]>>({});
  const initializedBookingsRef = useRef(false);
  const routedCompletionIdsRef = useRef(new Set<string>());
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptedIconFloat = useRef(new Animated.Value(0)).current;

  const blurActiveElementOnWeb = useCallback(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  }, []);

  const loadBadges = useCallback(async () => {
    if (!user) return;
    try {
      const [messageCount, notifications, jobs] = await Promise.all([
        messagingService.getUnreadMessageCount(user.id),
        notificationService.getUserNotifications(user.id),
        user.role === "provider" ? bookingService.getProviderBookings(user.id) : bookingService.getCustomerBookings(user.id)
      ]);
      setMessageCount(messageCount);
      setNotificationCount(
        notifications.filter((item) => !item.isRead && item.type.includes(user.role === "provider" ? "payment" : "payment")).length
      );
      setJobCount(jobs.filter((item) => item.status === "Pending" || item.status === "Accepted" || item.status === "In Progress" || item.status === "On the Way").length);
    } catch (error) {
      console.warn("Unable to load tab badges:", error);
      setMessageCount(0);
      setNotificationCount(0);
      setJobCount(0);
    }
  }, [user]);

  useEffect(() => {
    void loadBadges();
  }, [loadBadges]);

  useEffect(() => {
    if (!acceptedBookingPrompt) {
      acceptedIconFloat.stopAnimation();
      acceptedIconFloat.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(acceptedIconFloat, {
          toValue: -6,
          duration: 850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
          isInteraction: false
        }),
        Animated.timing(acceptedIconFloat, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
          isInteraction: false
        })
      ])
    );

    animation.start();
    return () => {
      animation.stop();
      acceptedIconFloat.setValue(0);
    };
  }, [acceptedBookingPrompt, acceptedIconFloat]);

  useFocusEffect(
    useCallback(() => {
      void loadBadges();
    }, [loadBadges])
  );

  useEffect(() => {
    if (!user || user.role !== "customer") {
      initializedBookingsRef.current = false;
      bookingStatusesRef.current = {};
      routedCompletionIdsRef.current.clear();
      setCompletedBookingPrompt(null);
      setPendingReviewBooking(null);
      setAcceptedBookingPrompt(null);
      setAcceptedBookingProviderName("");
      setAcceptedBookingProviderPhoto("");
      setCompletedBookingProviderName("");
      setCompletedBookingProviderPhoto("");
      setAcceptancePromptBusy(false);
      setAcceptancePromptError(null);
      setAcceptedBookingResultPopup(null);
      setSuppressedAcceptedBookingId(null);
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
      return;
    }

    let active = true;
    const unsubscribe = bookingService.subscribeCustomerBookings(user.id, async (items) => {
      try {
        if (!active) return;
        const previousStatuses = bookingStatusesRef.current;
        const nextStatuses = Object.fromEntries(items.map((booking) => [booking.bookingId, booking.status])) as Record<string, Booking["status"]>;
        const newlyCompleted = initializedBookingsRef.current
          ? [...items]
              .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
              .find((booking) => {
                const previous = previousStatuses[booking.bookingId];
                return (
                  booking.status === "Completed" &&
                  previous &&
                  previous !== "Completed" &&
                  !routedCompletionIdsRef.current.has(booking.bookingId)
                );
              })
          : null;

        bookingStatusesRef.current = nextStatuses;
        initializedBookingsRef.current = true;

        const completedBookings = [...items]
          .filter((booking) => booking.status === "Completed")
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        const rawPendingAcceptedBooking = [...items]
          .filter((booking) => booking.status === "Accepted" && !booking.customerAcceptanceConfirmedAt)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
        const pendingAcceptedBooking =
          rawPendingAcceptedBooking && rawPendingAcceptedBooking.bookingId !== suppressedAcceptedBookingId ? rawPendingAcceptedBooking : null;
        let unresolvedCompletedBooking: Booking | null = null;
        for (const booking of completedBookings) {
          const existingReview = await reviewService.getReviewForBooking(booking.bookingId, user.id);
          if (!active) return;
          if (!existingReview) {
            unresolvedCompletedBooking = booking;
            break;
          }
        }
        if (!active) return;
        setPendingReviewBooking(unresolvedCompletedBooking);
        setAcceptedBookingPrompt(pendingAcceptedBooking);
        if (!rawPendingAcceptedBooking) {
          setAcceptancePromptError(null);
          setAcceptedBookingProviderName("");
          setAcceptedBookingProviderPhoto("");
        } else if (!pendingAcceptedBooking) {
          setAcceptancePromptError(null);
        } else {
          const providerProfile = await userService.getProviderProfile(pendingAcceptedBooking.providerId);
          if (!active) return;
          setAcceptedBookingProviderName(
            providerProfile?.displayName || providerProfile?.businessName || "Your worker"
          );
          setAcceptedBookingProviderPhoto(providerProfile?.profilePhotoUrl || "");
        }

        if (suppressedAcceptedBookingId) {
          const stillSuppressed = items.find((booking) => booking.bookingId === suppressedAcceptedBookingId);
          if (!stillSuppressed || stillSuppressed.status !== "Accepted" || stillSuppressed.customerAcceptanceConfirmedAt) {
            setSuppressedAcceptedBookingId(null);
          }
        }

        if (!unresolvedCompletedBooking) {
          setCompletedBookingPrompt(null);
          setCompletedBookingProviderName("");
          setCompletedBookingProviderPhoto("");
          if (completionTimeoutRef.current) {
            clearTimeout(completionTimeoutRef.current);
            completionTimeoutRef.current = null;
          }
          return;
        }

        if (newlyCompleted) {
          routedCompletionIdsRef.current.add(newlyCompleted.bookingId);
        }
        setCompletedBookingPrompt(newlyCompleted || unresolvedCompletedBooking);
        const completedProviderProfile = await userService.getProviderProfile(unresolvedCompletedBooking.providerId);
        if (!active) return;
        setCompletedBookingProviderName(
          completedProviderProfile?.displayName || completedProviderProfile?.businessName || "Your worker"
        );
        setCompletedBookingProviderPhoto(completedProviderProfile?.profilePhotoUrl || "");
        if (completionTimeoutRef.current) {
          clearTimeout(completionTimeoutRef.current);
        }
        completionTimeoutRef.current = null;
      } catch (error) {
        console.warn("Unable to check existing review:", error);
      }
    });

    return () => {
      active = false;
      unsubscribe();
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
    };
  }, [suppressedAcceptedBookingId, user]);

  const handleAcceptedBookingConfirmation = useCallback(async () => {
    if (!user || !acceptedBookingPrompt || acceptancePromptBusy) return;
    const bookingId = acceptedBookingPrompt.bookingId;
    blurActiveElementOnWeb();
    setSuppressedAcceptedBookingId(bookingId);
    setAcceptedBookingPrompt(null);
    setAcceptancePromptBusy(true);
    setAcceptancePromptError(null);
    try {
      const confirmedAt = new Date().toISOString();
      await bookingService.confirmAcceptedBooking(bookingId, user.id);
      await notificationService.createNotification({
        userId: acceptedBookingPrompt.providerId,
        type: "booking_status_update",
        title: "Customer confirmed accepted booking",
        body: `${acceptedBookingPrompt.serviceName} was confirmed by the customer and is ready for the next step.`,
        isRead: false,
        route: `/booking-detail?bookingId=${bookingId}`,
        createdAt: confirmedAt
      });
      setAcceptedBookingResultPopup({
        tone: "success",
        title: "Booking accepted",
        message: `You accepted ${acceptedBookingPrompt.serviceName}. The worker can continue with the next step now.`
      });
    } catch (error) {
      console.warn("Unable to confirm accepted booking:", error);
      setSuppressedAcceptedBookingId(null);
      setAcceptedBookingPrompt(acceptedBookingPrompt);
      setAcceptancePromptError(readableAppError(error, "We could not confirm this booking right now."));
    } finally {
      setAcceptancePromptBusy(false);
    }
  }, [acceptancePromptBusy, acceptedBookingPrompt, blurActiveElementOnWeb, user]);

  const handleAcceptedBookingCancellation = useCallback(async () => {
    if (!user || !acceptedBookingPrompt || acceptancePromptBusy) return;
    const bookingId = acceptedBookingPrompt.bookingId;
    blurActiveElementOnWeb();
    setSuppressedAcceptedBookingId(bookingId);
    setAcceptedBookingPrompt(null);
    setAcceptancePromptBusy(true);
    setAcceptancePromptError(null);
    try {
      const cancelledAt = new Date().toISOString();
      await bookingService.updateBooking(bookingId, {
        status: "Cancelled",
        statusHistory: acceptedBookingPrompt.statusHistory ?? []
      });
      await notificationService.createNotification({
        userId: acceptedBookingPrompt.providerId,
        type: "booking_status_update",
        title: "Booking cancelled",
        body: `${acceptedBookingPrompt.serviceName} was cancelled by the customer after acceptance.`,
        isRead: false,
        route: `/booking-detail?bookingId=${bookingId}`,
        createdAt: cancelledAt
      });
      setAcceptedBookingResultPopup({
        tone: "info",
        title: "Booking cancelled",
        message: `You cancelled ${acceptedBookingPrompt.serviceName}. The worker has been notified.`
      });
    } catch (error) {
      console.warn("Unable to cancel accepted booking:", error);
      setSuppressedAcceptedBookingId(null);
      setAcceptedBookingPrompt(acceptedBookingPrompt);
      setAcceptancePromptError(readableAppError(error, "We could not cancel this booking right now."));
    } finally {
      setAcceptancePromptBusy(false);
    }
  }, [acceptancePromptBusy, acceptedBookingPrompt, blurActiveElementOnWeb, user]);

  const handleOpenCompletionFeedback = useCallback(() => {
    if (!completedBookingPrompt) return;
    blurActiveElementOnWeb();
    const bookingId = completedBookingPrompt.bookingId;
    setCompletedBookingPrompt(null);
    router.replace({
      pathname: "/booking-review",
      params: { bookingId, source: "completion" }
    });
  }, [blurActiveElementOnWeb, completedBookingPrompt]);

  if (!user) {
    return <Redirect href="/(auth)/role-selection" />;
  }

  if (user.role === "provider" && !user.onboardingCompleted) {
    return <Redirect href="/provider/onboarding" />;
  }

  if (user.role === "provider" && user.approvalStatus !== "Approved") {
    return <Redirect href="/provider/pending" />;
  }

  const provider = user.role === "provider";

  return (
    <>
      <Modal visible={user.role === "customer" && !!acceptedBookingPrompt && !pendingReviewBooking} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.64)", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <SurfaceCard style={{ width: "100%", maxWidth: 360, gap: 14, padding: 18 }}>
            <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 2 }}>
              <Animated.View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 20,
                  backgroundColor: theme.colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ translateY: acceptedIconFloat }]
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={30} color="#16A34A" />
              </Animated.View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.text, fontSize: 19, fontWeight: "900", textAlign: "center" }}>Worker accepted your booking</Text>
              {acceptedBookingPrompt ? (
                <>
                  {acceptedBookingProviderPhoto ? (
                    <Image
                      source={{ uri: acceptedBookingProviderPhoto }}
                      style={{ width: 64, height: 64, borderRadius: 22, alignSelf: "center", marginTop: 4, marginBottom: 2, backgroundColor: theme.colors.surfaceAlt }}
                      resizeMode="cover"
                    />
                  ) : null}
                  <Text style={{ color: theme.colors.primaryDark, fontWeight: "900", textAlign: "center", fontSize: 16 }}>
                    {acceptedBookingProviderName || "Your worker"}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, lineHeight: 20, textAlign: "center" }}>
                    {`accepted your booking for ${acceptedBookingPrompt.serviceName}. Please confirm what you want to do with this booking now.`}
                  </Text>
                </>
              ) : null}
            </View>
            {acceptedBookingPrompt ? (
              <View style={{ borderRadius: 16, padding: 12, backgroundColor: theme.colors.surfaceAlt, gap: 4 }}>
                <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{acceptedBookingPrompt.serviceName}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{acceptedBookingPrompt.scheduledAt}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={2}>
                  {acceptedBookingPrompt.address || acceptedBookingPrompt.location}
                </Text>
              </View>
            ) : null}
            {acceptancePromptError ? (
              <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: "700" }}>{acceptancePromptError}</Text>
            ) : null}
            <Pressable
              onPress={() => void handleAcceptedBookingConfirmation()}
              disabled={acceptancePromptBusy}
              style={{
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                backgroundColor: theme.colors.success,
                opacity: acceptancePromptBusy ? 0.7 : 1
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>{acceptancePromptBusy ? "Confirming..." : "Accept booking"}</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleAcceptedBookingCancellation()}
              disabled={acceptancePromptBusy}
              style={{
                borderRadius: 16,
                paddingVertical: 13,
                alignItems: "center",
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.danger
              }}
            >
              <Text style={{ color: theme.colors.danger, fontWeight: "900" }}>{acceptancePromptBusy ? "Cancelling..." : "Cancel booking"}</Text>
            </Pressable>
          </SurfaceCard>
        </View>
      </Modal>
      <Modal visible={user.role === "customer" && !!completedBookingPrompt && !acceptedBookingPrompt} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.64)", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <SurfaceCard style={{ width: "100%", maxWidth: 360, gap: 14, padding: 18 }}>
            <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 2 }}>
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 20,
                  backgroundColor: theme.colors.successSoft,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={30} color="#16A34A" />
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.text, fontSize: 19, fontWeight: "900", textAlign: "center" }}>Job completed</Text>
              {completedBookingProviderPhoto ? (
                <Image
                  source={{ uri: completedBookingProviderPhoto }}
                  style={{ width: 64, height: 64, borderRadius: 22, alignSelf: "center", marginTop: 4, marginBottom: 2, backgroundColor: theme.colors.surfaceAlt }}
                  resizeMode="cover"
                />
              ) : null}
              <Text style={{ color: theme.colors.primaryDark, fontWeight: "900", textAlign: "center", fontSize: 16 }}>
                {completedBookingProviderName || "Your worker"}
              </Text>
              <Text style={{ color: theme.colors.textMuted, lineHeight: 20, textAlign: "center" }}>
                {completedBookingPrompt
                  ? `${completedBookingProviderName || "Your worker"} finished the ${formatServiceLabel(completedBookingPrompt.serviceName)} job. Please leave feedback for the completed job.`
                  : ""}
              </Text>
            </View>
            {completedBookingPrompt ? (
              <View style={{ borderRadius: 16, padding: 12, backgroundColor: theme.colors.surfaceAlt, gap: 4 }}>
                <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{completedBookingPrompt.serviceName}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{completedBookingPrompt.scheduledAt}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={2}>
                  {completedBookingPrompt.address || completedBookingPrompt.location}
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={handleOpenCompletionFeedback}
              style={{
                borderRadius: 16,
                paddingVertical: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.colors.primary
              }}
            >
              <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900", fontSize: 14 }}>Leave feedback</Text>
            </Pressable>
          </SurfaceCard>
        </View>
      </Modal>
      <FullScreenPopup
        visible={!!acceptedBookingResultPopup}
        tone={acceptedBookingResultPopup?.tone || "success"}
        icon={acceptedBookingResultPopup?.tone === "info" ? "information-circle" : "checkmark-circle"}
        title={acceptedBookingResultPopup?.title || ""}
        message={acceptedBookingResultPopup?.message || ""}
        dismissLabel="Okay"
        onDismiss={() => setAcceptedBookingResultPopup(null)}
      />
      <Tabs
        key={`${mode}-${theme.dark ? "tabs-dark" : "tabs-light"}`}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.dark ? "#8EA6C6" : "#8A94A6",
          tabBarStyle: {
            height: 64 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 6,
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1
          },
          tabBarLabelStyle: { fontWeight: "700" },
          sceneStyle: { backgroundColor: theme.colors.background },
          freezeOnBlur: true,
          animation: "shift",
          lazy: true
        }}
      >
        <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={20} color={color} /> }} />
        <Tabs.Screen name="post" options={{ title: "News Feed", tabBarIcon: ({ color }) => <Ionicons name="newspaper-outline" size={20} color={color} /> }} />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            tabBarBadge: messageCount ? messageCount : undefined,
            tabBarIcon: ({ color }) => <Ionicons name="chatbubble-outline" size={20} color={color} />
          }}
        />
        <Tabs.Screen
          name="bookings"
          options={{
            href: provider ? null : undefined,
            title: "Bookings",
            tabBarBadge: !provider && jobCount ? jobCount : undefined,
            tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={20} color={color} />
          }}
        />
        <Tabs.Screen
          name="jobs"
          options={{
            href: provider ? undefined : null,
            title: "Bookings",
            tabBarBadge: provider && jobCount ? jobCount : undefined,
            tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={20} color={color} />
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            href: null,
            title: "Payments",
            tabBarBadge: !provider && notificationCount ? notificationCount : undefined,
            tabBarIcon: ({ color }) => <Ionicons name="card-outline" size={20} color={color} />
          }}
        />
        <Tabs.Screen
          name="earnings"
          options={{
            href: null,
            title: "Earnings",
            tabBarBadge: provider && notificationCount ? notificationCount : undefined,
            tabBarIcon: ({ color }) => <Ionicons name="wallet-outline" size={20} color={color} />
          }}
        />
        <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={20} color={color} /> }} />
      </Tabs>
    </>
  );
}
