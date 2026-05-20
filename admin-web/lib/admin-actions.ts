"use client";

import {
  adminAuditService,
  type AdminAuditLog,
  type AuditActionType,
  type Booking,
  type ComplaintReport,
  type Payment,
  type ProviderProfile,
} from "@kabisig/shared";

type ExportRow = Record<string, string | number | boolean | null | undefined>;
type AdminActor = { id: string; role: "admin" } | null | undefined;

function quoteCsvValue(value: string | number | boolean | null | undefined) {
  return JSON.stringify(value ?? "");
}

export function downloadClientFile(fileName: string, mimeType: string, body: string) {
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsvReport(fileName: string, rows: ExportRow[]) {
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  const body = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => quoteCsvValue(row[header])).join(",")),
  ].join("\n");
  downloadClientFile(fileName, "text/csv;charset=utf-8", body);
}

export async function logAdminAction(
  admin: AdminActor,
  action: AuditActionType,
  targetCollection: string,
  targetId: string,
  summary: string,
  metadata: AdminAuditLog["metadata"] = {}
) {
  await adminAuditService.logAction({
    actorId: admin?.id || "admin",
    actorRole: "admin",
    action,
    targetCollection,
    targetId,
    summary,
    metadata,
  });
}

export function getSuspiciousPaymentReasons(payment: Payment, booking?: Booking | null) {
  const reasons: string[] = [];
  if (!booking) {
    reasons.push("Booking record missing");
    return reasons;
  }
  if (booking.status === "Cancelled" && (payment.status === "Pending" || payment.status === "Waiting for Completion")) {
    reasons.push("Open payment on cancelled booking");
  }
  if (booking.status === "Cancelled" && payment.status === "Paid") {
    reasons.push("Paid payment on cancelled booking");
  }
  if (booking.status === "Completed" && payment.status === "Pending") {
    reasons.push("Completed booking still has pending payment");
  }
  if (payment.status === "Paid" && payment.amount < booking.amount) {
    reasons.push("Paid amount is below booking starting amount");
  }
  if (payment.amount <= 0) {
    reasons.push("Amount is zero or below");
  }
  return reasons;
}

export function bookingRows(bookings: Booking[]): ExportRow[] {
  return bookings.map((booking) => ({
    bookingId: booking.bookingId,
    customerId: booking.customerId,
    providerId: booking.providerId,
    serviceName: booking.serviceName,
    scheduledAt: booking.scheduledAt,
    status: booking.status,
    amount: booking.amount,
    address: booking.address,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  }));
}

export function paymentRows(payments: Payment[]): ExportRow[] {
  return payments.map((payment) => ({
    paymentId: payment.paymentId,
    bookingId: payment.bookingId,
    customerId: payment.customerId,
    providerId: payment.providerId,
    method: payment.method,
    amount: payment.amount,
    status: payment.status,
    createdAt: payment.createdAt,
  }));
}

export function providerRows(providers: (ProviderProfile & { userId: string })[]): ExportRow[] {
  return providers.map((provider) => ({
    userId: provider.userId,
    displayName: provider.displayName,
    businessName: provider.businessName,
    approvalStatus: provider.approvalStatus,
    isApproved: provider.isApproved,
    serviceAreas: provider.serviceAreas.join("; "),
    serviceCategories: provider.serviceCategories.join("; "),
    rating: provider.rating,
    documentsStatus: provider.documentsStatus,
  }));
}

export function complaintRows(complaints: ComplaintReport[]): ExportRow[] {
  return complaints.map((complaint) => ({
    reportId: complaint.reportId,
    bookingId: complaint.bookingId,
    submittedBy: complaint.submittedBy,
    targetUserId: complaint.targetUserId,
    type: complaint.type,
    description: complaint.description,
    status: complaint.status,
    createdAt: complaint.createdAt,
  }));
}
