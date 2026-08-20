'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useCompanyBranding } from '@/lib/useCompanyBranding';

interface NavItem {
  href: string;
  label: string;
}

const employeeNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/matters', label: 'My Matters' },
  { href: '/tasks', label: 'My Tasks' },
  { href: '/court', label: 'Court Appearances' },
  { href: '/my-score', label: 'My Score' }
];

const adminTopNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/admin/approvals', label: 'Approvals' },
  { href: '/matters', label: 'Matters' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/admin/court-appearances', label: 'Court Appearances' },
  { href: '/admin/scoreboard', label: 'Scoreboard' }
];

// Firm-administration screens, grouped under the collapsible "Admin" panel
// rather than living flat alongside the day-to-day nav items above.
const adminPanelNav: NavItem[] = [
  { href: '/admin/holidays', label: 'Holidays' },
  { href: '/admin/users', label: 'Users' }
];

// Platform-level screens for the SUPER_ADMIN role -- separate from the
// per-company admin nav above, since a super admin has no companyId and
// never sees a company's operational data.
const superAdminNav: NavItem[] = [{ href: '/super-admin/companies', label: 'Companies' }];

function SidebarHeader({ size = 36 }: { size?: number }) {
  const { data: branding } = useCompanyBranding();
  const name = branding?.name ?? 'Master ERP';
  const logoUrl = branding?.logoUrl ?? '/master-erp-logo.png';

  return (
    <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
      <Image src={logoUrl} alt="" width={size} height={size} className="rounded-md object-contain" priority unoptimized={logoUrl !== '/master-erp-logo.png'} />
      <div>
        <div className="text-sm font-semibold text-white">{name}</div>
        <div className="text-xs text-slate-400">Ops</div>
      </div>
    </div>
  );
}

function NavLink({ item, active, onClick, accentColor, accentText }: { item: NavItem; active: boolean; onClick?: () => void; accentColor: string; accentText: string }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      style={active ? { backgroundColor: accentColor, color: accentText } : undefined}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active ? '' : 'text-slate-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {item.label}
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const { data: branding } = useCompanyBranding();
  const pathname = usePathname();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'FOUNDER_ADMIN';
  const adminPanelActive = adminPanelNav.some((item) => pathname === item.href);
  const [adminOpen, setAdminOpen] = useState(true);
  const accentColor = branding?.colorPrimary ?? '#547afd';
  const accentText = branding?.textOnPrimary ?? '#ffffff';

  const navItems = isSuperAdmin ? superAdminNav : isAdmin ? adminTopNav : employeeNav;

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {navItems.map((item) => (
        <NavLink key={item.href} item={item} active={pathname === item.href} onClick={onNavigate} accentColor={accentColor} accentText={accentText} />
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
                <NavLink key={item.href} item={item} active={pathname === item.href} onClick={onNavigate} accentColor={accentColor} accentText={accentText} />
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

function roleLabel(role: string | undefined): string {
  if (role === 'SUPER_ADMIN') return 'Super Admin';
  if (role === 'FOUNDER_ADMIN') return 'Admin';
  return 'User';
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { data: branding } = useCompanyBranding();
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
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <SidebarHeader size={32} />
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="mr-3 rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
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
            <span className="text-sm font-semibold text-ink">{branding?.name ?? 'Master ERP'}</span>
          </div>
          <div className="hidden text-sm text-slate-500 sm:block" />
          <div className="flex items-center gap-3">
            <Link href="/profile" className="text-sm text-slate-600 hover:text-ink">
              <span className="hidden sm:inline">{user?.name} </span>
              <span className="text-xs text-slate-400">({roleLabel(user?.role)})</span>
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
