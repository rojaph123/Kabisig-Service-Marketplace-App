import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
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
import { HeroHeader, Screen, SearchBar, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";
import { getServiceVisual } from "../../src/utils/services";

type ProviderCard = ProviderProfile & { userId: string };
type ActionItem = { label: string; icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string; route?: string };

const fallbackCategoryCopy: Record<string, { name: string; description: string }> = {
  electrician: {
    name: "Electrician",
    description: "Wiring, troubleshooting, installation, and electrical repairs."
  },
  plumber: {
    name: "Plumber",
    description: "Plumber for leaks, pipes, drainage, and sanitary fixes."
  },
  welder: {
    name: "Welder",
    description: "Metal works, railing repair, and fabrication support."
  },
  "construction-worker": {
    name: "Construction Worker",
    description: "General construction assistance and on-site labor support."
  },
  roofer: {
    name: "Roofer",
    description: "Roof repairs, weatherproofing, and installation support."
  }
};

const defaultAvailability = (enabled: boolean): AvailabilitySchedule[] => [
  { day: "Mon", start: "08:00", end: "17:00", available: enabled },
  { day: "Tue", start: "08:00", end: "17:00", available: enabled },
  { day: "Wed", start: "08:00", end: "17:00", available: enabled },
  { day: "Thu", start: "08:00", end: "17:00", available: enabled },
  { day: "Fri", start: "08:00", end: "17:00", available: enabled },
  { day: "Sat", start: "08:00", end: "12:00", available: enabled }
];

export default function HomeTab() {
  const { user } = useAuth();
  const provider = user?.role === "provider";
  const { width } = useWindowDimensions();
  const compactGrid = width < 430;
  const cardWidth = compactGrid ? "100%" : "47%";
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [featuredProviders, setFeaturedProviders] = useState<ProviderCard[]>([]);
  const [available, setAvailable] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    async function load() {
      if (!user) return;

      const [nextCategories, nextBookings, nextPayments, nextProviders, nextNotifications] = await Promise.all([
        categoryService.getAllCategories(),
        provider ? bookingService.getProviderBookings(user.id) : bookingService.getCustomerBookings(user.id),
        provider ? paymentService.getProviderEarnings(user.id) : paymentService.getCustomerPayments(user.id),
        providerService.getApprovedProviders(4),
        notificationService.getUserNotifications(user.id)
      ]);

      setCategories(
        nextCategories.slice(0, 5).map((category) => ({
          ...category,
          name: category.name || fallbackCategoryCopy[category.id]?.name || category.id.replace(/-/g, " "),
          description:
            category.description ||
            fallbackCategoryCopy[category.id]?.description ||
            "Professional local field service support."
        }))
      );
      setBookings(nextBookings);
      setPayments(nextPayments);
      setFeaturedProviders(nextProviders);
      setNotificationCount(nextNotifications.filter((item) => !item.isRead).length);

      if (provider) {
        const profile = await userService.getProviderProfile(user.id);
        setAvailable(Boolean(profile?.availability?.some((slot) => slot.available)));
      }
    }

    void load();
  }, [provider, user]);

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

  const customerActions: ActionItem[] = [
    { icon: "calendar-outline", label: "My Bookings", tint: "#0F766E", bg: "#D7F5EF", route: "/(tabs)/bookings" },
    { icon: "chatbubble-ellipses-outline", label: "Messages", tint: "#0369A1", bg: "#E0F2FE", route: "/(tabs)/messages" },
    { icon: "card-outline", label: "Payments", tint: "#F97316", bg: "#FFEDD5", route: "/(tabs)/payments" },
    { icon: "help-buoy-outline", label: "Support", tint: "#7C3AED", bg: "#F3E8FF", route: "/help" }
  ];

  const providerActions: ActionItem[] = [
    { icon: "briefcase-outline", label: "Job Queue", tint: "#0F766E", bg: "#D7F5EF", route: "/(tabs)/jobs" },
    { icon: "wallet-outline", label: "Earnings", tint: "#F97316", bg: "#FFEDD5", route: "/(tabs)/earnings" },
    { icon: "chatbubble-ellipses-outline", label: "Messages", tint: "#0369A1", bg: "#E0F2FE", route: "/(tabs)/messages" },
    { icon: "information-circle-outline", label: "Support", tint: "#7C3AED", bg: "#F3E8FF", route: "/help" }
  ];

  async function toggleAvailability() {
    if (!user || !provider) return;
    const nextAvailable = !available;
    setAvailable(nextAvailable);
    await userService.updateProviderProfile(user.id, {
      availability: defaultAvailability(nextAvailable)
    });
  }

  return (
    <Screen style={{ backgroundColor: theme.colors.background }}>
      <HeroHeader
        title={provider ? `Welcome back, ${user?.fullName.split(" ")[0] || "Provider"}` : `Hello, ${user?.fullName.split(" ")[0] || "there"}`}
        subtitle={provider ? "Run your workday with clearer scheduling, visibility, and client communication." : "Discover trusted local professionals and book the right service with confidence."}
        location="Malaybalay City, Bukidnon"
        onNotificationsPress={() => router.push("/notifications")}
        notificationCount={notificationCount}
      >
        {provider ? (
          <Pressable
            onPress={() => void toggleAvailability()}
            style={{
              marginTop: 14,
              flexDirection: compactGrid ? "column" : "row",
              alignItems: compactGrid ? "stretch" : "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              borderRadius: 18,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: "rgba(255,255,255,0.14)",
              rowGap: 12
            }}
          >
            <View style={{ flex: 1, minWidth: 180 }}>
              <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "800", fontSize: 16 }}>Availability</Text>
              <Text style={{ color: "rgba(255,255,255,0.76)", marginTop: 3 }}>
                {available ? "Visible to customers and accepting new work" : "Hidden from customer listings"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginLeft: compactGrid ? 0 : "auto", alignSelf: compactGrid ? "flex-end" : "auto" }}>
              <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "700" }}>{available ? "Online" : "Offline"}</Text>
              <View style={{ width: 48, height: 26, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.24)", justifyContent: "center", paddingHorizontal: 3 }}>
                <View style={{ alignSelf: available ? "flex-end" : "flex-start", width: 20, height: 20, borderRadius: 999, backgroundColor: "#fff" }} />
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={{ gap: 10 }}>
            <Pressable onPress={() => router.push("/providers")}>
              <SearchBar placeholder="Search service or provider..." />
            </Pressable>
            <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 12 }}>
              Notifications work while the app is active.
            </Text>
          </View>
        )}
      </HeroHeader>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {(provider
          ? [
              { label: "New Requests", value: bookingStats.pending, note: "Waiting for your response" },
              { label: "Active Jobs", value: bookingStats.progress + bookingStats.accepted, note: "Accepted or in progress" },
              { label: "Completed", value: bookingStats.completed, note: "Finished successfully" },
              { label: "Earnings", value: `PHP ${bookingStats.earnings.toLocaleString()}`, note: "Based on recorded payments" }
            ]
          : [
              { label: "Pending", value: bookingStats.pending, note: "Awaiting provider response" },
              { label: "Confirmed", value: bookingStats.accepted, note: "Accepted schedules" },
              { label: "In Progress", value: bookingStats.progress, note: "Work currently underway" },
              { label: "Spent", value: `PHP ${bookingStats.earnings.toLocaleString()}`, note: "Recorded service payments" }
            ]).map((item) => (
          <SurfaceCard key={item.label} style={{ width: cardWidth, gap: 6 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
            <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: "900" }}>{item.value}</Text>
            <Text style={{ color: theme.colors.textLight, fontSize: 12 }}>{item.note}</Text>
          </SurfaceCard>
        ))}
      </View>

      <View style={{ gap: 14 }}>
        <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>{provider ? "Operator tools" : "Book faster"}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {(provider ? providerActions : customerActions).map((item) => (
            <Pressable
              key={item.label}
              onPress={() => item.route && router.push(item.route as never)}
              style={{
                width: cardWidth,
                borderRadius: 24,
                padding: 18,
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.border,
                gap: 14,
                ...theme.shadow
              }}
            >
              <View style={{ width: 50, height: 50, borderRadius: 18, backgroundColor: item.bg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={item.icon} size={22} color={item.tint} />
              </View>
              <View>
                <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{item.label}</Text>
                <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 12 }}>
                  {provider ? "Jump straight into the next operational task." : "Move quickly through the most common customer actions."}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {!provider ? (
        <>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>Popular services</Text>
              <Pressable onPress={() => router.push("/category")}>
                <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>View all</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {categories.map((category) => {
                const visual = getServiceVisual(category.name, category.icon);
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => router.push({ pathname: "/booking-request", params: { categoryId: category.id } })}
                    style={{
                      width: cardWidth,
                      borderRadius: 24,
                      padding: 18,
                      backgroundColor: theme.colors.card,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      gap: 12,
                      ...theme.shadow
                    }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: visual.bg }}>
                      <Ionicons name={visual.icon} size={22} color={visual.tint} />
                    </View>
                    <View>
                      <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{category.name}</Text>
                      <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 12 }}>{category.description}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>Available providers</Text>
              <Pressable onPress={() => router.push("/providers")}>
                <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>View all</Text>
              </Pressable>
            </View>
            {featuredProviders.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
              {featuredProviders.map((providerCard) => {
                const serviceVisual = getServiceVisual(providerCard.serviceCategories[0] || "General");
                return (
                  <Pressable
                    key={providerCard.userId}
                    onPress={() => router.push({ pathname: "/provider-detail", params: { userId: providerCard.userId } })}
                    style={{
                      width: Math.min(width * 0.82, 330),
                      borderRadius: 26,
                      padding: 18,
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
                          <Text style={{ color: theme.colors.textMuted }}>
                            {providerCard.serviceCategories.join(", ") || "General service"}
                          </Text>
                        </View>
                      </View>

                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <Text style={{ color: theme.colors.accent, fontWeight: "800" }}>★ {providerCard.rating?.toFixed(1) || "New"}</Text>
                        <Text style={{ color: theme.colors.success, fontSize: 12, fontWeight: "800" }}>Available</Text>
                      </View>
                    </View>
                    <Text style={{ color: theme.colors.textMuted }} numberOfLines={2}>{providerCard.bio || "Professional local service provider."}</Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: theme.colors.textLight, fontSize: 12 }}>{providerCard.city || "Service area coming soon"}</Text>
                      <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>Book now</Text>
                    </View>
                  </Pressable>
                );
              })}
              </ScrollView>
            ) : (
              <SurfaceCard>
                <Text style={{ color: theme.colors.textMuted }}>
                  Available approved providers will appear here after the admin reviews their applications and they switch availability on.
                </Text>
              </SurfaceCard>
            )}
          </View>
        </>
      ) : (
        <SurfaceCard style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "900" }}>Marketplace visibility</Text>
          <Text style={{ color: theme.colors.textMuted, lineHeight: 21 }}>
            When you toggle availability on, customers can discover you in provider listings and use your working schedule when requesting bookings.
          </Text>
          <Text style={{ color: theme.colors.textLight, fontSize: 12 }}>
            Tip: keep your working days and profile details updated in Profile so customers can book only valid slots.
          </Text>
        </SurfaceCard>
      )}
    </Screen>
  );
}
