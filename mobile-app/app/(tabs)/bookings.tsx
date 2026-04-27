import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import { bookingService, userService, type Booking, type ProviderProfile } from "@kabisig/shared";
import { AppHeader, Avatar, EmptyState, FixedScreen, SearchBar, StatusBadge, SurfaceCard } from "../../src/components";
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providersById, setProvidersById] = useState<Record<string, ProviderProfile>>({});
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]["key"]>("all");

  useEffect(() => {
    if (!user) return;
    const unsubscribe = bookingService.subscribeCustomerBookings(user.id, (items) => {
      const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setBookings(sorted);
      void (async () => {
        const providerProfiles = await Promise.all(sorted.map((booking) => userService.getProviderProfile(booking.providerId)));
        setProvidersById(
          Object.fromEntries(
            sorted.map((booking, index) => [booking.providerId, providerProfiles[index]]).filter((entry): entry is [string, ProviderProfile] => Boolean(entry[1]))
          )
        );
      })();
    });

    return unsubscribe;
  }, [user]);

  const filteredBookings = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesSearch =
        !normalized ||
        [booking.serviceName, booking.address, booking.status, booking.bookingId]
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
    <FixedScreen
      header={
        <>
          <AppHeader title="Bookings" />
        </>
      }
    >

      <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { label: "Upcoming", value: summary.upcoming, icon: "calendar-outline" },
            { label: "Active", value: summary.active, icon: "flash-outline" },
            { label: "Completed", value: summary.completed, icon: "checkmark-circle-outline" }
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, gap: 8 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: theme.colors.card,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={theme.colors.primaryDark} />
              </View>
              <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>{item.value}</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </SurfaceCard>

      <SearchBar placeholder="Search booking or service..." value={search} onChangeText={setSearch} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
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

      <View style={{ gap: 14 }}>
        {filteredBookings.map((booking) => (
          <Pressable
            key={booking.bookingId}
            onPress={() =>
              router.push({
                pathname: "/booking-detail",
                params: { bookingId: booking.bookingId }
              })
            }
          >
            <SurfaceCard style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Avatar image={providersById[booking.providerId]?.profilePhotoUrl} size={56} />

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 18 }}>{booking.serviceName}</Text>
                      <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>#{booking.bookingId.replace(/^booking-/, "")}</Text>
                    </View>
                    <StatusBadge status={booking.status} />
                  </View>
                  <Text style={{ color: theme.colors.primary, fontWeight: "800", marginTop: 8 }}>
                    {providersById[booking.providerId]?.displayName || providersById[booking.providerId]?.businessName || "Provider"}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
                    {providersById[booking.providerId]?.serviceCategories?.[0] || booking.serviceCategoryId}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 10 }}>
                {[
                  { icon: "calendar-outline", text: booking.scheduledAt },
                  { icon: "location-outline", text: booking.address || booking.location },
                  { icon: "cash-outline", text: `PHP ${booking.amount.toLocaleString()}` }
                ].map((item) => (
                  <View key={item.text} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={17} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.text, flex: 1 }}>{item.text}</Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: theme.colors.textMuted, fontWeight: "700" }}>{booking.serviceCategoryId}</Text>
                <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>View details</Text>
              </View>
            </SurfaceCard>
          </Pressable>
        ))}

        {!filteredBookings.length ? (
          <EmptyState
            title="No bookings yet"
            description="Once you submit a service request, booking updates and provider progress will appear here."
          />
        ) : null}
      </View>
    </FixedScreen>
  );
}
