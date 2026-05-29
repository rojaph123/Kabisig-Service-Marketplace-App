"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { workerPaymentService, type WorkerCommissionBill } from "@kabisig/shared";
import { AdminNotice, Card, DashboardStatCard, ErrorPanel, LoadingPanel, StatusBadge, Topbar } from "../../../components/ui";
import { useAdminAuth } from "../../../lib/auth-context";
import { loadMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";

export default function RevenuePage() {
  const { admin } = useAdminAuth();
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [actionState, setActionState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewProof, setPreviewProof] = useState<{ label: string; url: string } | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);

  async function reload() {
    try {
      setSnapshot(await loadMarketplaceSnapshot());
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Revenue data could not be loaded.";
      setError(message.includes("permission") ? "Sign in with an admin account to view revenue collections." : message);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const financeRows = useMemo(() => {
    const users = new Map((snapshot?.users ?? []).map((user) => [user.id, user]));
    const registrations = new Map((snapshot?.workerRegistrationPayments ?? []).map((payment) => [payment.providerId, payment]));
    const paidBookingIds = new Set((snapshot?.payments ?? []).filter((payment) => payment.status === "Paid").map((payment) => payment.bookingId));
    const completedPaidBookingsByProvider = new Map<string, number>();
    (snapshot?.bookings ?? []).forEach((booking) => {
      if (booking.status !== "Completed" || !paidBookingIds.has(booking.bookingId)) return;
      completedPaidBookingsByProvider.set(booking.providerId, (completedPaidBookingsByProvider.get(booking.providerId) ?? 0) + 1);
    });
    const billsByProvider = new Map<string, WorkerCommissionBill[]>();
    (snapshot?.workerCommissionBills ?? []).forEach((bill) => {
      billsByProvider.set(bill.providerId, [...(billsByProvider.get(bill.providerId) ?? []), bill]);
    });
    return (snapshot?.providerProfiles ?? [])
      .filter((profile) => profile.isApproved || registrations.has(profile.userId))
      .map((profile) => {
        const bills = billsByProvider.get(profile.userId) ?? [];
        const pendingAmount = bills.filter((bill) => ["Pending", "Submitted", "Rejected"].includes(bill.status)).reduce((sum, bill) => sum + Number(bill.amountDue || 0), 0);
        const overdueAmount = bills.filter((bill) => bill.status === "Overdue").reduce((sum, bill) => sum + Number(bill.amountDue || 0), 0);
        const freeBookingsGranted = Math.max(Number(profile.financialStatus?.freeBookingsGranted ?? 5), 1);
        const liveCompletedPaidBookings = completedPaidBookingsByProvider.get(profile.userId) ?? 0;
        const freeBookingsUsed = Math.min(
          freeBookingsGranted,
          Math.max(Number(profile.financialStatus?.freeBookingsUsed ?? 0), liveCompletedPaidBookings)
        );
        return {
          profile,
          user: users.get(profile.userId),
          registration: registrations.get(profile.userId),
          bills,
          pendingAmount,
          overdueAmount,
          freeBookingsGranted,
          freeBookingsUsed,
        };
      });
  }, [snapshot]);

  const revenue = snapshot?.adminRevenueRecords ?? [];
  const registrationCollected = revenue.filter((item) => item.sourceType === "registration_fee").reduce((sum, item) => sum + item.amount, 0);
  const commissionCollected = revenue.filter((item) => item.sourceType === "monthly_commission").reduce((sum, item) => sum + item.amount, 0);
  const pendingCollections = (snapshot?.workerCommissionBills ?? []).filter((bill) => ["Pending", "Submitted"].includes(bill.status)).reduce((sum, bill) => sum + bill.amountDue, 0);
  const overdueCollections = (snapshot?.workerCommissionBills ?? []).filter((bill) => bill.status === "Overdue").reduce((sum, bill) => sum + bill.amountDue, 0);
  const rejectedPayments =
    (snapshot?.workerRegistrationPayments ?? []).filter((payment) => payment.status === "Rejected").length +
    (snapshot?.workerCommissionBills ?? []).filter((bill) => bill.status === "Rejected").length;
  const revenueTrend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString("en-US", { month: "short" }),
        amount: 0,
      };
    });
    revenue.forEach((record) => {
      const date = new Date(record.approvedAt || record.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const month = months.find((entry) => entry.key === key);
      if (month) month.amount += Number(record.amount || 0);
    });
    return months;
  }, [revenue]);

  async function reviewBill(billId: string, status: "Approved" | "Rejected") {
    if (!admin) return;
    const remarks = status === "Rejected" ? window.prompt("Add rejection remarks for this commission payment:") : "";
    if (status === "Rejected" && !remarks?.trim()) return;
    setActionState(billId);
    try {
      await workerPaymentService.reviewCommissionPayment(billId, admin.id, status, remarks || undefined);
      setNotice({
        type: "success",
        title: status === "Approved" ? "Commission payment approved" : "Commission payment rejected",
        message: `Commission bill ${billId} was ${status.toLowerCase()}.`
      });
      await reload();
    } catch (err) {
      setNotice({
        type: "error",
        title: "Commission review failed",
        message: err instanceof Error ? err.message : "The commission payment could not be reviewed."
      });
    } finally {
      setActionState(null);
    }
  }

  async function reviewRegistration(paymentId: string, status: "Approved" | "Rejected") {
    if (!admin) return;
    const remarks = status === "Rejected" ? window.prompt("Add rejection remarks for this registration payment:") : "";
    if (status === "Rejected" && !remarks?.trim()) return;
    setActionState(paymentId);
    try {
      await workerPaymentService.reviewRegistrationPayment(paymentId, admin.id, status, remarks || undefined);
      setNotice({
        type: "success",
        title: status === "Approved" ? "Registration payment approved" : "Registration payment rejected",
        message: `Registration payment ${paymentId} was ${status.toLowerCase()}.`
      });
      await reload();
    } catch (err) {
      setNotice({
        type: "error",
        title: "Registration review failed",
        message: err instanceof Error ? err.message : "The registration payment could not be reviewed."
      });
    } finally {
      setActionState(null);
    }
  }

  if (!snapshot) {
    return (
      <>
        <Topbar title="Revenue" />
        {error ? (
          <ErrorPanel title="Revenue unavailable" description={error} onRetry={() => void reload()} />
        ) : (
          <LoadingPanel title="Loading revenue data" description="Collecting worker registration fees, commission bills, and admin revenue records." />
        )}
      </>
    );
  }

  return (
    <>
      <Topbar title="Revenue" />
      {notice ? <AdminNotice type={notice.type} title={notice.title} message={notice.message} onDismiss={() => setNotice(null)} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard title="Admin Revenue" value={`PHP ${(registrationCollected + commissionCollected).toLocaleString()}`} hint="Approved worker payments only" />
        <DashboardStatCard title="Registration Fees" value={`PHP ${registrationCollected.toLocaleString()}`} hint="Approved registration collections" />
        <DashboardStatCard title="Commission Collections" value={`PHP ${commissionCollected.toLocaleString()}`} hint="Approved monthly commissions" />
        <DashboardStatCard title="Overdue" value={`PHP ${overdueCollections.toLocaleString()}`} hint={`${rejectedPayments} rejected payment record(s)`} />
      </div>

      <Card title="Collection status">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-kabisig-border bg-slate-50 p-4 dark:bg-white/5">
            <p className="text-sm font-bold text-kabisig-muted">Pending collections</p>
            <p className="mt-2 text-2xl font-black text-kabisig-text">PHP {pendingCollections.toLocaleString()}</p>
          </div>
          <div className="rounded-3xl border border-kabisig-border bg-slate-50 p-4 dark:bg-white/5">
            <p className="text-sm font-bold text-kabisig-muted">Paid workers</p>
            <p className="mt-2 text-2xl font-black text-kabisig-text">{financeRows.filter((row) => !row.pendingAmount && !row.overdueAmount).length}</p>
          </div>
          <div className="rounded-3xl border border-kabisig-border bg-slate-50 p-4 dark:bg-white/5">
            <p className="text-sm font-bold text-kabisig-muted">Restricted workers</p>
            <p className="mt-2 text-2xl font-black text-kabisig-text">{financeRows.filter((row) => row.profile.financialStatus?.restrictedFromAcceptingBookings).length}</p>
          </div>
        </div>
      </Card>

      <Card title="Revenue trend">
        <div className="grid gap-3 md:grid-cols-6">
          {revenueTrend.map((month) => (
            <div key={month.key} className="rounded-3xl border border-kabisig-border bg-slate-50 p-4 dark:bg-white/5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-kabisig-muted">{month.label}</p>
              <p className="mt-2 text-lg font-black text-kabisig-text">PHP {month.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Worker finance details">
        <div className="space-y-4">
          {financeRows.map(({ profile, user, registration, bills, pendingAmount, overdueAmount, freeBookingsGranted, freeBookingsUsed }) => (
            <div key={profile.userId} className="rounded-[28px] border border-kabisig-border p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-lg font-bold text-kabisig-text">{profile.displayName || user?.fullName || profile.userId}</p>
                  <p className="mt-1 text-sm text-kabisig-muted">{user?.email || "No email"} | {(profile.serviceCategories ?? []).join(", ") || "No services"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={registration?.status || profile.financialStatus?.registrationPaymentStatus || "Waived"} />
                    {profile.financialStatus?.restrictedFromAcceptingBookings ? <StatusBadge status="Overdue" /> : <StatusBadge status="Active" />}
                  </div>
                  <p className="mt-3 text-sm text-kabisig-muted">
                    Free bookings: {freeBookingsUsed}/{freeBookingsGranted} | Pending: PHP {pendingAmount.toLocaleString()} | Overdue: PHP {overdueAmount.toLocaleString()}
                  </p>
                  {registration ? (
                    <div className="mt-3 rounded-3xl border border-kabisig-border bg-slate-50 p-4 dark:bg-white/5">
                      <p className="text-sm font-bold text-kabisig-text">Registration payment</p>
                      <p className="mt-1 text-sm text-kabisig-muted">Amount: PHP {registration.amount.toLocaleString()} | Reference: {registration.referenceNumber || "None"}</p>
                      {registration.adminRemarks ? <p className="mt-1 text-sm text-rose-600">Remarks: {registration.adminRemarks}</p> : null}
                      {registration.proofImageUrl ? (
                        <div className="mt-3 rounded-2xl border border-kabisig-border bg-white p-3 dark:bg-slate-950/60">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-kabisig-muted">Registration proof preview</p>
                          <button className="mt-2 block w-full overflow-hidden rounded-2xl border border-kabisig-border bg-slate-100 dark:bg-slate-900" onClick={() => setPreviewProof({ label: "Registration payment proof", url: registration.proofImageUrl || "" })}>
                            <img src={registration.proofImageUrl} alt="Registration payment proof" className="h-56 w-full object-contain p-2" />
                          </button>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {registration.proofImageUrl ? (
                          <>
                            <button onClick={() => setPreviewProof({ label: "Registration payment proof", url: registration.proofImageUrl || "" })} className="rounded-xl bg-kabisig-blue px-3 py-2 text-xs font-bold text-white">Open large preview</button>
                            <Link href={registration.proofImageUrl} target="_blank" className="rounded-xl border border-kabisig-border px-3 py-2 text-xs font-bold text-kabisig-text">Open in new tab</Link>
                          </>
                        ) : null}
                        {registration.status === "Submitted" || registration.status === "Rejected" ? (
                          <>
                            <button disabled={actionState === registration.paymentId} onClick={() => void reviewRegistration(registration.paymentId, "Approved")} className="rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Approve registration</button>
                            <button disabled={actionState === registration.paymentId} onClick={() => void reviewRegistration(registration.paymentId, "Rejected")} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Reject registration</button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              {bills.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {bills.slice(0, 4).map((bill) => (
                    <div key={bill.billId} className="rounded-3xl border border-kabisig-border bg-slate-50 p-4 dark:bg-white/5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-kabisig-text">{new Date(bill.cycleStart).toLocaleDateString()} - {new Date(bill.cycleEnd).toLocaleDateString()}</p>
                          <p className="mt-1 text-sm text-kabisig-muted">Due: {new Date(bill.dueDate).toLocaleDateString()} | PHP {bill.amountDue.toLocaleString()}</p>
                          <p className="mt-1 text-sm text-kabisig-muted">Income: PHP {bill.totalIncome.toLocaleString()} | Commissionable: {bill.commissionableBookings}</p>
                          {bill.referenceNumber ? <p className="mt-1 text-sm text-kabisig-muted">Reference: {bill.referenceNumber}</p> : null}
                          {bill.adminRemarks ? <p className="mt-1 text-sm text-rose-600">Remarks: {bill.adminRemarks}</p> : null}
                        </div>
                        <StatusBadge status={bill.status} />
                      </div>
                      {bill.proofImageUrl ? (
                        <div className="mt-3 rounded-2xl border border-kabisig-border bg-white p-3 dark:bg-slate-950/60">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-kabisig-muted">Commission proof preview</p>
                          <button className="mt-2 block w-full overflow-hidden rounded-2xl border border-kabisig-border bg-slate-100 dark:bg-slate-900" onClick={() => setPreviewProof({ label: "Commission payment proof", url: bill.proofImageUrl || "" })}>
                            <img src={bill.proofImageUrl} alt="Commission payment proof" className="h-52 w-full object-contain p-2" />
                          </button>
                        </div>
                      ) : null}
                      {bill.proofImageUrl ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={() => setPreviewProof({ label: "Commission payment proof", url: bill.proofImageUrl || "" })} className="rounded-xl bg-kabisig-blue px-3 py-2 text-xs font-bold text-white">Open large preview</button>
                          <Link href={bill.proofImageUrl} target="_blank" className="rounded-xl border border-kabisig-border px-3 py-2 text-xs font-bold text-kabisig-text">Open in new tab</Link>
                          {bill.status === "Submitted" || bill.status === "Rejected" ? (
                            <>
                              <button disabled={actionState === bill.billId} onClick={() => void reviewBill(bill.billId, "Approved")} className="rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Approve</button>
                              <button disabled={actionState === bill.billId} onClick={() => void reviewBill(bill.billId, "Rejected")} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Reject</button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
      {previewProof ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-6">
          <div className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-white p-5 shadow-soft dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-black text-kabisig-text">{previewProof.label}</p>
                <p className="text-sm text-kabisig-muted">Worker payment proof preview</p>
              </div>
              <button className="rounded-2xl border border-kabisig-border px-4 py-2 text-sm font-bold text-kabisig-text" onClick={() => setPreviewProof(null)}>
                Close
              </button>
            </div>
            <img src={previewProof.url} alt={previewProof.label} className="max-h-[70vh] w-full rounded-[24px] bg-slate-100 object-contain p-3 dark:bg-slate-900" />
            <div className="mt-4 flex justify-end">
              <a href={previewProof.url} target="_blank" rel="noreferrer" className="rounded-2xl bg-kabisig-blue px-4 py-3 text-sm font-bold text-white">
                Open original
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
