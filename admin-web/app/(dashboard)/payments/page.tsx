"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBookingReference, formatPaymentReference, formatReadableDateTime, type Booking, type Payment } from "@kabisig/shared";
import { Card, DataTable, EmptyPanel, FilterBar, SearchInput, Select, StatusBadge, Topbar } from "../../../components/ui";
import { downloadCsvReport, getSuspiciousPaymentReasons, logAdminAction, paymentRows } from "../../../lib/admin-actions";
import { useAdminAuth } from "../../../lib/auth-context";
import { subscribeMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";

function getEffectivePaymentStatus(payment: Payment, booking?: Booking | null) {
  if (booking?.status === "Cancelled" && (payment.status === "Pending" || payment.status === "Waiting for Completion" || payment.status === "Cancelled")) {
    return "No payment required";
  }
  if (payment.status === "Pending" && booking && booking.status !== "Completed") return "Waiting for Completion";
  return payment.status;
}

function matchesDateRange(value: string, range: string) {
  if (range === "all") return true;
  const createdAt = new Date(value);
  if (!Number.isFinite(createdAt.getTime())) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "today") return createdAt >= todayStart;

  if (range === "week") {
    const dayOfWeek = todayStart.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() + mondayOffset);
    return createdAt >= weekStart;
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return createdAt >= monthStart;
}

export default function PaymentsPage() {
  const { admin } = useAdminAuth();
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

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
  const total = snapshot?.payments.reduce((sum, payment) => {
    const status = getEffectivePaymentStatus(payment, bookingById.get(payment.bookingId));
    return status === "Paid" ? sum + payment.amount : sum;
  }, 0) ?? 0;
  const filteredPayments = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const payments = snapshot?.payments ?? [];
    return payments.filter((payment) => {
      const effectiveStatus = getEffectivePaymentStatus(payment, bookingById.get(payment.bookingId));
      return (
        (statusFilter === "all" || effectiveStatus === statusFilter) &&
        (methodFilter === "all" || payment.method === methodFilter) &&
        matchesDateRange(payment.createdAt, dateFilter) &&
        (
        !normalized ||
        [
          payment.paymentId,
          formatPaymentReference(payment),
          payment.bookingId,
          formatBookingReference(bookingById.get(payment.bookingId) || payment.bookingId),
          payment.method,
          effectiveStatus,
          userById.get(payment.customerId),
          userById.get(payment.providerId)
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
        )
      );
    });
  }, [bookingById, dateFilter, methodFilter, search, snapshot?.payments, statusFilter, userById]);
  const suspiciousPayments = useMemo(
    () =>
      (snapshot?.payments ?? [])
        .map((payment) => ({
          payment,
          reasons: getSuspiciousPaymentReasons(payment, bookingById.get(payment.bookingId)),
        }))
        .filter((item) => item.reasons.length),
    [bookingById, snapshot?.payments]
  );

  return (
    <>
      <Topbar
        title="Payments monitoring"
        action={
          <button
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white"
            onClick={() => {
              downloadCsvReport(`kabisig-payments-${new Date().toISOString().slice(0, 10)}.csv`, paymentRows(filteredPayments));
              void logAdminAction(admin, "export_generated", "payments", "payments-report", "Exported payments report.", {
                rows: filteredPayments.length,
              });
            }}
          >
            Export payments
          </button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Total transactions">
          <p className="text-3xl font-black text-kabisig-text">{snapshot?.payments.length ?? 0}</p>
        </Card>
        <Card title="Paid settlement volume">
          <p className="text-3xl font-black text-kabisig-text">PHP {total.toLocaleString()}</p>
        </Card>
        <Card title="Paid transactions">
          <p className="text-3xl font-black text-kabisig-text">
            {snapshot?.payments.filter((payment) => getEffectivePaymentStatus(payment, bookingById.get(payment.bookingId)) === "Paid").length ?? 0}
          </p>
        </Card>
      </div>
      <FilterBar>
        <SearchInput placeholder="Search payment or booking..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select
          label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={[
            { label: "All statuses", value: "all" },
            { label: "Pending", value: "Pending" },
            { label: "Waiting for Completion", value: "Waiting for Completion" },
            { label: "Paid", value: "Paid" },
            { label: "Cancelled", value: "Cancelled" },
            { label: "Refunded", value: "Refunded" },
            { label: "No payment required", value: "No payment required" },
          ]}
        />
        <Select
          label="Method"
          value={methodFilter}
          onChange={(event) => setMethodFilter(event.target.value)}
          options={[
            { label: "All methods", value: "all" },
            ...Array.from(new Set((snapshot?.payments ?? []).map((payment) => payment.method))).map((method) => ({
              label: method,
              value: method,
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
            { label: "This week", value: "week" },
            { label: "This month", value: "month" },
          ]}
        />
      </FilterBar>
      <Card title="Suspicious payment watchlist">
        {suspiciousPayments.length ? (
          <DataTable
            columns={["Payment", "Booking", "Amount", "Status", "Reason"]}
            rows={suspiciousPayments.slice(0, 12).map(({ payment, reasons }) => {
              const effectiveStatus = getEffectivePaymentStatus(payment, bookingById.get(payment.bookingId));
              return [
                formatPaymentReference(payment),
                formatBookingReference(bookingById.get(payment.bookingId) || payment.bookingId),
                effectiveStatus === "No payment required" ? "No payment required" : `PHP ${payment.amount.toLocaleString()}`,
                <StatusBadge key={`${payment.paymentId}-status`} status={effectiveStatus} />,
                reasons.join(", "),
              ];
            })}
          />
        ) : (
          <EmptyPanel title="No suspicious payment records" description="Cancelled, underpaid, missing, or stale payment records will be highlighted here." />
        )}
      </Card>
      <Card title="Payment transactions">
        {filteredPayments.length ? (
          <DataTable
            columns={["Payment", "Customer", "Provider", "Method", "Amount", "Recorded", "Status"]}
            rows={filteredPayments.map((payment) => {
              const effectiveStatus = getEffectivePaymentStatus(payment, bookingById.get(payment.bookingId));
              return [
                <div key={payment.paymentId}>
                  <p className="font-bold text-kabisig-text">{formatPaymentReference(payment)}</p>
                  <p className="mt-1 text-xs text-kabisig-muted">{formatBookingReference(bookingById.get(payment.bookingId) || payment.bookingId)}</p>
                </div>,
                userById.get(payment.customerId) || payment.customerId,
                userById.get(payment.providerId) || payment.providerId,
                payment.method,
                effectiveStatus === "No payment required" ? "No payment required" : `PHP ${payment.amount.toLocaleString()}`,
                formatReadableDateTime(payment.createdAt),
                <StatusBadge key={payment.paymentId} status={effectiveStatus} />,
              ];
            })}
          />
        ) : (
          <EmptyPanel title="No payments yet" description="Payment records from mobile bookings will appear here once transactions are created." />
        )}
      </Card>
    </>
  );
}
