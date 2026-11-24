import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { firebaseAuth, googleAuthProvider } from '../lib/firebase-client.ts';
import { api, setApiToken } from '../services/api.ts';

export interface UserProfile {
  id: number;
  uid: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: 'customer' | 'staff' | 'admin' | string;
  status: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<UserProfile>;
  loginWithEmail: (email: string, password: string) => Promise<UserProfile>;
  registerWithEmail: (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<UserProfile>;
  claimOrLoginAdmin: (payload: {
    fullName?: string;
    email: string;
    password: string;
  }) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setApiToken(idToken);
          const res = await api.post('/auth/firebase-sync');
          setUser(res.data.user);
        } catch {
          setUser(null);
          setApiToken(null);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(firebaseAuth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    setApiToken(idToken);
    const res = await api.post('/auth/firebase-sync');
    setUser(res.data.user);
    return res.data.user as UserProfile;
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    setApiToken(res.data.token);
    setUser(res.data.user);
    return res.data.user as UserProfile;
  }, []);

  const registerWithEmail = useCallback(
    async (payload: { fullName: string; email: string; phone: string; password: string }) => {
      const res = await api.post('/auth/register', payload);
      setApiToken(res.data.token);
      setUser(res.data.user);
      return res.data.user as UserProfile;
    },
    []
  );

  const claimOrLoginAdmin = useCallback(
    async (payload: { fullName?: string; email: string; password: string }) => {
      const res = await api.post('/auth/bootstrap-admin', payload);
      setApiToken(res.data.token);
      setUser(res.data.user);
      return res.data.user as UserProfile;
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      // Ignore if unauthenticated
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore
    }
    if (firebaseAuth.currentUser) {
      await signOut(firebaseAuth);
    }
    setApiToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        claimOrLoginAdmin,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
