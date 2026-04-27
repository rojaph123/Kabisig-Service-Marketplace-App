"use client";

import { createContext, PropsWithChildren, useContext, useMemo, useState, useEffect } from "react";
import { authService } from "@kabisig/shared";
import { getFirebaseAuth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

function formatAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Something went wrong. Please try again.";
  }

  if (error.message.includes("auth/invalid-credential") || error.message.includes("auth/wrong-password")) {
    return "Incorrect email or password, or the admin account does not exist yet.";
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

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Get user document from Firestore
          const userDoc = await authService.getUserDocument(firebaseUser.uid);
          if (userDoc && userDoc.role === "admin") {
            setAdmin({
              id: firebaseUser.uid,
              email: userDoc.email,
              fullName: userDoc.fullName,
              role: "admin",
            });
            setError(null);
          } else {
            // User is authenticated but not an admin
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

    return () => unsubscribe();
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
          const firebaseUser = await authService.loginWithEmail(email, password);
          const userDoc = await authService.getUserDocument(firebaseUser.uid);

          if (!userDoc || userDoc.role !== "admin") {
            await authService.signOut();
            throw new Error("User is not an admin");
          }

          setAdmin({
            id: firebaseUser.uid,
            email: userDoc.email,
            fullName: userDoc.fullName,
            role: "admin",
          });
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
