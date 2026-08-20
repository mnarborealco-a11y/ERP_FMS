'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callApi } from '@/lib/apiClient';
import { isApiError } from '@/lib/auth';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, LoadingState, Modal, PageHeader, formatDate } from '@/components/ui';
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

export default function SuperAdminCompaniesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['super-admin', 'companies'],
    queryFn: () => callApi<CompanyListRow[]>('super_admin_list_companies')
  });

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [maxUsers, setMaxUsers] = useState('10');
  const [worksSaturday, setWorksSaturday] = useState(false);
  const [worksSunday, setWorksSunday] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createCompany = useMutation({
    mutationFn: () =>
      callApi<{ company: Company }>('super_admin_create_company', {
        p_name: name.trim(),
        p_works_saturday: worksSaturday,
        p_works_sunday: worksSunday,
        p_max_users: Number(maxUsers)
      }),
    onSuccess: () => {
      setFormError(null);
      setShowNew(false);
      setName('');
      setMaxUsers('10');
      setWorksSaturday(false);
      setWorksSunday(false);
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'companies'] });
    },
    onError: (err) => setFormError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createCompany.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="Tenant accounts on this platform. Each company's data is fully siloed from every other company."
        actions={<Button onClick={() => setShowNew(true)}>New Company</Button>}
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={isApiError(error) ? error.message : 'Failed to load companies.'} />
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Company">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
          {formError && <ErrorBanner message={formError} />}
          <Button type="submit" disabled={createCompany.isPending}>
            {createCompany.isPending ? 'Creating…' : 'Create Company'}
          </Button>
        </form>
      </Modal>

      {isLoading || !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState message="No companies yet." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Seats</th>
                <th className="px-4 py-2">Weekend</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/super-admin/companies/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={c.status === 'ACTIVE' ? 'green' : 'red'}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    {c.activeUserCount} / {c.maxUsers}
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {c.worksSaturday ? 'Sat ' : ''}
                    {c.worksSunday ? 'Sun' : ''}
                    {!c.worksSaturday && !c.worksSunday && '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
