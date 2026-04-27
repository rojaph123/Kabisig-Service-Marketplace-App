const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentDeleted, onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { randomUUID } = require("crypto");

admin.initializeApp();

const db = admin.firestore();

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

function buildStorageDownloadUrl(bucketName, storagePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function buildBookingSlotId(providerId, scheduledDate, scheduledTime) {
  return `${providerId}_${scheduledDate}_${scheduledTime}`
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-");
}

function shouldReleaseBookingSlot(status) {
  return status === "Cancelled" || status === "Completed";
}

async function getActorRole(uid) {
  const userSnap = await db.collection("users").doc(uid).get();
  return userSnap.exists ? userSnap.data()?.role : null;
}

function assertBookingStatusTransition({ booking, nextStatus, actorId, actorRole }) {
  const providerStatuses = new Set(["Accepted", "On the Way", "In Progress", "Completed"]);
  if (actorRole === "admin") return;

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

exports.uploadMediaAsset = onCall(async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { dataUrl, storagePath, mimeType, fileName, uploadedBy } = request.data || {};
  if (!dataUrl || !storagePath || typeof dataUrl !== "string" || typeof storagePath !== "string") {
    throw new HttpsError("invalid-argument", "dataUrl and storagePath are required.");
  }
  if (uploadedBy && uploadedBy !== auth.uid) {
    throw new HttpsError("permission-denied", "You can only upload files for your own account.");
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

exports.submitProviderApplication = onCall(async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { applicationId, userId, application, providerProfileUpdate } = request.data || {};
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

  const nextProfileUpdate = {
    ...providerProfileUpdate,
    approvalStatus: "Pending Approval",
    isApproved: false,
    moderation: { status: "active" },
    updatedAt: new Date().toISOString(),
  };

  const batch = db.batch();
  batch.set(db.collection("providerApplications").doc(applicationId), nextApplication, { merge: true });
  batch.set(db.collection("providerProfiles").doc(userId), nextProfileUpdate, { merge: true });
  await batch.commit();

  return { applicationId };
});

exports.approveProvider = onCall(async (request) => {
  const adminId = await requireAdmin(request);
  const { applicationId, userId } = request.data || {};
  if (!applicationId || !userId) {
    throw new HttpsError("invalid-argument", "applicationId and userId are required.");
  }

  const batch = db.batch();
  batch.set(
    db.collection("providerProfiles").doc(userId),
    {
      approvalStatus: "Approved",
      isApproved: true,
      moderation: { status: "active", changedAt: new Date().toISOString(), changedBy: adminId },
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
  await batch.commit();
  await createAuditLog(adminId, "provider_approved", "providerProfiles", userId, "Provider approved via Cloud Function.", { applicationId });
  return { ok: true };
});

exports.rejectProvider = onCall(async (request) => {
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

exports.requestProviderRevision = onCall(async (request) => {
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

exports.updateProviderModeration = onCall(async (request) => {
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

exports.createPaymentRecord = onCall(async (request) => {
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

  return { paymentId };
});

exports.updatePaymentStatus = onCall(async (request) => {
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
  return { ok: true };
});

exports.updateBookingStatus = onCall(async (request) => {
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
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  if (booking.scheduledDate && booking.scheduledTime && shouldReleaseBookingSlot(status)) {
    const slotId = buildBookingSlotId(booking.providerId, booking.scheduledDate, booking.scheduledTime);
    await db.collection("bookingSlots").doc(slotId).delete().catch(() => undefined);
  }

  return { ok: true };
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
        body: message.content?.substring(0, 100) || "Sent an attachment",
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
      body: `${customerName} requested a booking for ${booking.serviceType || "a service"}`,
      route: `/booking-request?bookingId=${event.params.bookingId}`,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error notifying new booking:", error);
  }
});

// Send notification when booking status changes
exports.onBookingStatusChange = onDocumentWritten("bookings/{bookingId}", async (change) => {
  const beforeData = change.before.data();
  const afterData = change.after.data();

  if (!afterData || beforeData?.status === afterData?.status) {
    return;
  }

  try {
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
      notifyUserId = status === "Cancelled" && beforeData?.status !== "Cancelled" ? (beforeData?.providerId === change.after.ref.parent.parent?.id ? customerId : providerId) : null;
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
        route: `/booking-detail?bookingId=${change.after.ref.id}`,
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error notifying booking status change:", error);
  }
});

// Send notification when provider application status changes
exports.onProviderApplicationStatusChange = onDocumentWritten("providerApplications/{applicationId}", async (change) => {
  const beforeData = change.before.data();
  const afterData = change.after.data();

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
    } else if (status === "Pending Review") {
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

    if (payment.status === "Completed") {
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
        route: "/payments",
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error notifying payment processed:", error);
  }
});

exports.refreshMarketplaceAnalytics = onCall(async (request) => {
  await requireAdmin(request);
  return refreshMarketplaceAnalytics();
});

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

exports.exportMarketplaceBackup = onCall(async (request) => {
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
