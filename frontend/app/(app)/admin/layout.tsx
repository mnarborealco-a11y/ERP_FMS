'use client';

import { ReactNode } from 'react';
import { RouteGuard } from '@/components/RouteGuard';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RouteGuard requiredRole="FOUNDER_ADMIN">{children}</RouteGuard>;
}
