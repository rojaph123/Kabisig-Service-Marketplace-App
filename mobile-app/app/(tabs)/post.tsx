import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  categoryService,
  communityPostService,
  notificationService,
  userService,
  type CustomerProfile,
  type CommunityPost,
  type ProviderProfile,
  type ServiceCategory,
  type User
} from "@kabisig/shared";
import { AppHeader, Avatar, EmptyState, FeedbackBanner, MapPreviewModal, MultiMediaPickerField, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { requestCurrentLocation } from "../../src/services/location";
import { theme } from "../../src/theme";
import { readableAppError } from "../../src/utils/errors";
import { googleMapsEmbedUrl, googleMapsExternalUrl } from "../../src/utils/maps";

function getPostImageUris(post: CommunityPost) {
  return (post.attachmentItems?.length ? post.attachmentItems.map((media) => media.url) : post.attachments) || [];
}

function getPhotoId(post: CommunityPost, uri: string, index: number) {
  const existing = post.photoEngagements?.find((photo) => photo.url === uri);
  return existing?.photoId || post.attachmentItems?.find((media) => media.url === uri)?.id || `${post.postId}-photo-${index}`;
}

function FacebookPhotoGrid({
  postId,
  imageUris,
  width,
  onOpenPhoto
}: {
  postId: string;
  imageUris: string[];
  width: number;
  onOpenPhoto: (index: number) => void;
}) {
  if (!imageUris.length) return null;

  const gap = 2;
  const visible = imageUris.slice(0, 4);
  const remaining = imageUris.length - visible.length;
  const half = (width - gap) / 2;

  if (imageUris.length === 1) {
    return (
      <Pressable onPress={() => onOpenPhoto(0)}>
        <Image source={{ uri: imageUris[0] }} style={{ width, height: Math.min(width * 0.78, 360), backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
      </Pressable>
    );
  }

  if (imageUris.length === 2) {
    return (
      <View style={{ width, flexDirection: "row", gap }}>
        {visible.map((uri, index) => (
          <Pressable key={`${postId}-photo-${index}-${uri}`} onPress={() => onOpenPhoto(index)} style={{ width: half }}>
            <Image source={{ uri }} style={{ width: "100%", height: Math.min(width * 0.58, 280), backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
          </Pressable>
        ))}
      </View>
    );
  }

  if (imageUris.length === 3) {
    return (
      <View style={{ width, flexDirection: "row", gap }}>
        <Pressable onPress={() => onOpenPhoto(0)} style={{ width: half }}>
          <Image source={{ uri: imageUris[0] }} style={{ width: "100%", height: width * 0.72, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
        </Pressable>
        <View style={{ width: half, gap }}>
          {imageUris.slice(1, 3).map((uri, offset) => {
            const index = offset + 1;
            return (
              <Pressable key={`${postId}-photo-${index}-${uri}`} onPress={() => onOpenPhoto(index)}>
                <Image source={{ uri }} style={{ width: "100%", height: (width * 0.72 - gap) / 2, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={{ width, flexDirection: "row", flexWrap: "wrap", gap }}>
      {visible.map((uri, index) => (
        <Pressable key={`${postId}-photo-${index}-${uri}`} onPress={() => onOpenPhoto(index)} style={{ width: half, height: half }}>
          <Image source={{ uri }} style={{ width: "100%", height: "100%", backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
          {index === 3 && remaining > 0 ? (
            <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.54)" }}>
              <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900" }}>+{remaining}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function LoadingPopup({ visible, title, message }: { visible: boolean; title: string; message: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.34)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <SurfaceCard style={{ width: "100%", maxWidth: 320, alignItems: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "900", textAlign: "center" }}>{title}</Text>
          <Text style={{ color: theme.colors.textMuted, textAlign: "center", lineHeight: 20 }}>{message}</Text>
        </SurfaceCard>
      </View>
    </Modal>
  );
}

export default function PostTab() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ compose?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const keyboardOffset = Platform.OS === "ios" ? Math.max(insets.top, 12) : 0;
  const provider = user?.role === "provider";
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentAttachments, setCommentAttachments] = useState<Record<string, string[]>>({});
  const [expandedCommentPostIds, setExpandedCommentPostIds] = useState<string[]>([]);
  const [replyTargets, setReplyTargets] = useState<Record<string, string | undefined>>({});
  const [photoViewer, setPhotoViewer] = useState<{ postId: string; index: number } | null>(null);
  const [photoCommentDraft, setPhotoCommentDraft] = useState("");
  const [photoActionBusy, setPhotoActionBusy] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [actionPost, setActionPost] = useState<CommunityPost | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [postBody, setPostBody] = useState("");
  const [address, setAddress] = useState("");
  const [schedule, setSchedule] = useState("");
  const [pinLocation, setPinLocation] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [locating, setLocating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 1000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) || categories[0] || null,
    [categories, selectedCategoryId]
  );

  const providerServiceKeys = useMemo(
    () => new Set((providerProfile?.serviceCategories || []).map((item) => item.trim().toLowerCase()).filter(Boolean)),
    [providerProfile?.serviceCategories]
  );
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id.trim().toLowerCase(), (category.name || category.id).trim().toLowerCase()])),
    [categories]
  );
  const canProviderClaimPost = useCallback(
    (post: CommunityPost) => {
      if (!provider) return false;
      const postCategoryId = post.serviceCategoryId.trim().toLowerCase();
      const postServiceName = post.serviceName.trim().toLowerCase();
      const postCategoryName = categoryNameById.get(postCategoryId);
      return providerServiceKeys.has(postCategoryId) || providerServiceKeys.has(postServiceName) || Boolean(postCategoryName && providerServiceKeys.has(postCategoryName));
    },
    [categoryNameById, provider, providerServiceKeys]
  );

  const visiblePosts = useMemo(() => {
    return posts;
  }, [posts]);

  const hydrateUsers = useCallback(async (items: CommunityPost[]) => {
    const ids = [
      ...new Set(
        items
          .flatMap((post) => [post.customerId, post.claimedProviderId, ...post.comments.map((comment) => comment.userId)])
          .concat(items.flatMap((post) => (post.photoEngagements || []).flatMap((photo) => photo.comments.map((comment) => comment.userId))))
          .filter((id): id is string => Boolean(id))
      )
    ];
    const users = await userService.getUsersByIds(ids);
    setUsersById(Object.fromEntries(users.map((entry) => [entry.id, entry])));
  }, []);

  const loadCategories = useCallback(async () => {
    const nextCategories = await categoryService.getAllCategories();
    setCategories(nextCategories);
    setSelectedCategoryId((current) => current || nextCategories[0]?.id || "");
    if (user?.role === "customer") {
      setCustomerProfile(await userService.getCustomerProfile(user.id));
      setProviderProfile(null);
    } else if (user?.role === "provider") {
      setProviderProfile(await userService.getProviderProfile(user.id));
      setCustomerProfile(null);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    void loadCategories();
    const unsubscribe = communityPostService.subscribePosts((items) => {
      setPosts(items);
      void hydrateUsers(items);
    }, user?.id);
    return unsubscribe;
  }, [hydrateUsers, loadCategories, user?.id]);

  useEffect(() => {
    if (params.compose === "1" && !provider) {
      setEditingPost(null);
      setPostBody("");
      setAddress("");
      setSchedule("");
      setPinLocation("");
      setAttachments([]);
      setSelectedCategoryId((current) => current || categories[0]?.id || "");
      setShowComposer(true);
      router.setParams({ compose: undefined });
    }
  }, [categories, params.compose, provider]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadCategories();
      await hydrateUsers(posts);
    } finally {
      setRefreshing(false);
    }
  }

  async function createPost() {
    if (!user || provider || !selectedCategory || !postBody.trim() || !address.trim()) {
      setFeedback({ type: "error", title: "Post incomplete", message: "Choose a service, describe the job, and add the service location." });
      return;
    }

    setPosting(true);
    try {
      const postData = {
        customerId: user.id,
        serviceCategoryId: selectedCategory.id,
        serviceName: selectedCategory.name,
        body: postBody.trim(),
        address: address.trim(),
        location: pinLocation || address.trim(),
        preferredSchedule: schedule.trim() || "Flexible schedule",
        amount: Number(selectedCategory.startingPrice || 0),
        attachments
      };
      if (editingPost) {
        await communityPostService.updatePost(editingPost.postId, postData);
      } else {
        await communityPostService.createPost(postData);
      }
      setPostBody("");
      setAddress("");
      setSchedule("");
      setPinLocation("");
      setAttachments([]);
      setEditingPost(null);
      setShowComposer(false);
      setFeedback({
        type: "success",
        title: editingPost ? "Post updated" : "Post published",
        message: editingPost ? "Your service post was updated." : "Workers can now see your request and claim it first come, first served."
      });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", title: "Post failed", message: readableAppError(error, "We could not post this request right now.") });
    } finally {
      setPosting(false);
    }
  }

  function openComposerForCreate() {
    setEditingPost(null);
    setPostBody("");
    setAddress("");
    setSchedule("");
    setPinLocation("");
    setAttachments([]);
    setSelectedCategoryId((current) => current || categories[0]?.id || "");
    setShowComposer(true);
  }

  function openComposerForEdit(post: CommunityPost) {
    setEditingPost(post);
    setSelectedCategoryId(post.serviceCategoryId);
    setPostBody(post.body);
    setAddress(post.address);
    setSchedule(post.preferredSchedule || "");
    setPinLocation(post.location || "");
    setAttachments((post.attachmentItems?.length ? post.attachmentItems.map((media) => media.url) : post.attachments) || []);
    setActionPost(null);
    setShowComposer(true);
  }

  async function deletePost(post: CommunityPost) {
    if (!user || post.customerId !== user.id) return;
    setBusyPostId(post.postId);
    setActionPost(null);
    try {
      await communityPostService.deletePost(post.postId);
      setFeedback({ type: "success", title: "Post deleted", message: "Your post and attached photos were removed." });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", title: "Delete failed", message: readableAppError(error, "We could not delete this post right now.") });
    } finally {
      setBusyPostId(null);
    }
  }

  async function handleUseGpsLocation() {
    if (locating) return;
    setLocating(true);
    try {
      const location = await requestCurrentLocation();
      if (!location.granted) {
        setFeedback({ type: "error", title: "Location permission needed", message: "Please allow location access or choose one of your saved addresses." });
        return;
      }
      setPinLocation(location.label);
      setFeedback({ type: "success", title: "GPS captured", message: "Your map pin is ready for this post." });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", title: "Location unavailable", message: readableAppError(error, "We could not get your current location right now.") });
    } finally {
      setLocating(false);
    }
  }

  const savedAddresses = useMemo(() => {
    const entries = [customerProfile?.defaultLocation || "", ...(customerProfile?.addresses || [])]
      .map((item) => item.trim())
      .filter(Boolean);
    return entries.filter((item, index) => entries.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === index);
  }, [customerProfile?.addresses, customerProfile?.defaultLocation]);

  async function toggleLike(post: CommunityPost) {
    if (!user) return;
    await communityPostService.toggleLike(post.postId, user.id);
  }

  function toggleComments(postId: string) {
    setExpandedCommentPostIds((current) =>
      current.includes(postId) ? current.filter((item) => item !== postId) : [...current, postId]
    );
  }

  async function addComment(post: CommunityPost) {
    if (!user) return;
    const draft = commentDrafts[post.postId]?.trim();
    const draftAttachments = commentAttachments[post.postId] || [];
    if (!draft && !draftAttachments.length) return;
    const replyTargetId = replyTargets[post.postId];
    setCommentDrafts((current) => ({ ...current, [post.postId]: "" }));
    setCommentAttachments((current) => ({ ...current, [post.postId]: [] }));
    setReplyTargets((current) => ({ ...current, [post.postId]: undefined }));
    try {
      if (replyTargetId) {
        await communityPostService.addCommentReply(post.postId, replyTargetId, user.id, draft, draftAttachments);
      } else {
        await communityPostService.addComment(post.postId, user.id, draft, draftAttachments);
      }
    } catch (error) {
      console.error(error);
      setCommentDrafts((current) => ({ ...current, [post.postId]: draft }));
      setCommentAttachments((current) => ({ ...current, [post.postId]: draftAttachments }));
      setReplyTargets((current) => ({ ...current, [post.postId]: replyTargetId }));
      setFeedback({ type: "error", title: "Comment failed", message: readableAppError(error, "We could not post your comment right now.") });
    }
  }

  async function togglePhotoLike(post: CommunityPost, uri: string, index: number) {
    if (!user || photoActionBusy) return;
    setPhotoActionBusy(true);
    try {
      await communityPostService.togglePhotoLike(post.postId, getPhotoId(post, uri, index), uri, user.id);
    } finally {
      setPhotoActionBusy(false);
    }
  }

  async function addPhotoComment(post: CommunityPost, uri: string, index: number) {
    if (!user || photoActionBusy || !photoCommentDraft.trim()) return;
    const draft = photoCommentDraft.trim();
    setPhotoCommentDraft("");
    setPhotoActionBusy(true);
    try {
      await communityPostService.addPhotoComment(post.postId, getPhotoId(post, uri, index), uri, user.id, draft);
    } catch (error) {
      console.error(error);
      setPhotoCommentDraft(draft);
      setFeedback({ type: "error", title: "Comment failed", message: readableAppError(error, "We could not add your photo comment right now.") });
    } finally {
      setPhotoActionBusy(false);
    }
  }

  async function pickCommentPhotos(postId: string) {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = true;
      input.onchange = () => {
        const files = Array.from(input.files || []);
        void Promise.all(
          files.map(
            (file) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = reject;
                reader.readAsDataURL(file);
              })
          )
        ).then((values) => {
          setCommentAttachments((current) => ({ ...current, [postId]: [...(current[postId] || []), ...values] }));
        });
      };
      input.click();
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFeedback({ type: "error", title: "Photos unavailable", message: "Please allow photo access to attach images to a comment." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true
    });
    if (result.canceled || !result.assets.length) return;
    const values = result.assets
      .map((asset) => (asset.base64 ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}` : null))
      .filter(Boolean) as string[];
    setCommentAttachments((current) => ({ ...current, [postId]: [...(current[postId] || []), ...values] }));
  }

  async function claimPost(post: CommunityPost) {
    if (!user || !provider || busyPostId) return;
    if (!canProviderClaimPost(post)) {
      setFeedback({ type: "info", title: "Service not offered", message: "You can view and comment on this post, but only matching service providers can book it." });
      return;
    }
    setBusyPostId(post.postId);
    try {
      const bookingId = await communityPostService.claimPostAsBooking(post.postId, user.id);
      await notificationService.createNotification({
        userId: post.customerId,
        type: "booking_status_update",
        title: "Worker claimed your post",
        body: `${user.fullName} claimed your ${post.serviceName.toLowerCase()} post. Please confirm the booking.`,
        isRead: false,
        route: `/booking-detail?bookingId=${bookingId}`,
        createdAt: new Date().toISOString()
      });
      setFeedback({ type: "success", title: "Post claimed", message: "This request is now in your bookings. The customer will confirm next." });
      router.push({ pathname: "/booking-detail", params: { bookingId } });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", title: "Cannot claim request", message: readableAppError(error, "This post may have been claimed by another worker first.") });
    } finally {
      setBusyPostId(null);
    }
  }

  const renderPost = ({ item }: { item: CommunityPost }) => {
    const author = usersById[item.customerId];
    const liked = Boolean(user && item.likes.includes(user.id));
    const open = item.status === "Open";
    const booked = item.status === "Booked";
    const owner = Boolean(user && item.customerId === user.id);
    const serviceMatch = canProviderClaimPost(item);
    const commentsOpen = expandedCommentPostIds.includes(item.postId);
    const replyTargetId = replyTargets[item.postId];
    const replyTarget = item.comments.find((comment) => comment.commentId === replyTargetId);
    const imageUris = getPostImageUris(item);
    const cardMediaWidth = Math.max(width - theme.spacing.lg * 2 - 2, 260);
    return (
      <SurfaceCard style={{ padding: 0, gap: 0, overflow: "hidden", opacity: booked ? 0.86 : 1, position: "relative", zIndex: actionPost?.postId === item.postId ? 20 : 0, elevation: actionPost?.postId === item.postId ? 8 : 0 }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center", padding: 12 }}>
          <Avatar image={author?.profilePhoto} size={38} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 14 }} numberOfLines={1}>{author?.fullName || "Customer"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>{new Date(item.createdAt).toLocaleString()}</Text>
              <Ionicons name="earth-outline" size={12} color={theme.colors.textMuted} />
            </View>
          </View>
          <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: open ? theme.colors.successSoft : theme.colors.surfaceAlt }}>
            <Text style={{ color: open ? theme.colors.success : theme.colors.textMuted, fontSize: 10, fontWeight: "900" }}>{open ? "Available" : "Booked"}</Text>
          </View>
          {owner ? (
            <View>
              <Pressable onPress={() => setActionPost((current) => current?.postId === item.postId ? null : item)} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt }}>
                <Ionicons name="ellipsis-horizontal" size={17} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {actionPost?.postId === item.postId ? (
          <View style={{ position: "absolute", top: 52, right: 10, zIndex: 30, elevation: 10, width: 172, borderRadius: 14, padding: 6, gap: 5, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
            {open ? (
              <Pressable onPress={() => openComposerForEdit(item)} style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, alignItems: "center", flexDirection: "row", gap: 8, backgroundColor: theme.colors.surfaceAlt }}>
                <Ionicons name="create-outline" size={15} color={theme.colors.text} />
                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 12 }}>Edit request</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => void deletePost(item)} disabled={busyPostId === item.postId} style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, alignItems: "center", flexDirection: "row", gap: 8, backgroundColor: theme.colors.dangerSoft, opacity: busyPostId === item.postId ? 0.7 : 1 }}>
              <Ionicons name="trash-outline" size={15} color={theme.colors.danger} />
              <Text style={{ color: theme.colors.danger, fontWeight: "900", fontSize: 12 }}>{busyPostId === item.postId ? "Deleting..." : "Delete request"}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ gap: 8, paddingHorizontal: 12, paddingBottom: 10 }}>
          <Text style={{ color: theme.colors.text, lineHeight: 18, fontSize: 12 }}>{item.body}</Text>
          <View style={{ borderRadius: 12, padding: 9, gap: 4, backgroundColor: theme.colors.surfaceAlt }}>
            <Text style={{ color: theme.colors.primaryDark, fontWeight: "900", fontSize: 12 }}>Job type: {item.serviceName}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Schedule: {item.preferredSchedule || "Flexible schedule"}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Location: {item.address}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Starting budget: ₱{item.amount.toLocaleString()}</Text>
          </View>
        </View>

        <FacebookPhotoGrid postId={item.postId} imageUris={imageUris} width={cardMediaWidth} onOpenPhoto={(index) => setPhotoViewer({ postId: item.postId, index })} />

        <View style={{ paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{item.likes.length} like{item.likes.length === 1 ? "" : "s"}</Text>
          <Pressable onPress={() => toggleComments(item.postId)} disabled={!item.comments.length}>
            <Text style={{ color: item.comments.length ? theme.colors.textMuted : theme.colors.textLight, fontSize: 11 }}>
              {item.comments.length} comment{item.comments.length === 1 ? "" : "s"}
            </Text>
          </Pressable>
        </View>

        <View style={{ height: 1, backgroundColor: theme.colors.border }} />

        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
          <Pressable
            onPress={() => void toggleLike(item)}
            style={{ flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5, backgroundColor: liked ? theme.colors.primarySoft : "transparent" }}
          >
            <Ionicons name={liked ? "thumbs-up" : "thumbs-up-outline"} size={16} color={liked ? theme.colors.primaryDark : theme.colors.textMuted} />
            <Text style={{ color: liked ? theme.colors.primaryDark : theme.colors.textMuted, fontWeight: "900", fontSize: 12 }}>{liked ? "Liked" : "Like"}</Text>
          </Pressable>
          {provider ? (
            <Pressable
              onPress={() => void claimPost(item)}
              disabled={!open || Boolean(busyPostId) || !serviceMatch}
              style={{
                flex: 1,
                borderRadius: 10,
                paddingVertical: 8,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 6,
                backgroundColor: open && serviceMatch ? theme.colors.primary : theme.colors.surfaceAlt,
                opacity: busyPostId === item.postId ? 0.75 : 1
              }}
            >
              <Ionicons name={open && serviceMatch ? "briefcase-outline" : !open ? "checkmark-circle-outline" : "ban-outline"} size={15} color={open && serviceMatch ? theme.colors.textOnPrimary : theme.colors.textMuted} />
              <Text style={{ color: open && serviceMatch ? theme.colors.textOnPrimary : theme.colors.textMuted, fontWeight: "900", fontSize: 11, textAlign: "center", flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                {busyPostId === item.postId ? "Claiming..." : !open ? "Booked" : serviceMatch ? "Book" : "Not matched"}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => toggleComments(item.postId)}
            style={{ flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5, backgroundColor: commentsOpen ? theme.colors.primarySoft : "transparent" }}
          >
            <Ionicons name="chatbubble-outline" size={16} color={commentsOpen ? theme.colors.primaryDark : theme.colors.textMuted} />
            <Text style={{ color: commentsOpen ? theme.colors.primaryDark : theme.colors.textMuted, fontWeight: "900", fontSize: 12 }}>Comment</Text>
          </Pressable>
        </View>

        {commentsOpen && item.comments.length ? (
          <View style={{ gap: 8, paddingHorizontal: 14 }}>
            {item.comments.slice(-2).map((comment) => (
              <View key={comment.commentId} style={{ borderRadius: 16, padding: 10, backgroundColor: theme.colors.surfaceAlt }}>
                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 12 }}>
                  {usersById[comment.userId]?.fullName || "User"}
                </Text>
                {comment.body ? <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12, lineHeight: 17 }}>{comment.body}</Text> : null}
                {comment.attachmentItems?.length || comment.attachments?.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {((comment.attachmentItems?.length ? comment.attachmentItems.map((media) => media.url) : comment.attachments) || []).map((uri, index) => (
                      <View key={`${comment.commentId}-${uri}-${index}`} style={{ pointerEvents: "none" }}>
                        <Image source={{ uri }} style={{ width: 78, height: 78, borderRadius: 12, backgroundColor: theme.colors.card }} />
                      </View>
                    ))}
                  </View>
                ) : null}
                <Pressable
                  onPress={() => {
                    setReplyTargets((current) => ({ ...current, [item.postId]: comment.commentId }));
                    if (!commentsOpen) toggleComments(item.postId);
                  }}
                  style={{ alignSelf: "flex-start", marginTop: 8 }}
                >
                  <Text style={{ color: theme.colors.primaryDark, fontSize: 12, fontWeight: "900" }}>Reply</Text>
                </Pressable>
                {comment.replies?.length ? (
                  <View style={{ marginTop: 8, marginLeft: 12, gap: 8, borderLeftWidth: 2, borderLeftColor: theme.colors.border, paddingLeft: 10 }}>
                    {comment.replies.slice(-2).map((reply) => (
                      <View key={reply.commentId} style={{ borderRadius: 14, padding: 9, backgroundColor: theme.colors.card }}>
                        <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 12 }}>
                          {usersById[reply.userId]?.fullName || "User"}
                        </Text>
                        {reply.body ? <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12 }}>{reply.body}</Text> : null}
                        {reply.attachmentItems?.length || reply.attachments?.length ? (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                            {((reply.attachmentItems?.length ? reply.attachmentItems.map((media) => media.url) : reply.attachments) || []).map((uri, index) => (
                              <View key={`${reply.commentId}-${uri}-${index}`} style={{ pointerEvents: "none" }}>
                                <Image source={{ uri }} style={{ width: 68, height: 68, borderRadius: 10, backgroundColor: theme.colors.surfaceAlt }} />
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {commentsOpen && commentAttachments[item.postId]?.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 14 }}>
            {commentAttachments[item.postId].map((uri, index) => (
              <View key={`${item.postId}-draft-${index}`} style={{ width: 62, height: 62 }}>
                <Image source={{ uri }} style={{ width: 62, height: 62, borderRadius: 12, backgroundColor: theme.colors.surfaceAlt }} />
                <Pressable
                  onPress={() =>
                    setCommentAttachments((current) => ({
                      ...current,
                      [item.postId]: (current[item.postId] || []).filter((_, itemIndex) => itemIndex !== index)
                    }))
                  }
                  style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.danger }}
                >
                  <Ionicons name="close" size={13} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {commentsOpen && replyTarget ? (
          <View style={{ marginHorizontal: 14, borderRadius: 12, padding: 10, backgroundColor: theme.colors.primarySoft, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ flex: 1, color: theme.colors.primaryDark, fontSize: 12, fontWeight: "800" }} numberOfLines={1}>
              Replying to {usersById[replyTarget.userId]?.fullName || "comment"}
            </Text>
            <Pressable onPress={() => setReplyTargets((current) => ({ ...current, [item.postId]: undefined }))}>
              <Ionicons name="close" size={16} color={theme.colors.primaryDark} />
            </Pressable>
          </View>
        ) : null}

        {commentsOpen ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingHorizontal: 14 }}>
          <Pressable onPress={() => void pickCommentPhotos(item.postId)} style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt }}>
            <Ionicons name="image-outline" size={18} color={theme.colors.success} />
          </Pressable>
          <TextInput
            value={commentDrafts[item.postId] || ""}
            onChangeText={(value) => setCommentDrafts((current) => ({ ...current, [item.postId]: value }))}
            placeholder="Write a comment..."
            placeholderTextColor={theme.colors.textLight}
            style={{
              flex: 1,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: theme.colors.text,
              backgroundColor: theme.colors.surfaceAlt,
              fontSize: 12
            }}
          />
          <Pressable onPress={() => void addComment(item)} style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.primary }}>
            <Ionicons name="send" size={16} color={theme.colors.textOnPrimary} />
          </Pressable>
        </View>
        ) : null}
      </SurfaceCard>
    );
  };

  const activePhotoPost = photoViewer ? posts.find((post) => post.postId === photoViewer.postId) || null : null;
  const activePhotoUris = activePhotoPost ? getPostImageUris(activePhotoPost) : [];
  const activePhotoUri = photoViewer ? activePhotoUris[photoViewer.index] : "";
  const activePhotoId = activePhotoPost && activePhotoUri && photoViewer ? getPhotoId(activePhotoPost, activePhotoUri, photoViewer.index) : "";
  const activePhoto = activePhotoPost?.photoEngagements?.find((photo) => photo.photoId === activePhotoId || photo.url === activePhotoUri);
  const activePhotoLiked = Boolean(user && activePhoto?.likes?.includes(user.id));
  const activePhotoAuthor = activePhotoPost ? usersById[activePhotoPost.customerId] : null;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: 6, gap: 8 }}>
          <AppHeader title="News Feed" />
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
          {!provider ? (
            <SurfaceCard style={{ gap: 9, padding: 12 }}>
              <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
                <Avatar image={user?.profilePhoto} size={34} />
                <Pressable onPress={openComposerForCreate} style={{ flex: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: theme.colors.surfaceAlt }}>
                  <Text style={{ color: theme.colors.textMuted, fontWeight: "700", fontSize: 13 }}>What service do you need?</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={openComposerForCreate} style={{ flex: 1, borderRadius: 11, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, backgroundColor: theme.colors.surfaceAlt }}>
                  <Ionicons name="images-outline" size={15} color={theme.colors.success} />
                  <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 13 }}>Photo</Text>
                </Pressable>
                <Pressable onPress={openComposerForCreate} style={{ flex: 1, borderRadius: 11, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, backgroundColor: theme.colors.surfaceAlt }}>
                  <Ionicons name="location-outline" size={15} color={theme.colors.danger} />
                  <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 13 }}>Location</Text>
                </Pressable>
              </View>
            </SurfaceCard>
          ) : null}
        </View>

        <FlatList
          data={visiblePosts}
          keyExtractor={(item) => item.postId}
          renderItem={renderPost}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl + Math.max(insets.bottom, 8), gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
          ListEmptyComponent={<EmptyState title="No feed activity yet" description="Customer service requests will appear here for discussion, recommendations, and matching workers." icon="newspaper-outline" />}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        />
      </KeyboardAvoidingView>

      <Modal visible={showComposer} transparent animationType="fade" onRequestClose={() => setShowComposer(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
          <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.34)", justifyContent: "flex-end", paddingHorizontal: 18, paddingTop: 18, paddingBottom: Math.max(insets.bottom, 18) }}>
            <SurfaceCard style={{ width: "100%", maxHeight: "88%", padding: 0, overflow: "hidden" }}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, padding: 16 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Create request</Text>
                  <Pressable onPress={() => setShowComposer(false)} style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt }}>
                    <Ionicons name="close" size={20} color={theme.colors.textMuted} />
                  </Pressable>
                </View>

                <View style={{ height: 1, backgroundColor: theme.colors.border }} />

                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <Avatar image={user?.profilePhoto} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.colors.text, fontWeight: "900" }} numberOfLines={1}>
                      {user?.fullName || "Customer"}
                    </Text>
                    <View style={{ alignSelf: "flex-start", marginTop: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}>
                      <Ionicons name="earth-outline" size={12} color={theme.colors.textMuted} />
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "800" }}>Workers can see this</Text>
                    </View>
                  </View>
                </View>

                <TextInput
                  value={postBody}
                  onChangeText={setPostBody}
                  placeholder="What service do you need?"
                  placeholderTextColor={theme.colors.textLight}
                  multiline
                  style={{ minHeight: 108, borderRadius: 16, padding: 12, color: theme.colors.text, backgroundColor: theme.colors.card, textAlignVertical: "top", fontSize: 14, lineHeight: 20 }}
                />

                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt, padding: 12, gap: 10 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Add to your request</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable onPress={() => void handleUseGpsLocation()} style={{ flex: 1, borderRadius: 13, paddingVertical: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: theme.colors.card }}>
                      <Ionicons name="navigate-outline" size={16} color={theme.colors.primary} />
                      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 12 }}>GPS</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowMapPreview(true)}
                      disabled={!pinLocation && !address.trim()}
                      style={{ flex: 1, borderRadius: 13, paddingVertical: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: theme.colors.card, opacity: pinLocation || address.trim() ? 1 : 0.55 }}
                    >
                      <Ionicons name="map-outline" size={16} color={theme.colors.danger} />
                      <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 12 }}>Preview</Text>
                    </Pressable>
                  </View>
                  <MultiMediaPickerField
                    label="Photos"
                    values={attachments}
                    onChange={setAttachments}
                    helper="Attach clear photos so workers can understand the work before claiming."
                    maxSizeMb={8}
                    onError={(message) => setFeedback({ type: "error", title: "Upload issue", message })}
                  />
                </View>

                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 12, gap: 10, backgroundColor: theme.colors.card }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="briefcase-outline" size={18} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Job details</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {categories.map((category) => {
                      const active = selectedCategoryId === category.id;
                      return (
                        <Pressable
                          key={category.id}
                          onPress={() => setSelectedCategoryId(category.id)}
                          style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt }}
                        >
                          <Text style={{ color: active ? theme.colors.textOnPrimary : theme.colors.text, fontSize: 12, fontWeight: "900" }}>{category.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput value={schedule} onChangeText={setSchedule} placeholder="Preferred schedule, optional" placeholderTextColor={theme.colors.textLight} style={{ borderRadius: 14, padding: 12, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, fontSize: 12 }} />
                </View>

                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 12, gap: 10, backgroundColor: theme.colors.card }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="location-outline" size={18} color={theme.colors.danger} />
                    <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Service location</Text>
                  </View>
                  {savedAddresses.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {savedAddresses.map((savedAddress) => (
                          <Pressable
                            key={savedAddress}
                            onPress={() => setAddress(savedAddress)}
                            style={{
                              maxWidth: 220,
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              paddingVertical: 7,
                              backgroundColor: address === savedAddress ? theme.colors.primary : theme.colors.surfaceAlt
                            }}
                          >
                            <Text style={{ color: address === savedAddress ? theme.colors.textOnPrimary : theme.colors.text, fontSize: 12, fontWeight: "800" }} numberOfLines={1}>
                              {savedAddress}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  ) : null}
                  <TextInput value={address} onChangeText={setAddress} placeholder="Type service address" placeholderTextColor={theme.colors.textLight} style={{ borderRadius: 14, padding: 12, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, fontSize: 12 }} />
                  {pinLocation ? (
                    <Text style={{ color: theme.colors.success, fontSize: 12, fontWeight: "800" }}>GPS pin is ready for map preview.</Text>
                  ) : null}
                </View>

                <Pressable onPress={() => void createPost()} disabled={posting} style={{ borderRadius: 16, paddingVertical: 14, alignItems: "center", backgroundColor: theme.colors.primary, opacity: posting ? 0.7 : 1 }}>
                  <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>{posting ? "Posting..." : "Post request"}</Text>
                </Pressable>
              </ScrollView>
            </SurfaceCard>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <MapPreviewModal
        visible={showMapPreview}
        title="Post location"
        subtitle={address || pinLocation || "Selected location"}
        mapUrl={googleMapsEmbedUrl(pinLocation || address)}
        onClose={() => setShowMapPreview(false)}
        onOpenExternal={() => void Linking.openURL(googleMapsExternalUrl(pinLocation || address))}
      />
      <Modal
        visible={Boolean(activePhotoPost && activePhotoUri)}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setPhotoViewer(null);
          setPhotoCommentDraft("");
        }}
      >
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1, backgroundColor: "#05070A" }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Pressable
                onPress={() => {
                  setPhotoViewer(null);
                  setPhotoCommentDraft("");
                }}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" }}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
              <Avatar image={activePhotoAuthor?.profilePhoto} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontWeight: "900" }} numberOfLines={1}>
                  {activePhotoAuthor?.fullName || "Customer"}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 12 }}>
                  {photoViewer ? `${photoViewer.index + 1} of ${activePhotoUris.length}` : "Photo"}
                </Text>
              </View>
            </View>

            <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#000" }}>
              {activePhotoUri ? (
                <Image source={{ uri: activePhotoUri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
              ) : null}
              {photoViewer && activePhotoUris.length > 1 ? (
                <>
                  <Pressable
                    onPress={() => setPhotoViewer({ postId: photoViewer.postId, index: Math.max(photoViewer.index - 1, 0) })}
                    disabled={photoViewer.index === 0}
                    style={{ position: "absolute", left: 12, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.52)", opacity: photoViewer.index === 0 ? 0.35 : 1 }}
                  >
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={() => setPhotoViewer({ postId: photoViewer.postId, index: Math.min(photoViewer.index + 1, activePhotoUris.length - 1) })}
                    disabled={photoViewer.index === activePhotoUris.length - 1}
                    style={{ position: "absolute", right: 12, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.52)", opacity: photoViewer.index === activePhotoUris.length - 1 ? 0.35 : 1 }}
                  >
                    <Ionicons name="chevron-forward" size={24} color="#fff" />
                  </Pressable>
                </>
              ) : null}
            </View>

            {activePhotoPost && activePhotoUri && photoViewer ? (
              <View style={{ maxHeight: "42%", backgroundColor: theme.colors.card, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10), gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                    {(activePhoto?.likes || []).length} like{(activePhoto?.likes || []).length === 1 ? "" : "s"} • {(activePhoto?.comments || []).length} comment{(activePhoto?.comments || []).length === 1 ? "" : "s"}
                  </Text>
                  <Pressable
                    onPress={() => void togglePhotoLike(activePhotoPost, activePhotoUri, photoViewer.index)}
                    disabled={photoActionBusy}
                    style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: activePhotoLiked ? theme.colors.primarySoft : theme.colors.surfaceAlt, opacity: photoActionBusy ? 0.65 : 1 }}
                  >
                    <Ionicons name={activePhotoLiked ? "thumbs-up" : "thumbs-up-outline"} size={16} color={activePhotoLiked ? theme.colors.primaryDark : theme.colors.textMuted} />
                    <Text style={{ color: activePhotoLiked ? theme.colors.primaryDark : theme.colors.textMuted, fontWeight: "900", fontSize: 12 }}>{activePhotoLiked ? "Liked" : "Like"}</Text>
                  </Pressable>
                </View>

                <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
                  {(activePhoto?.comments || []).length ? (
                    (activePhoto?.comments || []).map((comment) => (
                      <View key={comment.commentId} style={{ borderRadius: 14, padding: 10, backgroundColor: theme.colors.surfaceAlt }}>
                        <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 12 }}>
                          {usersById[comment.userId]?.fullName || "User"}
                        </Text>
                        <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12, lineHeight: 17 }}>{comment.body}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>No comments on this photo yet.</Text>
                  )}
                </ScrollView>

                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <TextInput
                    value={photoCommentDraft}
                    onChangeText={setPhotoCommentDraft}
                    placeholder="Write a comment on this photo..."
                    placeholderTextColor={theme.colors.textLight}
                    style={{ flex: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 11, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, fontSize: 12 }}
                  />
                  <Pressable
                    onPress={() => void addPhotoComment(activePhotoPost, activePhotoUri, photoViewer.index)}
                    disabled={photoActionBusy || !photoCommentDraft.trim()}
                    style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.primary, opacity: photoActionBusy || !photoCommentDraft.trim() ? 0.55 : 1 }}
                  >
                    <Ionicons name="send" size={17} color={theme.colors.textOnPrimary} />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <LoadingPopup visible={posting} title="Posting request" message="Uploading photos and posting your service request." />
      <LoadingPopup visible={locating} title="Finding GPS location" message="Please wait while we get your current location for the map preview." />
    </SafeAreaView>
  );
}
