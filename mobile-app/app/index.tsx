import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { AppStartupSplash } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { hasSeenWelcomeScreen } from "../src/utils/firstLaunch";

export default function Index() {
  const { user, loading } = useAuth();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    void hasSeenWelcomeScreen().then((seen) => {
      if (mounted) setWelcomeSeen(seen);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading || welcomeSeen === null) {
    return <AppStartupSplash />;
  }

  if (!user) {
    return <Redirect href={welcomeSeen ? "/(auth)/role-selection" : "/(auth)/welcome"} />;
  }

  if (user.role === "provider" && !user.onboardingCompleted) {
    return <Redirect href="/provider/onboarding" />;
  }

  if (user.role === "provider" && user.approvalStatus !== "Approved") {
    return <Redirect href="/provider/pending" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
