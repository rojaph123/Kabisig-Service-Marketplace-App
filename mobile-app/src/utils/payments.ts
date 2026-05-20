import type { Booking, Payment, PaymentStatus } from "@kabisig/shared";

export type EffectivePaymentStatus = PaymentStatus | "No payment required";

export function getEffectivePaymentStatus(payment: Payment, booking?: Booking | null): EffectivePaymentStatus {
  if (booking?.status === "Cancelled" && (payment.status === "Pending" || payment.status === "Waiting for Completion" || payment.status === "Cancelled")) {
    return "No payment required";
  }
  if (payment.status === "Pending" && booking && booking.status !== "Completed") return "Waiting for Completion";
  return payment.status;
}

export function isPaymentInDateRange(payment: Payment, range: "all" | "today" | "week" | "month") {
  if (range === "all") return true;
  const createdAt = new Date(payment.createdAt);
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

export function paymentStatusNote(status: EffectivePaymentStatus) {
  if (status === "No payment required") return "This booking was cancelled, so no payment is required.";
  if (status === "Waiting for Completion") return "Payment will be confirmed after the worker completes the job.";
  if (status === "Pending") return "Payment record exists but is not yet finalized.";
  if (status === "Paid") return "Cash payment has been recorded for this booking.";
  if (status === "Refunded") return "Payment was returned or reversed.";
  if (status === "Cancelled") return "Payment was cancelled.";
  return "Payment needs review.";
}
