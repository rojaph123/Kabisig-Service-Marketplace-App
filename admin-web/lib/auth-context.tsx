"use client";

import { createContext, PropsWithChildren, useContext, useMemo, useState, useEffect } from "react";
import { authService } from "@kabisig/shared";
import { getFirebaseAuth } from "./firebase";
import { browserLocalPersistence, onAuthStateChanged, setPersistence } from "firebase/auth";

function formatAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Something went wrong. Please try again.";
  }

  if (error.message.includes("auth/invalid-credential") || error.message.includes("auth/wrong-password")) {
    return "Incorrect email or password, or the admin account does not exist yet.";
  }

  if (error.message.includes("auth/invalid-email")) {
    return "Please enter a valid email address, for example admin@kabisig.com.";
  }

  if (error.message.includes("auth/user-not-found")) {
    return "No admin account was found for that email address.";
  }

  if (error.message.includes("auth/invalid-api-key")) {
    return "Firebase configuration is missing. Restart the admin app after checking environment variables.";
  }

  return error.message;
}

type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin";
};

interface AdminAuthValue {
  admin: AdminUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: PropsWithChildren) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAdminUser(uid: string) {
    const userDoc = await authService.getUserDocument(uid);
    if (!userDoc || userDoc.role !== "admin") {
      return null;
    }

    return {
      id: uid,
      email: userDoc.email,
      fullName: userDoc.fullName,
      role: "admin" as const,
    };
  }

  // Listen to Firebase auth state changes
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;
    const auth = getFirebaseAuth();

    void setPersistence(auth, browserLocalPersistence)
      .catch((err) => {
        console.warn("Admin auth persistence setup failed:", err);
      })
      .finally(() => {
        if (!mounted) return;
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          try {
            if (firebaseUser) {
              const adminUser = await loadAdminUser(firebaseUser.uid);
              if (adminUser) {
                setAdmin(adminUser);
                setError(null);
              } else {
                setAdmin(null);
                setError("User is not an admin");
              }
            } else {
              setAdmin(null);
            }
          } catch (err) {
            console.error("Admin auth state error:", err);
            setError(formatAuthError(err));
          } finally {
            setLoading(false);
          }
        });
      });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<AdminAuthValue>(
    () => ({
      admin,
      loading,
      error,
      async login(email: string, password: string) {
        try {
          setError(null);
          setLoading(true);
          await setPersistence(getFirebaseAuth(), browserLocalPersistence);
          const firebaseUser = await authService.loginWithEmail(email, password);
          const adminUser = await loadAdminUser(firebaseUser.uid);

          if (!adminUser) {
            await authService.signOut();
            throw new Error("User is not an admin");
          }

          setAdmin(adminUser);
        } catch (err) {
          const errorMsg = formatAuthError(err);
          setError(errorMsg);
          throw new Error(errorMsg);
        } finally {
          setLoading(false);
        }
      },
      async logout() {
        try {
          await authService.signOut();
          setAdmin(null);
          setError(null);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Logout failed";
          setError(errorMsg);
        }
      },
    }),
    [admin, loading, error]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}
