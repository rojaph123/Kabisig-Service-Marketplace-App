import { Appearance, Platform } from "react-native";
import { kabisigRadius, kabisigShadow, kabisigThemeModes } from "@kabisig/shared";

export type ThemeMode = "light" | "dark" | "system";

let preferredMode: ThemeMode = "system";

function resolveThemeMode(): "light" | "dark" {
  if (preferredMode === "light" || preferredMode === "dark") {
    return preferredMode;
  }
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export function setPreferredThemeMode(mode: ThemeMode) {
  preferredMode = mode;
}

export function getPreferredThemeMode(): ThemeMode {
  return preferredMode;
}

export const theme = {
  get dark() {
    return resolveThemeMode() === "dark";
  },
  get colors() {
    return this.dark ? kabisigThemeModes.dark : kabisigThemeModes.light;
  },
  radius: kabisigRadius,
  get shadow() {
    return Platform.OS === "web"
      ? {
          boxShadow: this.dark
            ? "0px 14px 32px rgba(2, 8, 23, 0.42)"
            : "0px 10px 28px rgba(15, 23, 42, 0.10)"
        }
      : kabisigShadow.md;
  },
  shadows: kabisigShadow,
  typography: {
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif",
      web: "Arial, sans-serif",
      default: "System"
    }),
    size: {
      caption: 11,
      meta: 12,
      body: 14,
      bodyLarge: 15,
      cardTitle: 16,
      sectionTitle: 18,
      pageTitle: 22,
      heroTitle: 28
    },
    lineHeight: {
      caption: 15,
      meta: 17,
      body: 20,
      bodyLarge: 22,
      cardTitle: 22,
      sectionTitle: 24,
      pageTitle: 28,
      heroTitle: 34
    }
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32
  }
};
