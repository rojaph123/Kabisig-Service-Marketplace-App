import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Easing, Modal, Platform, Pressable, Text, View } from "react-native";
import { messagingService, userService, type Message, type MessageThread, type User } from "@kabisig/shared";
import { AppHeader, Avatar, EmptyState, FixedScreen, LoadingState, SearchBar, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";

type InboxMode = "inbox" | "archived";

function formatThreadTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const today = new Date();
  const sameDay =
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate();

  if (sameDay) {
    return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }

  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sortThreadsForUser(items: MessageThread[], userId: string) {
  return [...items].sort((a, b) => {
    const aPinned = a.pinnedFor?.includes(userId) ? 1 : 0;
    const bPinned = b.pinnedFor?.includes(userId) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

async function getThreadMessagesSafely(thread: MessageThread): Promise<Message[]> {
  try {
    return await messagingService.getThreadMessages(thread.threadId);
  } catch (error) {
    console.warn("Unable to load messages for thread:", thread.threadId, error);
    return [];
  }
}

async function loadUserWithProfilePhoto(userId: string): Promise<User | null> {
  const userDoc = await userService.getUserDocument(userId);
  if (!userDoc) return null;

  if (userDoc.profilePhoto) {
    return userDoc;
  }

  if (userDoc.role === "provider") {
    const profile = await userService.getProviderProfile(userId).catch(() => null);
    return {
      ...userDoc,
      fullName: profile?.displayName || userDoc.fullName,
      profilePhoto: profile?.profilePhotoUrl || userDoc.profilePhoto || ""
    };
  }

  const profile = await userService.getCustomerProfile(userId).catch(() => null);
  return {
    ...userDoc,
    profilePhoto: profile?.profilePhotoUrl || userDoc.profilePhoto || ""
  };
}

export default function MessagesTab() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [archivedThreads, setArchivedThreads] = useState<MessageThread[]>([]);
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const [unreadByThread, setUnreadByThread] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<InboxMode>("inbox");
  const [activeActionsThreadId, setActiveActionsThreadId] = useState<string | null>(null);
  const previewScale = useRef(new Animated.Value(0.96)).current;
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const [selecting, setSelecting] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  const hydrateThreads = useCallback(async (allThreads: MessageThread[]) => {
    if (!user) return;
    const chatmateIds = Array.from(
      new Set(
        allThreads
          .flatMap((thread) => thread.participants)
          .filter((participant) => participant !== user.id && participant !== "admin-support")
      )
    );

    const [users, messagesPerThread] = await Promise.all([
      Promise.all(chatmateIds.map(loadUserWithProfilePhoto)).then((items) => items.filter((entry): entry is User => Boolean(entry))),
      Promise.all(allThreads.map(getThreadMessagesSafely))
    ]);

    const inboxItems = allThreads.filter((thread) => !thread.archivedFor?.includes(user.id));
    const archivedItems = allThreads.filter((thread) => thread.archivedFor?.includes(user.id));
    const unreadMap = Object.fromEntries(
      allThreads.map((thread, index) => [
        thread.threadId,
        messagesPerThread[index].filter((message: Message) => message.senderId !== user.id && !message.readBy?.[user.id]).length
      ])
    );

    setThreads(sortThreadsForUser(inboxItems, user.id));
    setArchivedThreads(sortThreadsForUser(archivedItems, user.id));
    setUsersById(Object.fromEntries(users.map((entry) => [entry.id, entry])));
    setUnreadByThread(unreadMap);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubscribe = messagingService.subscribeUserThreads(user.id, (allThreads) => {
      void hydrateThreads(allThreads);
    });

    return unsubscribe;
  }, [hydrateThreads, user]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const [inboxItems, archivedItems] = await Promise.all([
        messagingService.getUserThreads(user.id),
        messagingService.getArchivedThreads(user.id)
      ]);
      await hydrateThreads([...inboxItems, ...archivedItems]);
    } finally {
      setRefreshing(false);
    }
  }, [hydrateThreads, user]);

  const visibleThreads = mode === "inbox" ? threads : archivedThreads;

  const filteredThreads = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return visibleThreads.filter((thread) => {
      const chatmateId = thread.participants.find((participant) => participant !== user?.id);
      const chatmateName = chatmateId ? usersById[chatmateId]?.fullName || "Chatmate" : "Kabisig support";
      return !normalized || [thread.lastMessage, chatmateName].join(" ").toLowerCase().includes(normalized);
    });
  }, [search, visibleThreads, user?.id, usersById]);
  const allFilteredSelected = filteredThreads.length > 0 && selectedThreadIds.length === filteredThreads.length;
  const activeThread = useMemo(
    () => [...threads, ...archivedThreads].find((thread) => thread.threadId === activeActionsThreadId) || null,
    [activeActionsThreadId, archivedThreads, threads]
  );
  const activeChatmateId = activeThread?.participants.find((participant) => participant !== user?.id);
  const activeSupportThread = Boolean(activeThread?.bookingId.startsWith("support-"));
  const activeChatmateName = activeSupportThread
    ? "Kabisig support"
    : activeChatmateId
      ? usersById[activeChatmateId]?.fullName || usersById[activeChatmateId]?.email || "Conversation"
      : "Conversation";

  useEffect(() => {
    if (!activeActionsThreadId) {
      previewScale.setValue(0.96);
      previewOpacity.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(previewOpacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.spring(previewScale, {
        toValue: 1,
        damping: 14,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true
      })
    ]).start();
  }, [activeActionsThreadId, previewOpacity, previewScale]);

  function toggleThreadSelection(threadId: string) {
    setSelectedThreadIds((current) =>
      current.includes(threadId)
        ? current.filter((item) => item !== threadId)
        : [...current, threadId]
    );
  }

  function cancelSelection() {
    setSelecting(false);
    setSelectedThreadIds([]);
  }

  async function handleDelete(threadId: string) {
    if (!user) return;
    try {
      await messagingService.deleteThread(threadId);
      setActiveActionsThreadId(null);
      setFeedback({
        type: "success",
        title: "Conversation deleted",
        message: "The conversation and its message attachments were removed from storage."
      });
      // realtime listener will refresh the view automatically
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Delete failed",
        message: "We could not delete this conversation right now."
      });
    }
  }

  async function handleDeleteSelected() {
    if (!selectedThreadIds.length) return;
    try {
      await messagingService.deleteThreads(selectedThreadIds);
      setFeedback({
        type: "success",
        title: "Conversations deleted",
        message: "Selected conversations and their attachments were removed from storage."
      });
      cancelSelection();
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Delete failed",
        message: "We could not delete the selected conversations right now."
      });
    }
  }

  async function handleMarkSelectedUnread() {
    if (!user || !selectedThreadIds.length) return;
    try {
      await Promise.all(selectedThreadIds.map((threadId) => messagingService.markThreadAsUnread(threadId, user.id)));
      setFeedback({
        type: "success",
        title: "Marked unread",
        message: "Selected conversations are back in your unread queue."
      });
      cancelSelection();
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Unread update failed",
        message: "We could not mark the selected conversations as unread."
      });
    }
  }

  async function handleArchive(threadId: string) {
    if (!user) return;
    try {
      if (mode === "inbox") {
        await messagingService.archiveThread(threadId, user.id);
      } else {
        await messagingService.unarchiveThread(threadId, user.id);
      }
      setActiveActionsThreadId(null);
      setFeedback({
        type: "success",
        title: mode === "inbox" ? "Conversation archived" : "Conversation restored",
        message: mode === "inbox" ? "The conversation was moved to Archive." : "The conversation returned to your inbox."
      });
      // realtime listener will refresh the view automatically
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Archive failed",
        message: "We could not update this conversation right now."
      });
    }
  }

  async function handlePin(threadId: string) {
    if (!user) return;
    const selectedThread = [...threads, ...archivedThreads].find((entry) => entry.threadId === threadId);
    const isPinned = selectedThread?.pinnedFor?.includes(user.id);

    try {
      if (isPinned) {
        await messagingService.unpinThread(threadId, user.id);
      } else {
        await messagingService.pinThread(threadId, user.id);
      }
      setActiveActionsThreadId(null);
      setFeedback({
        type: "success",
        title: isPinned ? "Conversation unpinned" : "Conversation pinned",
        message: isPinned ? "This chat will follow normal inbox order." : "This chat will stay at the top of your inbox."
      });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Pin failed",
        message: "We could not update this conversation right now."
      });
    }
  }

  return (
    <FixedScreen
      safeAreaEdges={["top", "left", "right"]}
      contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
      refreshing={refreshing}
      onRefresh={() => void handleRefresh()}
      header={
        <>
          <AppHeader title="Messages" />
        </>
      }
    >

      <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt, marginBottom: -4, padding: 10 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { key: "inbox" as const, label: "Inbox", count: threads.length },
            { key: "archived" as const, label: "Archive", count: archivedThreads.length }
          ].map((item) => {
            const active = mode === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setMode(item.key);
                  setActiveActionsThreadId(null);
                  cancelSelection();
                }}
                style={{
                  flex: 1,
                  borderRadius: 13,
                  paddingVertical: 8,
                  alignItems: "center",
                  backgroundColor: active ? theme.colors.primary : theme.colors.card,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  ...(Platform.OS === "web"
                    ? { boxShadow: active ? "0 10px 22px rgba(37, 99, 235, 0.16)" : "none" }
                    : {
                        shadowColor: active ? theme.colors.primary : undefined,
                        shadowOpacity: active ? 0.16 : 0,
                        shadowRadius: active ? 10 : 0
                      })
                }}
              >
                <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800", fontSize: 11 }}>
                  {item.label} ({item.count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>

      <View style={{ marginTop: -4 }}>
        <SearchBar placeholder="Search by name or message..." value={search} onChangeText={setSearch} />
      </View>

      {filteredThreads.length ? (
        <SurfaceCard style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8 }}>
          {selecting ? (
            <>
              <Pressable
                onPress={() => setSelectedThreadIds(allFilteredSelected ? [] : filteredThreads.map((thread) => thread.threadId))}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 12 }}>{allFilteredSelected ? "Clear all" : "Select all"}</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleMarkSelectedUnread()}
                disabled={!selectedThreadIds.length}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", backgroundColor: selectedThreadIds.length ? theme.colors.primarySoft : theme.colors.surfaceAlt }}
              >
                <Text style={{ color: selectedThreadIds.length ? theme.colors.primaryDark : theme.colors.textLight, fontWeight: "800", fontSize: 12 }}>Unread</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleDeleteSelected()}
                disabled={!selectedThreadIds.length}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", backgroundColor: selectedThreadIds.length ? theme.colors.dangerSoft : theme.colors.surfaceAlt }}
              >
                <Text style={{ color: selectedThreadIds.length ? theme.colors.danger : theme.colors.textLight, fontWeight: "800", fontSize: 12 }}>Delete</Text>
              </Pressable>
              <Pressable onPress={cancelSelection} style={{ borderRadius: 12, padding: 9, backgroundColor: theme.colors.surfaceAlt }}>
                <Ionicons name="close-outline" size={18} color={theme.colors.text} />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => setSelecting(true)}
              style={{ flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 12 }}>Select conversations</Text>
            </Pressable>
          )}
        </SurfaceCard>
      ) : null}

      {loading ? <LoadingState label="Loading conversations..." /> : null}

      <View style={{ gap: 2 }}>
        {filteredThreads.map((thread) => {
          const supportThread = thread.bookingId.startsWith("support-");
          const chatmateId = thread.participants.find((participant) => participant !== user?.id);
          const chatmateName = supportThread
            ? "Kabisig support"
            : chatmateId
              ? usersById[chatmateId]?.fullName || usersById[chatmateId]?.email || "Conversation"
              : "Conversation";
          const unreadCount = unreadByThread[thread.threadId] || 0;
          const isPinned = user ? thread.pinnedFor?.includes(user.id) : false;
          const selected = selectedThreadIds.includes(thread.threadId);

          return (
            <Pressable
              key={thread.threadId}
              onLongPress={() => {
                setActiveActionsThreadId(thread.threadId);
              }}
              onPress={() => {
                if (selecting) {
                  toggleThreadSelection(thread.threadId);
                  return;
                }
                router.push({
                  pathname: "/chat",
                  params: { threadId: thread.threadId, bookingId: thread.bookingId }
                });
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderRadius: 16,
                paddingVertical: 8,
                paddingHorizontal: 8,
                backgroundColor: selected ? theme.colors.primarySoft : unreadCount ? theme.colors.surfaceAlt : "transparent"
              }}
            >
              {selecting ? (
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selected ? theme.colors.primary : theme.colors.border, backgroundColor: selected ? theme.colors.primary : theme.colors.card, alignItems: "center", justifyContent: "center" }}>
                  {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </View>
              ) : null}
              <Avatar
                image={chatmateId ? usersById[chatmateId]?.profilePhoto : ""}
                size={48}
                icon={supportThread ? "help-buoy-outline" : "person-outline"}
                accentColor={supportThread ? theme.colors.accentDark : theme.colors.primaryDark}
              />

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Text
                    style={{ color: theme.colors.text, fontWeight: unreadCount ? "900" : "800", fontSize: 15, flex: 1, minWidth: 0 }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {chatmateName}
                  </Text>
                  {isPinned ? <Ionicons name="pin" size={13} color={theme.colors.primaryDark} style={{ flexShrink: 0 }} /> : null}
                  <Text style={{ color: theme.colors.textLight, fontSize: 11, flexShrink: 0, maxWidth: 72, textAlign: "right" }} numberOfLines={1}>
                    {formatThreadTime(thread.updatedAt)}
                  </Text>
                </View>
                <Text
                  style={{
                    color: unreadCount ? theme.colors.text : theme.colors.textMuted,
                    marginTop: 3,
                    fontSize: 13,
                    fontWeight: unreadCount ? "800" : "500"
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {thread.lastMessage || "No messages yet"}
                </Text>
              </View>

              {unreadCount ? (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 11,
                    paddingHorizontal: 6,
                    backgroundColor: theme.colors.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}

        {!loading && !filteredThreads.length ? (
          <EmptyState
            title={mode === "inbox" ? "No conversations yet" : "No archived conversations"}
            description={
              mode === "inbox"
                ? "Chat threads will appear here after a booking conversation or support request starts."
                : "Archived conversations will appear here when you move them out of your main inbox."
            }
          />
        ) : null}
      </View>
      <Modal visible={Boolean(activeActionsThreadId)} transparent animationType="fade" onRequestClose={() => setActiveActionsThreadId(null)}>
        <Pressable
          onPress={() => setActiveActionsThreadId(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(2,8,23,0.42)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24
          }}
        >
          <View style={{ width: "100%", alignItems: "center", gap: 10 }}>
            <Animated.View style={{ width: "100%", maxWidth: 320, opacity: previewOpacity, transform: [{ scale: previewScale }] }}>
              <Pressable
                onPress={() => {
                  if (!activeThread) return;
                  setActiveActionsThreadId(null);
                  router.push({
                    pathname: "/chat",
                    params: { threadId: activeThread.threadId, bookingId: activeThread.bookingId }
                  });
                }}
              >
                <SurfaceCard style={{ gap: 9, padding: 13, backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Avatar
                      image={activeChatmateId ? usersById[activeChatmateId]?.profilePhoto : ""}
                      size={46}
                      icon={activeSupportThread ? "help-buoy-outline" : "person-outline"}
                      accentColor={activeSupportThread ? theme.colors.accentDark : theme.colors.primaryDark}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }} numberOfLines={1}>
                        {activeChatmateName}
                      </Text>
                      <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>
                        {activeThread?.lastMessage || "No messages yet"}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: theme.colors.primaryDark, fontSize: 11, fontWeight: "800", textAlign: "center" }}>Tap preview to open conversation</Text>
                </SurfaceCard>
              </Pressable>
            </Animated.View>

            <Animated.View style={{ width: 238, opacity: previewOpacity, transform: [{ scale: previewScale }] }}>
              <SurfaceCard style={{ padding: 8, gap: 6, backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
            <Pressable
              onPress={() => {
                if (!activeActionsThreadId) return;
                setSelecting(true);
                setSelectedThreadIds([activeActionsThreadId]);
                setActiveActionsThreadId(null);
              }}
              style={{
                borderRadius: 12,
                paddingVertical: 9,
                paddingHorizontal: 10,
                alignItems: "center",
                backgroundColor: theme.colors.surfaceAlt,
                flexDirection: "row",
                gap: 8
              }}
            >
              <Ionicons name="checkbox-outline" size={16} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 12 }}>Select</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!user || !activeActionsThreadId) return;
                void messagingService.markThreadAsUnread(activeActionsThreadId, user.id).then(() => {
                  setActiveActionsThreadId(null);
                  setFeedback({ type: "success", title: "Marked unread", message: "This conversation is marked unread." });
                });
              }}
              style={{
                borderRadius: 12,
                paddingVertical: 9,
                paddingHorizontal: 10,
                alignItems: "center",
                backgroundColor: theme.colors.surfaceAlt,
                flexDirection: "row",
                gap: 8
              }}
            >
              <Ionicons name="mail-unread-outline" size={16} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 12 }}>Mark as unread</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!activeActionsThreadId) return;
                void handlePin(activeActionsThreadId);
              }}
              style={{
                borderRadius: 12,
                paddingVertical: 9,
                paddingHorizontal: 10,
                alignItems: "center",
                backgroundColor: theme.colors.surfaceAlt,
                flexDirection: "row",
                gap: 8
              }}
            >
              <Ionicons
                name={[...threads, ...archivedThreads].find((thread) => thread.threadId === activeActionsThreadId)?.pinnedFor?.includes(user?.id || "") ? "pin" : "pin-outline"}
                size={16}
                color={theme.colors.text}
              />
              <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 12 }}>
                {[...threads, ...archivedThreads].find((thread) => thread.threadId === activeActionsThreadId)?.pinnedFor?.includes(user?.id || "") ? "Unpin" : "Pin"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!activeActionsThreadId) return;
                void handleArchive(activeActionsThreadId);
              }}
              style={{
                borderRadius: 12,
                paddingVertical: 9,
                paddingHorizontal: 10,
                alignItems: "center",
                backgroundColor: theme.colors.surfaceAlt,
                flexDirection: "row",
                gap: 8
              }}
            >
              <Ionicons name={mode === "inbox" ? "archive-outline" : "refresh-outline"} size={16} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 12 }}>{mode === "inbox" ? "Archive" : "Restore"}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!activeActionsThreadId) return;
                void handleDelete(activeActionsThreadId);
              }}
              style={{
                borderRadius: 12,
                paddingVertical: 9,
                paddingHorizontal: 10,
                alignItems: "center",
                backgroundColor: theme.colors.dangerSoft,
                flexDirection: "row",
                gap: 8
              }}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
              <Text style={{ color: theme.colors.danger, fontWeight: "800", fontSize: 12 }}>Delete permanently</Text>
            </Pressable>
            <Pressable onPress={() => setActiveActionsThreadId(null)} style={{ paddingVertical: 8, alignItems: "center" }}>
              <Text style={{ color: theme.colors.textMuted, fontWeight: "800", fontSize: 12 }}>Cancel</Text>
            </Pressable>
              </SurfaceCard>
            </Animated.View>
          </View>
        </Pressable>
      </Modal>
    </FixedScreen>
  );
}
