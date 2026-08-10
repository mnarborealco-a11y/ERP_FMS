'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/types/api';

export function RouteGuard({ children, requiredRole }: { children: ReactNode; requiredRole?: Role }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (requiredRole && user.role !== requiredRole) {
      router.replace('/dashboard');
    }
  }, [loading, user, requiredRole, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Loading…</div>
    );
  }

  if (!user || (requiredRole && user.role !== requiredRole)) {
    return null;
  }

  return <>{children}</>;
}
