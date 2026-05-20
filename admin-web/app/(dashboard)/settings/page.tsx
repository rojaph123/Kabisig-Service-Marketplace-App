"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KABISIG_TERMS_VERSION, kabisigTermsSections, notificationService } from "@kabisig/shared";
import { Card, Topbar } from "../../../components/ui";
import {
  bookingRows,
  complaintRows,
  downloadClientFile,
  downloadCsvReport,
  logAdminAction,
  paymentRows,
  providerRows,
} from "../../../lib/admin-actions";
import { useAdminAuth } from "../../../lib/auth-context";
import { loadMarketplaceSnapshot } from "../../../lib/marketplace-data";

export default function SettingsPage() {
  const router = useRouter();
  const { admin, logout } = useAdminAuth();
  const [exporting, setExporting] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    audience: "all",
    title: "",
    body: "",
  });

  async function exportBackup(format: "json" | "csv", report: "all" | "bookings" | "payments" | "providers" | "complaints" = "all") {
    setExporting(true);
    try {
      const snapshot = await loadMarketplaceSnapshot();
      const date = new Date().toISOString().slice(0, 10);
      if (format === "json") {
        downloadClientFile(
          `kabisig-backup-${date}.json`,
          "application/json",
          JSON.stringify(snapshot, null, 2)
        );
        await logAdminAction(admin, "export_generated", "marketplace", "full-json-backup", "Exported full JSON backup.", {
          bookings: snapshot.bookings.length,
          payments: snapshot.payments.length,
          providers: snapshot.providerProfiles.length,
          complaints: snapshot.complaints.length,
        });
        return;
      }

      const reports = {
        bookings: bookingRows(snapshot.bookings),
        payments: paymentRows(snapshot.payments),
        providers: providerRows(snapshot.providerProfiles),
        complaints: complaintRows(snapshot.complaints),
      };
      if (report === "all") {
        downloadCsvReport(`kabisig-bookings-${date}.csv`, reports.bookings);
        downloadCsvReport(`kabisig-payments-${date}.csv`, reports.payments);
        downloadCsvReport(`kabisig-providers-${date}.csv`, reports.providers);
        downloadCsvReport(`kabisig-complaints-${date}.csv`, reports.complaints);
      } else {
        downloadCsvReport(`kabisig-${report}-${date}.csv`, reports[report]);
      }
      await logAdminAction(admin, "export_generated", "marketplace", `${report}-csv-report`, `Exported ${report} CSV report.`, {
        report,
        rows:
          report === "all"
            ? reports.bookings.length + reports.payments.length + reports.providers.length + reports.complaints.length
            : reports[report].length,
      });
    } finally {
      setExporting(false);
    }
  }

  async function sendBroadcast() {
    if (!broadcastForm.title.trim() || !broadcastForm.body.trim()) return;
    setBroadcasting(true);
    try {
      const snapshot = await loadMarketplaceSnapshot();
      const recipients = snapshot.users.filter((user) =>
        broadcastForm.audience === "all" ? user.role !== "admin" : user.role === broadcastForm.audience
      );
      await Promise.all(
        recipients.map((user) =>
          notificationService.createNotification({
            userId: user.id,
            type: "admin_announcement",
            title: broadcastForm.title.trim(),
            body: broadcastForm.body.trim(),
            isRead: false,
            route: "/notifications",
            createdAt: new Date().toISOString(),
          })
        )
      );
      await logAdminAction(admin, "announcement_broadcast", "notifications", "admin-announcement", `Broadcast announcement to ${broadcastForm.audience}.`, {
        audience: broadcastForm.audience,
        recipients: recipients.length,
      });
      setBroadcastForm({ audience: "all", title: "", body: "" });
    } finally {
      setBroadcasting(false);
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
            <p><span className="font-bold text-kabisig-text">Terms version:</span> {KABISIG_TERMS_VERSION}</p>
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
                onClick={() => void exportBackup("csv", "all")}
                disabled={exporting}
              >
                {exporting ? "Preparing..." : "Download all CSV reports"}
              </button>
              {(["bookings", "payments", "providers", "complaints"] as const).map((report) => (
                <button
                  key={report}
                  className="rounded-2xl border border-kabisig-border px-4 py-3 text-sm font-bold capitalize text-kabisig-text disabled:opacity-60"
                  onClick={() => void exportBackup("csv", report)}
                  disabled={exporting}
                >
                  Export {report}
                </button>
              ))}
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
        <Card title="Admin announcement broadcast">
          <div className="space-y-4">
            <select
              value={broadcastForm.audience}
              onChange={(event) => setBroadcastForm((current) => ({ ...current, audience: event.target.value }))}
              className="w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm font-bold text-kabisig-text outline-none dark:bg-slate-950/70"
            >
              <option value="all">All customers and providers</option>
              <option value="customer">Customers only</option>
              <option value="provider">Providers only</option>
            </select>
            <input
              value={broadcastForm.title}
              onChange={(event) => setBroadcastForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Announcement title"
              className="w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70"
            />
            <textarea
              value={broadcastForm.body}
              onChange={(event) => setBroadcastForm((current) => ({ ...current, body: event.target.value }))}
              placeholder="Write a clear announcement for users."
              className="min-h-32 w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70"
            />
            <button
              className="rounded-2xl bg-kabisig-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              disabled={broadcasting || !broadcastForm.title.trim() || !broadcastForm.body.trim()}
              onClick={() => void sendBroadcast()}
            >
              {broadcasting ? "Sending..." : "Send announcement"}
            </button>
            <p className="text-sm text-kabisig-muted">
              Announcements are delivered as in-app notifications to the selected audience.
            </p>
          </div>
        </Card>
      </div>
      <div className="mt-6">
        <Card title="Terms and Agreement">
          <div className="max-h-[560px] space-y-5 overflow-y-auto pr-3 text-sm leading-6 text-kabisig-muted">
            <p className="font-bold text-kabisig-text">Kabisig Terms and Agreement, version {KABISIG_TERMS_VERSION}</p>
            {kabisigTermsSections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h3 className="text-base font-black text-kabisig-text">{section.title}</h3>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
