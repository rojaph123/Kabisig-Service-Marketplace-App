"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, DataTable, EmptyPanel, FilterBar, SearchInput, Select, StatusBadge, Topbar } from "../../../components/ui";
import { subscribeMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";

export default function PaymentsPage() {
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");

  useEffect(() => {
    return subscribeMarketplaceSnapshot(setSnapshot);
  }, []);

  const total = snapshot?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
  const userById = useMemo(
    () => new Map((snapshot?.users ?? []).map((user) => [user.id, user.fullName])),
    [snapshot]
  );
  const filteredPayments = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const payments = snapshot?.payments ?? [];
    return payments.filter((payment) =>
      (statusFilter === "all" || payment.status === statusFilter) &&
      (methodFilter === "all" || payment.method === methodFilter) &&
      (
        !normalized ||
        [
          payment.paymentId,
          payment.bookingId,
          payment.method,
          payment.status,
          userById.get(payment.customerId),
          userById.get(payment.providerId)
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      )
    );
  }, [methodFilter, search, snapshot?.payments, statusFilter, userById]);

  return (
    <>
      <Topbar title="Payments monitoring" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Total transactions">
          <p className="text-3xl font-black text-kabisig-text">{snapshot?.payments.length ?? 0}</p>
        </Card>
        <Card title="Settlement volume">
          <p className="text-3xl font-black text-kabisig-text">PHP {total.toLocaleString()}</p>
        </Card>
        <Card title="Paid transactions">
          <p className="text-3xl font-black text-kabisig-text">
            {snapshot?.payments.filter((payment) => payment.status === "Paid").length ?? 0}
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
            ...Array.from(new Set((snapshot?.payments ?? []).map((payment) => payment.status))).map((status) => ({
              label: status,
              value: status,
            })),
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
      </FilterBar>
      <Card title="Payment transactions">
        {filteredPayments.length ? (
          <DataTable
            columns={["Payment", "Customer", "Provider", "Method", "Amount", "Status"]}
            rows={filteredPayments.map((payment) => [
              <div key={payment.paymentId}>
                <p className="font-bold text-kabisig-text">{payment.paymentId}</p>
                <p className="mt-1 text-xs text-kabisig-muted">#{payment.bookingId.replace(/^booking-/, "")}</p>
              </div>,
              userById.get(payment.customerId) || payment.customerId,
              userById.get(payment.providerId) || payment.providerId,
              payment.method,
              `PHP ${payment.amount.toLocaleString()}`,
              <StatusBadge key={payment.paymentId} status={payment.status} />,
            ])}
          />
        ) : (
          <EmptyPanel title="No payments yet" description="Payment records from mobile bookings will appear here once transactions are created." />
        )}
      </Card>
    </>
  );
}
