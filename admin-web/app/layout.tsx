import type { Metadata } from "next";
import "./globals.css";
import { AdminAuthProvider } from "../lib/auth-context";
import { AdminThemeProvider } from "../lib/theme-context";

export const metadata: Metadata = {
  title: "Kabisig Admin",
  description: "Kabisig service marketplace admin panel"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AdminThemeProvider>
          <AdminAuthProvider>{children}</AdminAuthProvider>
        </AdminThemeProvider>
      </body>
    </html>
  );
}
