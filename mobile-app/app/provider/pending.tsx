import { router } from "expo-router";
import { useEffect, useState } from "react";
import { providerService, userService, type ProviderApprovalStatus } from "@kabisig/shared";
import { Text, View } from "react-native";
import { ApprovalStatusCard, BackHeader, FixedScreen, PrimaryButton, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";

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

  async function refreshStatus() {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      const [profile, latestApplication] = await Promise.all([
        userService.getProviderProfile(user.id),
        providerService.getLatestApplicationByUser(user.id)
      ]);
      if (profile?.approvalStatus) {
        setStatus(profile.approvalStatus);
      }
      if (profile?.approvalStatus === "Rejected") {
        return;
      }
      setReviewNotes(latestApplication?.reviewNotes || "");
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  }

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
      header={<BackHeader title="Application Status" onBack={() => router.back()} />}
      footer={footer}
    >
      <ApprovalStatusCard
        title="Service provider application"
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

      <SurfaceCard style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: theme.colors.text }}>Status guide</Text>
        <Text style={{ color: theme.colors.textMuted }}>Pending Approval: waiting for admin review.</Text>
        <Text style={{ color: theme.colors.textMuted }}>Revision Requested: update missing or unclear requirements.</Text>
        <Text style={{ color: theme.colors.textMuted }}>Rejected: the current application cannot proceed.</Text>
        <Text style={{ color: theme.colors.textMuted }}>Approved: you can now continue to the provider dashboard.</Text>
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
