'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

interface NavItem {
  href: string;
  label: string;
}

const employeeNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/matters', label: 'My Matters' },
  { href: '/tasks', label: 'My Tasks' },
  { href: '/court', label: 'Court Punch' }
];

const adminTopNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/admin/approvals', label: 'Approvals' },
  { href: '/matters', label: 'Matters' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/admin/court-punches', label: 'Court Punches' },
  { href: '/admin/scoreboard', label: 'Scoreboard' }
];

// Firm-administration screens, grouped under the collapsible "Admin" panel
// rather than living flat alongside the day-to-day nav items above.
const adminPanelNav: NavItem[] = [
  { href: '/admin/holidays', label: 'Holidays' },
  { href: '/admin/users', label: 'Users' }
];

function SidebarHeader() {
  return (
    <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
      <Image src="/jlaw-logo.png" alt="" width={36} height={36} className="rounded-md" priority />
      <div>
        <div className="text-sm font-semibold text-white">Jlaw Associates</div>
        <div className="text-xs text-slate-400">Ops</div>
      </div>
    </div>
  );
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-brand text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {item.label}
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.role === 'FOUNDER_ADMIN';
  const adminPanelActive = adminPanelNav.some((item) => pathname === item.href);
  const [adminOpen, setAdminOpen] = useState(true);

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {(isAdmin ? adminTopNav : employeeNav).map((item) => (
        <NavLink key={item.href} item={item} active={pathname === item.href} onClick={onNavigate} />
      ))}

      {isAdmin && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setAdminOpen((v) => !v)}
            aria-expanded={adminOpen}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10 ${
              adminPanelActive ? 'text-white' : 'text-slate-300'
            }`}
          >
            <span>Admin</span>
            <span className={`text-xs text-slate-500 transition-transform ${adminOpen ? 'rotate-90' : ''}`}>›</span>
          </button>
          {adminOpen && (
            <div className="mt-0.5 ml-2 flex flex-col gap-0.5 border-l border-white/10 pl-2">
              {adminPanelNav.map((item) => (
                <NavLink key={item.href} item={item} active={pathname === item.href} onClick={onNavigate} />
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the mobile drawer automatically on navigation.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 bg-ink sm:block">
        <SidebarHeader />
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-ink shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <Image src="/jlaw-logo.png" alt="" width={32} height={32} className="rounded-md" />
                <div>
                  <div className="text-sm font-semibold text-white">Jlaw Associates</div>
                  <div className="text-xs text-slate-400">Ops</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
            <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 sm:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-ink">Jlaw Associates</span>
          </div>
          <div className="hidden text-sm text-slate-500 sm:block" />
          <div className="flex items-center gap-3">
            <Link href="/profile" className="text-sm text-slate-600 hover:text-ink">
              <span className="hidden sm:inline">{user?.name} </span>
              <span className="text-xs text-slate-400">({user?.role === 'FOUNDER_ADMIN' ? 'Admin' : 'User'})</span>
            </Link>
            <button onClick={() => logout()} className="text-sm font-medium text-slate-500 hover:text-ink">
              Log out
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
