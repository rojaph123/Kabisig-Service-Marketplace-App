import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import {
  bookingService,
  categoryService,
  communityPostService,
  paymentService,
  userService,
  type Booking,
  type CommunityPost,
  type CustomerProfile,
  type Payment,
  type ProviderProfile,
  type ServiceCategory
} from "@kabisig/shared";
import { AppHeader, Avatar, FeedbackBanner, FixedScreen, LaunchScreen, LoadingState, MultiMediaPickerField, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { useThemeMode } from "../../src/hooks/ThemeProvider";
import { theme } from "../../src/theme";
import { readableAppError } from "../../src/utils/errors";

type ProfileTabKey = "posts" | "earnings" | "more";

function ProfileStat({
  label,
  value,
  icon,
  tone = "blue",
  compact = false
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "blue" | "orange" | "green" | "rose";
  compact?: boolean;
}) {
  const palette = {
    blue: { bg: theme.colors.primarySoft, icon: theme.colors.primaryDark },
    orange: { bg: theme.dark ? theme.colors.warningSoft : "#FFF4E5", icon: theme.dark ? theme.colors.warning : theme.colors.accentDark },
    green: { bg: theme.colors.successSoft, icon: theme.colors.success },
    rose: { bg: theme.dark ? theme.colors.dangerSoft : "#FFE4EA", icon: theme.dark ? theme.colors.danger : "#E11D48" }
  }[tone];

  return (
    <View style={{ flex: 1, minWidth: compact ? 0 : 112, borderRadius: compact ? 14 : 18, padding: compact ? 9 : 13, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, gap: compact ? 5 : 8, alignItems: compact ? "center" : "flex-start" }}>
      <View style={{ width: compact ? 26 : 34, height: compact ? 26 : 34, borderRadius: compact ? 10 : 13, alignItems: "center", justifyContent: "center", backgroundColor: palette.bg }}>
        <Ionicons name={icon} size={compact ? 14 : 17} color={palette.icon} />
      </View>
      <Text style={{ color: theme.colors.text, fontSize: compact ? 13 : 20, fontWeight: "900", textAlign: compact ? "center" : "left" }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: compact ? 9 : 11, fontWeight: "800", textAlign: compact ? "center" : "left" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function MenuRow({ item }: { item: { label: string; icon: string; route: string; subtitle: string } }) {
  return (
    <Pressable onPress={() => router.push(item.route as never)}>
      <SurfaceCard style={{ flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderColor: theme.colors.border }}>
        <View style={{ width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.primarySoft }}>
          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={theme.colors.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 14 }}>{item.label}</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 2, lineHeight: 16, fontSize: 11 }} numberOfLines={2}>
            {item.subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={theme.colors.textLight} />
      </SurfaceCard>
    </Pressable>
  );
}

function getPostImageUris(post: CommunityPost) {
  return (post.attachmentItems?.length ? post.attachmentItems.map((media) => media.url) : post.attachments) || [];
}

function FacebookPhotoGrid({
  postId,
  imageUris,
  width
}: {
  postId: string;
  imageUris: string[];
  width: number;
}) {
  if (!imageUris.length) return null;

  const gap = 2;
  const visible = imageUris.slice(0, 4);
  const remaining = imageUris.length - visible.length;
  const half = (width - gap) / 2;

  if (imageUris.length === 1) {
    return <Image source={{ uri: imageUris[0] }} style={{ width, height: Math.min(width * 0.58, 260), backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />;
  }

  if (imageUris.length === 2) {
    return (
      <View style={{ width, flexDirection: "row", gap }}>
        {visible.map((uri, index) => (
          <Image key={`${postId}-photo-${index}-${uri}`} source={{ uri }} style={{ width: half, height: Math.min(width * 0.44, 210), backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
        ))}
      </View>
    );
  }

  if (imageUris.length === 3) {
    const gridHeight = Math.min(width * 0.54, 240);
    return (
      <View style={{ width, flexDirection: "row", gap }}>
        <Image source={{ uri: imageUris[0] }} style={{ width: half, height: gridHeight, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
        <View style={{ width: half, gap }}>
          {imageUris.slice(1, 3).map((uri, offset) => (
            <Image key={`${postId}-photo-${offset + 1}-${uri}`} source={{ uri }} style={{ width: "100%", height: (gridHeight - gap) / 2, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ width, flexDirection: "row", flexWrap: "wrap", gap }}>
      {visible.map((uri, index) => (
        <View key={`${postId}-photo-${index}-${uri}`} style={{ width: half, height: Math.min(half, 180) }}>
          <Image source={{ uri }} style={{ width: "100%", height: "100%", backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
          {index === 3 && remaining > 0 ? (
            <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.54)" }}>
              <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900" }}>+{remaining}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default function ProfileTab() {
  const { signOut, user } = useAuth();
  const { mode, setMode } = useThemeMode();
  const { width } = useWindowDimensions();
  const provider = user?.role === "provider";
  const emailVerified = user?.authProvider === "google";
  const [booting, setBooting] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [ownPosts, setOwnPosts] = useState<CommunityPost[]>([]);
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTabKey>("posts");
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [editingRequest, setEditingRequest] = useState<CommunityPost | null>(null);
  const [requestBody, setRequestBody] = useState("");
  const [requestCategoryId, setRequestCategoryId] = useState("");
  const [requestAddress, setRequestAddress] = useState("");
  const [requestSchedule, setRequestSchedule] = useState("");
  const [requestAttachments, setRequestAttachments] = useState<string[]>([]);
  const [savingRequest, setSavingRequest] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 1000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const unsubscribePosts = communityPostService.subscribePosts((items) => {
        if (active) setOwnPosts(!provider && user?.id ? items.filter((post) => post.customerId === user.id) : []);
      });

      async function load() {
        if (!user) {
          setBooting(false);
          return;
        }

        setBooting(true);
        if (provider) {
          const [profile, nextBookings, nextPayments] = await Promise.all([
            userService.getProviderProfile(user.id),
            bookingService.getProviderBookings(user.id),
            paymentService.getProviderEarnings(user.id)
          ]);
          if (!active) return;
          setProviderProfile(profile);
          setBookings(nextBookings);
          setPayments(nextPayments);
        } else {
          const [profile, nextBookings, nextPayments, nextCategories] = await Promise.all([
            userService.getCustomerProfile(user.id),
            bookingService.getCustomerBookings(user.id),
            paymentService.getCustomerPayments(user.id),
            categoryService.getAllCategories()
          ]);
          if (!active) return;
          setCustomerProfile(profile);
          setBookings(nextBookings);
          setPayments(nextPayments);
          setCategories(nextCategories);
        }
        setBooting(false);
      }

      void load();
      return () => {
        active = false;
        unsubscribePosts();
      };
    }, [provider, user])
  );

  const actionCards = useMemo(
    () =>
      provider
        ? [
            { label: "Business profile", icon: "briefcase-outline", route: "/provider-business-profile", subtitle: "Edit business name, service areas, rates, and photo" },
            { label: "Portfolio", icon: "images-outline", route: "/provider-portfolio", subtitle: "Upload before and after work photos customers can trust" },
            { label: "Working days & schedule", icon: "calendar-outline", route: "/provider-schedule", subtitle: "Manage weekly availability" },
            { label: "Notifications", icon: "notifications-outline", route: "/notifications", subtitle: "Review alerts, job updates, and messages" },
            { label: "Terms and Agreement", icon: "document-text-outline", route: "/terms-agreement", subtitle: "Review platform terms" },
            { label: "Help & Support", icon: "help-buoy-outline", route: "/help", subtitle: "Open support, issues, and help" },
            { label: "About Kabisig", icon: "information-circle-outline", route: "/about", subtitle: "Learn about the platform" }
          ]
        : [
            { label: "Personal details", icon: "person-outline", route: "/profile-personal", subtitle: "Edit phone, location, addresses, and profile photo" },
            { label: "Favorite providers", icon: "heart-outline", route: "/saved-providers", subtitle: "View saved providers and book trusted people again" },
            { label: "Notifications", icon: "notifications-outline", route: "/notifications", subtitle: "Review booking, payment, and message updates" },
            { label: "Terms and Agreement", icon: "document-text-outline", route: "/terms-agreement", subtitle: "Review platform terms" },
            { label: "Help & Support", icon: "help-buoy-outline", route: "/help", subtitle: "Open support, issues, and help" },
            { label: "About Kabisig", icon: "information-circle-outline", route: "/about", subtitle: "Learn about the platform" }
          ],
    [provider]
  );

  const completedBookings = bookings.filter((booking) => booking.status === "Completed").length;
  const paidPayments = payments.filter((payment) => payment.status === "Paid");
  const totalPaid = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const selectedRequestCategory = categories.find((category) => category.id === requestCategoryId) || categories[0] || null;
  const portfolioItems = [...(providerProfile?.portfolio ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const providerCompletionItems = providerProfile
    ? [
        Boolean(providerProfile.displayName?.trim()),
        Boolean(providerProfile.businessName?.trim()),
        Boolean(providerProfile.profilePhotoUrl),
        Boolean(providerProfile.phone?.trim()),
        Boolean(providerProfile.address?.trim() || providerProfile.city?.trim()),
        providerProfile.serviceAreas.length > 0,
        providerProfile.serviceCategories.length > 0,
        Boolean(providerProfile.bio?.trim()),
        Boolean(providerProfile.qualifications?.trim()),
        providerProfile.availability.some((slot) => slot.available),
        portfolioItems.length > 0,
        Boolean(providerProfile.validIdUrl || providerProfile.permitCertificateUrl)
      ]
    : [];
  const profileCompletionPercent = providerCompletionItems.length
    ? Math.round((providerCompletionItems.filter(Boolean).length / providerCompletionItems.length) * 100)
    : 0;
  const tabItems = [
    { key: "posts" as const, label: provider ? "Portfolio" : "Requests", icon: provider ? "images-outline" as const : "newspaper-outline" as const, bg: theme.colors.primarySoft, color: theme.colors.primaryDark },
    { key: "earnings" as const, label: provider ? "Earnings" : "Payments", icon: provider ? "wallet-outline" as const : "card-outline" as const, bg: theme.colors.successSoft, color: theme.colors.success },
    { key: "more" as const, label: "More", icon: "grid-outline" as const, bg: theme.dark ? theme.colors.warningSoft : "#FFF4E5", color: theme.dark ? theme.colors.warning : theme.colors.accentDark }
  ];

  function openRequestEditor(post: CommunityPost) {
    setActionRequestId(null);
    setEditingRequest(post);
    setRequestBody(post.body);
    setRequestCategoryId(post.serviceCategoryId);
    setRequestAddress(post.address);
    setRequestSchedule(post.preferredSchedule || "");
    setRequestAttachments(getPostImageUris(post));
  }

  async function saveRequestEdits() {
    if (!user || !editingRequest || !selectedRequestCategory || !requestBody.trim() || !requestAddress.trim() || savingRequest) {
      setFeedback({ type: "error", title: "Request incomplete", message: "Choose a service, describe the work, and add the service location." });
      return;
    }

    setSavingRequest(true);
    try {
      await communityPostService.updatePost(editingRequest.postId, {
        serviceCategoryId: selectedRequestCategory.id,
        serviceName: selectedRequestCategory.name,
        body: requestBody.trim(),
        address: requestAddress.trim(),
        location: requestAddress.trim(),
        preferredSchedule: requestSchedule.trim() || "Flexible schedule",
        amount: Number(selectedRequestCategory.startingPrice || editingRequest.amount || 0),
        attachments: requestAttachments
      });
      setEditingRequest(null);
      setFeedback({ type: "success", title: "Request updated", message: "Your service request was updated." });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", title: "Update failed", message: readableAppError(error, "We could not update this request right now.") });
    } finally {
      setSavingRequest(false);
    }
  }

  async function deleteRequest(post: CommunityPost) {
    if (!user || post.customerId !== user.id || deletingRequestId) return;
    setDeletingRequestId(post.postId);
    setActionRequestId(null);
    try {
      await communityPostService.deletePost(post.postId);
      setFeedback({ type: "success", title: "Request deleted", message: "Your service request and attached photos were removed." });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", title: "Delete failed", message: readableAppError(error, "We could not delete this request right now.") });
    } finally {
      setDeletingRequestId(null);
    }
  }

  if (booting) {
    return (
      <FixedScreen header={<AppHeader title="Profile" />} safeAreaEdges={["top", "left", "right"]} contentContainerStyle={{ paddingBottom: theme.spacing.xl }}>
        <LoadingState label="Loading profile..." />
      </FixedScreen>
    );
  }

  return (
    <>
      <Modal visible={loggingOut} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent>
        <LaunchScreen />
      </Modal>
      <Modal visible={confirmLogout} transparent animationType="fade" onRequestClose={() => setConfirmLogout(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.42)", justifyContent: "center", padding: 22 }}>
          <SurfaceCard style={{ gap: 14, padding: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.dangerSoft }}>
                <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "900" }}>Log out?</Text>
                <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12, lineHeight: 17 }}>You will need to sign in again to access your Kabisig account.</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => setConfirmLogout(false)} style={{ flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}>
                <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmLogout(false);
                  setLoggingOut(true);
                  setTimeout(() => void signOut(), 1000);
                }}
                style={{ flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center", backgroundColor: theme.colors.danger }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>Log out</Text>
              </Pressable>
            </View>
          </SurfaceCard>
        </View>
      </Modal>
      <Modal visible={Boolean(editingRequest)} transparent animationType="fade" onRequestClose={() => setEditingRequest(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.42)", justifyContent: "flex-end", padding: 18 }}>
            <SurfaceCard style={{ maxHeight: "88%", padding: 0, overflow: "hidden" }}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Edit request</Text>
                  <Pressable onPress={() => setEditingRequest(null)} style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt }}>
                    <Ionicons name="close" size={19} color={theme.colors.textMuted} />
                  </Pressable>
                </View>

                <TextInput
                  value={requestBody}
                  onChangeText={setRequestBody}
                  placeholder="What service do you need?"
                  placeholderTextColor={theme.colors.textLight}
                  multiline
                  style={{ minHeight: 108, borderRadius: 16, padding: 12, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, textAlignVertical: "top", fontSize: 14, lineHeight: 20 }}
                />

                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 12, gap: 10, backgroundColor: theme.colors.card }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Service type</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {categories.map((category) => {
                      const active = requestCategoryId === category.id;
                      return (
                        <Pressable key={category.id} onPress={() => setRequestCategoryId(category.id)} style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt }}>
                          <Text style={{ color: active ? theme.colors.textOnPrimary : theme.colors.text, fontSize: 12, fontWeight: "900" }}>{category.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 12, gap: 10, backgroundColor: theme.colors.card }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Schedule and location</Text>
                  <TextInput value={requestSchedule} onChangeText={setRequestSchedule} placeholder="Preferred schedule, optional" placeholderTextColor={theme.colors.textLight} style={{ borderRadius: 14, padding: 12, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, fontSize: 12 }} />
                  <TextInput value={requestAddress} onChangeText={setRequestAddress} placeholder="Type service address" placeholderTextColor={theme.colors.textLight} style={{ borderRadius: 14, padding: 12, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, fontSize: 12 }} />
                </View>

                <MultiMediaPickerField
                  label="Photos"
                  values={requestAttachments}
                  onChange={setRequestAttachments}
                  helper="Update the photos attached to this request."
                  maxSizeMb={8}
                  onError={(message) => setFeedback({ type: "error", title: "Upload issue", message })}
                />

                <Pressable onPress={() => void saveRequestEdits()} disabled={savingRequest} style={{ borderRadius: 15, paddingVertical: 13, alignItems: "center", backgroundColor: theme.colors.primary, opacity: savingRequest ? 0.7 : 1 }}>
                  <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>{savingRequest ? "Saving..." : "Save changes"}</Text>
                </Pressable>
              </ScrollView>
            </SurfaceCard>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FixedScreen
        safeAreaEdges={["top", "left", "right"]}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
        header={
          <>
            <AppHeader title="Profile" />
            {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
            <SurfaceCard style={{ padding: 11, borderColor: theme.colors.primarySoft, backgroundColor: theme.colors.card }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ borderRadius: 24, padding: 2, backgroundColor: theme.colors.primarySoft }}>
                  <Avatar
                    image={provider ? providerProfile?.profilePhotoUrl || user?.profilePhoto : customerProfile?.profilePhotoUrl || user?.profilePhoto}
                    size={46}
                    icon={provider ? "briefcase-outline" : "person-outline"}
                  />
                </View>
                <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900", flex: 1 }} numberOfLines={1}>
                      {provider ? providerProfile?.displayName || user?.fullName : user?.fullName}
                    </Text>
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: emailVerified ? theme.colors.successSoft : theme.colors.infoSoft
                      }}
                    >
                      <Ionicons name={emailVerified ? "checkmark-circle" : "shield-checkmark-outline"} size={14} color={emailVerified ? theme.colors.success : theme.colors.info} />
                    </View>
                    {providerProfile?.isApproved ? <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} /> : null}
                  </View>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>{user?.email}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                    <View style={{ flex: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: theme.colors.surfaceAlt }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: "800" }} numberOfLines={1}>
                        {provider ? `${completedBookings} jobs - ${portfolioItems.length} portfolio` : `${completedBookings} bookings - ${ownPosts.length} requests`}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </SurfaceCard>
          </>
        }
      >
        <SurfaceCard style={{ padding: 7, backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {tabItems.map((tab) => {
              const active = activeProfileTab === tab.key;
              return (
                <Pressable key={tab.key} onPress={() => setActiveProfileTab(tab.key)} style={{ flex: 1, borderRadius: 13, paddingVertical: 9, alignItems: "center", gap: 3, backgroundColor: active ? tab.bg : theme.colors.surfaceAlt, borderWidth: active ? 1 : 0, borderColor: active ? tab.color : "transparent" }}>
                  <Ionicons name={tab.icon} size={15} color={tab.color} />
                  <Text style={{ color: active ? tab.color : theme.colors.textMuted, fontSize: 10, fontWeight: "900" }}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </SurfaceCard>

        {activeProfileTab === "posts" ? (
          <View style={{ gap: 10 }}>
            {provider ? (
              <>
                <SurfaceCard style={{ padding: 14, gap: 10, backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primarySoft }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card }}>
                      <Ionicons name="images-outline" size={18} color={theme.colors.primaryDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Your portfolio</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>Before and after work samples customers can view.</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => router.push("/provider-portfolio" as never)} style={{ borderRadius: 12, paddingVertical: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: theme.colors.card }}>
                    <Ionicons name="add-circle-outline" size={16} color={theme.colors.primaryDark} />
                    <Text style={{ color: theme.colors.primaryDark, fontWeight: "900", fontSize: 12 }}>Manage portfolio</Text>
                  </Pressable>
                </SurfaceCard>

                {portfolioItems.length ? (
                  portfolioItems.map((item) => (
                    <SurfaceCard key={item.portfolioItemId} style={{ padding: 13, gap: 10 }}>
                      <View>
                        <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "900" }}>{item.title}</Text>
                        {item.description ? <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 }} numberOfLines={2}>{item.description}</Text> : null}
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {[
                          { label: "Before", uri: item.beforePhoto.url },
                          { label: "After", uri: item.afterPhoto.url }
                        ].map((photo) => (
                          <View key={`${item.portfolioItemId}-${photo.label}`} style={{ flex: 1, gap: 5 }}>
                            <Image source={{ uri: photo.uri }} style={{ width: "100%", aspectRatio: 1.25, borderRadius: 12, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
                            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "800", textAlign: "center" }}>{photo.label}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={{ color: theme.colors.textLight, fontSize: 11 }}>{new Date(item.createdAt).toLocaleString()}</Text>
                    </SurfaceCard>
                  ))
                ) : (
                  <SurfaceCard style={{ padding: 14, gap: 10 }}>
                    <Text style={{ color: theme.colors.text, fontWeight: "900", textAlign: "center" }}>No portfolio yet.</Text>
                    <Text style={{ color: theme.colors.textMuted, textAlign: "center", lineHeight: 18 }}>Add before and after photos so customers can see your completed work.</Text>
                  </SurfaceCard>
                )}
              </>
            ) : (
              <>
                <SurfaceCard style={{ padding: 12, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Avatar image={customerProfile?.profilePhotoUrl || user?.profilePhoto} size={38} />
                    <Pressable onPress={() => router.push("/(tabs)/post?compose=1" as never)} style={{ flex: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.colors.surfaceAlt }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: "800" }}>What service do you need?</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable onPress={() => router.push("/(tabs)/post?compose=1" as never)} style={{ flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: theme.colors.primarySoft }}>
                      <Ionicons name="create-outline" size={15} color={theme.colors.primaryDark} />
                      <Text style={{ color: theme.colors.primaryDark, fontWeight: "900", fontSize: 12 }}>Create request</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push("/(tabs)/post" as never)} style={{ flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: theme.colors.surfaceAlt }}>
                      <Ionicons name="people-outline" size={15} color={theme.colors.textMuted} />
                      <Text style={{ color: theme.colors.textMuted, fontWeight: "900", fontSize: 12 }}>Activity feed</Text>
                    </Pressable>
                  </View>
                </SurfaceCard>

                <SurfaceCard style={{ padding: 14, gap: 8, backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primarySoft }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card }}>
                      <Ionicons name="newspaper-outline" size={18} color={theme.colors.primaryDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Your requests</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>Private history, separate from the public news feed.</Text>
                    </View>
                  </View>
                </SurfaceCard>

                {ownPosts.length ? (
                  ownPosts.map((post) => {
                    const images = getPostImageUris(post);
                    const cardMediaWidth = Math.min(Math.max(width - theme.spacing.lg * 2 - 2, 260), 480);
                    return (
                      <SurfaceCard key={post.postId} style={{ padding: 0, gap: 0, overflow: "hidden", position: "relative", zIndex: actionRequestId === post.postId ? 20 : 0, elevation: actionRequestId === post.postId ? 8 : 0 }}>
                        <View style={{ flexDirection: "row", gap: 9, alignItems: "center", padding: 10 }}>
                          <Avatar image={customerProfile?.profilePhotoUrl || user?.profilePhoto} size={34} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 13 }} numberOfLines={1}>{user?.fullName || "Customer"}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                              <Text style={{ color: theme.colors.textMuted, fontSize: 10 }} numberOfLines={1}>{new Date(post.createdAt).toLocaleString()}</Text>
                              <Ionicons name="earth-outline" size={11} color={theme.colors.textMuted} />
                            </View>
                          </View>
                          <View style={{ borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: post.status === "Open" ? theme.colors.successSoft : theme.colors.surfaceAlt }}>
                            <Text style={{ color: post.status === "Open" ? theme.colors.success : theme.colors.textMuted, fontSize: 9, fontWeight: "900" }}>{post.status === "Open" ? "Available" : "Booked"}</Text>
                          </View>
                          <Pressable onPress={() => setActionRequestId((current) => current === post.postId ? null : post.postId)} style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt }}>
                            <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.textMuted} />
                          </Pressable>
                        </View>
                        {actionRequestId === post.postId ? (
                          <View style={{ position: "absolute", top: 50, right: 10, zIndex: 30, elevation: 10, width: 172, borderRadius: 14, padding: 6, gap: 5, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
                            {post.status === "Open" ? (
                              <Pressable onPress={() => openRequestEditor(post)} style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, alignItems: "center", flexDirection: "row", gap: 8, backgroundColor: theme.colors.surfaceAlt }}>
                                <Ionicons name="create-outline" size={15} color={theme.colors.text} />
                                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 12 }}>Edit request</Text>
                              </Pressable>
                            ) : null}
                            <Pressable onPress={() => void deleteRequest(post)} disabled={deletingRequestId === post.postId} style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, alignItems: "center", flexDirection: "row", gap: 8, backgroundColor: theme.colors.dangerSoft, opacity: deletingRequestId === post.postId ? 0.7 : 1 }}>
                              <Ionicons name="trash-outline" size={15} color={theme.colors.danger} />
                              <Text style={{ color: theme.colors.danger, fontWeight: "900", fontSize: 12 }}>{deletingRequestId === post.postId ? "Deleting..." : "Delete request"}</Text>
                            </Pressable>
                          </View>
                        ) : null}
                        <View style={{ gap: 7, paddingHorizontal: 10, paddingBottom: 9 }}>
                          <Text style={{ color: theme.colors.text, fontSize: 13, lineHeight: 18, fontWeight: "800" }} numberOfLines={3}>{post.body}</Text>
                          <View style={{ borderRadius: 11, padding: 8, gap: 3, backgroundColor: theme.colors.surfaceAlt }}>
                            <Text style={{ color: theme.colors.primaryDark, fontWeight: "900", fontSize: 11 }} numberOfLines={1}>Job type: {post.serviceName}</Text>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 10 }} numberOfLines={1}>Schedule: {post.preferredSchedule || "Flexible schedule"}</Text>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 10 }} numberOfLines={1}>Location: {post.address}</Text>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Starting budget: ₱{post.amount.toLocaleString()}</Text>
                          </View>
                        </View>
                        <FacebookPhotoGrid postId={post.postId} imageUris={images} width={cardMediaWidth} />
                        <View style={{ paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>{post.likes.length} like{post.likes.length === 1 ? "" : "s"}</Text>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>{post.comments.length} comment{post.comments.length === 1 ? "" : "s"}</Text>
                        </View>
                      </SurfaceCard>
                    );
                  })
                ) : (
                  <SurfaceCard style={{ padding: 14 }}>
                    <Text style={{ color: theme.colors.textMuted, textAlign: "center" }}>No requests yet.</Text>
                  </SurfaceCard>
                )}
              </>
            )}
          </View>
        ) : null}

        {activeProfileTab === "earnings" ? (
          <SurfaceCard style={{ gap: 12, padding: 14, backgroundColor: theme.colors.surfaceAlt }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card }}>
                <Ionicons name={provider ? "wallet-outline" : "card-outline"} size={19} color={theme.colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "900" }}>{provider ? "Earnings" : "Payments"}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>{provider ? "Track paid work and completed jobs." : "Review paid bookings and transactions."}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
              <ProfileStat label={provider ? "Paid" : "Paid total"} value={`₱${totalPaid.toLocaleString()}`} icon="cash-outline" tone="green" compact />
              <ProfileStat label="Transactions" value={payments.length} icon="receipt-outline" tone="blue" compact />
              <ProfileStat label="Completed" value={completedBookings} icon="briefcase-outline" tone="orange" compact />
            </View>
            <Pressable onPress={() => router.push((provider ? "/(tabs)/earnings" : "/(tabs)/payments") as never)} style={{ borderRadius: 15, paddingVertical: 12, alignItems: "center", backgroundColor: theme.colors.primary }}>
              <Text style={{ color: "#fff", fontWeight: "900" }}>{provider ? "Open earnings page" : "Open payments page"}</Text>
            </Pressable>
          </SurfaceCard>
        ) : null}

        {activeProfileTab === "more" ? (
          <View style={{ gap: 8 }}>
            {provider ? (
              <SurfaceCard style={{ padding: 12, gap: 10, backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primarySoft }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card }}>
                    <Ionicons name="checkmark-done-circle-outline" size={19} color={theme.colors.primaryDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>Profile strength</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>Your worker profile is {profileCompletionPercent}% complete.</Text>
                  </View>
                  <Text style={{ color: theme.colors.primaryDark, fontSize: 20, fontWeight: "900" }}>{profileCompletionPercent}%</Text>
                </View>
                <View style={{ height: 9, borderRadius: 999, backgroundColor: theme.colors.card, overflow: "hidden" }}>
                  <View style={{ width: `${profileCompletionPercent}%`, height: "100%", borderRadius: 999, backgroundColor: theme.colors.primary }} />
                </View>
                {profileCompletionPercent < 100 ? (
                  <Pressable onPress={() => router.push("/provider-business-profile" as never)} style={{ borderRadius: 12, paddingVertical: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: theme.colors.card }}>
                    <Ionicons name="create-outline" size={15} color={theme.colors.primaryDark} />
                    <Text style={{ color: theme.colors.primaryDark, fontSize: 12, fontWeight: "900" }}>Complete profile</Text>
                  </Pressable>
                ) : null}
              </SurfaceCard>
            ) : null}
            {actionCards.map((item) => <MenuRow key={item.label} item={item} />)}
            <SurfaceCard style={{ padding: 12 }}>
              <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>Appearance</Text>
              <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12, lineHeight: 17 }}>Switch the entire app between light, dark, or system appearance.</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {[
                  { key: "light" as const, label: "Light", icon: "sunny-outline" as const },
                  { key: "dark" as const, label: "Dark", icon: "moon-outline" as const },
                  { key: "system" as const, label: "System", icon: "phone-portrait-outline" as const }
                ].map((option) => {
                  const active = mode === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        setMode(option.key);
                        setFeedback({ type: "success", title: "Appearance updated", message: `Kabisig is now using ${option.label.toLowerCase()} mode.` });
                      }}
                      style={{ flex: 1, minWidth: 96, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt, borderWidth: 1, borderColor: active ? theme.colors.primary : theme.colors.border, alignItems: "center", gap: 4 }}
                    >
                      <Ionicons name={option.icon} size={16} color={active ? "#fff" : theme.colors.primaryDark} />
                      <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800", fontSize: 12 }}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </SurfaceCard>
            <Pressable onPress={() => setConfirmLogout(true)}>
              <SurfaceCard style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderColor: theme.colors.dangerSoft, backgroundColor: theme.colors.card }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.dangerSoft }}>
                  <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.danger, fontWeight: "900", fontSize: 14 }}>Logout</Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 2, lineHeight: 16, fontSize: 11 }}>Sign out of this Kabisig account</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={theme.colors.danger} />
              </SurfaceCard>
            </Pressable>
          </View>
        ) : null}
      </FixedScreen>
    </>
  );
}
