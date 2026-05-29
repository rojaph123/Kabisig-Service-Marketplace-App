"use client";

import {
  adminAuditService,
  bookingService,
  bookingConflictService,
  bookingChangeRequestService,
  complaintService,
  getFirestore_,
  marketplaceConfigService,
  paymentService,
  providerService,
  userService,
  workerPaymentService,
  type AnalyticsSummary,
  type AdminAuditLog,
  type Booking,
  type BookingChangeRequest,
  type BookingConflictHistory,
  type ComplaintReport,
  type Payment,
  type ProviderApplication,
  type ProviderProfile,
  type ServiceCategory,
  type User,
  type AdminRevenueRecord,
  type WorkerCommissionBill,
  type WorkerRegistrationPayment,
} from "@kabisig/shared";
import { collection, doc, getDoc, getDocs, onSnapshot, type QuerySnapshot } from "firebase/firestore";

export interface MarketplaceSnapshot {
  users: User[];
  providerProfiles: (ProviderProfile & { userId: string })[];
  pendingApplications: ProviderApplication[];
  bookings: Booking[];
  bookingConflicts: BookingConflictHistory[];
  bookingChangeRequests: BookingChangeRequest[];
  payments: Payment[];
  workerRegistrationPayments: WorkerRegistrationPayment[];
  workerCommissionBills: WorkerCommissionBill[];
  adminRevenueRecords: AdminRevenueRecord[];
  categories: ServiceCategory[];
  complaints: ComplaintReport[];
  auditLogs: AdminAuditLog[];
  analytics: AnalyticsSummary;
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
}

function lastSixMonths() {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index), 1);
    return date;
  });
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function sameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

function buildAnalyticsSummary(
  users: User[],
  providerProfiles: (ProviderProfile & { userId: string })[],
  pendingApplications: ProviderApplication[],
  bookings: Booking[],
  payments: Payment[],
  complaints: ComplaintReport[]
): AnalyticsSummary {
  const activeStatuses = new Set(["Pending", "Accepted", "On the Way", "In Progress"]);
  const bookingTrend = lastSevenDays().map((date) => {
    const dayBookings = bookings.filter((booking) => sameDay(new Date(booking.createdAt), date));
    return {
      label: formatDayLabel(date),
      bookings: dayBookings.length,
      revenue: dayBookings.reduce((sum, booking) => sum + booking.amount, 0),
    };
  });

  const growthTrend = lastSixMonths().map((date) => ({
    label: formatMonthLabel(date),
    customers: users.filter(
      (user) => user.role === "customer" && sameMonth(new Date(user.createdAt), date)
    ).length,
    providers: users.filter(
      (user) => user.role === "provider" && sameMonth(new Date(user.createdAt), date)
    ).length,
  }));

  const serviceDemandMap = bookings.reduce<Map<string, number>>((map, booking) => {
    map.set(booking.serviceName, (map.get(booking.serviceName) ?? 0) + 1);
    return map;
  }, new Map());

  const serviceDemand = Array.from(serviceDemandMap.entries())
    .map(([service, value]) => ({ service, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);

  const approvalMap = providerProfiles.reduce<Map<string, number>>((map, profile) => {
    map.set(profile.approvalStatus, (map.get(profile.approvalStatus) ?? 0) + 1);
    return map;
  }, new Map());

  const approvalDistribution = Array.from(approvalMap.entries()).map(([status, value]) => ({
    status,
    value,
  }));

  const bookingsByCityMap = bookings.reduce<Map<string, number>>((map, booking) => {
    const key = booking.address.split(",").slice(-1)[0]?.trim() || "Unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());

  const bookingsByCategoryMap = bookings.reduce<Map<string, number>>((map, booking) => {
    map.set(booking.serviceName, (map.get(booking.serviceName) ?? 0) + 1);
    return map;
  }, new Map());

  const bookingsByStatusMap = bookings.reduce<Map<string, number>>((map, booking) => {
    map.set(booking.status, (map.get(booking.status) ?? 0) + 1);
    return map;
  }, new Map());

  return {
    totalCustomers: users.filter((user) => user.role === "customer").length,
    totalProviders: users.filter((user) => user.role === "provider").length,
    pendingApprovals: pendingApplications.length,
    activeBookings: bookings.filter((booking) => activeStatuses.has(booking.status)).length,
    completedBookings: bookings.filter((booking) => booking.status === "Completed").length,
    cancelledBookings: bookings.filter((booking) => booking.status === "Cancelled").length,
    totalTransactions: payments.length,
    revenueSummary: payments.reduce((sum, payment) => sum + payment.amount, 0),
    totalComplaints: complaints.length,
    avgProviderRating: (() => {
      const approvedProviders = providerProfiles.filter((profile) => profile.isApproved);
      return approvedProviders.length
        ? approvedProviders.reduce((sum, profile) => sum + (profile.rating || 0), 0) / approvedProviders.length
        : 0;
    })(),
    bookingTrend,
    growthTrend,
    serviceDemand,
    approvalDistribution,
    bookingsByCity: Array.from(bookingsByCityMap.entries()).map(([city, value]) => ({ city, value })),
    bookingsByCategory: Array.from(bookingsByCategoryMap.entries()).map(([category, value]) => ({ category, value })),
    bookingsByStatus: Array.from(bookingsByStatusMap.entries()).map(([status, value]) => ({ status, value })),
  };
}

function emptyAnalyticsSummary(): AnalyticsSummary {
  return {
    totalCustomers: 0,
    totalProviders: 0,
    pendingApprovals: 0,
    activeBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    totalTransactions: 0,
    revenueSummary: 0,
    totalComplaints: 0,
    avgProviderRating: 0,
    updatedAt: new Date().toISOString(),
    bookingTrend: [],
    growthTrend: [],
    serviceDemand: [],
    approvalDistribution: [],
    bookingsByCity: [],
    bookingsByCategory: [],
    bookingsByStatus: [],
  };
}

function isPermissionDeniedError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("permission-denied") || message.includes("missing or insufficient permissions");
}

function handleAdminSnapshotError(label: string, error: unknown, onDenied?: () => void) {
  if (isPermissionDeniedError(error)) {
    onDenied?.();
    return;
  }

  console.error(`${label} listener error:`, error);
  onDenied?.();
}

async function ensureMarketplaceDefaultsSafely(label = "Marketplace defaults") {
  try {
    await marketplaceConfigService.ensureDefaultMarketplaceData();
  } catch (error) {
    handleAdminSnapshotError(label, error);
  }
}

async function loadAdminSection<T>(label: string, request: Promise<T>, fallback: T): Promise<T> {
  try {
    return await request;
  } catch (error) {
    handleAdminSnapshotError(label, error);
    return fallback;
  }
}

export async function loadConfiguredCategories(): Promise<ServiceCategory[]> {
  await ensureMarketplaceDefaultsSafely("Category defaults");
  return loadAdminSection("Configured categories", getDocs(collection(getFirestore_(), "serviceCategories")), {
    docs: [],
  } as unknown as Awaited<ReturnType<typeof getDocs>>).then((snapshot) =>
    snapshot.docs.map((entry) => entry.data() as ServiceCategory)
  );
}

export async function loadConfiguredCoverageAreas() {
  await ensureMarketplaceDefaultsSafely("Coverage area defaults");
  const snapshot = await loadAdminSection("Configured coverage areas", getDocs(collection(getFirestore_(), "coverageAreas")), {
    docs: [],
  } as unknown as Awaited<ReturnType<typeof getDocs>>);
  return snapshot.docs.map((entry) => entry.data() as { id: string; name: string; active: boolean });
}

export async function loadMarketplaceAnalyticsSummary(): Promise<AnalyticsSummary> {
  const summary = await loadAdminSection("Marketplace analytics document", getDoc(doc(getFirestore_(), "analytics", "marketplace")), null);
  if (summary?.exists()) {
    return summary.data() as AnalyticsSummary;
  }
  return (await loadMarketplaceSnapshot()).analytics;
}

export function subscribeMarketplaceAnalyticsSummary(
  callback: (analytics: AnalyticsSummary) => void
): () => void {
  return onSnapshot(
    doc(getFirestore_(), "analytics", "marketplace"),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as AnalyticsSummary);
        return;
      }

      callback(emptyAnalyticsSummary());
      void loadMarketplaceSnapshot()
        .then((marketplaceSnapshot) => {
          callback(marketplaceSnapshot.analytics);
        })
        .catch((error) => handleAdminSnapshotError("Marketplace analytics fallback", error));
    },
    (error) => handleAdminSnapshotError("Marketplace analytics", error, () => callback(emptyAnalyticsSummary()))
  );
}

export async function loadMarketplaceSnapshot(): Promise<MarketplaceSnapshot> {
  await ensureMarketplaceDefaultsSafely();
  const [users, providerProfiles, pendingApplications, bookings, bookingConflicts, bookingChangeRequests, payments, workerRegistrationPayments, workerCommissionBills, adminRevenueRecords, categories, complaints, auditLogs] =
    await Promise.all([
      loadAdminSection("Users", userService.getAllUsers(), []),
      loadAdminSection("Provider profiles", providerService.getAllProviderProfiles(), []),
      loadAdminSection("Provider applications", providerService.getPendingApplications(), []),
      loadAdminSection("Bookings", bookingService.getAllBookings(), []),
      loadAdminSection("Booking conflicts", bookingConflictService.getProviderConflictHistory(""), []),
      loadAdminSection("Booking change requests", bookingChangeRequestService.getAllRequests(), []),
      loadAdminSection("Payments", paymentService.getAllPayments(), []),
      loadAdminSection("Worker registration payments", workerPaymentService.getAllRegistrationPayments(), []),
      loadAdminSection("Worker commission bills", workerPaymentService.getAllCommissionBills(), []),
      loadAdminSection("Admin revenue records", workerPaymentService.getAllRevenueRecords(), []),
      loadConfiguredCategories(),
      loadAdminSection("Complaints", complaintService.getAllComplaints(), []),
      loadAdminSection("Admin audit logs", adminAuditService.getAllAuditLogs(), []),
    ]);

  return {
    users,
    providerProfiles,
    pendingApplications,
    bookings,
    bookingConflicts,
    bookingChangeRequests,
    payments,
    workerRegistrationPayments,
    workerCommissionBills,
    adminRevenueRecords,
    categories,
    complaints,
    auditLogs,
    analytics: buildAnalyticsSummary(
      users,
      providerProfiles,
      pendingApplications,
      bookings,
      payments,
      complaints
    ),
  };
}

export function subscribeMarketplaceSnapshot(
  callback: (snapshot: MarketplaceSnapshot) => void
): () => void {
  const db = getFirestore_();
  void marketplaceConfigService.ensureDefaultMarketplaceData().catch((error) => {
    handleAdminSnapshotError("Marketplace defaults", error);
  });
  let state: Omit<MarketplaceSnapshot, "analytics"> = {
    users: [],
    providerProfiles: [],
    pendingApplications: [],
    bookings: [],
    bookingConflicts: [],
    bookingChangeRequests: [],
    payments: [],
    workerRegistrationPayments: [],
    workerCommissionBills: [],
    adminRevenueRecords: [],
    categories: [],
    complaints: [],
    auditLogs: [],
  };

  const emit = () => {
    try {
      callback({
        ...state,
        analytics: buildAnalyticsSummary(
          state.users,
          state.providerProfiles,
          state.pendingApplications,
          state.bookings,
          state.payments,
          state.complaints
        ),
      });
    } catch (error) {
      handleAdminSnapshotError("Marketplace snapshot render", error);
    }
  };

  function listenCollection(
    collectionName: string,
    label: string,
    applySnapshot: (snapshot: QuerySnapshot) => Partial<Omit<MarketplaceSnapshot, "analytics">>,
    fallbackState: Partial<Omit<MarketplaceSnapshot, "analytics">>
  ) {
    return onSnapshot(
      collection(db, collectionName),
      (snapshot) => {
        try {
          state = { ...state, ...applySnapshot(snapshot) };
          emit();
        } catch (error) {
          handleAdminSnapshotError(`${label} data`, error, () => {
            state = { ...state, ...fallbackState };
            emit();
          });
        }
      },
      (error) =>
        handleAdminSnapshotError(label, error, () => {
          state = { ...state, ...fallbackState };
          emit();
        })
    );
  }

  const unsubscribers = [
    listenCollection("users", "Users", (snapshot) => ({ users: snapshot.docs.map((entry) => entry.data() as User) }), { users: [] }),
    listenCollection(
      "providerProfiles",
      "Provider profiles",
      (snapshot) => ({
        providerProfiles: snapshot.docs.map((entry) => ({ ...(entry.data() as ProviderProfile), userId: entry.id })),
      }),
      { providerProfiles: [] }
    ),
    listenCollection(
      "providerApplications",
      "Provider applications",
      (snapshot) => {
        const applications = snapshot.docs.map((entry) => entry.data() as ProviderApplication);
        return {
          pendingApplications: applications.filter((application) => application.status === "Pending Approval"),
        };
      },
      { pendingApplications: [] }
    ),
    listenCollection("bookings", "Bookings", (snapshot) => ({ bookings: snapshot.docs.map((entry) => entry.data() as Booking) }), { bookings: [] }),
    listenCollection(
      "bookingConflicts",
      "Booking conflicts",
      (snapshot) => ({ bookingConflicts: snapshot.docs.map((entry) => entry.data() as BookingConflictHistory) }),
      { bookingConflicts: [] }
    ),
    listenCollection(
      "bookingChangeRequests",
      "Booking change requests",
      (snapshot) => ({ bookingChangeRequests: snapshot.docs.map((entry) => entry.data() as BookingChangeRequest) }),
      { bookingChangeRequests: [] }
    ),
    listenCollection("payments", "Payments", (snapshot) => ({ payments: snapshot.docs.map((entry) => entry.data() as Payment) }), { payments: [] }),
    listenCollection(
      "workerRegistrationPayments",
      "Worker registration payments",
      (snapshot) => ({ workerRegistrationPayments: snapshot.docs.map((entry) => entry.data() as WorkerRegistrationPayment) }),
      { workerRegistrationPayments: [] }
    ),
    listenCollection(
      "workerCommissionBills",
      "Worker commission bills",
      (snapshot) => ({ workerCommissionBills: snapshot.docs.map((entry) => entry.data() as WorkerCommissionBill) }),
      { workerCommissionBills: [] }
    ),
    listenCollection(
      "adminRevenueRecords",
      "Admin revenue records",
      (snapshot) => ({ adminRevenueRecords: snapshot.docs.map((entry) => entry.data() as AdminRevenueRecord) }),
      { adminRevenueRecords: [] }
    ),
    onSnapshot(
      collection(db, "serviceCategories"),
      () => {
        void loadConfiguredCategories()
          .then((categories) => {
            state = { ...state, categories };
            emit();
          })
          .catch((error) => handleAdminSnapshotError("Service categories reload", error));
      },
      (error) =>
        handleAdminSnapshotError("Service categories", error, () => {
          state = { ...state, categories: [] };
          emit();
        })
    ),
    listenCollection("complaints", "Complaints", (snapshot) => ({ complaints: snapshot.docs.map((entry) => entry.data() as ComplaintReport) }), { complaints: [] }),
    listenCollection("adminAuditLogs", "Admin audit logs", (snapshot) => ({ auditLogs: snapshot.docs.map((entry) => entry.data() as AdminAuditLog) }), { auditLogs: [] }),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
