import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState, useEffect, useRef } from "react";
import {
  User,
  UserRole,
  ProviderApprovalStatus,
  ProviderOnboardingForm,
  authService,
  userService,
  providerService,
  KABISIG_TERMS_VERSION,
} from "@kabisig/shared";
import { firebaseAuth } from "../services/firebase";
import { onAuthStateChanged } from "firebase/auth";

function formatAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Something went wrong. Please try again.";
  }

  const message = error.message.toLowerCase();

  if (error.message.includes("auth/invalid-credential") || error.message.includes("auth/wrong-password")) {
    return "Incorrect email or password, or the account does not exist yet.";
  }

  if (message.includes("auth/invalid-email") || message.includes("invalid_email")) {
    return "Please enter a valid email address.";
  }

  if (error.message.includes("auth/user-not-found")) {
    return "No account was found for that email address.";
  }

  if (error.message.includes("auth/user-disabled")) {
    return "This account has been disabled. Please contact support or the admin team.";
  }

  if (message.includes("auth/too-many-requests") || message.includes("too_many_attempts_try_later")) {
    return "Too many failed sign-in attempts. Please wait a moment before trying again.";
  }

  if (error.message.includes("auth/network-request-failed")) {
    return "Network connection failed. Please check your internet connection and try again.";
  }

  if (message.includes("auth/email-already-in-use") || message.includes("email_exists")) {
    return "That email is already registered. Use Sign in to continue with that account.";
  }

  if (message.includes("auth/weak-password") || message.includes("weak_password")) {
    return "The password is too weak. Use at least 6 characters, preferably with letters and numbers.";
  }

  if (message.includes("auth/operation-not-allowed") || message.includes("operation_not_allowed")) {
    return "Email and password registration is not enabled in Firebase Authentication.";
  }

  if (error.message.includes("auth/invalid-api-key")) {
    return "Firebase configuration is missing. Restart the app after checking environment variables.";
  }

  if (error.message.includes("popup-closed") || error.message.includes("cancelled")) {
    return "Google sign-in was cancelled before it could finish.";
  }

  return error.message;
}

function isOfflineDataError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  return message.includes("client is offline") || message.includes("offline") || message.includes("unavailable");
}

type AppUser = User & {
  onboardingCompleted?: boolean;
  approvalStatus?: ProviderApprovalStatus;
};

interface AuthContextValue {
  user: AppUser | null;
  selectedRole: UserRole | null;
  setSelectedRole: (role: UserRole | null) => void;
  loading: boolean;
  signIn: (params: { email: string; password: string; role: "customer" | "provider" }) => Promise<AppUser>;
  register: (params: { fullName: string; email: string; password: string; role: "customer" | "provider"; phone?: string }) => Promise<AppUser | null>;
  signInWithGoogle: (params: { role: "customer" | "provider"; intent: "login" | "register"; idToken?: string; accessToken?: string; usePopup?: boolean }) => Promise<AppUser>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  submitProviderOnboarding: (form: ProviderOnboardingForm) => Promise<void>;
  refreshUser: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const GOOGLE_AUTH_TIMEOUT_MS = 45000;
const USER_DOCUMENT_RETRY_DELAYS_MS = [150, 350, 700, 1200];

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), GOOGLE_AUTH_TIMEOUT_MS);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const googleAuthInFlightRef = useRef(false);

  const loadAppUser = useCallback(async (uid: string) => {
    const userDoc = await authService.getUserDocument(uid);
    if (!userDoc) {
      return null;
    }

    let appUser: AppUser = { ...userDoc };
    if (userDoc.role === "provider") {
      const profile = await userService.getProviderProfile(uid);
      if (profile) {
        appUser.approvalStatus = profile.approvalStatus;
        appUser.onboardingCompleted = profile.approvalStatus !== "Draft";
      }
    }

    return appUser;
  }, []);

  const loadAppUserWithRetry = useCallback(async (uid: string) => {
    let appUser = await loadAppUser(uid);
    if (appUser) return appUser;

    for (const delay of USER_DOCUMENT_RETRY_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      appUser = await loadAppUser(uid);
      if (appUser) return appUser;
    }

    return null;
  }, [loadAppUser]);

  // Listen to Firebase auth state changes
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          if (googleAuthInFlightRef.current) {
            return;
          }
          const appUser = await loadAppUserWithRetry(firebaseUser.uid);
          if (appUser) {
            setUser(appUser);
            setSelectedRole(appUser.role);
            setError(null);
          } else {
            setUser(null);
            setSelectedRole(null);
          }
        } else {
          setUser(null);
          setSelectedRole(null);
        }
      } catch (err) {
        if (isOfflineDataError(err)) {
          setError("The connection looks unstable. We will refresh your account when Firestore reconnects.");
        } else {
          console.error("Auth state error:", err);
          setError(formatAuthError(err));
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [loadAppUserWithRetry]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      selectedRole,
      setSelectedRole,
      loading,
      error,
      async signIn({ email, password, role }) {
        try {
          setError(null);
          const firebaseUser = await authService.loginWithEmail(email, password);
          const appUser = await loadAppUser(firebaseUser.uid);

          if (!appUser || appUser.role !== role) {
            await authService.signOut();
            throw new Error(`User role mismatch or not found`);
          }

          setUser(appUser);
          setSelectedRole(role);
          return appUser;
        } catch (err) {
          const errorMsg = formatAuthError(err);
          setError(errorMsg);
          throw new Error(errorMsg);
        }
      },
      async register({ fullName, email, password, role, phone }) {
        try {
          setError(null);
          setLoading(true);
          const normalizedPhone = phone?.trim();
          let uid = "";
          let recoveredExistingAccount = false;

          try {
            const result = await authService.registerWithEmail(email, password, fullName, role, normalizedPhone);
            uid = result.uid;
          } catch (registrationError) {
            const rawMessage = registrationError instanceof Error ? registrationError.message.toLowerCase() : String(registrationError || "").toLowerCase();
            const emailAlreadyExists = rawMessage.includes("auth/email-already-in-use") || rawMessage.includes("email_exists");
            if (!emailAlreadyExists) {
              throw registrationError;
            }

            const existingFirebaseUser = await authService.loginWithEmail(email, password);
            const existingUserDoc = await authService.getUserDocument(existingFirebaseUser.uid);
            if (!existingUserDoc) {
              await userService.updateUserDocument(existingFirebaseUser.uid, {
                email,
                fullName,
                phone: normalizedPhone,
                role,
                authProvider: "email",
                profilePhoto: "",
                appTheme: "system"
              });
            } else if (existingUserDoc.role !== role) {
              throw new Error(`This email is already registered as ${existingUserDoc.role}. Please sign in with that role or use a different email.`);
            }

            uid = existingFirebaseUser.uid;
            recoveredExistingAccount = true;
          }

          if (phone?.trim() && role === "customer") {
            await userService.updateCustomerProfile(uid, { phone: phone.trim() });
          }
          if (normalizedPhone) {
            await userService.updateUserDocument(uid, { phone: normalizedPhone });
          }
          const acceptedAt = new Date().toISOString();
          await userService.updateUserDocument(uid, {
            fullName,
            role,
            termsAcceptedAt: acceptedAt,
            termsVersion: KABISIG_TERMS_VERSION
          });
          if (role === "provider") {
            await userService.updateProviderProfile(uid, {
              displayName: fullName,
              phone: normalizedPhone || "",
              approvalStatus: "Draft",
              isApproved: false
            });
          }
          const userDoc = await authService.getUserDocument(uid);
          if (userDoc) {
            let appUser: AppUser = { ...userDoc };
            if (userDoc.role === "provider") {
              appUser.onboardingCompleted = false;
              appUser.approvalStatus = "Draft";
            }
            if (recoveredExistingAccount && role === "provider") {
              appUser.role = "provider";
              appUser.onboardingCompleted = false;
              appUser.approvalStatus = "Draft";
            }
            setUser(appUser);
            setSelectedRole(role);
            return appUser;
          }
          const fallbackUser: AppUser = {
            id: uid,
            email,
            fullName,
            phone: normalizedPhone,
            role,
            authProvider: "email",
            profilePhoto: "",
            appTheme: "system",
            termsAcceptedAt: acceptedAt,
            termsVersion: KABISIG_TERMS_VERSION,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            onboardingCompleted: role === "provider" ? false : undefined,
            approvalStatus: role === "provider" ? "Draft" : undefined
          };
          setUser(fallbackUser);
          setSelectedRole(role);
          return fallbackUser;
        } catch (err) {
          const errorMsg = formatAuthError(err);
          setError(errorMsg);
          throw new Error(errorMsg);
        } finally {
          setLoading(false);
        }
      },
      async signInWithGoogle({ role, intent, idToken, accessToken, usePopup }) {
        try {
          setError(null);
          if (role !== "customer") {
            throw new Error("Google sign-in is available for customer accounts only. Skilled worker accounts must use email and password.");
          }
          googleAuthInFlightRef.current = true;
          const result = await withTimeout(
            authService.completeGoogleAuth({
              role,
              intent,
              idToken,
              accessToken,
              usePopup
            }),
            "Google sign-in took too long. Please check your connection and try again."
          );

          const appUser = { ...result.appUser } as AppUser;
          if (intent === "register") {
            const acceptedAt = new Date().toISOString();
            await userService.updateUserDocument(appUser.id, {
              termsAcceptedAt: acceptedAt,
              termsVersion: KABISIG_TERMS_VERSION
            });
            appUser.termsAcceptedAt = acceptedAt;
            appUser.termsVersion = KABISIG_TERMS_VERSION;
          }

          setUser(appUser);
          setSelectedRole(role);
          return appUser;
        } catch (err) {
          const errorMsg = formatAuthError(err);
          setError(errorMsg);
          throw new Error(errorMsg);
        } finally {
          googleAuthInFlightRef.current = false;
        }
      },
      async signOut() {
        try {
          setUser(null);
          setSelectedRole(null);
          setError(null);
          await authService.signOut();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Sign out failed";
          setError(errorMsg);
        }
      },
      async sendPasswordReset(email: string) {
        try {
          setError(null);
          await authService.sendPasswordReset(email);
        } catch (err) {
          const errorMsg = formatAuthError(err);
          setError(errorMsg);
          throw new Error(errorMsg);
        }
      },
      async submitProviderOnboarding(form: ProviderOnboardingForm) {
        try {
          setError(null);
          const currentUser = firebaseAuth.currentUser;
          if (!currentUser) throw new Error("Not authenticated");

          await providerService.submitProviderApplication(currentUser.uid, {
            fullName: form.fullName,
            businessName: form.businessName,
            mobileNumber: form.mobileNumber,
            birthday: form.birthday,
            age: parseInt(form.age) || 0,
            address: form.address,
            city: form.cityCoverageArea,
            serviceCategories: form.serviceCategoriesOffered,
            yearsExperience: parseInt(form.yearsOfExperience) || 0,
            bio: form.shortBio,
            qualifications: form.qualifications,
            additionalDetails: form.additionalDetails,
            profilePhotoDriveLink: form.profilePhotoDriveLink || "",
            validIdDriveLink: form.validIdDriveLink || "",
            permitCertificateDriveLink: form.permitCertificateDriveLink || "",
            emergencyContact: form.emergencyContact,
            sampleWorkUrls: form.sampleWorkUrls || [],
            availability: form.availability || [],
            registrationPaymentProofUrl: form.registrationPaymentProofUrl || "",
            registrationPaymentReference: form.registrationPaymentReference || "",
            registrationPaymentDate: form.registrationPaymentDate || "",
            registrationPaymentMethod: form.registrationPaymentMethod || "",
          });

          // Update user state
          setUser((current) =>
            current
              ? {
                  ...current,
                  onboardingCompleted: true,
                  approvalStatus: "Pending Approval",
                }
              : current
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Onboarding submission failed";
          setError(errorMsg);
          throw new Error(errorMsg);
        }
      },
      async refreshUser() {
        const currentUser = firebaseAuth.currentUser;
        if (!currentUser) {
          setUser(null);
          setSelectedRole(null);
          return;
        }

        const appUser = await loadAppUser(currentUser.uid);
        if (appUser) {
          setUser(appUser);
          setSelectedRole(appUser.role);
        }
      },
    }),
    [user, selectedRole, loading, error, loadAppUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
