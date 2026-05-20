"use client";

import { useEffect, useState } from "react";
import { complaintService, formatBookingReference, type ComplaintReport } from "@kabisig/shared";
import { Card, DataTable, EmptyPanel, FilterBar, SearchInput, Select, StatusBadge, Topbar } from "../../../components/ui";
import { complaintRows, downloadCsvReport, logAdminAction } from "../../../lib/admin-actions";
import { useAdminAuth } from "../../../lib/auth-context";
import { subscribeMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";

export default function ReportsPage() {
  const { admin } = useAdminAuth();
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeMarketplaceSnapshot(setSnapshot);
  }, []);

  const complaints = snapshot?.complaints ?? [];
  const bookingById = new Map((snapshot?.bookings ?? []).map((booking) => [booking.bookingId, booking]));

  const filteredComplaints = complaints.filter((complaint) =>
    (statusFilter === "all" || complaint.status === statusFilter) &&
    (typeFilter === "all" || complaint.type === typeFilter) &&
    [complaint.reportId, complaint.bookingId, formatBookingReference(bookingById.get(complaint.bookingId) || complaint.bookingId), complaint.type, complaint.description, complaint.status]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  async function updateStatus(reportId: string, status: ComplaintReport["status"]) {
    const complaint = complaints.find((item) => item.reportId === reportId);
    setUpdatingId(reportId);
    try {
      await complaintService.updateComplaintStatus(reportId, status);
      await logAdminAction(
        admin,
        "complaint_status_changed",
        "complaints",
        reportId,
        `Complaint ${reportId} changed to ${status}.`,
        { previousStatus: complaint?.status || null, nextStatus: status, bookingId: complaint?.bookingId || null }
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <>
      <Topbar
        title="Reports and complaints"
        action={
          <button
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white"
            onClick={() => {
              downloadCsvReport(`kabisig-complaints-${new Date().toISOString().slice(0, 10)}.csv`, complaintRows(filteredComplaints));
              void logAdminAction(admin, "export_generated", "complaints", "complaints-report", "Exported complaints report.", {
                rows: filteredComplaints.length,
              });
            }}
          >
            Export complaints
          </button>
        }
      />
      <FilterBar>
        <SearchInput placeholder="Search complaint or booking..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select
          label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={[
            { label: "All statuses", value: "all" },
            ...Array.from(new Set(complaints.map((complaint) => complaint.status))).map((status) => ({
              label: status,
              value: status,
            })),
          ]}
        />
        <Select
          label="Type"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          options={[
            { label: "All types", value: "all" },
            ...Array.from(new Set(complaints.map((complaint) => complaint.type))).map((type) => ({
              label: type,
              value: type,
            })),
          ]}
        />
      </FilterBar>
      <Card title="Complaint reports">
        {filteredComplaints.length ? (
          <DataTable
            columns={["Report ID", "Booking", "Type", "Description", "Status", "Actions"]}
            rows={filteredComplaints.map((complaint) => [
              complaint.reportId,
              formatBookingReference(bookingById.get(complaint.bookingId) || complaint.bookingId),
              complaint.type,
              complaint.description,
              <StatusBadge key={complaint.reportId} status={complaint.status} />,
              <div key={`${complaint.reportId}-actions`} className="flex flex-wrap gap-2">
                {(["Under Review", "Resolved", "Closed"] as ComplaintReport["status"][]).map((status) => (
                  <button
                    key={status}
                    className="rounded-xl border border-kabisig-border px-3 py-2 text-xs font-bold text-kabisig-text disabled:opacity-50"
                    disabled={updatingId === complaint.reportId}
                    onClick={() => void updateStatus(complaint.reportId, status)}
                  >
                    {status}
                  </button>
                ))}
              </div>,
            ])}
          />
        ) : (
          <EmptyPanel
            title="No complaints submitted"
            description="Complaint reports created from live bookings will appear here for admin review."
          />
        )}
      </Card>
    </>
  );
}
