import { useEffect, useRef, useState } from "react";
import { Stack, router } from "expo-router";
import "../src/services/firebase";
import { notificationService } from "@kabisig/shared";
import { AuthProvider, useAuth } from "../src/hooks/AuthProvider";
import { ThemeProvider } from "../src/hooks/ThemeProvider";
import { AppStartupSplash, LaunchScreen } from "../src/components";
import { configureAppTypography } from "../src/utils/typography";
import {
  canUseAnyNotifications,
  canUseRemotePushNotifications,
  registerPushTokenForUser,
  requestNotificationPermission,
  scheduleForegroundNotification,
} from "../src/services/pushNotifications";

configureAppTypography();

type NotificationsModule = typeof import("expo-notifications");
const Notifications: NotificationsModule | null = (() => {
  if (!canUseAnyNotifications()) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  const subscribedAt = useRef(new Date());

  useEffect(() => {
    if (!user || !Notifications) return;

    let mounted = true;
    subscribedAt.current = new Date();
    seenIds.current = new Set<string>();

    if (canUseRemotePushNotifications()) {
      void registerPushTokenForUser(user.id).catch((error) => {
        console.warn("Unable to register push token:", error);
      });
    }

    void (async () => {
      await requestNotificationPermission();
    })();

    const unsubscribe = notificationService.subscribeUserNotifications(user.id, (items) => {
      if (!mounted) return;
      items
        .filter((item) => {
          if (item.isRead || seenIds.current.has(item.notificationId)) return false;
          const createdAt = new Date(item.createdAt);
          return Number.isFinite(createdAt.getTime()) && createdAt.getTime() >= subscribedAt.current.getTime() - 15000;
        })
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
  const { loading, signOut, user } = useAuth();
  const [redirectingRejectedProvider, setRedirectingRejectedProvider] = useState(false);

  useEffect(() => {
    if (user?.role !== "provider" || user.approvalStatus !== "Rejected") {
      setRedirectingRejectedProvider(false);
      return;
    }

    setRedirectingRejectedProvider(true);
    void signOut().finally(() => {
      router.replace("/(auth)/role-selection");
    });
  }, [signOut, user?.approvalStatus, user?.role]);

  if (loading || redirectingRejectedProvider) {
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
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setStarting(false), 2800);
    return () => clearTimeout(timeout);
  }, []);

  if (starting) {
    return <AppStartupSplash />;
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}
