"use client";

import { marketplaceConfigService } from "@kabisig/shared";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Sidebar } from "../../components/ui";
import { useAdminAuth } from "../../lib/auth-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { admin, loading } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!admin && pathname !== "/login") {
      router.replace("/login");
    }
  }, [admin, loading, pathname, router]);

  useEffect(() => {
    if (!admin) return;
    void marketplaceConfigService.ensureDefaultMarketplaceData();
  }, [admin]);

  if (loading || !admin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-kabisig-bg p-4 lg:p-6">
      <div className="mx-auto flex max-w-[1600px] items-start gap-6">
        <Sidebar />
        <div className="min-w-0 flex-1 space-y-6">{children}</div>
      </div>
    </main>
  );
}
