import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { bookingService, formatBookingReference, formatPaymentReference, formatReadableDateTime, notificationService, paymentService, userService, type Booking, type Payment, type User } from "@kabisig/shared";
import { BackHeader, EmptyState, LoadingState, StatusBadge, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";
import { getEffectivePaymentStatus, isPaymentInDateRange } from "../../src/utils/payments";

export default function EarningsTab() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookingsById, setBookingsById] = useState<Record<string, Booking>>({});
  const [customersById, setCustomersById] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paidIncomeOpen, setPaidIncomeOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "waiting" | "paid" | "cancelled" | "refunded">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [items, notifications] = await Promise.all([
      paymentService.getProviderEarnings(user.id),
      notificationService.getUserNotifications(user.id)
    ]);
    const sorted = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const [bookingDocs, customerDocs] = await Promise.all([
      Promise.all(sorted.map((payment) => bookingService.getBookingById(payment.bookingId))),
      userService.getUsersByIds(sorted.map((payment) => payment.customerId))
    ]);
    setPayments(sorted);
    setBookingsById(
      Object.fromEntries(
        sorted.map((payment, index) => [payment.bookingId, bookingDocs[index]]).filter((entry): entry is [string, Booking] => Boolean(entry[1]))
      )
    );
    setCustomersById(Object.fromEntries(customerDocs.map((customer) => [customer.id, customer])));
    await notificationService.markManyAsRead(
      notifications.filter((item) => !item.isRead && item.type.includes("payment")).map((item) => item.notificationId)
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const earningsSummary = useMemo(() => {
    const paidPayments = payments.filter((payment) => getEffectivePaymentStatus(payment, bookingsById[payment.bookingId]) === "Paid");
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = todayStart.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() + mondayOffset);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const sumFrom = (start: Date) =>
      paidPayments.reduce((sum, payment) => {
        const createdAt = new Date(payment.createdAt);
        if (!Number.isFinite(createdAt.getTime()) || createdAt < start) return sum;
        return sum + payment.amount;
      }, 0);

    return {
      today: sumFrom(todayStart),
      week: sumFrom(weekStart),
      month: sumFrom(monthStart),
    };
  }, [bookingsById, payments]);
  const totals = useMemo(() => {
    const paid = payments.filter((payment) => getEffectivePaymentStatus(payment, bookingsById[payment.bookingId]) === "Paid");
    return {
      total: paid.reduce((sum, payment) => sum + payment.amount, 0),
      paidCount: paid.length,
      waitingCount: payments.filter((payment) => getEffectivePaymentStatus(payment, bookingsById[payment.bookingId]) === "Waiting for Completion").length
    };
  }, [bookingsById, payments]);
  const visiblePayments = useMemo(
    () =>
      payments.filter((payment) => {
        const effectiveStatus = getEffectivePaymentStatus(payment, bookingsById[payment.bookingId]);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "waiting" && effectiveStatus === "Waiting for Completion") ||
          (statusFilter === "paid" && effectiveStatus === "Paid") ||
          (statusFilter === "cancelled" && (effectiveStatus === "No payment required" || effectiveStatus === "Cancelled")) ||
          (statusFilter === "refunded" && effectiveStatus === "Refunded");
        return matchesStatus && isPaymentInDateRange(payment, dateFilter);
      }),
    [bookingsById, dateFilter, payments, statusFilter]
  );
  const statusOptions = [
    { key: "all" as const, label: "All" },
    { key: "waiting" as const, label: "Waiting" },
    { key: "paid" as const, label: "Paid" },
    { key: "cancelled" as const, label: "Cancelled" },
    { key: "refunded" as const, label: "Refunded" }
  ];
  const dateOptions = [
    { key: "all" as const, label: "All time" },
    { key: "today" as const, label: "Today" },
    { key: "week" as const, label: "This week" },
    { key: "month" as const, label: "This month" }
  ];
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
        <BackHeader title="Earnings" onBack={() => router.back()} />
      </View>

      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: 10, gap: 10, backgroundColor: theme.colors.background, position: "relative", zIndex: 100, elevation: 20, overflow: "visible" }}>
        <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt, gap: 10, padding: 14 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "800" }}>Total earned</Text>
          <Text style={{ color: theme.colors.text, fontSize: 21, fontWeight: "900" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
            ₱{totals.total.toLocaleString()}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { label: "Paid jobs", value: totals.paidCount.toString(), icon: "checkmark-done-outline" },
              { label: "Waiting", value: totals.waitingCount.toString(), icon: "time-outline" }
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: theme.colors.card, padding: 10 }}>
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={15} color={theme.colors.primaryDark} />
                <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{item.value}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "800" }} numberOfLines={1}>{item.label}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={() => setPaidIncomeOpen((current) => !current)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderRadius: 14,
              backgroundColor: theme.colors.card,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: theme.colors.border
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Ionicons name="stats-chart-outline" size={16} color={theme.colors.primaryDark} />
              <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "900" }}>Paid income</Text>
            </View>
            <Ionicons name={paidIncomeOpen ? "chevron-up-outline" : "chevron-down-outline"} size={17} color={theme.colors.textMuted} />
          </Pressable>
          {paidIncomeOpen ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { label: "Today", value: earningsSummary.today },
                { label: "Week", value: earningsSummary.week },
                { label: "Month", value: earningsSummary.month }
              ].map((item) => (
                <View key={item.label} style={{ flex: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: theme.colors.surfaceAlt, gap: 3, minWidth: 0 }}>
                  <Text style={{ color: theme.colors.textLight, fontSize: 11, fontWeight: "800" }}>{item.label}</Text>
                  <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "900" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>
                    ₱{item.value.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </SurfaceCard>

        <View style={{ flexDirection: "row", gap: 8, zIndex: 40, elevation: 10 }}>
          <View style={{ flex: 1, position: "relative", zIndex: statusMenuOpen ? 50 : 1, elevation: statusMenuOpen ? 12 : 0 }}>
            <Pressable
              onPress={() => {
                setStatusMenuOpen((current) => !current);
                setDateMenuOpen(false);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: 16,
                paddingHorizontal: 11,
                paddingVertical: 8,
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.border
              }}
            >
              <View>
                <Text style={{ color: theme.colors.textLight, fontSize: 10, fontWeight: "800" }}>Status</Text>
                <Text style={{ color: theme.colors.text, fontSize: 11, fontWeight: "900", marginTop: 1 }}>
                  {statusOptions.find((option) => option.key === statusFilter)?.label || "All"}
                </Text>
              </View>
              <Ionicons name={statusMenuOpen ? "chevron-up-outline" : "chevron-down-outline"} size={16} color={theme.colors.textMuted} />
            </Pressable>
            {statusMenuOpen ? (
              <SurfaceCard style={{ position: "absolute", top: 58, left: 0, right: 0, zIndex: 60, elevation: 14, gap: 4, padding: 6 }}>
                {statusOptions.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      setStatusFilter(option.key);
                      setStatusMenuOpen(false);
                    }}
                    style={{
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      backgroundColor: statusFilter === option.key ? theme.colors.primarySoft : "transparent"
                    }}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 12 }}>{option.label}</Text>
                  </Pressable>
                ))}
              </SurfaceCard>
            ) : null}
          </View>
          <View style={{ flex: 1, position: "relative", zIndex: dateMenuOpen ? 50 : 1, elevation: dateMenuOpen ? 12 : 0 }}>
            <Pressable
              onPress={() => {
                setDateMenuOpen((current) => !current);
                setStatusMenuOpen(false);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: 16,
                paddingHorizontal: 11,
                paddingVertical: 8,
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.border
              }}
            >
              <View>
                <Text style={{ color: theme.colors.textLight, fontSize: 10, fontWeight: "800" }}>Duration</Text>
                <Text style={{ color: theme.colors.text, fontSize: 11, fontWeight: "900", marginTop: 1 }}>
                  {dateOptions.find((option) => option.key === dateFilter)?.label || "All time"}
                </Text>
              </View>
              <Ionicons name={dateMenuOpen ? "chevron-up-outline" : "chevron-down-outline"} size={16} color={theme.colors.textMuted} />
            </Pressable>
            {dateMenuOpen ? (
              <SurfaceCard style={{ position: "absolute", top: 58, left: 0, right: 0, zIndex: 60, elevation: 14, gap: 4, padding: 6 }}>
                {dateOptions.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      setDateFilter(option.key);
                      setDateMenuOpen(false);
                    }}
                    style={{
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      backgroundColor: dateFilter === option.key ? theme.colors.accentSoft : "transparent"
                    }}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 12 }}>{option.label}</Text>
                  </Pressable>
                ))}
              </SurfaceCard>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, zIndex: 0, elevation: 0 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: 2,
          paddingBottom: theme.spacing.xl + Math.max(insets.bottom, 8),
          gap: 12
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        alwaysBounceVertical={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
      >
        {loading ? <LoadingState label="Refreshing earnings..." /> : null}

        <View style={{ gap: 10 }}>
          {visiblePayments.map((payment) => {
            const booking = bookingsById[payment.bookingId];
            const effectiveStatus = getEffectivePaymentStatus(payment, booking);
            const noPaymentRequired = effectiveStatus === "No payment required";
            return (
              <Pressable
                key={payment.paymentId}
                onPress={() =>
                  router.push({
                    pathname: "/payment-detail",
                    params: { paymentId: payment.paymentId, mode: "provider" }
                  })
                }
              >
                <SurfaceCard style={{ gap: 9, padding: 14 }}>
                  <View style={{ gap: 7 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 15, flex: 1 }} numberOfLines={1}>
                        {formatPaymentReference(payment)}
                      </Text>
                      <StatusBadge status={effectiveStatus} />
                    </View>
                    <Text style={{ color: theme.colors.primary, marginTop: 4, fontWeight: "800" }} numberOfLines={1}>
                      {customersById[payment.customerId]?.fullName || "Customer"}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                      {payment.method} | {formatBookingReference(booking || payment.bookingId)}
                    </Text>
                  </View>

                  <View style={{ gap: 3 }}>
                    <Text style={{ color: noPaymentRequired ? theme.colors.textMuted : theme.colors.text, fontSize: 18, fontWeight: "900" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                      {noPaymentRequired ? "No payment required" : `₱${payment.amount.toLocaleString()}`}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{formatReadableDateTime(payment.createdAt)}</Text>
                  </View>

                  <Text style={{ color: theme.colors.primaryDark, fontSize: 12, fontWeight: "800" }}>View receipt</Text>
                </SurfaceCard>
              </Pressable>
            );
          })}

          {!visiblePayments.length ? (
            <EmptyState
              title="No earnings in this filter"
              description="Try another status or wait for new payment activity."
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
