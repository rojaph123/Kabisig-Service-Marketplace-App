"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalyticsCharts } from "../../../components/charts";
import { Card, DashboardStatCard, EmptyPanel, FilterBar, SearchInput, Select, Topbar } from "../../../components/ui";
import { subscribeMarketplaceAnalyticsSummary } from "../../../lib/marketplace-data";
import type { AnalyticsSummary } from "@kabisig/shared";

function downloadFile(fileName: string, mimeType: string, body: string) {
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [cityFilter, setCityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    return subscribeMarketplaceAnalyticsSummary(setAnalytics);
  }, []);

  const analyticsView = useMemo(() => {
    if (!analytics) return null;
    const byCity = cityFilter === "all"
      ? analytics.bookingsByCity
      : analytics.bookingsByCity.filter((item) => item.city === cityFilter);
    const byCategory = categoryFilter === "all"
      ? analytics.bookingsByCategory
      : analytics.bookingsByCategory.filter((item) => item.category === categoryFilter);
    return { ...analytics, bookingsByCity: byCity, bookingsByCategory: byCategory };
  }, [analytics, categoryFilter, cityFilter]);

  if (!analytics) {
    return (
      <>
        <Topbar title="Marketplace analytics" />
        <EmptyPanel title="Loading analytics" description="Loading the server-maintained marketplace summary." />
      </>
    );
  }

  const avgProviderRating = (analytics.avgProviderRating ?? 0).toFixed(1);
  const filteredAnalytics = analyticsView ?? analytics;

  return (
    <>
      <Topbar title="Marketplace analytics" />
      <FilterBar>
        <SearchInput placeholder="Analytics update live from marketplace data" />
        <Select label="Date Range" options={[{ label: "Live marketplace window", value: "live" }]} value="live" />
        <Select
          label="Category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          options={[
            { label: "All categories", value: "all" },
            ...analytics.bookingsByCategory.map((item) => ({ label: item.category, value: item.category })),
          ]}
        />
        <Select
          label="Location"
          value={cityFilter}
          onChange={(event) => setCityFilter(event.target.value)}
          options={[
            { label: "All cities", value: "all" },
            ...analytics.bookingsByCity.map((item) => ({ label: item.city, value: item.city })),
          ]}
        />
      </FilterBar>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardStatCard title="Active Bookings" value={filteredAnalytics.activeBookings.toString()} hint="Current operational load" />
        <DashboardStatCard title="Completed Bookings" value={filteredAnalytics.completedBookings.toString()} hint="Completed jobs from Firestore" />
        <DashboardStatCard title="Cancelled Bookings" value={filteredAnalytics.cancelledBookings.toString()} hint="Cancelled booking volume" />
        <DashboardStatCard title="Transactions" value={filteredAnalytics.totalTransactions.toString()} hint="Payment records in the marketplace" />
        <DashboardStatCard title="Complaints" value={filteredAnalytics.totalComplaints.toString()} hint="Issue monitoring by type" />
        <DashboardStatCard title="Avg Provider Rating" value={avgProviderRating} hint="Approved provider profile ratings" />
      </div>
      <AnalyticsCharts analytics={filteredAnalytics} />
      <Card
        title="Advanced KPI notes"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-2xl border border-kabisig-border px-4 py-2 text-sm font-bold text-kabisig-text"
              onClick={() => downloadFile("kabisig-analytics.json", "application/json", JSON.stringify(analytics, null, 2))}
            >
              Export JSON
            </button>
            <button
              className="rounded-2xl bg-kabisig-blue px-4 py-2 text-sm font-bold text-white"
              onClick={() =>
                downloadFile(
                  "kabisig-bookings-by-status.csv",
                  "text/csv;charset=utf-8",
                  ["status,value", ...analytics.bookingsByStatus.map((item) => `${JSON.stringify(item.status)},${item.value}`)].join("\n")
                )
              }
            >
              Export CSV
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-kabisig-bg p-4 text-sm text-kabisig-muted">Provider response time can be added next once messaging events and booking assignment timestamps are tracked.</div>
          <div className="rounded-3xl bg-kabisig-bg p-4 text-sm text-kabisig-muted">Location-based demand will sharpen once category coverage and geocoded booking coordinates are added.</div>
          <div className="rounded-3xl bg-kabisig-bg p-4 text-sm text-kabisig-muted">These charts and KPI cards now read a server-maintained analytics summary instead of scanning every marketplace collection.</div>
          <div className="rounded-3xl bg-kabisig-bg p-4 text-sm text-kabisig-muted">Bookings by city, category, and status are now available so operations can spot regional spikes, weak categories, and stalled jobs faster.</div>
        </div>
      </Card>
    </>
  );
}
