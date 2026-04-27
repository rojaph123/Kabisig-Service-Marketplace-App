import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, Text, View } from "react-native";
import { Screen } from "../../src/components";

const icon = require("../../assets/branding/icon.jpg");

export default function WelcomeScreen() {
  return (
    <Screen style={{ backgroundColor: "#06152B", paddingHorizontal: 0, paddingTop: 0 }} contentContainerStyle={{ flexGrow: 1, padding: 0 }}>
      <LinearGradient
        colors={["#06152B", "#0A2B57", "#1485DA"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          minHeight: "100%",
          paddingHorizontal: 24,
          paddingTop: 34,
          paddingBottom: 28,
          justifyContent: "space-between"
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image source={icon} style={{ width: 74, height: 74, borderRadius: 24 }} resizeMode="cover" />
          <Text style={{ color: "#FFFFFF", fontSize: 36, fontWeight: "900", letterSpacing: 0.2 }}>Kabisig</Text>
        </View>

        <View style={{ gap: 22 }}>
          <View style={{ gap: 16 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 40, fontWeight: "900", lineHeight: 46 }}>
              Trusted local service, in one connected platform.
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.84)", fontSize: 16, lineHeight: 25 }}>
              Book verified help, follow service progress, stay updated through chat and notifications, and manage every request with a cleaner Kabisig experience.
            </Text>
          </View>

          <View
            style={{
              borderRadius: 28,
              padding: 18,
              backgroundColor: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.14)",
              gap: 12
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "900" }}>Built for real service coordination</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", lineHeight: 22 }}>
              Customers, providers, and admin teams stay aligned through one workflow for bookings, approvals, updates, payments, and support.
            </Text>
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <Pressable
            onPress={() => router.push("/(auth)/role-selection")}
            style={{
              borderRadius: 22,
              paddingVertical: 18,
              alignItems: "center",
              backgroundColor: "#FFFFFF"
            }}
          >
            <Text style={{ color: "#0A2B57", fontSize: 17, fontWeight: "900" }}>Get started</Text>
          </Pressable>
          <Text style={{ color: "rgba(255,255,255,0.72)", textAlign: "center", lineHeight: 20 }}>
            Continue to choose your role and access the right Kabisig workspace.
          </Text>
        </View>
      </LinearGradient>
    </Screen>
  );
}
