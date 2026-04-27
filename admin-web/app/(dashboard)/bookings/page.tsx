"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, DataTable, EmptyPanel, FilterBar, SearchInput, Select, StatusBadge, Topbar } from "../../../components/ui";
import { subscribeMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";

export default function BookingsPage() {
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  useEffect(() => {
    return subscribeMarketplaceSnapshot(setSnapshot);
  }, []);

  const userById = useMemo(
    () => new Map((snapshot?.users ?? []).map((user) => [user.id, user.fullName])),
    [snapshot]
  );

  const filteredBookings = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const bookings = snapshot?.bookings ?? [];
    return bookings.filter((booking) => {
      const matchesSearch =
        !normalized ||
        [
          booking.bookingId,
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
            columns={["Booking", "Customer", "Provider", "Schedule", "Amount", "Status"]}
            rows={filteredBookings.map((booking) => [
              <div key={booking.bookingId}>
                <p className="font-bold text-kabisig-text">#{booking.bookingId.replace(/^booking-/, "")}</p>
                <p className="mt-1 text-xs text-kabisig-muted">{booking.serviceName}</p>
              </div>,
              userById.get(booking.customerId) || booking.customerId,
              userById.get(booking.providerId) || booking.providerId,
              booking.scheduledAt,
              `PHP ${booking.amount.toLocaleString()}`,
              <StatusBadge key={booking.bookingId} status={booking.status} />,
            ])}
          />
        ) : (
          <EmptyPanel title="No bookings yet" description="Customer bookings created in the mobile app will appear here for admin monitoring." />
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
