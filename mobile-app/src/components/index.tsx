import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  useWindowDimensions
} from "react-native";
import { SafeAreaView, useSafeAreaInsets, type Edge } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { theme } from "../theme";
import { canNavigateBack, safeBack } from "../utils/navigation";
import { useResponsiveLayout } from "../utils/responsive";
import { getStatusColor } from "../utils/status";

const logo = require("../../assets/branding/icon.jpg");
const logoWithTagline = require("../../assets/branding/logo-with-tagline.jpg");
const loadingLogo = require("../../assets/branding/Loading Logo.png");
const startupLogo = require("../../assets/branding/Facebook Logo.png");

export function Screen({
  children,
  style,
  contentContainerStyle
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const keyboardOffset = Platform.OS === "ios" ? Math.max(insets.top, 12) : 0;

  useFocusEffect(
    useCallback(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo?.({ y: 0, animated: false });
      });
    }, [])
  );

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[styles.screen, { backgroundColor: theme.colors.background }, style]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              alignSelf: "center",
              width: "100%",
              maxWidth: layout.maxContentWidth,
              padding: layout.horizontalPadding,
              gap: layout.verticalGap,
              paddingBottom: 132 + Math.max(insets.bottom, 12)
            },
            contentContainerStyle
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function FixedScreen({
  header,
  footer,
  children,
  style,
  contentContainerStyle,
  refreshing,
  onRefresh,
  safeAreaEdges = ["top", "left", "right", "bottom"]
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  safeAreaEdges?: Edge[];
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const keyboardOffset = Platform.OS === "ios" ? Math.max(insets.top, 12) : 0;

  useFocusEffect(
    useCallback(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo?.({ y: 0, animated: false });
      });
    }, [])
  );

  return (
    <SafeAreaView edges={safeAreaEdges} style={[styles.screen, { backgroundColor: theme.colors.background }, style]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
        {header ? (
          <View style={{ paddingHorizontal: layout.horizontalPadding, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
            <View style={{ alignSelf: "center", width: "100%", maxWidth: layout.maxContentWidth }}>{header}</View>
          </View>
        ) : null}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            {
              alignSelf: "center",
              width: "100%",
              maxWidth: layout.maxContentWidth,
              paddingHorizontal: layout.horizontalPadding,
              paddingBottom: theme.spacing.xxl * 2 + Math.max(insets.bottom, 12),
              gap: layout.verticalGap
            },
            contentContainerStyle
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={{
	              paddingHorizontal: layout.horizontalPadding,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: theme.colors.background,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              gap: 10
            }}
          >
              <View style={{ alignSelf: "center", width: "100%", maxWidth: layout.maxContentWidth }}>{footer}</View>
            </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function LaunchScreen() {
  const loopProgress = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== "web";

  useEffect(() => {
    loopProgress.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(loopProgress, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
          isInteraction: false
        }),
        Animated.timing(loopProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver,
          isInteraction: false
        })
      ]),
      { iterations: -1, resetBeforeIteration: true }
    );

    animation.start();
    return () => animation.stop();
  }, [loopProgress, useNativeDriver]);

  const logoScale = loopProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.055, 1]
  });
  const logoOpacity = loopProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.9, 1]
  });
  const tiwalaOpacity = loopProgress.interpolate({
    inputRange: [0, 0.16, 0.33, 1],
    outputRange: [0.62, 1, 0.62, 0.62]
  });
  const tiwalaScale = loopProgress.interpolate({
    inputRange: [0, 0.16, 0.33, 1],
    outputRange: [1, 1.08, 1, 1]
  });
  const galingOpacity = loopProgress.interpolate({
    inputRange: [0, 0.33, 0.5, 0.67, 1],
    outputRange: [0.62, 0.62, 1, 0.62, 0.62]
  });
  const galingScale = loopProgress.interpolate({
    inputRange: [0, 0.33, 0.5, 0.67, 1],
    outputRange: [1, 1, 1.08, 1, 1]
  });
  const kabisigOpacity = loopProgress.interpolate({
    inputRange: [0, 0.67, 0.84, 1],
    outputRange: [0.62, 0.62, 1, 0.62]
  });
  const kabisigScale = loopProgress.interpolate({
    inputRange: [0, 0.67, 0.84, 1],
    outputRange: [1, 1, 1.08, 1]
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#157FD4" }}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
          gap: 22
        }}
      >
        <Animated.View
          style={{
            width: 236,
            height: 236,
            borderRadius: 54,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.14)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
            opacity: logoOpacity,
            transform: [{ scale: logoScale }]
          }}
        >
          <Image source={loadingLogo} style={{ width: 198, height: 198 }} resizeMode="contain" />
        </Animated.View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Animated.Text style={{ color: "#FFFFFF", opacity: tiwalaOpacity, transform: [{ scale: tiwalaScale }], fontWeight: "900", fontSize: 18 }}>
            Tiwala
          </Animated.Text>
          <Animated.Text style={{ color: "#FFFFFF", opacity: galingOpacity, transform: [{ scale: galingScale }], fontWeight: "900", fontSize: 18 }}>
            Galing
          </Animated.Text>
          <Animated.Text style={{ color: "#FFFFFF", opacity: kabisigOpacity, transform: [{ scale: kabisigScale }], fontWeight: "900", fontSize: 18 }}>
            Kabisig
          </Animated.Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

export function AppStartupSplash() {
  const loopProgress = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== "web";

  useEffect(() => {
    loopProgress.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(loopProgress, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
          isInteraction: false
        }),
        Animated.timing(loopProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver,
          isInteraction: false
        })
      ]),
      { iterations: -1, resetBeforeIteration: true }
    );

    animation.start();
    return () => animation.stop();
  }, [loopProgress, useNativeDriver]);

  const logoScale = loopProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.045, 1]
  });
  const logoOpacity = loopProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.92, 1]
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0E8FE8" }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 28 }}>
        <Animated.Image
          source={startupLogo}
          style={{
            width: 210,
            height: 210,
            borderRadius: 56,
            opacity: logoOpacity,
            transform: [{ scale: logoScale }]
          }}
          resizeMode="cover"
        />
      </View>
    </SafeAreaView>
  );
}

export function BrandBlock({ compact = false, size }: { compact?: boolean; size?: number }) {
  return (
    <Image
      source={compact ? logo : logoWithTagline}
      style={compact ? [{ width: size || 42, height: size || 42, borderRadius: (size || 42) / 2 }] : styles.logoWide}
      resizeMode="contain"
    />
  );
}

export function HeroHeader({
  title,
  subtitle,
  location,
  children,
  onNotificationsPress,
  notificationCount = 0
}: {
  title: string;
  subtitle: string;
  location?: string;
  children?: ReactNode;
  onNotificationsPress?: () => void;
  notificationCount?: number;
}) {
  const heroColors: [string, string] = theme.dark ? ["#10233D", "#16355F"] : ["#0F8DEB", "#0A6FCA"];
  return (
    <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroGlowPrimary} />
      <View style={styles.heroGlowSecondary} />
      <View style={styles.heroTop}>
        <View style={styles.heroIdentityBlock}>
          <View style={styles.heroLogoShell}>
            <BrandBlock compact />
          </View>
          {location ? (
            <View style={styles.heroLocationRow}>
              <View style={styles.heroLocationPin}>
                <View style={styles.heroLocationPinCore} />
              </View>
              <Text style={styles.heroLocation} numberOfLines={2}>
                {location}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable onPress={onNotificationsPress} style={styles.heroIconWrap}>
          <Ionicons name="notifications-outline" size={20} color="#fff" />
          {notificationCount ? (
            <View
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                paddingHorizontal: 4,
                backgroundColor: "#EF4444",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: "#fff"
              }}
            >
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>
                {notificationCount > 9 ? "9+" : notificationCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
      {children}
    </LinearGradient>
  );
}

export function AppHeader({ title, action }: { title: string; action?: ReactNode }) {
  const layout = useResponsiveLayout();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.pageTitle, { color: theme.colors.text, fontSize: layout.pageTitleSize }]}>{title}</Text>
      {action}
    </View>
  );
}

export function BackHeader({
  title,
  onBack,
  action,
  fallbackRoute = "/(tabs)/home"
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
  fallbackRoute?: string;
}) {
  const layout = useResponsiveLayout();
  return (
    <View style={[styles.sectionRow, { alignItems: "center" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
        <Pressable
          onPress={() => {
            if (onBack && canNavigateBack()) {
              try {
                onBack();
              } catch {
                safeBack(fallbackRoute);
              }
              return;
            }
            safeBack(fallbackRoute);
          }}
          style={[styles.backButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <Ionicons name="arrow-back-outline" size={18} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.pageTitle, { color: theme.colors.text, fontSize: layout.pageTitleSize }]}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function SearchBar({
  placeholder,
  value,
  onChangeText,
  onSubmitEditing,
  compact = false
}: {
  placeholder: string;
  value?: string;
  onChangeText?: (value: string) => void;
  onSubmitEditing?: () => void;
  compact?: boolean;
}) {
  void compact;
  const small = true;
  return (
    <View
      style={[
        styles.searchWrap,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: small ? 16 : 20,
          paddingHorizontal: small ? 12 : 14,
          paddingVertical: small ? 8 : 12
        }
      ]}
    >
      <View
        style={[
          styles.searchIconShell,
          {
            backgroundColor: theme.dark ? theme.colors.surfaceAlt : "#EDF6FF",
            width: small ? 30 : 36,
            height: small ? 30 : 36,
            borderRadius: small ? 11 : 14
          }
        ]}
      >
        <Ionicons name="search-outline" size={small ? 15 : 18} color={theme.colors.primary} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.searchInput, { color: theme.colors.text, fontSize: small ? 14 : 15 }]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}

export function SectionHeader({ title, actionLabel }: { title: string; actionLabel?: string }) {
  const layout = useResponsiveLayout();
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionTitleWrap}>
        <View style={styles.sectionAccent} />
        <Text style={[styles.sectionTitle, { fontSize: layout.sectionTitleSize }]}>{title}</Text>
      </View>
      {actionLabel ? <Text style={styles.sectionAction}>{actionLabel}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  style,
  disabled = false
}: {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.primaryButton, disabled && styles.primaryButtonDisabled, style]} onPress={onPress} disabled={disabled}>
      {icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled = false }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={[
        styles.secondaryButton,
        { backgroundColor: theme.dark ? theme.colors.surfaceAlt : theme.colors.primaryLight, borderColor: theme.dark ? theme.colors.border : theme.colors.primary },
        disabled && styles.secondaryButtonDisabled
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.secondaryButtonLabel, { color: theme.dark ? theme.colors.text : theme.colors.primaryDark }, disabled && styles.secondaryButtonLabelDisabled]}>{label}</Text>
    </Pressable>
  );
}

export function SurfaceCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const layout = useResponsiveLayout();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: layout.cardRadius,
          padding: layout.cardPadding
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

export function FeedbackBanner({
  type = "info",
  title,
  message
}: {
  type?: "success" | "error" | "info";
  title: string;
  message: string;
}) {
  const palette =
    type === "success"
      ? { bg: theme.colors.successSoft, border: theme.colors.success, icon: "checkmark-circle-outline" as const }
      : type === "error"
        ? { bg: theme.colors.dangerSoft, border: theme.colors.danger, icon: "alert-circle-outline" as const }
        : { bg: theme.colors.infoSoft, border: theme.colors.info, icon: "information-circle-outline" as const };
  return (
    <View style={[styles.feedbackBanner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Ionicons name={palette.icon} size={22} color={palette.border} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>{message}</Text>
      </View>
    </View>
  );
}

export function FullScreenPopup({
  visible,
  title,
  message,
  icon = "checkmark-circle",
  tone = "success",
  dismissLabel,
  onDismiss
}: {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: "success" | "info" | "error";
  dismissLabel?: string;
  onDismiss?: () => void;
}) {
  if (!visible) return null;

  const palette =
    tone === "info"
      ? { bg: theme.colors.infoSoft, iconColor: theme.colors.info }
      : tone === "error"
        ? { bg: theme.colors.dangerSoft, iconColor: theme.colors.danger }
        : { bg: theme.colors.successSoft, iconColor: theme.colors.success };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.32)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }}
      >
        <SurfaceCard style={{ width: "100%", maxWidth: 340, alignItems: "center", paddingVertical: 28 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: palette.bg, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={icon} size={40} color={palette.iconColor} />
          </View>
          <Text style={{ color: theme.colors.text, fontSize: 21, fontWeight: "900", marginTop: 14, textAlign: "center" }}>{title}</Text>
          <Text style={{ color: theme.colors.textMuted, textAlign: "center" }}>{message}</Text>
          {onDismiss ? (
            <Pressable
              onPress={onDismiss}
              style={{
                marginTop: 18,
                minWidth: 132,
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 18,
                alignItems: "center",
                backgroundColor: theme.colors.primary
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>{dismissLabel || "Okay"}</Text>
            </Pressable>
          ) : null}
        </SurfaceCard>
      </View>
    </Modal>
  );
}

export function MapPreviewModal({
  visible,
  title,
  subtitle,
  mapUrl,
  onClose,
  onOpenExternal
}: {
  visible: boolean;
  title?: string;
  subtitle?: string;
  mapUrl: string;
  onClose: () => void;
  onOpenExternal?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const modalWidth = Math.min(width - 32, 520);
  const modalHeight = Math.min(height * 0.68, 520);
  const IFrame = "iframe" as any;
  const escapedMapUrl = mapUrl.replace(/"/g, "&quot;");
  const nativeMapHtml = `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <style>
          html, body, iframe { margin: 0; width: 100%; height: 100%; border: 0; background: #EAF4FF; }
        </style>
      </head>
      <body>
        <iframe src="${escapedMapUrl}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
      </body>
    </html>
  `;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(2, 8, 23, 0.56)",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}
      >
        <SurfaceCard style={{ width: modalWidth, padding: 0, overflow: "hidden", gap: 0 }}>
          <LinearGradient
            colors={["#0F8DEB", "#0A6FCA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: 18, paddingVertical: 16 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name="location" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>{title || "Location preview"}</Text>
                {subtitle ? (
                  <Text style={{ color: "rgba(255,255,255,0.84)", marginTop: 4 }} numberOfLines={2}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>
          </LinearGradient>

          <View style={{ height: modalHeight, backgroundColor: theme.colors.surfaceAlt }}>
            {Platform.OS === "web" ? (
              <IFrame
                src={mapUrl}
                style={{ width: "100%", height: "100%", border: "0" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <WebView
                originWhitelist={["*"]}
                source={{ html: nativeMapHtml }}
                style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }}
              />
            )}
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 16,
              backgroundColor: theme.colors.card,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border
            }}
          >
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Close" onPress={onClose} />
            </View>
            {onOpenExternal ? (
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Open in maps" onPress={onOpenExternal} icon="open-outline" />
              </View>
            ) : null}
          </View>
        </SurfaceCard>
      </View>
    </Modal>
  );
}

function inferPreviewKind(uri: string) {
  const normalized = uri.toLowerCase();
  if (
    normalized.startsWith("data:video/") ||
    normalized.includes(".mp4") ||
    normalized.includes(".mov") ||
    normalized.includes(".webm") ||
    normalized.includes(".m4v")
  ) {
    return "video";
  }
  return "image";
}

export function MediaPreviewModal({
  visible,
  uri,
  title,
  onClose
}: {
  visible: boolean;
  uri?: string | null;
  title?: string;
  onClose: () => void;
}) {
  if (!visible || !uri) return null;

  const previewKind = inferPreviewKind(uri);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(2, 8, 23, 0.82)",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}
      >
        <View style={{ width: "100%", maxWidth: 460, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 19, fontWeight: "900" }}>{title || "Media Preview"}</Text>
              <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 4 }}>
                {previewKind === "video" ? "Video attachment" : "Image attachment"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{
                width: 42,
                height: 42,
                borderRadius: 16,
                backgroundColor: "rgba(255,255,255,0.14)",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>

          <View
            style={{
              borderRadius: 24,
              overflow: "hidden",
              backgroundColor: "#08111F",
              minHeight: 320,
              maxHeight: 520
            }}
          >
            {previewKind === "video" ? (
              <WebView
                source={{
                  html: `
                    <html>
                      <body style="margin:0;background:#08111F;display:flex;align-items:center;justify-content:center;height:100vh;">
                        <video src="${uri}" controls playsinline style="width:100%;height:100%;max-width:100%;max-height:100%;background:#08111F;"></video>
                      </body>
                    </html>
                  `
                }}
                style={{ width: "100%", height: 420, backgroundColor: "#08111F" }}
              />
            ) : (
              <Image
                source={{ uri }}
                style={{ width: "100%", height: 420, backgroundColor: "#08111F" }}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function LoadingState({ label = "Preparing..." }: { label?: string }) {
  return (
    <View style={[styles.loadingState, { backgroundColor: theme.colors.surfaceAlt }]}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
      <Text style={[styles.helper, { color: theme.colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
  right
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} style={styles.collapsibleHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.helper, { color: theme.colors.textMuted }]}>{subtitle}</Text> : null}
        </View>
        {right}
        <Ionicons name={open ? "chevron-up-outline" : "chevron-down-outline"} size={18} color={theme.colors.textMuted} />
      </Pressable>
      {open ? <View style={{ gap: 12 }}>{children}</View> : null}
    </View>
  );
}

export function FormInput(props: TextInputProps & { label: string; required?: boolean; error?: boolean; helper?: string }) {
  const { label, required, error, helper, style, autoCorrect, ...inputProps } = props;
  return (
    <View style={styles.formGroup}>
      <Text style={[styles.formLabel, { color: theme.colors.text }]}>
        {label}
        {required ? <Text style={{ color: theme.colors.danger }}> *</Text> : null}
      </Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={theme.colors.textMuted}
        autoCorrect={autoCorrect ?? false}
        style={[
          styles.formInput,
          {
            backgroundColor: theme.colors.card,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            color: theme.colors.text
          },
          style
        ]}
      />
      {helper ? <Text style={[styles.helper, { color: theme.colors.textMuted }]}>{helper}</Text> : null}
    </View>
  );
}

export function ImageUploadField({
  label,
  value,
  onChange,
  helper,
  required,
  error,
  maxSizeMb,
  onError,
  compact = false
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  helper?: string;
  required?: boolean;
  error?: boolean;
  maxSizeMb?: number;
  onError?: (message: string) => void;
  compact?: boolean;
}) {
  const maxBytes = (maxSizeMb || 5) * 1024 * 1024;
  const [preparing, setPreparing] = useState(false);
  const openPicker = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      void (async () => {
        setPreparing(true);
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setPreparing(false);
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
          base64: true
        });

        if (result.canceled || !result.assets.length) {
          setPreparing(false);
          return;
        }
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > maxBytes) {
          setPreparing(false);
          onError?.(`Please upload a file smaller than ${maxSizeMb || 5} MB.`);
          return;
        }
        if (asset.base64) {
          const mime = asset.mimeType || "image/jpeg";
          onChange(`data:${mime};base64,${asset.base64}`);
          setPreparing(false);
          return;
        }
        setPreparing(false);
        onError?.("This image could not be prepared for upload. Please choose it again or try a smaller file.");
      })();
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      setPreparing(true);
      const file = input.files?.[0];
      if (!file) {
        setPreparing(false);
        return;
      }
      if (file.size > maxBytes) {
        setPreparing(false);
        onError?.(`Please upload a file smaller than ${maxSizeMb || 5} MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onChange(reader.result);
        }
        setPreparing(false);
      };
      reader.onerror = () => setPreparing(false);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <Modal visible={preparing} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.42)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <SurfaceCard style={{ width: "100%", maxWidth: 320, alignItems: "center", gap: 12 }}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Preparing image</Text>
            <Text style={{ color: theme.colors.textMuted, textAlign: "center" }}>Please wait while the file is prepared for upload.</Text>
          </SurfaceCard>
        </View>
      </Modal>
      <Text style={[styles.formLabel, { color: theme.colors.text }]}>
        {label}
        {required ? <Text style={{ color: theme.colors.danger }}> *</Text> : null}
      </Text>
      <View style={{ flexDirection: "row", gap: compact ? 10 : 14, alignItems: "center" }}>
        <Avatar image={value} size={compact ? 50 : 64} icon="camera-outline" />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[styles.helper, { color: theme.colors.textMuted, fontSize: compact ? 12 : 13, lineHeight: compact ? 17 : 19 }]}>
            {helper || "Upload a photo from this device. It will be saved to your profile and shown across chats and bookings."}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={openPicker}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 14,
                paddingVertical: compact ? 9 : 12,
                paddingHorizontal: compact ? 10 : 14,
                backgroundColor: theme.colors.primary,
                borderWidth: 1,
                borderColor: theme.colors.primary
              }}
            >
              <Ionicons name="image-outline" size={16} color={theme.colors.textOnPrimary} />
              <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "800", fontSize: compact ? 12 : 14 }}>
                {value ? "Change photo" : "Upload photo"}
              </Text>
            </Pressable>
            {value ? (
              <Pressable
                onPress={() => onChange("")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 14,
                  paddingVertical: compact ? 9 : 12,
                  paddingHorizontal: compact ? 10 : 14,
                  backgroundColor: theme.dark ? "rgba(248,113,113,0.16)" : theme.colors.dangerSoft,
                  borderWidth: 1,
                  borderColor: theme.colors.danger
                }}
              >
                <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                <Text style={{ color: theme.colors.danger, fontWeight: "800", fontSize: compact ? 12 : 14 }}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

export function DriveLinkField({ label, helper }: { label: string; helper?: string }) {
  return (
    <View style={[styles.uploadField, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
      <View style={[styles.driveIconWrap, { backgroundColor: theme.dark ? theme.colors.surfaceAlt : theme.colors.primaryLight }]}>
        <Ionicons name="link-outline" size={20} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.formLabel, { color: theme.colors.text }]}>{label}</Text>
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>{helper || "Paste a shared Google Drive link for MVP review."}</Text>
      </View>
      <SecondaryButton label="Paste link" />
    </View>
  );
}

export function MultiMediaPickerField({
  label,
  values,
  onChange,
  helper,
  required,
  error,
  maxSizeMb,
  onError
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  helper?: string;
  required?: boolean;
  error?: boolean;
  maxSizeMb?: number;
  onError?: (message: string) => void;
}) {
  const maxBytes = (maxSizeMb || 8) * 1024 * 1024;
  const [preparing, setPreparing] = useState(false);
  const openPicker = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      void (async () => {
        setPreparing(true);
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setPreparing(false);
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          allowsMultipleSelection: true,
          quality: 0.8,
          base64: true
        });

        if (result.canceled || !result.assets.length) {
          setPreparing(false);
          return;
        }
        if (result.assets.some((asset) => asset.fileSize && asset.fileSize > maxBytes)) {
          setPreparing(false);
          onError?.(`One or more files are larger than ${maxSizeMb || 8} MB.`);
          return;
        }
        const nextValues = result.assets
          .map((asset) => {
            if (asset.base64) {
              const mime = asset.mimeType || "image/jpeg";
              return `data:${mime};base64,${asset.base64}`;
            }
            return null;
          })
          .filter(Boolean) as string[];
        if (nextValues.length !== result.assets.length) {
          setPreparing(false);
          onError?.("One or more files could not be prepared for upload. Please choose them again or use smaller files.");
          return;
        }
        onChange([...values, ...nextValues]);
        setPreparing(false);
      })();
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.multiple = true;
    input.onchange = () => {
      setPreparing(true);
      const files = Array.from(input.files || []);
      if (!files.length) {
        setPreparing(false);
        return;
      }
      if (files.some((file) => file.size > maxBytes)) {
        setPreparing(false);
        onError?.(`One or more files are larger than ${maxSizeMb || 8} MB.`);
        return;
      }

      Promise.all(
        files.map(
          (file) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
              reader.readAsDataURL(file);
            })
        )
      ).then((nextValues) => {
        onChange([...values, ...nextValues.filter(Boolean)]);
        setPreparing(false);
      });
    };
    input.click();
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: error ? theme.colors.danger : theme.colors.border }]}>
      <Modal visible={preparing} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.42)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <SurfaceCard style={{ width: "100%", maxWidth: 320, alignItems: "center", gap: 12 }}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Preparing files</Text>
            <Text style={{ color: theme.colors.textMuted, textAlign: "center" }}>Please wait while your selected media is prepared.</Text>
          </SurfaceCard>
        </View>
      </Modal>
      <Text style={[styles.formLabel, { color: theme.colors.text }]}>
        {label}
        {required ? <Text style={{ color: theme.colors.danger }}> *</Text> : null}
      </Text>
      <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
        {helper || "Upload one or more photos or videos from this device."}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
        {values.map((uri, index) => (
          <View key={`${uri}-${index}`} style={{ width: 72, gap: 6 }}>
            <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 16, backgroundColor: theme.colors.surfaceAlt }} />
            <Pressable onPress={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>
              <Text style={{ textAlign: "center", color: theme.colors.danger, fontSize: 12, fontWeight: "700" }}>Remove</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Pressable
        onPress={openPicker}
        style={{
          marginTop: 12,
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderRadius: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: theme.colors.primary
        }}
      >
        <Ionicons name="cloud-upload-outline" size={16} color={theme.colors.textOnPrimary} />
        <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>{values.length ? "Add more" : "Upload files"}</Text>
      </Pressable>
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${getStatusColor(status as never)}16`, borderColor: `${getStatusColor(status as never)}28` }]}>
      <Text style={[styles.badgeText, { color: getStatusColor(status as never) }]}>{status}</Text>
    </View>
  );
}

export function ServiceGrid() {
  return <EmptyState title="Live categories enabled" description="Categories are rendered directly from Firebase on the updated marketplace screens." />;
}

export function QuickActions({ provider = false }: { provider?: boolean }) {
  const items = provider
    ? [
        { label: "View Requests", icon: "document-text-outline", tint: "#DCEEFF" },
        { label: "Active Jobs", icon: "construct-outline", tint: "#FFF1D6" },
        { label: "Earnings", icon: "wallet-outline", tint: "#DCFCE7" },
        { label: "Messages", icon: "chatbubble-outline", tint: "#F1E8FF" }
      ]
    : [
        { label: "My Bookings", icon: "calendar-outline", tint: "#DCEEFF" },
        { label: "Messages", icon: "chatbubble-outline", tint: "#FFF1D6" },
        { label: "Payments", icon: "card-outline", tint: "#DCFCE7" }
      ];
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable key={item.label} style={[styles.actionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[styles.actionIconWrap, { backgroundColor: theme.dark ? theme.colors.surfaceAlt : item.tint }]}>
            <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={20} color={theme.colors.primaryDark} />
          </View>
          <Text style={[styles.gridLabel, { color: theme.colors.text }]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ProviderList() {
  return <EmptyState title="Live providers enabled" description="Provider cards are now loaded from Firebase on the refreshed provider screens." />;
}

export function BookingList({ provider = false }: { provider?: boolean }) {
  return (
    <EmptyState
      title={provider ? "Live jobs enabled" : "Live bookings enabled"}
      description="Booking cards are now loaded directly from Firebase on the updated booking screens."
    />
  );
}

export function MessageList() {
  return <EmptyState title="Live messaging enabled" description="Conversation threads now come from Firebase on the updated messaging screens." />;
}

export function PaymentList() {
  return <EmptyState title="Live payments enabled" description="Payment and earnings records now come from Firebase on the updated tabs." />;
}

export function SummaryCards({ provider = false }: { provider?: boolean }) {
  const items = provider
    ? [
        { label: "New Requests", value: "08", tone: "#EBF7FF" },
        { label: "Accepted Jobs", value: "12", tone: "#EFFCF3" },
        { label: "In Progress", value: "04", tone: "#FFF7E7" },
        { label: "Completed Today", value: "06", tone: "#F4F1FF" },
        { label: "Earnings Today", value: "₱2.8k", tone: "#E9FAF2" }
      ]
    : [
        { label: "Upcoming", value: "03", tone: "#EBF7FF" },
        { label: "Ongoing", value: "01", tone: "#FFF7E7" },
        { label: "Completed", value: "12", tone: "#EFFCF3" }
      ];
  return (
    <View style={styles.summaryGrid}>
      {items.map((item) => (
        <View key={item.label} style={[styles.summaryCard, { backgroundColor: item.tone }]}>
          <Text style={styles.summaryValue}>{item.value}</Text>
          <Text style={styles.summaryLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function ApprovalStatusCard({ title, status, note }: { title: string; status: string; note: string }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.sectionRow}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
        <StatusBadge status={status} />
      </View>
      <Text style={[styles.helper, { color: theme.colors.textMuted }]}>{note}</Text>
    </View>
  );
}

export function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={[styles.sectionRow, { alignItems: "flex-start", flexWrap: "wrap" }]}>
        <View style={{ gap: 4, flex: 1, minWidth: 180 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{label}</Text>
          <Text style={[styles.helper, { color: theme.colors.textMuted }]}>Stay visible to customers looking for nearby help.</Text>
        </View>
        <View style={{ marginLeft: "auto", paddingTop: 2 }}>
          <Switch value={value} onValueChange={onValueChange} trackColor={{ true: theme.colors.primary }} />
        </View>
      </View>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = "sparkles-outline"
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.emptyState, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border }]}>
      <Ionicons name={icon} size={30} color={theme.colors.primary} />
      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.helper, { color: theme.colors.textMuted }]}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: 4,
            borderRadius: 16,
            paddingVertical: 11,
            paddingHorizontal: 16,
            backgroundColor: theme.colors.primary,
            alignSelf: "center"
          }}
        >
          <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Avatar({
  image,
  size = 48,
  icon = "person-outline",
  accentColor
}: {
  image?: string;
  size?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
}) {
  if (image) {
    return (
      <Image
        source={{ uri: image }}
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.34), backgroundColor: theme.colors.surfaceAlt }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.34),
        backgroundColor: theme.colors.primarySoft,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.44)} color={accentColor || theme.colors.primaryDark} />
    </View>
  );
}

export function InfoPanel({ title, description, icon }: { title: string; description: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={[styles.infoPanel, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
      <View style={[styles.infoPanelIcon, { backgroundColor: theme.dark ? theme.colors.surfaceAlt : theme.colors.primaryLight }]}>
        <Ionicons name={icon} size={20} color={theme.colors.primaryDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 132 },
  logoCompact: { width: 42, height: 42, borderRadius: 21 },
  logoWide: { width: 240, height: 124, alignSelf: "center" },
  hero: { borderRadius: 24, padding: 16, gap: 8, overflow: "hidden", ...theme.shadow },
  heroGlowPrimary: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.10)", top: -34, right: -24 },
  heroGlowSecondary: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.08)", bottom: -16, left: -20 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  heroIdentityBlock: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  heroLogoShell: { width: 44, height: 44, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroLocationRow: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1, minWidth: 0, paddingRight: 4 },
  heroLocationPin: { width: 18, height: 18, borderRadius: 9, borderBottomRightRadius: 3, backgroundColor: "#EA4335", alignItems: "center", justifyContent: "center", transform: [{ rotate: "45deg" }] },
  heroLocationPinCore: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#fff" },
  heroLocation: { color: "#fff", fontWeight: "700", fontSize: 12, lineHeight: 16, flex: 1, flexShrink: 1, minWidth: 0 },
  heroIconWrap: { width: 40, height: 40, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", flexShrink: 0 },
  heroTitle: { color: "#fff", fontSize: 19, fontWeight: "800", marginTop: 4 },
  heroSubtitle: { color: "rgba(255,255,255,0.88)", fontSize: 11, lineHeight: 16 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  pageTitle: { fontSize: 21, fontWeight: "800", color: theme.colors.text, flexShrink: 1 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionAccent: { width: 5, height: 20, borderRadius: 999, backgroundColor: theme.colors.accent },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.text },
  sectionAction: { fontSize: 13, fontWeight: "700", color: theme.colors.accent },
  searchWrap: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, borderWidth: 1 },
  searchIconShell: { width: 36, height: 36, borderRadius: 14, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 15 },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 18, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, ...theme.shadow },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonLabel: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondaryButton: { borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  secondaryButtonDisabled: { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
  secondaryButtonLabel: { color: theme.colors.text, fontWeight: "700" },
  secondaryButtonLabelDisabled: { color: theme.colors.textLight },
  formGroup: { gap: 8 },
  formLabel: { fontSize: 12, fontWeight: "800", color: theme.colors.text },
  formInput: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, color: theme.colors.text, fontSize: 14 },
  uploadField: { borderRadius: 22, borderWidth: 1, borderColor: theme.colors.border, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  driveIconWrap: { width: 42, height: 42, borderRadius: 16, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  helper: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, minHeight: 32, alignItems: "center", justifyContent: "center" },
  badgeText: { fontWeight: "800", fontSize: 12, textAlign: "center", includeFontPadding: false },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" },
  gridCard: { width: "18.5%", minWidth: 98, flexGrow: 1, backgroundColor: theme.colors.card, borderRadius: 24, padding: 16, alignItems: "center", gap: 8, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow },
  gridIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  gridLabel: { textAlign: "center", fontSize: 13, fontWeight: "700", color: theme.colors.text },
  gridSubLabel: { textAlign: "center", fontSize: 11, color: theme.colors.textMuted },
  actionCard: { width: "30%", minWidth: 104, maxWidth: "48%", flexGrow: 1, backgroundColor: theme.colors.card, borderRadius: 22, padding: 18, alignItems: "center", gap: 10, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow },
  actionIconWrap: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stack: { gap: 12 },
  providerCard: { flexDirection: "row", gap: 14, backgroundColor: theme.colors.card, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow },
  avatar: { width: 60, height: 60, borderRadius: 20 },
  providerHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "space-between" },
  providerName: { fontSize: 16, fontWeight: "800", color: theme.colors.text, flexShrink: 1 },
  providerMeta: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, gap: 10 },
  rating: { color: theme.colors.accent, fontWeight: "800" },
  card: { borderRadius: 24, padding: 16, gap: 10, borderWidth: 1, ...theme.shadow },
  collapsibleHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  feedbackBanner: { borderRadius: 24, padding: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  loadingState: { borderRadius: 20, padding: 16, backgroundColor: theme.colors.surfaceAlt, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  amount: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" },
  summaryCard: { width: "30%", minWidth: 108, maxWidth: "48%", flexGrow: 1, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  summaryValue: { fontSize: 22, fontWeight: "900", color: theme.colors.primaryDark },
  summaryLabel: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6, fontWeight: "700" },
  emptyState: { backgroundColor: theme.colors.primarySoft, borderRadius: 28, padding: 24, alignItems: "center", gap: 8, borderWidth: 1, borderColor: theme.colors.border },
  infoPanel: { flexDirection: "row", gap: 14, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow },
  infoPanelIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  infoStrip: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chatAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  paymentIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: theme.colors.successSoft, alignItems: "center", justifyContent: "center" }
});
