"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReadableDateTime, providerService, workerPaymentService, type WorkerPaymentSettings } from "@kabisig/shared";
import { AdminNotice, Card, EmptyPanel, FilterBar, LoadingPanel, SearchInput, Select, StatusBadge, Topbar } from "../../../components/ui";
import { logAdminAction } from "../../../lib/admin-actions";
import { useAdminAuth } from "../../../lib/auth-context";
import { loadMarketplaceSnapshot, subscribeMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";

export default function ProviderApprovalsPage() {
  const { admin } = useAdminAuth();
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [actionState, setActionState] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ label: string; url: string } | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<WorkerPaymentSettings | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "revision" | "rejected" | "approved">("pending");
  const [locationFilter, setLocationFilter] = useState("all");
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);

  async function reload() {
    const [nextSnapshot, nextPaymentSettings] = await Promise.all([
      loadMarketplaceSnapshot(),
      workerPaymentService.getSettings()
    ]);
    setSnapshot(nextSnapshot);
    setPaymentSettings(nextPaymentSettings);
  }

  useEffect(() => {
    void workerPaymentService.getSettings().then(setPaymentSettings).catch(() => undefined);
    return subscribeMarketplaceSnapshot(setSnapshot);
  }, []);

  const profileByUserId = useMemo(
    () => new Map((snapshot?.providerProfiles ?? []).map((profile) => [profile.userId, profile])),
    [snapshot]
  );
  const userById = useMemo(
    () => new Map((snapshot?.users ?? []).map((user) => [user.id, user])),
    [snapshot]
  );
  const registrationPaymentById = useMemo(
    () => new Map((snapshot?.workerRegistrationPayments ?? []).map((payment) => [payment.paymentId, payment])),
    [snapshot?.workerRegistrationPayments]
  );
  const registrationPaymentsByApplicationId = useMemo(
    () => new Map((snapshot?.workerRegistrationPayments ?? []).map((payment) => [payment.applicationId, payment])),
    [snapshot?.workerRegistrationPayments]
  );
  const registrationPaymentsByUserId = useMemo(
    () => {
      const map = new Map<string, NonNullable<MarketplaceSnapshot["workerRegistrationPayments"]>[number]>();
      for (const payment of snapshot?.workerRegistrationPayments ?? []) {
        const current = map.get(payment.userId);
        if (!current || String(payment.createdAt).localeCompare(String(current.createdAt)) > 0) {
          map.set(payment.userId, payment);
        }
      }
      return map;
    },
    [snapshot?.workerRegistrationPayments]
  );
  const pendingApplications = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const locationValue = locationFilter.toLowerCase();
    return (snapshot?.pendingApplications ?? []).filter((application) => {
      const profile = profileByUserId.get(application.userId);
      const user = userById.get(application.userId);
      const matchesSearch =
        !normalized ||
        [
          application.applicationId,
          user?.email,
          user?.fullName,
          profile?.displayName,
          profile?.businessName,
          profile?.city,
          ...(profile?.serviceCategories ?? []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesLocation = locationFilter === "all" || (profile?.city || "").toLowerCase().includes(locationValue);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && application.status === "Pending Approval") ||
        (statusFilter === "revision" && application.status === "Revision Requested") ||
        (statusFilter === "rejected" && application.status === "Rejected") ||
        (statusFilter === "approved" && application.status === "Approved");
      return matchesSearch && matchesLocation && matchesStatus;
    });
  }, [locationFilter, profileByUserId, search, snapshot?.pendingApplications, statusFilter, userById]);

  const moderatedProviders = useMemo(
    () =>
      (snapshot?.providerProfiles ?? [])
        .filter((profile) => profile.approvalStatus === "Approved")
        .sort((left, right) => right.displayName.localeCompare(left.displayName)),
    [snapshot?.providerProfiles]
  );

  const auditLogs = useMemo(
    () => (snapshot?.auditLogs ?? []).filter((entry) => entry.targetCollection === "providerProfiles").slice(0, 10),
    [snapshot?.auditLogs]
  );

  async function handleAction(
    type: "approve" | "reject" | "revision",
    applicationId: string,
    userId: string
  ) {
    if (!admin) return;
    setActionState(applicationId);
    try {
      if (type === "approve") {
        await providerService.approveProvider(applicationId, userId, admin.id);
      } else if (type === "reject") {
        await providerService.rejectProvider(
          applicationId,
          userId,
          admin.id,
          "Rejected after admin review."
        );
      } else {
        await providerService.requestRevision(
          applicationId,
          userId,
          admin.id,
          "Please update and resubmit the required documents."
        );
      }
      await logAdminAction(
        admin,
        type === "approve" ? "provider_approved" : type === "reject" ? "provider_rejected" : "provider_revision_requested",
        "providerProfiles",
        userId,
        `Provider application ${applicationId} was ${type === "approve" ? "approved" : type === "reject" ? "rejected" : "sent for revision"}.`,
        { applicationId }
      );
      setNotice({
        type: "success",
        title: "Provider application updated",
        message: `Application ${applicationId} was ${type === "approve" ? "approved" : type === "reject" ? "rejected" : "sent back for revision"}.`
      });
      await reload();
    } catch (error) {
      setNotice({
        type: "error",
        title: "Provider action failed",
        message: error instanceof Error ? error.message : "The provider action could not be completed."
      });
    } finally {
      setActionState(null);
    }
  }

  async function reviewRegistrationPayment(paymentId: string, status: "Approved" | "Rejected") {
    if (!admin) return;
    const remarks = status === "Rejected" ? window.prompt("Add rejection remarks for this payment proof:") : "";
    if (status === "Rejected" && !remarks?.trim()) return;
    setActionState(paymentId);
    try {
      await workerPaymentService.reviewRegistrationPayment(paymentId, admin.id, status, remarks || undefined);
      setNotice({
        type: "success",
        title: status === "Approved" ? "Registration payment approved" : "Registration payment rejected",
        message: `Payment ${paymentId} was ${status.toLowerCase()}.`
      });
      await reload();
    } catch (error) {
      setNotice({
        type: "error",
        title: "Payment review failed",
        message: error instanceof Error ? error.message : "The registration payment action could not be completed."
      });
    } finally {
      setActionState(null);
    }
  }

  async function handleModeration(userId: string, status: "active" | "suspended" | "banned") {
    if (!admin) return;
    setActionState(userId);
    try {
      await providerService.updateModerationStatus(
        userId,
        admin.id,
        status,
        status === "active" ? "Provider restored by admin." : `Provider marked as ${status}.`
      );
      await logAdminAction(
        admin,
        status === "active" ? "provider_unsuspended" : status === "suspended" ? "provider_suspended" : "provider_banned",
        "providerProfiles",
        userId,
        status === "active" ? "Provider restored by admin." : `Provider marked as ${status}.`,
        { moderationStatus: status }
      );
      setNotice({
        type: "success",
        title: "Provider moderation updated",
        message: status === "active" ? "Provider access was restored." : `Provider was marked as ${status}.`
      });
      await reload();
    } catch (error) {
      setNotice({
        type: "error",
        title: "Moderation update failed",
        message: error instanceof Error ? error.message : "The provider moderation status could not be updated."
      });
    } finally {
      setActionState(null);
    }
  }

  if (!snapshot) {
    return (
      <>
        <Topbar title="Provider approvals" />
        <LoadingPanel title="Loading provider queue" description="Connecting applications, worker documents, registration payments, and moderation history." />
      </>
    );
  }

  return (
    <>
      <Topbar title="Provider approvals" />
      {notice ? <AdminNotice type={notice.type} title={notice.title} message={notice.message} onDismiss={() => setNotice(null)} /> : null}
      <FilterBar>
        <SearchInput placeholder="Search applicant, email, category..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select
          label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          options={[
            { label: "Pending approval", value: "pending" },
            { label: "All", value: "all" },
            { label: "Revision requested", value: "revision" },
            { label: "Rejected", value: "rejected" },
            { label: "Approved", value: "approved" },
          ]}
        />
        <Select
          label="Location"
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
          options={[
            { label: "All locations", value: "all" },
            ...Array.from(new Set((snapshot?.providerProfiles ?? []).map((profile) => profile.city).filter(Boolean))).map((city) => ({
              label: city,
              value: city,
            })),
          ]}
        />
      </FilterBar>
      <Card title="Pending provider applications">
        {pendingApplications.length ? (
          <div className="space-y-4">
            {pendingApplications.map((application) => {
              const profile = profileByUserId.get(application.userId);
              const user = userById.get(application.userId);
              const registrationPayment =
                registrationPaymentById.get(application.registrationPaymentId || "") ||
                registrationPaymentsByApplicationId.get(application.applicationId) ||
                registrationPaymentsByUserId.get(application.userId) ||
                application.registrationPaymentSnapshot;
              const registrationPaymentFromSnapshot =
                !registrationPaymentById.get(application.registrationPaymentId || "") &&
                !registrationPaymentsByApplicationId.get(application.applicationId) &&
                !registrationPaymentsByUserId.get(application.userId) &&
                Boolean(application.registrationPaymentSnapshot);
              const expectedRegistrationAmount =
                application.registrationFeeRequired
                  ? Number(registrationPayment?.amount || paymentSettings?.registrationFeeAmount || 500)
                  : 0;
              const canApprove =
                !application.registrationFeeRequired ||
                application.registrationPaymentStatus === "Approved" ||
                registrationPayment?.status === "Approved";
              const registrationPaymentId = registrationPayment?.paymentId || "";
              return (
                <div key={application.applicationId} className="rounded-[28px] border border-kabisig-border p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-bold text-kabisig-text">{profile?.displayName || user?.fullName || application.userId}</p>
                        <StatusBadge status={application.status} />
                      </div>
                      <p className="text-sm text-kabisig-muted">{user?.email || "No linked email found"}</p>
                      <p className="text-sm text-kabisig-muted">
                        {(profile?.serviceCategories ?? []).join(", ") || "No categories yet"} | {profile?.city || "No city"} | {profile?.yearsExperience ?? 0} years experience
                      </p>
                      <div className="rounded-2xl border border-kabisig-border bg-slate-50 p-3 text-sm dark:bg-white/5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-kabisig-text">Registration payment</span>
                          <StatusBadge status={registrationPayment?.status || application.registrationPaymentStatus || "Pending"} />
                        </div>
                        <p className="mt-2 text-kabisig-muted">
                          Amount: PHP {expectedRegistrationAmount.toLocaleString()} | Reference: {registrationPayment?.referenceNumber || "None"} | Paid date: {registrationPayment?.paymentDate || "None"}
                        </p>
                        {registrationPayment && Number(registrationPayment.amount || 0) <= 0 && application.registrationFeeRequired ? (
                          <p className="mt-1 text-xs font-bold text-amber-700">
                            This older payment record saved amount as 0. Expected fee is shown from current worker payment settings.
                          </p>
                        ) : null}
                        {registrationPaymentFromSnapshot ? (
                          <p className="mt-1 text-xs font-bold text-amber-700">
                            Showing the payment snapshot saved with this application because the live payment record is not available in the admin listener.
                          </p>
                        ) : null}
                        {registrationPayment?.proofImageUrl ? (
                          <div className="mt-3 rounded-2xl border border-kabisig-border bg-white p-3 dark:bg-slate-950/60">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-kabisig-muted">Payment proof preview</p>
                            <button className="mt-2 block w-full overflow-hidden rounded-2xl border border-kabisig-border bg-slate-100 dark:bg-slate-900" onClick={() => setPreviewDoc({ label: "Registration payment proof", url: registrationPayment.proofImageUrl || "" })}>
                              <img src={registrationPayment.proofImageUrl} alt="Registration payment proof" className="h-64 w-full object-contain p-2" />
                            </button>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button className="rounded-xl bg-kabisig-blue px-3 py-2 text-xs font-bold text-white" onClick={() => setPreviewDoc({ label: "Registration payment proof", url: registrationPayment.proofImageUrl || "" })}>Open large preview</button>
                              <a href={registrationPayment.proofImageUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-kabisig-border px-3 py-2 text-xs font-bold text-kabisig-text">Open in new tab</a>
                            {registrationPaymentId && (registrationPayment.status === "Submitted" || registrationPayment.status === "Rejected") ? (
                              <>
                                <button className="rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={actionState === registrationPaymentId} onClick={() => void reviewRegistrationPayment(registrationPaymentId, "Approved")}>Approve payment</button>
                                <button className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={actionState === registrationPaymentId} onClick={() => void reviewRegistrationPayment(registrationPaymentId, "Rejected")}>Reject payment</button>
                              </>
                            ) : null}
                            </div>
                          </div>
                        ) : application.registrationFeeRequired ? (
                          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                            <p className="font-bold">Payment proof is missing from this submitted record.</p>
                            <p className="mt-1 text-xs">
                              Ask the worker to resubmit the registration payment proof, reference number, and payment date before approving the payment.
                            </p>
                          </div>
                        ) : (
                          <p className="mt-2 text-emerald-600">Registration fee waived/free.</p>
                        )}
                        {registrationPayment?.adminRemarks ? <p className="mt-2 text-rose-600">Admin remarks: {registrationPayment.adminRemarks}</p> : null}
                      </div>
                      <div className="space-y-2 text-sm text-kabisig-muted">
                        {application.documentUrls.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-kabisig-border bg-slate-50 p-3 dark:bg-white/5">
                            <div className="font-semibold text-kabisig-text">{item.label}</div>
                            {item.driveLink || item.url ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  className="rounded-xl bg-kabisig-blue px-3 py-2 text-xs font-bold text-white"
                                  onClick={() => setPreviewDoc({ label: item.label, url: item.url || item.driveLink || "" })}
                                >
                                  Preview
                                </button>
                                <a
                                  href={item.url || item.driveLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  download={(item as typeof item & { fileName?: string }).fileName || item.label}
                                  className="rounded-xl border border-kabisig-border px-3 py-2 text-xs font-bold text-kabisig-text"
                                >
                                  Download
                                </a>
                              </div>
                            ) : (
                              <span>Not yet submitted</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                        disabled={actionState === application.applicationId || !canApprove}
                        onClick={() => void handleAction("approve", application.applicationId, application.userId)}
                      >
                        {canApprove ? "Approve" : "Approve payment first"}
                      </button>
                      <button
                        className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                        disabled={actionState === application.applicationId}
                        onClick={() => void handleAction("reject", application.applicationId, application.userId)}
                      >
                        Reject
                      </button>
                      <button
                        className="rounded-2xl bg-kabisig-orange px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                        disabled={actionState === application.applicationId}
                        onClick={() => void handleAction("revision", application.applicationId, application.userId)}
                      >
                        Request Revision
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyPanel title="No pending approvals" description="New provider applications from the mobile onboarding flow will appear here for review." />
        )}
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card title="Provider moderation">
          <div className="space-y-4">
            {moderatedProviders.slice(0, 12).map((profile) => (
              <div key={profile.userId} className="flex flex-col gap-4 rounded-[28px] border border-kabisig-border p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-lg font-bold text-kabisig-text">{profile.displayName}</p>
                  <p className="mt-1 text-sm text-kabisig-muted">{profile.city || "No city"} | {(profile.serviceCategories ?? []).join(", ") || "No categories"}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <StatusBadge status={profile.approvalStatus} />
                    <StatusBadge status={profile.moderation?.status || "active"} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-2xl border border-kabisig-border px-4 py-3 text-sm font-bold text-kabisig-text disabled:opacity-60" disabled={actionState === profile.userId} onClick={() => void handleModeration(profile.userId, "active")}>Restore</button>
                  <button className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60" disabled={actionState === profile.userId} onClick={() => void handleModeration(profile.userId, "suspended")}>Suspend</button>
                  <button className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60" disabled={actionState === profile.userId} onClick={() => void handleModeration(profile.userId, "banned")}>Ban</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Provider audit log">
          <div className="space-y-3">
            {auditLogs.length ? auditLogs.map((entry) => (
              <div key={entry.logId} className="rounded-[24px] border border-kabisig-border bg-slate-50 p-4 dark:bg-white/5">
                <p className="text-sm font-bold text-kabisig-text">{entry.summary}</p>
                <p className="mt-1 text-xs text-kabisig-muted">{entry.action} • {formatReadableDateTime(entry.createdAt)}</p>
                <p className="mt-2 text-xs text-kabisig-muted">Target: {entry.targetId}</p>
              </div>
            )) : <EmptyPanel title="No audit events yet" description="Moderation and approval events will be logged here." />}
          </div>
        </Card>
      </div>
      {previewDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-6">
          <div className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-white p-5 shadow-soft dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-black text-kabisig-text">{previewDoc.label}</p>
                <p className="text-sm text-kabisig-muted">Provider document preview</p>
              </div>
              <button className="rounded-2xl border border-kabisig-border px-4 py-2 text-sm font-bold text-kabisig-text" onClick={() => setPreviewDoc(null)}>
                Close
              </button>
            </div>
            {previewDoc.url.startsWith("data:image") ? (
              <img src={previewDoc.url} alt={previewDoc.label} className="max-h-[70vh] w-full rounded-[24px] object-contain bg-slate-100 p-3 dark:bg-slate-900" />
            ) : (
              <iframe src={previewDoc.url} title={previewDoc.label} className="h-[70vh] w-full rounded-[24px] border border-kabisig-border bg-white" />
            )}
            <div className="mt-4 flex justify-end">
              <a href={previewDoc.url} download={previewDoc.label} className="rounded-2xl bg-kabisig-blue px-4 py-3 text-sm font-bold text-white">
                Download file
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
