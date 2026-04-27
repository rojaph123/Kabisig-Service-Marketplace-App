import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { providerService, type ProviderProfile } from "@kabisig/shared";
import { BackHeader, EmptyState, FixedScreen, SearchBar, StatusBadge, SurfaceCard } from "../src/components";
import { theme } from "../src/theme";

type ProviderCard = ProviderProfile & { userId: string };

function isAvailableNow(provider: ProviderCard) {
  return provider.availability?.some((slot) => slot.available) ?? false;
}

export default function ProvidersScreen() {
  const [query, setQuery] = useState("");
  const [providers, setProviders] = useState<ProviderCard[]>([]);

  useEffect(() => {
    void providerService.getApprovedProviders(500).then((items) =>
      setProviders(items.sort((a, b) => (b.rating || 0) - (a.rating || 0)))
    );
  }, []);

  const filteredProviders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return providers;

    return providers.filter((provider) =>
      [
        provider.displayName,
        provider.businessName,
        provider.city,
        provider.bio,
        ...provider.serviceCategories,
        ...provider.serviceAreas
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [providers, query]);

  const topProviders = filteredProviders.slice(0, 2);
  const providerCount = filteredProviders.length;

  return (
    <FixedScreen style={{ backgroundColor: theme.colors.background }} header={<BackHeader title="Service Providers" onBack={() => router.back()} />}>

      <SurfaceCard
        style={{
          padding: 0,
          overflow: "hidden",
          backgroundColor: theme.colors.primaryDark
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
              <Text style={{ color: "rgba(255,255,255,0.85)" }}>available providers near you</Text>
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

      <SearchBar placeholder="Search provider, city, or service..." value={query} onChangeText={setQuery} />

      <View style={{ gap: 14 }}>
        {filteredProviders.map((provider) => {
          const available = isAvailableNow(provider);

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
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <StatusBadge status={available ? "Available" : "Offline"} />
                      <StatusBadge status={`${provider.rating ? provider.rating.toFixed(1) : "New"} rating`} />
                    </View>
                  </View>
                </View>

                <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }} numberOfLines={2}>
                  {provider.bio || "Professional local service provider ready for residential and small business work."}
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {[provider.city || "Location pending", provider.serviceCategories[0] || "General", `PHP ${(provider.hourlyRate || 0).toLocaleString()}/hr`].map((item) => (
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
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Ionicons name="star" size={16} color={theme.colors.accent} />
                    <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
                      {provider.rating ? provider.rating.toFixed(1) : "No ratings yet"}
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
            description="Try another service, city, or keyword. Approved providers with active availability will appear here."
          />
        ) : null}
      </View>
    </FixedScreen>
  );
}
