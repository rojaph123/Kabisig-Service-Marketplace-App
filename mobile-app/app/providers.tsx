import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { categoryService, providerService, userService, type ProviderProfile, type ServiceCategory } from "@kabisig/shared";
import { BackHeader, EmptyState, FixedScreen, SearchBar, StatusBadge, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";
import { formatProviderStartingRate } from "../src/utils/rates";
import { getProviderResponseTimeLabel } from "../src/utils/responseTime";

type ProviderCard = ProviderProfile & { userId: string };

function isAvailableNow(provider: ProviderCard) {
  return provider.availability?.some((slot) => slot.available) ?? false;
}

function isBookableProvider(provider: ProviderCard) {
  if (!provider.isApproved) return false;
  return !provider.moderation || provider.moderation.status === "active";
}

function providerSearchText(provider: ProviderCard) {
  return [
    provider.displayName,
    provider.businessName,
    ...provider.serviceCategories
  ]
    .join(" ")
    .toLowerCase();
}

function matchesProviderSearch(provider: ProviderCard, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const searchable = providerSearchText(provider);
  const words = searchable.split(/[\s,/-]+/).filter(Boolean);
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => searchable.includes(term) || words.some((word) => word.startsWith(term)));
}

export default function ProvidersScreen() {
  const params = useLocalSearchParams<{ q?: string; categoryId?: string; categoryName?: string }>();
  const { user } = useAuth();
  const [query, setQuery] = useState(params.q || "");
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [savedProviderIds, setSavedProviderIds] = useState<string[]>([]);
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [marketplaceProviders, nextSavedProviderIds, nextCategories] = await Promise.all([
        providerService.getApprovedProviders(500),
        user?.role === "customer" ? userService.getSavedProviderIds(user.id) : Promise.resolve([]),
        categoryService.getAllCategories()
      ]);
      const savedProviders = nextSavedProviderIds.length
        ? (await providerService.getAllProviderProfiles()).filter((provider) => nextSavedProviderIds.includes(provider.userId) && isBookableProvider(provider))
        : [];
      const nextProviders = [
        ...marketplaceProviders,
        ...savedProviders.filter((savedProvider) => !marketplaceProviders.some((provider) => provider.userId === savedProvider.userId))
      ];
      if (!mounted) return;
      setProviders(nextProviders.sort((a, b) => (b.rating || 0) - (a.rating || 0)));
      setSavedProviderIds(nextSavedProviderIds);
      setCategories(nextCategories);
    }

    void load().catch((error) => {
      if (!mounted) return;
      console.warn("Unable to load providers:", error);
      setProviders([]);
      setSavedProviderIds([]);
    });

    return () => {
      mounted = false;
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    setQuery(params.q || "");
  }, [params.q]);

  const filteredProviders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const categoryId = params.categoryId?.trim().toLowerCase() || "";
    const categoryName = params.categoryName?.trim().toLowerCase() || "";

    return providers.filter((provider) => {
      const saved = savedProviderIds.includes(provider.userId);
      if (!isAvailableNow(provider) && !saved) return false;
      const matchesCategory =
        !categoryId ||
        provider.serviceCategories.some((service) => {
          const normalizedService = service.trim().toLowerCase();
          return normalizedService === categoryId || normalizedService === categoryName;
        });

      return matchesCategory && matchesProviderSearch(provider, normalized);
    });
  }, [params.categoryId, params.categoryName, providers, query, savedProviderIds]);
  const searchSuggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    const serviceSuggestions = categories
      .filter((category) => (category.name || category.id).toLowerCase().startsWith(normalized))
      .map((category) => ({
        id: `service-${category.id}`,
        label: category.name || category.id,
        icon: "construct-outline" as const,
        onPress: () => {
          setQuery(category.name || category.id);
          router.setParams({ categoryId: category.id, categoryName: category.name, q: category.name || category.id });
        }
      }));
    const workerSuggestions = providers
      .filter((provider) =>
        [provider.displayName, provider.businessName, ...provider.serviceCategories]
          .filter(Boolean)
          .some((value) => value.toLowerCase().startsWith(normalized))
      )
      .slice(0, 5)
      .map((provider) => ({
        id: `worker-${provider.userId}`,
        label: provider.displayName,
        icon: "person-outline" as const,
        onPress: () =>
          router.push({
            pathname: "/provider-detail",
            params: { userId: provider.userId }
          })
      }));

    return [...serviceSuggestions, ...workerSuggestions].slice(0, 6);
  }, [categories, providers, query]);

  const topProviders = filteredProviders.slice(0, 2);
  const savedProviders = useMemo(
    () => savedProviderIds
      .map((providerId) => providers.find((provider) => provider.userId === providerId))
      .filter((provider): provider is ProviderCard => Boolean(provider)),
    [providers, savedProviderIds]
  );
  const providerCount = filteredProviders.length;

  async function toggleSavedProvider(providerId: string) {
    if (!user || user.role !== "customer" || savingProviderId) return;

    setSavingProviderId(providerId);
    try {
      if (savedProviderIds.includes(providerId)) {
        await userService.unsaveProvider(user.id, providerId);
        setSavedProviderIds((current) => current.filter((item) => item !== providerId));
      } else {
        await userService.saveProvider(user.id, providerId);
        setSavedProviderIds((current) => [...current, providerId]);
      }
    } finally {
      setSavingProviderId(null);
    }
  }

  return (
    <FixedScreen
      style={{ backgroundColor: theme.colors.background }}
      header={<BackHeader title={params.categoryName ? `${params.categoryName} Workers` : "Service Providers"} onBack={() => router.back()} />}
    >

      <SurfaceCard
        style={{
          padding: 0,
          overflow: "hidden",
          backgroundColor: theme.dark ? theme.colors.primaryLight : theme.colors.primaryDark
        }}
      >
        <View style={{ padding: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700", letterSpacing: 0.8 }}>
                LIVE MARKETPLACE
              </Text>
              <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 }}>
                {providerCount}
              </Text>
                <Text style={{ color: "rgba(255,255,255,0.85)" }}>workers found near you</Text>
            </View>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.14)",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="sparkles-outline" size={26} color="#fff" />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {topProviders.map((provider) => (
              <View
                key={provider.userId}
                style={{
                  flex: 1,
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: "rgba(255,255,255,0.12)"
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }} numberOfLines={1}>
                  {provider.displayName}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                  {provider.serviceCategories[0] || "General services"}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </SurfaceCard>

      <SearchBar placeholder="Search workers or services..." value={query} onChangeText={setQuery} />
      {query.trim() && searchSuggestions.length ? (
        <SurfaceCard style={{ gap: 0, padding: 0, overflow: "hidden" }}>
          {searchSuggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.id}
              onPress={suggestion.onPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderBottomWidth: index === searchSuggestions.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.border
              }}
            >
              <Ionicons name={suggestion.icon} size={18} color={theme.colors.primaryDark} />
              <Text style={{ color: theme.colors.text, fontWeight: "800", flex: 1 }} numberOfLines={1}>
                {suggestion.label}
              </Text>
            </Pressable>
          ))}
        </SurfaceCard>
      ) : null}

      {user?.role === "customer" && savedProviders.length ? (
        <SurfaceCard style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Saved providers</Text>
              <Text style={{ color: theme.colors.textMuted, marginTop: 3 }}>Quickly rebook trusted people you already like.</Text>
            </View>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 16,
                backgroundColor: theme.dark ? theme.colors.dangerSoft : "#FFE4EA",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="heart" size={20} color="#E11D48" />
            </View>
          </View>

          <View style={{ gap: 10 }}>
            {savedProviders.slice(0, 3).map((provider) => (
              <Pressable
                key={`saved-${provider.userId}`}
                onPress={() =>
                  router.push({
                    pathname: "/provider-detail",
                    params: { userId: provider.userId }
                  })
                }
                style={{
                  borderRadius: 18,
                  padding: 12,
                  backgroundColor: theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12
                }}
              >
                {provider.profilePhotoUrl ? (
                  <Image
                    source={{ uri: provider.profilePhotoUrl }}
                    style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: theme.colors.card }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 16,
                      backgroundColor: theme.colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Ionicons name="person-circle-outline" size={26} color={theme.colors.primaryDark} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }} numberOfLines={1}>
                    {provider.displayName}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                    {provider.serviceCategories[0] || "General services"} - {provider.city || "Location pending"}
                  </Text>
                  <Text style={{ color: theme.colors.primary, marginTop: 3, fontSize: 12, fontWeight: "800" }} numberOfLines={1}>
                    {getProviderResponseTimeLabel(provider)}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/booking-request",
                      params: { providerId: provider.userId, categoryId: provider.serviceCategories?.[0] || "" }
                    })
                  }
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: theme.colors.primary
                  }}
                >
                  <Text style={{ color: theme.colors.textOnPrimary, fontSize: 12, fontWeight: "900" }}>Book</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        </SurfaceCard>
      ) : null}

      <View style={{ gap: 14 }}>
        {filteredProviders.map((provider) => {
          const available = isAvailableNow(provider);
          const saved = savedProviderIds.includes(provider.userId);

          return (
            <Pressable
              key={provider.userId}
              onPress={() =>
                router.push({
                  pathname: "/provider-detail",
                  params: { userId: provider.userId }
                })
              }
            >
              <SurfaceCard style={{ gap: 16 }}>
                <View style={{ flexDirection: "row", gap: 14 }}>
                  {provider.profilePhotoUrl ? (
                    <Image
                      source={{ uri: provider.profilePhotoUrl }}
                      style={{ width: 70, height: 70, borderRadius: 22, backgroundColor: theme.colors.surfaceAlt }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 70,
                        height: 70,
                        borderRadius: 22,
                        backgroundColor: theme.colors.primarySoft,
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Ionicons name="person-circle-outline" size={34} color={theme.colors.primaryDark} />
                    </View>
                  )}

                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
                          {provider.displayName}
                        </Text>
                        <Text style={{ color: theme.colors.textMuted }} numberOfLines={1}>
                          {provider.businessName || "Independent service provider"}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => void toggleSavedProvider(provider.userId)}
                        disabled={savingProviderId === provider.userId}
                        accessibilityRole="button"
                        accessibilityLabel={saved ? "Remove saved provider" : "Save provider"}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: saved ? theme.dark ? theme.colors.dangerSoft : "#FFE4EA" : theme.colors.surfaceAlt,
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: savingProviderId === provider.userId ? 0.65 : 1
                        }}
                      >
                        <Ionicons name={saved ? "heart" : "heart-outline"} size={19} color={saved ? theme.colors.danger : theme.colors.textLight} />
                      </Pressable>
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <StatusBadge status={available ? "Available" : "Offline"} />
                      <StatusBadge status={`${provider.rating ? provider.rating.toFixed(1) : "New"} rating`} />
                      <StatusBadge status={getProviderResponseTimeLabel(provider)} />
                      {saved ? <StatusBadge status="Saved" /> : null}
                    </View>
                  </View>
                </View>

                <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }} numberOfLines={2}>
                  {provider.bio || "Professional local service provider ready for residential and small business work."}
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {[
                    provider.city || "Location pending",
                    provider.serviceCategories[0] || "General",
                    formatProviderStartingRate(provider, categories),
                    `${provider.portfolio?.length || 0} completed jobs`
                  ].map((item) => (
                    <View
                      key={`${provider.userId}-${item}`}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: theme.colors.surfaceAlt
                      }}
                    >
                      <Text style={{ color: theme.colors.text, fontWeight: "700", fontSize: 12 }}>{item}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <Ionicons name="star" size={16} color={theme.colors.accent} />
                      <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
                        {provider.rating ? provider.rating.toFixed(1) : "No ratings yet"}
                      </Text>
                    </View>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                      Service areas: {provider.serviceAreas?.length ? provider.serviceAreas.join(", ") : "Not listed yet"}
                    </Text>
                  </View>
                  <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>View profile</Text>
                </View>
              </SurfaceCard>
            </Pressable>
          );
        })}

        {!filteredProviders.length ? (
          <EmptyState
            title="No providers found"
            description="Try another service, city, or keyword. Saved providers can still appear here even when they are offline."
          />
        ) : null}
      </View>
    </FixedScreen>
  );
}
