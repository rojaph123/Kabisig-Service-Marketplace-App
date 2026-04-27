"use client";

import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

type AdminTheme = "light" | "dark";

type AdminThemeContextValue = {
  theme: AdminTheme;
  toggleTheme: () => void;
};

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

function applyTheme(nextTheme: AdminTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", nextTheme === "dark");
  document.documentElement.dataset.theme = nextTheme;
}

export function AdminThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<AdminTheme>("light");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("kabisig-admin-theme") : null;
    const nextTheme =
      saved === "dark" || saved === "light"
        ? (saved as AdminTheme)
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const value = useMemo<AdminThemeContextValue>(
    () => ({
      theme,
      toggleTheme() {
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        applyTheme(nextTheme);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("kabisig-admin-theme", nextTheme);
        }
      }
    }),
    [theme]
  );

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error("useAdminTheme must be used within AdminThemeProvider");
  }
  return context;
}

