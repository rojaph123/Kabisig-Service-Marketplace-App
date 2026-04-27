"use client";

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, Topbar } from "../../../components/ui";
import { useAdminAuth } from "../../../lib/auth-context";
import { loadMarketplaceSnapshot } from "../../../lib/marketplace-data";

function downloadClientFile(fileName: string, mimeType: string, body: string) {
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const router = useRouter();
  const { admin, logout } = useAdminAuth();
  const [exporting, setExporting] = useState(false);

  async function exportBackup(format: "json" | "csv") {
    setExporting(true);
    try {
      const snapshot = await loadMarketplaceSnapshot();
      if (format === "json") {
        downloadClientFile(
          `kabisig-backup-${new Date().toISOString().slice(0, 10)}.json`,
          "application/json",
          JSON.stringify(snapshot, null, 2)
        );
        return;
      }

      const rows = snapshot.bookings.map((booking) =>
        [
          booking.bookingId,
          booking.customerId,
          booking.providerId,
          booking.serviceName,
          booking.scheduledAt,
          booking.status,
          booking.amount,
        ]
          .map((value) => JSON.stringify(value ?? ""))
          .join(",")
      );
      downloadClientFile(
        `kabisig-bookings-backup-${new Date().toISOString().slice(0, 10)}.csv`,
        "text/csv;charset=utf-8",
        ["bookingId,customerId,providerId,serviceName,scheduledAt,status,amount", ...rows].join("\n")
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Topbar title="Profile and settings" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Admin profile">
          <div className="space-y-3 text-sm text-kabisig-muted">
            <p><span className="font-bold text-kabisig-text">Name:</span> {admin?.fullName}</p>
            <p><span className="font-bold text-kabisig-text">Email:</span> {admin?.email}</p>
            <p><span className="font-bold text-kabisig-text">Role:</span> Admin</p>
          </div>
        </Card>
        <Card title="Environment readiness">
          <div className="space-y-3 text-sm text-kabisig-muted">
            <p>Free-plan mode uses Firestore realtime plus client-side exports instead of deployed Cloud Functions.</p>
            <p>Notifications stay in-app and realtime. Phone-off push is intentionally not enabled on Spark.</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                className="rounded-2xl border border-kabisig-border px-4 py-3 text-sm font-bold text-kabisig-text disabled:opacity-60"
                onClick={() => void exportBackup("json")}
                disabled={exporting}
              >
                {exporting ? "Preparing..." : "Download JSON backup"}
              </button>
              <button
                className="rounded-2xl border border-kabisig-border px-4 py-3 text-sm font-bold text-kabisig-text disabled:opacity-60"
                onClick={() => void exportBackup("csv")}
                disabled={exporting}
              >
                {exporting ? "Preparing..." : "Download CSV backup"}
              </button>
            </div>
            <button
              className="rounded-2xl bg-kabisig-blue px-4 py-3 text-sm font-bold text-white"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              Logout
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
