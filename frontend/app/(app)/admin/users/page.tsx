'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callApi } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';
import { isApiError } from '@/lib/auth';
import { Badge, Button, Card, ErrorBanner, Field, Input, PageHeader, Select } from '@/components/ui';
import type { PublicUser, Role } from '@/types/api';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => callApi<PublicUser[]>('admin_list_users'),
    staleTime: 60_000
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [initialPassword, setInitialPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { name, email, role, initialPassword }
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error?.message ?? 'Failed to create user.');
      return data;
    },
    onSuccess: () => {
      setError(null);
      setName('');
      setEmail('');
      setInitialPassword('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'employees'] });
    },
    onError: (err) => setError(isApiError(err) ? err.message : err instanceof Error ? err.message : 'Something went wrong.')
  });

  const toggleStatus = useMutation({
    mutationFn: (payload: { p_user_id: string; p_status: string }) => callApi('admin_update_user', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'employees'] });
    }
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createUser.mutate();
  }

  return (
    <div>
      <PageHeader title="Users" subtitle="Create Founder/Admin or Employee accounts. There is no self-signup." />

      <Card className="mb-6 max-w-lg">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="EMPLOYEE">Employee</option>
              <option value="FOUNDER_ADMIN">Founder / Admin</option>
            </Select>
          </Field>
          <Field label="Initial password (min 8 characters)">
            <Input type="text" required minLength={8} value={initialPassword} onChange={(e) => setInitialPassword(e.target.value)} />
          </Field>
          {error && <ErrorBanner message={error} />}
          <Button type="submit" disabled={createUser.isPending}>
            {createUser.isPending ? 'Creating…' : 'Create User'}
          </Button>
        </form>
      </Card>

      {isLoading || !data ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.userId} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium">{u.name}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.role === 'FOUNDER_ADMIN' ? 'Founder / Admin' : 'Employee'}</td>
                  <td className="px-4 py-2">
                    <Badge tone={u.status === 'ACTIVE' ? 'green' : 'red'}>{u.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-xs text-slate-500 hover:underline"
                      disabled={toggleStatus.isPending}
                      onClick={() => toggleStatus.mutate({ p_user_id: u.userId, p_status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}
                    >
                      {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
