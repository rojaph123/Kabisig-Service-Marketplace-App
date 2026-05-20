import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { bookingService, formatBookingReference, userService, type Booking, type User } from "@kabisig/shared";
import { AppHeader, Avatar, EmptyState, SearchBar, StatusBadge, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";

const filters = ["All", "New Requests", "Accepted", "On the Way", "In Progress", "Completed", "Cancelled"] as const;

function matchesJobFilter(job: Booking, active: (typeof filters)[number]) {
  if (active === "All") return true;
  if (active === "New Requests") return job.status === "Pending";
  return job.status === active;
}

function jobProgress(status: Booking["status"]) {
  if (status === "Pending") return 16;
  if (status === "Accepted") return 38;
  if (status === "On the Way") return 58;
  if (status === "In Progress") return 82;
  if (status === "Completed") return 100;
  return 0;
}

function formatJobType(serviceName?: string) {
  const normalized = serviceName?.trim().toLowerCase();
  if (!normalized) return "Service";

  const serviceLabels: Record<string, string> = {
    electrician: "Electrical work",
    plumber: "Plumbing",
    welder: "Welding",
    carpenter: "Carpentry",
    "tile setter": "Tile setting",
    roofer: "Roofing",
    painter: "Painting",
    "car mechanic": "Car repair",
    "motor mechanic": "Motorcycle repair",
    "aircon repair": "Aircon repair"
  };

  return serviceLabels[normalized] || serviceName;
}

export default function JobsTab() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("All");
  const [refreshing, setRefreshing] = useState(false);

  const hydrateJobs = useCallback(async (items: Booking[]) => {
    setJobs(items);
    const users = await userService.getUsersByIds([...new Set(items.map((job) => job.customerId).filter(Boolean))]);
    setUsersById(Object.fromEntries(users.map((entry) => [entry.id, entry])));
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = bookingService.subscribeProviderBookings(user.id, (items) => {
      void hydrateJobs(items);
    });

    return unsubscribe;
  }, [hydrateJobs, user]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await hydrateJobs(await bookingService.getProviderBookings(user.id));
    } finally {
      setRefreshing(false);
    }
  }, [hydrateJobs, user]);

  const filteredJobs = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch =
        !normalized ||
        [job.serviceName, job.address, job.status, job.bookingId, formatBookingReference(job), usersById[job.customerId]?.fullName]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesSearch && matchesJobFilter(job, activeFilter);
    });
  }, [activeFilter, jobs, search, usersById]);

  const summary = useMemo(
    () => ({
      requests: jobs.filter((job) => job.status === "Pending").length,
      active: jobs.filter((job) => job.status === "Accepted" || job.status === "On the Way" || job.status === "In Progress").length,
      done: jobs.filter((job) => job.status === "Completed").length
    }),
    [jobs]
  );
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
        <AppHeader
          title="Jobs"
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
              { label: "Requests", value: summary.requests, icon: "mail-unread-outline" },
              { label: "Active", value: summary.active, icon: "construct-outline" },
              { label: "Done", value: summary.done, icon: "checkmark-done-outline" }
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
          <SearchBar placeholder="Search request or address..." value={search} onChangeText={setSearch} />
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          {filters.map((filter) => {
            const active = activeFilter === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: active ? theme.colors.primary : theme.colors.card,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border
                }}
              >
                <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800", fontSize: 12 }}>{filter}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filteredJobs}
        keyExtractor={(job) => job.bookingId}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl + Math.max(insets.bottom, 8), gap: 10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        alwaysBounceVertical={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        renderItem={({ item: job }) => (
            <Pressable
              key={job.bookingId}
              onPress={() =>
                router.push({
                  pathname: "/booking-detail",
                  params: { bookingId: job.bookingId }
                })
              }
            >
              <SurfaceCard style={{ gap: 10, padding: 11 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Avatar image={usersById[job.customerId]?.profilePhoto} size={44} />

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 15 }}>
                          {usersById[job.customerId]?.fullName || "Customer"}
                        </Text>
                        <Text style={{ color: theme.colors.primary, marginTop: 2, fontWeight: "800", fontSize: 12 }}>
                          {`Job type: ${formatJobType(job.serviceName)}`}
                        </Text>
                        <Text style={{ color: theme.colors.textMuted, marginTop: 1, fontSize: 11 }}>{job.scheduledAt}</Text>
                      </View>
                      <StatusBadge status={job.status} />
                    </View>
                  </View>
                </View>

                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{job.address || job.location}</Text>

                <View style={{ gap: 5 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "700" }}>Progress</Text>
                    <Text style={{ color: theme.colors.primaryDark, fontSize: 11, fontWeight: "800" }}>{jobProgress(job.status)}%</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 999, backgroundColor: theme.colors.surfaceAlt, overflow: "hidden" }}>
                    <View style={{ width: `${jobProgress(job.status)}%`, height: "100%", backgroundColor: theme.colors.primary }} />
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1, borderRadius: 15, padding: 9, backgroundColor: theme.colors.surfaceAlt }}>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "700" }}>Fee</Text>
                    <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 4, fontSize: 12 }}>
                      ₱{job.amount.toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, borderRadius: 15, padding: 9, backgroundColor: theme.colors.surfaceAlt }}>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "700" }}>Reference</Text>
                    <Text style={{ color: theme.colors.text, fontWeight: "800", marginTop: 4, fontSize: 11 }} numberOfLines={1}>
                      {formatBookingReference(job)}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 11 }}>Open job workflow</Text>
              </SurfaceCard>
            </Pressable>
        )}
        ListEmptyComponent={
            <EmptyState
              title="No jobs yet"
              description="New customer bookings assigned to this provider will appear here with live status progression."
            />
        }
      />
    </SafeAreaView>
  );
}
