import { useEffect, useRef } from "react";
import { Stack } from "expo-router";
import "../src/services/firebase";
import { notificationService } from "@kabisig/shared";
import { AuthProvider, useAuth } from "../src/hooks/AuthProvider";
import { ThemeProvider } from "../src/hooks/ThemeProvider";
import { LaunchScreen } from "../src/components";
import {
  canUseAnyNotifications,
  canUseRemotePushNotifications,
  registerPushTokenForUser,
  requestNotificationPermission,
  scheduleForegroundNotification,
} from "../src/services/pushNotifications";

type NotificationsModule = typeof import("expo-notifications");
const Notifications: NotificationsModule | null = (() => {
  if (!canUseAnyNotifications()) {
    return null;
  }

  try {
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
})();

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function ForegroundNotificationBridge() {
  const { user } = useAuth();
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!user || !Notifications) return;

    let mounted = true;

    if (canUseRemotePushNotifications()) {
      void registerPushTokenForUser(user.id).catch((error) => {
        console.warn("Unable to register push token:", error);
      });
      return () => {
        mounted = false;
      };
    }

    void (async () => {
      await requestNotificationPermission();
    })();

    const unsubscribe = notificationService.subscribeUserNotifications(user.id, (items) => {
      if (!mounted) return;
      items
        .filter((item) => !item.isRead && !seenIds.current.has(item.notificationId))
        .forEach((item) => {
          seenIds.current.add(item.notificationId);
          void scheduleForegroundNotification(item.title, item.body);
        });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [user]);

  return null;
}

function AppNavigator() {
  const { loading } = useAuth();

  if (loading) {
    return <LaunchScreen />;
  }

  return (
    <>
      <ForegroundNotificationBridge />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}
