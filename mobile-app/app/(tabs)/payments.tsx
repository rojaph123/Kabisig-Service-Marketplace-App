import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { notificationService, paymentService, type Payment } from "@kabisig/shared";
import { AppHeader, EmptyState, FixedScreen, LoadingState, StatusBadge, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";

export default function PaymentsTab() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paid" | "pending">("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [items, notifications] = await Promise.all([
      paymentService.getCustomerPayments(user.id),
      notificationService.getUserNotifications(user.id)
    ]);
    setPayments(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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

  const totals = useMemo(
    () => ({
      total: payments.reduce((sum, payment) => sum + payment.amount, 0),
      paid: payments.filter((payment) => payment.status === "Paid").length,
      pending: payments.filter((payment) => payment.status === "Pending").length
    }),
    [payments]
  );
  const visiblePayments = useMemo(
    () =>
      payments.filter((payment) =>
        filter === "all" ? true : filter === "paid" ? payment.status === "Paid" : payment.status === "Pending"
      ),
    [filter, payments]
  );

  return (
    <FixedScreen
      header={
        <>
          <AppHeader title="Payments" />
        </>
      }
    >
      <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { label: "Total spend", value: `PHP ${totals.total.toLocaleString()}`, icon: "wallet-outline" },
            { label: "Paid", value: totals.paid.toString(), icon: "checkmark-circle-outline" },
            { label: "Pending", value: totals.pending.toString(), icon: "time-outline" }
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
              <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>{item.value}</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard style={{ backgroundColor: theme.dark ? "#101B2C" : theme.colors.card }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { key: "all" as const, label: "All" },
            { key: "paid" as const, label: "Paid" },
            { key: "pending" as const, label: "Pending" }
          ].map((option) => {
            const active = filter === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setFilter(option.key)}
                style={{
                  flex: 1,
                  borderRadius: 18,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border
                }}
              >
                <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800" }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>

      {loading ? <LoadingState label="Refreshing payments..." /> : null}

      <View style={{ gap: 14 }}>
        {visiblePayments.map((payment) => (
          <Pressable
            key={payment.paymentId}
            onPress={() =>
              router.push({
                pathname: "/payment-detail",
                params: { paymentId: payment.paymentId }
              })
            }
          >
            <SurfaceCard style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <View>
                  <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 17 }}>{payment.method}</Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>#{payment.bookingId.replace(/^booking-/, "")}</Text>
                </View>
                <StatusBadge status={payment.status} />
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: theme.colors.primary, fontSize: 20, fontWeight: "900" }}>
                  PHP {payment.amount.toLocaleString()}
                </Text>
                <Text style={{ color: theme.colors.textMuted }}>{payment.createdAt}</Text>
              </View>

              <Text style={{ color: theme.colors.primaryDark, fontWeight: "800" }}>View payment details</Text>
            </SurfaceCard>
          </Pressable>
        ))}

        {!visiblePayments.length ? (
          <EmptyState
            title="No payments in this filter"
            description="Try another payment status or wait for new payment activity."
          />
        ) : null}
      </View>
    </FixedScreen>
  );
}
