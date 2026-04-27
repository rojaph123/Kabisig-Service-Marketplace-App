import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { bookingService, messagingService, notificationService } from "@kabisig/shared";
import { useAuth } from "../../src/hooks/AuthProvider";
import { useThemeMode } from "../../src/hooks/ThemeProvider";
import { theme } from "../../src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const [messageCount, setMessageCount] = useState(0);
  const [jobCount, setJobCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  const loadBadges = useCallback(async () => {
    if (!user) return;
    const [messageCount, notifications, jobs] = await Promise.all([
      messagingService.getUnreadMessageCount(user.id),
      notificationService.getUserNotifications(user.id),
      user.role === "provider" ? bookingService.getProviderBookings(user.id) : bookingService.getCustomerBookings(user.id)
    ]);
    setMessageCount(messageCount);
    setNotificationCount(
      notifications.filter((item) => !item.isRead && item.type.includes(user.role === "provider" ? "payment" : "payment")).length
    );
    setJobCount(jobs.filter((item) => item.status === "Pending" || item.status === "Accepted" || item.status === "In Progress" || item.status === "On the Way").length);
  }, [user]);

  useEffect(() => {
    void loadBadges();
  }, [loadBadges]);

  useFocusEffect(
    useCallback(() => {
      void loadBadges();
    }, [loadBadges])
  );

  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (user.role === "provider" && !user.onboardingCompleted) {
    return <Redirect href="/provider/onboarding" />;
  }

  if (user.role === "provider" && user.approvalStatus !== "Approved") {
    return <Redirect href="/provider/pending" />;
  }

  const provider = user.role === "provider";

  return (
    <Tabs
      key={`${mode}-${theme.dark ? "tabs-dark" : "tabs-light"}`}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.dark ? "#8EA6C6" : "#8A94A6",
        tabBarStyle: {
          height: 72 + Math.max(insets.bottom, 12),
          paddingBottom: Math.max(insets.bottom, 12),
          paddingTop: 10,
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1
        },
        tabBarLabelStyle: { fontWeight: "700" },
        sceneStyle: { backgroundColor: theme.colors.background },
        freezeOnBlur: false,
        animation: "shift",
        lazy: false
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={20} color={color} /> }} />
      <Tabs.Screen
        name="bookings"
        options={{
          href: provider ? null : undefined,
          title: "Bookings",
          tabBarBadge: !provider && jobCount ? jobCount : undefined,
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={20} color={color} />
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          href: provider ? undefined : null,
          title: "Jobs",
          tabBarBadge: provider && jobCount ? jobCount : undefined,
          tabBarIcon: ({ color }) => <Ionicons name="briefcase-outline" size={20} color={color} />
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarBadge: messageCount ? messageCount : undefined,
          tabBarIcon: ({ color }) => <Ionicons name="chatbubble-outline" size={20} color={color} />
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          href: provider ? null : undefined,
          title: "Payments",
          tabBarBadge: !provider && notificationCount ? notificationCount : undefined,
          tabBarIcon: ({ color }) => <Ionicons name="card-outline" size={20} color={color} />
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          href: provider ? undefined : null,
          title: "Earnings",
          tabBarBadge: provider && notificationCount ? notificationCount : undefined,
          tabBarIcon: ({ color }) => <Ionicons name="wallet-outline" size={20} color={color} />
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={20} color={color} /> }} />
    </Tabs>
  );
}
