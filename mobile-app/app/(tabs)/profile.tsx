import { useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { reviewService, userService, type CustomerProfile, type ProviderProfile } from "@kabisig/shared";
import { AppHeader, Avatar, FeedbackBanner, FixedScreen, LoadingState, PrimaryButton, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { useThemeMode } from "../../src/hooks/ThemeProvider";
import { theme } from "../../src/theme";

export default function ProfileTab() {
  const { signOut, user } = useAuth();
  const { mode, setMode } = useThemeMode();
  const provider = user?.role === "provider";
  const [booting, setBooting] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [ratingAverage, setRatingAverage] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        if (!user) {
          setBooting(false);
          return;
        }

        setBooting(true);
        if (provider) {
          const [profile, average] = await Promise.all([
            userService.getProviderProfile(user.id),
            reviewService.getProviderAverageRating(user.id)
          ]);
          if (!active) return;
          setProviderProfile(profile);
          setRatingAverage(average);
        } else {
          const profile = await userService.getCustomerProfile(user.id);
          if (!active) return;
          setCustomerProfile(profile);
        }

        if (active) {
          setBooting(false);
        }
      }

      void load();
      return () => {
        active = false;
      };
    }, [provider, user])
  );

  const actionCards = useMemo(
    () =>
      provider
        ? [
            { label: "Business profile", icon: "briefcase-outline", route: "/provider-business-profile", subtitle: "Edit business name, service areas, rates, and photo" },
            { label: "Working days & schedule", icon: "calendar-outline", route: "/provider-schedule", subtitle: "Manage weekly availability in an easier time board" },
            { label: "Notifications", icon: "notifications-outline", route: "/notifications", subtitle: "Review alerts, job updates, and messages" },
            { label: "Help & Support", icon: "help-buoy-outline", route: "/help", subtitle: "Open support, issues, and platform help" },
            { label: "About Kabisig", icon: "information-circle-outline", route: "/about", subtitle: "Learn about the platform and mission" }
          ]
        : [
            { label: "Personal details", icon: "person-outline", route: "/profile-personal", subtitle: "Edit phone, location, addresses, and profile photo" },
            { label: "Notifications", icon: "notifications-outline", route: "/notifications", subtitle: "Review booking, payment, and message updates" },
            { label: "Help & Support", icon: "help-buoy-outline", route: "/help", subtitle: "Open support, issues, and platform help" },
            { label: "About Kabisig", icon: "information-circle-outline", route: "/about", subtitle: "Learn about the platform and mission" }
          ],
    [provider]
  );

  if (booting) {
    return (
      <FixedScreen header={<AppHeader title="Profile" />}>
        <LoadingState label="Loading profile..." />
      </FixedScreen>
    );
  }

  return (
    <FixedScreen
      header={
        <>
          <AppHeader title="Profile" />
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
        </>
      }
    >
      <SurfaceCard>
        <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
          <Avatar
            image={provider ? providerProfile?.profilePhotoUrl || user?.profilePhoto : customerProfile?.profilePhotoUrl || user?.profilePhoto}
            size={72}
            icon={provider ? "briefcase-outline" : "person-outline"}
          />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>
                {provider ? providerProfile?.displayName || user?.fullName : user?.fullName}
              </Text>
              {providerProfile?.isApproved ? <Ionicons name="checkmark-circle" size={18} color={theme.colors.info} /> : null}
            </View>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>{user?.email}</Text>
            <Text style={{ color: theme.colors.textLight, marginTop: 6 }}>{provider ? "Provider account" : "Customer account"}</Text>
          </View>
        </View>
      </SurfaceCard>

      {provider && providerProfile ? (
        <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, borderRadius: 18, padding: 14, backgroundColor: theme.colors.card }}>
              <Text style={{ color: theme.colors.textLight, fontSize: 12, fontWeight: "700" }}>Average rating</Text>
              <Text style={{ color: theme.colors.accentDark, fontSize: 26, fontWeight: "900", marginTop: 6 }}>
                ★ {ratingAverage ? ratingAverage.toFixed(1) : "New"}
              </Text>
            </View>
            <View style={{ flex: 1, borderRadius: 18, padding: 14, backgroundColor: theme.colors.card }}>
              <Text style={{ color: theme.colors.textLight, fontSize: 12, fontWeight: "700" }}>Working days</Text>
              <Text style={{ color: theme.colors.text, fontSize: 26, fontWeight: "900", marginTop: 6 }}>
                {providerProfile.availability.filter((slot) => slot.available).length}
              </Text>
            </View>
          </View>
        </SurfaceCard>
      ) : null}

      <View style={{ gap: 12 }}>
        {actionCards.map((item) => (
          <Pressable key={item.label} onPress={() => router.push(item.route as never)}>
            <SurfaceCard style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.colors.surfaceAlt
                }}
              >
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={theme.colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 16 }}>{item.label}</Text>
                <Text style={{ color: theme.colors.textMuted, marginTop: 4, lineHeight: 19 }}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
            </SurfaceCard>
          </Pressable>
        ))}
      </View>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Appearance</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
          Switch the entire app between light, dark, or system appearance.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
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
                  setFeedback({
                    type: "success",
                    title: "Appearance updated",
                    message: `Kabisig is now using ${option.label.toLowerCase()} mode.`
                  });
                }}
                style={{
                  flex: 1,
                  minWidth: 96,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  alignItems: "center",
                  gap: 6
                }}
              >
                <Ionicons name={option.icon} size={18} color={active ? "#fff" : theme.colors.primaryDark} />
                <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800" }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>

      <PrimaryButton label="Logout" onPress={() => void signOut()} style={{ backgroundColor: theme.colors.accentDark }} />
    </FixedScreen>
  );
}
