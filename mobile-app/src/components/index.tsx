import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { theme } from "../theme";
import { getStatusColor } from "../utils/status";

const logo = require("../../assets/branding/icon.jpg");
const logoWithTagline = require("../../assets/branding/logo-with-tagline.jpg");
const loadingLogo = require("../../assets/branding/Loading Logo.png");

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

  useFocusEffect(
    useCallback(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo?.({ y: 0, animated: false });
      });
    }, [])
  );

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[styles.screen, { backgroundColor: theme.colors.background }, style]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 12 : Math.max(insets.bottom, 8)}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 132 + Math.max(insets.bottom, 12) }, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
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
  contentContainerStyle
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo?.({ y: 0, animated: false });
      });
    }, [])
  );

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[styles.screen, { backgroundColor: theme.colors.background }, style]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 12 : Math.max(insets.bottom, 8)}>
        {header ? <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm }}>{header}</View> : null}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl * 2 + Math.max(insets.bottom, 12), gap: theme.spacing.lg },
            contentContainerStyle
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: theme.colors.background,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              gap: 10
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function LaunchScreen() {
  const useNativeDriver = Platform.OS !== "web";
  const logoOpacity = useRef(new Animated.Value(0.55)).current;
  const logoScale = useRef(new Animated.Value(0.96)).current;
  const wordOne = useRef(new Animated.Value(0.15)).current;
  const wordTwo = useRef(new Animated.Value(0.15)).current;
  const wordThree = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoOpacity, { toValue: 1, duration: 1500, useNativeDriver }),
          Animated.timing(logoScale, { toValue: 1.03, duration: 1500, useNativeDriver })
        ]),
        Animated.parallel([
          Animated.timing(logoOpacity, { toValue: 0.52, duration: 1500, useNativeDriver }),
          Animated.timing(logoScale, { toValue: 0.96, duration: 1500, useNativeDriver })
        ])
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(wordOne, { toValue: 1, duration: 520, useNativeDriver }),
          Animated.timing(wordTwo, { toValue: 0.18, duration: 240, useNativeDriver }),
          Animated.timing(wordThree, { toValue: 0.18, duration: 240, useNativeDriver })
        ]),
        Animated.parallel([
          Animated.timing(wordTwo, { toValue: 1, duration: 520, useNativeDriver }),
          Animated.timing(wordOne, { toValue: 0.35, duration: 320, useNativeDriver })
        ]),
        Animated.parallel([
          Animated.timing(wordThree, { toValue: 1, duration: 520, useNativeDriver }),
          Animated.timing(wordTwo, { toValue: 0.35, duration: 320, useNativeDriver })
        ]),
        Animated.parallel([
          Animated.timing(wordOne, { toValue: 0.15, duration: 640, useNativeDriver }),
          Animated.timing(wordTwo, { toValue: 0.15, duration: 640, useNativeDriver }),
          Animated.timing(wordThree, { toValue: 0.15, duration: 640, useNativeDriver })
        ])
      ])
    ).start();
  }, [logoOpacity, logoScale, useNativeDriver, wordOne, wordTwo, wordThree]);

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
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
            width: 188,
            height: 188,
            borderRadius: 42,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.14)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)"
          }}
        >
          <Image source={loadingLogo} style={{ width: 150, height: 150 }} resizeMode="contain" />
        </Animated.View>
        <View style={{ alignItems: "center", gap: 8 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 27, fontWeight: "900" }}>Loading...</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Animated.Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 18, opacity: wordOne }}>Tiwala</Animated.Text>
          <Animated.Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 18, opacity: wordTwo }}>Galing</Animated.Text>
          <Animated.Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 18, opacity: wordThree }}>Kabisig</Animated.Text>
        </View>
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
          {location ? <Text style={styles.heroLocationLabel}>Your Location</Text> : null}
          {location ? <Text style={styles.heroLocation}>{location}</Text> : null}
        </View>
        <Pressable onPress={onNotificationsPress} style={styles.heroIconWrap}>
          <Ionicons name="notifications-outline" size={20} color="#fff" />
          {notificationCount ? (
            <View
              style={{
                position: "absolute",
                top: 7,
                right: 7,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                paddingHorizontal: 4,
                backgroundColor: theme.colors.accent,
                alignItems: "center",
                justifyContent: "center"
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
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.pageTitle, { color: theme.colors.text }]}>{title}</Text>
      {action}
    </View>
  );
}

export function BackHeader({
  title,
  onBack,
  action
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <View style={[styles.sectionRow, { alignItems: "center" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
        <Pressable onPress={onBack} style={[styles.backButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Ionicons name="arrow-back-outline" size={18} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.pageTitle, { color: theme.colors.text }]}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function SearchBar({ placeholder, value, onChangeText }: { placeholder: string; value?: string; onChangeText?: (value: string) => void }) {
  return (
    <View
      style={[
        styles.searchWrap,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border
        }
      ]}
    >
      <View style={[styles.searchIconShell, { backgroundColor: theme.dark ? theme.colors.surfaceAlt : "#EDF6FF" }]}>
        <Ionicons name="search-outline" size={18} color={theme.colors.primary} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.searchInput, { color: theme.colors.text }]}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

export function SectionHeader({ title, actionLabel }: { title: string; actionLabel?: string }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionTitleWrap}>
        <View style={styles.sectionAccent} />
        <Text style={styles.sectionTitle}>{title}</Text>
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
        { backgroundColor: theme.dark ? theme.colors.surfaceAlt : theme.colors.card, borderColor: theme.colors.border },
        disabled && styles.secondaryButtonDisabled
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.secondaryButtonLabel, disabled && styles.secondaryButtonLabelDisabled]}>{label}</Text>
    </Pressable>
  );
}

export function SurfaceCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, style]}>{children}</View>;
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
              <WebView source={{ uri: mapUrl }} style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }} />
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

export function LoadingState({ label = "Loading..." }: { label?: string }) {
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

export function FormInput(props: TextInputProps & { label: string; required?: boolean; error?: boolean }) {
  return (
    <View style={styles.formGroup}>
      <Text style={[styles.formLabel, { color: theme.colors.text }]}>
        {props.label}
        {props.required ? <Text style={{ color: theme.colors.danger }}> *</Text> : null}
      </Text>
      <TextInput
        {...props}
        placeholderTextColor={theme.colors.textMuted}
        autoCorrect={props.autoCorrect ?? false}
        style={[
          styles.formInput,
          {
            backgroundColor: theme.colors.card,
            borderColor: props.error ? theme.colors.danger : theme.colors.border,
            color: theme.colors.text
          },
          props.style
        ]}
      />
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
  onError
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  helper?: string;
  required?: boolean;
  error?: boolean;
  maxSizeMb?: number;
  onError?: (message: string) => void;
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
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <Avatar image={value} size={64} icon="camera-outline" />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
            {helper || "Upload a photo from this device. It will be saved to your profile and shown across chats and bookings."}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={openPicker}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: theme.dark ? theme.colors.primarySoft : theme.colors.primaryLight,
                borderWidth: 1,
                borderColor: theme.dark ? theme.colors.primary : theme.colors.border
              }}
            >
              <Ionicons name="image-outline" size={16} color={theme.dark ? theme.colors.textOnPrimary : theme.colors.primaryDark} />
              <Text style={{ color: theme.dark ? theme.colors.textOnPrimary : theme.colors.primaryDark, fontWeight: "800" }}>
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
                  borderRadius: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: theme.dark ? "rgba(248,113,113,0.16)" : theme.colors.dangerSoft,
                  borderWidth: 1,
                  borderColor: theme.colors.danger
                }}
              >
                <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                <Text style={{ color: theme.colors.danger, fontWeight: "800" }}>Remove</Text>
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
      <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
        <SecondaryButton label={values.length ? "Add more" : "Upload files"} onPress={openPicker} />
      </View>
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
        { label: "Earnings Today", value: "PHP 2.8k", tone: "#E9FAF2" }
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

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={[styles.emptyState, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border }]}>
      <Ionicons name="sparkles-outline" size={30} color={theme.colors.primary} />
      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.helper, { color: theme.colors.textMuted }]}>{description}</Text>
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

function InfoPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={[styles.infoPill, { backgroundColor: theme.dark ? theme.colors.surfaceAlt : theme.colors.primaryLight }]}>
      <Ionicons name={icon} size={13} color={theme.colors.primaryDark} />
      <Text style={[styles.infoPillText, { color: theme.colors.primaryDark }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 132 },
  logoCompact: { width: 42, height: 42, borderRadius: 21 },
  logoWide: { width: 240, height: 124, alignSelf: "center" },
  hero: { borderRadius: 32, padding: 22, gap: 10, overflow: "hidden", ...theme.shadow },
  heroGlowPrimary: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.10)", top: -34, right: -24 },
  heroGlowSecondary: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.08)", bottom: -16, left: -20 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroIdentityBlock: { gap: 4 },
  heroLogoShell: { width: 54, height: 54, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  heroLocationLabel: { color: "rgba(255,255,255,0.76)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  heroLocation: { color: "#fff", fontWeight: "700", fontSize: 18, marginTop: 1, maxWidth: 240 },
  heroIconWrap: { width: 42, height: 42, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 10 },
  heroSubtitle: { color: "rgba(255,255,255,0.88)", fontSize: 14, lineHeight: 20 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  pageTitle: { fontSize: 26, fontWeight: "800", color: theme.colors.text, flexShrink: 1 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#DEE7F2" },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionAccent: { width: 5, height: 20, borderRadius: 999, backgroundColor: theme.colors.accent },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
  sectionAction: { fontSize: 13, fontWeight: "700", color: theme.colors.accent },
  searchWrap: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, borderWidth: 1 },
  searchIconShell: { width: 36, height: 36, borderRadius: 14, backgroundColor: "#EDF6FF", alignItems: "center", justifyContent: "center" },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 15 },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 18, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, ...theme.shadow },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonLabel: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondaryButton: { borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  secondaryButtonDisabled: { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
  secondaryButtonLabel: { color: theme.colors.text, fontWeight: "700" },
  secondaryButtonLabelDisabled: { color: theme.colors.textLight },
  formGroup: { gap: 8 },
  formLabel: { fontSize: 13, fontWeight: "800", color: theme.colors.text },
  formInput: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, color: theme.colors.text, fontSize: 14 },
  uploadField: { borderRadius: 22, borderWidth: 1, borderColor: "#DCE5F0", padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  driveIconWrap: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#EAF4FF", alignItems: "center", justifyContent: "center" },
  helper: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, minHeight: 32, alignItems: "center", justifyContent: "center" },
  badgeText: { fontWeight: "800", fontSize: 12, textAlign: "center", includeFontPadding: false },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" },
  gridCard: { width: "18.5%", minWidth: 98, flexGrow: 1, backgroundColor: "#fff", borderRadius: 24, padding: 16, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#DEE7F2", ...theme.shadow },
  gridIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  gridLabel: { textAlign: "center", fontSize: 13, fontWeight: "700", color: theme.colors.text },
  gridSubLabel: { textAlign: "center", fontSize: 11, color: theme.colors.textMuted },
  actionCard: { width: "30%", minWidth: 104, maxWidth: "48%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 22, padding: 18, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#DEE7F2", ...theme.shadow },
  actionIconWrap: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stack: { gap: 12 },
  providerCard: { flexDirection: "row", gap: 14, backgroundColor: "#fff", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "#DEE7F2", ...theme.shadow },
  avatar: { width: 60, height: 60, borderRadius: 20 },
  providerHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "space-between" },
  providerName: { fontSize: 16, fontWeight: "800", color: theme.colors.text, flexShrink: 1 },
  providerMeta: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, gap: 10 },
  rating: { color: theme.colors.accent, fontWeight: "800" },
  card: { borderRadius: 24, padding: 16, gap: 10, borderWidth: 1, ...theme.shadow },
  collapsibleHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  feedbackBanner: { borderRadius: 24, padding: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  loadingState: { borderRadius: 20, padding: 16, backgroundColor: theme.colors.surfaceAlt, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  amount: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" },
  summaryCard: { width: "30%", minWidth: 108, maxWidth: "48%", flexGrow: 1, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  summaryValue: { fontSize: 22, fontWeight: "900", color: theme.colors.primaryDark },
  summaryLabel: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6, fontWeight: "700" },
  emptyState: { backgroundColor: theme.colors.primarySoft, borderRadius: 28, padding: 24, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#D8E9FA" },
  infoPanel: { flexDirection: "row", gap: 14, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: "#DEE7F2", ...theme.shadow },
  infoPanelIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  infoStrip: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  infoPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: "#EFF6FF" },
  infoPillText: { fontSize: 12, color: theme.colors.primaryDark, fontWeight: "700" },
  chatAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#EAF4FF", alignItems: "center", justifyContent: "center" },
  paymentIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#EAF8EF", alignItems: "center", justifyContent: "center" }
});
