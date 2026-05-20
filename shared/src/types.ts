export type UserRole = "customer" | "provider" | "admin";
export type AuthProvider = "email" | "google";
export type ProviderApprovalStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Rejected"
  | "Revision Requested";
export type BookingStatus =
  | "Pending"
  | "Accepted"
  | "On the Way"
  | "In Progress"
  | "Completed"
  | "Cancelled";
export type PaymentStatus = "Pending" | "Waiting for Completion" | "Paid" | "Cancelled" | "Refunded" | "Failed";
export type ComplaintStatus = "Open" | "Under Review" | "Resolved" | "Closed";
export type BookingChangeRequestType = "cancellation" | "reschedule";
export type BookingChangeRequestStatus = "Pending" | "Approved" | "Declined";
export type ProviderModerationStatus = "active" | "suspended" | "banned";
export type AuditActionType =
  | "provider_approved"
  | "provider_rejected"
  | "provider_revision_requested"
  | "provider_suspended"
  | "provider_banned"
  | "provider_unsuspended"
  | "category_created"
  | "category_updated"
  | "category_deleted"
  | "coverage_area_created"
  | "coverage_area_updated"
  | "coverage_area_deleted"
  | "booking_change_resolved"
  | "booking_status_changed"
  | "complaint_status_changed"
  | "announcement_broadcast"
  | "booking_conflict_logged"
  | "export_generated"
  | "storage_cleanup";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  authProvider: AuthProvider;
  fullName: string;
  phone?: string;
  profilePhoto?: string;
  appTheme?: "light" | "dark" | "system";
  termsAcceptedAt?: string;
  termsVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfile {
  userId: string;
  phone: string;
  addresses: string[];
  defaultLocation: string;
  pinpointLocation?: string;
  profilePhotoUrl?: string;
  savedProviderIds?: string[];
  notificationPreferences: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
}

export interface AvailabilitySchedule {
  day: string;
  start: string;
  end: string;
  available: boolean;
}

export interface UploadedDocument {
  id: string;
  label: string;
  url?: string;
  driveLink?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  storagePath?: string;
  uploadedAt?: string;
  status: "uploaded" | "pending" | "missing";
}

export interface MediaAttachment {
  id: string;
  url: string;
  storagePath?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  thumbnailUrl?: string;
  uploadedAt: string;
  uploadedBy?: string;
  kind: "image" | "video" | "file";
  deletedAt?: string;
  deletedBy?: string;
}

export interface ProviderPortfolioItem {
  portfolioItemId: string;
  providerId: string;
  title: string;
  description?: string;
  beforePhoto: MediaAttachment;
  afterPhoto: MediaAttachment;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleException {
  id: string;
  date: string;
  reason: string;
  unavailable: boolean;
  start?: string;
  end?: string;
  createdAt: string;
}

export interface ModerationState {
  status: ProviderModerationStatus;
  reason?: string;
  changedAt?: string;
  changedBy?: string;
}

export interface ProviderProfile {
  userId: string;
  displayName: string;
  businessName: string;
  profilePhotoUrl?: string;
  validIdUrl?: string;
  permitCertificateUrl?: string;
  sampleWorkUrls?: string[];
  sampleWorks?: MediaAttachment[];
  portfolio?: ProviderPortfolioItem[];
  birthday?: string;
  age?: number;
  phone: string;
  emergencyContact?: string;
  address: string;
  city: string;
  serviceAreas: string[];
  serviceCategories: string[];
  yearsExperience: number;
  hourlyRate?: number;
  bio: string;
  qualifications?: string;
  additionalDetails?: string;
  termsAcceptedAt?: string;
  rating: number;
  isApproved: boolean;
  approvalStatus: ProviderApprovalStatus;
  moderation?: ModerationState;
  availability: AvailabilitySchedule[];
  scheduleExceptions?: ScheduleException[];
  earningsSummary: {
    today: number;
    week: number;
    month: number;
  };
  documentsStatus: string;
}

export interface ProviderApplication {
  applicationId: string;
  userId: string;
  submittedAt: string;
  status: ProviderApprovalStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  documentUrls: UploadedDocument[];
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  iconColor?: string;
  description: string;
  startingPrice: number;
  active?: boolean;
}

export interface CoverageArea {
  id: string;
  name: string;
  active: boolean;
}

export interface BookingStatusHistory {
  bookingId: string;
  status: BookingStatus;
  changedAt: string;
  changedBy: string;
  note?: string;
}

export interface BookingConflictHistory {
  conflictId: string;
  providerId: string;
  bookingId?: string;
  requestedDate: string;
  requestedTime: string;
  conflictingBookingId?: string;
  conflictingScheduledAt?: string;
  createdAt: string;
  resolution: "rejected" | "reassigned" | "manual_override";
  reason?: string;
}

export interface BookingChangeRequest {
  requestId: string;
  bookingId: string;
  requestedBy: string;
  requestedByRole: "customer" | "provider";
  targetUserId: string;
  type: BookingChangeRequestType;
  status: BookingChangeRequestStatus;
  reason: string;
  currentScheduledAt?: string;
  requestedDate?: string;
  requestedTime?: string;
  requestedScheduledAt?: string;
  adminNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  bookingId: string;
  customerId: string;
  providerId: string;
  serviceCategoryId: string;
  serviceName: string;
  scheduledAt: string;
  scheduledDate?: string;
  scheduledTime?: string;
  address: string;
  location: string;
  notes: string;
  attachments?: string[];
  attachmentItems?: MediaAttachment[];
  status: BookingStatus;
  amount: number;
  workerAcceptedAt?: string;
  customerAcceptanceConfirmedAt?: string;
  customerAcceptanceConfirmedBy?: string;
  statusHistory?: BookingStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  paymentId: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface MessageThread {
  threadId: string;
  bookingId: string;
  participants: string[];
  lastMessage: string;
  lastMessageSenderId?: string;
  readBy?: Record<string, string>;
  archivedFor?: string[];
  pinnedFor?: string[];
  updatedAt: string;
}

export interface Message {
  messageId: string;
  threadId: string;
  senderId: string;
  text: string;
  attachments?: string[];
  attachmentItems?: MediaAttachment[];
  sentAt: string;
  readAt?: string;
  deliveredTo?: Record<string, string>;
  readBy?: Record<string, string>;
}

export interface Review {
  reviewId: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  rating: number;
  comment: string;
  createdAt: string;
  mediaUrls?: string[];
  mediaItems?: MediaAttachment[];
}

export interface NotificationItem {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  route?: string;
  createdAt: string;
  pushDeliveredAt?: string;
  pushTokenId?: string;
}

export interface CommunityPostComment {
  commentId: string;
  userId: string;
  body: string;
  attachments?: string[];
  attachmentItems?: MediaAttachment[];
  replies?: CommunityPostComment[];
  createdAt: string;
}

export interface CommunityPostPhotoEngagement {
  photoId: string;
  url: string;
  likes: string[];
  comments: CommunityPostComment[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunityPost {
  postId: string;
  customerId: string;
  serviceCategoryId: string;
  serviceName: string;
  body: string;
  address: string;
  location?: string;
  preferredSchedule?: string;
  attachments?: string[];
  attachmentItems?: MediaAttachment[];
  amount: number;
  status: "Open" | "Booked" | "Cancelled";
  claimedProviderId?: string;
  bookingId?: string;
  likes: string[];
  comments: CommunityPostComment[];
  photoEngagements?: CommunityPostPhotoEngagement[];
  createdAt: string;
  updatedAt: string;
}

export interface PushNotificationToken {
  tokenId: string;
  userId: string;
  token: string;
  platform: "ios" | "android" | "web";
  enabled: boolean;
  deviceName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLog {
  logId: string;
  actorId: string;
  actorRole: UserRole;
  action: AuditActionType;
  targetCollection: string;
  targetId: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface ComplaintReport {
  reportId: string;
  bookingId: string;
  submittedBy: string;
  targetUserId: string;
  type: string;
  description: string;
  status: ComplaintStatus;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalCustomers: number;
  totalProviders: number;
  pendingApprovals: number;
  activeBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalTransactions: number;
  revenueSummary: number;
  totalComplaints: number;
  avgProviderRating?: number;
  updatedAt?: string;
  bookingTrend: { label: string; bookings: number; revenue: number }[];
  growthTrend: { label: string; customers: number; providers: number }[];
  serviceDemand: { service: string; value: number }[];
  approvalDistribution: { status: string; value: number }[];
  bookingsByCity: { city: string; value: number }[];
  bookingsByCategory: { category: string; value: number }[];
  bookingsByStatus: { status: string; value: number }[];
}

export interface ProviderOnboardingForm {
  fullName: string;
  businessName: string;
  email: string;
  mobileNumber: string;
  birthday: string;
  age: string;
  address: string;
  cityCoverageArea: string;
  serviceCategoriesOffered: string[];
  yearsOfExperience: string;
  shortBio: string;
  qualifications: string;
  additionalDetails: string;
  profilePhotoDriveLink?: string;
  validIdDriveLink?: string;
  permitCertificateDriveLink?: string;
  sampleWorkUrls?: string[];
  emergencyContact: string;
  agreementAccepted: boolean;
  availability?: AvailabilitySchedule[];
}
