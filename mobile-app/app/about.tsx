import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BackHeader, BrandBlock, FixedScreen, SurfaceCard } from "../src/components";
import { theme } from "../src/theme";

const pillars = [
  {
    icon: "shield-checkmark-outline",
    title: "Trusted marketplace",
    description: "Customer, provider, and admin flows are designed around verified onboarding, transparent ratings, and accountable service delivery."
  },
  {
    icon: "construct-outline",
    title: "Built for local services",
    description: "Kabisig supports electricians, plumbers, welders, roofers, and construction workers with role-aware booking and job management."
  },
  {
    icon: "chatbubbles-outline",
    title: "Connected communication",
    description: "In-app messaging, booking updates, complaints, and support touchpoints keep every role aligned from request to completion."
  }
];

export default function AboutScreen() {
  return (
    <FixedScreen
      style={{ backgroundColor: theme.colors.background }}
      header={<BackHeader title="About Kabisig" onBack={() => router.back()} />}
    >

      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 30,
          padding: 24,
          gap: 14,
          overflow: "hidden"
        }}
      >
        <View style={{ position: "absolute", width: 140, height: 140, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.10)", right: -18, top: -24 }} />
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
          <BrandBlock compact />
        </View>
        <Text style={{ color: theme.colors.textOnPrimary, fontSize: 28, fontWeight: "900" }}>Tiwala. Galing. Kabisig.</Text>
        <Text style={{ color: "rgba(255,255,255,0.86)", lineHeight: 22 }}>
          Kabisig is a service platform that connects households and businesses with dependable local professionals through a cleaner, more accountable marketplace experience.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {["Customer app", "Provider app", "Admin panel"].map((item) => (
            <View key={item} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)" }}>
              <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "700", fontSize: 12 }}>{item}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "800" }}>Our mission</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 22 }}>
          We help customers discover reliable service providers faster, while giving skilled local professionals a more credible way to present their business, availability, ratings, and work history.
        </Text>
      </SurfaceCard>

      <View style={{ gap: 12 }}>
        <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "800" }}>Why Kabisig feels different</Text>
        {pillars.map((pillar) => (
          <SurfaceCard key={pillar.title} style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
            <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={pillar.icon as keyof typeof Ionicons.glyphMap} size={22} color={theme.colors.primaryDark} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "800" }}>{pillar.title}</Text>
              <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>{pillar.description}</Text>
            </View>
          </SurfaceCard>
        ))}
      </View>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "800" }}>Platform snapshot</Text>
        <View style={{ marginTop: 12, gap: 12 }}>
          {[
            "Customer booking and provider discovery",
            "Provider onboarding with Google Drive document links",
            "Admin approval workflow and operations oversight",
            "Ratings, complaints, support, messaging, and notifications-ready flows"
          ].map((item) => (
            <View key={item} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.success} />
              <Text style={{ color: theme.colors.text }}>{item}</Text>
            </View>
          ))}
        </View>
      </SurfaceCard>

      <Text style={{ color: theme.colors.textLight, fontSize: 12, textAlign: "center" }}>
        Kabisig MVP • 2026 • Built for trusted local service delivery
      </Text>
    </FixedScreen>
  );
}
