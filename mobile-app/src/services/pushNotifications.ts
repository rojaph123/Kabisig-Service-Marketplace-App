import Constants from "expo-constants";
import { Platform } from "react-native";
import { pushTokenService } from "@kabisig/shared";

type PushRegistrationResult =
  | { ok: true; token: string; tokenId: string }
  | { ok: false; reason: string };

type NotificationsModule = typeof import("expo-notifications");

function getNotificationsModule(): NotificationsModule | null {
  if (!canUseAnyNotifications()) {
    return null;
  }

  try {
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

function getExpoProjectId() {
  const constants = Constants as typeof Constants & {
    easConfig?: { projectId?: string };
    manifest2?: { extra?: { eas?: { projectId?: string } } };
  };

  return (
    constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    constants.manifest2?.extra?.eas?.projectId
  );
}

function toTokenId(userId: string, token: string) {
  return `push-${userId}-${Platform.OS}-${token.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-96)}`;
}

function isExpoGoRuntime() {
  return Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient";
}

export function canUseAnyNotifications() {
  return Platform.OS !== "web";
}

export function canUseRemotePushNotifications() {
  return canUseAnyNotifications() && !isExpoGoRuntime();
}

export async function requestNotificationPermission() {
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return { granted: false };
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  if (currentPermission.granted) {
    return currentPermission;
  }

  return Notifications.requestPermissionsAsync();
}

export async function scheduleForegroundNotification(title: string, body: string) {
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null,
  });
}

export async function registerPushTokenForUser(userId: string): Promise<PushRegistrationResult> {
  if (!canUseRemotePushNotifications()) {
    return { ok: false, reason: "Remote push is unavailable in this runtime." };
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return { ok: false, reason: "expo-notifications is unavailable in this runtime." };
  }

  const finalPermission = await requestNotificationPermission();

  if (!finalPermission.granted) {
    return { ok: false, reason: "Notification permission was not granted." };
  }

  const projectId = getExpoProjectId();
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  const token = tokenResponse.data;
  const tokenId = toTokenId(userId, token);

  await pushTokenService.upsertToken({
    tokenId,
    userId,
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
    enabled: true,
    deviceName: Constants.deviceName || undefined,
  });

  return { ok: true, token, tokenId };
}
