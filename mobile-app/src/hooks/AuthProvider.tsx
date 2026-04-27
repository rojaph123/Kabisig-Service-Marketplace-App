import { createContext, PropsWithChildren, useContext, useMemo, useState, useEffect } from "react";
import {
  User,
  UserRole,
  ProviderApprovalStatus,
  ProviderOnboardingForm,
  authService,
  userService,
  providerService,
} from "@kabisig/shared";
import { firebaseAuth } from "../services/firebase";
import { onAuthStateChanged } from "firebase/auth";

function formatAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Something went wrong. Please try again.";
  }

  if (error.message.includes("auth/invalid-credential") || error.message.includes("auth/wrong-password")) {
    return "Incorrect email or password, or the account does not exist yet.";
  }

  if (error.message.includes("auth/user-not-found")) {
    return "No account was found for that email address.";
  }

  if (error.message.includes("auth/email-already-in-use")) {
    return "That email is already registered. Use Sign in to continue with that account.";
  }

  if (error.message.includes("auth/invalid-api-key")) {
    return "Firebase configuration is missing. Restart the app after checking environment variables.";
  }

  if (error.message.includes("popup-closed") || error.message.includes("cancelled")) {
    return "Google sign-in was cancelled before it could finish.";
  }

  return error.message;
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAppUser(uid: string) {
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
  }

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const appUser = await loadAppUser(firebaseUser.uid);
          if (appUser) {
            setUser(appUser);
            setSelectedRole(appUser.role);
            setError(null);
          }
        } else {
          setUser(null);
          setSelectedRole(null);
        }
      } catch (err) {
        console.error("Auth state error:", err);
        setError(formatAuthError(err));
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

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
          setLoading(true);
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
        } finally {
          setLoading(false);
        }
      },
      async register({ fullName, email, password, role, phone }) {
        try {
          setError(null);
          setLoading(true);
          const { uid } = await authService.registerWithEmail(email, password, fullName, role);
          if (phone?.trim() && role === "customer") {
            await userService.updateCustomerProfile(uid, { phone: phone.trim() });
          }
          const userDoc = await authService.getUserDocument(uid);
          if (userDoc) {
            let appUser: AppUser = { ...userDoc };
            if (userDoc.role === "provider") {
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
            role,
            authProvider: "email",
            profilePhoto: "",
            appTheme: "system",
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
          setLoading(true);
          const result = await authService.completeGoogleAuth({
            role,
            intent,
            idToken,
            accessToken,
            usePopup
          });

          const appUser = (await loadAppUser(result.user.uid)) || ({ ...result.appUser } as AppUser);

          setUser(appUser);
          setSelectedRole(role);
          return appUser;
        } catch (err) {
          const errorMsg = formatAuthError(err);
          setError(errorMsg);
          throw new Error(errorMsg);
        } finally {
          setLoading(false);
        }
      },
      async signOut() {
        try {
          await authService.signOut();
          setUser(null);
          setSelectedRole(null);
          setError(null);
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
    [user, selectedRole, loading, error]
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
