import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { notificationService, type NotificationItem } from "@kabisig/shared";
import { router } from "expo-router";
import { BackHeader, EmptyState, FixedScreen, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";

const sampleNotifications: NotificationItem[] = [
  {
    notificationId: "sample-1",
    userId: "sample",
    type: "booking_accepted",
    title: "Booking accepted",
    body: "A provider accepted your service request and confirmed the schedule.",
    isRead: false,
    createdAt: "Just now"
  },
  {
    notificationId: "sample-2",
    userId: "sample",
    type: "provider_approved",
    title: "Provider profile approved",
    body: "Your provider application has been approved and is now visible to customers.",
    isRead: true,
    createdAt: "Today"
  }
];

function notificationIcon(type: string) {
  if (type.includes("booking")) return { icon: "calendar-outline", tint: theme.colors.primaryDark, bg: theme.colors.primarySoft };
  if (type.includes("payment")) return { icon: "card-outline", tint: theme.colors.accent, bg: theme.colors.accentSoft };
  if (type.includes("message") || type.includes("support")) return { icon: "chatbubble-ellipses-outline", tint: theme.colors.info, bg: theme.colors.infoSoft };
  if (type.includes("approved")) return { icon: "checkmark-circle-outline", tint: theme.colors.success, bg: theme.colors.successSoft };
  return { icon: "notifications-outline", tint: theme.colors.primaryDark, bg: theme.colors.surfaceAlt };
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = notificationService.subscribeUserNotifications(user.id, (items) => {
      const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setNotifications(sorted);
      const unreadIds = sorted.filter((item) => !item.isRead).map((item) => item.notificationId);
      if (unreadIds.length) {
        void notificationService.markManyAsRead(unreadIds);
      }
    });
    return unsubscribe;
  }, [user]);

  const items = useMemo(() => (notifications.length ? notifications : sampleNotifications), [notifications]);

  return (
    <FixedScreen
      style={{ backgroundColor: theme.colors.background }}
      header={<BackHeader title="Notifications" onBack={() => router.back()} />}
    >
      <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.primarySoft }}>
        <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Free-plan notification mode</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20, marginTop: 6 }}>
          Notifications work while the app is active. In-app realtime updates are available, but phone-off or background remote delivery is not enabled in this build.
        </Text>
      </SurfaceCard>

      <View style={{ gap: 12 }}>
        {items.length ? (
          items.map((item) => {
            const visual = notificationIcon(item.type);
            return (
              <Pressable
                key={item.notificationId}
                style={{ opacity: item.isRead ? 0.85 : 1 }}
                onPress={() => item.route ? router.push(item.route as never) : undefined}
              >
                <SurfaceCard style={{ flexDirection: "row", gap: 14, alignItems: "flex-start", borderColor: item.isRead ? theme.colors.border : theme.colors.primarySoft }}>
                  <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: visual.bg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={visual.icon as keyof typeof Ionicons.glyphMap} size={22} color={visual.tint} />
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: "800", flex: 1 }}>{item.title}</Text>
                      {!item.isRead ? <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: theme.colors.accent }} /> : null}
                    </View>
                    <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>{item.body}</Text>
                    <Text style={{ color: theme.colors.textLight, fontSize: 12 }}>{item.createdAt}</Text>
                  </View>
                </SurfaceCard>
              </Pressable>
            );
          })
        ) : (
          <EmptyState title="No notifications yet" description="Booking updates, new messages, provider approvals, and support replies will appear here." />
        )}
      </View>
    </FixedScreen>
  );
}
