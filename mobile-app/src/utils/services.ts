import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

type ServiceVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
};

const serviceVisuals: { match: RegExp; visual: ServiceVisual }[] = [
  { match: /car mechanic|auto mechanic|car repair|auto repair/i, visual: { icon: "car-sport-outline", tint: "#DC2626", bg: "#FEE2E2" } },
  { match: /motor mechanic|motorcycle|motorbike|bike repair/i, visual: { icon: "bicycle-outline", tint: "#0F766E", bg: "#DCFCE7" } },
  { match: /electric|electrical|wiring/i, visual: { icon: "flash-outline", tint: "#2563EB", bg: "#EAF2FF" } },
  { match: /plumb|pipe|water/i, visual: { icon: "water-outline", tint: "#0891B2", bg: "#E8FAFE" } },
  { match: /weld|metal|fabricat/i, visual: { icon: "flame-outline", tint: "#EA580C", bg: "#FFF1E8" } },
  { match: /construct|mason|build/i, visual: { icon: "hammer-outline", tint: "#CA8A04", bg: "#FFF8DB" } },
  { match: /roof/i, visual: { icon: "home-outline", tint: "#16A34A", bg: "#E9F9EE" } },
  { match: /paint/i, visual: { icon: "color-palette-outline", tint: "#7C3AED", bg: "#F4E8FF" } },
  { match: /clean/i, visual: { icon: "sparkles-outline", tint: "#0F766E", bg: "#E6FFFB" } },
  { match: /beauty|salon/i, visual: { icon: "cut-outline", tint: "#DB2777", bg: "#FCE7F3" } },
  { match: /repair|maintenance/i, visual: { icon: "build-outline", tint: "#F97316", bg: "#FFF1E8" } },
];

export function getServiceVisual(name: string, rawIcon?: string): ServiceVisual {
  const source = `${name} ${rawIcon || ""}`.trim();
  const matched = serviceVisuals.find((entry) => entry.match.test(source));
  if (matched) {
    return matched.visual;
  }

  return {
    icon: "construct-outline",
    tint: theme.colors.primary,
    bg: theme.colors.primarySoft,
  };
}
