"use client";

import { useEffect, useMemo, useState } from "react";
import {
  bookingChangeRequestService,
  bookingService,
  formatBookingReference,
  formatReadableDateTime,
  notificationService,
  type Booking,
  type BookingChangeRequest,
} from "@kabisig/shared";
import { Card, DataTable, EmptyPanel, FilterBar, SearchInput, Select, StatusBadge, Topbar } from "../../../components/ui";
import { logAdminAction } from "../../../lib/admin-actions";
import { subscribeMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";
import { useAdminAuth } from "../../../lib/auth-context";

export default function BookingsPage() {
  const { admin } = useAdminAuth();
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
  const [adminNotesByRequestId, setAdminNotesByRequestId] = useState<Record<string, string>>({});

  useEffect(() => {
    return subscribeMarketplaceSnapshot(setSnapshot);
  }, []);

  const userById = useMemo(
    () => new Map((snapshot?.users ?? []).map((user) => [user.id, user.fullName])),
    [snapshot]
  );
  const bookingById = useMemo(
    () => new Map((snapshot?.bookings ?? []).map((booking) => [booking.bookingId, booking])),
    [snapshot?.bookings]
  );
  const changeRequests = useMemo(
    () => [...(snapshot?.bookingChangeRequests ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [snapshot?.bookingChangeRequests]
  );

  const filteredBookings = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const bookings = snapshot?.bookings ?? [];
    return bookings.filter((booking) => {
      const matchesSearch =
        !normalized ||
        [
          booking.bookingId,
          formatBookingReference(booking),
          booking.serviceName,
          booking.location,
          booking.status,
          userById.get(booking.customerId),
          userById.get(booking.providerId)
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || booking.serviceName === categoryFilter;
      const today = new Date().toISOString().slice(0, 10);
      const matchesDate =
        dateFilter === "all" ||
        (dateFilter === "today" && booking.scheduledDate === today) ||
        (dateFilter === "upcoming" && (booking.scheduledDate || "") >= today);
      return matchesSearch && matchesStatus && matchesCategory && matchesDate;
    });
  }, [categoryFilter, dateFilter, search, snapshot?.bookings, statusFilter, userById]);

  async function resolveChangeRequest(request: BookingChangeRequest, status: BookingChangeRequest["status"]) {
    setUpdatingRequestId(request.requestId);
    try {
      const adminNotes = adminNotesByRequestId[request.requestId]?.trim();
      await bookingChangeRequestService.updateRequestStatus(request.requestId, status, admin?.id || "admin", adminNotes);
      const booking = bookingById.get(request.bookingId);
      await Promise.all(
        [request.requestedBy, request.targetUserId].map((userId) =>
          notificationService.createNotification({
            userId,
            type: status === "Approved" ? "booking_change_approved" : "booking_change_declined",
            title: status === "Approved" ? "Booking change approved" : "Booking change declined",
            body: booking
              ? `${request.type === "reschedule" ? "Reschedule" : "Cancellation"} request for ${booking.serviceName} was ${status.toLowerCase()}.`
              : `Your booking ${request.type} request was ${status.toLowerCase()}.`,
            isRead: false,
            route: `/booking-detail?bookingId=${request.bookingId}`,
            createdAt: new Date().toISOString(),
          })
        )
      );
      await logAdminAction(
        admin,
        "booking_change_resolved",
        "bookingChangeRequests",
        request.requestId,
        `${request.type} request was ${status.toLowerCase()} for ${booking ? formatBookingReference(booking) : request.bookingId}.`,
        {
          bookingId: request.bookingId,
          requestType: request.type,
          status,
          requestedByRole: request.requestedByRole,
        }
      );
    } finally {
      setUpdatingRequestId(null);
    }
  }

  async function updateBookingStatus(booking: Booking, status: Booking["status"]) {
    if (booking.status === status) return;
    setUpdatingBookingId(booking.bookingId);
    try {
      await bookingService.updateBooking(booking.bookingId, { status });
      await Promise.all(
        [booking.customerId, booking.providerId].map((userId) =>
          notificationService.createNotification({
            userId,
            type: "admin_booking_status_changed",
            title: "Booking status updated by admin",
            body: `${booking.serviceName} is now marked as ${status}.`,
            isRead: false,
            route: `/booking-detail?bookingId=${booking.bookingId}`,
            createdAt: new Date().toISOString(),
          })
        )
      );
      await logAdminAction(
        admin,
        "booking_status_changed",
        "bookings",
        booking.bookingId,
        `${formatBookingReference(booking)} changed from ${booking.status} to ${status}.`,
        { previousStatus: booking.status, nextStatus: status }
      );
    } finally {
      setUpdatingBookingId(null);
    }
  }

  return (
    <>
      <Topbar title="Bookings management" />
      <FilterBar>
        <SearchInput placeholder="Search booking, provider, or customer..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select
          label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={[
            { label: "All statuses", value: "all" },
            ...Array.from(new Set((snapshot?.bookings ?? []).map((booking) => booking.status))).map((status) => ({
              label: status,
              value: status,
            })),
          ]}
        />
        <Select
          label="Category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          options={[
            { label: "All categories", value: "all" },
            ...Array.from(new Set((snapshot?.bookings ?? []).map((booking) => booking.serviceName))).map((serviceName) => ({
              label: serviceName,
              value: serviceName,
            })),
          ]}
        />
        <Select
          label="Date"
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
          options={[
            { label: "All time", value: "all" },
            { label: "Today", value: "today" },
            { label: "Upcoming", value: "upcoming" },
          ]}
        />
      </FilterBar>
      <Card title="All bookings">
        {filteredBookings.length ? (
          <DataTable
            columns={["Booking", "Customer", "Provider", "Schedule", "Amount", "Status", "Admin status"]}
            rows={filteredBookings.map((booking) => [
              <div key={booking.bookingId}>
                <p className="font-bold text-kabisig-text">{formatBookingReference(booking)}</p>
                <p className="mt-1 text-xs text-kabisig-muted">{booking.serviceName}</p>
              </div>,
              userById.get(booking.customerId) || booking.customerId,
              userById.get(booking.providerId) || booking.providerId,
              booking.scheduledAt,
              `₱${booking.amount.toLocaleString()}`,
              <StatusBadge key={booking.bookingId} status={booking.status} />,
              <select
                key={`${booking.bookingId}-status-control`}
                value={booking.status}
                disabled={updatingBookingId === booking.bookingId}
                onChange={(event) => void updateBookingStatus(booking, event.target.value as Booking["status"])}
                className="rounded-xl border border-kabisig-border bg-white px-3 py-2 text-xs font-bold text-kabisig-text dark:bg-slate-950/70"
              >
                {(["Pending", "Accepted", "On the Way", "In Progress", "Completed", "Cancelled"] as Booking["status"][]).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>,
            ])}
          />
        ) : (
          <EmptyPanel title="No bookings yet" description="Customer bookings created in the mobile app will appear here for admin monitoring." />
        )}
      </Card>
      <Card title="Cancellation and reschedule requests">
        {changeRequests.length ? (
          <DataTable
            columns={["Request", "Booking", "Requested by", "Reason", "Requested schedule", "Status", "Actions"]}
            rows={changeRequests.slice(0, 20).map((request) => {
              const booking = bookingById.get(request.bookingId);
              const requestedByName = userById.get(request.requestedBy) || request.requestedByRole;
              const targetName = userById.get(request.targetUserId) || "Other party";
              return [
                <div key={`${request.requestId}-type`}>
                  <p className="font-bold capitalize text-kabisig-text">{request.type}</p>
                  <p className="mt-1 text-xs text-kabisig-muted">{formatReadableDateTime(request.createdAt)}</p>
                </div>,
                booking ? formatBookingReference(booking) : request.bookingId,
                <div key={`${request.requestId}-requester`}>
                  <p className="font-bold text-kabisig-text">{requestedByName}</p>
                  <p className="mt-1 text-xs text-kabisig-muted">Review with {targetName}</p>
                </div>,
                <div key={`${request.requestId}-reason`}>
                  <p className="text-sm text-kabisig-text">{request.reason}</p>
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                    Admin approval is the final record when customer and provider need a clear decision.
                  </p>
                  {request.status === "Pending" ? (
                    <input
                      value={adminNotesByRequestId[request.requestId] || ""}
                      onChange={(event) => setAdminNotesByRequestId((current) => ({ ...current, [request.requestId]: event.target.value }))}
                      placeholder="Optional admin note"
                      className="mt-2 w-full rounded-xl border border-kabisig-border bg-white px-3 py-2 text-xs text-kabisig-text outline-none dark:bg-slate-950/70"
                    />
                  ) : request.adminNotes ? (
                    <p className="mt-2 text-xs font-semibold text-kabisig-muted">Admin note: {request.adminNotes}</p>
                  ) : null}
                </div>,
                request.requestedScheduledAt || request.currentScheduledAt || "No schedule change",
                <StatusBadge key={`${request.requestId}-status`} status={request.status} />,
                request.status === "Pending" ? (
                  <div key={`${request.requestId}-actions`} className="flex flex-wrap gap-2">
                    <button
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50"
                      disabled={updatingRequestId === request.requestId}
                      onClick={() => void resolveChangeRequest(request, "Approved")}
                    >
                      Approve
                    </button>
                    <button
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"
                      disabled={updatingRequestId === request.requestId}
                      onClick={() => void resolveChangeRequest(request, "Declined")}
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <span key={`${request.requestId}-resolved`} className="text-xs font-bold text-kabisig-muted">
                    Resolved
                  </span>
                ),
              ];
            })}
          />
        ) : (
          <EmptyPanel title="No change requests yet" description="Cancellation and reschedule requests from customers or providers will appear here for admin monitoring." />
        )}
      </Card>
      <Card title="Booking conflict history">
        {snapshot?.bookingConflicts.length ? (
          <DataTable
            columns={["Provider", "Requested date", "Requested time", "Resolution", "Reason"]}
            rows={snapshot.bookingConflicts.slice(0, 12).map((conflict) => [
              userById.get(conflict.providerId) || conflict.providerId,
              conflict.requestedDate,
              conflict.requestedTime,
              conflict.resolution,
              conflict.reason || "No extra note",
            ])}
          />
        ) : (
          <EmptyPanel title="No booking conflicts logged" description="If two people attempt to reserve the same provider slot, the conflict record will appear here." />
        )}
      </Card>
    </>
  );
}
