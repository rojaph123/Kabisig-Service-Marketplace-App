"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBookingReference, formatPaymentReference, formatReadableDate, formatReadableDateTime, workerPaymentService, type Booking, type Payment, type WorkerCommissionBill } from "@kabisig/shared";
import { AdminNotice, Card, DataTable, EmptyPanel, FilterBar, LoadingPanel, SearchInput, Select, StatusBadge, Topbar } from "../../../components/ui";
import { downloadCsvReport, getSuspiciousPaymentReasons, logAdminAction, paymentRows } from "../../../lib/admin-actions";
import { useAdminAuth } from "../../../lib/auth-context";
import { loadMarketplaceSnapshot, subscribeMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";

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
  const [selectedProviderForBill, setSelectedProviderForBill] = useState("");
  const [billActionId, setBillActionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);

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
  const commissionBills = snapshot?.workerCommissionBills ?? [];
  const pendingCommissionReviews = useMemo(
    () => commissionBills.filter((bill) => bill.status === "Submitted").sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [commissionBills]
  );
  const unpaidCommissionBills = useMemo(
    () => commissionBills.filter((bill) => ["Pending", "Submitted", "Rejected", "Overdue"].includes(bill.status)),
    [commissionBills]
  );
  const overdueCommissionBills = useMemo(
    () => commissionBills.filter((bill) => bill.status === "Overdue"),
    [commissionBills]
  );
  const thisMonthCommissionRevenue = useMemo(() => {
    const now = new Date();
    return (snapshot?.adminRevenueRecords ?? [])
      .filter((record) => record.sourceType === "monthly_commission")
      .filter((record) => {
        const approvedAt = new Date(record.approvedAt || record.createdAt);
        return approvedAt.getFullYear() === now.getFullYear() && approvedAt.getMonth() === now.getMonth();
      })
      .reduce((sum, record) => sum + Number(record.amount || 0), 0);
  }, [snapshot?.adminRevenueRecords]);

  async function reloadSnapshot() {
    setSnapshot(await loadMarketplaceSnapshot());
  }

  async function handleCommissionReview(bill: WorkerCommissionBill, nextStatus: "Approved" | "Rejected") {
    const adminId = admin?.id;
    if (!adminId) return;
    const remarks = nextStatus === "Rejected"
      ? window.prompt("Add admin remarks for this rejection:", bill.adminRemarks || "")?.trim()
      : "";
    if (nextStatus === "Rejected" && !remarks) return;
    if (nextStatus === "Approved" && !window.confirm(`Approve ${bill.billId} for ${userById.get(bill.providerId) || bill.providerId}?`)) {
      return;
    }

    try {
      setBillActionId(`${nextStatus}-${bill.billId}`);
      await workerPaymentService.reviewCommissionPayment(bill.billId, adminId, nextStatus, remarks || undefined);
      await logAdminAction(
        admin,
        nextStatus === "Approved" ? "commission_payment_approved" : "commission_payment_rejected",
        "workerCommissionBills",
        bill.billId,
        `Commission payment ${nextStatus.toLowerCase()} from admin dashboard.`,
        { providerId: bill.providerId, amountDue: bill.amountDue }
      );
      setNotice({
        type: "success",
        title: nextStatus === "Approved" ? "Commission payment approved" : "Commission payment rejected",
        message: `${bill.billId} was ${nextStatus.toLowerCase()} and the worker record was refreshed.`
      });
      await reloadSnapshot();
    } catch (error) {
      setNotice({
        type: "error",
        title: "Could not review commission payment",
        message: error instanceof Error ? error.message : "Could not review this commission payment right now."
      });
    } finally {
      setBillActionId(null);
    }
  }

  async function handleManualGenerateBill() {
    if (!selectedProviderForBill || !admin?.id) return;
    try {
      setBillActionId(`generate-${selectedProviderForBill}`);
      await workerPaymentService.releaseCurrentCommissionBill(selectedProviderForBill);
      await logAdminAction(
        admin,
        "monthly_commission_bill_generated",
        "workerCommissionBills",
        selectedProviderForBill,
        "Manually triggered current commission bill generation from admin payments page.",
        { providerId: selectedProviderForBill }
      );
      setNotice({
        type: "success",
        title: "Commission bill refreshed",
        message: "The current commission bill was generated or refreshed for the selected worker."
      });
      await reloadSnapshot();
    } catch (error) {
      setNotice({
        type: "error",
        title: "Could not generate bill",
        message: error instanceof Error ? error.message : "Could not generate the current commission bill."
      });
    } finally {
      setBillActionId(null);
    }
  }

  if (!snapshot) {
    return (
      <>
        <Topbar title="Payments monitoring" />
        <LoadingPanel title="Loading payment data" description="Connecting customer payments, worker commission bills, and admin revenue records." />
      </>
    );
  }

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
      {notice ? <AdminNotice type={notice.type} title={notice.title} message={notice.message} onDismiss={() => setNotice(null)} /> : null}
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Commission reviews waiting">
          <p className="text-3xl font-black text-kabisig-text">{pendingCommissionReviews.length}</p>
        </Card>
        <Card title="Unpaid commission bills">
          <p className="text-3xl font-black text-kabisig-text">{unpaidCommissionBills.length}</p>
        </Card>
        <Card title="Overdue workers">
          <p className="text-3xl font-black text-kabisig-text">{overdueCommissionBills.length}</p>
        </Card>
        <Card title="This month commission revenue">
          <p className="text-3xl font-black text-kabisig-text">PHP {thisMonthCommissionRevenue.toLocaleString()}</p>
        </Card>
      </div>
      <Card title="Manual commission bill release">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <Select
            label="Worker"
            value={selectedProviderForBill}
            onChange={(event) => setSelectedProviderForBill(event.target.value)}
            options={[
              { label: "Select approved worker", value: "" },
              ...(snapshot?.providerProfiles ?? [])
                .filter((provider) => provider.isApproved)
                .sort((left, right) => left.displayName.localeCompare(right.displayName))
                .map((provider) => ({
                  label: `${provider.displayName} (${provider.userId})`,
                  value: provider.userId,
                })),
            ]}
          />
          <div className="flex items-end">
            <button
              className="w-full rounded-2xl bg-kabisig-blue px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!selectedProviderForBill || billActionId === `generate-${selectedProviderForBill}`}
              onClick={() => void handleManualGenerateBill()}
            >
              {billActionId === `generate-${selectedProviderForBill}` ? "Generating..." : "Generate current bill"}
            </button>
          </div>
        </div>
      </Card>
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
      <Card title="Commission review queue">
        {pendingCommissionReviews.length ? (
          <DataTable
            columns={["Worker", "Billing Month", "Amount", "Reference", "Payment Date", "Proof", "Action"]}
            rows={pendingCommissionReviews.map((bill) => {
              const busyApprove = billActionId === `Approved-${bill.billId}`;
              const busyReject = billActionId === `Rejected-${bill.billId}`;
              return [
                userById.get(bill.providerId) || bill.providerId,
                formatReadableDate(bill.cycleStart),
                `PHP ${Number(bill.amountDue || 0).toLocaleString()}`,
                bill.referenceNumber || "Missing reference",
                bill.paymentDate ? formatReadableDate(bill.paymentDate) : "Missing date",
                bill.proofImageUrl ? (
                  <a key={`${bill.billId}-proof`} href={bill.proofImageUrl} target="_blank" rel="noreferrer" className="font-bold text-kabisig-blue underline underline-offset-4">
                    Open proof
                  </a>
                ) : (
                  "No proof"
                ),
                <div key={`${bill.billId}-actions`} className="flex gap-2">
                  <button
                    className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busyApprove || busyReject}
                    onClick={() => void handleCommissionReview(bill, "Approved")}
                  >
                    {busyApprove ? "Approving..." : "Approve"}
                  </button>
                  <button
                    className="rounded-2xl bg-rose-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busyApprove || busyReject}
                    onClick={() => void handleCommissionReview(bill, "Rejected")}
                  >
                    {busyReject ? "Rejecting..." : "Reject"}
                  </button>
                </div>,
              ];
            })}
          />
        ) : (
          <EmptyPanel title="No submitted commission proofs" description="Worker proof submissions waiting for admin review will appear here." />
        )}
      </Card>
      <Card title="Commission billing overview">
        {commissionBills.length ? (
          <DataTable
            columns={["Worker", "Month", "Income", "Amount Due", "Due Date", "Status"]}
            rows={commissionBills
              .slice()
              .sort((left, right) => right.cycleEnd.localeCompare(left.cycleEnd))
              .slice(0, 16)
              .map((bill) => [
                userById.get(bill.providerId) || bill.providerId,
                formatReadableDate(bill.cycleStart),
                `PHP ${Number(bill.totalIncome || 0).toLocaleString()}`,
                `PHP ${Number(bill.amountDue || 0).toLocaleString()}`,
                formatReadableDate(bill.dueDate),
                <StatusBadge key={bill.billId} status={bill.status} />,
              ])}
          />
        ) : (
          <EmptyPanel title="No commission bills yet" description="Official worker commission billing records will appear here after generation." />
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
