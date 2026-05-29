import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { providerService, userService, workerPaymentService, type ProviderApprovalStatus, type WorkerRegistrationPayment } from "@kabisig/shared";
import { Text, View } from "react-native";
import { AppHeader, ApprovalStatusCard, FixedScreen, PrimaryButton, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";

function isRecoverablePendingStatusError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  return (
    message.includes("permission-denied")
    || message.includes("missing or insufficient permissions")
    || message.includes("client is offline")
    || message.includes("offline")
    || message.includes("unavailable")
  );
}

const progressByStatus = {
  Draft: 22,
  "Pending Approval": 58,
  "Revision Requested": 72,
  Approved: 100,
  Rejected: 100
} as const;

export default function PendingApprovalScreen() {
  const { user, refreshUser, signOut } = useAuth();
  const [status, setStatus] = useState<ProviderApprovalStatus>((user?.approvalStatus as ProviderApprovalStatus) || "Pending Approval");
  const [refreshing, setRefreshing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [registrationPayment, setRegistrationPayment] = useState<WorkerRegistrationPayment | null>(null);
  const [statusNotice, setStatusNotice] = useState("");
  const progress = progressByStatus[status] ?? 58;

  useEffect(() => {
    setStatus((user?.approvalStatus as ProviderApprovalStatus) || "Pending Approval");
  }, [user?.approvalStatus]);

  useEffect(() => {
    if (status !== "Rejected") return;

    void signOut().finally(() => {
      router.replace("/(auth)/role-selection");
    });
  }, [signOut, status]);

  const refreshStatus = useCallback(async function refreshStatus() {
    if (!user?.id) return;
    setRefreshing(true);
    setStatusNotice("");
    try {
      const profile = await userService.getProviderProfile(user.id);
      if (profile?.approvalStatus) {
        setStatus(profile.approvalStatus);
      }
      if (profile?.approvalStatus === "Rejected") {
        return;
      }

      let latestApplication: Awaited<ReturnType<typeof providerService.getLatestApplicationByUser>> = null;
      try {
        latestApplication = await providerService.getLatestApplicationByUser(user.id);
      } catch (error) {
        if (!isRecoverablePendingStatusError(error)) {
          console.warn("Could not load latest provider application:", error);
        }
        setStatusNotice("Your application was submitted. Some review details may appear after the app refreshes your access.");
      }

      setReviewNotes(latestApplication?.reviewNotes || "");
      try {
        const latestRegistrationPayment = await workerPaymentService.getRegistrationPayment(latestApplication?.registrationPaymentId);
        setRegistrationPayment(latestRegistrationPayment || (latestApplication?.registrationPaymentSnapshot as WorkerRegistrationPayment | undefined) || null);
      } catch (error) {
        if (!isRecoverablePendingStatusError(error)) {
          console.warn("Could not load worker registration payment:", error);
        }
        setRegistrationPayment((latestApplication?.registrationPaymentSnapshot as WorkerRegistrationPayment | undefined) || null);
      }

      try {
        await refreshUser();
      } catch (error) {
        if (!isRecoverablePendingStatusError(error)) {
          console.warn("Could not refresh account after pending status check:", error);
        }
      }
    } catch (error) {
      if (!isRecoverablePendingStatusError(error)) {
        console.warn("Could not refresh provider pending status:", error);
      }
      setStatusNotice("Your application is saved. Please refresh again in a moment if the latest status does not appear.");
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, user?.id]);

  const footer = status === "Approved"
    ? <PrimaryButton label="Go to dashboard" onPress={() => void (async () => {
        await refreshUser();
        router.replace("/(tabs)/home");
      })()} />
    : status === "Revision Requested"
      ? <PrimaryButton label="Edit application" onPress={() => router.push("/provider/onboarding")} />
      : <PrimaryButton label={refreshing ? "Refreshing..." : "Refresh status"} onPress={() => void refreshStatus()} disabled={refreshing} />;

  return (
    <FixedScreen
      style={{ backgroundColor: theme.colors.background }}
      header={<AppHeader title="Application Status" />}
      footer={footer}
    >
      <ApprovalStatusCard
        title="Worker application"
        status={status}
        note="You can monitor your current verification status here while the admin team reviews your application."
      />

      <SurfaceCard>
        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Verification progress</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 6, lineHeight: 20 }}>
          Most applications are reviewed within 1-2 business days, depending on requirement quality and verification workload.
        </Text>
        <View style={{ marginTop: 16, height: 12, borderRadius: 999, backgroundColor: theme.colors.surfaceAlt, overflow: "hidden" }}>
          <View style={{ width: `${progress}%`, height: "100%", borderRadius: 999, backgroundColor: theme.colors.primary }} />
        </View>
      </SurfaceCard>

      <SurfaceCard style={{ gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: theme.colors.text }}>Application tracker</Text>
        {[
          { label: "Application Submitted", done: true },
          {
            label: registrationPayment?.status === "Waived" ? "Registration Free — Waiting for Admin Review" : "Payment Required",
            done: registrationPayment?.status === "Waived" || registrationPayment?.status === "Submitted" || registrationPayment?.status === "Approved",
          },
          {
            label: "Payment Submitted",
            done: registrationPayment?.status === "Submitted" || registrationPayment?.status === "Approved",
            hidden: registrationPayment?.status === "Waived",
          },
          { label: "Under Admin Review", done: status === "Pending Approval" || status === "Approved" || status === "Rejected" },
          { label: status === "Rejected" ? "Rejected" : "Approved", done: status === "Approved" || status === "Rejected" },
        ].filter((step) => !step.hidden).map((step) => (
          <View key={step.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: step.done ? theme.colors.primary : theme.colors.surfaceAlt }}>
              <Text style={{ color: step.done ? "#fff" : theme.colors.textMuted, fontSize: 12, fontWeight: "900" }}>{step.done ? "✓" : "•"}</Text>
            </View>
            <Text style={{ color: theme.colors.text, flex: 1, fontWeight: step.done ? "800" : "600" }}>{step.label}</Text>
          </View>
        ))}
        {statusNotice ? (
          <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>{statusNotice}</Text>
        ) : null}
        {registrationPayment?.adminRemarks ? (
          <Text style={{ color: theme.colors.danger, lineHeight: 20 }}>Payment note: {registrationPayment.adminRemarks}</Text>
        ) : null}
      </SurfaceCard>

      {reviewNotes ? (
        <SurfaceCard style={{ gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: theme.colors.text }}>Latest admin note</Text>
          <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>{reviewNotes}</Text>
        </SurfaceCard>
      ) : null}
    </FixedScreen>
  );
}
