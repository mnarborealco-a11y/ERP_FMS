'use client';

import { FormEvent, use, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callApi } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';
import { isApiError } from '@/lib/auth';
import { contrastTextColor } from '@/lib/contrastColor';
import { Badge, Button, Card, ErrorBanner, Field, Input, LoadingState, PageHeader } from '@/components/ui';
import type { Company } from '@/types/api';

interface CompanyListRow {
  id: string;
  name: string;
  slug: string;
  status: Company['status'];
  maxUsers: number;
  activeUserCount: number;
  worksSaturday: boolean;
  worksSunday: boolean;
  logoUrl: string | null;
  colorPrimary: string | null;
  colorSecondary: string | null;
  createdAt: string;
}

export default function CompanyDetailPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const queryClient = useQueryClient();

  const { data: companies, isLoading } = useQuery({
    queryKey: ['super-admin', 'companies'],
    queryFn: () => callApi<CompanyListRow[]>('super_admin_list_companies')
  });
  const company = companies?.find((c) => c.id === companyId);

  const [name, setName] = useState('');
  const [maxUsers, setMaxUsers] = useState('10');
  const [worksSaturday, setWorksSaturday] = useState(false);
  const [worksSunday, setWorksSunday] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [colorPrimary, setColorPrimary] = useState('#547afd');
  const [colorSecondary, setColorSecondary] = useState('#3d5fe0');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) return;
    setName(company.name);
    setMaxUsers(String(company.maxUsers));
    setWorksSaturday(company.worksSaturday);
    setWorksSunday(company.worksSunday);
    setLogoUrl(company.logoUrl ?? '');
    setColorPrimary(company.colorPrimary ?? '#547afd');
    setColorSecondary(company.colorSecondary ?? '#3d5fe0');
  }, [company]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'companies'] });

  const saveSettings = useMutation({
    mutationFn: () =>
      callApi('super_admin_update_company', {
        p_company_id: companyId,
        p_name: name.trim(),
        p_works_saturday: worksSaturday,
        p_works_sunday: worksSunday,
        p_max_users: Number(maxUsers),
        p_logo_url: logoUrl.trim() || null,
        p_color_primary: colorPrimary || null,
        p_color_secondary: colorSecondary || null
      }),
    onSuccess: () => {
      setFormError(null);
      invalidate();
    },
    onError: (err) => setFormError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const toggleSuspend = useMutation({
    mutationFn: () => callApi('super_admin_update_company', { p_company_id: companyId, p_status: company?.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }),
    onSuccess: invalidate,
    onError: (err) => setFormError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);

  const createAdmin = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { name: adminName, email: adminEmail, role: 'FOUNDER_ADMIN', initialPassword: adminPassword, companyId }
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error?.message ?? 'Failed to create admin.');
      return data;
    },
    onSuccess: () => {
      setAdminError(null);
      setAdminSuccess(`Founder/Admin account created for ${adminEmail}.`);
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      invalidate();
    },
    onError: (err) => setAdminError(err instanceof Error ? err.message : 'Something went wrong.')
  });

  function onSaveSettings(e: FormEvent) {
    e.preventDefault();
    saveSettings.mutate();
  }

  function onCreateAdmin(e: FormEvent) {
    e.preventDefault();
    createAdmin.mutate();
  }

  if (isLoading) return <LoadingState />;
  if (!company) return <ErrorBanner message="Company not found." />;

  return (
    <div>
      <PageHeader
        title={company.name}
        subtitle={`${company.activeUserCount} / ${company.maxUsers} seats used`}
        actions={
          <>
            <Badge tone={company.status === 'ACTIVE' ? 'green' : 'red'}>{company.status}</Badge>
            <Button variant={company.status === 'ACTIVE' ? 'danger' : 'secondary'} onClick={() => toggleSuspend.mutate()} disabled={toggleSuspend.isPending}>
              {company.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Settings & Branding</h2>
          <form onSubmit={onSaveSettings} className="flex flex-col gap-3">
            <Field label="Company name">
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="User seat limit">
              <Input type="number" min={1} required value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} />
            </Field>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={worksSaturday} onChange={(e) => setWorksSaturday(e.target.checked)} /> Works Saturdays
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={worksSunday} onChange={(e) => setWorksSunday(e.target.checked)} /> Works Sundays
              </label>
            </div>
            <Field label="Logo URL">
              <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primary color">
                <div className="flex items-center gap-2">
                  <input type="color" value={colorPrimary} onChange={(e) => setColorPrimary(e.target.value)} className="h-8 w-10 rounded border border-slate-300" />
                  <Input value={colorPrimary} onChange={(e) => setColorPrimary(e.target.value)} />
                </div>
              </Field>
              <Field label="Secondary color">
                <div className="flex items-center gap-2">
                  <input type="color" value={colorSecondary} onChange={(e) => setColorSecondary(e.target.value)} className="h-8 w-10 rounded border border-slate-300" />
                  <Input value={colorSecondary} onChange={(e) => setColorSecondary(e.target.value)} />
                </div>
              </Field>
            </div>
            <div className="flex gap-3">
              <div
                className="flex flex-1 items-center justify-center rounded-md py-3 text-sm font-medium"
                style={{ backgroundColor: colorPrimary, color: contrastTextColor(colorPrimary) }}
              >
                Primary preview
              </div>
              <div
                className="flex flex-1 items-center justify-center rounded-md py-3 text-sm font-medium"
                style={{ backgroundColor: colorSecondary, color: contrastTextColor(colorSecondary) }}
              >
                Secondary preview
              </div>
            </div>
            {formError && <ErrorBanner message={formError} />}
            <Button type="submit" disabled={saveSettings.isPending}>
              {saveSettings.isPending ? 'Saving…' : 'Save Settings'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Create Founder/Admin Account</h2>
          <p className="mb-3 text-sm text-slate-500">
            The company's own Founder/Admin can invite further employees themselves after this — this is just for onboarding their first account.
          </p>
          <form onSubmit={onCreateAdmin} className="flex flex-col gap-3">
            <Field label="Name">
              <Input required value={adminName} onChange={(e) => setAdminName(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            </Field>
            <Field label="Initial password (min 8 chars)">
              <Input type="text" required minLength={8} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            </Field>
            {adminError && <ErrorBanner message={adminError} />}
            {adminSuccess && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{adminSuccess}</div>}
            <Button type="submit" variant="secondary" disabled={createAdmin.isPending}>
              {createAdmin.isPending ? 'Creating…' : 'Create Founder/Admin'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
