const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentDeleted, onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { randomUUID } = require("crypto");

admin.initializeApp();

const db = admin.firestore();
const webCallableOptions = { cors: true };

async function requireAdmin(context) {
  const auth = context.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const userSnap = await db.collection("users").doc(auth.uid).get();
  if (!userSnap.exists || userSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin privileges are required.");
  }

  return auth.uid;
}

async function isAdminUser(uid) {
  const userSnap = await db.collection("users").doc(uid).get();
  return userSnap.exists && userSnap.data()?.role === "admin";
}

function requireSignedIn(context) {
  const auth = context.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  return auth.uid;
}

async function createAuditLog(actorId, action, targetCollection, targetId, summary, metadata = {}) {
  const logId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await db.collection("adminAuditLogs").doc(logId).set({
    logId,
    actorId,
    actorRole: "admin",
    action,
    targetCollection,
    targetId,
    summary,
    metadata,
    createdAt: new Date().toISOString(),
  });
}

async function createNotification(userId, type, title, body, route = "/notifications") {
  const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await db.collection("notifications").doc(notificationId).set({
    notificationId,
    userId,
    type,
    title,
    body,
    route,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
}

function buildStorageDownloadUrl(bucketName, storagePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function buildBookingSlotId(providerId, scheduledDate, scheduledTime) {
  return `${providerId}_${scheduledDate}_${scheduledTime}`
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-");
}

function buildCustomerBookingSlotId(customerId, scheduledDate, scheduledTime) {
  return `${customerId}_${scheduledDate}_${scheduledTime}`
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-");
}

function shouldReleaseBookingSlot(status) {
  return status === "Cancelled" || status === "Completed";
}

function defaultWorkerPaymentSettings() {
  const now = new Date().toISOString();
  return {
    registrationFeeEnabled: true,
    registrationFeeAmount: 500,
    activeQrCodeUrl: null,
    activeQrCodePath: null,
    paymentMethodName: "GCash QR",
    paymentInstructions: "Scan the active QR code, pay the exact registration fee, then upload a clear payment screenshot with the reference number.",
    freeRegistrationPromoEnabled: false,
    freeRegistrationApprovedWorkerLimit: 50,
    approvedFreeRegistrationCount: 0,
    commissionEnabled: true,
    commissionPercentage: 10,
    freeBookingsGranted: 5,
    monthlyBillDueDay: 5,
    gracePeriodDays: 3,
    lateSurchargeRate: 5,
    billingCycle: "monthly",
    featureActivatedAt: now,
    updatedAt: now,
  };
}

function manilaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: get("year"),
    monthIndex: get("month") - 1,
    day: get("day"),
  };
}

function manilaDate(year, monthIndex, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
  return new Date(Date.UTC(year, monthIndex, day, hour - 8, minute, second, millisecond));
}

function manilaDayKey(date = new Date()) {
  const { year, monthIndex, day } = manilaDateParts(date);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function coerceBooleanSetting(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function coerceNumberSetting(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWorkerPaymentSettings(data = {}, defaults = defaultWorkerPaymentSettings()) {
  const merged = { ...defaults, ...data };
  return {
    ...merged,
    registrationFeeEnabled: coerceBooleanSetting(merged.registrationFeeEnabled, defaults.registrationFeeEnabled),
    registrationFeeAmount: Math.max(0, coerceNumberSetting(merged.registrationFeeAmount, defaults.registrationFeeAmount)),
    freeRegistrationPromoEnabled: coerceBooleanSetting(merged.freeRegistrationPromoEnabled, defaults.freeRegistrationPromoEnabled),
    freeRegistrationApprovedWorkerLimit: Math.max(0, coerceNumberSetting(merged.freeRegistrationApprovedWorkerLimit, defaults.freeRegistrationApprovedWorkerLimit)),
    approvedFreeRegistrationCount: Math.max(0, coerceNumberSetting(merged.approvedFreeRegistrationCount, defaults.approvedFreeRegistrationCount)),
    commissionEnabled: coerceBooleanSetting(merged.commissionEnabled, defaults.commissionEnabled),
    commissionPercentage: Math.max(0, coerceNumberSetting(merged.commissionPercentage, defaults.commissionPercentage)),
    freeBookingsGranted: Math.max(0, coerceNumberSetting(merged.freeBookingsGranted, defaults.freeBookingsGranted)),
    monthlyBillDueDay: Math.min(28, Math.max(1, coerceNumberSetting(merged.monthlyBillDueDay, defaults.monthlyBillDueDay))),
    gracePeriodDays: Math.max(0, coerceNumberSetting(merged.gracePeriodDays, defaults.gracePeriodDays)),
    lateSurchargeRate: Math.max(0, coerceNumberSetting(merged.lateSurchargeRate, defaults.lateSurchargeRate)),
    billingCycle: "monthly",
  };
}

async function getWorkerPaymentSettings() {
  const ref = db.collection("platformSettings").doc("workerPayments");
  const snap = await ref.get();
  const defaults = defaultWorkerPaymentSettings();
  if (snap.exists) return normalizeWorkerPaymentSettings(snap.data(), defaults);
  await ref.set(defaults, { merge: true });
  return defaults;
}

async function createWorkerFinanceSummary(providerId, overrides = {}) {
  const settings = await getWorkerPaymentSettings();
  const summary = {
    providerId,
    userId: providerId,
    registrationPaymentStatus: "Pending",
    totalFreeBookingsGranted: settings.freeBookingsGranted,
    freeBookingsUsed: 0,
    freeBookingsRemaining: settings.freeBookingsGranted,
    totalCompletedPaidBookings: 0,
    totalIncome: 0,
    totalCommissionableBookings: 0,
    totalCommissionPaid: 0,
    totalCommissionPending: 0,
    totalCommissionOverdue: 0,
    hasOverdueCommission: false,
    restrictedFromAcceptingBookings: false,
    featureActivatedAt: settings.featureActivatedAt,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  await db.collection("workerFinanceSummaries").doc(providerId).set(summary, { merge: true });
  await db.collection("providerProfiles").doc(providerId).set({
    financialStatus: {
      registrationPaymentStatus: summary.registrationPaymentStatus,
      freeBookingsGranted: summary.totalFreeBookingsGranted,
      freeBookingsUsed: summary.freeBookingsUsed,
      freeBookingsRemaining: summary.freeBookingsRemaining,
      restrictedFromAcceptingBookings: summary.restrictedFromAcceptingBookings,
      restrictionReason: summary.restrictionReason || "",
      hasOverdueCommission: summary.hasOverdueCommission,
      updatedAt: new Date().toISOString(),
    },
  }, { merge: true });
  return summary;
}

async function recomputeWorkerFinanceSummary(providerId) {
  const settings = await getWorkerPaymentSettings();
  const [bookingsSnap, paymentsSnap, billsSnap, registrationSnap, summarySnap] = await Promise.all([
    db.collection("bookings").where("providerId", "==", providerId).get(),
    db.collection("payments").where("providerId", "==", providerId).get(),
    db.collection("workerCommissionBills").where("providerId", "==", providerId).get(),
    db.collection("workerRegistrationPayments").where("providerId", "==", providerId).get(),
    db.collection("workerFinanceSummaries").doc(providerId).get(),
  ]);
  const bookings = bookingsSnap.docs.map((entry) => entry.data());
  const payments = paymentsSnap.docs.map((entry) => entry.data());
  const bills = billsSnap.docs.map((entry) => entry.data());
  const registration = registrationSnap.docs.map((entry) => entry.data()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const existingSummary = summarySnap.exists ? summarySnap.data() : null;
  const featureActivatedAt = existingSummary?.featureActivatedAt || settings.featureActivatedAt;
  const activationTime = new Date(featureActivatedAt).getTime();
  const paidByBookingId = new Map(payments.filter((payment) => payment.status === "Paid").map((payment) => [payment.bookingId, payment]));
  const completedPaid = bookings
    .filter((booking) => {
      const trackedAt = commissionBookingTime(booking).getTime();
      return isCommissionTrackedBooking(booking) && trackedAt >= activationTime;
    })
    .sort((a, b) => {
      const byDate = commissionBookingTime(a).getTime() - commissionBookingTime(b).getTime();
      return byDate || String(a.bookingId).localeCompare(String(b.bookingId));
    });
  const approvedBills = bills.filter((bill) => bill.status === "Approved");
  const pendingBills = bills.filter((bill) => ["Pending", "Submitted", "Rejected"].includes(bill.status));
  const overdueBills = bills.filter((bill) => bill.status === "Overdue");
  const freeUsed = Math.min(settings.freeBookingsGranted, completedPaid.length);
  const totalIncome = completedPaid.reduce((sum, booking) => sum + Number(paidByBookingId.get(booking.bookingId)?.amount ?? booking.amount ?? 0), 0);
  return createWorkerFinanceSummary(providerId, {
    registrationPaymentStatus: registration?.status || "Waived",
    registrationPaymentId: registration?.paymentId,
    freeBookingsUsed: freeUsed,
    freeBookingsRemaining: Math.max(0, settings.freeBookingsGranted - freeUsed),
    totalCompletedPaidBookings: completedPaid.length,
    totalIncome,
    totalCommissionableBookings: Math.max(0, completedPaid.length - settings.freeBookingsGranted),
    totalCommissionPaid: approvedBills.reduce((sum, bill) => sum + Number(bill.amountDue || 0), 0),
    totalCommissionPending: pendingBills.reduce((sum, bill) => sum + Number(bill.amountDue || 0), 0),
    totalCommissionOverdue: overdueBills.reduce((sum, bill) => sum + Number(bill.amountDue || 0), 0),
    hasOverdueCommission: overdueBills.length > 0,
    restrictedFromAcceptingBookings: overdueBills.length > 0,
    restrictionReason: overdueBills.length ? "Your monthly 10% admin payment is overdue. Please settle it first before accepting or matching new bookings." : "",
    restrictedSince: overdueBills.length ? overdueBills[0].graceEndsAt : "",
    restrictionLiftedAt: overdueBills.length ? "" : new Date().toISOString(),
    lastBillId: bills.sort((a, b) => String(b.cycleEnd).localeCompare(String(a.cycleEnd)))[0]?.billId,
    featureActivatedAt,
  });
}

function commissionBookingTime(booking) {
  return new Date(booking.workerAcceptedAt || booking.updatedAt || booking.createdAt || Date.now());
}

function isCommissionTrackedBooking(booking) {
  return ["Accepted", "On the Way", "In Progress", "Completed"].includes(booking.status);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function applyCommissionSurcharge(baseCommissionAmount, graceEndsAt, lateSurchargeRate, now = new Date()) {
  const normalizedBase = roundMoney(baseCommissionAmount);
  if (normalizedBase <= 0 || !graceEndsAt || new Date(graceEndsAt).getTime() >= now.getTime()) {
    return {
      baseCommissionAmount: normalizedBase,
      surchargeRateApplied: 0,
      surchargeDaysApplied: 0,
      surchargeAmount: 0,
      amountDue: normalizedBase,
    };
  }

  const normalizedRate = Math.max(0, Number(lateSurchargeRate || 0));
  const dayMs = 24 * 60 * 60 * 1000;
  const overdueDays = Math.max(1, Math.ceil((now.getTime() - new Date(graceEndsAt).getTime()) / dayMs));
  const surchargeAmount = roundMoney(normalizedRate * overdueDays);
  return {
    baseCommissionAmount: normalizedBase,
    surchargeRateApplied: normalizedRate,
    surchargeDaysApplied: overdueDays,
    surchargeAmount,
    amountDue: roundMoney(normalizedBase + surchargeAmount),
  };
}

function isBlockingCommissionBill(bill, now = new Date()) {
  if (!bill) return false;
  if (bill.status === "Overdue") return true;
  if (!["Pending", "Submitted", "Rejected"].includes(bill.status)) return false;
  return bill.graceEndsAt && new Date(bill.graceEndsAt) < now;
}

async function getWorkerCommissionRestriction(providerId) {
  const now = new Date();
  const settings = await getWorkerPaymentSettings();
  const billsSnap = await db.collection("workerCommissionBills").where("providerId", "==", providerId).get();
  const blockingBills = billsSnap.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((bill) => isBlockingCommissionBill(bill, now))
    .sort((left, right) => String(left.graceEndsAt || left.dueDate).localeCompare(String(right.graceEndsAt || right.dueDate)));

  if (!blockingBills.length) {
    return { restricted: false };
  }

  const batch = db.batch();
  blockingBills
    .filter((bill) => bill.status !== "Overdue")
    .forEach((bill) => {
      const surchargeSnapshot = applyCommissionSurcharge(
        Number(bill.baseCommissionAmount ?? bill.amountDue ?? 0),
        bill.graceEndsAt,
        settings.lateSurchargeRate,
        now
      );
      batch.set(db.collection("workerCommissionBills").doc(bill.id), {
        status: "Overdue",
        baseCommissionAmount: surchargeSnapshot.baseCommissionAmount,
        surchargeRateApplied: surchargeSnapshot.surchargeRateApplied,
        surchargeAmount: surchargeSnapshot.surchargeAmount,
        amountDue: surchargeSnapshot.amountDue,
        updatedAt: now.toISOString(),
      }, { merge: true });
    });
  if (blockingBills.some((bill) => bill.status !== "Overdue")) {
    await batch.commit();
    await recomputeWorkerFinanceSummary(providerId).catch((error) => {
      console.error("Error recomputing finance after overdue commission check:", error);
    });
  }

  return {
    restricted: true,
    reason: "Your admin commission payment is overdue. Please pay the admin before accepting another booking.",
    billId: blockingBills[0].billId || blockingBills[0].id,
  };
}

async function syncAcceptedBookingCommission(bookingId) {
  const settings = await getWorkerPaymentSettings();
  if (!settings.commissionEnabled) return null;

  const bookingRef = db.collection("bookings").doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) return null;

  const booking = bookingSnap.data();
  if (!booking?.providerId || !isCommissionTrackedBooking(booking)) return null;

  const summarySnap = await db.collection("workerFinanceSummaries").doc(booking.providerId).get();
  const summary = summarySnap.exists ? summarySnap.data() : await createWorkerFinanceSummary(booking.providerId);
  const activationTime = new Date(summary.featureActivatedAt || settings.featureActivatedAt).getTime();
  const acceptedAt = commissionBookingTime(booking);
  if (acceptedAt.getTime() < activationTime) return null;

  const bookingsSnap = await db.collection("bookings").where("providerId", "==", booking.providerId).get();
  const eligibleBookings = bookingsSnap.docs
    .map((entry) => entry.data())
    .filter((entry) => isCommissionTrackedBooking(entry) && commissionBookingTime(entry).getTime() >= activationTime)
    .sort((left, right) => {
      const byDate = commissionBookingTime(left).getTime() - commissionBookingTime(right).getTime();
      return byDate || String(left.bookingId).localeCompare(String(right.bookingId));
    });

  const currentIndex = eligibleBookings.findIndex((entry) => entry.bookingId === bookingId);
  if (currentIndex < 0) return null;

  const commissionPercentage = Number(settings.commissionPercentage || 10);
  const freeBookingsGranted = Number(settings.freeBookingsGranted || 5);
  const { start, end } = commissionPreviewCycleBounds(acceptedAt);
  const batch = db.batch();
  eligibleBookings.forEach((entry, index) => {
    const commissionable = index >= freeBookingsGranted;
    batch.set(
      db.collection("bookings").doc(entry.bookingId),
      {
        commissionEvaluated: true,
        commissionable,
        usedFreeBookingAllowance: !commissionable,
        commissionPercentage,
        estimatedCommissionAmount: commissionable ? roundMoney(Number(entry.amount || 0) * (commissionPercentage / 100)) : 0,
      },
      { merge: true }
    );
  });

  const cycleBookings = eligibleBookings.filter((entry) => {
    const entryAcceptedAt = commissionBookingTime(entry);
    return entryAcceptedAt >= start && entryAcceptedAt <= end;
  });
  const commissionableCycleBookings = eligibleBookings
    .map((entry, index) => ({ booking: entry, index }))
    .filter(({ booking: entry, index }) => {
      const entryAcceptedAt = commissionBookingTime(entry);
      return index >= freeBookingsGranted && entryAcceptedAt >= start && entryAcceptedAt <= end;
    });

  if (commissionableCycleBookings.length && new Date().getTime() >= end.getTime()) {
    const billId = `commission-${booking.providerId}-${monthKey(end)}`;
    const existingBillSnap = await db.collection("workerCommissionBills").doc(billId).get();
    const existingBill = existingBillSnap.exists ? existingBillSnap.data() : null;
    if (existingBill?.status !== "Approved") {
      const dueDate = new Date(end.getFullYear(), end.getMonth() + 1, Number(settings.monthlyBillDueDay || 5), 23, 59, 59, 999);
      const graceEndsAt = new Date(dueDate);
      graceEndsAt.setDate(graceEndsAt.getDate() + Number(settings.gracePeriodDays || 3));
      const now = new Date().toISOString();
      const totalIncome = cycleBookings.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const commissionableIncome = commissionableCycleBookings.reduce((sum, { booking: entry }) => sum + Number(entry.amount || 0), 0);
      const surchargeSnapshot = applyCommissionSurcharge(
        roundMoney(commissionableIncome * (commissionPercentage / 100)),
        graceEndsAt.toISOString(),
        Number(settings.lateSurchargeRate || 0)
      );
      const bill = {
        billId,
        providerId: booking.providerId,
        userId: booking.providerId,
        cycleStart: start.toISOString(),
        cycleEnd: end.toISOString(),
        generatedAt: existingBill?.generatedAt || now,
        dueDate: dueDate.toISOString(),
        graceEndsAt: graceEndsAt.toISOString(),
        status: existingBill?.status && existingBill.status !== "Waived" ? existingBill.status : "Pending",
        totalIncome,
        totalCompletedPaidBookings: cycleBookings.length,
        freeBookingsAppliedThisBill: Math.max(0, cycleBookings.length - commissionableCycleBookings.length),
        freeBookingsRemainingAfterBill: Math.max(0, freeBookingsGranted - eligibleBookings.filter((entry) => commissionBookingTime(entry) <= end).length),
        commissionableBookings: commissionableCycleBookings.length,
        commissionPercentage,
        baseCommissionAmount: surchargeSnapshot.baseCommissionAmount,
        surchargeRateApplied: surchargeSnapshot.surchargeRateApplied,
        surchargeDaysApplied: surchargeSnapshot.surchargeDaysApplied,
        surchargeAmount: surchargeSnapshot.surchargeAmount,
        amountDue: surchargeSnapshot.amountDue,
        createdAt: existingBill?.createdAt || now,
        updatedAt: now,
      };
      batch.set(db.collection("workerCommissionBills").doc(billId), bill, { merge: true });
      commissionableCycleBookings.forEach(({ booking: entry }) => {
        batch.set(
          db.collection("bookings").doc(entry.bookingId),
          {
            commissionAmount: roundMoney(Number(entry.amount || 0) * (commissionPercentage / 100)),
            commissionBillId: billId,
          },
          { merge: true }
        );
      });
    }
  }

  await batch.commit();
  await recomputeWorkerFinanceSummary(booking.providerId).catch((error) => {
    console.error("Error recomputing worker finance after commission sync:", error);
  });
  return null;
}

async function getActorRole(uid) {
  const userSnap = await db.collection("users").doc(uid).get();
  return userSnap.exists ? userSnap.data()?.role : null;
}

function assertBookingStatusTransition({ booking, nextStatus, actorId, actorRole }) {
  const providerStatuses = new Set(["Accepted", "On the Way", "In Progress", "Completed"]);
  if (actorRole === "admin") return;

  if (nextStatus === "On the Way" && !booking.customerAcceptanceConfirmedAt) {
    throw new HttpsError("failed-precondition", "The customer must confirm the accepted booking before the worker can mark it as On the Way.");
  }

  if (nextStatus === "Cancelled" && booking.customerId === actorId) return;
  if (providerStatuses.has(nextStatus) && booking.providerId === actorId) return;

  throw new HttpsError("permission-denied", "You are not allowed to make this booking status change.");
}

function isExpoPushToken(token) {
  return typeof token === "string" && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function commitDeletes(refs) {
  for (const batchRefs of chunk(refs, 450)) {
    const batch = db.batch();
    batchRefs.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function sendExpoPushMessages(messages) {
  const receipts = [];
  for (const batch of chunk(messages, 100)) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      throw new Error(`Expo push request failed with ${response.status}`);
    }

    const payload = await response.json();
    receipts.push(...(Array.isArray(payload.data) ? payload.data : []));
  }
  return receipts;
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

function sameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function sameMonth(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function formatDayLabel(date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

function countBy(items, getKey) {
  const values = new Map();
  items.forEach((item) => {
    const key = getKey(item) || "Unknown";
    values.set(key, (values.get(key) || 0) + 1);
  });
  return Array.from(values.entries()).map(([key, value]) => ({ key, value }));
}

function buildAnalyticsSummary({ users, providerProfiles, applications, bookings, payments, complaints }) {
  const activeStatuses = new Set(["Pending", "Accepted", "On the Way", "In Progress"]);
  const approvedProviders = providerProfiles.filter((profile) => profile.isApproved);
  const avgProviderRating = approvedProviders.length
    ? approvedProviders.reduce((sum, profile) => sum + Number(profile.rating || 0), 0) / approvedProviders.length
    : 0;
  const serviceDemandMap = new Map();
  const approvalMap = new Map();

  bookings.forEach((booking) => {
    serviceDemandMap.set(booking.serviceName, (serviceDemandMap.get(booking.serviceName) || 0) + 1);
  });
  providerProfiles.forEach((profile) => {
    approvalMap.set(profile.approvalStatus, (approvalMap.get(profile.approvalStatus) || 0) + 1);
  });

  const cityCounts = countBy(bookings, (booking) => (booking.address || "").split(",").slice(-1)[0]?.trim());
  const categoryCounts = countBy(bookings, (booking) => booking.serviceName);
  const statusCounts = countBy(bookings, (booking) => booking.status);

  return {
    totalCustomers: users.filter((user) => user.role === "customer").length,
    totalProviders: users.filter((user) => user.role === "provider").length,
    pendingApprovals: applications.filter((application) => application.status === "Pending Approval").length,
    activeBookings: bookings.filter((booking) => activeStatuses.has(booking.status)).length,
    completedBookings: bookings.filter((booking) => booking.status === "Completed").length,
    cancelledBookings: bookings.filter((booking) => booking.status === "Cancelled").length,
    totalTransactions: payments.length,
    revenueSummary: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    totalComplaints: complaints.length,
    avgProviderRating,
    updatedAt: new Date().toISOString(),
    bookingTrend: lastSevenDays().map((date) => {
      const dayBookings = bookings.filter((booking) => sameDay(new Date(booking.createdAt), date));
      return {
        label: formatDayLabel(date),
        bookings: dayBookings.length,
        revenue: dayBookings.reduce((sum, booking) => sum + Number(booking.amount || 0), 0),
      };
    }),
    growthTrend: lastSixMonths().map((date) => ({
      label: formatMonthLabel(date),
      customers: users.filter((user) => user.role === "customer" && sameMonth(new Date(user.createdAt), date)).length,
      providers: users.filter((user) => user.role === "provider" && sameMonth(new Date(user.createdAt), date)).length,
    })),
    serviceDemand: Array.from(serviceDemandMap.entries())
      .map(([service, value]) => ({ service, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6),
    approvalDistribution: Array.from(approvalMap.entries()).map(([status, value]) => ({ status, value })),
    bookingsByCity: cityCounts.map(({ key, value }) => ({ city: key, value })),
    bookingsByCategory: categoryCounts.map(({ key, value }) => ({ category: key, value })),
    bookingsByStatus: statusCounts.map(({ key, value }) => ({ status: key, value })),
  };
}

let analyticsRefreshPromise = null;

async function refreshMarketplaceAnalytics() {
  if (analyticsRefreshPromise) {
    return analyticsRefreshPromise;
  }

  analyticsRefreshPromise = (async () => {
    const [users, providerProfiles, applications, bookings, payments, complaints] = await Promise.all([
      db.collection("users").get(),
      db.collection("providerProfiles").get(),
      db.collection("providerApplications").get(),
      db.collection("bookings").get(),
      db.collection("payments").get(),
      db.collection("complaints").get(),
    ]);

    const summary = buildAnalyticsSummary({
      users: users.docs.map((entry) => entry.data()),
      providerProfiles: providerProfiles.docs.map((entry) => entry.data()),
      applications: applications.docs.map((entry) => entry.data()),
      bookings: bookings.docs.map((entry) => entry.data()),
      payments: payments.docs.map((entry) => entry.data()),
      complaints: complaints.docs.map((entry) => entry.data()),
    });

    await db.collection("analytics").doc("marketplace").set(summary, { merge: true });
    return summary;
  })();

  try {
    return await analyticsRefreshPromise;
  } finally {
    analyticsRefreshPromise = null;
  }
}

exports.uploadMediaAsset = onCall(webCallableOptions, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { dataUrl, storagePath, mimeType, fileName, uploadedBy, maxSizeBytes } = request.data || {};
  if (!dataUrl || !storagePath || typeof dataUrl !== "string" || typeof storagePath !== "string") {
    throw new HttpsError("invalid-argument", "dataUrl and storagePath are required.");
  }
  if (uploadedBy && uploadedBy !== auth.uid) {
    throw new HttpsError("permission-denied", "You can only upload files for your own account.");
  }
  if (storagePath.startsWith("workerPayments/settings/") && !(await isAdminUser(auth.uid))) {
    throw new HttpsError("permission-denied", "Admin privileges are required to upload worker payment QR codes.");
  }
  if (storagePath.startsWith("workerPayments/registration/") || storagePath.startsWith("workerPayments/commission/")) {
    const ownerId = storagePath.split("/")[2];
    if (ownerId !== auth.uid && !(await isAdminUser(auth.uid))) {
      throw new HttpsError("permission-denied", "You can only upload worker payment proof for your own account.");
    }
  }
  if (!dataUrl.startsWith("data:")) {
    throw new HttpsError("invalid-argument", "Only base64 data URLs are supported.");
  }

  const base64Payload = dataUrl.split(",")[1];
  if (!base64Payload) {
    throw new HttpsError("invalid-argument", "The data URL payload is empty.");
  }

  const resolvedMimeType = mimeType || dataUrl.match(/^data:([^;]+);base64,/)?.[1] || "application/octet-stream";
  const buffer = Buffer.from(base64Payload, "base64");
  if (typeof maxSizeBytes === "number" && maxSizeBytes > 0 && buffer.length > maxSizeBytes) {
    throw new HttpsError("resource-exhausted", `The selected file must be ${Math.floor(maxSizeBytes / 1024 / 1024)} MB or smaller.`);
  }
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  const token = randomUUID();

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType: resolvedMimeType,
      metadata: {
        firebaseStorageDownloadTokens: token,
        uploadedBy: auth.uid,
        originalFileName: fileName || "",
      },
    },
  });

  return {
    url: buildStorageDownloadUrl(bucket.name, storagePath, token),
    storagePath,
    mimeType: resolvedMimeType,
    sizeBytes: buffer.length,
  };
});

exports.submitProviderApplication = onCall(webCallableOptions, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { applicationId, userId, application, providerProfileUpdate, registrationPayment } = request.data || {};
  if (!applicationId || !userId || !application || !providerProfileUpdate) {
    throw new HttpsError("invalid-argument", "applicationId, userId, application, and providerProfileUpdate are required.");
  }
  if (userId !== auth.uid) {
    throw new HttpsError("permission-denied", "You can only submit your own provider application.");
  }

  const nextApplication = {
    ...application,
    applicationId,
    userId,
    submittedAt: application.submittedAt || new Date().toISOString(),
    status: "Pending Approval",
  };

  if (nextApplication.registrationFeeRequired) {
    if (!registrationPayment?.paymentId || registrationPayment.status !== "Submitted") {
      throw new HttpsError("failed-precondition", "Registration payment proof must be submitted before applying.");
    }
    if (!registrationPayment.proofImageUrl || !String(registrationPayment.referenceNumber || "").trim() || !registrationPayment.paymentDate) {
      throw new HttpsError("failed-precondition", "Registration payment proof, reference number, and payment date are required.");
    }
  } else if (registrationPayment?.paymentId && registrationPayment.status !== "Waived") {
    throw new HttpsError("failed-precondition", "Free registration applications must use a waived registration payment record.");
  }

  const settings = await getWorkerPaymentSettings();
  const nextRegistrationPayment = registrationPayment?.paymentId
    ? {
        ...registrationPayment,
        amount: nextApplication.registrationFeeRequired
          ? (Number(registrationPayment.amount) > 0 ? Number(registrationPayment.amount) : Number(settings.registrationFeeAmount || 500))
          : 0,
      }
    : null;

  const nextProfileUpdate = {
    ...providerProfileUpdate,
    approvalStatus: "Pending Approval",
    isApproved: false,
    moderation: { status: "active" },
    updatedAt: new Date().toISOString(),
  };

  const batch = db.batch();
  batch.set(db.collection("providerApplications").doc(applicationId), nextApplication, { merge: true });
  if (nextRegistrationPayment?.paymentId) {
    batch.set(db.collection("workerRegistrationPayments").doc(nextRegistrationPayment.paymentId), nextRegistrationPayment, { merge: true });
    batch.set(db.collection("workerFinanceSummaries").doc(userId), {
      providerId: userId,
      userId,
      registrationPaymentStatus: nextRegistrationPayment.status,
      registrationPaymentId: nextRegistrationPayment.paymentId,
      totalFreeBookingsGranted: providerProfileUpdate.financialStatus?.freeBookingsGranted || 5,
      freeBookingsUsed: 0,
      freeBookingsRemaining: providerProfileUpdate.financialStatus?.freeBookingsRemaining || 5,
      totalCompletedPaidBookings: 0,
      totalIncome: 0,
      totalCommissionableBookings: 0,
      totalCommissionPaid: 0,
      totalCommissionPending: 0,
      totalCommissionOverdue: 0,
      hasOverdueCommission: false,
      restrictedFromAcceptingBookings: false,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  batch.set(db.collection("providerProfiles").doc(userId), nextProfileUpdate, { merge: true });
  await batch.commit();
  if (nextRegistrationPayment?.paymentId) {
    await createNotification(
      userId,
      nextRegistrationPayment.status === "Waived" ? "registration_payment_waived" : "registration_payment_submitted",
      nextRegistrationPayment.status === "Waived" ? "Registration fee waived" : "Registration payment submitted",
      nextRegistrationPayment.status === "Waived"
        ? "Your worker application can proceed directly to admin review."
        : "Your registration payment proof was submitted and is waiting for admin review.",
      "/provider/pending"
    ).catch(() => undefined);
  }

  return { applicationId };
});

exports.approveProvider = onCall(webCallableOptions, async (request) => {
  const adminId = await requireAdmin(request);
  const { applicationId, userId } = request.data || {};
  if (!applicationId || !userId) {
    throw new HttpsError("invalid-argument", "applicationId and userId are required.");
  }

  const applicationSnap = await db.collection("providerApplications").doc(applicationId).get();
  if (!applicationSnap.exists) {
    throw new HttpsError("not-found", "Provider application not found.");
  }
  const application = applicationSnap.data();
  const registrationPaymentId = application.registrationPaymentId;
  let registrationPayment = null;
  if (application.registrationFeeRequired) {
    if (!registrationPaymentId) {
      throw new HttpsError("failed-precondition", "Registration payment is required before approval.");
    }
    const paymentSnap = await db.collection("workerRegistrationPayments").doc(registrationPaymentId).get();
    registrationPayment = paymentSnap.exists ? paymentSnap.data() : null;
    if (!paymentSnap.exists || paymentSnap.data()?.status !== "Approved") {
      throw new HttpsError("failed-precondition", "Approve the worker registration payment proof before approving this provider.");
    }
  } else if (registrationPaymentId) {
    const paymentSnap = await db.collection("workerRegistrationPayments").doc(registrationPaymentId).get();
    registrationPayment = paymentSnap.exists ? paymentSnap.data() : null;
  }

  const settings = await getWorkerPaymentSettings();
  const registrationStatus = application.registrationPaymentStatus || (application.registrationFeeRequired ? "Approved" : "Waived");
  const batch = db.batch();
  batch.set(
    db.collection("providerProfiles").doc(userId),
    {
      approvalStatus: "Approved",
      isApproved: true,
      moderation: { status: "active", changedAt: new Date().toISOString(), changedBy: adminId },
      financialStatus: {
        registrationPaymentStatus: registrationStatus,
        freeBookingsGranted: settings.freeBookingsGranted,
        freeBookingsUsed: 0,
        freeBookingsRemaining: settings.freeBookingsGranted,
        restrictedFromAcceptingBookings: false,
        hasOverdueCommission: false,
        updatedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );
  batch.set(
    db.collection("providerApplications").doc(applicationId),
    {
      status: "Approved",
      reviewedBy: adminId,
      reviewedAt: new Date().toISOString(),
      reviewNotes: "Approved via Cloud Function",
    },
    { merge: true }
  );
  batch.set(db.collection("workerFinanceSummaries").doc(userId), {
    providerId: userId,
    userId,
    registrationPaymentStatus: registrationStatus,
    registrationPaymentId,
    totalFreeBookingsGranted: settings.freeBookingsGranted,
    freeBookingsUsed: 0,
    freeBookingsRemaining: settings.freeBookingsGranted,
    totalCompletedPaidBookings: 0,
    totalIncome: 0,
    totalCommissionableBookings: 0,
    totalCommissionPaid: 0,
    totalCommissionPending: 0,
    totalCommissionOverdue: 0,
    hasOverdueCommission: false,
    restrictedFromAcceptingBookings: false,
    featureActivatedAt: settings.featureActivatedAt,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  if (!application.registrationFeeRequired && settings.freeRegistrationPromoEnabled && registrationPayment?.waiverReason === "promo") {
    batch.set(db.collection("platformSettings").doc("workerPayments"), {
      approvedFreeRegistrationCount: Number(settings.approvedFreeRegistrationCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  await batch.commit();
  await createAuditLog(adminId, "provider_approved", "providerProfiles", userId, "Provider approved via Cloud Function.", { applicationId });
  return { ok: true };
});

exports.rejectProvider = onCall(webCallableOptions, async (request) => {
  const adminId = await requireAdmin(request);
  const { applicationId, userId, notes } = request.data || {};
  if (!applicationId || !userId) {
    throw new HttpsError("invalid-argument", "applicationId and userId are required.");
  }

  const batch = db.batch();
  batch.set(
    db.collection("providerProfiles").doc(userId),
    {
      approvalStatus: "Rejected",
      isApproved: false,
      moderation: { status: "active", reason: notes || "Rejected", changedAt: new Date().toISOString(), changedBy: adminId },
    },
    { merge: true }
  );
  batch.set(
    db.collection("providerApplications").doc(applicationId),
    {
      status: "Rejected",
      reviewedBy: adminId,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes || "Rejected",
    },
    { merge: true }
  );
  await batch.commit();
  await createAuditLog(adminId, "provider_rejected", "providerProfiles", userId, "Provider rejected via Cloud Function.", { applicationId, notes: notes || "" });
  return { ok: true };
});

exports.reviewWorkerRegistrationPayment = onCall(webCallableOptions, async (request) => {
  const adminId = await requireAdmin(request);
  const { paymentId, status, adminRemarks } = request.data || {};
  if (!paymentId || !["Approved", "Rejected"].includes(status)) {
    throw new HttpsError("invalid-argument", "paymentId and valid status are required.");
  }
  if (status === "Rejected" && !String(adminRemarks || "").trim()) {
    throw new HttpsError("invalid-argument", "Admin remarks are required when rejecting payment proof.");
  }

  const paymentRef = db.collection("workerRegistrationPayments").doc(paymentId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) throw new HttpsError("not-found", "Registration payment not found.");
  const payment = paymentSnap.data();
  const now = new Date().toISOString();
  const batch = db.batch();
  batch.set(paymentRef, {
    status,
    reviewedBy: adminId,
    reviewedAt: now,
    adminRemarks: String(adminRemarks || ""),
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection("providerApplications").doc(payment.applicationId), {
    registrationPaymentStatus: status,
  }, { merge: true });
  batch.set(db.collection("providerProfiles").doc(payment.providerId), {
    financialStatus: {
      registrationPaymentStatus: status,
      updatedAt: now,
    },
  }, { merge: true });
  if (status === "Approved" && Number(payment.amount || 0) > 0) {
    const revenueId = `revenue-registration-${paymentId}`;
    batch.set(db.collection("adminRevenueRecords").doc(revenueId), {
      revenueId,
      sourceType: "registration_fee",
      sourcePaymentId: paymentId,
      providerId: payment.providerId,
      userId: payment.userId,
      amount: Number(payment.amount || 0),
      status: "Approved",
      approvedBy: adminId,
      approvedAt: now,
      createdAt: now,
    }, { merge: true });
  }
  await batch.commit();
  await createNotification(
    payment.userId,
    status === "Approved" ? "registration_payment_approved" : "registration_payment_rejected",
    status === "Approved" ? "Registration payment approved" : "Registration payment rejected",
    status === "Approved"
      ? "Your registration payment proof was approved. Your application can now be approved by admin."
      : `Your registration payment proof was rejected. ${String(adminRemarks || "").trim()}`,
    "/provider/pending"
  ).catch(() => undefined);
  await createAuditLog(adminId, status === "Approved" ? "registration_payment_approved" : "registration_payment_rejected", "workerRegistrationPayments", paymentId, `Registration payment ${status.toLowerCase()}.`, { providerId: payment.providerId });
  return { ok: true };
});

exports.updateWorkerPaymentSettings = onCall(webCallableOptions, async (request) => {
  const adminId = await requireAdmin(request);
  const current = await getWorkerPaymentSettings();
  const data = request.data || {};
  const next = normalizeWorkerPaymentSettings({
    ...current,
    ...data,
    updatedBy: adminId,
    updatedAt: new Date().toISOString(),
  }, current);

  await db.collection("platformSettings").doc("workerPayments").set(next, { merge: true });
  await createAuditLog(adminId, "worker_payment_settings_updated", "platformSettings", "workerPayments", "Updated worker payment settings.", {
    registrationFeeAmount: next.registrationFeeAmount,
    commissionPercentage: next.commissionPercentage,
    monthlyBillDueDay: next.monthlyBillDueDay,
    gracePeriodDays: next.gracePeriodDays,
  });
  return next;
});

exports.reviewWorkerCommissionPayment = onCall(webCallableOptions, async (request) => {
  const adminId = await requireAdmin(request);
  const { billId, status, adminRemarks } = request.data || {};
  if (!billId || !["Approved", "Rejected"].includes(status)) {
    throw new HttpsError("invalid-argument", "billId and valid status are required.");
  }
  if (status === "Rejected" && !String(adminRemarks || "").trim()) {
    throw new HttpsError("invalid-argument", "Admin remarks are required when rejecting payment proof.");
  }
  const billRef = db.collection("workerCommissionBills").doc(billId);
  const billSnap = await billRef.get();
  if (!billSnap.exists) throw new HttpsError("not-found", "Commission bill not found.");
  const bill = billSnap.data();
  const wasOverdue = bill.status === "Overdue";
  const now = new Date().toISOString();
  const batch = db.batch();
  batch.set(billRef, {
    status,
    reviewedBy: adminId,
    reviewedAt: now,
    adminRemarks: String(adminRemarks || ""),
    updatedAt: now,
  }, { merge: true });
  if (status === "Approved" && Number(bill.amountDue || 0) > 0) {
    const revenueId = `revenue-commission-${billId}`;
    batch.set(db.collection("adminRevenueRecords").doc(revenueId), {
      revenueId,
      sourceType: "monthly_commission",
      sourcePaymentId: billId,
      providerId: bill.providerId,
      userId: bill.userId,
      amount: Number(bill.amountDue || 0),
      status: "Approved",
      approvedBy: adminId,
      approvedAt: now,
      cycleStart: bill.cycleStart,
      cycleEnd: bill.cycleEnd,
      createdAt: now,
    }, { merge: true });
  }
  await batch.commit();
  await recomputeWorkerFinanceSummary(bill.providerId);
  await createNotification(
    bill.userId,
    status === "Approved" ? "commission_payment_approved" : "commission_payment_rejected",
    status === "Approved" ? "Commission payment approved" : "Commission payment rejected",
    status === "Approved"
      ? "Your monthly commission payment was approved. Any payment restriction has been lifted."
      : `Your monthly commission payment was rejected. ${String(adminRemarks || "").trim()}`,
    "/(tabs)/profile"
  ).catch(() => undefined);
  if (status === "Approved" && wasOverdue) {
    await createNotification(
      bill.userId,
      "worker_restriction_lifted",
      "Booking access restored",
      "Your overdue commission payment was approved. You can accept new bookings again.",
      "/(tabs)/profile"
    ).catch(() => undefined);
  }
  await createAuditLog(adminId, status === "Approved" ? "commission_payment_approved" : "commission_payment_rejected", "workerCommissionBills", billId, `Commission payment ${status.toLowerCase()}.`, { providerId: bill.providerId });
  return { ok: true };
});

exports.backfillExistingWorkerFinance = onCall(webCallableOptions, async (request) => {
  const adminId = await requireAdmin(request);
  const settings = await getWorkerPaymentSettings();
  const providers = await db.collection("providerProfiles").where("isApproved", "==", true).get();
  let created = 0;
  const now = new Date().toISOString();

  for (const providerDoc of providers.docs) {
    const providerId = providerDoc.id;
    const summaryRef = db.collection("workerFinanceSummaries").doc(providerId);
    const summarySnap = await summaryRef.get();
    if (summarySnap.exists) continue;

    await summaryRef.set({
      providerId,
      userId: providerId,
      registrationPaymentStatus: "Waived",
      totalFreeBookingsGranted: Number(settings.freeBookingsGranted || 5),
      freeBookingsUsed: 0,
      freeBookingsRemaining: Number(settings.freeBookingsGranted || 5),
      totalCompletedPaidBookings: 0,
      totalIncome: 0,
      totalCommissionableBookings: 0,
      totalCommissionPaid: 0,
      totalCommissionPending: 0,
      totalCommissionOverdue: 0,
      hasOverdueCommission: false,
      restrictedFromAcceptingBookings: false,
      featureActivatedAt: settings.featureActivatedAt || now,
      updatedAt: now,
    }, { merge: true });
    await db.collection("providerProfiles").doc(providerId).set({
      financialStatus: {
        registrationPaymentStatus: "Waived",
        freeBookingsGranted: Number(settings.freeBookingsGranted || 5),
        freeBookingsUsed: 0,
        freeBookingsRemaining: Number(settings.freeBookingsGranted || 5),
        restrictedFromAcceptingBookings: false,
        hasOverdueCommission: false,
        updatedAt: now,
      },
    }, { merge: true });
    created += 1;
  }

  await createAuditLog(adminId, "worker_payment_settings_updated", "workerFinanceSummaries", "backfill", "Backfilled existing worker finance summaries.", { created });
  return { created };
});

exports.requestProviderRevision = onCall(webCallableOptions, async (request) => {
  const adminId = await requireAdmin(request);
  const { applicationId, userId, notes } = request.data || {};
  if (!applicationId || !userId) {
    throw new HttpsError("invalid-argument", "applicationId and userId are required.");
  }

  const batch = db.batch();
  batch.set(
    db.collection("providerProfiles").doc(userId),
    {
      approvalStatus: "Revision Requested",
      isApproved: false,
      moderation: { status: "active", reason: notes || "Revision requested", changedAt: new Date().toISOString(), changedBy: adminId },
    },
    { merge: true }
  );
  batch.set(
    db.collection("providerApplications").doc(applicationId),
    {
      status: "Revision Requested",
      reviewedBy: adminId,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes || "Revision requested",
    },
    { merge: true }
  );
  await batch.commit();
  await createAuditLog(adminId, "provider_revision_requested", "providerProfiles", userId, "Provider revision requested via Cloud Function.", { applicationId, notes: notes || "" });
  return { ok: true };
});

exports.updateProviderModeration = onCall(webCallableOptions, async (request) => {
  const adminId = await requireAdmin(request);
  const { userId, status, reason } = request.data || {};
  if (!userId || !status) {
    throw new HttpsError("invalid-argument", "userId and status are required.");
  }

  await db.collection("providerProfiles").doc(userId).set(
    {
      moderation: {
        status,
        reason: reason || "",
        changedAt: new Date().toISOString(),
        changedBy: adminId,
      },
    },
    { merge: true }
  );

  const action =
    status === "suspended"
      ? "provider_suspended"
      : status === "banned"
        ? "provider_banned"
        : "provider_unsuspended";
  await createAuditLog(adminId, action, "providerProfiles", userId, `Provider moderation updated to ${status}.`, { reason: reason || "" });
  return { ok: true };
});

exports.createPaymentRecord = onCall(webCallableOptions, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const payment = request.data?.payment || {};
  const { bookingId, customerId, providerId, amount, method, status } = payment;
  if (!bookingId || !customerId || !providerId || typeof amount !== "number" || !method || !status) {
    throw new HttpsError("invalid-argument", "bookingId, customerId, providerId, amount, method, and status are required.");
  }

  const actorRole = await getActorRole(auth.uid);
  if (actorRole !== "admin" && auth.uid !== customerId && auth.uid !== providerId) {
    throw new HttpsError("permission-denied", "You can only create payment records for your own bookings.");
  }

  const bookingSnap = await db.collection("bookings").doc(bookingId).get();
  if (!bookingSnap.exists) {
    throw new HttpsError("not-found", "Booking not found.");
  }

  const booking = bookingSnap.data();
  if (booking.customerId !== customerId || booking.providerId !== providerId) {
    throw new HttpsError("failed-precondition", "Payment participants must match the booking.");
  }

  const paymentId = `payment-${Date.now()}`;
  await db.collection("payments").doc(paymentId).set({
    bookingId,
    customerId,
    providerId,
    amount,
    method,
    status,
    paymentId,
    createdAt: new Date().toISOString(),
  });
  if (status === "Paid") {
    if (booking.status === "Completed") {
      await generateCommissionBill(providerId, new Date()).catch((error) => {
        console.error("Error generating commission bill after payment create:", error);
      });
    }
    await recomputeWorkerFinanceSummary(providerId).catch((error) => {
      console.error("Error recomputing worker finance after payment create:", error);
    });
  }

  return { paymentId };
});

exports.updatePaymentStatus = onCall(webCallableOptions, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { paymentId, status } = request.data || {};
  if (!paymentId || !status) {
    throw new HttpsError("invalid-argument", "paymentId and status are required.");
  }

  const paymentRef = db.collection("payments").doc(paymentId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) {
    throw new HttpsError("not-found", "Payment not found.");
  }

  const payment = paymentSnap.data();
  const actorRole = await getActorRole(auth.uid);
  if (actorRole !== "admin" && auth.uid !== payment.customerId && auth.uid !== payment.providerId) {
    throw new HttpsError("permission-denied", "You can only update payment records for your own bookings.");
  }

  await paymentRef.set({ status }, { merge: true });
  if (status === "Paid") {
    const bookingSnap = payment.bookingId ? await db.collection("bookings").doc(payment.bookingId).get() : null;
    const booking = bookingSnap?.exists ? bookingSnap.data() : null;
    if (booking?.status === "Completed") {
      await generateCommissionBill(payment.providerId, new Date()).catch((error) => {
        console.error("Error generating commission bill after payment status update:", error);
      });
    }
    await recomputeWorkerFinanceSummary(payment.providerId).catch((error) => {
      console.error("Error recomputing worker finance after payment status update:", error);
    });
  }
  return { ok: true };
});

exports.updateBookingStatus = onCall(webCallableOptions, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { bookingId, status } = request.data || {};
  if (!bookingId || !status) {
    throw new HttpsError("invalid-argument", "bookingId and status are required.");
  }

  const bookingRef = db.collection("bookings").doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) {
    throw new HttpsError("not-found", "Booking not found.");
  }

  const booking = bookingSnap.data();
  const actorRole = await getActorRole(auth.uid);
  assertBookingStatusTransition({ booking, nextStatus: status, actorId: auth.uid, actorRole });
  if (status === "Accepted" && actorRole !== "admin") {
    const restriction = await getWorkerCommissionRestriction(booking.providerId);
    if (restriction.restricted) {
      throw new HttpsError("failed-precondition", restriction.reason);
    }
  }

  const statusHistory = booking.status === status
    ? booking.statusHistory || []
    : [
        ...(booking.statusHistory || []),
        {
          bookingId,
          status,
          changedAt: new Date().toISOString(),
          changedBy: auth.uid,
        },
      ];

  await bookingRef.set(
    {
      status,
      statusHistory,
      ...(status === "Accepted" && !booking.workerAcceptedAt ? { workerAcceptedAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  if (status === "Accepted") {
    await syncAcceptedBookingCommission(bookingId).catch((error) => {
      console.error("Error syncing commission after booking acceptance:", error);
    });
  }

  if (booking.scheduledDate && booking.scheduledTime && shouldReleaseBookingSlot(status)) {
    const slotId = buildBookingSlotId(booking.providerId, booking.scheduledDate, booking.scheduledTime);
    await db.collection("bookingSlots").doc(slotId).delete().catch(() => undefined);
    if (booking.customerId) {
      const customerSlotId = buildCustomerBookingSlotId(booking.customerId, booking.scheduledDate, booking.scheduledTime);
      await db.collection("customerBookingSlots").doc(customerSlotId).delete().catch(() => undefined);
    }
  }

  return { ok: true };
});

exports.confirmAcceptedBooking = onCall(webCallableOptions, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { bookingId } = request.data || {};
  if (!bookingId) {
    throw new HttpsError("invalid-argument", "bookingId is required.");
  }

  const bookingRef = db.collection("bookings").doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) {
    throw new HttpsError("not-found", "Booking not found.");
  }

  const booking = bookingSnap.data();
  if (booking.customerId !== auth.uid) {
    throw new HttpsError("permission-denied", "Only the customer can confirm this booking.");
  }

  if (booking.status !== "Accepted") {
    throw new HttpsError("failed-precondition", "Only accepted bookings can be confirmed.");
  }

  if (booking.customerAcceptanceConfirmedAt) {
    return { ok: true, confirmedAt: booking.customerAcceptanceConfirmedAt };
  }

  const confirmedAt = new Date().toISOString();
  await bookingRef.set(
    {
      customerAcceptanceConfirmedAt: confirmedAt,
      customerAcceptanceConfirmedBy: auth.uid,
      updatedAt: confirmedAt,
    },
    { merge: true }
  );

  return { ok: true, confirmedAt };
});

exports.deleteUserNotifications = onCall(webCallableOptions, async (request) => {
  const userId = requireSignedIn(request);
  const { notificationIds, deleteAll } = request.data || {};
  let refs = [];

  if (deleteAll === true) {
    const snapshot = await db.collection("notifications").where("userId", "==", userId).get();
    refs = snapshot.docs.map((doc) => doc.ref);
  } else {
    if (!Array.isArray(notificationIds) || !notificationIds.length) {
      throw new HttpsError("invalid-argument", "notificationIds or deleteAll is required.");
    }

    const uniqueIds = [...new Set(notificationIds.filter((id) => typeof id === "string"))].slice(0, 200);
    const docs = await Promise.all(uniqueIds.map((id) => db.collection("notifications").doc(id).get()));
    const unauthorized = docs.find((doc) => doc.exists && doc.data()?.userId !== userId);
    if (unauthorized) {
      throw new HttpsError("permission-denied", "You can only delete your own notifications.");
    }
    refs = docs.filter((doc) => doc.exists).map((doc) => doc.ref);
  }

  await commitDeletes(refs);
  return { deleted: refs.length };
});

exports.deleteMessageThreads = onCall(webCallableOptions, async (request) => {
  const userId = requireSignedIn(request);
  const { threadIds } = request.data || {};
  if (!Array.isArray(threadIds) || !threadIds.length) {
    throw new HttpsError("invalid-argument", "threadIds is required.");
  }

  const uniqueThreadIds = [...new Set(threadIds.filter((id) => typeof id === "string"))].slice(0, 50);
  const threadDocs = await Promise.all(uniqueThreadIds.map((id) => db.collection("messageThreads").doc(id).get()));
  const unauthorized = threadDocs.find((doc) => doc.exists && !(doc.data()?.participants || []).includes(userId));
  if (unauthorized) {
    throw new HttpsError("permission-denied", "You can only delete conversations you participate in.");
  }

  const refsToDelete = [];
  for (const threadDoc of threadDocs) {
    if (!threadDoc.exists) continue;
    const messages = await db.collection("messages").where("threadId", "==", threadDoc.id).get();
    refsToDelete.push(...messages.docs.map((doc) => doc.ref), threadDoc.ref);
  }

  await commitDeletes(refsToDelete);
  return { deleted: refsToDelete.length };
});

exports.deliverUserNotificationPush = onDocumentCreated("notifications/{notificationId}", async (event) => {
  const notification = event.data?.data();
  if (!notification?.userId || !notification?.title || !notification?.body) {
    return;
  }

  const tokenSnapshot = await db
    .collection("pushNotificationTokens")
    .where("userId", "==", notification.userId)
    .where("enabled", "==", true)
    .get();

  const tokenDocs = tokenSnapshot.docs.filter((entry) => isExpoPushToken(entry.data()?.token));
  if (!tokenDocs.length) {
    return;
  }

  const messages = tokenDocs.map((entry) => ({
    to: entry.data().token,
    sound: "default",
    channelId: "default",
    priority: "high",
    title: notification.title,
    body: notification.body,
    data: {
      notificationId: event.params.notificationId,
      route: notification.route || "",
      type: notification.type || "",
    },
  }));

  try {
    await sendExpoPushMessages(messages);
  } catch (error) {
    console.error("Failed to send push notifications:", error);
  }
});

exports.recalculateProviderRating = onDocumentWritten("reviews/{reviewId}", async (event) => {
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const providerId = after?.providerId || before?.providerId;
  if (!providerId) {
    return;
  }

  const snapshot = await db.collection("reviews").where("providerId", "==", providerId).get();
  const ratings = snapshot.docs
    .map((entry) => Number(entry.data()?.rating))
    .filter((rating) => Number.isFinite(rating));
  const average = ratings.length
    ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
    : 0;

  await db.collection("providerProfiles").doc(providerId).set({ rating: average }, { merge: true });
});

// ============= Notification Triggers =============

// Send notification when a new message is created
exports.onNewMessage = onDocumentCreated("messages/{messageId}", async (event) => {
  const message = event.data?.data();
  if (!message?.threadId || !message?.senderId) {
    return;
  }

  try {
    const threadSnap = await db.collection("messageThreads").doc(message.threadId).get();
    if (!threadSnap.exists) return;

    const thread = threadSnap.data();
    const senderSnap = await db.collection("users").doc(message.senderId).get();
    const senderName = senderSnap.data()?.fullName || "Someone";

    // Notify all participants except sender
    const otherParticipants = (thread.participants || []).filter((uid) => uid !== message.senderId);

    for (const userId of otherParticipants) {
      const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await db.collection("notifications").doc(notificationId).set({
        notificationId,
        userId,
        type: "message",
        title: `Message from ${senderName}`,
        body: (message.text || message.content || "Sent an attachment").substring(0, 100),
        route: `/chat?threadId=${message.threadId}`,
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error notifying new message:", error);
  }
});

// Send notification when a new booking is created
exports.onNewBooking = onDocumentCreated("bookings/{bookingId}", async (event) => {
  const booking = event.data?.data();
  if (!booking?.providerId || !booking?.customerId) {
    return;
  }

  try {
    const providerSnap = await db.collection("users").doc(booking.providerId).get();
    const customerSnap = await db.collection("users").doc(booking.customerId).get();
    const customerName = customerSnap.data()?.fullName || "A customer";

    // Notify provider
    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await db.collection("notifications").doc(notificationId).set({
      notificationId,
      userId: booking.providerId,
      type: "booking",
      title: "New Booking Request",
      body: `${customerName} requested a booking for ${booking.serviceName || booking.serviceType || "a service"}`,
      route: `/booking-detail?bookingId=${event.params.bookingId}`,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error notifying new booking:", error);
  }
});

// Send notification when booking status changes
exports.onBookingStatusChange = onDocumentWritten("bookings/{bookingId}", async (event) => {
  const beforeData = event.data?.before?.exists ? event.data.before.data() : null;
  const afterData = event.data?.after?.exists ? event.data.after.data() : null;

  if (!afterData || beforeData?.status === afterData?.status) {
    return;
  }

  try {
    if (afterData.scheduledDate && afterData.scheduledTime && shouldReleaseBookingSlot(afterData.status)) {
      const providerSlotId = buildBookingSlotId(afterData.providerId, afterData.scheduledDate, afterData.scheduledTime);
      await db.collection("bookingSlots").doc(providerSlotId).delete().catch(() => undefined);
      if (afterData.customerId) {
        const customerSlotId = buildCustomerBookingSlotId(afterData.customerId, afterData.scheduledDate, afterData.scheduledTime);
        await db.collection("customerBookingSlots").doc(customerSlotId).delete().catch(() => undefined);
      }
    }

    const { customerId, providerId, status } = afterData;
    const booking = afterData;

    let notifyUserId = null;
    let title = "";
    let body = "";

    if (status === "Accepted") {
      notifyUserId = customerId;
      title = "Booking Accepted";
      body = "Your booking request has been accepted";
    } else if (status === "On the Way") {
      notifyUserId = customerId;
      title = "Provider is On the Way";
      body = "Your service provider is on the way";
    } else if (status === "In Progress") {
      notifyUserId = customerId;
      title = "Service Started";
      body = "Your service has started";
    } else if (status === "Completed") {
      notifyUserId = customerId;
      title = "Service Completed";
      body = "Your service is complete. Please leave a review";
    } else if (status === "Cancelled") {
      notifyUserId = providerId;
      title = "Booking Cancelled";
      body = "A booking has been cancelled";
    }

    if (notifyUserId) {
      const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await db.collection("notifications").doc(notificationId).set({
        notificationId,
        userId: notifyUserId,
        type: "booking_update",
        title,
        body,
        route: `/booking-detail?bookingId=${event.params.bookingId}`,
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    if (status === "Completed" && providerId) {
      await generateCommissionBill(providerId, new Date()).catch((error) => {
        console.error("Error generating commission bill after booking completion:", error);
      });
      await recomputeWorkerFinanceSummary(providerId).catch((error) => {
        console.error("Error recomputing worker finance after booking completion:", error);
      });
    }
    if (status === "Accepted" && providerId) {
      await syncAcceptedBookingCommission(event.params.bookingId).catch((error) => {
        console.error("Error syncing commission after accepted booking trigger:", error);
      });
    }
  } catch (error) {
    console.error("Error notifying booking status change:", error);
  }
});

// Send notification when provider application status changes
exports.onProviderApplicationStatusChange = onDocumentWritten("providerApplications/{applicationId}", async (event) => {
  const beforeData = event.data?.before?.exists ? event.data.before.data() : null;
  const afterData = event.data?.after?.exists ? event.data.after.data() : null;

  if (!afterData || beforeData?.status === afterData?.status) {
    return;
  }

  try {
    const { userId, status } = afterData;

    let title = "";
    let body = "";

    if (status === "Approved") {
      title = "Application Approved";
      body = "Congratulations! Your provider application has been approved";
    } else if (status === "Rejected") {
      title = "Application Rejected";
      body = "Your provider application was not approved. Check feedback in your profile";
    } else if (status === "Pending Approval") {
      title = "Application Received";
      body = "Your provider application is being reviewed";
    }

    if (title) {
      const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await db.collection("notifications").doc(notificationId).set({
        notificationId,
        userId,
        type: "provider_application",
        title,
        body,
        route: "/provider/onboarding",
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error notifying provider application status change:", error);
  }
});

// Send notification when payment is processed
exports.onPaymentProcessed = onDocumentCreated("payments/{paymentId}", async (event) => {
  const payment = event.data?.data();
  if (!payment?.customerId || !payment?.amount || !payment?.status) {
    return;
  }

  try {
    let notifyUserId = null;
    let title = "";
    let body = "";

    if (payment.status === "Paid" || payment.status === "Completed") {
      notifyUserId = payment.customerId;
      title = "Payment Received";
      body = `Payment of ₱${payment.amount.toFixed(2)} has been processed`;
    } else if (payment.status === "Failed") {
      notifyUserId = payment.customerId;
      title = "Payment Failed";
      body = `Payment of ₱${payment.amount.toFixed(2)} could not be processed`;
    } else if (payment.status === "Refunded") {
      notifyUserId = payment.customerId;
      title = "Refund Processed";
      body = `Refund of ₱${payment.amount.toFixed(2)} has been processed`;
    }

    if (notifyUserId) {
      const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await db.collection("notifications").doc(notificationId).set({
        notificationId,
        userId: notifyUserId,
        type: "payment",
        title,
        body,
        route: "/(tabs)/payments",
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    if (payment.providerId && payment.bookingId && payment.status === "Paid") {
      const bookingSnap = await db.collection("bookings").doc(payment.bookingId).get();
      const booking = bookingSnap.exists ? bookingSnap.data() : null;
      if (booking?.status === "Completed") {
        await generateCommissionBill(payment.providerId, new Date()).catch((error) => {
          console.error("Error generating commission bill after payment processed:", error);
        });
      }
    }
  } catch (error) {
    console.error("Error notifying payment processed:", error);
  }
});

exports.refreshMarketplaceAnalytics = onCall(webCallableOptions, async (request) => {
  await requireAdmin(request);
  return refreshMarketplaceAnalytics();
});

function commissionPreviewCycleBounds(date) {
  const { year, monthIndex, day } = manilaDateParts(date);

  if (day >= 29) {
    return {
      start: manilaDate(year, monthIndex, 29, 0, 0, 0, 0),
      end: manilaDate(year, monthIndex + 1, 28, 23, 59, 59, 999),
    };
  }

  return {
    start: manilaDate(year, monthIndex - 1, 29, 0, 0, 0, 0),
    end: manilaDate(year, monthIndex, 28, 23, 59, 59, 999),
  };
}

function commissionOfficialCycleBounds(date) {
  const { year, monthIndex, day } = manilaDateParts(date);

  if (day >= 28) {
    return {
      start: manilaDate(year, monthIndex - 1, 29, 0, 0, 0, 0),
      end: manilaDate(year, monthIndex, 28, 23, 59, 59, 999),
    };
  }

  return {
    start: manilaDate(year, monthIndex - 2, 29, 0, 0, 0, 0),
    end: manilaDate(year, monthIndex - 1, 28, 23, 59, 59, 999),
  };
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function generateCommissionBill(providerId, cycleDate) {
  const settings = await getWorkerPaymentSettings();
  if (!settings.commissionEnabled) return null;
  const { start, end } = commissionOfficialCycleBounds(cycleDate);
  const billId = `commission-${providerId}-${monthKey(end)}`;
  const existing = await db.collection("workerCommissionBills").doc(billId).get();
  const existingBill = existing.exists ? existing.data() : null;
  if (existingBill?.status === "Approved") return existingBill;
  const [bookingsSnap, paymentsSnap, summarySnap] = await Promise.all([
    db.collection("bookings").where("providerId", "==", providerId).get(),
    db.collection("payments").where("providerId", "==", providerId).get(),
    db.collection("workerFinanceSummaries").doc(providerId).get(),
  ]);
  const bookings = bookingsSnap.docs.map((entry) => entry.data());
  const paidByBookingId = new Map(paymentsSnap.docs.map((entry) => entry.data()).filter((payment) => payment.status === "Paid").map((payment) => [payment.bookingId, payment]));
  const activationTime = new Date((summarySnap.exists ? summarySnap.data()?.featureActivatedAt : null) || settings.featureActivatedAt).getTime();
  const allBillableBookings = bookings
    .filter((booking) => {
      const trackedAt = commissionBookingTime(booking).getTime();
      return isCommissionTrackedBooking(booking) && trackedAt >= activationTime;
    })
    .sort((a, b) => {
      const byDate = commissionBookingTime(a).getTime() - commissionBookingTime(b).getTime();
      return byDate || String(a.bookingId).localeCompare(String(b.bookingId));
    });
  const completedPaid = allBillableBookings.filter((booking) => {
    const trackedAt = commissionBookingTime(booking);
    return trackedAt >= start && trackedAt <= end;
  });
  if (!completedPaid.length) return null;
  const summary = summarySnap.exists ? summarySnap.data() : await createWorkerFinanceSummary(providerId);
  const priorCompletedPaidCount = allBillableBookings.filter((booking) => commissionBookingTime(booking) < start).length;
  const freeBeforeBill = Math.max(0, Number(settings.freeBookingsGranted || 5) - priorCompletedPaidCount);
  const freeApplied = Math.min(freeBeforeBill, completedPaid.length);
  const commissionableBookings = Math.max(0, completedPaid.length - freeApplied);
  const totalIncome = completedPaid.reduce((sum, booking) => sum + Number(paidByBookingId.get(booking.bookingId)?.amount ?? booking.amount ?? 0), 0);
  const commissionableIncome = completedPaid.slice(freeApplied).reduce((sum, booking) => sum + Number(paidByBookingId.get(booking.bookingId)?.amount ?? booking.amount ?? 0), 0);
  const dueDate = new Date(end.getFullYear(), end.getMonth() + 1, Number(settings.monthlyBillDueDay || 5), 23, 59, 59, 999);
  const graceEndsAt = new Date(dueDate);
  graceEndsAt.setDate(graceEndsAt.getDate() + Number(settings.gracePeriodDays || 3));
  const surchargeSnapshot = applyCommissionSurcharge(
    roundMoney(commissionableIncome * (Number(settings.commissionPercentage || 10) / 100)),
    graceEndsAt.toISOString(),
    Number(settings.lateSurchargeRate || 0)
  );
  const now = new Date().toISOString();
  const bill = {
    billId,
    providerId,
    userId: providerId,
    cycleStart: start.toISOString(),
    cycleEnd: end.toISOString(),
    generatedAt: existingBill?.generatedAt || now,
    dueDate: dueDate.toISOString(),
    graceEndsAt: graceEndsAt.toISOString(),
    status: existingBill?.status && existingBill.status !== "Waived" ? existingBill.status : commissionableBookings > 0 ? "Pending" : "Waived",
    totalIncome,
    totalCompletedPaidBookings: completedPaid.length,
    freeBookingsAppliedThisBill: freeApplied,
    freeBookingsRemainingAfterBill: Math.max(0, freeBeforeBill - freeApplied),
    commissionableBookings,
    commissionPercentage: Number(settings.commissionPercentage || 10),
    baseCommissionAmount: surchargeSnapshot.baseCommissionAmount,
    surchargeRateApplied: surchargeSnapshot.surchargeRateApplied,
    surchargeDaysApplied: surchargeSnapshot.surchargeDaysApplied,
    surchargeAmount: surchargeSnapshot.surchargeAmount,
    amountDue: surchargeSnapshot.amountDue,
    createdAt: existingBill?.createdAt || now,
    updatedAt: now,
  };
  const batch = db.batch();
  batch.set(db.collection("workerCommissionBills").doc(billId), bill, { merge: true });
  completedPaid.forEach((booking, index) => {
    const paymentAmount = Number(paidByBookingId.get(booking.bookingId)?.amount ?? booking.amount ?? 0);
    const isCommissionable = index >= freeApplied;
    batch.set(
      db.collection("bookings").doc(booking.bookingId),
      {
        commissionEvaluated: true,
        commissionable: isCommissionable,
        usedFreeBookingAllowance: !isCommissionable,
        commissionPercentage: Number(settings.commissionPercentage || 10),
        commissionAmount: isCommissionable ? roundMoney(paymentAmount * (Number(settings.commissionPercentage || 10) / 100)) : 0,
        commissionBillId: isCommissionable ? billId : "",
      },
      { merge: true }
    );
  });
  await batch.commit();
  await recomputeWorkerFinanceSummary(providerId);
  await createNotification(
    providerId,
    "monthly_bill_generated",
    bill.status === "Waived" ? "Monthly commission waived" : "Monthly commission bill generated",
    bill.status === "Waived"
      ? "Your completed paid bookings were covered by your free booking allowance."
      : `Your monthly commission bill is PHP ${bill.amountDue.toLocaleString()}. Payment opens on the 28th, is due on ${dueDate.toLocaleDateString()}, and has a grace period until ${new Date(bill.graceEndsAt).toLocaleDateString()}.`,
    "/(tabs)/profile"
  ).catch(() => undefined);
  return bill;
}

exports.releaseCurrentWorkerCommissionBill = onCall(webCallableOptions, async (request) => {
  const uid = requireSignedIn(request);
  const providerId = String(request.data?.providerId || uid);
  const adminTriggered = providerId !== uid;
  if (adminTriggered && !(await isAdminUser(uid))) {
    throw new HttpsError("permission-denied", "You can only release your own commission bill.");
  }

  const { day } = manilaDateParts(new Date());
  if (day < 28) {
    throw new HttpsError("failed-precondition", "Official commission billing is only available starting on the 28th day of the month.");
  }

  const bill = await generateCommissionBill(providerId, new Date());
  await recomputeWorkerFinanceSummary(providerId).catch((error) => {
    console.error("Error recomputing worker finance after releasing current commission bill:", error);
  });
  if (bill && adminTriggered) {
    await createAuditLog(
      uid,
      "monthly_commission_bill_generated",
      "workerCommissionBills",
      bill.billId,
      "Admin manually released the current worker commission bill.",
      { providerId, amountDue: Number(bill.amountDue || 0) }
    ).catch(() => undefined);
  }
  return bill || null;
});

exports.generateMonthlyWorkerCommissionBills = onSchedule(
  { schedule: "0 9 28 * *", timeZone: "Asia/Manila" },
  async () => {
    const now = new Date();
    const providers = await db.collection("providerProfiles").where("isApproved", "==", true).get();
    await Promise.all(providers.docs.map((entry) => generateCommissionBill(entry.id, now)));
  }
);

exports.markOverdueWorkerCommissionBills = onSchedule(
  { schedule: "0 1 * * *", timeZone: "Asia/Manila" },
  async () => {
    const now = new Date();
    const settings = await getWorkerPaymentSettings();
    const bills = await db.collection("workerCommissionBills").get();
    const entries = bills.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }));
    const overdue = entries
      .filter((bill) => ["Pending", "Submitted", "Rejected"].includes(bill.status) && new Date(bill.graceEndsAt) < now);
    const existingOverdue = entries
      .filter((bill) => bill.status === "Overdue");
    for (const bill of overdue) {
      const surchargeSnapshot = applyCommissionSurcharge(
        Number(bill.baseCommissionAmount ?? bill.amountDue ?? 0),
        bill.graceEndsAt,
        settings.lateSurchargeRate,
        now
      );
      await db.collection("workerCommissionBills").doc(bill.id).set({
        status: "Overdue",
        baseCommissionAmount: surchargeSnapshot.baseCommissionAmount,
        surchargeRateApplied: surchargeSnapshot.surchargeRateApplied,
        surchargeDaysApplied: surchargeSnapshot.surchargeDaysApplied,
        surchargeAmount: surchargeSnapshot.surchargeAmount,
        amountDue: surchargeSnapshot.amountDue,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      await recomputeWorkerFinanceSummary(bill.providerId);
      await createNotification(
        bill.userId || bill.providerId,
        "worker_restricted_finance",
        "Commission payment overdue",
        `Your monthly commission payment is overdue. A PHP ${Number(settings.lateSurchargeRate || 0).toLocaleString()} per day surcharge is now being added and you cannot accept new bookings until the payment is settled.`,
        "/(tabs)/profile"
      ).catch(() => undefined);
    }
    for (const bill of existingOverdue) {
      const surchargeSnapshot = applyCommissionSurcharge(
        Number(bill.baseCommissionAmount ?? bill.amountDue ?? 0),
        bill.graceEndsAt,
        settings.lateSurchargeRate,
        now
      );
      await db.collection("workerCommissionBills").doc(bill.id).set({
        baseCommissionAmount: surchargeSnapshot.baseCommissionAmount,
        surchargeRateApplied: surchargeSnapshot.surchargeRateApplied,
        surchargeDaysApplied: surchargeSnapshot.surchargeDaysApplied,
        surchargeAmount: surchargeSnapshot.surchargeAmount,
        amountDue: surchargeSnapshot.amountDue,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      await recomputeWorkerFinanceSummary(bill.providerId);
    }
  }
);

exports.notifyUpcomingWorkerCommissionDue = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Manila" },
  async () => {
    const now = new Date();
    const todayKey = manilaDayKey(now);
    const bills = await db.collection("workerCommissionBills").get();
    const entries = bills.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    for (const bill of entries) {
      const dueDate = new Date(bill.dueDate);
      const dueSoonDate = new Date(dueDate);
      dueSoonDate.setDate(dueSoonDate.getDate() - 2);
      const graceDate = new Date(bill.graceEndsAt);
      const updates = { updatedAt: new Date().toISOString() };

      if (["Pending", "Submitted", "Rejected"].includes(bill.status)) {
        if (manilaDayKey(dueSoonDate) === todayKey && !bill.dueSoonReminderSentAt) {
          await createNotification(
            bill.userId || bill.providerId,
            "upcoming_payment_due",
            "Commission payment due soon",
            `Your monthly commission payment of PHP ${Number(bill.amountDue || 0).toLocaleString()} is due on ${new Date(bill.dueDate).toLocaleDateString()}.`,
            "/(tabs)/profile"
          ).catch(() => undefined);
          updates.dueSoonReminderSentAt = new Date().toISOString();
        }

        if (manilaDayKey(dueDate) === todayKey && !bill.dueDateReminderSentAt) {
          await createNotification(
            bill.userId || bill.providerId,
            "upcoming_payment_due",
            "Commission payment due today",
            `Your monthly commission payment is due today. Please pay PHP ${Number(bill.amountDue || 0).toLocaleString()} to avoid restriction.`,
            "/(tabs)/profile"
          ).catch(() => undefined);
          updates.dueDateReminderSentAt = new Date().toISOString();
        }

        if (manilaDayKey(graceDate) === todayKey && !bill.graceReminderSentAt) {
          await createNotification(
            bill.userId || bill.providerId,
            "upcoming_payment_due",
            "Final grace period reminder",
            `Today is the last grace day for your monthly commission payment. Pay PHP ${Number(bill.amountDue || 0).toLocaleString()} today to avoid a daily surcharge and booking restriction.`,
            "/(tabs)/profile"
          ).catch(() => undefined);
          updates.graceReminderSentAt = new Date().toISOString();
        }
      }

      if (bill.status === "Overdue" && bill.lastOverdueReminderSentAt !== todayKey) {
        await createNotification(
          bill.userId || bill.providerId,
          "worker_restricted_finance",
          "Commission payment still overdue",
          `Your commission balance of PHP ${Number(bill.amountDue || 0).toLocaleString()} is still overdue. Booking actions stay locked until this payment is approved.`,
          "/(tabs)/profile"
        ).catch(() => undefined);
        updates.lastOverdueReminderSentAt = todayKey;
      }

      if (Object.keys(updates).length > 1) {
        await db.collection("workerCommissionBills").doc(bill.id).set(updates, { merge: true });
      }
    }
  }
);

exports.refreshAnalyticsOnMarketplaceWrite = onDocumentWritten(
  "{collectionId}/{documentId}",
  async (event) => {
    const trackedCollections = new Set([
      "users",
      "providerProfiles",
      "providerApplications",
      "bookings",
      "payments",
      "complaints",
    ]);

    if (!trackedCollections.has(event.params.collectionId)) {
      return;
    }

    await refreshMarketplaceAnalytics();
  }
);

exports.exportMarketplaceBackup = onCall(webCallableOptions, async (request) => {
  const adminId = await requireAdmin(request);
  const [users, providers, applications, bookings, payments, complaints, categories] = await Promise.all([
    db.collection("users").get(),
    db.collection("providerProfiles").get(),
    db.collection("providerApplications").get(),
    db.collection("bookings").get(),
    db.collection("payments").get(),
    db.collection("complaints").get(),
    db.collection("serviceCategories").get(),
  ]);

  await createAuditLog(adminId, "export_generated", "system", "marketplace-backup", "Marketplace backup exported.", {});
  return {
    users: users.docs.map((doc) => doc.data()),
    providers: providers.docs.map((doc) => doc.data()),
    applications: applications.docs.map((doc) => doc.data()),
    bookings: bookings.docs.map((doc) => doc.data()),
    payments: payments.docs.map((doc) => doc.data()),
    complaints: complaints.docs.map((doc) => doc.data()),
    categories: categories.docs.map((doc) => doc.data()),
    exportedAt: new Date().toISOString(),
  };
});

exports.cleanupDeletedMessageMedia = onDocumentDeleted("messages/{messageId}", async (event) => {
  const data = event.data?.data();
  const attachmentItems = data?.attachmentItems || [];
  const storage = admin.storage();
  await Promise.all(
    attachmentItems
      .map((item) => item?.storagePath)
      .filter(Boolean)
      .map(async (storagePath) => {
        try {
          await storage.bucket().file(storagePath).delete();
        } catch (error) {
          console.warn("Unable to delete message media", storagePath, error);
        }
      })
  );
});
