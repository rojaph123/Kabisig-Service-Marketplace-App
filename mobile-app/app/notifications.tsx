import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";
import { formatReadableDateTime, notificationService, type NotificationItem } from "@kabisig/shared";
import { router } from "expo-router";
import { BackHeader, EmptyState, FeedbackBanner, FixedScreen, FullScreenPopup, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";

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
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);
  const [popup, setPopup] = useState<{ tone: "success" | "error"; title: string; message: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "markAllRead" | "deleteAll";
    title: string;
    message: string;
    confirmLabel: string;
    tone: "info" | "error";
  } | null>(null);
  const [loadingAction, setLoadingAction] = useState<{
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = notificationService.subscribeUserNotifications(user.id, (items) => {
      const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setNotifications(sorted);
    });
    return unsubscribe;
  }, [user]);

  const allSelected = notifications.length > 0 && selectedIds.length === notifications.length;

  function toggleSelection(notificationId: string) {
    setSelectedIds((current) =>
      current.includes(notificationId)
        ? current.filter((item) => item !== notificationId)
        : [...current, notificationId]
    );
  }

  async function markSelectedAsRead() {
    if (!selectedIds.length) return;
    try {
      await notificationService.markManyAsRead(selectedIds);
      setSelectedIds([]);
      setSelecting(false);
      setFeedback({ type: "success", title: "Notifications updated", message: "Selected notifications were marked as read." });
      setPopup({ tone: "success", title: "Marked as read", message: "Selected notifications are now marked as read." });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Update failed",
        message: "We could not mark those notifications as read right now."
      });
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((item) => !item.isRead).map((item) => item.notificationId);
    if (!unreadIds.length) return;
    try {
      setLoadingAction({
        title: "Marking all as read",
        message: "Please wait while we update your notifications."
      });
      await notificationService.markManyAsRead(unreadIds);
      setFeedback({ type: "success", title: "Notifications updated", message: "All notifications were marked as read." });
      setPopup({ tone: "success", title: "Marked all as read", message: "All unread notifications are now marked as read." });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Update failed",
        message: "We could not mark all notifications as read right now."
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function openNotification(item: NotificationItem) {
    if (!item.isRead) {
      void notificationService.markAsRead(item.notificationId).catch((error) => {
        console.warn("Unable to mark notification as read:", error);
      });
    }
    if (item.route) router.push(item.route as never);
  }

  async function deleteSelected() {
    if (!selectedIds.length) return;
    try {
      await notificationService.deleteMany(selectedIds);
      setFeedback({ type: "success", title: "Notifications deleted", message: "Selected notifications were removed." });
      setPopup({ tone: "success", title: "Notifications deleted", message: "Selected notifications were removed." });
      setSelectedIds([]);
      setSelecting(false);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Delete failed",
        message: "We could not delete those notifications yet. Please make sure the latest Firebase functions and rules are deployed."
      });
    }
  }

  async function deleteAll() {
    if (!user || !notifications.length) return;
    try {
      setLoadingAction({
        title: "Deleting notifications",
        message: "Please wait while we clear your notification list."
      });
      await notificationService.deleteAllForUser(user.id);
      setFeedback({ type: "success", title: "Notifications deleted", message: "All notifications were removed." });
      setPopup({ tone: "success", title: "All notifications deleted", message: "Your notification list has been cleared." });
      setSelectedIds([]);
      setSelecting(false);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Delete failed",
        message: "We could not delete all notifications yet. Please make sure the latest Firebase functions and rules are deployed."
      });
    } finally {
      setLoadingAction(null);
    }
  }

  function requestMarkAllAsReadConfirmation() {
    const unreadCount = notifications.filter((item) => !item.isRead).length;
    if (!unreadCount) return;
    setConfirmAction({
      type: "markAllRead",
      title: "Mark all as read?",
      message: `This will mark ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} as read.`,
      confirmLabel: "Mark all read",
      tone: "info"
    });
  }

  function requestDeleteAllConfirmation() {
    if (!notifications.length) return;
    setConfirmAction({
      type: "deleteAll",
      title: "Delete all notifications?",
      message: `This will permanently remove ${notifications.length} notification${notifications.length === 1 ? "" : "s"} from your list.`,
      confirmLabel: "Delete all",
      tone: "error"
    });
  }

  async function handleConfirmedAction() {
    if (!confirmAction) return;
    const nextAction = confirmAction.type;
    setConfirmAction(null);
    if (nextAction === "markAllRead") {
      await markAllAsRead();
      return;
    }
    await deleteAll();
  }

  return (
    <FixedScreen
      style={{ backgroundColor: theme.colors.background }}
      header={
        <>
          <BackHeader title="Notifications" onBack={() => router.back()} />
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
        </>
      }
    >
      {notifications.length ? (
        <SurfaceCard style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10 }}>
          {selecting ? (
            <>
              <Pressable
                onPress={() => setSelectedIds(allSelected ? [] : notifications.map((item) => item.notificationId))}
                style={{ flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{allSelected ? "Clear all" : "Select all"}</Text>
              </Pressable>
              <Pressable
                onPress={() => void markSelectedAsRead()}
                disabled={!selectedIds.length}
                style={{ flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: "center", backgroundColor: selectedIds.length ? theme.colors.primarySoft : theme.colors.surfaceAlt }}
              >
                <Text style={{ color: selectedIds.length ? theme.colors.primaryDark : theme.colors.textLight, fontWeight: "800" }}>Mark read</Text>
              </Pressable>
              <Pressable
                onPress={() => void deleteSelected()}
                disabled={!selectedIds.length}
                style={{ flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: "center", backgroundColor: selectedIds.length ? theme.colors.dangerSoft : theme.colors.surfaceAlt }}
              >
                <Text style={{ color: selectedIds.length ? theme.colors.danger : theme.colors.textLight, fontWeight: "800" }}>
                  Delete {selectedIds.length || ""}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSelecting(false);
                  setSelectedIds([]);
                }}
                style={{ borderRadius: 14, padding: 11, backgroundColor: theme.colors.surfaceAlt }}
              >
                <Ionicons name="close-outline" size={18} color={theme.colors.text} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => setSelecting(true)}
                style={{ flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Select</Text>
              </Pressable>
              <Pressable
                onPress={requestMarkAllAsReadConfirmation}
                style={{ flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: "center", backgroundColor: theme.colors.primarySoft }}
              >
                <Text style={{ color: theme.colors.primaryDark, fontWeight: "800" }}>Mark all read</Text>
              </Pressable>
              <Pressable
                onPress={requestDeleteAllConfirmation}
                style={{ flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: "center", backgroundColor: theme.colors.dangerSoft }}
              >
                <Text style={{ color: theme.colors.danger, fontWeight: "800" }}>Delete all</Text>
              </Pressable>
            </>
          )}
        </SurfaceCard>
      ) : null}

      <View style={{ gap: 12 }}>
        {notifications.length ? (
          notifications.map((item) => {
            const visual = notificationIcon(item.type);
            const selected = selectedIds.includes(item.notificationId);
            const unread = !item.isRead;
            const unreadBackground = theme.dark ? "rgba(59, 130, 246, 0.18)" : "#EEF6FF";
            const selectedBackground = theme.dark ? "rgba(14, 165, 233, 0.22)" : theme.colors.primarySoft;
            return (
              <Pressable
                key={item.notificationId}
                onLongPress={() => {
                  setSelecting(true);
                  toggleSelection(item.notificationId);
                }}
                onPress={() => {
                  if (selecting) {
                    toggleSelection(item.notificationId);
                    return;
                  }
                  void openNotification(item);
                }}
              >
                <SurfaceCard
                  style={{
                    flexDirection: "row",
                    gap: 14,
                    alignItems: "flex-start",
                    borderColor: selected ? theme.colors.primary : unread ? theme.colors.primary : theme.colors.border,
                    backgroundColor: selected ? selectedBackground : unread ? unreadBackground : theme.colors.card
                  }}
                >
                  {selecting ? (
                    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selected ? theme.colors.primary : theme.colors.border, backgroundColor: selected ? theme.colors.primary : theme.colors.card, alignItems: "center", justifyContent: "center" }}>
                      {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                    </View>
                  ) : null}
                  <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: visual.bg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={visual.icon as keyof typeof Ionicons.glyphMap} size={22} color={visual.tint} />
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: unread ? "900" : "800", flex: 1 }}>{item.title}</Text>
                      {unread ? <View style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: "#1877F2", marginTop: 4 }} /> : null}
                    </View>
                    <Text style={{ color: theme.dark ? theme.colors.text : unread ? theme.colors.text : theme.colors.textMuted, lineHeight: 20 }}>{item.body}</Text>
                    <Text style={{ color: theme.colors.textLight, fontSize: 12 }}>{formatReadableDateTime(item.createdAt)}</Text>
                  </View>
                </SurfaceCard>
              </Pressable>
            );
          })
        ) : (
          <EmptyState title="No notifications yet" description="Booking updates, new messages, provider approvals, and support replies will appear here." />
        )}
      </View>
      <FullScreenPopup
        visible={!!popup}
        tone={popup?.tone || "success"}
        icon={popup?.tone === "error" ? "alert-circle" : "checkmark-circle"}
        title={popup?.title || ""}
        message={popup?.message || ""}
        dismissLabel="Okay"
        onDismiss={() => setPopup(null)}
      />
      <Modal visible={!!confirmAction} transparent animationType="fade" onRequestClose={() => setConfirmAction(null)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.32)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24
          }}
        >
          <SurfaceCard style={{ width: "100%", maxWidth: 340, paddingVertical: 24, gap: 16, alignItems: "center" }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: confirmAction?.tone === "error" ? theme.colors.dangerSoft : theme.colors.infoSoft,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons
                name={confirmAction?.tone === "error" ? "trash-outline" : "mail-open-outline"}
                size={36}
                color={confirmAction?.tone === "error" ? theme.colors.danger : theme.colors.info}
              />
            </View>
            <View style={{ gap: 8, alignItems: "center" }}>
              <Text style={{ color: theme.colors.text, fontSize: 21, fontWeight: "900", textAlign: "center" }}>
                {confirmAction?.title || ""}
              </Text>
              <Text style={{ color: theme.colors.textMuted, textAlign: "center" }}>{confirmAction?.message || ""}</Text>
            </View>
            <View style={{ width: "100%", flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setConfirmAction(null)}
                style={{
                  flex: 1,
                  borderRadius: 16,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: theme.colors.surfaceAlt
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirmedAction()}
                style={{
                  flex: 1,
                  borderRadius: 16,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: confirmAction?.tone === "error" ? theme.colors.danger : theme.colors.primary
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>{confirmAction?.confirmLabel || "Continue"}</Text>
              </Pressable>
            </View>
          </SurfaceCard>
        </View>
      </Modal>
      <Modal visible={!!loadingAction} transparent animationType="fade" onRequestClose={() => {}}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.32)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24
          }}
        >
          <SurfaceCard style={{ width: "100%", maxWidth: 340, paddingVertical: 28, gap: 14, alignItems: "center" }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: theme.colors.infoSoft,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="sync-outline" size={36} color={theme.colors.info} />
            </View>
            <View style={{ gap: 8, alignItems: "center" }}>
              <Text style={{ color: theme.colors.text, fontSize: 21, fontWeight: "900", textAlign: "center" }}>
                {loadingAction?.title || ""}
              </Text>
              <Text style={{ color: theme.colors.textMuted, textAlign: "center" }}>{loadingAction?.message || ""}</Text>
            </View>
          </SurfaceCard>
        </View>
      </Modal>
    </FixedScreen>
  );
}
