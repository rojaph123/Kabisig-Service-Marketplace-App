import type { BookingStatus, ComplaintStatus, PaymentStatus, ProviderApprovalStatus } from "@kabisig/shared";
import { theme } from "../theme";

export function getStatusColor(status: BookingStatus | PaymentStatus | ComplaintStatus | ProviderApprovalStatus | "No payment required") {
  if (status === "Approved") {
    return "#2563EB";
  }
  if (status === "Completed" || status === "Paid" || status === "Resolved") {
    return theme.colors.success;
  }
  if (status === "Accepted") {
    return "#2563EB";
  }
  if (status === "On the Way") {
    return "#0EA5E9";
  }
  if (status === "In Progress") {
    return "#4F46E5";
  }
  if (status === "Waiting for Completion") {
    return "#0EA5E9";
  }
  if (status === "Pending" || status === "Pending Approval" || status === "Under Review") {
    return theme.colors.warning;
  }
  if (status === "Revision Requested") {
    return "#8B5CF6";
  }
  if (status === "Rejected" || status === "Cancelled" || status === "Failed" || status === "Closed") {
    return theme.colors.danger;
  }
  if (status === "No payment required") {
    return theme.colors.textMuted;
  }
  return theme.colors.info;
}
