"use client";

import {
  adminAuditService,
  bookingService,
  bookingConflictService,
  categoryService,
  complaintService,
  getFirestore_,
  paymentService,
  providerService,
  userService,
  type AnalyticsSummary,
  type AdminAuditLog,
  type Booking,
  type BookingConflictHistory,
  type ComplaintReport,
  type Payment,
  type ProviderApplication,
  type ProviderProfile,
  type ServiceCategory,
  type User,
} from "@kabisig/shared";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";

export interface MarketplaceSnapshot {
  users: User[];
  providerProfiles: (ProviderProfile & { userId: string })[];
  pendingApplications: ProviderApplication[];
  bookings: Booking[];
  bookingConflicts: BookingConflictHistory[];
  payments: Payment[];
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

export async function loadMarketplaceAnalyticsSummary(): Promise<AnalyticsSummary> {
  const summary = await getDoc(doc(getFirestore_(), "analytics", "marketplace"));
  if (summary.exists()) {
    return summary.data() as AnalyticsSummary;
  }
  return (await loadMarketplaceSnapshot()).analytics;
}

export function subscribeMarketplaceAnalyticsSummary(
  callback: (analytics: AnalyticsSummary) => void
): () => void {
  return onSnapshot(doc(getFirestore_(), "analytics", "marketplace"), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as AnalyticsSummary);
      return;
    }

    callback(emptyAnalyticsSummary());
    void loadMarketplaceSnapshot().then((marketplaceSnapshot) => {
      callback(marketplaceSnapshot.analytics);
    });
  });
}

export async function loadMarketplaceSnapshot(): Promise<MarketplaceSnapshot> {
  const [users, providerProfiles, pendingApplications, bookings, bookingConflicts, payments, categories, complaints, auditLogs] =
    await Promise.all([
      userService.getAllUsers(),
      providerService.getAllProviderProfiles(),
      providerService.getPendingApplications(),
      bookingService.getAllBookings(),
      bookingConflictService.getProviderConflictHistory(""),
      paymentService.getAllPayments(),
      categoryService.getAllCategories(),
      complaintService.getAllComplaints(),
      adminAuditService.getAllAuditLogs(),
    ]);

  return {
    users,
    providerProfiles,
    pendingApplications,
    bookings,
    bookingConflicts,
    payments,
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
  let state: Omit<MarketplaceSnapshot, "analytics"> = {
    users: [],
    providerProfiles: [],
    pendingApplications: [],
    bookings: [],
    bookingConflicts: [],
    payments: [],
    categories: [],
    complaints: [],
    auditLogs: [],
  };

  const emit = () => {
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
  };

  const unsubscribers = [
    onSnapshot(collection(db, "users"), (snapshot) => {
      state = { ...state, users: snapshot.docs.map((entry) => entry.data() as User) };
      emit();
    }),
    onSnapshot(collection(db, "providerProfiles"), (snapshot) => {
      state = {
        ...state,
        providerProfiles: snapshot.docs.map((entry) => ({ ...(entry.data() as ProviderProfile), userId: entry.id })),
      };
      emit();
    }),
    onSnapshot(collection(db, "providerApplications"), (snapshot) => {
      const applications = snapshot.docs.map((entry) => entry.data() as ProviderApplication);
      state = {
        ...state,
        pendingApplications: applications.filter((application) => application.status === "Pending Approval"),
      };
      emit();
    }),
    onSnapshot(collection(db, "bookings"), (snapshot) => {
      state = { ...state, bookings: snapshot.docs.map((entry) => entry.data() as Booking) };
      emit();
    }),
    onSnapshot(collection(db, "bookingConflicts"), (snapshot) => {
      state = {
        ...state,
        bookingConflicts: snapshot.docs.map((entry) => entry.data() as BookingConflictHistory),
      };
      emit();
    }),
    onSnapshot(collection(db, "payments"), (snapshot) => {
      state = { ...state, payments: snapshot.docs.map((entry) => entry.data() as Payment) };
      emit();
    }),
    onSnapshot(collection(db, "serviceCategories"), () => {
      void categoryService.getAllCategories().then((categories) => {
        state = { ...state, categories };
        emit();
      });
    }),
    onSnapshot(collection(db, "complaints"), (snapshot) => {
      state = { ...state, complaints: snapshot.docs.map((entry) => entry.data() as ComplaintReport) };
      emit();
    }),
    onSnapshot(collection(db, "adminAuditLogs"), (snapshot) => {
      state = { ...state, auditLogs: snapshot.docs.map((entry) => entry.data() as AdminAuditLog) };
      emit();
    }),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
