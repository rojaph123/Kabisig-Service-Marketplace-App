"use client";

import { useEffect, useState } from "react";
import { AnalyticsCharts } from "../../../components/charts";
import { Card, DashboardStatCard, EmptyPanel, KpiRibbon, StatusBadge, Topbar } from "../../../components/ui";
import { loadMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    void load();
  }, []);

  if (loading) {
    return (
      <>
        <Topbar title="Operations overview" />
        <EmptyPanel title="Loading marketplace data" description="Pulling the latest users, bookings, payments, and provider approvals from Firestore." />
      </>
    );
  }

  if (!snapshot) {
    return (
      <>
        <Topbar title="Operations overview" />
        <EmptyPanel title="Dashboard unavailable" description={error || "The live marketplace snapshot could not be loaded."} />
      </>
    );
  }

  const { analytics, bookings, complaints } = snapshot;

  return (
    <>
      <Topbar title="Operations overview" />
      <KpiRibbon />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard title="Total Customers" value={analytics.totalCustomers.toLocaleString()} hint="Registered customer accounts" trend="Live Firestore count" />
        <DashboardStatCard title="Service Providers" value={analytics.totalProviders.toLocaleString()} hint="Provider accounts across all approval states" trend="Live Firestore count" />
        <DashboardStatCard title="Pending Approvals" value={analytics.pendingApprovals.toString()} hint="Applications waiting for admin review" trend="Needs attention" />
        <DashboardStatCard title="Revenue" value={`PHP ${analytics.revenueSummary.toLocaleString()}`} hint="Total recorded payment volume" trend="Synced from payments" />
      </div>
      <AnalyticsCharts analytics={analytics} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Recent activity">
          <div className="space-y-4">
            {bookings.slice(0, 3).map((booking) => (
              <div key={booking.bookingId} className="rounded-3xl border border-kabisig-border bg-kabisig-bg/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-kabisig-text">{booking.serviceName}</p>
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
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-kabisig-orange">{complaint.createdAt}</p>
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
    </>
  );
}
