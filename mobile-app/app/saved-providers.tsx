import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { providerService, userService, type ProviderProfile } from "@kabisig/shared";
import { BackHeader, EmptyState, FixedScreen, LoadingState, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";
import { getProviderResponseTimeLabel } from "../src/utils/responseTime";

type ProviderCard = ProviderProfile & { userId: string };

export default function SavedProvidersScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || user.role !== "customer") {
      setProviders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [savedProviderIds, allProviders] = await Promise.all([
      userService.getSavedProviderIds(user.id),
      providerService.getAllProviderProfiles(),
    ]);
    setProviders(
      savedProviderIds
        .map((providerId) => allProviders.find((provider) => provider.userId === providerId))
        .filter((provider): provider is ProviderCard => Boolean(provider))
        .sort((left, right) => (right.rating || 0) - (left.rating || 0))
    );
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function removeSavedProvider(providerId: string) {
    if (!user || removingId) return;
    setRemovingId(providerId);
    try {
      await userService.unsaveProvider(user.id, providerId);
      setProviders((current) => current.filter((provider) => provider.userId !== providerId));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <FixedScreen style={{ backgroundColor: theme.colors.background }} header={<BackHeader title="Favorite Providers" onBack={() => router.back()} />}>
      {loading ? (
        <LoadingState label="Loading favorite providers..." />
      ) : providers.length ? (
        <View style={{ gap: 14 }}>
          {providers.map((provider) => (
            <SurfaceCard key={provider.userId} style={{ gap: 14 }}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/provider-detail",
                    params: { userId: provider.userId },
                  })
                }
                style={{ flexDirection: "row", gap: 14, alignItems: "center" }}
              >
                {provider.profilePhotoUrl ? (
                  <Image
                    source={{ uri: provider.profilePhotoUrl }}
                    style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: theme.colors.surfaceAlt }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 22,
                      backgroundColor: theme.colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="person-circle-outline" size={32} color={theme.colors.primaryDark} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
                    {provider.displayName}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 4 }} numberOfLines={1}>
                    {provider.serviceCategories[0] || "General services"} - {provider.city || "Location pending"}
                  </Text>
                  <Text style={{ color: theme.colors.accentDark, marginTop: 6, fontWeight: "800" }} numberOfLines={1}>
                    {provider.rating ? `${provider.rating.toFixed(1)} rating` : "New provider"} - {getProviderResponseTimeLabel(provider)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
              </Pressable>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/booking-request",
                      params: { providerId: provider.userId, categoryId: provider.serviceCategories?.[0] || "" },
                    })
                  }
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    paddingVertical: 12,
                    alignItems: "center",
                    backgroundColor: theme.colors.primary,
                  }}
                >
                  <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>Book Again</Text>
                </Pressable>
                <Pressable
                  onPress={() => void removeSavedProvider(provider.userId)}
                  disabled={removingId === provider.userId}
                  style={{
                    width: 48,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.dark ? theme.colors.dangerSoft : "#FFE4EA",
                    opacity: removingId === provider.userId ? 0.65 : 1,
                  }}
                >
                  <Ionicons name="heart" size={20} color={theme.colors.danger} />
                </Pressable>
              </View>
            </SurfaceCard>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No favorite providers yet"
          description="Tap the heart on a provider profile to save trusted providers and rebook them faster."
        />
      )}
    </FixedScreen>
  );
}
