import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { mediaService, messagingService, notificationService, userService, type MediaAttachment, type Message, type MessageThread, type User } from "@kabisig/shared";
import { Avatar, EmptyState, FeedbackBanner, LoadingState, MediaPreviewModal } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";
import { readableAppError } from "../src/utils/errors";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function pickMediaFiles(existingValues: string[]) {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return existingValues;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true
    });

    if (result.canceled || !result.assets.length) return existingValues;

    const nextValues = result.assets
      .map((asset) => {
        if (asset.base64) {
          const mime = asset.mimeType || "image/jpeg";
          return `data:${mime};base64,${asset.base64}`;
        }
        return null;
      })
      .filter(Boolean) as string[];

    if (nextValues.length !== result.assets.length) {
      return existingValues;
    }

    return [...existingValues, ...nextValues];
  }

  return await new Promise<string[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (!files.length) {
        resolve(existingValues);
        return;
      }

      Promise.all(
        files.map(
          (file) =>
            new Promise<string>((next) => {
              const reader = new FileReader();
              reader.onload = () => next(typeof reader.result === "string" ? reader.result : "");
              reader.readAsDataURL(file);
            })
        )
      ).then((nextValues) => resolve([...existingValues, ...nextValues.filter(Boolean)]));
    };
    input.click();
  });
}

function formatBubbleTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function messageDateKey(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toDateString();
}

function formatDateDivider(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (parsed.toDateString() === today.toDateString()) return "Today";
  if (parsed.toDateString() === yesterday.toDateString()) return "Yesterday";

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: parsed.getFullYear() === today.getFullYear() ? undefined : "numeric"
  });
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

export default function ChatScreen() {
  const params = useLocalSearchParams<{ threadId?: string | string[]; bookingId?: string | string[]; otherId?: string | string[] }>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardOffset = Platform.OS === "ios" ? Math.max(insets.top, 12) : 0;
  const [threadId, setThreadId] = useState<string | null>(firstParam(params.threadId) ?? null);
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success" | "info"; title: string; message: string } | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message> | null>(null);
  const initialScrollDone = useRef(false);
  const ownBubbleBackground = theme.dark ? theme.colors.primary : "#DCEBFF";
  const ownBubbleBorder = theme.dark ? theme.colors.accentDark : "#B5D3FF";
  const ownBubbleText = theme.dark ? "#FFFFFF" : theme.colors.text;
  const ownMetaText = theme.dark ? "rgba(255,255,255,0.74)" : theme.colors.textMuted;
  const bubbleMaxWidth = Math.min(width * 0.74, 330);
  const incomingBubbleMaxWidth = Math.min(width * 0.66, 300);
  const isPinned = user && thread ? thread.pinnedFor?.includes(user.id) : false;

  const loadThread = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let activeThreadId = firstParam(params.threadId) ?? null;
      const bookingId = firstParam(params.bookingId);
      const requestedOtherId = firstParam(params.otherId);

      if (!activeThreadId && requestedOtherId) {
        const resolvedBookingId = bookingId || `direct-${[user.id, requestedOtherId].sort().join("-")}`;
        activeThreadId = await messagingService.getOrCreateThread(resolvedBookingId, [user.id, requestedOtherId]);
      }

      setThreadId(activeThreadId);
      if (!activeThreadId) {
        setThread(null);
        setOtherUser(null);
        setMessages([]);
        return;
      }

      const threads = await messagingService.getUserThreads(user.id);
      const activeThread = threads.find((entry) => entry.threadId === activeThreadId) || null;
      setThread(activeThread);

      const resolvedOtherId =
        requestedOtherId ||
        activeThread?.participants.find((participant) => participant !== user.id) ||
        null;

      if (resolvedOtherId) {
        const otherDoc = await loadUserWithProfilePhoto(resolvedOtherId);
        setOtherUser(otherDoc);
      } else {
        setOtherUser(null);
      }

      const nextMessages = await messagingService.getThreadMessages(activeThreadId);
      setMessages(nextMessages.sort((a, b) => a.sentAt.localeCompare(b.sentAt)));
      await messagingService.markThreadAsRead(activeThreadId, user.id);
    } finally {
      setLoading(false);
    }
  }, [params.bookingId, params.otherId, params.threadId, user]);

  useFocusEffect(
    useCallback(() => {
      void loadThread();
    }, [loadThread])
  );

  const canSend = useMemo(() => Boolean(threadId && user && !sending && !uploadingAttachment && (draft.trim() || attachments.length)), [attachments.length, draft, sending, threadId, uploadingAttachment, user]);

  useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd?.({ animated: initialScrollDone.current });
      initialScrollDone.current = true;
    });
  }, [messages]);

  useEffect(() => {
    if (!threadId) return;
    const unsubscribe = messagingService.subscribeThreadMessages(threadId, (nextMessages) => {
      setMessages([...nextMessages].sort((a, b) => a.sentAt.localeCompare(b.sentAt)));
      if (user) {
        void messagingService.markThreadAsRead(threadId, user.id);
      }
    });
    return unsubscribe;
  }, [threadId, user]);

  async function handleSend() {
    if (!threadId || !user || (!draft.trim() && !attachments.length)) return;
    setSending(true);
    setFeedback({
      type: "info",
      title: "Sending message",
      message: "Your message is on its way."
    });
    try {
      await messagingService.sendMessage(threadId, user.id, draft.trim() || "Shared media", attachments);
      const recipientId = otherUser?.id || thread?.participants.find((participant) => participant !== user.id);
      if (recipientId) {
        await notificationService.createNotification({
          userId: recipientId,
          type: "message_unread",
          title: "New message",
          body: `${user.fullName}: ${draft.trim()}`,
          isRead: false,
          route: "/(tabs)/messages",
          createdAt: new Date().toISOString()
        });
      }
      setDraft("");
      setAttachments([]);
      setFeedback(null);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Message not sent",
        message: readableAppError(error, "We could not send your message right now.")
      });
    } finally {
      setSending(false);
    }
  }

  async function handlePickPhotos() {
    if (!threadId || !user || uploadingAttachment) return;
    setUploadingAttachment(true);
    setFeedback({
      type: "info",
      title: "Uploading photo",
      message: "Your photo is being prepared while you type."
    });
    try {
      const picked = await pickMediaFiles([]);
      if (!picked.length) {
        setFeedback(null);
        return;
      }
      const uploaded = await mediaService.uploadMany(picked, `messageDrafts/${threadId}/${user.id}`, user.id);
      setAttachments((current) => [...current, ...uploaded]);
      setFeedback(null);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Photo upload failed",
        message: readableAppError(error, "We could not upload this photo right now.")
      });
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function handlePinToggle() {
    if (!threadId || !user) return;
    try {
      if (isPinned) {
        await messagingService.unpinThread(threadId, user.id);
        setThread((current) =>
          current ? { ...current, pinnedFor: (current.pinnedFor ?? []).filter((entry) => entry !== user.id) } : current
        );
      } else {
        await messagingService.pinThread(threadId, user.id);
        setThread((current) =>
          current ? { ...current, pinnedFor: Array.from(new Set([...(current.pinnedFor ?? []), user.id])) } : current
        );
      }
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Pin failed",
        message: readableAppError(error, "We could not update this conversation right now.")
      });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
        <View style={{ flex: 1 }}>
          <MediaPreviewModal visible={!!previewUri} uri={previewUri} title="Message Attachment" onClose={() => setPreviewUri(null)} />
          <View
            style={{
              pointerEvents: "none",
              position: "absolute",
              top: 96,
              right: -30,
              width: 180,
              height: 180,
              borderRadius: 999,
              backgroundColor: theme.dark ? "rgba(56,189,248,0.10)" : "rgba(14,165,233,0.10)"
            }}
          />
          <View
            style={{
              pointerEvents: "none",
              position: "absolute",
              bottom: 130,
              left: -40,
              width: 220,
              height: 220,
              borderRadius: 999,
              backgroundColor: theme.dark ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.08)"
            }}
          />
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.md,
              paddingBottom: theme.spacing.sm,
              gap: 12,
              backgroundColor: theme.colors.background,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
              zIndex: 5,
              elevation: 5
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingBottom: 6
              }}
            >
              <Pressable
                onPress={() => router.back()}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.colors.surfaceAlt
                }}
              >
                <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
              </Pressable>
              <Avatar image={otherUser?.profilePhoto} size={42} />
              <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 17, flex: 1 }} numberOfLines={1}>
                {otherUser?.fullName || "Conversation"}
              </Text>
              {threadId ? (
                <Pressable
                  onPress={() => void handlePinToggle()}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isPinned ? theme.colors.primarySoft : theme.colors.surfaceAlt
                  }}
                >
                  <Ionicons name={isPinned ? "pin" : "pin-outline"} size={18} color={isPinned ? theme.colors.primaryDark : theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
          </View>

          {loading ? (
            <View style={{ paddingHorizontal: theme.spacing.lg }}>
              <LoadingState label="Loading messages..." />
            </View>
          ) : threadId ? (
            <FlatList
              ref={(ref) => {
                listRef.current = ref;
              }}
              data={messages}
              keyExtractor={(item) => item.messageId}
              onLayout={() => {
                requestAnimationFrame(() => {
                  listRef.current?.scrollToEnd?.({ animated: false });
                });
              }}
              onContentSizeChange={() => {
                requestAnimationFrame(() => {
                  listRef.current?.scrollToEnd?.({ animated: initialScrollDone.current });
                });
              }}
              contentContainerStyle={{
                paddingHorizontal: theme.spacing.lg,
                paddingTop: 8,
                paddingBottom: 16 + Math.max(insets.bottom, 0),
                gap: 10,
                flexGrow: messages.length ? 0 : 1
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              bounces={false}
              alwaysBounceVertical={false}
              renderItem={({ item, index }) => {
                const mine = item.senderId === user?.id;
                const nextMessage = messages[index + 1];
                const previousMessage = messages[index - 1];
                const showSeen = mine && (!nextMessage || nextMessage.senderId !== user?.id);
                const showDateDivider = !previousMessage || messageDateKey(previousMessage.sentAt) !== messageDateKey(item.sentAt);

                return (
                  <View style={{ width: "100%", gap: 10 }}>
                    {showDateDivider ? (
                      <View style={{ alignItems: "center", marginVertical: 4 }}>
                        <Text
                          style={{
                            color: theme.colors.textMuted,
                            fontSize: 12,
                            fontWeight: "800",
                            backgroundColor: theme.colors.surfaceAlt,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 999,
                            overflow: "hidden"
                          }}
                        >
                          {formatDateDivider(item.sentAt)}
                        </Text>
                      </View>
                    ) : null}
                    <View style={{ alignSelf: mine ? "flex-end" : "flex-start", width: "100%", alignItems: mine ? "flex-end" : "flex-start" }}>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "flex-end",
                        justifyContent: mine ? "flex-end" : "flex-start",
                        width: "100%"
                      }}
                    >
                      {!mine ? <Avatar image={otherUser?.profilePhoto} size={30} /> : null}
                      <View style={{ maxWidth: mine ? bubbleMaxWidth : incomingBubbleMaxWidth, minWidth: item.text.trim().length <= 8 ? 96 : 72, flexShrink: 1 }}>
                        <View
                          style={{
                            backgroundColor: mine ? ownBubbleBackground : theme.colors.card,
                            borderRadius: 22,
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderWidth: 1,
                            borderColor: mine ? ownBubbleBorder : theme.colors.border,
                            ...theme.shadow
                          }}
                        >
                          <Text style={{ color: mine ? ownBubbleText : theme.colors.text, lineHeight: 20, flexShrink: 1 }}>{item.text}</Text>
                          {item.attachments?.length ? (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                              {item.attachments.map((uri, attachmentIndex) => (
                                <Pressable
                                  key={`${item.messageId}-${attachmentIndex}`}
                                  onPress={() => setPreviewUri(uri)}
                                  style={{ width: 76, height: 76, borderRadius: 16, overflow: "hidden", backgroundColor: theme.colors.surfaceAlt }}
                                >
                                  <Avatar image={uri} size={76} icon="image-outline" />
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                          <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 6, minWidth: 58 }}>
                            <Text style={{ color: mine ? ownMetaText : theme.colors.textMuted, fontSize: 11 }}>
                              {formatBubbleTime(item.sentAt)}
                            </Text>
                            {mine && showSeen ? (
                              <Ionicons
                                name={item.readAt ? "checkmark-done-outline" : "checkmark-outline"}
                                size={14}
                                color={item.readAt ? "#BAE6FD" : ownMetaText}
                              />
                            ) : null}
                          </View>
                        </View>
                      </View>
                    </View>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <EmptyState
                  title="Start the conversation"
                  description="Send the first message to begin coordinating the visit, provider details, or support request."
                />
              }
            />
          ) : (
            <View style={{ paddingHorizontal: theme.spacing.lg, flex: 1 }}>
              <EmptyState
                title="No chat thread yet"
                description="Open chat from a booking or provider profile so the app can create the correct conversation thread."
              />
            </View>
          )}

          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: theme.colors.background,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              gap: 10
            }}
          >
            {attachments.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {attachments.map((item, attachmentIndex) => (
                  <View key={`${item.id || item.url}-${attachmentIndex}`} style={{ width: 76, gap: 6 }}>
                    <Pressable onPress={() => setPreviewUri(item.url)}>
                      <Avatar image={item.url} size={76} icon="image-outline" />
                    </Pressable>
                    <Pressable onPress={() => setAttachments(attachments.filter((_, index) => index !== attachmentIndex))}>
                      <Text style={{ textAlign: "center", color: theme.colors.danger, fontSize: 12, fontWeight: "700" }}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
                borderRadius: 22,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
                padding: 8
              }}
            >
              <Pressable
                onPress={() => void handlePickPhotos()}
                disabled={uploadingAttachment}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: uploadingAttachment ? theme.colors.primarySoft : theme.colors.surfaceAlt,
                  opacity: uploadingAttachment ? 0.72 : 1
                }}
              >
                <Ionicons name="image-outline" size={20} color={theme.colors.primaryDark} />
              </Pressable>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                style={{
                  flex: 1,
                  maxHeight: 110,
                  minHeight: 42,
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  color: theme.colors.text
                }}
              />
              <Pressable
                disabled={!canSend}
                onPress={() => void handleSend()}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: canSend ? theme.colors.primary : theme.colors.border
                }}
              >
                {sending ? (
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>...</Text>
                ) : (
                  <Ionicons name="send" size={18} color={canSend ? "#fff" : theme.colors.textMuted} />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
