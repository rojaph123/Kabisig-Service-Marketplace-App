import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Image, Platform, Pressable, Text, View } from "react-native";
import { useEffect, useRef } from "react";
import { Screen, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";

const icon = require("../../assets/branding/icon.jpg");

const roles = [
  {
    key: "customer",
    title: "Customer access",
    description: "Book trusted local help, follow updates, and manage everything from one cleaner customer dashboard.",
    icon: "person-outline" as const,
    items: ["Bookings", "Messages", "Payments"]
  },
  {
    key: "provider",
    title: "Provider access",
    description: "Manage onboarding, availability, jobs, and customer coordination with a more professional provider workspace.",
    icon: "briefcase-outline" as const,
    items: ["Onboarding", "Jobs", "Availability"]
  }
] as const;

export default function RoleSelectionScreen() {
  const { setSelectedRole } = useAuth();
  const useNativeDriver = Platform.OS !== "web";
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1500, useNativeDriver }),
        Animated.timing(float, { toValue: 0, duration: 1500, useNativeDriver })
      ])
    ).start();
  }, [float, useNativeDriver]);

  return (
    <Screen style={{ backgroundColor: theme.colors.background, paddingHorizontal: 0, paddingTop: 0 }} contentContainerStyle={{ flexGrow: 1, padding: 0 }}>
      <LinearGradient
        colors={theme.dark ? ["#09111D", "#102746", "#163D6D"] : ["#071B33", "#0C3E78", "#1790E5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          minHeight: "100%",
          paddingHorizontal: 24,
          paddingTop: 34,
          paddingBottom: 24,
          justifyContent: "space-between"
        }}
      >
        <View style={{ gap: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }}>
              <Image source={icon} style={{ width: 82, height: 82, borderRadius: 26 }} resizeMode="cover" />
            </Animated.View>
            <Text style={{ color: "#FFFFFF", fontSize: 42, fontWeight: "900" }}>Kabisig</Text>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 34, fontWeight: "900", lineHeight: 40 }}>
              Choose the workspace that matches your role.
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 15, lineHeight: 23 }}>
              Continue as a customer to request services, or as a provider to manage your application, jobs, and client updates.
            </Text>
          </View>
        </View>

        <View style={{ gap: 16 }}>
          {roles.map((role, index) => (
            <SurfaceCard key={role.key} style={{ padding: 0, overflow: "hidden", borderRadius: 28 }}>
              <Pressable
                onPress={() => {
                  setSelectedRole(role.key);
                  router.push({ pathname: "/(auth)/login", params: { role: role.key } });
                }}
                style={{
                  padding: 22,
                  gap: 14,
                  backgroundColor: theme.dark ? "rgba(13,27,46,0.94)" : "#FFFFFF",
                  transform: [{ translateY: index === 0 ? 0 : 2 }]
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 22,
                      backgroundColor: role.key === "customer" ? (theme.dark ? "#15304F" : "#E8F4FF") : (theme.dark ? "#1A2A54" : "#EEF3FF"),
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: role.key === "customer" ? "#4FA9FF" : "#7AA2FF"
                    }}
                  >
                    <Ionicons name={role.icon} size={26} color={role.key === "customer" ? "#39A0FF" : "#7AA2FF"} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 21, fontWeight: "900" }}>{role.title}</Text>
                    <Text style={{ color: theme.colors.textMuted, lineHeight: 22 }}>{role.description}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                      {role.items.map((item) => (
                        <View
                          key={item}
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: theme.dark ? "rgba(255,255,255,0.08)" : theme.colors.surfaceAlt
                          }}
                        >
                          <Text style={{ color: theme.dark ? "#DBEAFE" : theme.colors.primaryDark, fontSize: 11, fontWeight: "800" }}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.dark ? "rgba(255,255,255,0.07)" : "#F3F8FF" }}>
                    <Ionicons name="arrow-forward-outline" size={22} color={theme.colors.primary} />
                  </View>
                </View>
              </Pressable>
            </SurfaceCard>
          ))}
        </View>

        <View style={{ paddingTop: 20 }}>
          <Text style={{ textAlign: "center", color: "rgba(255,255,255,0.84)", fontWeight: "700" }}>Developed by Rov</Text>
          <Text style={{ textAlign: "center", color: "rgba(255,255,255,0.68)", marginTop: 4 }}>v1.0</Text>
        </View>
      </LinearGradient>
    </Screen>
  );
}
