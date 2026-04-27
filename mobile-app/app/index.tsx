import { Redirect } from "expo-router";
import { useAuth } from "../src/hooks/AuthProvider";

export default function Index() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (user.role === "provider" && !user.onboardingCompleted) {
    return <Redirect href="/provider/onboarding" />;
  }

  if (user.role === "provider" && user.approvalStatus !== "Approved") {
    return <Redirect href="/provider/pending" />;
  }

  return <Redirect href="/(tabs)/home" />;
}

