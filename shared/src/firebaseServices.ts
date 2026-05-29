/**
 * Shared Firebase service layer for Auth and Firestore operations
 * Used by both mobile and admin apps
 */

declare const require: (moduleName: string) => any;

import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  getAuth,
  signInWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
  type Auth,
  updateProfile,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  query,
  where,
  Query,
  DocumentData,
  QueryConstraint,
  deleteDoc,
  deleteField,
  WriteBatch,
  writeBatch,
  runTransaction,
  limit,
} from "firebase/firestore";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { deleteObject, getDownloadURL, getStorage, ref as storageRef, uploadString } from "firebase/storage";
import { getFirebaseConfig } from "./firebaseConfig";

// Lazy initialization - initialize Firebase only when first needed
let firebaseApp: any = null;
let firebaseAuth: any = null;
let firestore: any = null;
let firebaseStorage: any = null;
let firebaseFunctions: any = null;

function isReactNativeRuntime() {
  return typeof navigator !== "undefined" && navigator.product === "ReactNative";
}

function createFirebaseAuth(app: any): Auth {
  if (!isReactNativeRuntime()) {
    return getAuth(app);
  }

  try {
    const authReactNative = require("@firebase/auth") as {
      getAuth: typeof getAuth;
      initializeAuth: (app: any, deps?: { persistence?: unknown }) => Auth;
      getReactNativePersistence: (storage: unknown) => unknown;
    };
    const dynamicRequire = eval("require") as (moduleName: string) => any;
    const ReactNativeAsyncStorage = dynamicRequire("@react-native-async-storage/async-storage").default;

    try {
      return authReactNative.initializeAuth(app, {
        persistence: authReactNative.getReactNativePersistence(ReactNativeAsyncStorage),
      });
    } catch {
      return authReactNative.getAuth(app);
    }
  } catch {
    return getAuth(app);
  }
}

function initializeFirebase() {
  if (firebaseApp) return { firebaseApp, firebaseAuth, firestore, firebaseStorage, firebaseFunctions };

  try {
    const firebaseConfig = getFirebaseConfig();
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    firebaseAuth = createFirebaseAuth(firebaseApp);
    firestore = getFirestore(firebaseApp);
    firebaseStorage = getStorage(firebaseApp);
    firebaseFunctions = getFunctions(firebaseApp);
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw error;
  }

  return { firebaseApp, firebaseAuth, firestore, firebaseStorage, firebaseFunctions };
}

// Export getter functions for lazy access
export function getFirebaseApp() {
  return initializeFirebase().firebaseApp;
}

export function getFirebaseAuth() {
  return initializeFirebase().firebaseAuth;
}

export function getFirestore_() {
  return initializeFirebase().firestore;
}

export function getFirebaseStorage() {
  return initializeFirebase().firebaseStorage;
}

export function getFirebaseFunctions() {
  return initializeFirebase().firebaseFunctions;
}

import {
  AdminAuditLog,
  AdminRevenueRecord,
  AvailabilitySchedule,
  BookingConflictHistory,
  User,
  CustomerProfile,
  ProviderProfile,
  ProviderPortfolioItem,
  ProviderApplication,
  UploadedDocument,
  MediaAttachment,
  ServiceCategory,
  Booking,
  BookingChangeRequest,
  CommunityPost,
  CommunityPostComment,
  CommunityPostPhotoEngagement,
  Payment,
  MessageThread,
  Message,
  Review,
  NotificationItem,
  ComplaintReport,
  CoverageArea,
  ProviderApprovalStatus,
  PushNotificationToken,
  WorkerCommissionBill,
  WorkerFinanceSummary,
  WorkerPaymentSettings,
  WorkerRegistrationPayment,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function toStorageSafeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function detectMimeTypeFromDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,/);
  return match?.[1] || "application/octet-stream";
}

function estimateDataUrlSizeBytes(value: string) {
  const payload = value.split(",")[1] || "";
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function inferAttachmentKind(mimeType: string): MediaAttachment["kind"] {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  return "file";
}

function toMediaAttachmentFromUrl(url: string, fallbackName: string, uploadedBy?: string): MediaAttachment {
  const mimeType = url.startsWith("data:") ? detectMimeTypeFromDataUrl(url) : "application/octet-stream";
  return {
    id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    fileName: fallbackName,
    mimeType,
    sizeBytes: url.startsWith("data:") ? estimateDataUrlSizeBytes(url) : undefined,
    uploadedAt: nowIso(),
    uploadedBy,
    kind: inferAttachmentKind(mimeType),
  };
}

const PROVIDER_PORTFOLIO_MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const WORKER_PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
const WORKER_PAYMENT_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function defaultWorkerPaymentSettings(): WorkerPaymentSettings {
  const now = nowIso();
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

function coerceBooleanSetting(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function coerceNumberSetting(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWorkerPaymentSettings(
  data?: Partial<WorkerPaymentSettings>,
  defaults: WorkerPaymentSettings = defaultWorkerPaymentSettings()
): WorkerPaymentSettings {
  const merged = { ...defaults, ...(data || {}) };
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

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function applyCommissionSurcharge(
  baseCommissionAmount: number,
  graceEndsAt: string,
  lateSurchargeRate: number,
  now: Date = new Date()
) {
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

function assertMediaSize(value: string | MediaAttachment, maxSizeBytes: number, label: string) {
  const sizeBytes = typeof value === "string"
    ? value.startsWith("data:")
      ? estimateDataUrlSizeBytes(value)
      : undefined
    : value.sizeBytes;

  if (sizeBytes && sizeBytes > maxSizeBytes) {
    throw new Error(`${label} must be ${Math.round(maxSizeBytes / 1024 / 1024)} MB or smaller.`);
  }
}

function assertImageMedia(value: string | MediaAttachment, label: string) {
  const mimeType = typeof value === "string" ? detectMimeTypeFromDataUrl(value) : value.mimeType || "";
  if (mimeType && mimeType !== "application/octet-stream" && !mimeType.startsWith("image/")) {
    throw new Error(`${label} must be an image file.`);
  }
}

function assertWorkerPaymentProof(value: string | MediaAttachment, label: string) {
  assertMediaSize(value, WORKER_PAYMENT_PROOF_MAX_BYTES, label);
  const mimeType = typeof value === "string" ? detectMimeTypeFromDataUrl(value) : value.mimeType || "";
  if (mimeType && mimeType !== "application/octet-stream" && !WORKER_PAYMENT_IMAGE_TYPES.has(mimeType.toLowerCase())) {
    throw new Error(`${label} must be a JPG, JPEG, PNG, or WEBP image.`);
  }
}

function normalizeMediaInput(value: string | MediaAttachment, fallbackName: string, uploadedBy?: string): MediaAttachment {
  if (typeof value === "string") {
    return toMediaAttachmentFromUrl(value, fallbackName, uploadedBy);
  }
  return {
    ...value,
    fileName: value.fileName || fallbackName,
    uploadedAt: value.uploadedAt || nowIso(),
    uploadedBy: value.uploadedBy || uploadedBy,
  };
}

async function persistMediaAttachment(
  value: string | MediaAttachment,
  storagePath: string,
  fallbackName: string,
  uploadedBy?: string,
  maxSizeBytes?: number
): Promise<MediaAttachment> {
  const normalized = normalizeMediaInput(value, fallbackName, uploadedBy);
  if (maxSizeBytes) {
    assertMediaSize(normalized, maxSizeBytes, fallbackName);
  }
  if (!normalized.url.startsWith("data:")) {
    return normalized;
  }

  const mimeType = detectMimeTypeFromDataUrl(normalized.url);
  let uploadResult: {
    url: string;
    storagePath: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  try {
    uploadResult = await callFunction<
      {
        dataUrl: string;
        storagePath: string;
        mimeType: string;
        fileName: string;
        uploadedBy?: string;
        maxSizeBytes?: number;
      },
      {
        url: string;
        storagePath: string;
        mimeType?: string;
        sizeBytes?: number;
      }
    >("uploadMediaAsset", {
      dataUrl: normalized.url,
      storagePath,
      mimeType,
      fileName: normalized.fileName || fallbackName,
      uploadedBy,
      maxSizeBytes,
    });
  } catch (error) {
    if (!storagePath.startsWith("workerPayments/settings/") || !isPermissionDeniedError(error)) {
      throw error;
    }
    const ref = storageRef(getFirebaseStorage(), storagePath);
    await uploadString(ref, normalized.url, "data_url", {
      contentType: mimeType,
      customMetadata: {
        uploadedBy: uploadedBy || getFirebaseAuth().currentUser?.uid || "",
        originalFileName: normalized.fileName || fallbackName,
      },
    });
    uploadResult = {
      url: await getDownloadURL(ref),
      storagePath,
      mimeType,
      sizeBytes: normalized.sizeBytes,
    };
  }

  return {
    ...normalized,
    url: uploadResult.url,
    storagePath: uploadResult.storagePath || storagePath,
    mimeType: uploadResult.mimeType || mimeType,
    sizeBytes: uploadResult.sizeBytes ?? normalized.sizeBytes,
  };
}

async function callFunction<TInput extends Record<string, unknown>, TOutput = unknown>(
  name: string,
  payload: TInput
): Promise<TOutput> {
  const callable = httpsCallable<TInput, TOutput>(getFirebaseFunctions(), name);
  const response = await callable(payload);
  return response.data;
}

function isCallableUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("functions/not-found") ||
    message.includes("functions/unavailable") ||
    message.includes("internal") ||
    message.includes("not found") ||
    message.includes("network request failed")
  );
}

function isPermissionDeniedError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("permission-denied") || message.includes("missing or insufficient permissions");
}

function handleSnapshotError(label: string, error: unknown, fallback?: () => void) {
  if (isPermissionDeniedError(error)) {
    fallback?.();
    return;
  }

  console.error(`${label} listener error:`, error);
  fallback?.();
}

async function persistMediaAttachments(
  values: Array<string | MediaAttachment>,
  pathPrefix: string,
  uploadedBy?: string
): Promise<MediaAttachment[]> {
  return Promise.all(
    values.map((value, index) =>
      persistMediaAttachment(
        value,
        `${pathPrefix}/${Date.now()}-${index}-${toStorageSafeSegment(
          typeof value === "string" ? "attachment" : value.fileName || value.id || "attachment"
        )}`,
        typeof value === "string" ? `attachment-${index + 1}` : value.fileName || `attachment-${index + 1}`,
        uploadedBy
      )
    )
  );
}

function flattenMediaStoragePaths(items?: Array<string | MediaAttachment>) {
  return (items || [])
    .map((item) => (typeof item === "string" ? undefined : item.storagePath))
    .filter(Boolean) as string[];
}

function isFirestoreSafeUrl(value?: string) {
  return Boolean(value && !value.startsWith("data:") && value.length < 4000);
}

function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)).filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === "object") {
    const nextEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, sanitizeForFirestore(entry)]);
    return Object.fromEntries(nextEntries) as T;
  }

  return value;
}

function sortBookingsNewestFirst(items: Booking[]) {
  return [...items].sort((left, right) => {
    const rightKey = right.updatedAt || right.createdAt || right.scheduledAt || "";
    const leftKey = left.updatedAt || left.createdAt || left.scheduledAt || "";
    return rightKey.localeCompare(leftKey);
  });
}

const defaultServiceCategories: ServiceCategory[] = [
  {
    id: "electrician",
    name: "Electrician",
    icon: "flash-outline",
    iconColor: "#2563EB",
    description: "Wiring, troubleshooting, installation, and electrical repair services.",
    startingPrice: 500
  },
  {
    id: "plumber",
    name: "Plumber",
    icon: "water-outline",
    iconColor: "#0891B2",
    description: "Pipe repairs, leak fixes, drainage work, and plumbing maintenance.",
    startingPrice: 450
  },
  {
    id: "aircon-repair",
    name: "Aircon Repair",
    icon: "snow-outline",
    iconColor: "#0284C7",
    description: "Air conditioner cleaning, diagnostics, repair, freon checks, and cooling maintenance.",
    startingPrice: 850,
    active: false
  },
  {
    id: "welder",
    name: "Welder",
    icon: "flame-outline",
    iconColor: "#EA580C",
    description: "Metal works, gate fabrication, railing repairs, and welding projects.",
    startingPrice: 700
  },
  {
    id: "construction-worker",
    name: "Carpenter",
    icon: "hammer-outline",
    iconColor: "#B45309",
    description: "Wood framing, cabinets, doors, fixtures, and general carpentry repair services.",
    startingPrice: 900,
    active: true
  },
  {
    id: "tile-setter",
    name: "Tile Setter",
    icon: "grid-outline",
    iconColor: "#64748B",
    description: "Floor and wall tile layout, installation, grout repair, and finishing services.",
    startingPrice: 850,
    active: true
  },
  {
    id: "roofer",
    name: "Roofer",
    icon: "home-outline",
    iconColor: "#16A34A",
    description: "Roof repair, installation, weatherproofing, and maintenance services.",
    startingPrice: 1200
  },
  {
    id: "painter",
    name: "Painter",
    icon: "color-palette-outline",
    iconColor: "#7C3AED",
    description: "Interior and exterior painting, repainting, and finishing services.",
    startingPrice: 650
  },
  {
    id: "car-mechanic",
    name: "Car Mechanic",
    icon: "car-sport-outline",
    iconColor: "#DC2626",
    description: "Car diagnostics, repair, tune-ups, and maintenance services.",
    startingPrice: 900,
    active: false
  },
  {
    id: "motor-mechanic",
    name: "Motor Mechanic",
    icon: "bicycle-outline",
    iconColor: "#0F766E",
    description: "Motorcycle repair, tune-ups, diagnostics, and maintenance services.",
    startingPrice: 700,
    active: false
  }
];

const defaultCoverageAreas: CoverageArea[] = [
  { id: "malaybalay-city", name: "Malaybalay City", active: true },
  { id: "valencia-city", name: "Valencia City", active: false },
  { id: "maramag", name: "Maramag", active: false }
];

const marketplaceVisibilityPreset = "2026-05-worker-categories";

async function createRoleProfile(userId: string, fullName: string, role: "customer" | "provider", phone?: string) {
  const normalizedPhone = phone?.trim() || "";
  if (role === "customer") {
    await setDoc(
      doc(getFirestore_(), "customerProfiles", userId),
      {
        userId,
        phone: normalizedPhone,
        addresses: [],
        defaultLocation: "",
        pinpointLocation: "",
        profilePhotoUrl: "",
        savedProviderIds: [],
        notificationPreferences: { push: true, email: true, sms: false },
      } as CustomerProfile,
      { merge: true }
    );
    return;
  }

  await setDoc(
    doc(getFirestore_(), "providerProfiles", userId),
    {
      userId,
      displayName: fullName,
      businessName: "",
      profilePhotoUrl: "",
      validIdUrl: "",
      permitCertificateUrl: "",
      sampleWorkUrls: [],
      sampleWorks: [],
      birthday: "",
      age: 0,
      phone: normalizedPhone,
      emergencyContact: "",
      address: "",
      city: "",
      serviceAreas: [],
      serviceCategories: [],
      yearsExperience: 0,
      hourlyRate: 0,
      bio: "",
      qualifications: "",
      additionalDetails: "",
      termsAcceptedAt: "",
      rating: 0,
      isApproved: false,
      approvalStatus: "Draft",
      moderation: { status: "active" },
      availability: [
        { day: "Mon", start: "08:00", end: "17:00", available: false },
        { day: "Tue", start: "08:00", end: "17:00", available: false },
        { day: "Wed", start: "08:00", end: "17:00", available: false },
        { day: "Thu", start: "08:00", end: "17:00", available: false },
        { day: "Fri", start: "08:00", end: "17:00", available: false },
        { day: "Sat", start: "08:00", end: "12:00", available: false }
      ],
      scheduleExceptions: [],
      earningsSummary: { today: 0, week: 0, month: 0 },
      documentsStatus: "pending",
    } as ProviderProfile,
    { merge: true }
  );
}

async function upsertUserDocument({
  uid,
  email,
  fullName,
  role,
  authProvider,
  phone,
  profilePhoto
}: {
  uid: string;
  email: string;
  fullName: string;
  role: "customer" | "provider";
  authProvider: "email" | "google";
  phone?: string;
  profilePhoto?: string;
}) {
  const payload: User = {
    id: uid,
    email,
    role,
    authProvider,
    fullName,
    phone,
    profilePhoto: profilePhoto || "",
    appTheme: "system",
    termsAcceptedAt: undefined,
    termsVersion: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(getFirestore_(), "users", uid), sanitizeForFirestore(payload), { merge: true });
  await createRoleProfile(uid, fullName, role, phone);
}

// ============================================================================
// AUTHENTICATION SERVICES
// ============================================================================

export const authService = {
  // Register new user (email/password)
  async registerWithEmail(
    email: string,
    password: string,
    fullName: string,
    role: "customer" | "provider",
    phone?: string
  ): Promise<{ user: FirebaseUser; uid: string }> {
    const existingMethods = await fetchSignInMethodsForEmail(getFirebaseAuth(), email.trim()).catch(() => []);
    if (existingMethods.length) {
      throw new Error("auth/email-already-in-use");
    }

    const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    const { user } = credential;

    // Update profile with name
    await updateProfile(user, { displayName: fullName });

    await upsertUserDocument({
      uid: user.uid,
      email: user.email || email,
      fullName,
      role,
      authProvider: "email",
      phone: phone?.trim()
    });

    return { user, uid: user.uid };
  },

  // Login with email/password
  async loginWithEmail(email: string, password: string): Promise<FirebaseUser> {
    const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    return result.user;
  },

  async loginWithGooglePopup(): Promise<FirebaseUser> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(getFirebaseAuth(), provider);
    return result.user;
  },

  async loginWithGoogleCredential(idToken?: string, accessToken?: string): Promise<FirebaseUser> {
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const result = await signInWithCredential(getFirebaseAuth(), credential);
    return result.user;
  },

  async completeGoogleAuth(params: {
    role: "customer" | "provider";
    intent: "login" | "register";
    idToken?: string;
    accessToken?: string;
    usePopup?: boolean;
  }): Promise<{ user: FirebaseUser; appUser: User; isNewUser: boolean }> {
    if (params.role !== "customer") {
      throw new Error("Google sign-in is available for customer accounts only.");
    }

    const authUser = params.usePopup
      ? await this.loginWithGooglePopup()
      : await this.loginWithGoogleCredential(params.idToken, params.accessToken);

    const existingUser = await this.getUserDocument(authUser.uid);
    const fullName = authUser.displayName || authUser.email?.split("@")[0] || "Kabisig User";
    const email = authUser.email || "";
    const photo = authUser.photoURL || "";
    const isNewUser = !existingUser;

    if (existingUser && existingUser.role !== params.role) {
      await firebaseSignOut(getFirebaseAuth());
      throw new Error(`This Google account is already registered as ${existingUser.role}.`);
    }

    if (isNewUser) {
      await upsertUserDocument({
        uid: authUser.uid,
        email,
        fullName,
        role: params.role,
        authProvider: "google",
        profilePhoto: photo
      });
    } else {
      await setDoc(
        doc(getFirestore_(), "users", authUser.uid),
        {
          fullName,
          email,
          profilePhoto: photo,
          authProvider: "google",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    const nextUser = (await this.getUserDocument(authUser.uid)) as User;
    return { user: authUser, appUser: nextUser, isNewUser };
  },

  // Sign out
  async signOut(): Promise<void> {
    await firebaseSignOut(getFirebaseAuth());
  },

  // Send password reset email
  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  },

  // Get current user
  getCurrentUser(): FirebaseUser | null {
    return getFirebaseAuth().currentUser;
  },

  // Get user document
  async getUserDocument(uid: string): Promise<User | null> {
    const docRef = doc(getFirestore_(), "users", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as User) : null;
  },
};

// ============================================================================
// USER SERVICES
// ============================================================================

export const userService = {
  async getUserDocument(uid: string): Promise<User | null> {
    return authService.getUserDocument(uid);
  },

  // Get user profile with role-specific data
  async getFullUserProfile(
    uid: string
  ): Promise<{ user: User; profile: CustomerProfile | ProviderProfile | null }> {
    const userDoc = await authService.getUserDocument(uid);
    if (!userDoc) throw new Error("User not found");

    let profile = null;
    if (userDoc.role === "customer") {
      profile = await this.getCustomerProfile(uid);
    } else if (userDoc.role === "provider") {
      profile = await this.getProviderProfile(uid);
    }

    return { user: userDoc, profile };
  },

  // Get customer profile
  async getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
    const docRef = doc(getFirestore_(), "customerProfiles", userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as CustomerProfile) : null;
  },

  // Update customer profile
  async updateCustomerProfile(
    userId: string,
    data: Partial<CustomerProfile>
  ): Promise<void> {
    const ref = doc(getFirestore_(), "customerProfiles", userId);
    const sanitizedData = sanitizeForFirestore(data);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, sanitizedData);
      return;
    }
    await setDoc(
      ref,
      sanitizeForFirestore({
        userId,
        phone: "",
        addresses: [],
        defaultLocation: "",
        pinpointLocation: "",
        profilePhotoUrl: "",
        savedProviderIds: [],
        notificationPreferences: { push: true, email: true, sms: false },
        ...sanitizedData,
      } as CustomerProfile),
      { merge: true }
    );
  },

  async getSavedProviderIds(userId: string): Promise<string[]> {
    const profile = await this.getCustomerProfile(userId);
    return profile?.savedProviderIds ?? [];
  },

  async saveProvider(userId: string, providerId: string): Promise<void> {
    const savedProviderIds = await this.getSavedProviderIds(userId);
    if (savedProviderIds.includes(providerId)) return;

    await this.updateCustomerProfile(userId, {
      savedProviderIds: [...savedProviderIds, providerId],
    });
  },

  async unsaveProvider(userId: string, providerId: string): Promise<void> {
    const savedProviderIds = await this.getSavedProviderIds(userId);
    await this.updateCustomerProfile(userId, {
      savedProviderIds: savedProviderIds.filter((item) => item !== providerId),
    });
  },

  async getSavedProviders(userId: string): Promise<(ProviderProfile & { userId: string })[]> {
    const savedProviderIds = await this.getSavedProviderIds(userId);
    if (!savedProviderIds.length) return [];

    const providers = await providerService.getAllProviderProfiles();
    return savedProviderIds
      .map((providerId) => providers.find((provider) => provider.userId === providerId))
      .filter((provider): provider is ProviderProfile & { userId: string } => Boolean(provider));
  },

  // Get provider profile
  async getProviderProfile(userId: string): Promise<ProviderProfile | null> {
    const docRef = doc(getFirestore_(), "providerProfiles", userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as ProviderProfile) : null;
  },

  // Update provider profile
  async updateProviderProfile(userId: string, data: Partial<ProviderProfile>): Promise<void> {
    const ref = doc(getFirestore_(), "providerProfiles", userId);
    const sanitizedData = sanitizeForFirestore(data);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, sanitizedData);
      return;
    }
    await setDoc(
      ref,
      sanitizeForFirestore({
        userId,
        displayName: "",
        businessName: "",
        profilePhotoUrl: "",
        validIdUrl: "",
        permitCertificateUrl: "",
        sampleWorkUrls: [],
        sampleWorks: [],
        portfolio: [],
        birthday: "",
        age: 0,
        phone: "",
        emergencyContact: "",
        address: "",
        city: "",
        serviceAreas: [],
        serviceCategories: [],
        yearsExperience: 0,
        hourlyRate: 0,
        bio: "",
        qualifications: "",
        additionalDetails: "",
        termsAcceptedAt: "",
        rating: 0,
        isApproved: false,
        approvalStatus: "Draft",
        moderation: { status: "active" },
        availability: [
          { day: "Mon", start: "08:00", end: "17:00", available: false },
          { day: "Tue", start: "08:00", end: "17:00", available: false },
          { day: "Wed", start: "08:00", end: "17:00", available: false },
          { day: "Thu", start: "08:00", end: "17:00", available: false },
          { day: "Fri", start: "08:00", end: "17:00", available: false },
          { day: "Sat", start: "08:00", end: "12:00", available: false }
        ],
        scheduleExceptions: [],
        earningsSummary: { today: 0, week: 0, month: 0 },
        documentsStatus: "pending",
        ...sanitizedData,
      } as ProviderProfile),
      { merge: true }
    );
  },

  // Update main user document
  async updateUserDocument(uid: string, data: Partial<User>): Promise<void> {
    const ref = doc(getFirestore_(), "users", uid);
    const payload = sanitizeForFirestore({
      ...data,
      updatedAt: new Date().toISOString(),
    });
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, payload);
      return;
    }
    await setDoc(
      ref,
      sanitizeForFirestore({
        id: uid,
        email: "",
        role: "customer",
        authProvider: "email",
        fullName: "",
        phone: "",
        appTheme: "system",
        createdAt: new Date().toISOString(),
        ...payload,
      } as User),
      { merge: true }
    );
  },

  // Get all users (admin)
  async getAllUsers(): Promise<User[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "users"));
    return snapshot.docs.map((doc) => doc.data() as User);
  },

  async getUsersByIds(userIds: string[]): Promise<User[]> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    const users = await Promise.all(uniqueIds.map((userId) => this.getUserDocument(userId)));
    return users.filter((entry): entry is User => Boolean(entry));
  },
};

export const adminAuditService = {
  async logAction(entry: Omit<AdminAuditLog, "logId" | "createdAt">): Promise<string> {
    const logId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await setDoc(doc(getFirestore_(), "adminAuditLogs", logId), {
      ...entry,
      logId,
      createdAt: nowIso(),
    } as AdminAuditLog);
    return logId;
  },

  async getProviderAuditLogs(userId?: string): Promise<AdminAuditLog[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "adminAuditLogs"));
    const logs = snapshot.docs.map((entry) => entry.data() as AdminAuditLog);
    const filtered = userId
      ? logs.filter((entry) => entry.targetCollection === "providerProfiles" && entry.targetId === userId)
      : logs;
    return filtered.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  },

  async getAllAuditLogs(): Promise<AdminAuditLog[]> {
    return this.getProviderAuditLogs();
  },

  subscribeProviderAuditLogs(userId: string, callback: (logs: AdminAuditLog[]) => void): () => void {
    return onSnapshot(collection(getFirestore_(), "adminAuditLogs"), (snapshot) => {
      const logs = snapshot.docs
        .map((entry) => entry.data() as AdminAuditLog)
        .filter((entry) => entry.targetCollection === "providerProfiles" && entry.targetId === userId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      callback(logs);
    });
  },
};

export const mediaService = {
  async uploadMedia(
    value: string | MediaAttachment,
    pathPrefix: string,
    fileName: string,
    uploadedBy?: string,
    maxSizeBytes?: number
  ): Promise<MediaAttachment> {
    return persistMediaAttachment(
      value,
      `${pathPrefix}/${Date.now()}-${toStorageSafeSegment(fileName)}`,
      fileName,
      uploadedBy,
      maxSizeBytes
    );
  },

  async uploadMany(
    values: Array<string | MediaAttachment>,
    pathPrefix: string,
    uploadedBy?: string,
    maxSizeBytes?: number
  ): Promise<MediaAttachment[]> {
    if (!maxSizeBytes) {
      return persistMediaAttachments(values, pathPrefix, uploadedBy);
    }
    return Promise.all(
      values.map((value, index) =>
        persistMediaAttachment(
          value,
          `${pathPrefix}/${Date.now()}-${index}-${toStorageSafeSegment(
            typeof value === "string" ? "attachment" : value.fileName || value.id || "attachment"
          )}`,
          typeof value === "string" ? `attachment-${index + 1}` : value.fileName || `attachment-${index + 1}`,
          uploadedBy,
          maxSizeBytes
        )
      )
    );
  },

  async deleteStoredMedia(items: Array<string | MediaAttachment>): Promise<void> {
    const storagePaths = flattenMediaStoragePaths(items);
    await Promise.all(
      storagePaths.map(async (storagePath) => {
        try {
          await deleteObject(storageRef(getFirebaseStorage(), storagePath));
        } catch (error) {
          console.warn("Unable to delete media from storage:", storagePath, error);
        }
      })
    );
  },
};

export const pushTokenService = {
  async upsertToken(data: Omit<PushNotificationToken, "tokenId" | "createdAt" | "updatedAt"> & { tokenId?: string }) {
    const tokenId = data.tokenId || `push-${data.userId}-${toStorageSafeSegment(data.platform)}-${Date.now()}`;
    await setDoc(doc(getFirestore_(), "pushNotificationTokens", tokenId), {
      ...data,
      tokenId,
      createdAt: data.tokenId ? undefined : nowIso(),
      updatedAt: nowIso(),
    } as PushNotificationToken, { merge: true });
    return tokenId;
  },

  async getUserTokens(userId: string): Promise<PushNotificationToken[]> {
    const q = query(collection(getFirestore_(), "pushNotificationTokens"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as PushNotificationToken);
  },
};

// ============================================================================
// PROVIDER SERVICES
// ============================================================================

export const providerService = {
  // Submit provider onboarding application
  async submitProviderApplication(
    userId: string,
    onboardingData: {
      fullName: string;
      businessName: string;
      mobileNumber: string;
      birthday: string;
      age: number;
      address: string;
      city: string;
      serviceCategories: string[];
      yearsExperience: number;
      bio: string;
      qualifications: string;
      additionalDetails: string;
      profilePhotoDriveLink: string;
      validIdDriveLink: string;
      permitCertificateDriveLink: string;
      emergencyContact: string;
      sampleWorkUrls?: string[];
      availability?: AvailabilitySchedule[];
      registrationPaymentProofUrl?: string;
      registrationPaymentReference?: string;
      registrationPaymentDate?: string;
      registrationPaymentMethod?: string;
    }
  ): Promise<string> {
    const applicationId = `app-${Date.now()}`;
    const settings = await workerPaymentService.getSettings();
    const promoFree =
      settings.freeRegistrationPromoEnabled &&
      settings.approvedFreeRegistrationCount < settings.freeRegistrationApprovedWorkerLimit;
    const registrationFeeRequired = settings.registrationFeeEnabled && !promoFree;
    if (registrationFeeRequired && !onboardingData.registrationPaymentProofUrl) {
      throw new Error("Registration payment proof is required before submitting your worker application.");
    }
    if (registrationFeeRequired && !onboardingData.registrationPaymentReference?.trim()) {
      throw new Error("Payment reference number is required before submitting your worker application.");
    }
    if (registrationFeeRequired && !onboardingData.registrationPaymentDate) {
      throw new Error("Payment date is required before submitting your worker application.");
    }

    const [profilePhoto, validId, permitCertificate, sampleWorks, registrationProof] = await Promise.all([
      mediaService.uploadMedia(
        onboardingData.profilePhotoDriveLink,
        `providerDocuments/${userId}/profile`,
        "profile-photo",
        userId
      ),
      mediaService.uploadMedia(
        onboardingData.validIdDriveLink,
        `providerDocuments/${userId}/valid-id`,
        "valid-id",
        userId
      ),
      mediaService.uploadMedia(
        onboardingData.permitCertificateDriveLink,
        `providerDocuments/${userId}/permit`,
        "permit-certificate",
        userId
      ),
      mediaService.uploadMany(onboardingData.sampleWorkUrls || [], `providerDocuments/${userId}/sample-works`, userId),
      registrationFeeRequired && onboardingData.registrationPaymentProofUrl
        ? workerPaymentService.uploadPaymentProof(
            onboardingData.registrationPaymentProofUrl,
            `workerPayments/registration/${userId}/${applicationId}`,
            userId
          )
        : Promise.resolve(null),
    ]);

    const documentUrls: UploadedDocument[] = [
      {
        id: "profile-photo",
        label: "Profile Photo",
        url: isFirestoreSafeUrl(profilePhoto.url) ? profilePhoto.url : undefined,
        fileName: profilePhoto.fileName,
        mimeType: profilePhoto.mimeType,
        sizeBytes: profilePhoto.sizeBytes,
        storagePath: profilePhoto.storagePath,
        uploadedAt: profilePhoto.uploadedAt,
        status: isFirestoreSafeUrl(profilePhoto.url) ? "uploaded" : "pending",
      },
      {
        id: "valid-id",
        label: "Valid ID",
        url: isFirestoreSafeUrl(validId.url) ? validId.url : undefined,
        fileName: validId.fileName,
        mimeType: validId.mimeType,
        sizeBytes: validId.sizeBytes,
        storagePath: validId.storagePath,
        uploadedAt: validId.uploadedAt,
        status: isFirestoreSafeUrl(validId.url) ? "uploaded" : "pending",
      },
      {
        id: "permit-cert",
        label: "Permit / Certificate",
        url: isFirestoreSafeUrl(permitCertificate.url) ? permitCertificate.url : undefined,
        fileName: permitCertificate.fileName,
        mimeType: permitCertificate.mimeType,
        sizeBytes: permitCertificate.sizeBytes,
        storagePath: permitCertificate.storagePath,
        uploadedAt: permitCertificate.uploadedAt,
        status: isFirestoreSafeUrl(permitCertificate.url) ? "uploaded" : "pending",
      },
    ];

    const providerProfileUpdate = sanitizeForFirestore({
      displayName: onboardingData.fullName,
      businessName: onboardingData.businessName,
      profilePhotoUrl: isFirestoreSafeUrl(profilePhoto.url) ? profilePhoto.url : "",
      validIdUrl: isFirestoreSafeUrl(validId.url) ? validId.url : "",
      permitCertificateUrl: isFirestoreSafeUrl(permitCertificate.url) ? permitCertificate.url : "",
      sampleWorkUrls: sampleWorks.map((item) => item.url).filter(isFirestoreSafeUrl),
      birthday: onboardingData.birthday,
      age: onboardingData.age,
      phone: onboardingData.mobileNumber,
      emergencyContact: onboardingData.emergencyContact,
      address: onboardingData.address,
      city: onboardingData.city,
      serviceAreas: onboardingData.city.split(",").map((item) => item.trim()).filter(Boolean),
      serviceCategories: onboardingData.serviceCategories,
      yearsExperience: onboardingData.yearsExperience,
      bio: onboardingData.bio,
      qualifications: onboardingData.qualifications,
      additionalDetails: onboardingData.additionalDetails,
      termsAcceptedAt: new Date().toISOString(),
      approvalStatus: "Pending Approval",
      availability: onboardingData.availability || undefined,
      moderation: { status: "active" },
      financialStatus: {
        registrationPaymentStatus: registrationFeeRequired ? "Submitted" : "Waived",
        freeBookingsGranted: settings.freeBookingsGranted,
        freeBookingsUsed: 0,
        freeBookingsRemaining: settings.freeBookingsGranted,
        restrictedFromAcceptingBookings: false,
        hasOverdueCommission: false,
        updatedAt: nowIso(),
      },
    } as Partial<ProviderProfile> & { termsAcceptedAt?: string });

    const registrationFeeAmount = registrationFeeRequired
      ? (Number(settings.registrationFeeAmount) > 0 ? Number(settings.registrationFeeAmount) : 500)
      : 0;
    if (registrationFeeRequired && (!registrationProof?.url || !isFirestoreSafeUrl(registrationProof.url))) {
      throw new Error("Payment proof upload did not finish. Please upload the proof image again before submitting.");
    }
    const registrationPaymentId = `registration-payment-${applicationId}`;
    const registrationPayment: WorkerRegistrationPayment = sanitizeForFirestore({
      paymentId: registrationPaymentId,
      applicationId,
      providerId: userId,
      userId,
      required: registrationFeeRequired,
      waived: !registrationFeeRequired,
      waiverReason: !registrationFeeRequired ? (promoFree ? "promo" : "free_registration") : undefined,
      amount: registrationFeeAmount,
      methodName: onboardingData.registrationPaymentMethod?.trim() || settings.paymentMethodName,
      instructionsSnapshot: settings.paymentInstructions,
      status: registrationFeeRequired ? "Submitted" : "Waived",
      proofImageUrl: registrationProof?.url,
      proofImagePath: registrationProof?.storagePath,
      referenceNumber: onboardingData.registrationPaymentReference?.trim(),
      paymentDate: onboardingData.registrationPaymentDate || undefined,
      submittedAt: registrationFeeRequired ? nowIso() : undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } as WorkerRegistrationPayment);

    const application: ProviderApplication = sanitizeForFirestore({
      applicationId,
      userId,
      submittedAt: new Date().toISOString(),
      status: "Pending Approval",
      documentUrls,
      registrationPaymentId,
      registrationPaymentStatus: registrationPayment.status,
      registrationFeeRequired,
      registrationPaymentSnapshot: {
        paymentId: registrationPayment.paymentId,
        applicationId: registrationPayment.applicationId,
        providerId: registrationPayment.providerId,
        userId: registrationPayment.userId,
        required: registrationPayment.required,
        waived: registrationPayment.waived,
        waiverReason: registrationPayment.waiverReason,
        amount: registrationPayment.amount,
        methodName: registrationPayment.methodName,
        status: registrationPayment.status,
        proofImageUrl: registrationPayment.proofImageUrl,
        proofImagePath: registrationPayment.proofImagePath,
        referenceNumber: registrationPayment.referenceNumber,
        paymentDate: registrationPayment.paymentDate,
        submittedAt: registrationPayment.submittedAt,
        createdAt: registrationPayment.createdAt,
        updatedAt: registrationPayment.updatedAt,
      },
    } as ProviderApplication);
    try {
      const result = await callFunction<
        {
          applicationId: string;
          userId: string;
          application: ProviderApplication;
          providerProfileUpdate: Partial<ProviderProfile> & { termsAcceptedAt?: string };
          registrationPayment: WorkerRegistrationPayment;
        },
        { applicationId: string }
      >("submitProviderApplication", {
        applicationId,
        userId,
        application,
        providerProfileUpdate,
        registrationPayment,
      });

      return result.applicationId;
    } catch (error) {
      if (!isCallableUnavailableError(error)) {
        throw error;
      }

      const batch = writeBatch(getFirestore_());
      batch.set(doc(getFirestore_(), "providerApplications", applicationId), application, { merge: true });
      batch.set(doc(getFirestore_(), "workerRegistrationPayments", registrationPaymentId), registrationPayment, { merge: true });
      batch.set(doc(getFirestore_(), "workerFinanceSummaries", userId), sanitizeForFirestore({
        providerId: userId,
        userId,
        registrationPaymentStatus: registrationPayment.status,
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
        updatedAt: nowIso(),
      } as WorkerFinanceSummary), { merge: true });
      batch.set(
        doc(getFirestore_(), "providerProfiles", userId),
        sanitizeForFirestore({
          ...providerProfileUpdate,
          approvalStatus: "Pending Approval",
          isApproved: false,
          moderation: { status: "active" },
          updatedAt: nowIso(),
        }),
        { merge: true }
      );
      await batch.commit();
      return applicationId;
    }
  },

  async getLatestApplicationByUser(userId: string): Promise<ProviderApplication | null> {
    const q = query(collection(getFirestore_(), "providerApplications"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const applications = snapshot.docs
      .map((entry) => entry.data() as ProviderApplication)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return applications[0] || null;
  },

  // Get all pending applications (for admin)
  async getPendingApplications(): Promise<ProviderApplication[]> {
    const q = query(
      collection(getFirestore_(), "providerApplications"),
      where("status", "==", "Pending Approval")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as ProviderApplication);
  },

  // Get application by ID
  async getApplicationById(applicationId: string): Promise<ProviderApplication | null> {
    const docRef = doc(getFirestore_(), "providerApplications", applicationId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as ProviderApplication) : null;
  },

  // Admin approve provider
  async approveProvider(
    applicationId: string,
    userId: string,
    adminId: string
  ): Promise<void> {
    await callFunction("approveProvider", {
      applicationId,
      userId,
      adminId,
    });
  },

  // Admin reject provider
  async rejectProvider(
    applicationId: string,
    userId: string,
    adminId: string,
    notes: string
  ): Promise<void> {
    await callFunction("rejectProvider", {
      applicationId,
      userId,
      adminId,
      notes,
    });
  },

  // Admin request revision
  async requestRevision(
    applicationId: string,
    userId: string,
    adminId: string,
    notes: string
  ): Promise<void> {
    await callFunction("requestProviderRevision", {
      applicationId,
      userId,
      adminId,
      notes,
    });
  },

  async updateModerationStatus(
    userId: string,
    adminId: string,
    status: NonNullable<ProviderProfile["moderation"]>["status"],
    reason: string
  ): Promise<void> {
    await callFunction("updateProviderModeration", {
      userId,
      adminId,
      status,
      reason,
    });
  },

  async addScheduleException(
    userId: string,
    data: NonNullable<ProviderProfile["scheduleExceptions"]>[number]
  ): Promise<void> {
    const current = await userService.getProviderProfile(userId);
    const next = [...(current?.scheduleExceptions ?? []).filter((item) => item.id !== data.id), data];
    await userService.updateProviderProfile(userId, { scheduleExceptions: next });
  },

  async getScheduleExceptions(userId: string) {
    const profile = await userService.getProviderProfile(userId);
    return profile?.scheduleExceptions ?? [];
  },

  // Get approved providers (for customer browsing)
  async getApprovedProviders(
    limit: number = 20
  ): Promise<(ProviderProfile & { userId: string })[]> {
    const q = query(
      collection(getFirestore_(), "providerProfiles"),
      where("isApproved", "==", true)
    );
    const snapshot = await getDocs(q);
    const approvedProviders = snapshot.docs
      .map((doc) => ({ ...(doc.data() as ProviderProfile), userId: doc.id }))
      .filter((provider) => this.isProviderVisible(provider))
      .slice(0, limit);

    return approvedProviders;
  },

  // Get providers by service category
  async getProvidersByCategory(categoryId: string): Promise<ProviderProfile[]> {
    const q = query(
      collection(getFirestore_(), "providerProfiles"),
      where("isApproved", "==", true),
      where("serviceCategories", "array-contains", categoryId)
    );
    const snapshot = await getDocs(q);
    const matchingProviders = snapshot.docs
      .map((doc) => doc.data() as ProviderProfile)
      .filter((provider) => this.isProviderVisible(provider));

    if (matchingProviders.length) {
      return matchingProviders;
    }

    const category = await categoryService.getCategoryById(categoryId);
    if (!category?.name) {
      return [];
    }

    const allApprovedProviders = await getDocs(
      query(collection(getFirestore_(), "providerProfiles"), where("isApproved", "==", true))
    );
    return allApprovedProviders.docs
      .map((doc) => doc.data() as ProviderProfile)
      .filter((provider) => {
        const offersCategory =
          provider.serviceCategories.includes(categoryId) ||
          provider.serviceCategories.includes(category.name);
        return offersCategory && this.isProviderVisible(provider);
      });
  },

  // Get all provider profiles (admin)
  async getAllProviderProfiles(): Promise<(ProviderProfile & { userId: string })[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "providerProfiles"));
    return snapshot.docs.map((doc) => ({ ...(doc.data() as ProviderProfile), userId: doc.id }));
  },

  isProviderVisible(provider: ProviderProfile): boolean {
    if (!provider.isApproved) return false;
    if (provider.moderation && provider.moderation.status !== "active") return false;
    if (!provider.availability?.length) return true;
    return provider.availability.some((slot) => slot.available);
  },
};

export const providerPortfolioService = {
  async addPortfolioItem(
    providerId: string,
    data: {
      title: string;
      description?: string;
      beforePhoto: string | MediaAttachment;
      afterPhoto: string | MediaAttachment;
    }
  ): Promise<ProviderPortfolioItem> {
    const title = data.title.trim();
    if (!title) {
      throw new Error("Please add a short portfolio title.");
    }
    assertImageMedia(data.beforePhoto, "Before photo");
    assertImageMedia(data.afterPhoto, "After photo");
    assertMediaSize(data.beforePhoto, PROVIDER_PORTFOLIO_MAX_PHOTO_BYTES, "Before photo");
    assertMediaSize(data.afterPhoto, PROVIDER_PORTFOLIO_MAX_PHOTO_BYTES, "After photo");

    const profile = await userService.getProviderProfile(providerId);
    const portfolioItemId = `portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const [beforePhoto, afterPhoto] = await Promise.all([
      mediaService.uploadMedia(
        data.beforePhoto,
        `providerPortfolio/${providerId}/${portfolioItemId}`,
        "before-photo",
        providerId,
        PROVIDER_PORTFOLIO_MAX_PHOTO_BYTES
      ),
      mediaService.uploadMedia(
        data.afterPhoto,
        `providerPortfolio/${providerId}/${portfolioItemId}`,
        "after-photo",
        providerId,
        PROVIDER_PORTFOLIO_MAX_PHOTO_BYTES
      ),
    ]);

    const now = nowIso();
    const item: ProviderPortfolioItem = sanitizeForFirestore({
      portfolioItemId,
      providerId,
      title,
      description: data.description?.trim() || "",
      beforePhoto,
      afterPhoto,
      createdAt: now,
      updatedAt: now,
    });
    const nextPortfolio = [item, ...(profile?.portfolio ?? [])];
    await userService.updateProviderProfile(providerId, { portfolio: nextPortfolio });
    return item;
  },

  async deletePortfolioItem(providerId: string, portfolioItemId: string): Promise<void> {
    const profile = await userService.getProviderProfile(providerId);
    const portfolio = profile?.portfolio ?? [];
    const target = portfolio.find((item) => item.portfolioItemId === portfolioItemId);
    if (!target) return;

    await mediaService.deleteStoredMedia([target.beforePhoto, target.afterPhoto]);
    await userService.updateProviderProfile(providerId, {
      portfolio: portfolio.filter((item) => item.portfolioItemId !== portfolioItemId),
    });
  },
};

// ============================================================================
// SERVICE CATEGORY SERVICES
// ============================================================================

export const categoryService = {
  // Get all categories
  async getAllCategories(): Promise<ServiceCategory[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "serviceCategories"));
    return snapshot.docs
      .map((doc) => doc.data() as ServiceCategory)
      .filter((category) => category.active !== false);
  },

  // Get category by ID
  async getCategoryById(categoryId: string): Promise<ServiceCategory | null> {
    const docRef = doc(getFirestore_(), "serviceCategories", categoryId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const category = docSnap.data() as ServiceCategory;
      return category.active === false ? null : category;
    }
    return null;
  },

  // Create category (admin)
  async createCategory(categoryData: ServiceCategory): Promise<void> {
    await setDoc(doc(getFirestore_(), "serviceCategories", categoryData.id), { active: true, ...categoryData });
  },

  async ensureDefaultCategories(): Promise<void> {
    await Promise.all(
      defaultServiceCategories.map(async (category) => {
        const ref = doc(getFirestore_(), "serviceCategories", category.id);
        const existing = await getDoc(ref);
        if (!existing.exists()) {
          await setDoc(ref, {
            ...category,
            visibilityPresetVersion: marketplaceVisibilityPreset,
          });
          return;
        }

        const current = existing.data() as ServiceCategory & { visibilityPresetVersion?: string };
        if (current.visibilityPresetVersion === marketplaceVisibilityPreset) {
          return;
        }

        const migration: Partial<ServiceCategory> & { visibilityPresetVersion: string } = {
          visibilityPresetVersion: marketplaceVisibilityPreset,
        };
        if (["aircon-repair", "car-mechanic", "motor-mechanic"].includes(category.id)) {
          migration.active = false;
        }
        if (category.id === "construction-worker") {
          Object.assign(migration, category);
        }

        if (Object.keys(migration).length > 1) {
          await setDoc(ref, migration, { merge: true });
        }
      })
    );
  },

  // Update category (admin)
  async updateCategory(categoryId: string, data: Partial<ServiceCategory>): Promise<void> {
    await updateDoc(doc(getFirestore_(), "serviceCategories", categoryId), data);
  },

  async deleteCategory(categoryId: string): Promise<void> {
    await deleteDoc(doc(getFirestore_(), "serviceCategories", categoryId));
  },
};

export const coverageAreaService = {
  async ensureDefaultCoverageAreas(): Promise<void> {
    await Promise.all(
      defaultCoverageAreas.map(async (coverageArea) => {
        const ref = doc(getFirestore_(), "coverageAreas", coverageArea.id);
        const existing = await getDoc(ref);
        if (!existing.exists()) {
          await setDoc(ref, {
            ...coverageArea,
            visibilityPresetVersion: marketplaceVisibilityPreset,
          });
          return;
        }

        const current = existing.data() as CoverageArea & { visibilityPresetVersion?: string };
        if (current.visibilityPresetVersion === marketplaceVisibilityPreset) {
          return;
        }

        if (["valencia-city", "maramag"].includes(coverageArea.id)) {
          await setDoc(
            ref,
            {
              active: false,
              visibilityPresetVersion: marketplaceVisibilityPreset,
            },
            { merge: true }
          );
        }
      })
    );
  },

  async getAllConfiguredCoverageAreas(): Promise<CoverageArea[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "coverageAreas"));
    return snapshot.docs.map((entry) => entry.data() as CoverageArea);
  },

  async getAllCoverageAreas(): Promise<CoverageArea[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "coverageAreas"));
    return snapshot.docs
      .map((entry) => entry.data() as CoverageArea)
      .filter((item) => item.active !== false);
  },

  async createCoverageArea(data: CoverageArea): Promise<void> {
    await setDoc(doc(getFirestore_(), "coverageAreas", data.id), data);
  },

  async updateCoverageArea(coverageAreaId: string, data: Partial<CoverageArea>): Promise<void> {
    await updateDoc(doc(getFirestore_(), "coverageAreas", coverageAreaId), data);
  },

  async deleteCoverageArea(coverageAreaId: string): Promise<void> {
    await deleteDoc(doc(getFirestore_(), "coverageAreas", coverageAreaId));
  }
};

export const marketplaceConfigService = {
  async ensureDefaultMarketplaceData(): Promise<void> {
    await Promise.all([
      categoryService.ensureDefaultCategories(),
      coverageAreaService.ensureDefaultCoverageAreas(),
    ]);
  },
};

export const bookingConflictService = {
  async logConflict(data: Omit<BookingConflictHistory, "conflictId" | "createdAt">): Promise<string> {
    const conflictId = `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await setDoc(doc(getFirestore_(), "bookingConflicts", conflictId), {
      ...data,
      conflictId,
      createdAt: nowIso(),
    } as BookingConflictHistory);
    return conflictId;
  },

  async getProviderConflictHistory(providerId: string): Promise<BookingConflictHistory[]> {
    if (!providerId) {
      const snapshot = await getDocs(collection(getFirestore_(), "bookingConflicts"));
      return snapshot.docs
        .map((entry) => entry.data() as BookingConflictHistory)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }
    const q = query(collection(getFirestore_(), "bookingConflicts"), where("providerId", "==", providerId));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((entry) => entry.data() as BookingConflictHistory)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  },
};

function buildBookingSlotId(providerId: string, scheduledDate: string, scheduledTime: string) {
  return `${providerId}_${scheduledDate}_${scheduledTime}`
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-");
}

function buildCustomerBookingSlotId(customerId: string, scheduledDate: string, scheduledTime: string) {
  return `${customerId}_${scheduledDate}_${scheduledTime}`
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-");
}

function shouldReleaseBookingSlot(status?: Booking["status"]) {
  return status === "Cancelled" || status === "Completed";
}

type BookingSlotConflictCode = "BOOKING_SLOT_CONFLICT" | "CUSTOMER_BOOKING_SLOT_CONFLICT";

function createSlotConflict(code: BookingSlotConflictCode, conflictingBookingId?: string) {
  const error = new Error(code) as Error & { conflictingBookingId?: string };
  error.conflictingBookingId = conflictingBookingId;
  return error;
}

function isSameSlotBooking(
  leftDate?: string,
  leftTime?: string,
  rightDate?: string,
  rightTime?: string
) {
  return Boolean(leftDate && leftTime && rightDate && rightTime && leftDate === rightDate && leftTime === rightTime);
}

// ============================================================================
// BOOKING SERVICES
// ============================================================================

export const bookingService = {
  // Create booking
  async createBooking(bookingData: Omit<Booking, "bookingId">): Promise<string> {
    if (bookingData.providerId) {
      const restriction = await workerPaymentService.canWorkerAcceptBookings(bookingData.providerId);
      if (!restriction.allowed) {
        throw new Error("This worker cannot accept bookings right now because their monthly admin payment is overdue. Please choose another worker or try again after they settle the payment.");
      }
    }
    const bookingId = `booking-${Date.now()}`;
    const attachmentItems = bookingData.attachmentItems?.length
      ? bookingData.attachmentItems
      : await mediaService.uploadMany(bookingData.attachments || [], `bookings/${bookingId}/attachments`, bookingData.customerId);
    const payload: Booking = {
      ...bookingData,
      bookingId,
      attachments: attachmentItems.map((item) => item.url),
      attachmentItems,
      statusHistory: bookingData.statusHistory?.length
        ? bookingData.statusHistory
        : [
            {
              bookingId,
              status: bookingData.status,
              changedAt: nowIso(),
              changedBy: bookingData.customerId,
            },
          ],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    if (bookingData.scheduledDate && bookingData.scheduledTime) {
      const slotId = buildBookingSlotId(bookingData.providerId, bookingData.scheduledDate, bookingData.scheduledTime);
      const customerSlotId = buildCustomerBookingSlotId(bookingData.customerId, bookingData.scheduledDate, bookingData.scheduledTime);
      try {
        await runTransaction(getFirestore_(), async (transaction) => {
          const slotRef = doc(getFirestore_(), "bookingSlots", slotId);
          const customerSlotRef = doc(getFirestore_(), "customerBookingSlots", customerSlotId);
          const slotSnap = await transaction.get(slotRef);
          const customerSlotSnap = await transaction.get(customerSlotRef);
          if (slotSnap.exists()) {
            throw createSlotConflict("BOOKING_SLOT_CONFLICT", slotSnap.data()?.bookingId as string | undefined);
          }
          if (customerSlotSnap.exists()) {
            throw createSlotConflict("CUSTOMER_BOOKING_SLOT_CONFLICT", customerSlotSnap.data()?.bookingId as string | undefined);
          }
          transaction.set(doc(getFirestore_(), "bookings", bookingId), payload);
          transaction.set(slotRef, {
            slotId,
            bookingId,
            providerId: bookingData.providerId,
            scheduledDate: bookingData.scheduledDate,
            scheduledTime: bookingData.scheduledTime,
            createdAt: nowIso(),
          });
          transaction.set(customerSlotRef, {
            slotId: customerSlotId,
            bookingId,
            customerId: bookingData.customerId,
            providerId: bookingData.providerId,
            scheduledDate: bookingData.scheduledDate,
            scheduledTime: bookingData.scheduledTime,
            createdAt: nowIso(),
          });
        });
      } catch (error) {
        if (error instanceof Error && (error.message === "BOOKING_SLOT_CONFLICT" || error.message === "CUSTOMER_BOOKING_SLOT_CONFLICT")) {
          const slotConflict = error as Error & { conflictingBookingId?: string };
          await bookingConflictService.logConflict({
            providerId: bookingData.providerId,
            customerId: bookingData.customerId,
            bookingId,
            requestedDate: bookingData.scheduledDate,
            requestedTime: bookingData.scheduledTime,
            conflictingBookingId: slotConflict.conflictingBookingId,
            conflictingScheduledAt: bookingData.scheduledAt,
            resolution: "rejected",
            reason: error.message === "CUSTOMER_BOOKING_SLOT_CONFLICT"
              ? "Customer already has another booking at the requested date and time."
              : "Requested booking slot is already reserved.",
          });
          throw new Error(
            error.message === "CUSTOMER_BOOKING_SLOT_CONFLICT"
              ? "You already have another booking at this date and time. Please choose another slot."
              : "That time slot has just been taken. Please choose another available time."
          );
        }
        throw error;
      }
      return bookingId;
    }

    await setDoc(doc(getFirestore_(), "bookings", bookingId), payload);

    return bookingId;
  },

  // Get booking by ID
  async getBookingById(bookingId: string): Promise<Booking | null> {
    const docRef = doc(getFirestore_(), "bookings", bookingId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as Booking) : null;
  },

  // Get customer bookings
  async getCustomerBookings(customerId: string): Promise<Booking[]> {
    const q = query(collection(getFirestore_(), "bookings"), where("customerId", "==", customerId));
    const snapshot = await getDocs(q);
    return sortBookingsNewestFirst(snapshot.docs.map((doc) => doc.data() as Booking));
  },

  // Get provider jobs/bookings
  async getProviderBookings(providerId: string): Promise<Booking[]> {
    const q = query(collection(getFirestore_(), "bookings"), where("providerId", "==", providerId));
    const snapshot = await getDocs(q);
    return sortBookingsNewestFirst(snapshot.docs.map((doc) => doc.data() as Booking));
  },

  // Update booking
  async updateBooking(bookingId: string, data: Partial<Booking>): Promise<void> {
    const current = await this.getBookingById(bookingId);
    if (data.status === "Accepted") {
      const providerId = data.providerId || current?.providerId;
      if (providerId) {
        const restriction = await workerPaymentService.canWorkerAcceptBookings(providerId);
        if (!restriction.allowed) {
          throw new Error(restriction.reason || "Settle your overdue admin payment before accepting new bookings.");
        }
      }
    }
    if (data.status === "On the Way" && !current?.customerAcceptanceConfirmedAt) {
      throw new Error("The customer must confirm the accepted booking before you can mark yourself as On the Way.");
    }
    if (data.status) {
      try {
        await callFunction<{ bookingId: string; status: Booking["status"] }, { ok: boolean }>("updateBookingStatus", {
          bookingId,
          status: data.status,
        });
        const extraPayload = Object.fromEntries(
          Object.entries(data).filter(([key]) => !["status", "workerAcceptedAt", "statusHistory"].includes(key))
        ) as Partial<Booking>;
        if (!Object.keys(extraPayload).length) {
          return;
        }
        await updateDoc(doc(getFirestore_(), "bookings", bookingId), sanitizeForFirestore({
          ...extraPayload,
          updatedAt: new Date().toISOString(),
        }));
        return;
      } catch (error) {
        if (!isCallableUnavailableError(error)) {
          throw error;
        }
      }
    }

    const nextStatusHistory =
      data.status && current?.status !== data.status
        ? [
            ...(current?.statusHistory ?? []),
            {
              bookingId,
              status: data.status,
              changedAt: nowIso(),
              changedBy: getFirebaseAuth().currentUser?.uid || data.providerId || data.customerId || current?.providerId || current?.customerId || "system",
            },
          ]
        : undefined;
    await updateDoc(doc(getFirestore_(), "bookings", bookingId), {
      ...data,
      ...(nextStatusHistory ? { statusHistory: nextStatusHistory } : {}),
      updatedAt: new Date().toISOString(),
    });

    const slotProviderId = current?.providerId || data.providerId;
    const slotCustomerId = current?.customerId || data.customerId;
    const slotDate = current?.scheduledDate || data.scheduledDate;
    const slotTime = current?.scheduledTime || data.scheduledTime;
    const nextStatus = data.status || current?.status;

    if (slotProviderId && slotDate && slotTime && shouldReleaseBookingSlot(nextStatus)) {
      const slotId = buildBookingSlotId(slotProviderId, slotDate, slotTime);
      await deleteDoc(doc(getFirestore_(), "bookingSlots", slotId));
      if (slotCustomerId) {
        const customerSlotId = buildCustomerBookingSlotId(slotCustomerId, slotDate, slotTime);
        await deleteDoc(doc(getFirestore_(), "customerBookingSlots", customerSlotId));
      }
    }
  },

  async confirmAcceptedBooking(bookingId: string, userId?: string): Promise<void> {
    await updateDoc(doc(getFirestore_(), "bookings", bookingId), {
      customerAcceptanceConfirmedAt: nowIso(),
      customerAcceptanceConfirmedBy: userId || getFirebaseAuth().currentUser?.uid || "system",
      updatedAt: nowIso(),
    });
  },

  // Cancel booking
  async cancelBooking(bookingId: string): Promise<void> {
    await this.updateBooking(bookingId, { status: "Cancelled" });
  },

  // Get all bookings (admin)
  async getAllBookings(): Promise<Booking[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "bookings"));
    return snapshot.docs.map((doc) => doc.data() as Booking);
  },

  async getProviderBookingsByDate(providerId: string, scheduledDate: string): Promise<Booking[]> {
    const bookings = await this.getProviderBookings(providerId);
    return bookings.filter((booking) => booking.scheduledDate === scheduledDate);
  },

  async getReservedSlotTimes(providerId: string, scheduledDate: string): Promise<string[]> {
    const q = query(
      collection(getFirestore_(), "bookingSlots"),
      where("providerId", "==", providerId),
      where("scheduledDate", "==", scheduledDate)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((entry) => entry.data()?.scheduledTime as string | undefined)
      .filter(Boolean) as string[];
  },

  subscribeReservedSlotTimes(
    providerId: string,
    scheduledDate: string,
    callback: (times: string[]) => void
  ): () => void {
    const q = query(
      collection(getFirestore_(), "bookingSlots"),
      where("providerId", "==", providerId),
      where("scheduledDate", "==", scheduledDate)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        callback(
          snapshot.docs
            .map((entry) => entry.data()?.scheduledTime as string | undefined)
            .filter(Boolean) as string[]
        );
      },
      (error) => handleSnapshotError("Reserved slots", error, () => callback([]))
    );
  },

  subscribeCustomerBookings(customerId: string, callback: (bookings: Booking[]) => void): () => void {
    const q = query(collection(getFirestore_(), "bookings"), where("customerId", "==", customerId));
    return onSnapshot(
      q,
      (snapshot) => {
        callback(sortBookingsNewestFirst(snapshot.docs.map((entry) => entry.data() as Booking)));
      },
      (error) => handleSnapshotError("Customer bookings", error, () => callback([]))
    );
  },

  subscribeProviderBookings(providerId: string, callback: (bookings: Booking[]) => void): () => void {
    const q = query(collection(getFirestore_(), "bookings"), where("providerId", "==", providerId));
    return onSnapshot(
      q,
      (snapshot) => {
        callback(sortBookingsNewestFirst(snapshot.docs.map((entry) => entry.data() as Booking)));
      },
      (error) => handleSnapshotError("Provider bookings", error, () => callback([]))
    );
  },
};

export const bookingChangeRequestService = {
  async createRequest(
    data: Omit<BookingChangeRequest, "requestId" | "status" | "createdAt" | "updatedAt">
  ): Promise<string> {
    const requestId = `change-${Date.now()}`;
    const payload: BookingChangeRequest = {
      ...data,
      requestId,
      status: "Pending",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await setDoc(doc(getFirestore_(), "bookingChangeRequests", requestId), sanitizeForFirestore(payload));
    return requestId;
  },

  async getRequestsByBooking(bookingId: string): Promise<BookingChangeRequest[]> {
    const q = query(collection(getFirestore_(), "bookingChangeRequests"), where("bookingId", "==", bookingId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((entry) => entry.data() as BookingChangeRequest);
  },

  async getAllRequests(): Promise<BookingChangeRequest[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "bookingChangeRequests"));
    return snapshot.docs.map((entry) => entry.data() as BookingChangeRequest);
  },

  async updateRequestStatus(
    requestId: string,
    status: BookingChangeRequest["status"],
    resolverId: string,
    adminNotes?: string
  ): Promise<void> {
    const requestRef = doc(getFirestore_(), "bookingChangeRequests", requestId);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error("Change request not found");

    const request = requestSnap.data() as BookingChangeRequest;
    const bookingSnap = await getDoc(doc(getFirestore_(), "bookings", request.bookingId));
    const existingBooking = bookingSnap.exists() ? (bookingSnap.data() as Booking) : null;
    const bookingRef = doc(getFirestore_(), "bookings", request.bookingId);

    await runTransaction(getFirestore_(), async (transaction) => {
      const bookingSnap = await transaction.get(bookingRef);
      if (!bookingSnap.exists()) throw new Error("Booking not found");
      const booking = bookingSnap.data() as Booking;

      transaction.set(
        requestRef,
        sanitizeForFirestore({
          status,
          resolvedBy: resolverId,
          resolvedAt: nowIso(),
          updatedAt: nowIso(),
          adminNotes: adminNotes?.trim() || request.adminNotes || "",
        }),
        { merge: true }
      );

      if (status !== "Approved") {
        return;
      }

      const bookingUpdate: Partial<Booking> = {
        updatedAt: nowIso(),
      };

      if (request.type === "cancellation") {
        bookingUpdate.status = "Cancelled";
      }

      if (request.type === "reschedule") {
        const requestedDate = request.requestedDate || booking.scheduledDate;
        const requestedTime = request.requestedTime || booking.scheduledTime;
        const requestedScheduledAt = request.requestedScheduledAt || request.currentScheduledAt || booking.scheduledAt;

        if (!isSameSlotBooking(booking.scheduledDate, booking.scheduledTime, requestedDate, requestedTime) && requestedDate && requestedTime) {
          const nextProviderSlotId = buildBookingSlotId(booking.providerId, requestedDate, requestedTime);
          const nextCustomerSlotId = buildCustomerBookingSlotId(booking.customerId, requestedDate, requestedTime);
          const nextProviderSlotRef = doc(getFirestore_(), "bookingSlots", nextProviderSlotId);
          const nextCustomerSlotRef = doc(getFirestore_(), "customerBookingSlots", nextCustomerSlotId);
          const [nextProviderSlotSnap, nextCustomerSlotSnap] = await Promise.all([
            transaction.get(nextProviderSlotRef),
            transaction.get(nextCustomerSlotRef),
          ]);

          if (nextProviderSlotSnap.exists()) {
            throw createSlotConflict("BOOKING_SLOT_CONFLICT", nextProviderSlotSnap.data()?.bookingId as string | undefined);
          }
          if (nextCustomerSlotSnap.exists()) {
            throw createSlotConflict("CUSTOMER_BOOKING_SLOT_CONFLICT", nextCustomerSlotSnap.data()?.bookingId as string | undefined);
          }

          transaction.set(nextProviderSlotRef, {
            slotId: nextProviderSlotId,
            bookingId: booking.bookingId,
            providerId: booking.providerId,
            scheduledDate: requestedDate,
            scheduledTime: requestedTime,
            createdAt: nowIso(),
          });
          transaction.set(nextCustomerSlotRef, {
            slotId: nextCustomerSlotId,
            bookingId: booking.bookingId,
            customerId: booking.customerId,
            providerId: booking.providerId,
            scheduledDate: requestedDate,
            scheduledTime: requestedTime,
            createdAt: nowIso(),
          });

          if (booking.scheduledDate && booking.scheduledTime) {
            const currentProviderSlotId = buildBookingSlotId(booking.providerId, booking.scheduledDate, booking.scheduledTime);
            const currentCustomerSlotId = buildCustomerBookingSlotId(booking.customerId, booking.scheduledDate, booking.scheduledTime);
            transaction.delete(doc(getFirestore_(), "bookingSlots", currentProviderSlotId));
            transaction.delete(doc(getFirestore_(), "customerBookingSlots", currentCustomerSlotId));
          }
        }

        bookingUpdate.scheduledDate = requestedDate || undefined;
        bookingUpdate.scheduledTime = requestedTime || undefined;
        bookingUpdate.scheduledAt = requestedScheduledAt || undefined;
      }

      transaction.set(bookingRef, sanitizeForFirestore(bookingUpdate), { merge: true });
    }).catch(async (error) => {
      if (error instanceof Error && (error.message === "BOOKING_SLOT_CONFLICT" || error.message === "CUSTOMER_BOOKING_SLOT_CONFLICT")) {
        const conflictingBookingId = (error as Error & { conflictingBookingId?: string }).conflictingBookingId;
        await bookingConflictService.logConflict({
          providerId: existingBooking?.providerId || request.targetUserId,
          customerId: existingBooking?.customerId,
          bookingId: request.bookingId,
          requestedDate: request.requestedDate || "",
          requestedTime: request.requestedTime || "",
          conflictingBookingId,
          conflictingScheduledAt: request.requestedScheduledAt,
          resolution: "rejected",
          reason: error.message === "CUSTOMER_BOOKING_SLOT_CONFLICT"
            ? "Customer already has another booking at the requested date and time."
            : "Requested reschedule slot is already reserved.",
        });
        throw new Error(
          error.message === "CUSTOMER_BOOKING_SLOT_CONFLICT"
            ? "The customer already has another booking at that date and time."
            : "That reschedule time slot is already reserved."
        );
      }
      throw error;
    });
  },
};

// ============================================================================
// PAYMENT SERVICES
// ============================================================================

export const paymentService = {
  // Create payment
  async createPayment(paymentData: Omit<Payment, "paymentId">): Promise<string> {
    try {
      const result = await callFunction<
        { payment: Omit<Payment, "paymentId"> },
        { paymentId: string }
      >("createPaymentRecord", {
        payment: paymentData,
      });

      return result.paymentId;
    } catch (error) {
      if (!isCallableUnavailableError(error)) {
        throw error;
      }

      const paymentId = `payment-${Date.now()}`;
      await setDoc(doc(getFirestore_(), "payments", paymentId), {
        ...paymentData,
        paymentId,
        createdAt: paymentData.createdAt || nowIso(),
      } as Payment);
      return paymentId;
    }
  },

  // Get payment by ID
  async getPaymentById(paymentId: string): Promise<Payment | null> {
    const docRef = doc(getFirestore_(), "payments", paymentId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as Payment) : null;
  },

  async getPaymentByBookingId(bookingId: string): Promise<Payment | null> {
    const currentUserId = getFirebaseAuth().currentUser?.uid;
    if (!currentUserId) {
      const q = query(collection(getFirestore_(), "payments"), where("bookingId", "==", bookingId));
      const snapshot = await getDocs(q);
      return snapshot.empty ? null : (snapshot.docs[0].data() as Payment);
    }

    const customerSnapshot = await getDocs(
      query(collection(getFirestore_(), "payments"), where("customerId", "==", currentUserId))
    );
    const customerPayment = customerSnapshot.docs
      .map((doc) => doc.data() as Payment)
      .find((payment) => payment.bookingId === bookingId);
    if (customerPayment) {
      return customerPayment;
    }

    const providerSnapshot = await getDocs(
      query(collection(getFirestore_(), "payments"), where("providerId", "==", currentUserId))
    );
    return providerSnapshot.docs
      .map((doc) => doc.data() as Payment)
      .find((payment) => payment.bookingId === bookingId) ?? null;
  },

  // Get customer payments
  async getCustomerPayments(customerId: string): Promise<Payment[]> {
    const q = query(collection(getFirestore_(), "payments"), where("customerId", "==", customerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as Payment);
  },

  // Get provider earnings
  async getProviderEarnings(providerId: string): Promise<Payment[]> {
    const q = query(collection(getFirestore_(), "payments"), where("providerId", "==", providerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as Payment);
  },

  // Update payment status
  async updatePaymentStatus(paymentId: string, status: string): Promise<void> {
    try {
      await callFunction<{ paymentId: string; status: string }, { ok: boolean }>("updatePaymentStatus", {
        paymentId,
        status,
      });
    } catch (error) {
      if (!isCallableUnavailableError(error)) {
        throw error;
      }
      await updateDoc(doc(getFirestore_(), "payments", paymentId), { status });
    }
  },

  async updatePayment(paymentId: string, data: Partial<Pick<Payment, "amount" | "method" | "status">>): Promise<void> {
    await updateDoc(doc(getFirestore_(), "payments", paymentId), sanitizeForFirestore(data));
  },

  // Get all payments (admin)
  async getAllPayments(): Promise<Payment[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "payments"));
    return snapshot.docs.map((doc) => doc.data() as Payment);
  },
};

// ============================================================================
// WORKER PAYMENT / ADMIN REVENUE SERVICES
// ============================================================================

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export const workerPaymentService = {
  async getSettings(): Promise<WorkerPaymentSettings> {
    const ref = doc(getFirestore_(), "platformSettings", "workerPayments");
    const defaults = defaultWorkerPaymentSettings();
    try {
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        return normalizeWorkerPaymentSettings(snapshot.data() as Partial<WorkerPaymentSettings>, defaults);
      }
      await setDoc(ref, sanitizeForFirestore(defaults), { merge: true });
    } catch (error) {
      if (!isPermissionDeniedError(error)) {
        throw error;
      }
    }
    return defaults;
  },

  async updateSettings(data: Partial<WorkerPaymentSettings>, adminId: string): Promise<void> {
    const current = await this.getSettings();
    const next = sanitizeForFirestore(normalizeWorkerPaymentSettings({
      ...current,
      ...data,
      updatedBy: adminId,
      updatedAt: nowIso(),
    }, current));
    try {
      await callFunction<Record<string, unknown>, WorkerPaymentSettings>("updateWorkerPaymentSettings", next as unknown as Record<string, unknown>);
      return;
    } catch (error) {
      if (!isCallableUnavailableError(error)) {
        throw error;
      }
    }
    await setDoc(doc(getFirestore_(), "platformSettings", "workerPayments"), next, { merge: true });
  },

  async backfillExistingWorkerFinance(adminId: string): Promise<{ created: number }> {
    try {
      return await callFunction<{ adminId: string }, { created: number }>("backfillExistingWorkerFinance", { adminId });
    } catch (error) {
      if (!isCallableUnavailableError(error)) {
        throw error;
      }
    }

    const settings = await this.getSettings();
    const providers = await providerService.getAllProviderProfiles();
    let created = 0;
    await Promise.all(providers.filter((profile) => profile.isApproved).map(async (profile) => {
      const summaryRef = doc(getFirestore_(), "workerFinanceSummaries", profile.userId);
      const summarySnap = await getDoc(summaryRef);
      if (summarySnap.exists()) return;
      const summary: WorkerFinanceSummary = {
        providerId: profile.userId,
        userId: profile.userId,
        registrationPaymentStatus: "Waived",
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
        updatedAt: nowIso(),
      };
      await setDoc(summaryRef, sanitizeForFirestore(summary), { merge: true });
      await setDoc(doc(getFirestore_(), "providerProfiles", profile.userId), sanitizeForFirestore({
        financialStatus: {
          registrationPaymentStatus: "Waived",
          freeBookingsGranted: settings.freeBookingsGranted,
          freeBookingsUsed: 0,
          freeBookingsRemaining: settings.freeBookingsGranted,
          restrictedFromAcceptingBookings: false,
          hasOverdueCommission: false,
          updatedAt: nowIso(),
        },
      }), { merge: true });
      created += 1;
    }));
    await adminAuditService.logAction({
      actorId: adminId,
      actorRole: "admin",
      action: "worker_payment_settings_updated",
      targetCollection: "workerFinanceSummaries",
      targetId: "backfill",
      summary: "Backfilled existing worker finance summaries.",
      metadata: { created },
    }).catch(() => undefined);
    return { created };
  },

  async uploadPaymentProof(value: string | MediaAttachment, pathPrefix: string, uploadedBy: string): Promise<MediaAttachment> {
    assertWorkerPaymentProof(value, "Payment proof");
    return persistMediaAttachment(
      value,
      `${pathPrefix}/${Date.now()}-${toStorageSafeSegment(typeof value === "string" ? "proof" : value.fileName || value.id || "proof")}`,
      "payment-proof",
      uploadedBy,
      WORKER_PAYMENT_PROOF_MAX_BYTES
    );
  },

  async uploadQrCode(value: string | MediaAttachment, adminId: string): Promise<MediaAttachment> {
    assertWorkerPaymentProof(value, "Payment QR code");
    const currentUserId = getFirebaseAuth().currentUser?.uid || adminId;
    return persistMediaAttachment(
      value,
      `workerPayments/settings/qr-${Date.now()}`,
      "payment-qr-code",
      currentUserId,
      WORKER_PAYMENT_PROOF_MAX_BYTES
    );
  },

  async getRegistrationPayment(paymentId?: string): Promise<WorkerRegistrationPayment | null> {
    if (!paymentId) return null;
    const snapshot = await getDoc(doc(getFirestore_(), "workerRegistrationPayments", paymentId));
    return snapshot.exists() ? (snapshot.data() as WorkerRegistrationPayment) : null;
  },

  async getRegistrationPaymentByProvider(providerId: string): Promise<WorkerRegistrationPayment | null> {
    const snapshot = await getDocs(query(collection(getFirestore_(), "workerRegistrationPayments"), where("userId", "==", providerId)));
    return snapshot.docs
      .map((entry) => entry.data() as WorkerRegistrationPayment)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;
  },

  async reviewRegistrationPayment(paymentId: string, adminId: string, status: "Approved" | "Rejected", adminRemarks?: string): Promise<void> {
    if (status === "Rejected" && !adminRemarks?.trim()) {
      throw new Error("Admin remarks are required when rejecting a payment proof.");
    }
    try {
      await callFunction<{ paymentId: string; status: "Approved" | "Rejected"; adminRemarks?: string }, { ok: boolean }>(
        "reviewWorkerRegistrationPayment",
        { paymentId, status, adminRemarks: adminRemarks?.trim() }
      );
      return;
    } catch (error) {
      if (!isCallableUnavailableError(error)) {
        throw error;
      }
    }

    let payment = await this.getRegistrationPayment(paymentId);
    if (!payment) {
      const applicationSnapshot = await getDocs(query(collection(getFirestore_(), "providerApplications"), where("registrationPaymentId", "==", paymentId)));
      const application = applicationSnapshot.docs[0]?.data() as ProviderApplication | undefined;
      const snapshotPayment = application?.registrationPaymentSnapshot;
      if (snapshotPayment?.paymentId) {
        payment = sanitizeForFirestore({
          ...snapshotPayment,
          paymentId,
          applicationId: snapshotPayment.applicationId || application?.applicationId,
          providerId: snapshotPayment.providerId || application?.userId,
          userId: snapshotPayment.userId || application?.userId,
          required: snapshotPayment.required ?? application?.registrationFeeRequired ?? true,
          waived: snapshotPayment.waived ?? false,
          amount: Number(snapshotPayment.amount || 0),
          methodName: snapshotPayment.methodName || "Manual payment",
          status: snapshotPayment.status || "Submitted",
          createdAt: snapshotPayment.createdAt || nowIso(),
          updatedAt: snapshotPayment.updatedAt || nowIso(),
        } as WorkerRegistrationPayment);
      }
    }
    if (!payment) {
      throw new Error("Registration payment record is missing. Ask the worker to resubmit the payment proof, then refresh this page.");
    }
    if (status === "Approved" && payment.required && (!payment.proofImageUrl || !payment.referenceNumber || !payment.paymentDate)) {
      throw new Error("This payment cannot be approved because its proof image, reference number, or payment date is missing.");
    }
    const batch = writeBatch(getFirestore_());
    batch.set(doc(getFirestore_(), "workerRegistrationPayments", paymentId), sanitizeForFirestore({
      ...payment,
      status,
      reviewedBy: adminId,
      reviewedAt: nowIso(),
      adminRemarks: adminRemarks?.trim() || "",
      updatedAt: nowIso(),
    }), { merge: true });
    batch.set(doc(getFirestore_(), "providerApplications", payment.applicationId), sanitizeForFirestore({
      registrationPaymentStatus: status,
      registrationPaymentSnapshot: {
        ...payment,
        status,
        reviewedBy: adminId,
        reviewedAt: nowIso(),
        adminRemarks: adminRemarks?.trim() || "",
        updatedAt: nowIso(),
      },
    }), { merge: true });
    batch.set(doc(getFirestore_(), "providerProfiles", payment.providerId), {
      financialStatus: {
        registrationPaymentStatus: status,
        updatedAt: nowIso(),
      },
    }, { merge: true });
    if (status === "Approved" && payment.amount > 0) {
      const revenueId = `revenue-registration-${paymentId}`;
      batch.set(doc(getFirestore_(), "adminRevenueRecords", revenueId), sanitizeForFirestore({
        revenueId,
        sourceType: "registration_fee",
        sourcePaymentId: paymentId,
        providerId: payment.providerId,
        userId: payment.userId,
        amount: payment.amount,
        status: "Approved",
        approvedBy: adminId,
        approvedAt: nowIso(),
        createdAt: nowIso(),
      } as AdminRevenueRecord), { merge: true });
    }
    await batch.commit();
  },

  async getFinanceSummary(providerId: string): Promise<WorkerFinanceSummary> {
    const snapshot = await getDoc(doc(getFirestore_(), "workerFinanceSummaries", providerId));
    if (snapshot.exists()) {
      return snapshot.data() as WorkerFinanceSummary;
    }
    return this.ensureFinanceSummary(providerId);
  },

  async ensureFinanceSummary(providerId: string): Promise<WorkerFinanceSummary> {
    const settings = await this.getSettings();
    const registration = await this.getRegistrationPaymentByProvider(providerId);
    const profile = await userService.getProviderProfile(providerId);
    const existingWorker = profile?.isApproved && !registration;
    const summary: WorkerFinanceSummary = {
      providerId,
      userId: providerId,
      registrationPaymentStatus: existingWorker ? "Waived" : registration?.status || "Pending",
      registrationPaymentId: registration?.paymentId,
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
      updatedAt: nowIso(),
    };
    try {
      await setDoc(doc(getFirestore_(), "workerFinanceSummaries", providerId), sanitizeForFirestore(summary), { merge: true });
      if (existingWorker) {
        await setDoc(doc(getFirestore_(), "providerProfiles", providerId), {
          financialStatus: {
            registrationPaymentStatus: "Waived",
            freeBookingsGranted: settings.freeBookingsGranted,
            freeBookingsUsed: 0,
            freeBookingsRemaining: settings.freeBookingsGranted,
            restrictedFromAcceptingBookings: false,
            hasOverdueCommission: false,
            updatedAt: nowIso(),
          },
        }, { merge: true });
      }
    } catch {
      // Non-admin clients can still use the safe default locally when a server-created summary does not exist yet.
    }
    return summary;
  },

  async getCommissionBills(providerId: string): Promise<WorkerCommissionBill[]> {
    const snapshot = await getDocs(query(collection(getFirestore_(), "workerCommissionBills"), where("userId", "==", providerId)));
    return snapshot.docs
      .map((entry) => entry.data() as WorkerCommissionBill)
      .sort((left, right) => right.cycleEnd.localeCompare(left.cycleEnd));
  },

  async getCommissionBillById(providerId: string, billId: string): Promise<WorkerCommissionBill | null> {
    const snapshot = await getDoc(doc(getFirestore_(), "workerCommissionBills", billId));
    if (!snapshot.exists()) return null;
    const bill = snapshot.data() as WorkerCommissionBill;
    if (bill.userId !== providerId && bill.providerId !== providerId) return null;
    return bill;
  },

  async releaseCurrentCommissionBill(providerId: string): Promise<WorkerCommissionBill | null> {
    return callFunction<{ providerId: string }, WorkerCommissionBill | null>(
      "releaseCurrentWorkerCommissionBill",
      { providerId }
    );
  },

  async getAllCommissionBills(): Promise<WorkerCommissionBill[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "workerCommissionBills"));
    return snapshot.docs.map((entry) => entry.data() as WorkerCommissionBill);
  },

  async getAllRegistrationPayments(): Promise<WorkerRegistrationPayment[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "workerRegistrationPayments"));
    return snapshot.docs.map((entry) => entry.data() as WorkerRegistrationPayment);
  },

  async getAllRevenueRecords(): Promise<AdminRevenueRecord[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "adminRevenueRecords"));
    return snapshot.docs.map((entry) => entry.data() as AdminRevenueRecord);
  },

  async submitCommissionPayment(
    billId: string,
    providerId: string,
    data: { proofImage: string | MediaAttachment; referenceNumber: string; paymentDate: string; methodName?: string }
  ): Promise<void> {
    const referenceNumber = data.referenceNumber.trim();
    if (!referenceNumber) throw new Error("Payment reference number is required.");
    if (referenceNumber.length < 4) throw new Error("Payment reference number is too short.");
    if (!data.paymentDate) throw new Error("Payment date is required.");
    const bill = await this.getCommissionBillById(providerId, billId);
    if (!bill) throw new Error("Commission bill not found.");
    if (bill.status === "Submitted") throw new Error("This commission payment is already waiting for admin approval.");
    if (["Approved", "Waived", "Not Required"].includes(bill.status)) {
      throw new Error("This commission bill no longer needs payment submission.");
    }
    if (Number(bill.amountDue || 0) <= 0) {
      throw new Error("This commission bill does not have a payable balance.");
    }
    const paymentDate = new Date(data.paymentDate);
    if (!Number.isFinite(paymentDate.getTime())) {
      throw new Error("Payment date is invalid.");
    }
    const today = new Date();
    if (paymentDate.getTime() > today.getTime()) {
      throw new Error("Payment date cannot be in the future.");
    }
    const proof = await this.uploadPaymentProof(data.proofImage, `workerPayments/commission/${providerId}/${billId}`, providerId);
    await setDoc(doc(getFirestore_(), "workerCommissionBills", billId), sanitizeForFirestore({
      status: "Submitted",
      proofImageUrl: proof.url,
      proofImagePath: proof.storagePath,
      referenceNumber,
      paymentDate: data.paymentDate,
      submittedAt: nowIso(),
      updatedAt: nowIso(),
    }), { merge: true });
    await notificationService.createNotification({
      userId: providerId,
      type: "commission_payment_submitted",
      title: "Commission payment submitted",
      body: "Your commission payment proof is waiting for admin approval.",
      isRead: false,
      route: "/(tabs)/profile",
      createdAt: nowIso(),
    }).catch(() => undefined);
  },

  async reviewCommissionPayment(billId: string, adminId: string, status: "Approved" | "Rejected", adminRemarks?: string): Promise<void> {
    if (status === "Rejected" && !adminRemarks?.trim()) {
      throw new Error("Admin remarks are required when rejecting a commission payment.");
    }
    try {
      await callFunction<{ billId: string; status: "Approved" | "Rejected"; adminRemarks?: string }, { ok: boolean }>(
        "reviewWorkerCommissionPayment",
        { billId, status, adminRemarks: adminRemarks?.trim() }
      );
      return;
    } catch (error) {
      if (!isCallableUnavailableError(error)) {
        throw error;
      }
    }
    const billSnap = await getDoc(doc(getFirestore_(), "workerCommissionBills", billId));
    if (!billSnap.exists()) throw new Error("Commission bill not found.");
    const bill = billSnap.data() as WorkerCommissionBill;
    const batch = writeBatch(getFirestore_());
    batch.set(doc(getFirestore_(), "workerCommissionBills", billId), sanitizeForFirestore({
      status,
      reviewedBy: adminId,
      reviewedAt: nowIso(),
      adminRemarks: adminRemarks?.trim() || "",
      updatedAt: nowIso(),
    }), { merge: true });
    if (status === "Approved") {
      const revenueId = `revenue-commission-${billId}`;
      batch.set(doc(getFirestore_(), "adminRevenueRecords", revenueId), sanitizeForFirestore({
        revenueId,
        sourceType: "monthly_commission",
        sourcePaymentId: billId,
        providerId: bill.providerId,
        userId: bill.userId,
        amount: bill.amountDue,
        status: "Approved",
        approvedBy: adminId,
        approvedAt: nowIso(),
        cycleStart: bill.cycleStart,
        cycleEnd: bill.cycleEnd,
        createdAt: nowIso(),
      } as AdminRevenueRecord), { merge: true });
    }
    await batch.commit();
    if (status === "Approved") {
      await this.recomputeFinanceSummary(bill.providerId);
    }
  },

  async recomputeFinanceSummary(providerId: string, existingBatch?: WriteBatch): Promise<WorkerFinanceSummary> {
    const settings = await this.getSettings();
    const [bookings, payments, bills, registration, existingSummarySnapshot] = await Promise.all([
      bookingService.getProviderBookings(providerId),
      paymentService.getProviderEarnings(providerId),
      this.getCommissionBills(providerId),
      this.getRegistrationPaymentByProvider(providerId),
      getDoc(doc(getFirestore_(), "workerFinanceSummaries", providerId)),
    ]);
    const existingSummary = existingSummarySnapshot.exists() ? (existingSummarySnapshot.data() as Partial<WorkerFinanceSummary>) : null;
    const featureActivatedAt = existingSummary?.featureActivatedAt || settings.featureActivatedAt;
    const activationTime = new Date(featureActivatedAt).getTime();
    const completedPaid = bookings
      .filter((booking) => {
        const trackedAt = new Date(booking.workerAcceptedAt || booking.updatedAt || booking.createdAt).getTime();
        return ["Accepted", "On the Way", "In Progress", "Completed"].includes(booking.status) && trackedAt >= activationTime;
      })
      .sort((left, right) => {
        const byDate = new Date(left.workerAcceptedAt || left.updatedAt || left.createdAt).getTime() - new Date(right.workerAcceptedAt || right.updatedAt || right.createdAt).getTime();
        return byDate || left.bookingId.localeCompare(right.bookingId);
      });
    const totalIncome = completedPaid.reduce((sum, booking) => {
      const payment = payments.find((entry) => entry.bookingId === booking.bookingId && entry.status === "Paid");
      return sum + Number(payment?.amount ?? booking.amount ?? 0);
    }, 0);
    const freeUsed = Math.min(settings.freeBookingsGranted, completedPaid.length);
    const approvedBills = bills.filter((bill) => bill.status === "Approved");
    const pendingBills = bills.filter((bill) => bill.status === "Pending" || bill.status === "Submitted" || bill.status === "Rejected");
    const overdueBills = bills.filter((bill) => bill.status === "Overdue");
    const summary: WorkerFinanceSummary = {
      providerId,
      userId: providerId,
      registrationPaymentStatus: registration?.status || "Waived",
      registrationPaymentId: registration?.paymentId,
      totalFreeBookingsGranted: settings.freeBookingsGranted,
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
      restrictionReason: overdueBills.length ? "Your monthly 10% admin payment is overdue. Please settle it first before accepting or matching new bookings." : undefined,
      restrictedSince: overdueBills.length ? overdueBills[0].graceEndsAt : undefined,
      restrictionLiftedAt: overdueBills.length ? undefined : nowIso(),
      lastBillId: bills[0]?.billId,
      featureActivatedAt,
      updatedAt: nowIso(),
    };
    const batch = existingBatch || writeBatch(getFirestore_());
    batch.set(doc(getFirestore_(), "workerFinanceSummaries", providerId), sanitizeForFirestore(summary), { merge: true });
    batch.set(doc(getFirestore_(), "providerProfiles", providerId), sanitizeForFirestore({
      financialStatus: {
        registrationPaymentStatus: summary.registrationPaymentStatus,
        freeBookingsGranted: summary.totalFreeBookingsGranted,
        freeBookingsUsed: summary.freeBookingsUsed,
        freeBookingsRemaining: summary.freeBookingsRemaining,
        restrictedFromAcceptingBookings: summary.restrictedFromAcceptingBookings,
        restrictionReason: summary.restrictionReason,
        hasOverdueCommission: summary.hasOverdueCommission,
        updatedAt: nowIso(),
      },
    }), { merge: true });
    if (!existingBatch) await batch.commit();
    return summary;
  },

  async canWorkerAcceptBookings(providerId: string): Promise<{ allowed: boolean; reason?: string }> {
    let summary: WorkerFinanceSummary | null = null;
    let bills: WorkerCommissionBill[] = [];

    try {
      [summary, bills] = await Promise.all([
        this.getFinanceSummary(providerId),
        this.getCommissionBills(providerId),
      ]);
    } catch (error) {
      if (!isPermissionDeniedError(error)) {
        throw error;
      }

      // Customer-side booking checks can fall back to the provider's public profile status.
      const profile = await userService.getProviderProfile(providerId);
      const financialStatus = profile?.financialStatus;
      if (financialStatus?.restrictedFromAcceptingBookings || financialStatus?.hasOverdueCommission) {
        return {
          allowed: false,
          reason: financialStatus.restrictionReason || "This worker cannot accept bookings right now until the admin payment is settled.",
        };
      }
      return { allowed: true };
    }

    const now = new Date();
    const hasBlockingBill = bills.some((bill) => {
      if (bill.status === "Overdue") return true;
      if (!["Pending", "Submitted", "Rejected"].includes(bill.status)) return false;
      return Boolean(bill.graceEndsAt && new Date(bill.graceEndsAt) < now);
    });
    if (hasBlockingBill) {
      return { allowed: false, reason: "Your admin commission payment is overdue. Please pay the admin before accepting another booking." };
    }
    if (summary.restrictedFromAcceptingBookings || summary.hasOverdueCommission) {
      return { allowed: false, reason: summary.restrictionReason || "You have an overdue admin commission payment." };
    }
    return { allowed: true };
  },

  async generateMonthlyBill(providerId: string, cycleDate = new Date()): Promise<WorkerCommissionBill | null> {
    const settings = await this.getSettings();
    if (!settings.commissionEnabled) return null;
    const { start, end } = commissionOfficialCycleBounds(cycleDate);
    const billId = `commission-${providerId}-${monthKeyFromDate(end)}`;
    const existing = await getDoc(doc(getFirestore_(), "workerCommissionBills", billId));
    const existingBill = existing.exists() ? (existing.data() as WorkerCommissionBill) : null;
    if (existingBill?.status === "Approved") return existingBill;

    const [bookings, payments, summary] = await Promise.all([
      bookingService.getProviderBookings(providerId),
      paymentService.getProviderEarnings(providerId),
      this.getFinanceSummary(providerId),
    ]);
    const paidByBookingId = new Map(payments.filter((payment) => payment.status === "Paid").map((payment) => [payment.bookingId, payment]));
    const activationTime = new Date(summary.featureActivatedAt || settings.featureActivatedAt).getTime();
    const allCompletedPaid = bookings
      .filter((booking) => {
        const trackedAt = new Date(booking.workerAcceptedAt || booking.updatedAt || booking.createdAt).getTime();
        return ["Accepted", "On the Way", "In Progress", "Completed"].includes(booking.status) && trackedAt >= activationTime;
      })
      .sort((left, right) => {
        const byDate = new Date(left.workerAcceptedAt || left.updatedAt || left.createdAt).getTime() - new Date(right.workerAcceptedAt || right.updatedAt || right.createdAt).getTime();
        return byDate || left.bookingId.localeCompare(right.bookingId);
      });
    const completedPaid = allCompletedPaid.filter((booking) => {
      const trackedAt = new Date(booking.workerAcceptedAt || booking.updatedAt || booking.createdAt);
      return trackedAt >= start && trackedAt <= end;
    });
    if (!completedPaid.length) return null;
    const priorCompletedPaidCount = allCompletedPaid.filter((booking) => new Date(booking.workerAcceptedAt || booking.updatedAt || booking.createdAt) < start).length;
    const freeBeforeBill = Math.max(0, settings.freeBookingsGranted - priorCompletedPaidCount);
    const freeApplied = Math.min(freeBeforeBill, completedPaid.length);
    const commissionableBookings = Math.max(0, completedPaid.length - freeApplied);
    const commissionableIncome = completedPaid.slice(freeApplied).reduce((sum, booking) => {
      const payment = paidByBookingId.get(booking.bookingId);
      return sum + Number(payment?.amount ?? booking.amount ?? 0);
    }, 0);
    const dueDate = new Date(end.getFullYear(), end.getMonth() + 1, settings.monthlyBillDueDay, 23, 59, 59, 999);
    const graceEndsAt = addDays(dueDate, settings.gracePeriodDays).toISOString();
    const surchargeSnapshot = applyCommissionSurcharge(
      roundMoney(commissionableIncome * (settings.commissionPercentage / 100)),
      graceEndsAt,
      settings.lateSurchargeRate
    );
    const bill: WorkerCommissionBill = {
      billId,
      providerId,
      userId: providerId,
      cycleStart: start.toISOString(),
      cycleEnd: end.toISOString(),
      generatedAt: existingBill?.generatedAt || nowIso(),
      dueDate: dueDate.toISOString(),
      graceEndsAt,
      status: existingBill?.status && existingBill.status !== "Waived" ? existingBill.status : commissionableBookings > 0 ? "Pending" : "Waived",
      totalIncome: completedPaid.reduce((sum, booking) => sum + Number(paidByBookingId.get(booking.bookingId)?.amount ?? booking.amount ?? 0), 0),
      totalCompletedPaidBookings: completedPaid.length,
      freeBookingsAppliedThisBill: freeApplied,
      freeBookingsRemainingAfterBill: Math.max(0, freeBeforeBill - freeApplied),
      commissionableBookings,
      commissionPercentage: settings.commissionPercentage,
      baseCommissionAmount: surchargeSnapshot.baseCommissionAmount,
      surchargeRateApplied: surchargeSnapshot.surchargeRateApplied,
      surchargeDaysApplied: surchargeSnapshot.surchargeDaysApplied,
      surchargeAmount: surchargeSnapshot.surchargeAmount,
      amountDue: surchargeSnapshot.amountDue,
      createdAt: existingBill?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    const batch = writeBatch(getFirestore_());
    batch.set(doc(getFirestore_(), "workerCommissionBills", billId), sanitizeForFirestore(bill), { merge: true });
    completedPaid.forEach((booking, index) => {
      const paymentAmount = Number(paidByBookingId.get(booking.bookingId)?.amount ?? booking.amount ?? 0);
      const isCommissionable = index >= freeApplied;
      batch.set(doc(getFirestore_(), "bookings", booking.bookingId), sanitizeForFirestore({
        commissionEvaluated: true,
        commissionable: isCommissionable,
        usedFreeBookingAllowance: !isCommissionable,
        commissionPercentage: settings.commissionPercentage,
        commissionAmount: isCommissionable ? Math.round(paymentAmount * (settings.commissionPercentage / 100) * 100) / 100 : 0,
        commissionBillId: isCommissionable ? billId : "",
      }), { merge: true });
    });
    await batch.commit();
    await this.recomputeFinanceSummary(providerId);
    return bill;
  },

  async markOverdueBills(): Promise<void> {
    const now = new Date();
    const settings = await this.getSettings();
    const bills = await this.getAllCommissionBills();
    const overdue = bills.filter((bill) => ["Pending", "Submitted", "Rejected"].includes(bill.status) && new Date(bill.graceEndsAt) < now);
    const existingOverdue = bills.filter((bill) => bill.status === "Overdue");
    if (!overdue.length && !existingOverdue.length) return;
    const batch = writeBatch(getFirestore_());
    overdue.forEach((bill) => {
      const surchargeSnapshot = applyCommissionSurcharge(
        Number(bill.baseCommissionAmount ?? bill.amountDue ?? 0),
        bill.graceEndsAt,
        settings.lateSurchargeRate,
        now
      );
      batch.set(doc(getFirestore_(), "workerCommissionBills", bill.billId), {
        status: "Overdue",
        baseCommissionAmount: surchargeSnapshot.baseCommissionAmount,
        surchargeRateApplied: surchargeSnapshot.surchargeRateApplied,
        surchargeDaysApplied: surchargeSnapshot.surchargeDaysApplied,
        surchargeAmount: surchargeSnapshot.surchargeAmount,
        amountDue: surchargeSnapshot.amountDue,
        updatedAt: nowIso(),
      }, { merge: true });
    });
    existingOverdue.forEach((bill) => {
      const surchargeSnapshot = applyCommissionSurcharge(
        Number(bill.baseCommissionAmount ?? bill.amountDue ?? 0),
        bill.graceEndsAt,
        settings.lateSurchargeRate,
        now
      );
      batch.set(doc(getFirestore_(), "workerCommissionBills", bill.billId), {
        baseCommissionAmount: surchargeSnapshot.baseCommissionAmount,
        surchargeRateApplied: surchargeSnapshot.surchargeRateApplied,
        surchargeDaysApplied: surchargeSnapshot.surchargeDaysApplied,
        surchargeAmount: surchargeSnapshot.surchargeAmount,
        amountDue: surchargeSnapshot.amountDue,
        updatedAt: nowIso(),
      }, { merge: true });
    });
    await batch.commit();
    await Promise.all([...new Set([...overdue, ...existingOverdue].map((bill) => bill.providerId))].map((providerId) => this.recomputeFinanceSummary(providerId)));
  },
};

async function getWorkerFeatureRestriction(userId?: string): Promise<{ restricted: boolean; reason?: string }> {
  const targetUserId = userId || getFirebaseAuth().currentUser?.uid;
  if (!targetUserId) return { restricted: false };
  const user = await userService.getUserDocument(targetUserId).catch(() => null);
  if (user?.role !== "provider") return { restricted: false };
  const restriction = await workerPaymentService.canWorkerAcceptBookings(targetUserId);
  return restriction.allowed
    ? { restricted: false }
    : { restricted: true, reason: restriction.reason || "Your admin commission payment is overdue. Please pay the admin to use this feature." };
}

async function assertWorkerFeatureAllowed(userId?: string): Promise<void> {
  const restriction = await getWorkerFeatureRestriction(userId);
  if (restriction.restricted) {
    throw new Error(restriction.reason || "Your admin commission payment is overdue. Please pay the admin to continue.");
  }
}

// ============================================================================
// MESSAGING SERVICES
// ============================================================================

export const messagingService = {
  // Get or create message thread
  async getOrCreateThread(bookingId: string, participants: string[]): Promise<string> {
    await assertWorkerFeatureAllowed(getFirebaseAuth().currentUser?.uid);
    const normalizedParticipants = [...participants].sort();
    const participantQuery = query(
      collection(getFirestore_(), "messageThreads"),
      where("participants", "array-contains", participants[0])
    );
    const participantSnapshot = await getDocs(participantQuery);
    const existingDirectThread = participantSnapshot.docs.find((entry) => {
      const thread = entry.data() as MessageThread;
      return [...thread.participants].sort().join("|") === normalizedParticipants.join("|");
    });

    if (existingDirectThread) {
      const existing = existingDirectThread.data() as MessageThread;
      const nextPayload: Partial<MessageThread> = {};
      if (existing.archivedFor?.length) {
        nextPayload.archivedFor = existing.archivedFor.filter((userId) => !participants.includes(userId));
      }
      if (existing.bookingId !== bookingId && !existing.bookingId.startsWith("support-")) {
        nextPayload.bookingId = bookingId;
      }
      if (Object.keys(nextPayload).length) {
        await updateDoc(existingDirectThread.ref, nextPayload);
      }
      return existingDirectThread.id;
    }

    const threadId = `thread-${Date.now()}`;
    await setDoc(doc(getFirestore_(), "messageThreads", threadId), {
      threadId,
      bookingId,
      participants,
      archivedFor: [],
      pinnedFor: [],
      lastMessage: "",
      updatedAt: new Date().toISOString(),
    } as MessageThread);

    return threadId;
  },

  // Send message
  async sendMessage(
    threadId: string,
    senderId: string,
    text: string,
    attachments: Array<string | MediaAttachment> = []
  ): Promise<string> {
    await assertWorkerFeatureAllowed(senderId);
    const messageId = `msg-${Date.now()}`;
    const thread = await getDoc(doc(getFirestore_(), "messageThreads", threadId));
    const threadData = thread.exists() ? (thread.data() as MessageThread) : null;
    const deliveredTo = Object.fromEntries(
      (threadData?.participants ?? [])
        .filter((participant) => participant !== senderId)
        .map((participant) => [participant, nowIso()])
    );
    const attachmentItems = await mediaService.uploadMany(attachments, `messages/${threadId}/${messageId}`, senderId);

    await setDoc(doc(getFirestore_(), "messages", messageId), {
      messageId,
      threadId,
      senderId,
      text,
      attachments: attachmentItems.map((item) => item.url),
      attachmentItems,
      deliveredTo,
      readBy: { [senderId]: nowIso() },
      sentAt: nowIso(),
    } as Message);

    // Update thread's last message
    await updateDoc(doc(getFirestore_(), "messageThreads", threadId), {
      lastMessage: text,
      lastMessageSenderId: senderId,
      readBy: { [senderId]: nowIso() },
      updatedAt: nowIso(),
    });

    return messageId;
  },

  async markThreadAsRead(threadId: string, readerId: string): Promise<void> {
    const messages = await this.getThreadMessages(threadId);
    const unread = messages.filter((message) => message.senderId !== readerId && !message.readBy?.[readerId]);
    await Promise.all(
      unread.map((message) =>
        updateDoc(doc(getFirestore_(), "messages", message.messageId), {
          readAt: nowIso(),
          [`readBy.${readerId}`]: nowIso(),
        })
      )
    );
    await setDoc(
      doc(getFirestore_(), "messageThreads", threadId),
      {
        readBy: { [readerId]: nowIso() },
      },
      { merge: true }
    );
  },

  async markThreadAsUnread(threadId: string, readerId: string): Promise<void> {
    const messages = await this.getThreadMessages(threadId);
    const incoming = messages.filter((message) => message.senderId !== readerId);
    await Promise.all(
      incoming.map((message) =>
        updateDoc(doc(getFirestore_(), "messages", message.messageId), {
          [`readBy.${readerId}`]: deleteField(),
        })
      )
    );
    await updateDoc(doc(getFirestore_(), "messageThreads", threadId), {
      [`readBy.${readerId}`]: deleteField(),
    });
  },

  // Get thread messages
  async getThreadMessages(threadId: string): Promise<Message[]> {
    const restriction = await getWorkerFeatureRestriction();
    if (restriction.restricted) return [];
    const q = query(collection(getFirestore_(), "messages"), where("threadId", "==", threadId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as Message);
  },

  // Get user threads
  async getUserThreads(userId: string): Promise<MessageThread[]> {
    const restriction = await getWorkerFeatureRestriction(userId);
    if (restriction.restricted) return [];
    const q = query(
      collection(getFirestore_(), "messageThreads"),
      where("participants", "array-contains", userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => doc.data() as MessageThread)
      .filter((thread) => !thread.archivedFor?.includes(userId));
  },

  async getArchivedThreads(userId: string): Promise<MessageThread[]> {
    const restriction = await getWorkerFeatureRestriction(userId);
    if (restriction.restricted) return [];
    const q = query(
      collection(getFirestore_(), "messageThreads"),
      where("participants", "array-contains", userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => doc.data() as MessageThread)
      .filter((thread) => thread.archivedFor?.includes(userId));
  },

  async getUnreadMessageCount(userId: string): Promise<number> {
    const threads = await this.getUserThreads(userId);
    const messagesPerThread = await Promise.all(threads.map((thread) => this.getThreadMessages(thread.threadId)));
    return messagesPerThread
      .flat()
      .filter((message) => message.senderId !== userId && !message.readAt).length;
  },

  async archiveThread(threadId: string, userId: string): Promise<void> {
    const ref = doc(getFirestore_(), "messageThreads", threadId);
    const current = await getDoc(ref);
    const thread = current.exists() ? (current.data() as MessageThread) : null;
    const archivedFor = Array.from(new Set([...(thread?.archivedFor ?? []), userId]));
    await setDoc(ref, { archivedFor }, { merge: true });
  },

  async unarchiveThread(threadId: string, userId: string): Promise<void> {
    const ref = doc(getFirestore_(), "messageThreads", threadId);
    const current = await getDoc(ref);
    const thread = current.exists() ? (current.data() as MessageThread) : null;
    const archivedFor = (thread?.archivedFor ?? []).filter((entry) => entry !== userId);
    await setDoc(ref, { archivedFor }, { merge: true });
  },

  async pinThread(threadId: string, userId: string): Promise<void> {
    const ref = doc(getFirestore_(), "messageThreads", threadId);
    const current = await getDoc(ref);
    const thread = current.exists() ? (current.data() as MessageThread) : null;
    const pinnedFor = Array.from(new Set([...(thread?.pinnedFor ?? []), userId]));
    await setDoc(ref, { pinnedFor }, { merge: true });
  },

  async unpinThread(threadId: string, userId: string): Promise<void> {
    const ref = doc(getFirestore_(), "messageThreads", threadId);
    const current = await getDoc(ref);
    const thread = current.exists() ? (current.data() as MessageThread) : null;
    const pinnedFor = (thread?.pinnedFor ?? []).filter((entry) => entry !== userId);
    await setDoc(ref, { pinnedFor }, { merge: true });
  },

  async deleteThread(threadId: string): Promise<void> {
    await callFunction<{ threadIds: string[] }, { deleted: number }>("deleteMessageThreads", { threadIds: [threadId] });
  },

  async deleteThreads(threadIds: string[]): Promise<void> {
    if (!threadIds.length) return;
    await callFunction<{ threadIds: string[] }, { deleted: number }>("deleteMessageThreads", { threadIds });
  },

  subscribeThreadMessages(threadId: string, callback: (messages: Message[]) => void): () => void {
    let unsubscribe: (() => void) | undefined;
    let active = true;
    void getWorkerFeatureRestriction().then((restriction) => {
      if (!active) return;
      if (restriction.restricted) {
        callback([]);
        return;
      }
      const q = query(collection(getFirestore_(), "messages"), where("threadId", "==", threadId));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          callback(snapshot.docs.map((entry) => entry.data() as Message));
        },
        (error) => handleSnapshotError("Thread messages", error, () => callback([]))
      );
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  },

  subscribeUserThreads(userId: string, callback: (threads: MessageThread[]) => void): () => void {
    let unsubscribe: (() => void) | undefined;
    let active = true;
    void getWorkerFeatureRestriction(userId).then((restriction) => {
      if (!active) return;
      if (restriction.restricted) {
        callback([]);
        return;
      }
      const q = query(collection(getFirestore_(), "messageThreads"), where("participants", "array-contains", userId));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          callback(snapshot.docs.map((entry) => entry.data() as MessageThread));
        },
        (error) => handleSnapshotError("User threads", error, () => callback([]))
      );
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  },

  subscribeThreadMessagesLegacy(threadId: string, callback: (messages: Message[]) => void): () => void {
    const q = query(collection(getFirestore_(), "messages"), where("threadId", "==", threadId));
    return onSnapshot(
      q,
      (snapshot) => {
        callback(snapshot.docs.map((entry) => entry.data() as Message));
      },
      (error) => handleSnapshotError("Thread messages", error, () => callback([]))
    );
  },

  subscribeUserThreadsLegacy(userId: string, callback: (threads: MessageThread[]) => void): () => void {
    const q = query(collection(getFirestore_(), "messageThreads"), where("participants", "array-contains", userId));
    return onSnapshot(
      q,
      (snapshot) => {
        callback(snapshot.docs.map((entry) => entry.data() as MessageThread));
      },
      (error) => handleSnapshotError("User threads", error, () => callback([]))
    );
  },
};

// ============================================================================
// REVIEW SERVICES
// ============================================================================

export const reviewService = {
  // Create review
  async createReview(reviewData: Omit<Review, "reviewId">): Promise<string> {
    const reviewId = `review-${Date.now()}`;
    let mediaItems: MediaAttachment[] = reviewData.mediaItems?.length ? reviewData.mediaItems : [];
    let mediaUrls = reviewData.mediaUrls || [];

    if (!mediaItems.length && mediaUrls.length) {
      try {
        mediaItems = await mediaService.uploadMany(mediaUrls, `reviews/${reviewData.providerId}/${reviewId}`, reviewData.customerId);
        mediaUrls = mediaItems.map((item) => item.url);
      } catch (error) {
        if (!isCallableUnavailableError(error)) {
          throw error;
        }
        mediaItems = [];
        mediaUrls = mediaUrls.filter(isFirestoreSafeUrl);
      }
    }

    await setDoc(doc(getFirestore_(), "reviews", reviewId), {
      ...reviewData,
      reviewId,
      mediaUrls,
      mediaItems,
      createdAt: nowIso(),
    } as Review);

    return reviewId;
  },

  // Get provider reviews
  async getProviderReviews(providerId: string): Promise<Review[]> {
    const q = query(collection(getFirestore_(), "reviews"), where("providerId", "==", providerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as Review);
  },

  async getReviewForBooking(bookingId: string, customerId: string): Promise<Review | null> {
    const q = query(
      collection(getFirestore_(), "reviews"),
      where("bookingId", "==", bookingId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    const review = snapshot.empty ? null : (snapshot.docs[0].data() as Review);
    return review?.customerId === customerId ? review : null;
  },

  // Get average rating for provider
  async getProviderAverageRating(providerId: string): Promise<number> {
    const reviews = await this.getProviderReviews(providerId);
    if (reviews.length === 0) return 0;
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    return totalRating / reviews.length;
  },

  async deleteReview(reviewId: string): Promise<void> {
    const existing = await getDoc(doc(getFirestore_(), "reviews", reviewId));
    const review = existing.exists() ? (existing.data() as Review) : null;
    if (review) {
      await mediaService.deleteStoredMedia(review.mediaItems?.length ? review.mediaItems : review.mediaUrls || []);
    }
    await deleteDoc(doc(getFirestore_(), "reviews", reviewId));
  },
};

// ============================================================================
// COMMUNITY POST SERVICES
// ============================================================================

export const communityPostService = {
  async createPost(data: Omit<CommunityPost, "postId" | "status" | "likes" | "comments" | "createdAt" | "updatedAt">): Promise<string> {
    const postId = `post-${Date.now()}`;
    const createdAt = nowIso();
    const attachmentItems = data.attachments?.length
      ? await mediaService.uploadMany(data.attachments, `communityPosts/${postId}/attachments`, data.customerId)
      : data.attachmentItems || [];
    await setDoc(doc(getFirestore_(), "communityPosts", postId), sanitizeForFirestore({
      ...data,
      postId,
      status: "Open",
      likes: [],
      comments: [],
      attachments: attachmentItems.map((item) => item.url),
      attachmentItems,
      photoEngagements: attachmentItems.map((item, index) => ({
        photoId: item.id || `photo-${index}`,
        url: item.url,
        likes: [],
        comments: [],
        createdAt,
        updatedAt: createdAt,
      })),
      createdAt,
      updatedAt: createdAt,
    } as CommunityPost));
    return postId;
  },

  subscribePosts(callback: (posts: CommunityPost[]) => void, viewerId?: string): () => void {
    const q = query(collection(getFirestore_(), "communityPosts"));
    return onSnapshot(
      q,
      (snapshot) => {
        callback(
          snapshot.docs
            .map((entry) => entry.data() as CommunityPost)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        );
      },
      (error) => handleSnapshotError("Community posts", error, () => callback([]))
    );
  },

  async updatePost(postId: string, data: Partial<Pick<CommunityPost, "serviceCategoryId" | "serviceName" | "body" | "address" | "location" | "preferredSchedule" | "amount" | "attachments">>): Promise<void> {
    const postRef = doc(getFirestore_(), "communityPosts", postId);
    const currentSnap = await getDoc(postRef);
    const currentPost = currentSnap.exists() ? (currentSnap.data() as CommunityPost) : null;
    const payload: Partial<CommunityPost> = { ...data };

    if (data.attachments) {
      const existingItems = currentPost?.attachmentItems || [];
      const existingByUrl = new Map(existingItems.map((item) => [item.url, item]));
      const keptItems = data.attachments
        .filter((item) => !item.startsWith("data:"))
        .map((url) => existingByUrl.get(url) || ({ url, fileName: "attachment", uploadedAt: nowIso() } as MediaAttachment));
      const removedItems = existingItems.filter((item) => !data.attachments?.includes(item.url));
      const newItems = await mediaService.uploadMany(
        data.attachments.filter((item) => item.startsWith("data:")),
        `communityPosts/${postId}/attachments`,
        currentPost?.customerId
      );
      if (removedItems.length) {
        await mediaService.deleteStoredMedia(removedItems);
      }
      const attachmentItems = [...keptItems, ...newItems];
      payload.attachments = attachmentItems.map((item) => item.url);
      payload.attachmentItems = attachmentItems;
      payload.photoEngagements = attachmentItems.map((item, index) => {
        const existing = currentPost?.photoEngagements?.find((photo) => photo.url === item.url);
        if (existing) return { ...existing, photoId: existing.photoId || item.id || `photo-${index}`, url: item.url };
        return {
          photoId: item.id || `photo-${index}-${Date.now()}`,
          url: item.url,
          likes: [],
          comments: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
      });
    }

    await updateDoc(doc(getFirestore_(), "communityPosts", postId), sanitizeForFirestore({
      ...payload,
      updatedAt: nowIso(),
    }));
  },

  async deletePost(postId: string): Promise<void> {
    const postRef = doc(getFirestore_(), "communityPosts", postId);
    const existing = await getDoc(postRef);
    const post = existing.exists() ? (existing.data() as CommunityPost) : null;
    if (post) {
      const mediaItems = post.attachmentItems?.length ? post.attachmentItems : post.attachments || [];
      if (mediaItems.length) {
        await mediaService.deleteStoredMedia(mediaItems);
      }
    }
    await deleteDoc(postRef);
  },

  async toggleLike(postId: string, userId: string): Promise<void> {
    await assertWorkerFeatureAllowed(userId);
    await runTransaction(getFirestore_(), async (transaction) => {
      const postRef = doc(getFirestore_(), "communityPosts", postId);
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) return;
      const post = postSnap.data() as CommunityPost;
      const likes = post.likes || [];
      transaction.update(postRef, {
        likes: likes.includes(userId) ? likes.filter((id) => id !== userId) : [...likes, userId],
        updatedAt: nowIso(),
      });
    });
  },

  async addComment(postId: string, userId: string, body: string, attachments: Array<string | MediaAttachment> = []): Promise<void> {
    await assertWorkerFeatureAllowed(userId);
    const trimmed = body.trim();
    if (!trimmed && !attachments.length) return;
    const commentId = `comment-${Date.now()}`;
    const attachmentItems = attachments.length
      ? await mediaService.uploadMany(attachments, `communityPosts/${postId}/comments/${commentId}`, userId)
      : [];
    await runTransaction(getFirestore_(), async (transaction) => {
      const postRef = doc(getFirestore_(), "communityPosts", postId);
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) return;
      const post = postSnap.data() as CommunityPost;
      const comment: CommunityPostComment = {
        commentId,
        userId,
        body: trimmed,
        attachments: attachmentItems.map((item) => item.url),
        attachmentItems,
        createdAt: nowIso(),
      };
      transaction.update(postRef, {
        comments: [...(post.comments || []), comment],
        updatedAt: nowIso(),
      });
    });
  },

  async addCommentReply(
    postId: string,
    parentCommentId: string,
    userId: string,
    body: string,
    attachments: Array<string | MediaAttachment> = []
  ): Promise<void> {
    await assertWorkerFeatureAllowed(userId);
    const trimmed = body.trim();
    if (!trimmed && !attachments.length) return;
    const replyId = `reply-${Date.now()}`;
    const attachmentItems = attachments.length
      ? await mediaService.uploadMany(attachments, `communityPosts/${postId}/comments/${parentCommentId}/replies/${replyId}`, userId)
      : [];
    await runTransaction(getFirestore_(), async (transaction) => {
      const postRef = doc(getFirestore_(), "communityPosts", postId);
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) return;
      const post = postSnap.data() as CommunityPost;
      const reply: CommunityPostComment = {
        commentId: replyId,
        userId,
        body: trimmed,
        attachments: attachmentItems.map((item) => item.url),
        attachmentItems,
        replies: [],
        createdAt: nowIso(),
      };
      transaction.update(postRef, {
        comments: (post.comments || []).map((comment) =>
          comment.commentId === parentCommentId
            ? { ...comment, replies: [...(comment.replies || []), reply] }
            : comment
        ),
        updatedAt: nowIso(),
      });
    });
  },

  async togglePhotoLike(postId: string, photoId: string, photoUrl: string, userId: string): Promise<void> {
    await assertWorkerFeatureAllowed(userId);
    await runTransaction(getFirestore_(), async (transaction) => {
      const postRef = doc(getFirestore_(), "communityPosts", postId);
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) return;
      const post = postSnap.data() as CommunityPost;
      const current = post.photoEngagements || [];
      const existing = current.find((photo) => photo.photoId === photoId || photo.url === photoUrl);
      const nextPhoto: CommunityPostPhotoEngagement = existing
        ? {
            ...existing,
            photoId: existing.photoId || photoId,
            url: existing.url || photoUrl,
            likes: (existing.likes || []).includes(userId)
              ? (existing.likes || []).filter((id) => id !== userId)
              : [...(existing.likes || []), userId],
            updatedAt: nowIso(),
          }
        : {
            photoId,
            url: photoUrl,
            likes: [userId],
            comments: [],
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };

      transaction.update(postRef, {
        photoEngagements: existing
          ? current.map((photo) => (photo.photoId === existing.photoId || photo.url === existing.url ? nextPhoto : photo))
          : [...current, nextPhoto],
        updatedAt: nowIso(),
      });
    });
  },

  async addPhotoComment(postId: string, photoId: string, photoUrl: string, userId: string, body: string): Promise<void> {
    await assertWorkerFeatureAllowed(userId);
    const trimmed = body.trim();
    if (!trimmed) return;
    await runTransaction(getFirestore_(), async (transaction) => {
      const postRef = doc(getFirestore_(), "communityPosts", postId);
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) return;
      const post = postSnap.data() as CommunityPost;
      const current = post.photoEngagements || [];
      const existing = current.find((photo) => photo.photoId === photoId || photo.url === photoUrl);
      const comment: CommunityPostComment = {
        commentId: `photo-comment-${Date.now()}`,
        userId,
        body: trimmed,
        attachments: [],
        attachmentItems: [],
        createdAt: nowIso(),
      };
      const nextPhoto: CommunityPostPhotoEngagement = existing
        ? {
            ...existing,
            photoId: existing.photoId || photoId,
            url: existing.url || photoUrl,
            comments: [...(existing.comments || []), comment],
            updatedAt: nowIso(),
          }
        : {
            photoId,
            url: photoUrl,
            likes: [],
            comments: [comment],
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };

      transaction.update(postRef, {
        photoEngagements: existing
          ? current.map((photo) => (photo.photoId === existing.photoId || photo.url === existing.url ? nextPhoto : photo))
          : [...current, nextPhoto],
        updatedAt: nowIso(),
      });
    });
  },

  async claimPostAsBooking(postId: string, providerId: string): Promise<string> {
    const restriction = await workerPaymentService.canWorkerAcceptBookings(providerId);
    if (!restriction.allowed) {
      throw new Error(restriction.reason || "Settle your overdue admin payment before accepting new bookings.");
    }
    const bookingId = `booking-${Date.now()}`;
    const claimedAt = nowIso();
    await runTransaction(getFirestore_(), async (transaction) => {
      const postRef = doc(getFirestore_(), "communityPosts", postId);
      const bookingRef = doc(getFirestore_(), "bookings", bookingId);
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) throw new Error("This post is no longer available.");
      const post = postSnap.data() as CommunityPost;
      if (post.status !== "Open" || post.bookingId) {
        throw new Error("Another worker already claimed this post.");
      }

      transaction.set(bookingRef, sanitizeForFirestore({
        bookingId,
        customerId: post.customerId,
        providerId,
        serviceCategoryId: post.serviceCategoryId,
        serviceName: post.serviceName,
        scheduledAt: post.preferredSchedule || "Flexible schedule",
        address: post.address,
        location: post.location || post.address,
        notes: post.body,
        status: "Accepted",
        amount: Number(post.amount || 0),
        workerAcceptedAt: claimedAt,
        statusHistory: [
          {
            bookingId,
            status: "Accepted",
            changedAt: claimedAt,
            changedBy: providerId,
            note: "Worker claimed this community post.",
          },
        ],
        createdAt: claimedAt,
        updatedAt: claimedAt,
      } as Booking));

      transaction.update(postRef, {
        status: "Booked",
        claimedProviderId: providerId,
        bookingId,
        updatedAt: claimedAt,
      });
    });
    return bookingId;
  },

  async deletePostsForCompletedBooking(bookingId: string): Promise<void> {
    const snapshot = await getDocs(query(collection(getFirestore_(), "communityPosts"), where("bookingId", "==", bookingId)));
    await Promise.all(
      snapshot.docs.map(async (entry) => {
        const post = entry.data() as CommunityPost;
        const mediaItems = post.attachmentItems?.length ? post.attachmentItems : post.attachments || [];
        if (mediaItems.length) {
          await mediaService.deleteStoredMedia(mediaItems);
        }
        await deleteDoc(entry.ref);
      })
    );
  },
};

// ============================================================================
// NOTIFICATION SERVICES
// ============================================================================

export const notificationService = {
  // Create notification
  async createNotification(data: Omit<NotificationItem, "notificationId">): Promise<string> {
    const notificationId = `notif-${Date.now()}`;

    await setDoc(doc(getFirestore_(), "notifications", notificationId), sanitizeForFirestore({
      ...data,
      notificationId,
      createdAt: nowIso(),
    } as NotificationItem));

    return notificationId;
  },

  // Get user notifications
  async getUserNotifications(userId: string): Promise<NotificationItem[]> {
    const q = query(collection(getFirestore_(), "notifications"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as NotificationItem);
  },

  async markManyAsRead(notificationIds: string[]): Promise<void> {
    if (!notificationIds.length) return;
    const batch = writeBatch(getFirestore_());
    notificationIds.forEach((notificationId) => {
      batch.update(doc(getFirestore_(), "notifications", notificationId), { isRead: true });
    });
    await batch.commit();
  },

  async deleteNotification(notificationId: string): Promise<void> {
    await callFunction<{ notificationIds: string[] }, { deleted: number }>("deleteUserNotifications", { notificationIds: [notificationId] });
  },

  async deleteMany(notificationIds: string[]): Promise<void> {
    if (!notificationIds.length) return;
    await callFunction<{ notificationIds: string[] }, { deleted: number }>("deleteUserNotifications", { notificationIds });
  },

  async deleteAllForUser(_userId: string): Promise<void> {
    await callFunction<{ deleteAll: true }, { deleted: number }>("deleteUserNotifications", { deleteAll: true });
  },

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    await updateDoc(doc(getFirestore_(), "notifications", notificationId), { isRead: true });
  },

  subscribeUserNotifications(userId: string, callback: (notifications: NotificationItem[]) => void): () => void {
    const q = query(collection(getFirestore_(), "notifications"), where("userId", "==", userId));
    return onSnapshot(
      q,
      (snapshot) => {
        callback(snapshot.docs.map((entry) => entry.data() as NotificationItem));
      },
      (error) => handleSnapshotError("User notifications", error, () => callback([]))
    );
  },
};

export const adminExportService = {
  exportAsJson(fileName: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },

  exportRowsAsCsv(fileName: string, rows: Array<Record<string, string | number | boolean | null | undefined>>) {
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const lines = [
      keys.join(","),
      ...rows.map((row) =>
        keys
          .map((key) => JSON.stringify(row[key] ?? ""))
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};

// ============================================================================
// COMPLAINT SERVICES
// ============================================================================

export const complaintService = {
  // Create complaint
  async createComplaint(data: Omit<ComplaintReport, "reportId">): Promise<string> {
    const reportId = `complaint-${Date.now()}`;

    await setDoc(doc(getFirestore_(), "complaints", reportId), {
      ...data,
      reportId,
      createdAt: new Date().toISOString(),
    } as ComplaintReport);

    return reportId;
  },

  // Get all complaints (admin)
  async getAllComplaints(): Promise<ComplaintReport[]> {
    const snapshot = await getDocs(collection(getFirestore_(), "complaints"));
    return snapshot.docs.map((doc) => doc.data() as ComplaintReport);
  },

  // Update complaint status
  async updateComplaintStatus(reportId: string, status: string): Promise<void> {
    await updateDoc(doc(getFirestore_(), "complaints", reportId), { status });
  },
};

export default {
  authService,
  userService,
  adminAuditService,
  mediaService,
  pushTokenService,
  providerService,
  providerPortfolioService,
  categoryService,
  bookingConflictService,
  bookingService,
  bookingChangeRequestService,
  communityPostService,
  paymentService,
  messagingService,
  reviewService,
  notificationService,
  complaintService,
  adminExportService,
};
