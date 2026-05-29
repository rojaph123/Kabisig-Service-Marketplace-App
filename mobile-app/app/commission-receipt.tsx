import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import {
  formatReadableDate,
  formatReadableMonthYear,
  formatReadableShortDateTime,
  userService,
  workerPaymentService,
  type User,
  type WorkerCommissionBill,
  type WorkerPaymentSettings
} from "@kabisig/shared";
import { BackHeader, EmptyState, FixedScreen, LoadingState, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";
import { readableAppError } from "../src/utils/errors";

function formatCommissionReceiptNumber(bill: WorkerCommissionBill) {
  const cycle = new Date(bill.cycleStart);
  if (Number.isNaN(cycle.getTime())) {
    return `KAB-${bill.billId.slice(-6).toUpperCase()}`;
  }
  const month = String(cycle.getMonth() + 1).padStart(2, "0");
  const year = String(cycle.getFullYear()).slice(-2);
  const suffix = bill.billId.slice(-4).toUpperCase();
  return `KAB-${month}${year}-${suffix}`;
}

type ReceiptLoadState = "loading" | "ready" | "not_found" | "not_approved" | "error";

export default function CommissionReceiptScreen() {
  const params = useLocalSearchParams<{ billId?: string }>();
  const { user } = useAuth();
  const [bill, setBill] = useState<WorkerCommissionBill | null>(null);
  const [reviewer, setReviewer] = useState<User | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<WorkerPaymentSettings | null>(null);
  const [loadState, setLoadState] = useState<ReceiptLoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewerError, setReviewerError] = useState<string | null>(null);
  const [reviewerLoading, setReviewerLoading] = useState(false);

  const loadReviewer = useCallback(async (nextBill: WorkerCommissionBill | null) => {
    if (!nextBill?.reviewedBy) {
      setReviewer(null);
      setReviewerError(null);
      return;
    }

    setReviewerLoading(true);
    setReviewerError(null);
    try {
      const adminUser = await userService.getUserDocument(nextBill.reviewedBy);
      setReviewer(adminUser);
    } catch (error) {
      setReviewer(null);
      setReviewerError(readableAppError(error, "Could not load admin reviewer details right now."));
    } finally {
      setReviewerLoading(false);
    }
  }, []);

  const loadReceipt = useCallback(async () => {
    if (!user?.id || !params.billId) {
      setBill(null);
      setPaymentSettings(null);
      setReviewer(null);
      setReviewerError(null);
      setErrorMessage("");
      setLoadState("not_found");
      return;
    }

    setLoadState("loading");
    setErrorMessage("");
    setReviewer(null);
    setReviewerError(null);

    try {
      const [matchedBill, settings] = await Promise.all([
        workerPaymentService.getCommissionBillById(user.id, params.billId),
        workerPaymentService.getSettings(),
      ]);

      setPaymentSettings(settings);

      if (!matchedBill) {
        setBill(null);
        setLoadState("not_found");
        return;
      }

      if (matchedBill.status !== "Approved") {
        setBill(matchedBill);
        setLoadState("not_approved");
        return;
      }

      setBill(matchedBill);
      setLoadState("ready");
      await loadReviewer(matchedBill);
    } catch (error) {
      setBill(null);
      setErrorMessage(readableAppError(error, "Could not load receipt right now."));
      setLoadState("error");
    }
  }, [loadReviewer, params.billId, user?.id]);

  useEffect(() => {
    void loadReceipt();
  }, [loadReceipt]);

  const cycleLabel = useMemo(() => (bill ? formatReadableMonthYear(bill.cycleStart) : ""), [bill]);
  const coverageLabel = useMemo(
    () => (bill ? `${formatReadableDate(bill.cycleStart)} - ${formatReadableDate(bill.cycleEnd)}` : ""),
    [bill]
  );
  const baseCommissionAmount = Number(bill?.baseCommissionAmount ?? bill?.amountDue ?? 0);
  const surchargeAmount = Number(bill?.surchargeAmount || 0);
  const commissionRate = Number(bill?.commissionPercentage || paymentSettings?.commissionPercentage || 10);
  const surchargeRate = Number(bill?.surchargeRateApplied ?? paymentSettings?.lateSurchargeRate ?? 0);
  const surchargeDays = Number(bill?.surchargeDaysApplied || 0);

  if (loadState === "loading") {
    return (
      <FixedScreen header={<BackHeader title="Commission Receipt" onBack={() => router.back()} />}>
        <LoadingState label="Loading receipt..." />
      </FixedScreen>
    );
  }

  if (loadState === "error") {
    return (
      <FixedScreen header={<BackHeader title="Commission Receipt" onBack={() => router.back()} />}>
        <EmptyState
          title="Could not load receipt"
          description={errorMessage || "Please try again in a moment."}
          actionLabel="Try again"
          onAction={() => void loadReceipt()}
          icon="cloud-offline-outline"
        />
      </FixedScreen>
    );
  }

  if (loadState === "not_approved") {
    return (
      <FixedScreen header={<BackHeader title="Commission Receipt" onBack={() => router.back()} />}>
        <EmptyState
          title="Receipt unavailable"
          description="Receipt is available after admin approval."
          actionLabel="Go back"
          onAction={() => router.back()}
          icon="time-outline"
        />
      </FixedScreen>
    );
  }

  if (!bill || loadState === "not_found") {
    return (
      <FixedScreen header={<BackHeader title="Commission Receipt" onBack={() => router.back()} />}>
        <EmptyState
          title="Receipt not found"
          description="Open a receipt from the worker payments section."
          actionLabel="Try again"
          onAction={() => void loadReceipt()}
          icon="receipt-outline"
        />
      </FixedScreen>
    );
  }

  return (
    <FixedScreen header={<BackHeader title="Commission Receipt" onBack={() => router.back()} />}>
      <SurfaceCard style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ backgroundColor: theme.dark ? theme.colors.primaryLight : theme.colors.primaryDark, padding: 20, gap: 14 }}>
          <Text style={{ color: "rgba(255,255,255,0.72)", fontWeight: "700", fontSize: 12 }}>{formatCommissionReceiptNumber(bill)}</Text>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900" }}>PHP {Number(bill.amountDue || 0).toLocaleString()}</Text>
          <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 13 }}>Monthly admin commission receipt for {cycleLabel}</Text>
          <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 12 }}>Reviewed {bill.reviewedAt ? formatReadableShortDateTime(bill.reviewedAt) : "Pending admin review"}</Text>
        </View>

        <View style={{ padding: 18, gap: 14 }}>
          <SurfaceCard style={{ padding: 14, gap: 10, backgroundColor: theme.colors.surfaceAlt }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "900" }}>OFFICIAL RECEIPT</Text>
            {[
              { label: "Receipt No.", value: formatCommissionReceiptNumber(bill) },
              { label: "Billing Month", value: cycleLabel },
              { label: "Coverage", value: coverageLabel },
              { label: "Payment Date", value: bill.paymentDate ? formatReadableDate(bill.paymentDate) : "Recorded by admin" },
              { label: "Approved On", value: bill.reviewedAt ? formatReadableShortDateTime(bill.reviewedAt) : "Awaiting review timestamp" },
              { label: "Reviewed By", value: reviewer?.fullName || reviewer?.email || "Kabisig Admin" },
              { label: "Reference Number", value: bill.referenceNumber || "Not provided" },
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{item.label}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900", flexShrink: 1, textAlign: "right" }}>{item.value}</Text>
              </View>
            ))}
            {reviewerError ? (
              <View style={{ borderRadius: 14, padding: 12, backgroundColor: theme.colors.warningSoft, borderWidth: 1, borderColor: theme.colors.warning, gap: 8 }}>
                <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Reviewer details unavailable</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 }}>{reviewerError}</Text>
                <Text
                  onPress={() => void loadReviewer(bill)}
                  style={{ color: theme.colors.primaryDark, fontWeight: "900" }}
                >
                  {reviewerLoading ? "Retrying..." : "Retry reviewer lookup"}
                </Text>
              </View>
            ) : null}
          </SurfaceCard>

          <SurfaceCard style={{ padding: 14, gap: 10 }}>
            <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>Payment breakdown</Text>
            {[
              { label: `Total income for ${cycleLabel}`, value: `PHP ${Number(bill.totalIncome || 0).toLocaleString()}` },
              { label: `Base ${commissionRate}% admin share`, value: `PHP ${baseCommissionAmount.toLocaleString()}` },
              ...(surchargeAmount > 0 ? [{ label: `Late surcharge (PHP ${surchargeRate.toLocaleString()}/day${surchargeDays > 0 ? ` x ${surchargeDays}` : ""})`, value: `PHP ${surchargeAmount.toLocaleString()}` }] : []),
              { label: "Total amount paid", value: `PHP ${Number(bill.amountDue || 0).toLocaleString()}` },
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{item.label}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900", flexShrink: 1, textAlign: "right" }}>{item.value}</Text>
              </View>
            ))}
          </SurfaceCard>

          <SurfaceCard style={{ padding: 14, gap: 10 }}>
            <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>Billing summary</Text>
            {[
              { icon: "calendar-outline", label: "Due date", value: formatReadableDate(bill.dueDate) },
              { icon: "time-outline", label: "Grace period end", value: formatReadableDate(bill.graceEndsAt) },
              { icon: "briefcase-outline", label: "Completed paid bookings", value: bill.totalCompletedPaidBookings.toLocaleString() },
              { icon: "gift-outline", label: "Free bookings applied", value: bill.freeBookingsAppliedThisBill.toLocaleString() },
              { icon: "cash-outline", label: "Commissionable bookings", value: bill.commissionableBookings.toLocaleString() },
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={theme.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.textLight, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
                  <Text style={{ color: theme.colors.text, fontWeight: "800", marginTop: 4 }}>{item.value}</Text>
                </View>
              </View>
            ))}
          </SurfaceCard>
        </View>
      </SurfaceCard>
    </FixedScreen>
  );
}
