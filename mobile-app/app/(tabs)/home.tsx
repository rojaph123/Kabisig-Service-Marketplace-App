import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Image, Platform, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  bookingService,
  categoryService,
  notificationService,
  paymentService,
  providerService,
  userService,
  type AvailabilitySchedule,
  type Booking,
  type Payment,
  type ProviderProfile,
  type ServiceCategory
} from "@kabisig/shared";
import { Avatar, HeroHeader, SearchBar, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";
import { formatProviderStartingRate } from "../../src/utils/rates";
import { getServiceVisual } from "../../src/utils/services";

type ProviderCard = ProviderProfile & { userId: string };
type ActionItem = { label: string; icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string; route?: string; summary: string };
type HomeStatItem = {
  label: string;
  value: string | number;
  note: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
};

const defaultAvailability = (enabled: boolean): AvailabilitySchedule[] => [
  { day: "Mon", start: "08:00", end: "17:00", available: enabled },
  { day: "Tue", start: "08:00", end: "17:00", available: enabled },
  { day: "Wed", start: "08:00", end: "17:00", available: enabled },
  { day: "Thu", start: "08:00", end: "17:00", available: enabled },
  { day: "Fri", start: "08:00", end: "17:00", available: enabled },
  { day: "Sat", start: "08:00", end: "12:00", available: enabled }
];

function getFirstName(name?: string) {
  return name?.trim().split(/\s+/)[0] || "there";
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour === 12) return "Good noon";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function isCoordinateLocation(value?: string) {
  return Boolean(value?.trim().match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/));
}

function getReadableCustomerAddress(profile: Awaited<ReturnType<typeof userService.getCustomerProfile>>) {
  if (profile?.defaultLocation && !isCoordinateLocation(profile.defaultLocation)) return profile.defaultLocation;
  const savedAddress = profile?.addresses?.find((address) => !isCoordinateLocation(address));
  if (savedAddress) return savedAddress;
  return profile?.addresses?.[0] || "";
}

function parseBookingSchedule(booking: Booking) {
  if (!booking.scheduledDate || !booking.scheduledTime) return null;
  const match = booking.scheduledTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const [, hourValue, minuteValue, suffix] = match;
  let hour = Number(hourValue) % 12;
  if (suffix.toUpperCase() === "PM") hour += 12;
  const scheduledAt = new Date(`${booking.scheduledDate}T00:00:00`);
  scheduledAt.setHours(hour, Number(minuteValue), 0, 0);
  return Number.isFinite(scheduledAt.getTime()) ? scheduledAt : null;
}

async function ensureUpcomingJobReminderNotifications(userId: string, bookings: Booking[], existingNotificationRoutes: Set<string>) {
  const now = new Date();
  const reminderWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcomingJobs = bookings.filter((booking) => {
    if (!["Accepted", "On the Way", "In Progress"].includes(booking.status)) return false;
    const scheduledAt = parseBookingSchedule(booking);
    return Boolean(scheduledAt && scheduledAt > now && scheduledAt <= reminderWindowEnd);
  });

  await Promise.all(
    upcomingJobs.map(async (booking) => {
      const route = `/booking-detail?bookingId=${booking.bookingId}`;
      const key = `upcoming_job_reminder:${route}`;
      if (existingNotificationRoutes.has(key)) return;
      existingNotificationRoutes.add(key);
      await notificationService.createNotification({
        userId,
        type: "upcoming_job_reminder",
        title: "Upcoming job reminder",
        body: `${booking.serviceName} is scheduled soon on ${booking.scheduledAt}. Please review the details and prepare before you leave.`,
        isRead: false,
        route,
        createdAt: new Date().toISOString()
      });
    })
  );
}

export default function HomeTab() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const provider = user?.role === "provider";
  const { width } = useWindowDimensions();
  const cardWidth = "47%";
  const statCardWidth = Math.max(78, (width - theme.spacing.lg * 2 - 24) / 4);
  const statCardMinHeight = 102;
  const serviceCardWidth = Math.min(Math.max(84, width * 0.23), 96);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [featuredProviders, setFeaturedProviders] = useState<ProviderCard[]>([]);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [available, setAvailable] = useState(false);
  const [homeLocation, setHomeLocation] = useState("");
  const [homeSearch, setHomeSearch] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const heroLift = scrollY.interpolate({ inputRange: [0, 180], outputRange: [0, -8], extrapolate: "clamp" });
  const heroOpacity = scrollY.interpolate({ inputRange: [0, 220], outputRange: [1, 0.94], extrapolate: "clamp" });
  const statsLift = scrollY.interpolate({ inputRange: [0, 160], outputRange: [0, -6], extrapolate: "clamp" });
  const statsScale = scrollY.interpolate({ inputRange: [0, 160], outputRange: [1, 0.97], extrapolate: "clamp" });
  const lowerLift = scrollY.interpolate({ inputRange: [0, 260], outputRange: [20, 0], extrapolate: "clamp" });
  const lowerOpacity = scrollY.interpolate({ inputRange: [0, 180], outputRange: [0.88, 1], extrapolate: "clamp" });

  const load = useCallback(async () => {
    if (!user) return;

    const [nextCategories, nextBookings, nextPayments, nextProviders, nextNotifications] = await Promise.all([
      categoryService.getAllCategories(),
      provider ? bookingService.getProviderBookings(user.id) : bookingService.getCustomerBookings(user.id),
      provider ? paymentService.getProviderEarnings(user.id) : paymentService.getCustomerPayments(user.id),
      providerService.getApprovedProviders(4),
      notificationService.getUserNotifications(user.id)
    ]);

    setCategories(
      nextCategories.map((category) => ({
        ...category,
        name: category.name || category.id.replace(/-/g, " "),
        description: category.description || "Professional local field service support."
      }))
    );
    setBookings(nextBookings);
    setPayments(nextPayments);
    setFeaturedProviders(nextProviders);
    setNotificationCount(nextNotifications.filter((item) => !item.isRead).length);

    if (provider) {
      const existingNotificationRoutes = new Set(
        nextNotifications.map((item) => `${item.type}:${item.route || item.notificationId}`)
      );
      await ensureUpcomingJobReminderNotifications(user.id, nextBookings, existingNotificationRoutes);
      const profile = await userService.getProviderProfile(user.id);
      setProviderProfile(profile);
      setAvailable(Boolean(profile?.availability?.some((slot) => slot.available)));
      setHomeLocation(profile?.serviceAreas?.length ? profile.serviceAreas.join(", ") : profile?.city || profile?.address || "");
    } else {
      setProviderProfile(null);
      const profile = await userService.getCustomerProfile(user.id);
      setHomeLocation(getReadableCustomerAddress(profile));
    }
  }, [provider, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    return notificationService.subscribeUserNotifications(user.id, (items) => {
      setNotificationCount(items.filter((item) => !item.isRead).length);
    });
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const bookingStats = useMemo(
    () => ({
      pending: bookings.filter((booking) => booking.status === "Pending").length,
      accepted: bookings.filter((booking) => booking.status === "Accepted").length,
      progress: bookings.filter((booking) => booking.status === "In Progress" || booking.status === "On the Way").length,
      completed: bookings.filter((booking) => booking.status === "Completed").length,
      earnings: payments.reduce((sum, payment) => sum + payment.amount, 0)
    }),
    [bookings, payments]
  );
  const workerFirstName = getFirstName(user?.fullName || providerProfile?.displayName);
  const workerDisplayName = providerProfile?.displayName || user?.fullName || workerFirstName;
  const workerRating = providerProfile?.rating ? providerProfile.rating.toFixed(1) : "New";
  const workerPhoto = providerProfile?.profilePhotoUrl || user?.profilePhoto || "";
  const workerServices = providerProfile?.serviceCategories?.filter(Boolean) || [];
  const greeting = getTimeGreeting();
  const workerTypeLabel = workerServices[0] || "Skilled Worker";

  const homeStats: HomeStatItem[] = provider
    ? [
        {
          label: "New Requests",
          value: bookingStats.pending,
          note: "Waiting for your response",
          icon: "notifications-outline",
          tint: "#2563EB",
          bg: "#DBEAFE"
        },
        {
          label: "Active Jobs",
          value: bookingStats.progress + bookingStats.accepted,
          note: "Accepted or in progress",
          icon: "briefcase-outline",
          tint: "#0F766E",
          bg: "#CCFBF1"
        },
        {
          label: "Completed",
          value: bookingStats.completed,
          note: "Finished successfully",
          icon: "checkmark-done-circle-outline",
          tint: "#16A34A",
          bg: "#DCFCE7"
        },
        {
          label: "Earnings",
          value: `₱${bookingStats.earnings.toLocaleString()}`,
          note: "Recorded payments",
          icon: "wallet-outline",
          tint: "#EA580C",
          bg: "#FFEDD5"
        }
      ]
    : [
        {
          label: "New Requests",
          value: bookingStats.pending,
          note: "Awaiting worker response",
          icon: "sparkles-outline",
          tint: "#7C3AED",
          bg: "#F3E8FF"
        },
        {
          label: "Active Jobs",
          value: bookingStats.progress + bookingStats.accepted,
          note: "Confirmed or underway",
          icon: "construct-outline",
          tint: "#0891B2",
          bg: "#CFFAFE"
        },
        {
          label: "Completed",
          value: bookingStats.completed,
          note: "Services finished",
          icon: "checkmark-circle-outline",
          tint: "#16A34A",
          bg: "#DCFCE7"
        },
        {
          label: "Payments",
          value: `₱${bookingStats.earnings.toLocaleString()}`,
          note: "Total paid",
          icon: "receipt-outline",
          tint: "#F97316",
          bg: "#FFEDD5"
        }
      ];

  const providerActions: ActionItem[] = [
    {
      icon: "briefcase-outline",
      label: "Job Queue",
      tint: "#0F766E",
      bg: "#D7F5EF",
      route: "/(tabs)/jobs",
      summary: `${bookingStats.pending} new and ${bookingStats.progress + bookingStats.accepted} active`
    },
    {
      icon: "chatbubble-ellipses-outline",
      label: "Messages",
      tint: "#0369A1",
      bg: "#E0F2FE",
      route: "/(tabs)/messages",
      summary: "Open chats with your customers"
    },
    {
      icon: "information-circle-outline",
      label: "Support",
      tint: "#7C3AED",
      bg: "#F3E8FF",
      route: "/help",
      summary: "Get help with bookings and account issues"
    },
    {
      icon: "wallet-outline",
      label: "Earnings",
      tint: "#EA580C",
      bg: "#FFEDD5",
      route: "/(tabs)/earnings",
      summary: `₱${bookingStats.earnings.toLocaleString()} recorded`
    }
  ];

  async function toggleAvailability() {
    if (!user || !provider) return;
    const nextAvailable = !available;
    setAvailable(nextAvailable);
    await userService.updateProviderProfile(user.id, {
      availability: defaultAvailability(nextAvailable)
    });
  }

  function openWorkerSearch(query = homeSearch) {
    const nextQuery = query.trim();
    router.push(nextQuery ? { pathname: "/providers", params: { q: nextQuery } } : "/providers");
  }

  const searchSuggestions = useMemo(() => {
    const normalized = homeSearch.trim().toLowerCase();
    if (!normalized) return [];

    const serviceMatches = categories
      .filter((category) => (category.name || category.id).toLowerCase().startsWith(normalized))
      .map((category) => ({
        id: `service-${category.id}`,
        label: category.name || category.id,
        summary: "Service",
        icon: "construct-outline" as const,
        onPress: () => router.push({ pathname: "/providers", params: { categoryId: category.id, categoryName: category.name } })
      }));
    const workerMatches = featuredProviders
      .filter((providerCard) =>
        [providerCard.displayName, providerCard.businessName, ...providerCard.serviceCategories]
          .filter(Boolean)
          .some((value) => value.toLowerCase().startsWith(normalized))
      )
      .map((providerCard) => ({
        id: `worker-${providerCard.userId}`,
        label: providerCard.displayName,
        summary: providerCard.serviceCategories[0] ? `Worker • ${providerCard.serviceCategories[0]}` : "Worker",
        icon: "person-outline" as const,
        onPress: () => router.push({ pathname: "/provider-detail", params: { userId: providerCard.userId } })
      }));

    return [...serviceMatches, ...workerMatches].slice(0, 5);
  }, [categories, featuredProviders, homeSearch]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Animated.ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.xl + Math.max(insets.bottom, 8),
          gap: 12
        }}
        bounces={false}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== "web" })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
      >
      <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroLift }] }}>
        <HeroHeader
          title={provider ? `Hi! ${greeting}` : `${greeting}, ${getFirstName(user?.fullName)}`}
          subtitle={provider ? "Manage your incoming requests and active jobs." : "Discover trusted local professionals and book the right service with confidence."}
          location={homeLocation || "Set your location"}
          onNotificationsPress={() => router.push("/notifications")}
          notificationCount={notificationCount}
        >
          {provider ? (
            <View style={{ gap: 12, marginTop: 14 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 12,
                  borderRadius: 18,
                  padding: 12,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.14)"
                }}
              >
                <Avatar image={workerPhoto} size={68} icon="briefcase-outline" accentColor="#0A6FCA" />
                <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: "800" }}>{workerTypeLabel}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 3 }}>
                        <Text
                          style={{ color: theme.colors.textOnPrimary, fontSize: 19, fontWeight: "900", flexShrink: 1 }}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.72}
                        >
                          {workerFirstName === "there" ? workerDisplayName : workerFirstName}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: "rgba(255,255,255,0.18)" }}>
                          <Ionicons name="star" size={13} color="#FACC15" />
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>{workerRating}</Text>
                        </View>
                      </View>
                    </View>
                    <Pressable onPress={() => void toggleAvailability()} style={{ alignItems: "center", gap: 7, flexShrink: 0 }}>
                      <Text
                        style={{ color: theme.colors.textOnPrimary, fontWeight: "800", fontSize: 12, textAlign: "right" }}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {available ? "Online" : "Offline"}
                      </Text>
                      <View style={{ width: 52, height: 30, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.26)", justifyContent: "center", paddingHorizontal: 3 }}>
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 999,
                            backgroundColor: "#fff",
                            transform: [{ translateX: available ? 22 : 0 }]
                          }}
                        />
                      </View>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <SearchBar
                placeholder="Search workers or services..."
                value={homeSearch}
                onChangeText={setHomeSearch}
                onSubmitEditing={() => openWorkerSearch()}
                compact
              />
              {homeSearch.trim() ? (
                <View style={{ borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
                  {searchSuggestions.length ? (
                    searchSuggestions.map((suggestion) => (
                      <Pressable
                        key={suggestion.id}
                        onPress={suggestion.onPress}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderBottomWidth: suggestion.id === searchSuggestions[searchSuggestions.length - 1].id ? 0 : 1,
                          borderBottomColor: "rgba(255,255,255,0.12)"
                        }}
                      >
                        <Ionicons name={suggestion.icon} size={15} color="#fff" />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }} numberOfLines={1}>
                            {suggestion.label}
                          </Text>
                          <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                            {suggestion.summary}
                          </Text>
                        </View>
                      </Pressable>
                    ))
                  ) : (
                    <Pressable onPress={() => openWorkerSearch()} style={{ paddingHorizontal: 12, paddingVertical: 9 }}>
                      <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "800" }}>Search marketplace</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </View>
          )}
        </HeroHeader>
      </Animated.View>

      {provider ? (
        <Animated.View style={{ gap: 12, marginTop: -2, opacity: heroOpacity, transform: [{ translateY: statsLift }, { scale: statsScale }] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Dashboard</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}>
            {homeStats.slice(0, 3).map((item) => (
              <SurfaceCard
                key={item.label}
                style={{
                  flex: 1,
                  minHeight: statCardMinHeight,
                  gap: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 12,
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border
                }}
              >
                <View style={{ gap: 7, alignItems: "center" }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 12,
                      backgroundColor: item.bg,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Ionicons name={item.icon} size={16} color={item.tint} />
                  </View>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: 10,
                      fontWeight: "800",
                      lineHeight: 13,
                      textAlign: "center"
                    }}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.76}
                  >
                    {item.label}
                  </Text>
                </View>
                <View style={{ minWidth: 0 }}>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: 16,
                      fontWeight: "900",
                      textAlign: "center"
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {item.value}
                  </Text>
                </View>
              </SurfaceCard>
            ))}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Quick actions</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {providerActions.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => item.route && router.push(item.route as never)}
                style={{
                  width: cardWidth,
                  minHeight: 118,
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  gap: 12,
                  ...theme.shadow
                }}
              >
                <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: item.bg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={item.icon} size={22} color={item.tint} />
                </View>
                <View style={{ minWidth: 0 }}>
                  <Text
                    style={{ color: theme.colors.text, fontWeight: "800" }}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 12, lineHeight: 16 }}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                  >
                    {item.summary}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {!provider ? (
        <>
          <Animated.View style={{ gap: 12, marginTop: -2, opacity: lowerOpacity, transform: [{ translateY: lowerLift }] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Services</Text>
              <Pressable onPress={() => router.push("/category")} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 12 }}>See all</Text>
                <Ionicons name="chevron-forward" size={13} color={theme.colors.primary} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
              {categories.map((category) => {
                const visual = getServiceVisual(category.name, category.icon);
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => router.push({ pathname: "/providers", params: { categoryId: category.id, categoryName: category.name } })}
                    style={{
                      width: serviceCardWidth,
                      minHeight: 88,
                      borderRadius: 18,
                      paddingHorizontal: 9,
                      paddingVertical: 12,
                      backgroundColor: theme.dark ? theme.colors.card : "#FFFFFF",
                      gap: 8,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: visual.bg }}>
                      <Ionicons name={visual.icon} size={16} color={visual.tint} />
                    </View>
                    <View style={{ minWidth: 0, alignItems: "center" }}>
                      <Text
                        style={{ color: theme.colors.text, fontWeight: "800", fontSize: 10, lineHeight: 13, textAlign: "center" }}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.78}
                      >
                        {category.name}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          <Animated.View style={{ gap: 12, marginTop: 22, opacity: heroOpacity, transform: [{ translateY: statsLift }, { scale: statsScale }] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Dashboard</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}>
              {homeStats.slice(0, 3).map((item) => (
                <SurfaceCard
                  key={item.label}
                  style={{
                    flex: 1,
                    width: statCardWidth,
                    minHeight: statCardMinHeight,
                    gap: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 12,
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border
                  }}
                >
                  <View
                    style={{
                      gap: 7,
                      alignItems: "center"
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 12,
                        backgroundColor: item.bg,
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Ionicons name={item.icon} size={16} color={item.tint} />
                    </View>
                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: 10,
                        fontWeight: "800",
                        lineHeight: 13,
                        textAlign: "center"
                      }}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.76}
                    >
                      {item.label}
                    </Text>
                  </View>
                  <View style={{ minWidth: 0 }}>
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: 16,
                        fontWeight: "900",
                        textAlign: "center"
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {item.value}
                    </Text>
                  </View>
                </SurfaceCard>
              ))}
            </View>
          </Animated.View>

          <Animated.View style={{ gap: 12, marginTop: 14, opacity: lowerOpacity, transform: [{ translateY: lowerLift }] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Available skilled workers</Text>
              <Pressable onPress={() => router.push("/providers")} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 12 }}>See all</Text>
                <Ionicons name="chevron-forward" size={13} color={theme.colors.primary} />
              </Pressable>
            </View>
            {featuredProviders.length ? (
              <View style={{ gap: 12 }}>
              {featuredProviders.map((providerCard) => {
                const serviceVisual = getServiceVisual(providerCard.serviceCategories[0] || "General");
                return (
                  <Pressable
                    key={providerCard.userId}
                    onPress={() => router.push({ pathname: "/provider-detail", params: { userId: providerCard.userId } })}
                    style={{
                      width: "100%",
                      borderRadius: 20,
                      padding: 14,
                      minHeight: 158,
                      backgroundColor: theme.colors.card,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      gap: 10,
                      ...theme.shadow
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      {providerCard.profilePhotoUrl ? (
                        <Image
                          source={{ uri: providerCard.profilePhotoUrl }}
                          style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: theme.colors.surfaceAlt }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.primarySoft }}>
                          <Ionicons name="person-outline" size={28} color={theme.colors.primaryDark} />
                        </View>
                      )}

                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 17 }}>{providerCard.displayName}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 10,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: serviceVisual.bg
                            }}
                          >
                            <Ionicons name={serviceVisual.icon} size={15} color={serviceVisual.tint} />
                          </View>
                          <Text style={{ color: theme.colors.textMuted, flex: 1 }} numberOfLines={1}>
                            {providerCard.serviceCategories.join(", ") || "General service"}
                          </Text>
                        </View>
                      </View>

                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <Text style={{ color: theme.colors.accent, fontWeight: "800" }}>★ {providerCard.rating?.toFixed(1) || "New"}</Text>
                        <Text style={{ color: theme.colors.success, fontSize: 12, fontWeight: "800" }}>Available</Text>
                      </View>
                    </View>
                    <Text style={{ color: theme.colors.textMuted, minHeight: 38 }} numberOfLines={2}>{providerCard.bio || "Professional local skilled worker."}</Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: theme.colors.textLight, fontSize: 12, flex: 1 }} numberOfLines={1}>{providerCard.city || "Service area coming soon"}</Text>
                      <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>{formatProviderStartingRate(providerCard, categories)}</Text>
                    </View>
                  </Pressable>
                );
              })}
              </View>
            ) : (
              <SurfaceCard>
                <Text style={{ color: theme.colors.textMuted }}>
                  Available approved workers will appear here after the admin reviews their applications and they switch availability on.
                </Text>
              </SurfaceCard>
            )}
          </Animated.View>
        </>
      ) : (
        <Animated.View style={{ opacity: lowerOpacity, transform: [{ translateY: lowerLift }] }}>
        <SurfaceCard style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "900" }}>Marketplace visibility</Text>
          <Text style={{ color: theme.colors.textMuted, lineHeight: 21 }}>
            When you toggle availability on, customers can discover you in worker listings and use your working schedule when requesting bookings.
          </Text>
          <Text style={{ color: theme.colors.textLight, fontSize: 12 }}>
            Tip: keep your working days and profile details updated in Profile so customers can book only valid slots.
          </Text>
        </SurfaceCard>
        </Animated.View>
      )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
