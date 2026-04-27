import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { setPreferredThemeMode, getPreferredThemeMode, type ThemeMode } from "../theme";
import { useAuth } from "./AuthProvider";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [mode, setModeState] = useState<ThemeMode>(() => user?.appTheme || getPreferredThemeMode());

  useEffect(() => {
    const nextMode = user?.appTheme || getPreferredThemeMode();
    setPreferredThemeMode(nextMode);
    setModeState(nextMode);
  }, [user?.appTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode(nextMode) {
        setPreferredThemeMode(nextMode);
        setModeState(nextMode);
      }
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within ThemeProvider");
  }
  return context;
}