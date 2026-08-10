'use client';

import { ReactNode } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AppShell } from '@/components/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RouteGuard>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}
