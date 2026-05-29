import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import { formatReadableDate, formatReadableMonthYear, workerPaymentService, type WorkerCommissionBill } from "@kabisig/shared";
import { BackHeader, EmptyState, FeedbackBanner, FixedScreen, LoadingState, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";
import { readableAppError } from "../src/utils/errors";

export default function CommissionHistoryScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<WorkerCommissionBill[]>([]);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; title: string; message: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user?.id) {
        if (active) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const nextBills = await workerPaymentService.getCommissionBills(user.id);
        if (!active) return;
        setBills(nextBills);
      } catch (error) {
        if (!active) return;
        setFeedback({
          type: "error",
          title: "Could not load billing history",
          message: readableAppError(error, "Please try again in a moment."),
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const groupedBills = useMemo(
    () =>
      bills.map((bill) => ({
        ...bill,
        paidOrDueDate: (bill.status === "Approved" ? bill.paymentDate : bill.dueDate) || bill.dueDate,
      })),
    [bills]
  );

  function openBill(bill: WorkerCommissionBill) {
    if (bill.status === "Approved") {
      router.push({ pathname: "/commission-receipt", params: { billId: bill.billId } });
      return;
    }
    router.push("/(tabs)/profile" as never);
  }

  return (
    <FixedScreen
      style={{ backgroundColor: theme.colors.background }}
      header={<BackHeader title="Commission History" onBack={() => router.back()} />}
    >
      {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
      {loading ? <LoadingState label="Loading commission records..." /> : null}
      {!loading && !groupedBills.length ? (
        <EmptyState
          title="No commission records yet"
          description="Official monthly commission bills will appear here once billing is generated for your account."
        />
      ) : null}
      {!loading && groupedBills.length ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
          {groupedBills.map((bill) => {
            const tone =
              bill.status === "Approved"
                ? { bg: theme.colors.successSoft, fg: theme.colors.success }
                : bill.status === "Overdue"
                  ? { bg: theme.colors.dangerSoft, fg: theme.colors.danger }
                  : { bg: theme.colors.warningSoft, fg: theme.colors.accentDark };

            return (
              <Pressable key={bill.billId} onPress={() => openBill(bill)}>
                <SurfaceCard style={{ padding: 14, gap: 10 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>{formatReadableMonthYear(bill.cycleStart)}</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        {formatReadableDate(bill.cycleStart)} - {formatReadableDate(bill.cycleEnd)}
                      </Text>
                    </View>
                    <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: tone.bg }}>
                      <Text style={{ color: tone.fg, fontSize: 10, fontWeight: "900" }}>{bill.status}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <View style={{ flex: 1, minWidth: 130, borderRadius: 14, padding: 10, backgroundColor: theme.colors.surfaceAlt }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: "900" }}>Total payable</Text>
                      <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "900", marginTop: 3 }}>PHP {Number(bill.amountDue || 0).toLocaleString()}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 130, borderRadius: 14, padding: 10, backgroundColor: theme.colors.surfaceAlt }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: "900" }}>{bill.status === "Approved" ? "Paid date" : "Due date"}</Text>
                      <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "900", marginTop: 3 }}>{formatReadableDate(bill.paidOrDueDate)}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                      {bill.status === "Approved" ? "Open full receipt" : "Open payment card"}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
                  </View>
                </SurfaceCard>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </FixedScreen>
  );
}
