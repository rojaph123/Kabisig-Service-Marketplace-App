import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

export type ResponsiveLayout = {
  compact: boolean;
  roomy: boolean;
  tablet: boolean;
  horizontalPadding: number;
  verticalGap: number;
  cardPadding: number;
  cardRadius: number;
  pageTitleSize: number;
  sectionTitleSize: number;
  bodySize: number;
  maxContentWidth: number;
};

export function getResponsiveLayout(width: number, height: number): ResponsiveLayout {
  const shortestSide = Math.min(width, height);
  const compact = shortestSide < 360 || height < 700;
  const tablet = shortestSide >= 600;
  const roomy = shortestSide >= 430 && !tablet;

  return {
    compact,
    roomy,
    tablet,
    horizontalPadding: tablet ? 28 : compact ? 16 : roomy ? 22 : 20,
    verticalGap: tablet ? 18 : compact ? 10 : 14,
    cardPadding: tablet ? 18 : compact ? 13 : 15,
    cardRadius: tablet ? 26 : compact ? 18 : 24,
    pageTitleSize: tablet ? 20 : compact ? 16 : 18,
    sectionTitleSize: tablet ? 17 : compact ? 14 : 15,
    bodySize: compact ? 12 : 13,
    maxContentWidth: tablet ? 760 : 560
  };
}

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => getResponsiveLayout(width, height), [height, width]);
}
