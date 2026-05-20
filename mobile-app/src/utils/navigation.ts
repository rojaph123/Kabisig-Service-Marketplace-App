import { router } from "expo-router";

type RouterWithCanGoBack = typeof router & {
  canGoBack?: () => boolean;
};

export function safeBack(fallback: string = "/(tabs)/home") {
  if (canNavigateBack()) {
    router.back();
    return;
  }

  router.replace(fallback as never);
}

export function canNavigateBack() {
  return (router as RouterWithCanGoBack).canGoBack?.() ?? false;
}
