import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { bookingService, categoryService, reviewService, userService, type ProviderProfile, type Review, type ServiceCategory } from "@kabisig/shared";
import { BackHeader, EmptyState, FixedScreen, MediaPreviewModal, PrimaryButton, StatusBadge, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";
import { formatProviderStartingRate } from "../src/utils/rates";
import { getProviderResponseTimeLabel } from "../src/utils/responseTime";

type ProviderCard = ProviderProfile & { userId: string };

function formatWorkingTime(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hourNumber = Number(hourText);
  const minuteNumber = Number(minuteText);
  if (!Number.isFinite(hourNumber) || !Number.isFinite(minuteNumber)) return value;
  const suffix = hourNumber >= 12 ? "PM" : "AM";
  const normalizedHour = ((hourNumber + 11) % 12) + 1;
  return `${normalizedHour}:${String(minuteNumber).padStart(2, "0")} ${suffix}`;
}

export default function ProviderDetailScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const { user } = useAuth();
  const [provider, setProvider] = useState<ProviderCard | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [busyNow, setBusyNow] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAllPortfolio, setShowAllPortfolio] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!params.userId || !user) return;
      const [nextProvider, savedProviderIds, nextCategories] = await Promise.all([
        userService.getProviderProfile(params.userId),
        user?.role === "customer" ? userService.getSavedProviderIds(user.id) : Promise.resolve([]),
        categoryService.getAllCategories()
      ]);
      if (!mounted) return;
      const match = nextProvider ? { ...nextProvider, userId: params.userId } : null;
      setProvider(match);
      setIsSaved(savedProviderIds.includes(params.userId));
      setCategories(nextCategories);

      if (match) {
        const nextReviews = await reviewService.getProviderReviews(match.userId);
        if (!mounted) return;
        setReviews(nextReviews);
      }
    }

    void load().catch((error) => {
      if (!mounted) return;
      console.warn("Unable to load provider details:", error);
      setProvider(null);
      setReviews([]);
      setIsSaved(false);
    });

    return () => {
      mounted = false;
    };
  }, [params.userId, user]);

  async function toggleSavedProvider() {
    if (!user || user.role !== "customer" || !provider || saving) return;

    setSaving(true);
    try {
      if (isSaved) {
        await userService.unsaveProvider(user.id, provider.userId);
        setIsSaved(false);
      } else {
        await userService.saveProvider(user.id, provider.userId);
        setIsSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!provider?.userId) return;

    const today = new Date().toISOString().slice(0, 10);
    const currentHour = new Date().getHours();
    const currentSlot = `${((currentHour + 11) % 12) + 1}:00 ${currentHour >= 12 ? "PM" : "AM"}`;

    const unsubscribe = bookingService.subscribeReservedSlotTimes(provider.userId, today, (times) => {
      setBusyNow(times.includes(currentSlot));
    });

    return unsubscribe;
  }, [provider?.userId]);

  const visibleDays = useMemo(() => provider?.availability.filter((slot) => slot.available) ?? [], [provider]);
  const recentReviews = useMemo(
    () => [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3),
    [reviews]
  );
  const portfolio = useMemo(
    () => [...(provider?.portfolio ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [provider?.portfolio]
  );
  const recentPortfolio = useMemo(() => portfolio.slice(0, 3), [portfolio]);
  const getReviewMedia = (review: Review) => (review as Review & { mediaUrls?: string[] }).mediaUrls ?? [];

  if (!provider) {
    return (
      <FixedScreen
        style={{ backgroundColor: theme.colors.background }}
        header={<BackHeader title="Provider Details" onBack={() => router.back()} />}
      >
        <EmptyState
          title="Provider not found"
          description="Open this screen from the provider list after live provider profiles have loaded."
        />
      </FixedScreen>
    );
  }

  return (
    <FixedScreen
      style={{ backgroundColor: theme.colors.background }}
      header={<BackHeader title="Provider Details" onBack={() => router.back()} />}
    >
      <MediaPreviewModal visible={!!previewImage} uri={previewImage} title="Provider Media Preview" onClose={() => setPreviewImage(null)} />
      <Modal visible={showAllPortfolio} transparent animationType="fade" onRequestClose={() => setShowAllPortfolio(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.66)", justifyContent: "center", padding: 18 }}>
          <SurfaceCard style={{ maxHeight: "92%", gap: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 21, fontWeight: "900" }}>All portfolio</Text>
                <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
                  {portfolio.length} completed work sample{portfolio.length === 1 ? "" : "s"}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowAllPortfolio(false)}
                accessibilityRole="button"
                accessibilityLabel="Close portfolio"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: theme.colors.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 4 }}>
              {portfolio.map((item) => (
                <View key={item.portfolioItemId} style={{ borderRadius: 18, padding: 12, backgroundColor: theme.colors.surfaceAlt, gap: 10 }}>
                  <View>
                    <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{item.title}</Text>
                    {item.description ? <Text style={{ color: theme.colors.textMuted, marginTop: 4, lineHeight: 19 }}>{item.description}</Text> : null}
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {[
                      { label: "Before", uri: item.beforePhoto.url },
                      { label: "After", uri: item.afterPhoto.url },
                    ].map((photo) => (
                      <Pressable key={`${item.portfolioItemId}-all-${photo.label}`} onPress={() => setPreviewImage(photo.uri)} style={{ flex: 1, gap: 6 }}>
                        <Image source={{ uri: photo.uri }} style={{ width: "100%", aspectRatio: 1, borderRadius: 16, backgroundColor: theme.colors.card }} resizeMode="cover" />
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "800", textAlign: "center" }}>{photo.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </SurfaceCard>
        </View>
      </Modal>

      <SurfaceCard
        style={{
          padding: 0,
          overflow: "hidden"
        }}
      >
        <View style={{ backgroundColor: theme.dark ? theme.colors.primaryLight : theme.colors.primaryDark, padding: 22, gap: 18 }}>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            {provider.profilePhotoUrl ? (
              <Image
                source={{ uri: provider.profilePhotoUrl }}
                style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.15)" }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 28,
                  backgroundColor: "rgba(255,255,255,0.16)",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name="person-circle-outline" size={42} color="#fff" />
              </View>
            )}

            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Text style={{ flex: 1, fontSize: 24, fontWeight: "900", color: "#fff" }}>{provider.displayName}</Text>
                {user?.role === "customer" ? (
                  <Pressable
                    onPress={() => void toggleSavedProvider()}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel={isSaved ? "Remove saved provider" : "Save provider"}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: "rgba(255,255,255,0.14)",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    <Ionicons name={isSaved ? "heart" : "heart-outline"} size={22} color={isSaved ? "#FF6B81" : "#fff"} />
                  </Pressable>
                ) : null}
              </View>
              <Text style={{ color: "rgba(255,255,255,0.82)" }}>
                {provider.businessName || "Independent service provider"}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <StatusBadge status={provider.isApproved ? "Verified" : provider.approvalStatus} />
                <StatusBadge status={`${provider.rating ? provider.rating.toFixed(1) : "New"} rating`} />
                <StatusBadge status={getProviderResponseTimeLabel(provider)} />
                {isSaved ? <StatusBadge status="Saved" /> : null}
                {busyNow ? <StatusBadge status="Busy Working" /> : null}
              </View>
            </View>
          </View>

          <Text style={{ color: "rgba(255,255,255,0.88)", lineHeight: 21 }}>
            {provider.bio || "Professional, responsive, and ready for local field service requests."}
          </Text>
        </View>

        <View style={{ padding: 18, gap: 14 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[
              { label: "Experience", value: `${provider.yearsExperience} yrs` },
              { label: "Starting rate", value: formatProviderStartingRate(provider, categories) },
              { label: "Reply", value: getProviderResponseTimeLabel(provider) },
              { label: "City", value: provider.city || "TBD" }
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  width: "48%",
                  flexGrow: 1,
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: theme.colors.surfaceAlt
                }}
              >
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
                <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 6 }}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 12 }}>
            {[
              {
                icon: "construct-outline",
                label: provider.serviceCategories.join(", ") || "No service categories yet"
              },
              {
                icon: "map-outline",
                label: provider.serviceAreas.length ? provider.serviceAreas.join(", ") : "Service areas not listed yet"
              },
              {
                icon: "chatbubble-ellipses-outline",
                label: "Message the worker"
              },
              {
                icon: "chatbubble-ellipses-outline",
                label: getProviderResponseTimeLabel(provider)
              },
              {
                icon: "gift-outline",
                label: provider.birthday ? `Birthday: ${provider.birthday}${provider.age ? ` • Age ${provider.age}` : ""}` : "Birthday details will appear after onboarding"
              }
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: theme.colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={theme.colors.primaryDark} />
                </View>
                <Text style={{ color: theme.colors.text, flex: 1 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Provider overview</Text>
        <View style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
            {provider.qualifications || "Qualifications and certifications will appear here after provider onboarding is completed."}
          </Text>
          {provider.additionalDetails ? (
            <View style={{ borderRadius: 16, padding: 14, backgroundColor: theme.colors.surfaceAlt }}>
              <Text style={{ color: theme.colors.text, fontWeight: "800", marginBottom: 6 }}>Important details</Text>
              <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>{provider.additionalDetails}</Text>
            </View>
          ) : null}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Recent portfolio</Text>
            <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
              3 latest completed jobs.
            </Text>
          </View>
          {portfolio.length > 3 ? (
            <Pressable
              onPress={() => setShowAllPortfolio(true)}
              style={{
                borderRadius: 14,
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: theme.colors.primarySoft
              }}
            >
              <Text style={{ color: theme.colors.primaryDark, fontWeight: "900" }}>View all</Text>
            </Pressable>
          ) : null}
        </View>
        {recentPortfolio.length ? (
          <View style={{ gap: 14 }}>
            {recentPortfolio.map((item) => (
              <View key={item.portfolioItemId} style={{ borderRadius: 18, padding: 12, backgroundColor: theme.colors.surfaceAlt, gap: 10 }}>
                <View>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{item.title}</Text>
                  {item.description ? <Text style={{ color: theme.colors.textMuted, marginTop: 4, lineHeight: 19 }}>{item.description}</Text> : null}
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {[
                    { label: "Before", uri: item.beforePhoto.url },
                    { label: "After", uri: item.afterPhoto.url },
                  ].map((photo) => (
                    <Pressable key={`${item.portfolioItemId}-${photo.label}`} onPress={() => setPreviewImage(photo.uri)} style={{ flex: 1, gap: 6 }}>
                      <Image source={{ uri: photo.uri }} style={{ width: "100%", aspectRatio: 1, borderRadius: 16, backgroundColor: theme.colors.card }} resizeMode="cover" />
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "800", textAlign: "center" }}>{photo.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: theme.colors.textMuted }}>
            Before and after work photos will appear here after the provider uploads their portfolio.
          </Text>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Available working days</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {visibleDays.length ? (
            visibleDays.map((slot) => (
              <View
                key={`${slot.day}-${slot.start}`}
                style={{
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: theme.colors.surfaceAlt
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{slot.day}</Text>
                <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>{formatWorkingTime(slot.start)} - {formatWorkingTime(slot.end)}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.colors.textMuted }}>
              This provider has not published their working days yet.
            </Text>
          )}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Recent reviews</Text>
        {recentReviews.length ? (
          recentReviews.map((review) => (
            <View
              key={review.reviewId}
              style={{
                borderRadius: 18,
                padding: 14,
                backgroundColor: theme.colors.surfaceAlt,
                gap: 6
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{review.rating}/5 rating</Text>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Ionicons
                      key={`${review.reviewId}-${index}`}
                      name={index < review.rating ? "star" : "star-outline"}
                      size={15}
                      color={theme.colors.accent}
                    />
                  ))}
                </View>
              </View>
              <Text style={{ color: theme.colors.textMuted }}>{review.comment || "No review comment added."}</Text>
              {getReviewMedia(review).length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {getReviewMedia(review).slice(0, 3).map((mediaUrl: string, index: number) => (
                    <Image
                      key={`${review.reviewId}-${index}`}
                      source={{ uri: mediaUrl }}
                      style={{ width: 68, height: 68, borderRadius: 16, backgroundColor: theme.colors.card }}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={{ color: theme.colors.textMuted }}>
            Reviews will appear here after completed bookings are rated by customers.
          </Text>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Sample works</Text>
        {provider.sampleWorkUrls?.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {provider.sampleWorkUrls.slice(0, 6).map((uri, index) => (
              <Pressable
                key={`${provider.userId}-work-${index}`}
                onPress={() => setPreviewImage(uri)}
              >
                <Image
                  source={{ uri }}
                  style={{ width: 90, height: 90, borderRadius: 18, backgroundColor: theme.colors.surfaceAlt }}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ color: theme.colors.textMuted }}>
            Uploaded sample works will appear here after provider onboarding is completed.
          </Text>
        )}
      </SurfaceCard>

      <PrimaryButton
        label={isSaved ? "Book saved provider again" : "Book this provider"}
        icon="calendar-outline"
        onPress={() =>
          router.push({
            pathname: "/booking-request",
            params: { providerId: provider.userId, categoryId: provider.serviceCategories?.[0] || "" }
          })
        }
      />
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/chat",
            params: { otherId: provider.userId }
          })
        }
        style={{
          borderRadius: 18,
          paddingVertical: 15,
          paddingHorizontal: 18,
          alignItems: "center",
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border
        }}
      >
        <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Message worker</Text>
      </Pressable>
    </FixedScreen>
  );
}
