import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { bookingService, formatBookingReference, userService, type Booking, type ProviderProfile } from "@kabisig/shared";
import { AppHeader, Avatar, EmptyState, SearchBar, StatusBadge, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";

const filters = [
  { key: "all", label: "All" },
  { key: "Upcoming", label: "Upcoming" },
  { key: "Ongoing", label: "Ongoing" },
  { key: "Completed", label: "Completed" },
  { key: "Cancelled", label: "Cancelled" }
] as const;

function matchesFilter(booking: Booking, filter: (typeof filters)[number]["key"]) {
  if (filter === "all") return true;
  if (filter === "Upcoming") return booking.status === "Pending" || booking.status === "Accepted";
  if (filter === "Ongoing") return booking.status === "On the Way" || booking.status === "In Progress";
  return booking.status === filter;
}

export default function BookingsTab() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providersById, setProvidersById] = useState<Record<string, ProviderProfile>>({});
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [refreshing, setRefreshing] = useState(false);

  const hydrateBookings = useCallback(async (items: Booking[]) => {
    setBookings(items);
    const providerIds = [...new Set(items.map((booking) => booking.providerId).filter(Boolean))];
    const providerProfiles = await Promise.all(providerIds.map((providerId) => userService.getProviderProfile(providerId)));
    setProvidersById(
      Object.fromEntries(
        providerIds.map((providerId, index) => [providerId, providerProfiles[index]]).filter((entry): entry is [string, ProviderProfile] => Boolean(entry[1]))
      )
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = bookingService.subscribeCustomerBookings(user.id, (items) => {
      void hydrateBookings(items);
    });

    return unsubscribe;
  }, [hydrateBookings, user]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await hydrateBookings(await bookingService.getCustomerBookings(user.id));
    } finally {
      setRefreshing(false);
    }
  }, [hydrateBookings, user]);

  const filteredBookings = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesSearch =
        !normalized ||
        [booking.serviceName, booking.address, booking.status, booking.bookingId, formatBookingReference(booking)]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesSearch && matchesFilter(booking, activeFilter);
    });
  }, [activeFilter, bookings, search]);

  const summary = useMemo(
    () => ({
      upcoming: bookings.filter((item) => item.status === "Pending" || item.status === "Accepted").length,
      active: bookings.filter((item) => item.status === "On the Way" || item.status === "In Progress").length,
      completed: bookings.filter((item) => item.status === "Completed").length
    }),
    [bookings]
  );
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
        <AppHeader
          title="Bookings"
          action={
            <Pressable
              onPress={() => setSearchOpen((current) => !current)}
              style={{
                width: 42,
                height: 42,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: searchOpen ? theme.colors.primary : theme.colors.card,
                borderWidth: 1,
                borderColor: searchOpen ? theme.colors.primary : theme.colors.border
              }}
            >
              <Ionicons name={searchOpen ? "close-outline" : "search-outline"} size={20} color={searchOpen ? "#fff" : theme.colors.text} />
            </Pressable>
          }
        />
      </View>

      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 10,
          gap: 8,
          zIndex: 5,
          backgroundColor: theme.colors.background
        }}
      >
        <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt, gap: 8, padding: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { label: "Upcoming", value: summary.upcoming, icon: "calendar-outline" },
              { label: "Active", value: summary.active, icon: "flash-outline" },
              { label: "Completed", value: summary.completed, icon: "checkmark-circle-outline" }
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <View style={{ width: 30, height: 30, borderRadius: 11, backgroundColor: theme.colors.card, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color={theme.colors.primaryDark} />
                </View>
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>{item.value}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: "800" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </SurfaceCard>

        {searchOpen ? (
          <SearchBar placeholder="Search booking or service..." value={search} onChangeText={setSearch} />
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          {filters.map((filter) => {
            const active = activeFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: active ? theme.colors.primary : theme.colors.card,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border
                }}
              >
                <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800", fontSize: 12 }}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filteredBookings}
        keyExtractor={(booking) => booking.bookingId}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl + Math.max(insets.bottom, 8), gap: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        alwaysBounceVertical={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        renderItem={({ item: booking }) => (
            <Pressable
              key={booking.bookingId}
              onPress={() =>
                router.push({
                  pathname: "/booking-detail",
                  params: { bookingId: booking.bookingId }
                })
              }
            >
              <SurfaceCard style={{ gap: 12, padding: 13 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Avatar image={providersById[booking.providerId]?.profilePhotoUrl} size={50} />

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 16 }}>{booking.serviceName}</Text>
                        <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12 }}>{formatBookingReference(booking)}</Text>
                      </View>
                      <StatusBadge status={booking.status} />
                    </View>
                    <Text style={{ color: theme.colors.primary, fontWeight: "800", marginTop: 6, fontSize: 13 }}>
                      {providersById[booking.providerId]?.displayName || providersById[booking.providerId]?.businessName || "Provider"}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, marginTop: 2, fontSize: 12 }}>
                      {providersById[booking.providerId]?.serviceCategories?.[0] || booking.serviceCategoryId}
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  {[
                    { icon: "calendar-outline", text: booking.scheduledAt },
                    { icon: "location-outline", text: booking.address || booking.location },
                    { icon: "cash-outline", text: `₱${booking.amount.toLocaleString()}` }
                  ].map((item) => (
                    <View key={item.text} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color={theme.colors.primary} />
                      <Text style={{ color: theme.colors.text, flex: 1, fontSize: 13 }}>{item.text}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.colors.textMuted, fontWeight: "700", fontSize: 12 }}>{booking.serviceCategoryId}</Text>
                  {booking.status === "Completed" ? (
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        router.push({
                          pathname: "/booking-request",
                          params: { providerId: booking.providerId, categoryId: booking.serviceCategoryId }
                        });
                      }}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 11,
                        paddingVertical: 7,
                        backgroundColor: theme.colors.primary
                      }}
                    >
                      <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900", fontSize: 11 }}>Book Again</Text>
                    </Pressable>
                  ) : (
                    <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 12 }}>View details</Text>
                  )}
                </View>
              </SurfaceCard>
            </Pressable>
        )}
        ListEmptyComponent={
            <EmptyState
              title="No bookings yet"
              description="Once you submit a service request, booking updates and provider progress will appear here."
              actionLabel="Book a service"
              onAction={() => router.push("/category")}
              icon="calendar-outline"
            />
        }
      />
    </SafeAreaView>
  );
}
