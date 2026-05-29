"use client";

import { useEffect, useState } from "react";
import { formatBookingReference, formatReadableDateTime } from "@kabisig/shared";
import { AnalyticsCharts } from "../../../components/charts";
import { Card, DashboardStatCard, EmptyPanel, ErrorPanel, KpiRibbon, LoadingPanel, StatusBadge, Topbar } from "../../../components/ui";
import { getSuspiciousPaymentReasons } from "../../../lib/admin-actions";
import { loadMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
      try {
        setLoading(true);
        setSnapshot(await loadMarketplaceSnapshot());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
  }

  if (loading) {
    return (
      <>
        <Topbar title="Operations overview" />
        <LoadingPanel title="Loading marketplace data" description="Pulling the latest users, bookings, payments, and provider approvals from Firestore." />
      </>
    );
  }

  if (!snapshot) {
    return (
      <>
        <Topbar title="Operations overview" />
        <ErrorPanel title="Dashboard unavailable" description={error || "The live marketplace snapshot could not be loaded."} onRetry={() => void load()} />
      </>
    );
  }

  const { analytics, bookings, bookingChangeRequests, payments, complaints, pendingApplications, auditLogs } = snapshot;
  const commissionBills = snapshot.workerCommissionBills;
  const revenueRecords = snapshot.adminRevenueRecords;
  const openComplaints = complaints.filter((complaint) => complaint.status === "Open" || complaint.status === "Under Review");
  const pendingChangeRequests = bookingChangeRequests.filter((request) => request.status === "Pending");
  const bookingById = new Map(bookings.map((booking) => [booking.bookingId, booking]));
  const suspiciousPayments = payments
    .map((payment) => ({
      payment,
      reasons: getSuspiciousPaymentReasons(payment, bookingById.get(payment.bookingId))
    }))
    .filter((item) => item.reasons.length);
  const pendingCommissionReviews = commissionBills.filter((bill) => bill.status === "Submitted");
  const unpaidCommissionBills = commissionBills.filter((bill) => ["Pending", "Submitted", "Rejected", "Overdue"].includes(bill.status));
  const overdueCommissionBills = commissionBills.filter((bill) => bill.status === "Overdue");
  const commissionRevenueThisMonth = revenueRecords
    .filter((record) => record.sourceType === "monthly_commission")
    .filter((record) => {
      const approvedAt = new Date(record.approvedAt || record.createdAt);
      const now = new Date();
      return approvedAt.getFullYear() === now.getFullYear() && approvedAt.getMonth() === now.getMonth();
    })
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const alerts = [
    {
      title: "Pending provider approvals",
      count: pendingApplications.length,
      tone: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/20",
      note: "Applications waiting for admin review.",
    },
    {
      title: "Open complaints",
      count: openComplaints.length,
      tone: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-400/20",
      note: "Reports that still need review or resolution.",
    },
    {
      title: "Cancellation and reschedule requests",
      count: pendingChangeRequests.length,
      tone: "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-400/20",
      note: "Pending customer/provider change decisions.",
    },
    {
      title: "Suspicious payments",
      count: suspiciousPayments.length,
      tone: "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-200 dark:ring-orange-400/20",
      note: "Cancelled, underpaid, missing, or stale payment records.",
    },
    {
      title: "Commission reviews",
      count: pendingCommissionReviews.length,
      tone: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20",
      note: "Worker payment proofs waiting for admin review.",
    },
    {
      title: "Overdue worker bills",
      count: overdueCommissionBills.length,
      tone: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/20",
      note: "Workers currently blocked by unpaid commission balances.",
    },
  ];

  return (
    <>
      <Topbar title="Operations overview" />
      <KpiRibbon analytics={analytics} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard title="Total Customers" value={analytics.totalCustomers.toLocaleString()} hint="Registered customer accounts" trend="Live Firestore count" />
        <DashboardStatCard title="Service Providers" value={analytics.totalProviders.toLocaleString()} hint="Provider accounts across all approval states" trend="Live Firestore count" />
        <DashboardStatCard title="Pending Approvals" value={analytics.pendingApprovals.toString()} hint="Applications waiting for admin review" trend="Needs attention" />
        <DashboardStatCard title="Revenue" value={`PHP ${analytics.revenueSummary.toLocaleString()}`} hint="Total recorded payment volume" trend="Synced from payments" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard title="Commission Reviews" value={pendingCommissionReviews.length.toString()} hint="Submitted worker proofs waiting for admin action" trend="Finance queue" />
        <DashboardStatCard title="Unpaid Bills" value={unpaidCommissionBills.length.toString()} hint="Pending, rejected, submitted, or overdue commission bills" trend="Collection watch" />
        <DashboardStatCard title="Overdue Workers" value={overdueCommissionBills.length.toString()} hint="Workers currently restricted from accepting bookings" trend="Restriction watch" />
        <DashboardStatCard title="Commission Revenue" value={`PHP ${commissionRevenueThisMonth.toLocaleString()}`} hint="Approved monthly commission revenue this month" trend="Platform share" />
      </div>
      <AnalyticsCharts analytics={analytics} />
      <Card title="Admin alert panel">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {alerts.map((alert) => (
            <div key={alert.title} className={`rounded-3xl p-4 ring-1 ${alert.tone}`}>
              <p className="text-sm font-black">{alert.title}</p>
              <p className="mt-3 text-3xl font-black">{alert.count}</p>
              <p className="mt-2 text-xs font-semibold opacity-80">{alert.note}</p>
            </div>
          ))}
        </div>
        {suspiciousPayments.length || pendingCommissionReviews.length ? (
          <div className="mt-4 space-y-3">
            {suspiciousPayments.slice(0, 4).map(({ payment, reasons }) => (
              <div key={payment.paymentId} className="rounded-3xl border border-orange-200 bg-orange-50/80 p-4 text-sm dark:border-orange-400/20 dark:bg-orange-500/10">
                <p className="font-black text-kabisig-text">{payment.paymentId}</p>
                <p className="mt-1 text-kabisig-muted">{reasons.join(", ")}</p>
              </div>
            ))}
            {pendingCommissionReviews.slice(0, 3).map((bill) => (
              <div key={bill.billId} className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm dark:border-emerald-400/20 dark:bg-emerald-500/10">
                <p className="font-black text-kabisig-text">{bill.billId}</p>
                <p className="mt-1 text-kabisig-muted">
                  PHP {Number(bill.amountDue || 0).toLocaleString()} proof waiting for review.
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Recent activity">
          <div className="space-y-4">
            {bookings.slice(0, 3).map((booking) => (
              <div key={booking.bookingId} className="rounded-3xl border border-kabisig-border bg-kabisig-bg/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-kabisig-text">{booking.serviceName}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-kabisig-blue">{formatBookingReference(booking)}</p>
                    <p className="mt-1 text-sm text-kabisig-muted">{booking.address}</p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-kabisig-blue">{booking.scheduledAt}</p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Complaint watchlist">
          {complaints.length ? (
            <div className="space-y-4">
              {complaints.map((complaint) => (
                <div key={complaint.reportId} className="rounded-3xl border border-kabisig-border bg-kabisig-bg/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-kabisig-text">{complaint.type}</p>
                      <p className="mt-1 text-sm text-kabisig-muted">{complaint.description}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-kabisig-orange">{formatReadableDateTime(complaint.createdAt)}</p>
                    </div>
                    <StatusBadge status={complaint.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel title="No open complaints" description="Customer complaints and trust-and-safety issues will appear here once reports are submitted." />
          )}
        </Card>
      </div>
      <Card title="Recent admin audit logs">
        {auditLogs.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {auditLogs.slice(0, 8).map((entry) => (
              <div key={entry.logId} className="rounded-3xl border border-kabisig-border bg-kabisig-bg/70 p-4">
                <p className="text-sm font-black text-kabisig-text">{entry.summary}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-kabisig-blue">{entry.action}</p>
                <p className="mt-1 text-xs text-kabisig-muted">{formatReadableDateTime(entry.createdAt)} | {entry.targetCollection}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel title="No admin audit logs yet" description="Provider approvals, category edits, reports, booking decisions, exports, and broadcasts will appear here." />
        )}
      </Card>
    </>
  );
}
