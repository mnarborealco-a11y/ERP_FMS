'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { ApiError, isApiError } from './apiClient';
import type { PublicUser, Role } from '@/types/api';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// supabase-js already decodes the JWT for us -- session.user.app_metadata.role
// is available synchronously with no extra round trip, same property the old
// hand-rolled decodeToken() was optimizing for.
function sessionToUser(session: Session | null): PublicUser | null {
  if (!session) return null;
  const role = session.user.app_metadata?.role as Role | undefined;
  if (!role) return null;
  return {
    userId: session.user.id,
    name: (session.user.user_metadata?.name as string) ?? '',
    email: session.user.email ?? '',
    role
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(sessionToUser(data.session));
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      setUser(sessionToUser(session));
      if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new ApiError('UNAUTHORIZED', error.message);
    setUser(sessionToUser(data.session));
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.replace('/login');
  }, [router]);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { isApiError };
