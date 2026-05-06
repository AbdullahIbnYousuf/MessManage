'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User, MembershipRequest } from '@/types';
import { useToast } from './ToastContext';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: User | null;
  membershipRequest: MembershipRequest | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  appUser: null,
  membershipRequest: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [membershipRequest, setMembershipRequest] = useState<MembershipRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadUserData = useCallback(async (fbUser: FirebaseUser) => {
    // Check if user exists in users collection
    const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
    if (userDoc.exists()) {
      setAppUser({ id: userDoc.id, ...userDoc.data() } as User);
      setMembershipRequest(null);
      return;
    }

    // Check membership requests
    const reqQuery = query(
      collection(db, 'membershipRequests'),
      where('email', '==', fbUser.email)
    );
    const reqSnap = await getDocs(reqQuery);

    if (!reqSnap.empty) {
      const reqDoc = reqSnap.docs[0];
      const reqData = { id: reqDoc.id, ...reqDoc.data() } as MembershipRequest;
      setMembershipRequest(reqData);

      // If approved but user doc not yet loaded, check again
      if (reqData.status === 'approved' && reqData.user_id) {
        const approvedUserDoc = await getDoc(doc(db, 'users', reqData.user_id));
        if (approvedUserDoc.exists()) {
          setAppUser({ id: approvedUserDoc.id, ...approvedUserDoc.data() } as User);
        }
      }
    } else {
      // First time sign-in — create a membership request
      const newReqRef = doc(collection(db, 'membershipRequests'));
      const newReq: Omit<MembershipRequest, 'id'> = {
        email: fbUser.email || '',
        name: fbUser.displayName || 'Unknown',
        avatar_url: fbUser.photoURL || null,
        status: 'pending',
        requested_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        user_id: null,
      };
      await setDoc(newReqRef, newReq);
      setMembershipRequest({ id: newReqRef.id, ...newReq });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          await loadUserData(fbUser);
        } catch (err: any) {
          console.error('Error loading user data:', err);
          if (err.message?.includes('Missing or insufficient permissions')) {
            toast("Login blocked by Firestore Security Rules. Update your database rules to allow read/write.", 'error');
          }
        }
      } else {
        setAppUser(null);
        setMembershipRequest(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [loadUserData]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setAppUser(null);
    setMembershipRequest(null);
  };

  const refreshUser = async () => {
    if (firebaseUser) {
      await loadUserData(firebaseUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{ firebaseUser, appUser, membershipRequest, loading, signInWithGoogle, signOut, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
