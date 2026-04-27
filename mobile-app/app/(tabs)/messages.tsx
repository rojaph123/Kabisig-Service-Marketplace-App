import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { messagingService, userService, type Message, type MessageThread, type User } from "@kabisig/shared";
import { AppHeader, Avatar, EmptyState, FeedbackBanner, FixedScreen, LoadingState, SearchBar, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";

type InboxMode = "inbox" | "archived";

export default function MessagesTab() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [archivedThreads, setArchivedThreads] = useState<MessageThread[]>([]);
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const [unreadByThread, setUnreadByThread] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<InboxMode>("inbox");
  const [activeActionsThreadId, setActiveActionsThreadId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubscribe = messagingService.subscribeUserThreads(user.id, (allThreads) => {
      void (async () => {
        const chatmateIds = Array.from(
          new Set(
            allThreads
              .flatMap((thread) => thread.participants)
              .filter((participant) => participant !== user.id && participant !== "admin-support")
          )
        );

        const [users, messagesPerThread] = await Promise.all([
          userService.getUsersByIds(chatmateIds),
          Promise.all(allThreads.map((thread) => messagingService.getThreadMessages(thread.threadId)))
        ]);

        const inboxItems = allThreads.filter((thread) => !thread.archivedFor?.includes(user.id));
        const archivedItems = allThreads.filter((thread) => thread.archivedFor?.includes(user.id));
        const unreadMap = Object.fromEntries(
          allThreads.map((thread, index) => [
            thread.threadId,
            messagesPerThread[index].filter((message: Message) => message.senderId !== user.id && !message.readAt).length
          ])
        );

        setThreads(inboxItems.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        setArchivedThreads(archivedItems.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        setUsersById(Object.fromEntries(users.map((entry) => [entry.id, entry])));
        setUnreadByThread(unreadMap);
        setLoading(false);
      })();
    });

    return unsubscribe;
  }, [user]);

  const visibleThreads = mode === "inbox" ? threads : archivedThreads;

  const filteredThreads = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return visibleThreads.filter((thread) => {
      const chatmateId = thread.participants.find((participant) => participant !== user?.id);
      const chatmateName = chatmateId ? usersById[chatmateId]?.fullName || "Chatmate" : "Kabisig support";
      return !normalized || [thread.lastMessage, chatmateName].join(" ").toLowerCase().includes(normalized);
    });
  }, [search, visibleThreads, user?.id, usersById]);

  async function handleDelete(threadId: string) {
    try {
      await messagingService.deleteThread(threadId);
      setActiveActionsThreadId(null);
      setFeedback({
        type: "success",
        title: "Conversation deleted",
        message: "The thread and its messages were removed from your inbox."
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

  return (
    <FixedScreen
      header={
        <>
          <AppHeader title="Messages" />
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
        </>
      }
    >

      <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
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
                }}
                style={{
                  flex: 1,
                  borderRadius: 20,
                  paddingVertical: 13,
                  alignItems: "center",
                  backgroundColor: active ? theme.colors.primary : theme.colors.card,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  shadowColor: active ? theme.colors.primary : undefined,
                  shadowOpacity: active ? 0.16 : 0,
                  shadowRadius: active ? 10 : 0
                }}
              >
                <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800" }}>
                  {item.label} ({item.count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>

      <SearchBar placeholder="Search by name or message..." value={search} onChangeText={setSearch} />

      {loading ? <LoadingState label="Loading conversations..." /> : null}

      <View style={{ gap: 12 }}>
        {filteredThreads.map((thread) => {
          const supportThread = thread.bookingId.startsWith("support-");
          const chatmateId = thread.participants.find((participant) => participant !== user?.id);
          const chatmateName = supportThread
            ? "Kabisig support"
            : chatmateId
              ? usersById[chatmateId]?.fullName || usersById[chatmateId]?.email || "Conversation"
              : "Conversation";
          const unreadCount = unreadByThread[thread.threadId] || 0;
          const showActions = activeActionsThreadId === thread.threadId;

          return (
            <SurfaceCard
              key={thread.threadId}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                gap: 12,
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border
              }}
            >
              <Pressable
                onLongPress={() => setActiveActionsThreadId((current) => (current === thread.threadId ? null : thread.threadId))}
                onPress={() =>
                  router.push({
                    pathname: "/chat",
                    params: { threadId: thread.threadId, bookingId: thread.bookingId }
                  })
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: 22,
                  padding: 10,
                  backgroundColor: unreadCount
                    ? theme.dark
                      ? theme.colors.surfaceAlt
                      : theme.colors.surfaceAlt
                    : theme.dark
                      ? theme.colors.background
                      : theme.colors.card
                }}
              >
                <Avatar
                  image={chatmateId ? usersById[chatmateId]?.profilePhoto : ""}
                  size={54}
                  icon={supportThread ? "help-buoy-outline" : "person-outline"}
                  accentColor={supportThread ? theme.colors.accentDark : theme.colors.primaryDark}
                />

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <Text style={{ color: theme.colors.text, fontWeight: unreadCount ? "900" : "800", fontSize: 16 }}>
                      {chatmateName}
                    </Text>
                    <Text style={{ color: theme.colors.textLight, fontSize: 11 }}>{thread.updatedAt}</Text>
                  </View>
                  <Text
                    style={{
                      color: unreadCount ? theme.colors.text : theme.colors.textMuted,
                      marginTop: 5,
                      fontWeight: unreadCount ? "800" : "500"
                    }}
                    numberOfLines={2}
                  >
                    {thread.lastMessage || "No messages yet"}
                  </Text>
                </View>

                {unreadCount ? (
                  <View
                    style={{
                      minWidth: 24,
                      height: 24,
                      borderRadius: 12,
                      paddingHorizontal: 6,
                      backgroundColor: theme.colors.accent,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>

            </SurfaceCard>
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
      {activeActionsThreadId ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "rgba(2,8,23,0.35)",
            justifyContent: "center",
            paddingHorizontal: theme.spacing.lg
          }}
        >
          <SurfaceCard style={{ gap: 12, backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Conversation options</Text>
            <Text style={{ color: theme.colors.textMuted }}>
              Choose what you want to do with this thread.
            </Text>
            <Pressable
              onPress={() => void handleArchive(activeActionsThreadId)}
              style={{
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                backgroundColor: theme.colors.surfaceAlt,
                flexDirection: "row",
                justifyContent: "center",
                gap: 10
              }}
            >
              <Ionicons name={mode === "inbox" ? "archive-outline" : "refresh-outline"} size={18} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{mode === "inbox" ? "Archive" : "Restore"}</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleDelete(activeActionsThreadId)}
              style={{
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                backgroundColor: theme.colors.dangerSoft,
                flexDirection: "row",
                justifyContent: "center",
                gap: 10
              }}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              <Text style={{ color: theme.colors.danger, fontWeight: "800" }}>Delete</Text>
            </Pressable>
            <Pressable onPress={() => setActiveActionsThreadId(null)} style={{ paddingVertical: 12, alignItems: "center" }}>
              <Text style={{ color: theme.colors.textMuted, fontWeight: "800" }}>Cancel</Text>
            </Pressable>
          </SurfaceCard>
        </View>
      ) : null}
    </FixedScreen>
  );
}
