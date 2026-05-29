"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KABISIG_PRIVACY_NOTICE_VERSION, KABISIG_TERMS_VERSION, kabisigPrivacyNoticeSections, kabisigTermsSections, notificationService, workerPaymentService, type WorkerPaymentSettings } from "@kabisig/shared";
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

function FieldHelp({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-[11px] font-black text-kabisig-blue"
      aria-label={text}
    >
      ?
    </span>
  );
}

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
  const [paymentSettings, setPaymentSettings] = useState<WorkerPaymentSettings | null>(null);
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);
  const [backfillingFinance, setBackfillingFinance] = useState(false);
  const [financeBackfillMessage, setFinanceBackfillMessage] = useState("");
  const [paymentSettingsError, setPaymentSettingsError] = useState("");

  useEffect(() => {
    void workerPaymentService.getSettings()
      .then((settings) => {
        setPaymentSettings(settings);
        setPaymentSettingsError("");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Worker payment settings could not be loaded.";
        setPaymentSettingsError(message.includes("permission") ? "Your admin account can view defaults, but the deployed Firestore rules do not allow loading saved worker payment settings yet." : message);
      });
  }, []);

  async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function updateQrCode(file?: File) {
    if (!file || !admin) return;
    setSavingPaymentSettings(true);
    setPaymentSettingsError("");
    try {
      const uploaded = await workerPaymentService.uploadQrCode(await fileToDataUrl(file), admin.id);
      const next = { ...(paymentSettings ?? await workerPaymentService.getSettings()), activeQrCodeUrl: uploaded.url, activeQrCodePath: uploaded.storagePath || null };
      setPaymentSettings(next);
      await workerPaymentService.updateSettings(next, admin.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "QR code could not be uploaded.";
      setPaymentSettingsError(
        message.includes("Admin privileges")
          ? "Your signed-in Firebase user is not marked as an admin in Firestore users."
          : message.includes("own account")
            ? "Your admin session looks stale. Please log out, log back in, then upload the QR again."
            : message.includes("permission")
              ? "Firebase denied the QR upload. If you are admin, deploy the updated functions/storage rules or refresh your admin session."
              : message
      );
    } finally {
      setSavingPaymentSettings(false);
    }
  }

  async function saveWorkerPaymentSettings() {
    if (!paymentSettings || !admin) return;
    setSavingPaymentSettings(true);
    setPaymentSettingsError("");
    try {
      await workerPaymentService.updateSettings(paymentSettings, admin.id);
      await logAdminAction(admin, "worker_payment_settings_updated", "platformSettings", "workerPayments", "Updated worker payment settings.", {
        registrationFeeAmount: paymentSettings.registrationFeeAmount,
        commissionPercentage: paymentSettings.commissionPercentage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Worker payment settings could not be saved.";
      setPaymentSettingsError(message.includes("permission") ? "Only an admin account can edit worker payment settings." : message);
    } finally {
      setSavingPaymentSettings(false);
    }
  }

  async function backfillWorkerFinance() {
    if (!admin) return;
    setBackfillingFinance(true);
    setFinanceBackfillMessage("");
    try {
      const result = await workerPaymentService.backfillExistingWorkerFinance(admin.id);
      setFinanceBackfillMessage(`${result.created} existing worker finance record(s) created.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Existing worker finance records could not be prepared.";
      setPaymentSettingsError(message.includes("permission") ? "Only an admin account can prepare existing worker finance records." : message);
    } finally {
      setBackfillingFinance(false);
    }
  }

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
        <Card title="Worker payment settings">
          {paymentSettingsError ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {paymentSettingsError}
            </div>
          ) : null}
          {paymentSettings ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2 text-sm font-bold text-kabisig-text">
                  <span className="flex items-center gap-2">
                    Registration fee amount
                    <FieldHelp text="Amount workers must pay during registration before their application can be approved. Set to 500 by default." />
                  </span>
                  <input type="number" value={paymentSettings.registrationFeeAmount} onChange={(event) => setPaymentSettings((current) => current ? { ...current, registrationFeeAmount: Number(event.target.value || 0) } : current)} className="w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
                </label>
                <label className="space-y-2 text-sm font-bold text-kabisig-text">
                  <span className="flex items-center gap-2">
                    Payment method name
                    <FieldHelp text="Label shown to workers for the active payment option, such as GCash QR, Maya QR, or Bank QR." />
                  </span>
                  <input value={paymentSettings.paymentMethodName} onChange={(event) => setPaymentSettings((current) => current ? { ...current, paymentMethodName: event.target.value } : current)} className="w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
                </label>
                <label className="space-y-2 text-sm font-bold text-kabisig-text">
                  <span className="flex items-center gap-2">
                    Commission percentage
                    <FieldHelp text="Percentage of a worker's completed and paid bookings collected by admin after the worker uses their free booking allowance." />
                  </span>
                  <input type="number" value={paymentSettings.commissionPercentage} onChange={(event) => setPaymentSettings((current) => current ? { ...current, commissionPercentage: Number(event.target.value || 0) } : current)} className="w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
                </label>
                <label className="space-y-2 text-sm font-bold text-kabisig-text">
                  <span className="flex items-center gap-2">
                    Free bookings granted
                    <FieldHelp text="One-time number of completed paid bookings each worker can finish before commission starts. Existing approved workers also receive this allowance after migration." />
                  </span>
                  <input type="number" min={0} value={paymentSettings.freeBookingsGranted} onChange={(event) => setPaymentSettings((current) => current ? { ...current, freeBookingsGranted: Number(event.target.value || 0) } : current)} className="w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
                </label>
                <label className="space-y-2 text-sm font-bold text-kabisig-text">
                  <span className="flex items-center gap-2">
                    Promo approved worker limit
                    <FieldHelp text="Maximum number of approved workers who can receive free registration when the First workers promo is enabled." />
                  </span>
                  <input type="number" value={paymentSettings.freeRegistrationApprovedWorkerLimit} onChange={(event) => setPaymentSettings((current) => current ? { ...current, freeRegistrationApprovedWorkerLimit: Number(event.target.value || 0) } : current)} className="w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
                </label>
                <label className="space-y-2 text-sm font-bold text-kabisig-text">
                  <span className="flex items-center gap-2">
                    Monthly due day
                    <FieldHelp text="Day of the next month when monthly commission bills are due. Example: 5 means January's bill is due February 5." />
                  </span>
                  <input type="number" min={1} max={28} value={paymentSettings.monthlyBillDueDay} onChange={(event) => setPaymentSettings((current) => current ? { ...current, monthlyBillDueDay: Number(event.target.value || 5) } : current)} className="w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
                </label>
                <label className="space-y-2 text-sm font-bold text-kabisig-text">
                  <span className="flex items-center gap-2">
                    Grace period days
                    <FieldHelp text="Extra days after the due date before an unpaid worker becomes restricted from accepting new bookings or claiming requests." />
                  </span>
                  <input type="number" min={0} value={paymentSettings.gracePeriodDays} onChange={(event) => setPaymentSettings((current) => current ? { ...current, gracePeriodDays: Number(event.target.value || 0) } : current)} className="w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
                </label>
                <label className="space-y-2 text-sm font-bold text-kabisig-text">
                  <span className="flex items-center gap-2">
                    Daily overdue surcharge
                    <FieldHelp text="Flat peso amount added for every day after the grace period. Example: 5 means PHP 5 is added per overdue day starting on the 9th when due is the 5th and grace ends on the 8th." />
                  </span>
                  <input type="number" min={0} value={paymentSettings.lateSurchargeRate} onChange={(event) => setPaymentSettings((current) => current ? { ...current, lateSurchargeRate: Number(event.target.value || 0) } : current)} className="w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
                </label>
              </div>
              <label className="space-y-2 text-sm font-bold text-kabisig-text">
                <span className="flex items-center gap-2">
                  Payment instructions
                  <FieldHelp text="Instructions shown to workers beside the QR code, including exact amount, payment app, and what proof/reference to submit." />
                </span>
                <textarea value={paymentSettings.paymentInstructions} onChange={(event) => setPaymentSettings((current) => current ? { ...current, paymentInstructions: event.target.value } : current)} className="min-h-28 w-full rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
              </label>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 rounded-2xl border border-kabisig-border px-4 py-3 text-sm font-bold text-kabisig-text">
                  <input type="checkbox" checked={!paymentSettings.registrationFeeEnabled} onChange={(event) => setPaymentSettings((current) => current ? { ...current, registrationFeeEnabled: !event.target.checked } : current)} />
                  Free registration
                  <FieldHelp text="When enabled, new worker applications skip payment upload and show Registration Fee: Free." />
                </label>
                <label className="flex items-center gap-2 rounded-2xl border border-kabisig-border px-4 py-3 text-sm font-bold text-kabisig-text">
                  <input type="checkbox" checked={paymentSettings.freeRegistrationPromoEnabled} onChange={(event) => setPaymentSettings((current) => current ? { ...current, freeRegistrationPromoEnabled: event.target.checked } : current)} />
                  First workers promo
                  <FieldHelp text="Makes registration free only until the configured number of workers are approved. Rejected applications do not consume a slot." />
                </label>
                <label className="flex items-center gap-2 rounded-2xl border border-kabisig-border px-4 py-3 text-sm font-bold text-kabisig-text">
                  <input type="checkbox" checked={paymentSettings.commissionEnabled} onChange={(event) => setPaymentSettings((current) => current ? { ...current, commissionEnabled: event.target.checked } : current)} />
                  Monthly commission enabled
                  <FieldHelp text="Turns monthly worker commission billing on or off. When off, no new commission bills are generated." />
                </label>
              </div>
              <div className="rounded-3xl border border-kabisig-border p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-kabisig-text">
                  Active QR code
                  <FieldHelp text="The single QR image workers scan to pay the registration fee or admin payment. Upload JPG, JPEG, PNG, or WEBP." />
                </p>
                {paymentSettings.activeQrCodeUrl ? <img src={paymentSettings.activeQrCodeUrl} alt="Active worker payment QR" className="mt-3 h-40 w-40 rounded-2xl object-cover" /> : <p className="mt-2 text-sm text-kabisig-muted">No QR uploaded yet.</p>}
                <input className="mt-3 text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void updateQrCode(event.target.files?.[0])} />
              </div>
              <button className="rounded-2xl bg-kabisig-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-60" disabled={savingPaymentSettings} onClick={() => void saveWorkerPaymentSettings()}>
                {savingPaymentSettings ? "Saving..." : "Save worker payment settings"}
              </button>
              <div className="rounded-3xl border border-kabisig-border bg-slate-50 p-4 dark:bg-white/5">
                <p className="flex items-center gap-2 text-sm font-bold text-kabisig-text">
                  Existing worker migration
                  <FieldHelp text="Creates waived registration finance records for workers already approved before this feature, so they are not charged retroactively." />
                </p>
                <p className="mt-1 text-sm text-kabisig-muted">
                  Create waived registration finance records for already-approved workers and start their 5 free bookings from the activation date.
                </p>
                <button className="mt-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950" disabled={backfillingFinance} onClick={() => void backfillWorkerFinance()}>
                  {backfillingFinance ? "Preparing records..." : "Prepare existing workers"}
                </button>
                {financeBackfillMessage ? <p className="mt-2 text-sm font-bold text-emerald-700">{financeBackfillMessage}</p> : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-kabisig-muted">Loading worker payment settings...</p>
          )}
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
            <div className="border-t border-kabisig-border pt-5">
              <p className="font-bold text-kabisig-text">Kabisig Privacy Notice, version {KABISIG_PRIVACY_NOTICE_VERSION}</p>
            </div>
            {kabisigPrivacyNoticeSections.map((section) => (
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
