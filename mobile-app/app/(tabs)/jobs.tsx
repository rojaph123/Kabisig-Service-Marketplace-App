import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import { bookingService, userService, type Booking, type User } from "@kabisig/shared";
import { AppHeader, Avatar, EmptyState, FixedScreen, SearchBar, StatusBadge, SurfaceCard } from "../../src/components";
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

export default function JobsTab() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("All");

  useEffect(() => {
    if (!user) return;
    const unsubscribe = bookingService.subscribeProviderBookings(user.id, (items) => {
      const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setJobs(sorted);
      void (async () => {
        const users = await userService.getUsersByIds(sorted.map((job) => job.customerId));
        setUsersById(Object.fromEntries(users.map((entry) => [entry.id, entry])));
      })();
    });

    return unsubscribe;
  }, [user]);

  const filteredJobs = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch =
        !normalized ||
        [job.serviceName, job.address, job.status, job.bookingId]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesSearch && matchesJobFilter(job, activeFilter);
    });
  }, [activeFilter, jobs, search]);

  const summary = useMemo(
    () => ({
      requests: jobs.filter((job) => job.status === "Pending").length,
      active: jobs.filter((job) => job.status === "Accepted" || job.status === "On the Way" || job.status === "In Progress").length,
      done: jobs.filter((job) => job.status === "Completed").length
    }),
    [jobs]
  );

  return (
    <FixedScreen
      header={
        <>
          <AppHeader title="Jobs" />
        </>
      }
    >

      <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { label: "Requests", value: summary.requests, icon: "mail-unread-outline" },
            { label: "Active", value: summary.active, icon: "construct-outline" },
            { label: "Done", value: summary.done, icon: "checkmark-done-outline" }
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

      <SearchBar placeholder="Search request or address..." value={search} onChangeText={setSearch} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
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

      <View style={{ gap: 14 }}>
        {filteredJobs.map((job) => (
          <Pressable
            key={job.bookingId}
            onPress={() =>
              router.push({
                pathname: "/booking-detail",
                params: { bookingId: job.bookingId }
              })
            }
            >
            <SurfaceCard style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Avatar image={usersById[job.customerId]?.profilePhoto} size={56} />

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 18 }}>{job.serviceName}</Text>
                      <Text style={{ color: theme.colors.primary, marginTop: 4, fontWeight: "800" }}>
                        {usersById[job.customerId]?.fullName || "Customer"}
                      </Text>
                      <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>{job.scheduledAt}</Text>
                    </View>
                    <StatusBadge status={job.status} />
                  </View>
                </View>
              </View>

              <Text style={{ color: theme.colors.textMuted }}>{job.address || job.location}</Text>

              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" }}>Progress</Text>
                  <Text style={{ color: theme.colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{jobProgress(job.status)}%</Text>
                </View>
                <View style={{ height: 8, borderRadius: 999, backgroundColor: theme.colors.surfaceAlt, overflow: "hidden" }}>
                  <View style={{ width: `${jobProgress(job.status)}%`, height: "100%", backgroundColor: theme.colors.primary }} />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    padding: 12,
                    backgroundColor: theme.colors.surfaceAlt
                  }}
                >
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" }}>Fee</Text>
                  <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 6 }}>
                    PHP {job.amount.toLocaleString()}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    padding: 12,
                    backgroundColor: theme.colors.surfaceAlt
                  }}
                >
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" }}>Reference</Text>
                  <Text style={{ color: theme.colors.text, fontWeight: "800", marginTop: 6 }} numberOfLines={1}>
                    #{job.bookingId.replace(/^booking-/, "")}
                  </Text>
                </View>
              </View>

              <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>Open job workflow</Text>
            </SurfaceCard>
          </Pressable>
        ))}

        {!filteredJobs.length ? (
          <EmptyState
            title="No jobs yet"
            description="New customer bookings assigned to this provider will appear here with live status progression."
          />
        ) : null}
      </View>
    </FixedScreen>
  );
}
