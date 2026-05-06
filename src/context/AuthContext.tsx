"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ─── Types ──────────────────────────────────────────────────────────

export type UserRole = "PENDING" | "MEMBER" | "ADMIN";

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  image: string | null;
  role: UserRole;
  isActive: boolean;
}

interface AuthContextType {
  /** The authenticated user with Firestore profile, or null if not signed in */
  user: AppUser | null;
  /** Firebase Auth user object (raw) */
  firebaseUser: FirebaseUser | null;
  /** True while auth state is being determined */
  loading: boolean;
  /** Sign in with Google popup */
  signIn: () => Promise<void>;
  /** Sign out */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

// ─── Provider ───────────────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch or create the Firestore user document
  const syncUserDocument = useCallback(
    async (fbUser: FirebaseUser): Promise<AppUser> => {
      const userRef = doc(db, "users", fbUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        // Existing user — return stored profile
        const data = userSnap.data();
        return {
          uid: fbUser.uid,
          name: data.name ?? fbUser.displayName ?? "",
          email: data.email ?? fbUser.email ?? "",
          image: data.image ?? fbUser.photoURL ?? null,
          role: data.role ?? "PENDING",
          isActive: data.isActive ?? true,
        };
      }

      // First-time sign-in — create user doc with PENDING role
      const newUser: Omit<AppUser, "uid"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
        name: fbUser.displayName ?? "",
        email: fbUser.email ?? "",
        image: fbUser.photoURL ?? null,
        role: "PENDING",
        isActive: true,
        createdAt: serverTimestamp(),
      };

      await setDoc(userRef, newUser);

      return {
        uid: fbUser.uid,
        ...newUser,
        createdAt: undefined as never, // strip server timestamp from runtime object
      } as AppUser;
    },
    []
  );

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        try {
          const appUser = await syncUserDocument(fbUser);
          setUser(appUser);
        } catch (error) {
          console.error("Failed to sync user document:", error);
          setUser(null);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [syncUserDocument]);

  // Sign in with Google
  const signIn = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (error) {
      console.error("Google sign-in failed:", error);
      throw error;
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setFirebaseUser(null);
    } catch (error) {
      console.error("Sign-out failed:", error);
      throw error;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
