export const kabisigThemeModes = {
  light: {
    primary: "#1E3A8A",
    primaryDark: "#172554",
    primarySoft: "#DBEAFE",
    primaryLight: "#EFF6FF",

    accent: "#38BDF8",
    accentDark: "#0284C7",
    accentSoft: "#E0F2FE",
    accentLight: "#F0F9FF",

    // Supporting Colors
    success: "#10B981",
    successSoft: "#D1FAE5",
    warning: "#F59E0B",
    warningSoft: "#FEF3C7",
    danger: "#EF4444",
    dangerSoft: "#FEE2E2",
    info: "#0369A1",
    infoSoft: "#E0F2FE",

    // Neutrals (Professional Gray Scale)
    background: "#F4F8FC",
    surface: "#FFFFFF",
    surfaceAlt: "#EDF4FF",
    card: "#FFFFFF",

    text: "#0F172A",
    textMuted: "#475569",
    textLight: "#94A3B8",
    textOnPrimary: "#FFFFFF",
    textOnAccent: "#FFFFFF",

    border: "#D8E4F2",
    borderLight: "#E7EEF8",
    borderDark: "#94A3B8"
  },
  dark: {
    primary: "#60A5FA",
    primaryDark: "#1D4ED8",
    primarySoft: "#1E3A8A",
    primaryLight: "#1E40AF",

    accent: "#38BDF8",
    accentDark: "#0EA5E9",
    accentSoft: "#0C4A6E",
    accentLight: "#082F49",

    success: "#34D399",
    successSoft: "#065F46",
    warning: "#FBBF24",
    warningSoft: "#78350F",
    danger: "#F87171",
    dangerSoft: "#7F1D1D",
    info: "#06B6D4",
    infoSoft: "#164E63",

    background: "#0B1321",
    surface: "#132033",
    surfaceAlt: "#1A2A40",
    card: "#132033",

    text: "#F1F5F9",
    textMuted: "#D9E2EC",
    textLight: "#AFC0D3",
    textOnPrimary: "#FFFFFF",
    textOnAccent: "#FFFFFF",

    border: "#24364F",
    borderLight: "#35506F",
    borderDark: "#162740"
  }
} as const;

export const kabisigColors = kabisigThemeModes.light;

export const kabisigRadius = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999
};

export const kabisigSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32
};

export const kabisigShadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12
  }
};

export default kabisigThemeModes;
