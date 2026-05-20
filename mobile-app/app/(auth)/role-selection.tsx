import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Image, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef } from "react";
import { SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";

const icon = require("../../assets/branding/icon.jpg");

const roles = [
  {
    key: "customer",
    title: "Customer",
    description: "Find trusted local help, book services, and manage your requests.",
    icon: "person-outline" as const,
    items: ["Bookings", "Messages", "Payments"]
  },
  {
    key: "provider",
    title: "Skilled Worker",
    description: "Manage your profile, jobs, schedule, and customer updates.",
    icon: "briefcase-outline" as const,
    items: ["Application", "Jobs", "Availability"]
  }
] as const;

export default function RoleSelectionScreen() {
  const { setSelectedRole } = useAuth();
  const { width, height } = useWindowDimensions();
  const useNativeDriver = Platform.OS !== "web";
  const float = useRef(new Animated.Value(0)).current;
  const tiny = height < 660 || width < 340;
  const compact = height < 760 || width < 380;
  const maxWidth = 520;
  const sidePadding = tiny ? 16 : compact ? 18 : 22;
  const topPadding = tiny ? 14 : compact ? 20 : 28;
  const bottomPadding = tiny ? 10 : compact ? 14 : 18;
  const heroGap = tiny ? 10 : compact ? 13 : 16;
  const logoSize = tiny ? 54 : compact ? 62 : 72;
  const logoRadius = tiny ? 17 : compact ? 20 : 23;
  const brandSize = tiny ? 31 : compact ? 36 : 42;
  const headlineSize = tiny ? 22 : compact ? 25 : 29;
  const headlineLineHeight = tiny ? 27 : compact ? 30 : 35;
  const bodySize = tiny ? 12 : compact ? 13 : 14;
  const bodyLineHeight = tiny ? 17 : compact ? 19 : 21;
  const cardPadding = tiny ? 14 : compact ? 16 : 18;
  const roleIconSize = tiny ? 46 : compact ? 52 : 58;
  const roleIconRadius = tiny ? 15 : compact ? 17 : 19;
  const roleTitleSize = tiny ? 17 : compact ? 18 : 20;
  const footerTop = tiny ? 6 : compact ? 8 : 12;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1500, useNativeDriver }),
        Animated.timing(float, { toValue: 0, duration: 1500, useNativeDriver })
      ])
    ).start();
  }, [float, useNativeDriver]);

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <LinearGradient
        colors={theme.dark ? ["#09111D", "#102746", "#163D6D"] : ["#071B33", "#0C3E78", "#1790E5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          paddingHorizontal: sidePadding,
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          justifyContent: "space-between"
        }}
      >
        <View style={{ width: "100%", maxWidth, alignSelf: "center", gap: heroGap }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: tiny ? 10 : 12 }}>
            <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }}>
              <Image
                source={icon}
                style={{ width: logoSize, height: logoSize, borderRadius: logoRadius, borderWidth: 2, borderColor: "rgba(255,255,255,0.34)" }}
                resizeMode="cover"
              />
            </Animated.View>
            <Text style={{ color: "#FFFFFF", fontSize: brandSize, fontWeight: "900" }}>Kabisig</Text>
          </View>

          <View style={{ gap: tiny ? 5 : 7 }}>
            <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: headlineSize, fontWeight: "900", lineHeight: headlineLineHeight }}>
              How will you use Kabisig?
            </Text>
            <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.82)", fontSize: bodySize, lineHeight: bodyLineHeight }}>
              Choose the workspace made for your account. You can continue with the right tools after login.
            </Text>
          </View>
        </View>

        <View style={{ width: "100%", maxWidth, alignSelf: "center", gap: tiny ? 10 : 12 }}>
          {roles.map((role, index) => (
            <SurfaceCard key={role.key} style={{ padding: 0, overflow: "hidden", borderRadius: 22 }}>
              <Pressable
                onPress={() => {
                  setSelectedRole(role.key);
                  router.push({ pathname: "/(auth)/login", params: { role: role.key } });
                }}
                style={{
                  padding: cardPadding,
                  gap: tiny ? 8 : 10,
                  backgroundColor: theme.dark ? "rgba(13,27,46,0.96)" : "#FFFFFF",
                  borderLeftWidth: 5,
                  borderLeftColor: role.key === "customer" ? "#38BDF8" : "#818CF8",
                  transform: [{ translateY: index === 0 ? 0 : 2 }]
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tiny ? 10 : 12 }}>
                  <View
                    style={{
                      width: roleIconSize,
                      height: roleIconSize,
                      borderRadius: roleIconRadius,
                      backgroundColor: role.key === "customer" ? (theme.dark ? "#15304F" : "#E8F4FF") : (theme.dark ? "#1A2A54" : "#EEF3FF"),
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: role.key === "customer" ? "#4FA9FF" : "#7AA2FF"
                    }}
                  >
                    <Ionicons name={role.icon} size={tiny ? 22 : compact ? 24 : 26} color={role.key === "customer" ? "#39A0FF" : "#7AA2FF"} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: tiny ? 5 : 6 }}>
                    <Text numberOfLines={1} style={{ color: theme.colors.text, fontSize: roleTitleSize, fontWeight: "900" }}>{role.title}</Text>
                    <Text numberOfLines={2} style={{ color: theme.colors.textMuted, fontSize: tiny ? 12 : 13, lineHeight: tiny ? 17 : 19 }}>{role.description}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tiny ? 5 : 6, marginTop: 2 }}>
                      {role.items.map((item) => (
                        <View
                          key={item}
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: tiny ? 8 : 10,
                            paddingVertical: tiny ? 4 : 5,
                            backgroundColor: theme.dark ? "rgba(255,255,255,0.08)" : theme.colors.surfaceAlt
                          }}
                        >
                          <Text style={{ color: theme.dark ? "#DBEAFE" : theme.colors.primaryDark, fontSize: tiny ? 10 : 11, fontWeight: "800" }}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={{ width: tiny ? 36 : 40, height: tiny ? 36 : 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.dark ? "rgba(255,255,255,0.07)" : "#F3F8FF" }}>
                    <Ionicons name="arrow-forward-outline" size={tiny ? 18 : 21} color={theme.colors.primary} />
                  </View>
                </View>
              </Pressable>
            </SurfaceCard>
          ))}
        </View>

        <View style={{ width: "100%", maxWidth, alignSelf: "center", paddingTop: footerTop }}>
          <Text style={{ textAlign: "center", color: "rgba(255,255,255,0.78)", fontWeight: "700", fontSize: tiny ? 11 : 12 }}>
            Developed by Rov - v1.0
          </Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}
