import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import {
  bookingService,
  categoryService,
  communityPostService,
  formatReadableDate,
  formatReadableMonthYear,
  formatReadableShortDateTime,
  paymentService,
  userService,
  workerPaymentService,
  type Booking,
  type CommunityPost,
  type CustomerProfile,
  type Payment,
  type ProviderProfile,
  type ServiceCategory,
  type WorkerCommissionBill,
  type WorkerFinanceSummary,
  type WorkerPaymentSettings,
  type WorkerRegistrationPayment
} from "@kabisig/shared";
import { AppHeader, Avatar, DateSelectField, FeedbackBanner, FixedScreen, FormInput, ImageUploadField, LaunchScreen, LoadingState, MultiMediaPickerField, SurfaceCard } from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { firebaseAuth } from "../../src/services/firebase";
import { useThemeMode } from "../../src/hooks/ThemeProvider";
import { theme } from "../../src/theme";
import { readableAppError } from "../../src/utils/errors";

type ProfileTabKey = "posts" | "earnings" | "payments" | "more";

function formatCommissionReceiptNumber(bill: WorkerCommissionBill) {
  const cycle = new Date(bill.cycleStart);
  const month = String(cycle.getMonth() + 1).padStart(2, "0");
  const year = String(cycle.getFullYear()).slice(-2);
  const suffix = bill.billId.slice(-4).toUpperCase();
  return `KAB-${month}${year}-${suffix}`;
}

function commissionPreviewCycleBounds(date: Date) {
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const day = date.getDate();

  if (day >= 29) {
    return {
      start: new Date(year, monthIndex, 29, 0, 0, 0, 0),
      end: new Date(year, monthIndex + 1, 28, 23, 59, 59, 999),
    };
  }

  return {
    start: new Date(year, monthIndex - 1, 29, 0, 0, 0, 0),
    end: new Date(year, monthIndex, 28, 23, 59, 59, 999),
  };
}

function commissionOfficialCycleBounds(date: Date) {
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const day = date.getDate();

  if (day >= 28) {
    return {
      start: new Date(year, monthIndex - 1, 29, 0, 0, 0, 0),
      end: new Date(year, monthIndex, 28, 23, 59, 59, 999),
    };
  }

  return {
    start: new Date(year, monthIndex - 2, 29, 0, 0, 0, 0),
    end: new Date(year, monthIndex - 1, 28, 23, 59, 59, 999),
  };
}

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function ProfileStat({
  label,
  value,
  icon,
  tone = "blue",
  compact = false
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "blue" | "orange" | "green" | "rose";
  compact?: boolean;
}) {
  const palette = {
    blue: { bg: theme.colors.primarySoft, icon: theme.colors.primaryDark },
    orange: { bg: theme.dark ? theme.colors.warningSoft : "#FFF4E5", icon: theme.dark ? theme.colors.warning : theme.colors.accentDark },
    green: { bg: theme.colors.successSoft, icon: theme.colors.success },
    rose: { bg: theme.dark ? theme.colors.dangerSoft : "#FFE4EA", icon: theme.dark ? theme.colors.danger : "#E11D48" }
  }[tone];

  return (
    <View style={{ flex: 1, minWidth: compact ? 0 : 112, borderRadius: compact ? 14 : 18, padding: compact ? 9 : 13, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, gap: compact ? 5 : 8, alignItems: compact ? "center" : "flex-start" }}>
      <View style={{ width: compact ? 26 : 34, height: compact ? 26 : 34, borderRadius: compact ? 10 : 13, alignItems: "center", justifyContent: "center", backgroundColor: palette.bg }}>
        <Ionicons name={icon} size={compact ? 14 : 17} color={palette.icon} />
      </View>
      <Text style={{ color: theme.colors.text, fontSize: compact ? 13 : 20, fontWeight: "900", textAlign: compact ? "center" : "left" }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: compact ? 9 : 11, fontWeight: "800", textAlign: compact ? "center" : "left" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function MenuRow({ item }: { item: { label: string; icon: string; route: string; subtitle: string } }) {
  return (
    <Pressable onPress={() => router.push(item.route as never)}>
      <SurfaceCard style={{ flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderColor: theme.colors.border }}>
        <View style={{ width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.primarySoft }}>
          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={theme.colors.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 14 }}>{item.label}</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 2, lineHeight: 16, fontSize: 11 }} numberOfLines={2}>
            {item.subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={theme.colors.textLight} />
      </SurfaceCard>
    </Pressable>
  );
}

function getPostImageUris(post: CommunityPost) {
  return (post.attachmentItems?.length ? post.attachmentItems.map((media) => media.url) : post.attachments) || [];
}

function isRecoverableProfileSectionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  return (
    message.includes("permission-denied") ||
    message.includes("missing or insufficient permissions") ||
    message.includes("client is offline") ||
    message.includes("offline") ||
    message.includes("unavailable")
  );
}

async function loadProfileSection<T>(label: string, request: Promise<T>, fallback: T): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (!isRecoverableProfileSectionError(error)) {
      console.warn(`${label} unavailable:`, readableAppError(error, "Could not load this section right now."));
    }
    return fallback;
  }
}

function FacebookPhotoGrid({
  postId,
  imageUris,
  width
}: {
  postId: string;
  imageUris: string[];
  width: number;
}) {
  if (!imageUris.length) return null;

  const gap = 2;
  const visible = imageUris.slice(0, 4);
  const remaining = imageUris.length - visible.length;
  const half = (width - gap) / 2;

  if (imageUris.length === 1) {
    return <Image source={{ uri: imageUris[0] }} style={{ width, height: Math.min(width * 0.58, 260), backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />;
  }

  if (imageUris.length === 2) {
    return (
      <View style={{ width, flexDirection: "row", gap }}>
        {visible.map((uri, index) => (
          <Image key={`${postId}-photo-${index}-${uri}`} source={{ uri }} style={{ width: half, height: Math.min(width * 0.44, 210), backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
        ))}
      </View>
    );
  }

  if (imageUris.length === 3) {
    const gridHeight = Math.min(width * 0.54, 240);
    return (
      <View style={{ width, flexDirection: "row", gap }}>
        <Image source={{ uri: imageUris[0] }} style={{ width: half, height: gridHeight, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
        <View style={{ width: half, gap }}>
          {imageUris.slice(1, 3).map((uri, offset) => (
            <Image key={`${postId}-photo-${offset + 1}-${uri}`} source={{ uri }} style={{ width: "100%", height: (gridHeight - gap) / 2, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ width, flexDirection: "row", flexWrap: "wrap", gap }}>
      {visible.map((uri, index) => (
        <View key={`${postId}-photo-${index}-${uri}`} style={{ width: half, height: Math.min(half, 180) }}>
          <Image source={{ uri }} style={{ width: "100%", height: "100%", backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
          {index === 3 && remaining > 0 ? (
            <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.54)" }}>
              <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900" }}>+{remaining}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default function ProfileTab() {
  const { signOut, user } = useAuth();
  const { mode, setMode } = useThemeMode();
  const { width } = useWindowDimensions();
  const provider = user?.role === "provider";
  const [booting, setBooting] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [workerFinance, setWorkerFinance] = useState<WorkerFinanceSummary | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<WorkerPaymentSettings | null>(null);
  const [commissionBills, setCommissionBills] = useState<WorkerCommissionBill[]>([]);
  const [registrationPayment, setRegistrationPayment] = useState<WorkerRegistrationPayment | null>(null);
  const [commissionProof, setCommissionProof] = useState("");
  const [commissionReference, setCommissionReference] = useState("");
  const [commissionDate, setCommissionDate] = useState("");
  const [commissionReviewedByName, setCommissionReviewedByName] = useState("Kabisig Admin");
  const [submittingCommission, setSubmittingCommission] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [ownPosts, setOwnPosts] = useState<CommunityPost[]>([]);
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTabKey>("posts");
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [editingRequest, setEditingRequest] = useState<CommunityPost | null>(null);
  const [requestBody, setRequestBody] = useState("");
  const [requestCategoryId, setRequestCategoryId] = useState("");
  const [requestAddress, setRequestAddress] = useState("");
  const [requestSchedule, setRequestSchedule] = useState("");
  const [requestAttachments, setRequestAttachments] = useState<string[]>([]);
  const [savingRequest, setSavingRequest] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 1000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const unsubscribePosts = !provider && user?.id
        ? communityPostService.subscribePosts((items) => {
            if (active) setOwnPosts(items.filter((post) => post.customerId === user.id));
          })
        : undefined;

      async function load() {
        if (!user) {
          setOwnPosts([]);
          setBooting(false);
          return;
        }

        if (firebaseAuth.currentUser?.uid !== user.id) {
          setBooting(false);
          setFeedback({
            type: "error",
            title: "Sign in needs refresh",
            message: "Your local profile session is out of sync. Please sign out and sign in again.",
          });
          return;
        }

        setBooting(true);
        try {
          if (provider) {
            const [profile, nextBookings, nextPayments, finance, bills, registration, settings] = await Promise.all([
              loadProfileSection("Provider profile", userService.getProviderProfile(user.id), null),
              loadProfileSection("Provider bookings", bookingService.getProviderBookings(user.id), []),
              loadProfileSection("Provider payments", paymentService.getProviderEarnings(user.id), []),
              loadProfileSection("Worker finance", workerPaymentService.getFinanceSummary(user.id), null),
              loadProfileSection("Commission bills", workerPaymentService.getCommissionBills(user.id), []),
              loadProfileSection("Registration payment", workerPaymentService.getRegistrationPaymentByProvider(user.id), null),
              loadProfileSection("Worker payment settings", workerPaymentService.getSettings(), null)
            ]);
            let resolvedFinance = finance;
            let resolvedBills = bills;
            if (settings?.commissionEnabled && new Date().getDate() >= 28) {
              const releasedBill = await loadProfileSection("Current official commission bill", workerPaymentService.releaseCurrentCommissionBill(user.id), null);
              if (releasedBill) {
                [resolvedFinance, resolvedBills] = await Promise.all([
                  loadProfileSection("Worker finance refresh", workerPaymentService.getFinanceSummary(user.id), finance),
                  loadProfileSection("Commission bills refresh", workerPaymentService.getCommissionBills(user.id), bills),
                ]);
              }
            }
            if (!active) return;
            setProviderProfile(profile);
            setBookings(nextBookings);
            setPayments(nextPayments);
            setWorkerFinance(resolvedFinance);
            setCommissionBills(resolvedBills);
            setRegistrationPayment(registration);
            setPaymentSettings(settings);
          } else {
            const [profile, nextBookings, nextPayments, nextCategories] = await Promise.all([
              loadProfileSection("Customer profile", userService.getCustomerProfile(user.id), null),
              loadProfileSection("Customer bookings", bookingService.getCustomerBookings(user.id), []),
              loadProfileSection("Customer payments", paymentService.getCustomerPayments(user.id), []),
              loadProfileSection("Service categories", categoryService.getAllCategories(), [])
            ]);
            if (!active) return;
            setCustomerProfile(profile);
            setBookings(nextBookings);
            setPayments(nextPayments);
            setCategories(nextCategories);
          }
        } catch (error) {
          if (active) {
            setFeedback({ type: "error", title: "Profile data unavailable", message: readableAppError(error, "Some profile data could not be loaded right now.") });
          }
        } finally {
          if (active) setBooting(false);
        }
      }

      void load();
      return () => {
        active = false;
        unsubscribePosts?.();
      };
    }, [provider, user])
  );

  const actionCards = useMemo(
    () =>
      provider
        ? [
            { label: "Business profile", icon: "briefcase-outline", route: "/provider-business-profile", subtitle: "Edit business name, service areas, rates, and photo" },
            { label: "Portfolio", icon: "images-outline", route: "/provider-portfolio", subtitle: "Upload before and after work photos customers can trust" },
            { label: "Working days & schedule", icon: "calendar-outline", route: "/provider-schedule", subtitle: "Manage weekly availability" },
            { label: "Notifications", icon: "notifications-outline", route: "/notifications", subtitle: "Review alerts, job updates, and messages" },
            { label: "Terms and Agreement", icon: "document-text-outline", route: "/terms-agreement", subtitle: "Review platform terms" },
            { label: "Help & Support", icon: "help-buoy-outline", route: "/help", subtitle: "Open support, issues, and help" },
            { label: "About Kabisig", icon: "information-circle-outline", route: "/about", subtitle: "Learn about the platform" }
          ]
        : [
            { label: "Personal details", icon: "person-outline", route: "/profile-personal", subtitle: "Edit phone, location, addresses, and profile photo" },
            { label: "Favorite providers", icon: "heart-outline", route: "/saved-providers", subtitle: "View saved providers and book trusted people again" },
            { label: "Notifications", icon: "notifications-outline", route: "/notifications", subtitle: "Review booking, payment, and message updates" },
            { label: "Terms and Agreement", icon: "document-text-outline", route: "/terms-agreement", subtitle: "Review platform terms" },
            { label: "Help & Support", icon: "help-buoy-outline", route: "/help", subtitle: "Open support, issues, and help" },
            { label: "About Kabisig", icon: "information-circle-outline", route: "/about", subtitle: "Learn about the platform" }
          ],
    [provider]
  );

  const completedBookings = bookings.filter((booking) => booking.status === "Completed").length;
  const paidPayments = payments.filter((payment) => payment.status === "Paid");
  const paidBookingIds = new Set(paidPayments.map((payment) => payment.bookingId));
  const completedPaidBookings = bookings.filter((booking) => booking.status === "Completed" && paidBookingIds.has(booking.bookingId)).length;
  const totalFreeBookingsGranted = Math.max(workerFinance?.totalFreeBookingsGranted ?? 5, 1);
  const freeBookingsUsed = Math.min(totalFreeBookingsGranted, Math.max(workerFinance?.freeBookingsUsed ?? 0, completedPaidBookings));
  const totalPaid = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const selectedRequestCategory = categories.find((category) => category.id === requestCategoryId) || categories[0] || null;
  const portfolioItems = [...(providerProfile?.portfolio ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const providerCompletionItems = providerProfile
    ? [
        Boolean(providerProfile.displayName?.trim()),
        Boolean(providerProfile.businessName?.trim()),
        Boolean(providerProfile.profilePhotoUrl),
        Boolean(providerProfile.phone?.trim()),
        Boolean(providerProfile.address?.trim() || providerProfile.city?.trim()),
        providerProfile.serviceAreas.length > 0,
        providerProfile.serviceCategories.length > 0,
        Boolean(providerProfile.bio?.trim()),
        Boolean(providerProfile.qualifications?.trim()),
        providerProfile.availability.some((slot) => slot.available),
        portfolioItems.length > 0,
        Boolean(providerProfile.validIdUrl || providerProfile.permitCertificateUrl)
      ]
    : [];
  const profileCompletionPercent = providerCompletionItems.length
    ? Math.round((providerCompletionItems.filter(Boolean).length / providerCompletionItems.length) * 100)
    : 0;
  const tabItems = [
    { key: "posts" as const, label: provider ? "Portfolio" : "Requests", icon: provider ? "images-outline" as const : "newspaper-outline" as const, bg: theme.colors.primarySoft, color: theme.colors.primaryDark },
    { key: "earnings" as const, label: provider ? "Earnings" : "Payments", icon: provider ? "wallet-outline" as const : "card-outline" as const, bg: theme.colors.successSoft, color: theme.colors.success },
    ...(provider ? [{ key: "payments" as const, label: "Payments", icon: "receipt-outline" as const, bg: theme.dark ? "rgba(14,165,233,0.16)" : "#E0F2FE", color: theme.dark ? "#7DD3FC" : "#0369A1" }] : []),
    { key: "more" as const, label: "More", icon: "grid-outline" as const, bg: theme.dark ? theme.colors.warningSoft : "#FFF4E5", color: theme.dark ? theme.colors.warning : theme.colors.accentDark }
  ];
  const commissionPreviewBill = useMemo(() => {
    if (!provider || !paymentSettings?.commissionEnabled || !workerFinance) return null;
    const now = new Date();

    const { start, end } = commissionPreviewCycleBounds(now);
    const paidByBookingId = new Map(
      payments
        .filter((payment) => payment.status === "Paid")
        .map((payment) => [payment.bookingId, payment])
    );
    const activationTime = new Date(workerFinance.featureActivatedAt || paymentSettings.featureActivatedAt).getTime();
    const cycleBookings = bookings
      .filter((booking) => {
        const trackedAt = new Date(booking.workerAcceptedAt || booking.updatedAt || booking.createdAt).getTime();
        return (
          ["Accepted", "On the Way", "In Progress", "Completed"].includes(booking.status) &&
          trackedAt >= activationTime &&
          trackedAt >= start.getTime() &&
          trackedAt <= Math.min(end.getTime(), now.getTime()) &&
          paidByBookingId.has(booking.bookingId)
        );
      })
      .sort((left, right) => {
        const leftTime = new Date(left.workerAcceptedAt || left.updatedAt || left.createdAt).getTime();
        const rightTime = new Date(right.workerAcceptedAt || right.updatedAt || right.createdAt).getTime();
        return leftTime - rightTime || left.bookingId.localeCompare(right.bookingId);
      });

    const allEligiblePaidBookings = bookings
      .filter((booking) => {
        const trackedAt = new Date(booking.workerAcceptedAt || booking.updatedAt || booking.createdAt).getTime();
        return (
          ["Accepted", "On the Way", "In Progress", "Completed"].includes(booking.status) &&
          trackedAt >= activationTime &&
          trackedAt <= Math.min(end.getTime(), now.getTime()) &&
          paidByBookingId.has(booking.bookingId)
        );
      })
      .sort((left, right) => {
        const leftTime = new Date(left.workerAcceptedAt || left.updatedAt || left.createdAt).getTime();
        const rightTime = new Date(right.workerAcceptedAt || right.updatedAt || right.createdAt).getTime();
        return leftTime - rightTime || left.bookingId.localeCompare(right.bookingId);
      });

    const priorCompletedPaidCount = allEligiblePaidBookings.filter((booking) => {
      const trackedAt = new Date(booking.workerAcceptedAt || booking.updatedAt || booking.createdAt).getTime();
      return trackedAt < start.getTime();
    }).length;
    const freeBeforeBill = Math.max(0, totalFreeBookingsGranted - priorCompletedPaidCount);
    const freeApplied = Math.min(freeBeforeBill, cycleBookings.length);
    const totalIncome = cycleBookings.reduce((sum, booking) => sum + Number(paidByBookingId.get(booking.bookingId)?.amount ?? booking.amount ?? 0), 0);
    const commissionableIncome = cycleBookings.slice(freeApplied).reduce((sum, booking) => sum + Number(paidByBookingId.get(booking.bookingId)?.amount ?? booking.amount ?? 0), 0);
    const baseCommissionAmount = Math.round(commissionableIncome * ((paymentSettings.commissionPercentage || 10) / 100) * 100) / 100;
    const dueDate = new Date(end.getFullYear(), end.getMonth() + 1, paymentSettings.monthlyBillDueDay || 5, 23, 59, 59, 999);
    const graceEndsAt = new Date(dueDate);
    graceEndsAt.setDate(graceEndsAt.getDate() + (paymentSettings.gracePeriodDays || 3));

    return {
      billId: `preview-${user?.id || "worker"}-${start.toISOString()}`,
      providerId: user?.id || "",
      userId: user?.id || "",
      cycleStart: start.toISOString(),
      cycleEnd: end.toISOString(),
      generatedAt: end.toISOString(),
      dueDate: dueDate.toISOString(),
      graceEndsAt: graceEndsAt.toISOString(),
      status: "Pending" as const,
      totalIncome,
      totalCompletedPaidBookings: cycleBookings.length,
      freeBookingsAppliedThisBill: freeApplied,
      freeBookingsRemainingAfterBill: Math.max(0, freeBeforeBill - freeApplied),
      commissionableBookings: Math.max(0, cycleBookings.length - freeApplied),
      commissionPercentage: paymentSettings.commissionPercentage || 10,
      baseCommissionAmount,
      surchargeRateApplied: paymentSettings.lateSurchargeRate || 5,
      surchargeDaysApplied: 0,
      surchargeAmount: 0,
      amountDue: baseCommissionAmount,
      createdAt: start.toISOString(),
      updatedAt: now.toISOString(),
    } satisfies WorkerCommissionBill;
  }, [bookings, payments, paymentSettings, provider, totalFreeBookingsGranted, user?.id, workerFinance]);
  const currentCycleOfficialBill = useMemo(() => {
    if (!provider || !user?.id) return null;
    const { end } = commissionOfficialCycleBounds(new Date());
    const currentBillId = `commission-${user.id}-${monthKeyFromDate(end)}`;
    return commissionBills.find((bill) => bill.billId === currentBillId) || null;
  }, [commissionBills, provider, user?.id]);
  const activeOfficialBill = commissionBills.find((bill) => ["Pending", "Submitted", "Rejected", "Overdue"].includes(bill.status)) || null;
  const currentCommissionBill = activeOfficialBill || currentCycleOfficialBill || commissionPreviewBill || commissionBills[0] || null;
  const commissionDisplayIsPreview = Boolean(commissionPreviewBill && currentCommissionBill?.billId === commissionPreviewBill.billId);
  const commissionBillingReleased = Boolean(currentCommissionBill && !commissionDisplayIsPreview);
  const commissionStatus = currentCommissionBill?.status || "Pending";
  const commissionBillApproved = currentCommissionBill?.status === "Approved";
  const commissionBaseAmount = Number(currentCommissionBill?.baseCommissionAmount ?? currentCommissionBill?.amountDue ?? 0);
  const commissionSurchargeAmount = Number(currentCommissionBill?.surchargeAmount || 0);
  const commissionAmountDue = currentCommissionBill && ["Approved", "Waived", "Not Required"].includes(currentCommissionBill.status) ? 0 : Number(currentCommissionBill?.amountDue || 0);
  const commissionPaidAmount = currentCommissionBill?.status === "Approved" ? Number(currentCommissionBill.amountDue || 0) : 0;
  const commissionRate = Number(currentCommissionBill?.commissionPercentage || paymentSettings?.commissionPercentage || 10);
  const commissionLateRate = Number(currentCommissionBill?.surchargeRateApplied ?? paymentSettings?.lateSurchargeRate ?? 0);
  const commissionLateDays = Number(currentCommissionBill?.surchargeDaysApplied || 0);
  const commissionNeedsUpload = Boolean(currentCycleOfficialBill && ["Pending", "Rejected", "Overdue"].includes(currentCycleOfficialBill.status) && currentCycleOfficialBill.amountDue > 0);
  const commissionAwaitingReview = currentCommissionBill?.status === "Submitted";
  const commissionStatusPalette = commissionStatus === "Approved" || commissionStatus === "Waived"
    ? { bg: theme.colors.successSoft, fg: theme.colors.success, icon: "checkmark-done-circle-outline" as const }
    : commissionStatus === "Overdue" || commissionStatus === "Rejected"
      ? { bg: theme.colors.dangerSoft, fg: theme.colors.danger, icon: "alert-circle-outline" as const }
      : commissionStatus === "Submitted"
        ? { bg: theme.dark ? "rgba(14,165,233,0.16)" : "#E0F2FE", fg: theme.dark ? "#7DD3FC" : "#0369A1", icon: "hourglass-outline" as const }
        : { bg: theme.dark ? theme.colors.warningSoft : "#FFF4E5", fg: theme.dark ? theme.colors.warning : theme.colors.accentDark, icon: "time-outline" as const };
  const commissionCycleLabel = currentCommissionBill
    ? formatReadableMonthYear(currentCommissionBill.cycleStart)
    : "";
  const commissionCoverageLabel = currentCommissionBill
    ? `${formatReadableDate(currentCommissionBill.cycleStart)} - ${formatReadableDate(currentCommissionBill.cycleEnd)}`
    : "";
  const commissionBookingBreakdown = useMemo(() => {
    if (!currentCommissionBill) return [];

    const cycleStart = new Date(currentCommissionBill.cycleStart);
    const cycleEnd = new Date(currentCommissionBill.cycleEnd);
    const paidByBookingId = new Map(
      payments
        .filter((payment) => payment.status === "Paid")
        .map((payment) => [payment.bookingId, payment])
    );

    const cycleBookings = bookings
      .filter((booking) => {
        const trackedAt = new Date(booking.workerAcceptedAt || booking.updatedAt || booking.createdAt);
        return (
          ["Accepted", "On the Way", "In Progress", "Completed"].includes(booking.status) &&
          trackedAt >= cycleStart &&
          trackedAt <= cycleEnd &&
          paidByBookingId.has(booking.bookingId)
        );
      })
      .sort((left, right) => {
        const leftTime = new Date(left.workerAcceptedAt || left.updatedAt || left.createdAt).getTime();
        const rightTime = new Date(right.workerAcceptedAt || right.updatedAt || right.createdAt).getTime();
        return leftTime - rightTime;
      });

    return cycleBookings.map((booking, index) => {
      const payment = paidByBookingId.get(booking.bookingId);
      const amount = Number(payment?.amount ?? booking.amount ?? 0);
      const freeCovered = index < currentCommissionBill.freeBookingsAppliedThisBill;
      const commissionAmount = freeCovered ? 0 : Number(booking.commissionAmount ?? Math.round(amount * (commissionRate / 100) * 100) / 100);
      return {
        bookingId: booking.bookingId,
        serviceName: booking.serviceName,
        scheduledAt: booking.scheduledAt,
        address: booking.address || booking.location,
        amount,
        freeCovered,
        commissionAmount,
      };
    });
  }, [bookings, commissionRate, currentCommissionBill, payments]);
  const commissionStatusSteps = [
    { key: "bill", label: "Bill Ready" },
    { key: "proof", label: "Proof Sent" },
    { key: "review", label: "Admin Review" },
    { key: "approved", label: "Approved" },
  ];
  const commissionProgressIndex = commissionStatus === "Approved"
    ? 3
    : commissionStatus === "Submitted"
      ? 2
      : 0;

  useEffect(() => {
    let active = true;
    async function loadReviewerName() {
      const reviewerId = currentCommissionBill?.reviewedBy;
      if (!reviewerId) {
        setCommissionReviewedByName("Kabisig Admin");
        return;
      }
      const reviewer = await userService.getUserDocument(reviewerId).catch(() => null);
      if (active) {
        setCommissionReviewedByName(reviewer?.fullName || reviewer?.email || "Kabisig Admin");
      }
    }
    void loadReviewerName();
    return () => {
      active = false;
    };
  }, [currentCommissionBill?.reviewedBy]);

  async function submitCurrentCommissionPayment() {
    if (!user || !currentCycleOfficialBill || !commissionProof || !commissionReference.trim() || !commissionDate.trim()) {
      setFeedback({ type: "error", title: "Payment details needed", message: "Upload proof, reference number, and payment date before submitting." });
      return;
    }
    setSubmittingCommission(true);
    try {
      await workerPaymentService.submitCommissionPayment(currentCycleOfficialBill.billId, user.id, {
        proofImage: commissionProof,
        referenceNumber: commissionReference,
        paymentDate: commissionDate
      });
      setCommissionProof("");
      setCommissionReference("");
      setCommissionDate("");
      setCommissionBills(await workerPaymentService.getCommissionBills(user.id));
      setWorkerFinance(await workerPaymentService.getFinanceSummary(user.id));
      setFeedback({ type: "success", title: "Payment submitted", message: "Your commission payment proof is waiting for admin approval." });
    } catch (error) {
      setFeedback({ type: "error", title: "Submission failed", message: readableAppError(error, "We could not submit this payment right now.") });
    } finally {
      setSubmittingCommission(false);
    }
  }

  async function downloadWorkerPaymentQr() {
    const qrCodeUrl = paymentSettings?.activeQrCodeUrl;
    if (!qrCodeUrl) {
      setFeedback({ type: "error", title: "QR code unavailable", message: "The admin has not uploaded a payment QR code yet." });
      return;
    }

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const anchor = document.createElement("a");
      anchor.href = qrCodeUrl;
      anchor.download = "kabisig-admin-payment-qr.png";
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setFeedback({ type: "success", title: "QR code downloaded", message: "Use this QR code to pay the current admin payment due, then upload your proof." });
      return;
    }

    try {
      if (!FileSystem.documentDirectory) {
        throw new Error("This device does not expose an app documents folder.");
      }
      const targetUri = `${FileSystem.documentDirectory}kabisig-admin-payment-qr-${Date.now()}.png`;
      await FileSystem.downloadAsync(qrCodeUrl, targetUri);
      setFeedback({ type: "success", title: "QR code saved", message: "The payment QR code was saved inside the app documents folder." });
    } catch (error) {
      setFeedback({ type: "error", title: "Download failed", message: readableAppError(error, "We could not download the QR code right now.") });
    }
  }

  function openCommissionReceipt(bill: WorkerCommissionBill | null) {
    if (!bill || bill.status !== "Approved") {
      setFeedback({
        type: "error",
        title: "Receipt unavailable",
        message: "Receipt is available after admin approval."
      });
      return;
    }
    router.push({ pathname: "/commission-receipt", params: { billId: bill.billId } });
  }

  function openCommissionHistory() {
    router.push("/commission-history" as never);
  }

  function openRequestEditor(post: CommunityPost) {
    setActionRequestId(null);
    setEditingRequest(post);
    setRequestBody(post.body);
    setRequestCategoryId(post.serviceCategoryId);
    setRequestAddress(post.address);
    setRequestSchedule(post.preferredSchedule || "");
    setRequestAttachments(getPostImageUris(post));
  }

  async function saveRequestEdits() {
    if (!user || !editingRequest || !selectedRequestCategory || !requestBody.trim() || !requestAddress.trim() || savingRequest) {
      setFeedback({ type: "error", title: "Request incomplete", message: "Choose a service, describe the work, and add the service location." });
      return;
    }

    setSavingRequest(true);
    try {
      await communityPostService.updatePost(editingRequest.postId, {
        serviceCategoryId: selectedRequestCategory.id,
        serviceName: selectedRequestCategory.name,
        body: requestBody.trim(),
        address: requestAddress.trim(),
        location: requestAddress.trim(),
        preferredSchedule: requestSchedule.trim() || "Flexible schedule",
        amount: Number(selectedRequestCategory.startingPrice || editingRequest.amount || 0),
        attachments: requestAttachments
      });
      setEditingRequest(null);
      setFeedback({ type: "success", title: "Request updated", message: "Your service request was updated." });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", title: "Update failed", message: readableAppError(error, "We could not update this request right now.") });
    } finally {
      setSavingRequest(false);
    }
  }

  async function deleteRequest(post: CommunityPost) {
    if (!user || post.customerId !== user.id || deletingRequestId) return;
    setDeletingRequestId(post.postId);
    setActionRequestId(null);
    try {
      await communityPostService.deletePost(post.postId);
      setFeedback({ type: "success", title: "Request deleted", message: "Your service request and attached photos were removed." });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", title: "Delete failed", message: readableAppError(error, "We could not delete this request right now.") });
    } finally {
      setDeletingRequestId(null);
    }
  }

  if (booting) {
    return (
      <FixedScreen header={<AppHeader title="Profile" />} safeAreaEdges={["top", "left", "right"]} contentContainerStyle={{ paddingBottom: theme.spacing.xl }}>
        <LoadingState label="Loading profile..." />
      </FixedScreen>
    );
  }

  return (
    <>
      <Modal visible={loggingOut} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent>
        <LaunchScreen />
      </Modal>
      <Modal visible={confirmLogout} transparent animationType="fade" onRequestClose={() => setConfirmLogout(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.42)", justifyContent: "center", padding: 22 }}>
          <SurfaceCard style={{ gap: 14, padding: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.dangerSoft }}>
                <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "900" }}>Log out?</Text>
                <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12, lineHeight: 17 }}>You will need to sign in again to access your Kabisig account.</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => setConfirmLogout(false)} style={{ flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}>
                <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmLogout(false);
                  setLoggingOut(true);
                  setTimeout(() => void signOut(), 1000);
                }}
                style={{ flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center", backgroundColor: theme.colors.danger }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>Log out</Text>
              </Pressable>
            </View>
          </SurfaceCard>
        </View>
      </Modal>
      <Modal visible={Boolean(editingRequest)} transparent animationType="fade" onRequestClose={() => setEditingRequest(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.42)", justifyContent: "flex-end", padding: 18 }}>
            <SurfaceCard style={{ maxHeight: "88%", padding: 0, overflow: "hidden" }}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Edit request</Text>
                  <Pressable onPress={() => setEditingRequest(null)} style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt }}>
                    <Ionicons name="close" size={19} color={theme.colors.textMuted} />
                  </Pressable>
                </View>

                <TextInput
                  value={requestBody}
                  onChangeText={setRequestBody}
                  placeholder="What service do you need?"
                  placeholderTextColor={theme.colors.textLight}
                  multiline
                  style={{ minHeight: 108, borderRadius: 16, padding: 12, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, textAlignVertical: "top", fontSize: 14, lineHeight: 20 }}
                />

                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 12, gap: 10, backgroundColor: theme.colors.card }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Service type</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {categories.map((category) => {
                      const active = requestCategoryId === category.id;
                      return (
                        <Pressable key={category.id} onPress={() => setRequestCategoryId(category.id)} style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt }}>
                          <Text style={{ color: active ? theme.colors.textOnPrimary : theme.colors.text, fontSize: 12, fontWeight: "900" }}>{category.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 12, gap: 10, backgroundColor: theme.colors.card }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Schedule and location</Text>
                  <TextInput value={requestSchedule} onChangeText={setRequestSchedule} placeholder="Preferred schedule, optional" placeholderTextColor={theme.colors.textLight} style={{ borderRadius: 14, padding: 12, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, fontSize: 12 }} />
                  <TextInput value={requestAddress} onChangeText={setRequestAddress} placeholder="Type service address" placeholderTextColor={theme.colors.textLight} style={{ borderRadius: 14, padding: 12, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, fontSize: 12 }} />
                </View>

                <MultiMediaPickerField
                  label="Photos"
                  values={requestAttachments}
                  onChange={setRequestAttachments}
                  helper="Update the photos attached to this request."
                  maxSizeMb={8}
                  onError={(message) => setFeedback({ type: "error", title: "Upload issue", message })}
                />

                <Pressable onPress={() => void saveRequestEdits()} disabled={savingRequest} style={{ borderRadius: 15, paddingVertical: 13, alignItems: "center", backgroundColor: theme.colors.primary, opacity: savingRequest ? 0.7 : 1 }}>
                  <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>{savingRequest ? "Saving..." : "Save changes"}</Text>
                </Pressable>
              </ScrollView>
            </SurfaceCard>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FixedScreen
        safeAreaEdges={["top", "left", "right"]}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
        header={
          <>
            <AppHeader title="Profile" />
            {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
            <SurfaceCard style={{ padding: 11, borderColor: theme.colors.primarySoft, backgroundColor: theme.colors.card }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ borderRadius: 24, padding: 2, backgroundColor: theme.colors.primarySoft }}>
                  <Avatar
                    image={provider ? providerProfile?.profilePhotoUrl || user?.profilePhoto : customerProfile?.profilePhotoUrl || user?.profilePhoto}
                    size={46}
                    icon={provider ? "briefcase-outline" : "person-outline"}
                  />
                </View>
                <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900", flex: 1 }} numberOfLines={1}>
                      {provider ? providerProfile?.displayName || user?.fullName : user?.fullName}
                    </Text>
                    {providerProfile?.isApproved ? <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} /> : null}
                  </View>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>{user?.email}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                    <View style={{ flex: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: theme.colors.surfaceAlt }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: "800" }} numberOfLines={1}>
                        {provider ? `${completedBookings} jobs - ${portfolioItems.length} portfolio` : `${completedBookings} bookings - ${ownPosts.length} requests`}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </SurfaceCard>
          </>
        }
      >
        <SurfaceCard style={{ padding: 7, backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {tabItems.map((tab) => {
              const active = activeProfileTab === tab.key;
              return (
                <Pressable key={tab.key} onPress={() => setActiveProfileTab(tab.key)} style={{ flex: 1, borderRadius: 13, paddingVertical: 9, alignItems: "center", gap: 3, backgroundColor: active ? tab.bg : theme.colors.surfaceAlt, borderWidth: active ? 1 : 0, borderColor: active ? tab.color : "transparent" }}>
                  <Ionicons name={tab.icon} size={15} color={tab.color} />
                  <Text style={{ color: active ? tab.color : theme.colors.textMuted, fontSize: 10, fontWeight: "900" }}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </SurfaceCard>

        {activeProfileTab === "posts" ? (
          <View style={{ gap: 10 }}>
            {provider ? (
              <>
                <SurfaceCard style={{ padding: 14, gap: 10, backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primarySoft }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card }}>
                      <Ionicons name="images-outline" size={18} color={theme.colors.primaryDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Your portfolio</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>Before and after work samples customers can view.</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => router.push("/provider-portfolio" as never)} style={{ borderRadius: 12, paddingVertical: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: theme.colors.card }}>
                    <Ionicons name="add-circle-outline" size={16} color={theme.colors.primaryDark} />
                    <Text style={{ color: theme.colors.primaryDark, fontWeight: "900", fontSize: 12 }}>Manage portfolio</Text>
                  </Pressable>
                </SurfaceCard>

                {portfolioItems.length ? (
                  portfolioItems.map((item) => (
                    <SurfaceCard key={item.portfolioItemId} style={{ padding: 13, gap: 10 }}>
                      <View>
                        <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "900" }}>{item.title}</Text>
                        {item.description ? <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 }} numberOfLines={2}>{item.description}</Text> : null}
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {[
                          { label: "Before", uri: item.beforePhoto.url },
                          { label: "After", uri: item.afterPhoto.url }
                        ].map((photo) => (
                          <View key={`${item.portfolioItemId}-${photo.label}`} style={{ flex: 1, gap: 5 }}>
                            <Image source={{ uri: photo.uri }} style={{ width: "100%", aspectRatio: 1.25, borderRadius: 12, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
                            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "800", textAlign: "center" }}>{photo.label}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={{ color: theme.colors.textLight, fontSize: 11 }}>{new Date(item.createdAt).toLocaleString()}</Text>
                    </SurfaceCard>
                  ))
                ) : (
                  <SurfaceCard style={{ padding: 14, gap: 10 }}>
                    <Text style={{ color: theme.colors.text, fontWeight: "900", textAlign: "center" }}>No portfolio yet.</Text>
                    <Text style={{ color: theme.colors.textMuted, textAlign: "center", lineHeight: 18 }}>Add before and after photos so customers can see your completed work.</Text>
                  </SurfaceCard>
                )}
              </>
            ) : (
              <>
                <SurfaceCard style={{ padding: 12, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Avatar image={customerProfile?.profilePhotoUrl || user?.profilePhoto} size={38} />
                    <Pressable onPress={() => router.push("/(tabs)/post?compose=1" as never)} style={{ flex: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.colors.surfaceAlt }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: "800" }}>What service do you need?</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable onPress={() => router.push("/(tabs)/post?compose=1" as never)} style={{ flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: theme.colors.primarySoft }}>
                      <Ionicons name="create-outline" size={15} color={theme.colors.primaryDark} />
                      <Text style={{ color: theme.colors.primaryDark, fontWeight: "900", fontSize: 12 }}>Create request</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push("/(tabs)/post" as never)} style={{ flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: theme.colors.surfaceAlt }}>
                      <Ionicons name="people-outline" size={15} color={theme.colors.textMuted} />
                      <Text style={{ color: theme.colors.textMuted, fontWeight: "900", fontSize: 12 }}>Activity feed</Text>
                    </Pressable>
                  </View>
                </SurfaceCard>

                <SurfaceCard style={{ padding: 14, gap: 8, backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primarySoft }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card }}>
                      <Ionicons name="newspaper-outline" size={18} color={theme.colors.primaryDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Your requests</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>Private history, separate from the public news feed.</Text>
                    </View>
                  </View>
                </SurfaceCard>

                {ownPosts.length ? (
                  ownPosts.map((post) => {
                    const images = getPostImageUris(post);
                    const cardMediaWidth = Math.min(Math.max(width - theme.spacing.lg * 2 - 2, 260), 480);
                    return (
                      <SurfaceCard key={post.postId} style={{ padding: 0, gap: 0, overflow: "hidden", position: "relative", zIndex: actionRequestId === post.postId ? 20 : 0, elevation: actionRequestId === post.postId ? 8 : 0 }}>
                        <View style={{ flexDirection: "row", gap: 9, alignItems: "center", padding: 10 }}>
                          <Avatar image={customerProfile?.profilePhotoUrl || user?.profilePhoto} size={34} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 13 }} numberOfLines={1}>{user?.fullName || "Customer"}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                              <Text style={{ color: theme.colors.textMuted, fontSize: 10 }} numberOfLines={1}>{new Date(post.createdAt).toLocaleString()}</Text>
                              <Ionicons name="earth-outline" size={11} color={theme.colors.textMuted} />
                            </View>
                          </View>
                          <View style={{ borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: post.status === "Open" ? theme.colors.successSoft : theme.colors.surfaceAlt }}>
                            <Text style={{ color: post.status === "Open" ? theme.colors.success : theme.colors.textMuted, fontSize: 9, fontWeight: "900" }}>{post.status === "Open" ? "Available" : "Booked"}</Text>
                          </View>
                          <Pressable onPress={() => setActionRequestId((current) => current === post.postId ? null : post.postId)} style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt }}>
                            <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.textMuted} />
                          </Pressable>
                        </View>
                        {actionRequestId === post.postId ? (
                          <View style={{ position: "absolute", top: 50, right: 10, zIndex: 30, elevation: 10, width: 172, borderRadius: 14, padding: 6, gap: 5, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
                            {post.status === "Open" ? (
                              <Pressable onPress={() => openRequestEditor(post)} style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, alignItems: "center", flexDirection: "row", gap: 8, backgroundColor: theme.colors.surfaceAlt }}>
                                <Ionicons name="create-outline" size={15} color={theme.colors.text} />
                                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 12 }}>Edit request</Text>
                              </Pressable>
                            ) : null}
                            <Pressable onPress={() => void deleteRequest(post)} disabled={deletingRequestId === post.postId} style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, alignItems: "center", flexDirection: "row", gap: 8, backgroundColor: theme.colors.dangerSoft, opacity: deletingRequestId === post.postId ? 0.7 : 1 }}>
                              <Ionicons name="trash-outline" size={15} color={theme.colors.danger} />
                              <Text style={{ color: theme.colors.danger, fontWeight: "900", fontSize: 12 }}>{deletingRequestId === post.postId ? "Deleting..." : "Delete request"}</Text>
                            </Pressable>
                          </View>
                        ) : null}
                        <View style={{ gap: 7, paddingHorizontal: 10, paddingBottom: 9 }}>
                          <Text style={{ color: theme.colors.text, fontSize: 13, lineHeight: 18, fontWeight: "800" }} numberOfLines={3}>{post.body}</Text>
                          <View style={{ borderRadius: 11, padding: 8, gap: 3, backgroundColor: theme.colors.surfaceAlt }}>
                            <Text style={{ color: theme.colors.primaryDark, fontWeight: "900", fontSize: 11 }} numberOfLines={1}>Job type: {post.serviceName}</Text>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 10 }} numberOfLines={1}>Schedule: {post.preferredSchedule || "Flexible schedule"}</Text>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 10 }} numberOfLines={1}>Location: {post.address}</Text>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Starting budget: ₱{post.amount.toLocaleString()}</Text>
                          </View>
                        </View>
                        <FacebookPhotoGrid postId={post.postId} imageUris={images} width={cardMediaWidth} />
                        <View style={{ paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>{post.likes.length} like{post.likes.length === 1 ? "" : "s"}</Text>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>{post.comments.length} comment{post.comments.length === 1 ? "" : "s"}</Text>
                        </View>
                      </SurfaceCard>
                    );
                  })
                ) : (
                  <SurfaceCard style={{ padding: 14 }}>
                    <Text style={{ color: theme.colors.textMuted, textAlign: "center" }}>No requests yet.</Text>
                  </SurfaceCard>
                )}
              </>
            )}
          </View>
        ) : null}

        {activeProfileTab === "earnings" ? (
          <SurfaceCard style={{ gap: 12, padding: 14, backgroundColor: theme.colors.surfaceAlt }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card }}>
                <Ionicons name={provider ? "wallet-outline" : "card-outline"} size={19} color={theme.colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "900" }}>{provider ? "Earnings" : "Payments"}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>{provider ? "Track paid work and completed jobs." : "Review paid bookings and transactions."}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
              <ProfileStat label={provider ? "Paid" : "Paid total"} value={`₱${totalPaid.toLocaleString()}`} icon="cash-outline" tone="green" compact />
              <ProfileStat label="Transactions" value={payments.length} icon="receipt-outline" tone="blue" compact />
              <ProfileStat label="Completed" value={completedBookings} icon="briefcase-outline" tone="orange" compact />
            </View>
            <Pressable onPress={() => router.push((provider ? "/(tabs)/earnings" : "/(tabs)/payments") as never)} style={{ borderRadius: 15, paddingVertical: 12, alignItems: "center", backgroundColor: theme.colors.primary }}>
              <Text style={{ color: "#fff", fontWeight: "900" }}>{provider ? "Open earnings page" : "Open payments page"}</Text>
            </Pressable>
          </SurfaceCard>
        ) : null}

        {activeProfileTab === "payments" && provider ? (
          <View style={{ gap: 10 }}>
            <SurfaceCard style={{ gap: 12, padding: 14, backgroundColor: theme.colors.surfaceAlt }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card }}>
                  <Ionicons name="receipt-outline" size={19} color={theme.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "900" }}>Admin Payments</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>Official payment records for registration and monthly commission settlement.</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
                <ProfileStat label="Free used" value={`${freeBookingsUsed}/${totalFreeBookingsGranted}`} icon="gift-outline" tone="blue" compact />
                <ProfileStat label="Due" value={`PHP ${commissionAmountDue.toLocaleString()}`} icon="cash-outline" tone={currentCommissionBill?.status === "Overdue" ? "rose" : "orange"} compact />
                <ProfileStat label="Paid admin" value={`PHP ${(workerFinance?.totalCommissionPaid || commissionPaidAmount).toLocaleString()}`} icon="checkmark-done-outline" tone="green" compact />
              </View>
              <Pressable onPress={openCommissionHistory} style={{ borderRadius: 14, paddingVertical: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
                <Ionicons name="albums-outline" size={16} color={theme.colors.primaryDark} />
                <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Open billing history</Text>
              </Pressable>
            </SurfaceCard>

            {currentCommissionBill ? (
              <SurfaceCard style={{ padding: 14, gap: 12, borderColor: commissionStatusPalette.fg }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: commissionStatusPalette.bg }}>
                    <Ionicons name={commissionStatusPalette.icon} size={22} color={commissionStatusPalette.fg} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>{commissionBillApproved ? "Commission Payment Receipt" : "Monthly Commission Bill"}</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {commissionBillApproved
                        ? `Receipt for your settled ${commissionCycleLabel} admin commission.`
                        : `10% admin share after your first ${totalFreeBookingsGranted} paid bookings benefit.`}
                    </Text>
                  </View>
                  <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: commissionStatusPalette.bg }}>
                    <Text style={{ color: commissionStatusPalette.fg, fontSize: 11, fontWeight: "900" }}>{commissionStatus}</Text>
                  </View>
                </View>
                <View style={{ borderRadius: 16, padding: 12, gap: 10, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "900" }}>PAYMENT STATUS</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {commissionStatusSteps.map((step, index) => {
                      const active = index <= commissionProgressIndex;
                      return (
                        <View key={step.key} style={{ flex: 1, gap: 6 }}>
                          <View style={{ height: 7, borderRadius: 999, backgroundColor: active ? commissionStatusPalette.fg : theme.colors.border }} />
                          <Text style={{ color: active ? theme.colors.text : theme.colors.textMuted, fontSize: 10, fontWeight: "900" }}>{step.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 }}>
                    {commissionStatus === "Submitted"
                      ? "Your proof of payment has been submitted. Please wait for the admin to verify the payment."
                      : commissionStatus === "Rejected"
                        ? "Your previous proof was rejected. Please review the admin remarks and submit a corrected payment proof."
                      : commissionStatus === "Overdue"
                          ? `Your payment is beyond the ${paymentSettings?.gracePeriodDays || 3}-day grace period. You are temporarily blocked from accepting or matching bookings until you settle this bill.`
                          : commissionDisplayIsPreview && !commissionBillingReleased
                            ? `This is your running ${commissionRate}% commission total so far. Your finalized billing statement and payment QR will be released on ${formatReadableDate(currentCommissionBill?.cycleEnd || "")}.`
                          : commissionBillApproved
                            ? "The admin already approved this monthly commission payment."
                            : "This monthly bill is ready for payment."}
                  </Text>
                </View>
                {commissionBillApproved ? (
                  <View style={{ borderRadius: 18, padding: 14, gap: 12, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>OFFICIAL RECEIPT</Text>
                        <Text style={{ color: theme.colors.text, fontSize: 23, fontWeight: "900", marginTop: 5, fontVariant: ["tabular-nums"] }}>
                          PHP {commissionPaidAmount.toLocaleString()}
                        </Text>
                        <Text style={{ color: theme.colors.success, fontSize: 12, fontWeight: "900", marginTop: 3 }}>Payment received in full</Text>
                      </View>
                      <View style={{ borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: theme.colors.successSoft }}>
                        <Text style={{ color: theme.colors.success, fontSize: 10, fontWeight: "900" }}>PAID 10% COMMISSION</Text>
                      </View>
                    </View>
                    <View style={{ gap: 8 }}>
                      {[
                        { label: "Receipt No.", value: formatCommissionReceiptNumber(currentCommissionBill) },
                        { label: "Billing Month", value: commissionCycleLabel },
                        { label: "Approved On", value: currentCommissionBill.reviewedAt ? formatReadableShortDateTime(currentCommissionBill.reviewedAt) : "Awaiting review timestamp" },
                        { label: "Reviewed By", value: commissionReviewedByName }
                      ].map((item) => (
                        <View key={item.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{item.label}</Text>
                          <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900", flexShrink: 1, textAlign: "right" }}>{item.value}</Text>
                        </View>
                      ))}
                    </View>
                    <Pressable
                      onPress={() => openCommissionReceipt(currentCommissionBill)}
                      style={{ borderRadius: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.success }}
                    >
                      <Ionicons name="receipt-outline" size={16} color={theme.colors.success} />
                      <Text style={{ color: theme.colors.success, fontWeight: "900" }}>Open Full Receipt</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ borderRadius: 16, padding: 12, gap: 10, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border }}>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "900" }}>MONTHLY STATEMENT</Text>
                    <Text style={{ color: commissionAmountDue > 0 ? theme.colors.danger : theme.colors.success, fontSize: 30, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
                      PHP {commissionAmountDue.toLocaleString()}
                    </Text>
                    <View style={{ gap: 7 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Coverage</Text>
                        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900", flexShrink: 1, textAlign: "right" }}>{commissionCoverageLabel}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total income for the month</Text>
                        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900" }}>PHP {currentCommissionBill.totalIncome.toLocaleString()}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Base {commissionRate}% admin share</Text>
                        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900" }}>PHP {commissionBaseAmount.toLocaleString()}</Text>
                      </View>
                      {commissionSurchargeAmount > 0 ? (
                        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Late surcharge (PHP {commissionLateRate.toLocaleString()}/day{commissionLateDays > 0 ? ` x ${commissionLateDays}` : ""})</Text>
                          <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: "900" }}>PHP {commissionSurchargeAmount.toLocaleString()}</Text>
                        </View>
                      ) : null}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Due date</Text>
                        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900" }}>{formatReadableDate(currentCommissionBill.dueDate)}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Grace period ends</Text>
                        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900" }}>{formatReadableDate(currentCommissionBill.graceEndsAt)}</Text>
                      </View>
                    </View>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 }}>
                      The first {totalFreeBookingsGranted} completed paid bookings are free from commission. Every booking after that contributes {commissionRate}% to admin. If payment exceeds the grace period, a daily overdue surcharge of PHP {(paymentSettings?.lateSurchargeRate || 5).toLocaleString()} is added starting the day after the grace period ends.
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { label: commissionBillApproved ? "Paid On" : "Due Date", value: formatReadableDate((commissionBillApproved ? currentCommissionBill.paymentDate : currentCommissionBill.dueDate) || currentCommissionBill.dueDate) },
                    { label: "Billing Month", value: commissionCycleLabel },
                    { label: "Completed Paid Bookings", value: currentCommissionBill.totalCompletedPaidBookings.toLocaleString() },
                    { label: "Free Bookings Applied", value: currentCommissionBill.freeBookingsAppliedThisBill.toLocaleString() },
                    { label: "Commissionable Bookings", value: currentCommissionBill.commissionableBookings.toLocaleString() },
                    { label: "Monthly Income", value: `PHP ${currentCommissionBill.totalIncome.toLocaleString()}` },
                    { label: commissionBillApproved ? "Commission Paid" : "Total Payable", value: commissionBillApproved ? `PHP ${commissionPaidAmount.toLocaleString()}` : `PHP ${commissionAmountDue.toLocaleString()}` }
                  ].map((item) => (
                    <View key={item.label} style={{ minWidth: "46%", flexGrow: 1, borderRadius: 14, padding: 10, backgroundColor: theme.colors.surfaceAlt, gap: 3 }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: "900" }}>{item.label}</Text>
                      <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "900" }}>{item.value}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ borderRadius: 16, padding: 12, gap: 10, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "900" }}>
                    {commissionBillApproved ? "Bookings covered by this receipt" : "Bookings included in this monthly bill"}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 }}>
                    These are the paid bookings counted for {commissionCycleLabel}. Free-booking coverage and commissionable jobs are shown below.
                  </Text>
                  {commissionBookingBreakdown.length ? (
                    <View style={{ gap: 8 }}>
                      {commissionBookingBreakdown.map((item) => (
                        <View key={item.bookingId} style={{ borderRadius: 14, padding: 11, gap: 6, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "900", flex: 1 }}>{item.serviceName}</Text>
                            <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: item.freeCovered ? theme.colors.infoSoft : theme.colors.successSoft }}>
                              <Text style={{ color: item.freeCovered ? theme.colors.info : theme.colors.success, fontSize: 10, fontWeight: "900" }}>
                                {item.freeCovered ? "FREE COVERED" : "COMMISSIONABLE"}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{item.scheduledAt}</Text>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={2}>{item.address}</Text>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Booking amount</Text>
                            <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900" }}>PHP {item.amount.toLocaleString()}</Text>
                          </View>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{item.freeCovered ? "Commission due" : `${commissionRate}% admin share`}</Text>
                            <Text style={{ color: item.freeCovered ? theme.colors.info : theme.colors.primaryDark, fontSize: 12, fontWeight: "900" }}>
                              PHP {item.commissionAmount.toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>No paid bookings are attached to this monthly bill yet.</Text>
                  )}
                </View>
                {!commissionBillApproved && !commissionDisplayIsPreview && commissionBillingReleased && paymentSettings?.activeQrCodeUrl ? (
                  <View style={{ borderRadius: 16, padding: 12, gap: 10, backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: "rgba(37,99,235,0.18)" }}>
                    <View style={{ gap: 10, alignItems: "center" }}>
                      <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900", textAlign: "center" }}>
                        Pay your {commissionRate}% admin share to {paymentSettings.paymentMethodName || "the admin payment account"}
                      </Text>
                      <Image source={{ uri: paymentSettings.activeQrCodeUrl }} style={{ width: 190, height: 190, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }} resizeMode="contain" />
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: "center" }}>
                        Scan this QR code to pay your monthly commission bill, then upload a clear payment screenshot together with the reference number and payment date for admin review.
                      </Text>
                    </View>
                    <Pressable onPress={() => void downloadWorkerPaymentQr()} style={{ borderRadius: 14, paddingVertical: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.primary }}>
                      <Ionicons name="download-outline" size={16} color={theme.colors.primaryDark} />
                      <Text style={{ color: theme.colors.primaryDark, fontWeight: "900" }}>Download QR Code</Text>
                    </Pressable>
                  </View>
                ) : !commissionBillApproved && !commissionDisplayIsPreview && commissionBillingReleased ? (
                  <View style={{ borderRadius: 14, padding: 12, backgroundColor: theme.colors.warningSoft, borderWidth: 1, borderColor: theme.colors.warning }}>
                    <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Admin Payment QR Unavailable</Text>
                    <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12 }}>Contact admin before sending your monthly commission payment.</Text>
                  </View>
                ) : commissionDisplayIsPreview && !commissionBillingReleased ? (
                  <View style={{ borderRadius: 14, padding: 12, backgroundColor: theme.colors.infoSoft, borderWidth: 1, borderColor: theme.colors.info }}>
                    <Text style={{ color: theme.colors.info, fontWeight: "900" }}>Official billing opens on the 28th</Text>
                    <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12 }}>
                      Your running commission total is visible now, but the finalized statement and QR code will only appear on {formatReadableDate(currentCommissionBill?.cycleEnd || "")}.
                    </Text>
                  </View>
                ) : null}
                {commissionAwaitingReview ? (
                  <View style={{ borderRadius: 14, padding: 12, backgroundColor: commissionStatusPalette.bg }}>
                    <Text style={{ color: commissionStatusPalette.fg, fontWeight: "900" }}>Waiting for admin approval</Text>
                    <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 12, lineHeight: 17 }}>
                      Reference: {currentCommissionBill.referenceNumber || "Not provided yet"}{"\n"}
                      Payment date: {currentCommissionBill.paymentDate ? formatReadableDate(currentCommissionBill.paymentDate) : "Not provided yet"}
                    </Text>
                  </View>
                ) : null}
                {currentCommissionBill.status === "Rejected" && currentCommissionBill.adminRemarks ? (
                  <View style={{ borderRadius: 14, padding: 12, backgroundColor: theme.colors.dangerSoft, borderWidth: 1, borderColor: theme.colors.danger }}>
                    <Text style={{ color: theme.colors.danger, fontWeight: "900" }}>Admin remarks</Text>
                    <Text style={{ color: theme.colors.text, marginTop: 4, fontSize: 12, lineHeight: 17 }}>{currentCommissionBill.adminRemarks}</Text>
                  </View>
                ) : null}
                {workerFinance?.restrictedFromAcceptingBookings ? (
                  <View style={{ borderRadius: 14, padding: 12, backgroundColor: theme.colors.dangerSoft, borderWidth: 1, borderColor: theme.colors.danger }}>
                    <Text style={{ color: theme.colors.danger, fontWeight: "900" }}>Booking access paused</Text>
                    <Text style={{ color: theme.colors.text, marginTop: 4, fontSize: 12, lineHeight: 17 }}>
                      {workerFinance.restrictionReason || "You need to settle your overdue commission payment before you can accept bookings, move jobs forward, or match posts again."}
                    </Text>
                  </View>
                ) : null}
                {commissionNeedsUpload ? (
                  <View style={{ gap: 8 }}>
                    <ImageUploadField
                      label="Commission Payment Proof"
                      value={commissionProof}
                      onChange={setCommissionProof}
                      maxSizeMb={5}
                      compact
                      helper="Upload a clear JPG, JPEG, PNG, or WEBP screenshot."
                    />
                    <FormInput label="Reference Number" value={commissionReference} onChangeText={setCommissionReference} placeholder="Reference number" />
                    <DateSelectField label="Payment Date" value={commissionDate} onChange={setCommissionDate} placeholder="Select payment date" maxDate={new Date()} />
                    <Pressable onPress={() => void submitCurrentCommissionPayment()} disabled={submittingCommission} style={{ borderRadius: 15, paddingVertical: 12, alignItems: "center", backgroundColor: theme.colors.primary, opacity: submittingCommission ? 0.7 : 1 }}>
                      <Text style={{ color: "#fff", fontWeight: "900" }}>{submittingCommission ? "Submitting..." : "Submit Payment Proof"}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </SurfaceCard>
            ) : (
              <SurfaceCard style={{ padding: 14, gap: 8 }}>
                <Text style={{ color: theme.colors.text, textAlign: "center", fontWeight: "900" }}>No official commission bill yet</Text>
                <Text style={{ color: theme.colors.textMuted, textAlign: "center", fontSize: 12, lineHeight: 18 }}>
                  Your finalized monthly bill appears on the 28th. If nothing appears after that, you likely have no completed paid bookings for this cycle or your bookings are still covered by the free booking allowance.
                </Text>
              </SurfaceCard>
            )}

            {commissionBills.length ? (
              <SurfaceCard style={{ padding: 13, gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>Recent commission records</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>Quick access to your latest official commission months.</Text>
                  </View>
                  <Pressable onPress={openCommissionHistory}>
                    <Text style={{ color: theme.colors.primaryDark, fontWeight: "900" }}>See all</Text>
                  </Pressable>
                </View>
                <View style={{ gap: 8 }}>
                  {commissionBills.slice(0, 3).map((bill) => (
                    <Pressable
                      key={bill.billId}
                      onPress={() => (bill.status === "Approved" ? openCommissionReceipt(bill) : openCommissionHistory())}
                      style={{ borderRadius: 14, padding: 11, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, gap: 6 }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <Text style={{ color: theme.colors.text, fontWeight: "900", flex: 1 }}>{formatReadableMonthYear(bill.cycleStart)}</Text>
                        <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: bill.status === "Approved" ? theme.colors.successSoft : bill.status === "Overdue" ? theme.colors.dangerSoft : theme.colors.warningSoft }}>
                          <Text style={{ color: bill.status === "Approved" ? theme.colors.success : bill.status === "Overdue" ? theme.colors.danger : theme.colors.accentDark, fontSize: 10, fontWeight: "900" }}>{bill.status}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total payable</Text>
                        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900" }}>PHP {Number(bill.amountDue || 0).toLocaleString()}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{bill.status === "Approved" ? "Paid date" : "Due date"}</Text>
                        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900" }}>{formatReadableDate((bill.status === "Approved" ? bill.paymentDate : bill.dueDate) || bill.dueDate)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </SurfaceCard>
            ) : null}

            <SurfaceCard style={{ padding: 13, gap: 9 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <View style={{ width: 36, height: 36, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt }}>
                  <Ionicons name="shield-checkmark-outline" size={17} color={theme.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>Registration Payment</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>One-time worker application fee reviewed before approval.</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <View style={{ flex: 1, minWidth: 118, borderRadius: 13, padding: 10, backgroundColor: theme.colors.surfaceAlt }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: "900" }}>Status</Text>
                  <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "900", marginTop: 3 }}>{registrationPayment?.status || workerFinance?.registrationPaymentStatus || "Pending"}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 118, borderRadius: 13, padding: 10, backgroundColor: theme.colors.surfaceAlt }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: "900" }}>Amount</Text>
                  <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "900", marginTop: 3 }}>PHP {(registrationPayment?.amount || 0).toLocaleString()}</Text>
                </View>
              </View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 }}>Purpose: this is the one-time worker application payment reviewed by admin before approval.</Text>
              {registrationPayment?.referenceNumber ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Reference: {registrationPayment.referenceNumber}</Text> : null}
              {registrationPayment?.adminRemarks ? <Text style={{ color: theme.colors.danger, fontSize: 12 }}>Admin Note: {registrationPayment.adminRemarks}</Text> : null}
            </SurfaceCard>
          </View>
        ) : null}

        {activeProfileTab === "more" ? (
          <View style={{ gap: 8 }}>
            {provider ? (
              <SurfaceCard style={{ padding: 12, gap: 10, backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primarySoft }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card }}>
                    <Ionicons name="checkmark-done-circle-outline" size={19} color={theme.colors.primaryDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>Profile strength</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>Your worker profile is {profileCompletionPercent}% complete.</Text>
                  </View>
                  <Text style={{ color: theme.colors.primaryDark, fontSize: 20, fontWeight: "900" }}>{profileCompletionPercent}%</Text>
                </View>
                <View style={{ height: 9, borderRadius: 999, backgroundColor: theme.colors.card, overflow: "hidden" }}>
                  <View style={{ width: `${profileCompletionPercent}%`, height: "100%", borderRadius: 999, backgroundColor: theme.colors.primary }} />
                </View>
                {profileCompletionPercent < 100 ? (
                  <Pressable onPress={() => router.push("/provider-business-profile" as never)} style={{ borderRadius: 12, paddingVertical: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: theme.colors.card }}>
                    <Ionicons name="create-outline" size={15} color={theme.colors.primaryDark} />
                    <Text style={{ color: theme.colors.primaryDark, fontSize: 12, fontWeight: "900" }}>Complete profile</Text>
                  </Pressable>
                ) : null}
              </SurfaceCard>
            ) : null}
            {actionCards.map((item) => <MenuRow key={item.label} item={item} />)}
            <SurfaceCard style={{ padding: 12 }}>
              <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>Appearance</Text>
              <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12, lineHeight: 17 }}>Switch the entire app between light, dark, or system appearance.</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {[
                  { key: "light" as const, label: "Light", icon: "sunny-outline" as const },
                  { key: "dark" as const, label: "Dark", icon: "moon-outline" as const },
                  { key: "system" as const, label: "System", icon: "phone-portrait-outline" as const }
                ].map((option) => {
                  const active = mode === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        setMode(option.key);
                        setFeedback({ type: "success", title: "Appearance updated", message: `Kabisig is now using ${option.label.toLowerCase()} mode.` });
                      }}
                      style={{ flex: 1, minWidth: 96, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt, borderWidth: 1, borderColor: active ? theme.colors.primary : theme.colors.border, alignItems: "center", gap: 4 }}
                    >
                      <Ionicons name={option.icon} size={16} color={active ? "#fff" : theme.colors.primaryDark} />
                      <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800", fontSize: 12 }}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </SurfaceCard>
            <Pressable onPress={() => setConfirmLogout(true)}>
              <SurfaceCard style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderColor: theme.colors.dangerSoft, backgroundColor: theme.colors.card }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.dangerSoft }}>
                  <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.danger, fontWeight: "900", fontSize: 14 }}>Logout</Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 2, lineHeight: 16, fontSize: 11 }}>Sign out of this Kabisig account</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={theme.colors.danger} />
              </SurfaceCard>
            </Pressable>
          </View>
        ) : null}
      </FixedScreen>
    </>
  );
}
