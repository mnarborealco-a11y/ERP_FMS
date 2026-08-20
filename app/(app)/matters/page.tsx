'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, isApiError } from '@/lib/auth';
import { callApi } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';
import { useEmployees } from '@/lib/useEmployees';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, LoadingState, Modal, PageHeader, Select, formatDate } from '@/components/ui';
import type { Matter, MatterMutationResponse, MatterStatus, MatterType, TatStepKey, TatUnit } from '@/types/api';

const statusTone: Record<MatterStatus, 'slate' | 'green' | 'amber' | 'red' | 'blue'> = {
  IN_PROGRESS: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red'
};

const TAT_STEPS: { key: TatStepKey; label: string }[] = [
  { key: 'STEP1', label: 'Step 1 — List of Dates / Notes' },
  { key: 'STEP2', label: 'Step 2 — Preparing Brief' },
  { key: 'CLIENT_APPROVAL', label: 'Send for Client Approval' },
  { key: 'FILING', label: 'Filing / Execution' }
];

type TatDraft = Record<TatStepKey, { enabled: boolean; value: string; unit: TatUnit }>;

const emptyTatDraft: TatDraft = {
  STEP1: { enabled: false, value: '', unit: 'DAYS' },
  STEP2: { enabled: false, value: '', unit: 'DAYS' },
  CLIENT_APPROVAL: { enabled: false, value: '', unit: 'DAYS' },
  FILING: { enabled: false, value: '', unit: 'DAYS' }
};

export default function MattersListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['matters', 'list'],
    queryFn: async (): Promise<Matter[]> => {
      const { data, error } = await supabase.from('matters').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const isAdmin = user?.role === 'FOUNDER_ADMIN';

  const [showCreate, setShowCreate] = useState(false);
  const { data: employees, isLoading: employeesLoading } = useEmployees();
  const [type, setType] = useState<MatterType>('LITIGATION');
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [tatDraft, setTatDraft] = useState<TatDraft>(emptyTatDraft);
  const [error, setError] = useState<string | null>(null);

  function updateTat(key: TatStepKey, patch: Partial<TatDraft[TatStepKey]>) {
    setTatDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  }

  const createMatter = useMutation({
    mutationFn: () =>
      callApi<MatterMutationResponse>('matters_create', {
        p_type: type,
        p_title: title,
        p_client_name: clientName,
        p_employee_id: employeeId,
        p_tat: TAT_STEPS.filter(({ key }) => tatDraft[key].enabled && tatDraft[key].value).map(({ key }) => ({
          step_key: key,
          value: Number(tatDraft[key].value),
          unit: tatDraft[key].unit
        }))
      }),
    onSuccess: (data) => {
      setShowCreate(false);
      setTitle('');
      setClientName('');
      setEmployeeId('');
      setTatDraft(emptyTatDraft);
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      router.push(`/matters/${data.matter.matter_id}`);
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMatter.mutate();
  }

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Matters' : 'My Matters'}
        actions={isAdmin ? <Button onClick={() => setShowCreate(true)}>New Matter</Button> : undefined}
      />

      {isAdmin && (
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Matter">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as MatterType)}>
                <option value="LITIGATION">Litigation</option>
                <option value="NON_LITIGATION">Non-Litigation</option>
              </Select>
            </Field>
            <Field label="Title">
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sharma vs. Sharma - Property Dispute" />
            </Field>
            <Field label="Client name">
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </Field>
            <Field label="Assign to user">
              <Select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={employeesLoading}>
                <option value="">Select user…</option>
                {employees?.map((e) => (
                  <option key={e.userId} value={e.userId}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
              <span className="text-xs font-medium text-slate-600">TAT (optional — a step left unchecked has no due date / timeline)</span>
              {TAT_STEPS.map(({ key, label }) => (
                <div key={key} className="flex flex-wrap items-center gap-2">
                  <label className="flex flex-1 items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={tatDraft[key].enabled} onChange={(e) => updateTat(key, { enabled: e.target.checked })} />
                    {label}
                  </label>
                  {tatDraft[key].enabled && (
                    <>
                      <Input
                        type="number"
                        min={1}
                        required
                        value={tatDraft[key].value}
                        onChange={(e) => updateTat(key, { value: e.target.value })}
                        className="w-20"
                      />
                      <Select value={tatDraft[key].unit} onChange={(e) => updateTat(key, { unit: e.target.value as TatUnit })} className="w-24">
                        <option value="DAYS">Days</option>
                        <option value="HOURS">Hours</option>
                      </Select>
                    </>
                  )}
                </div>
              ))}
            </div>
            {error && <ErrorBanner message={error} />}
            <Button type="submit" disabled={createMatter.isPending}>
              {createMatter.isPending ? 'Creating…' : 'Create Matter'}
            </Button>
          </form>
        </Modal>
      )}

      {isLoading || !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState message="No matters yet." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Matter</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Current Step</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Iterations</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.matter_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/matters/${m.matter_id}`} className="font-medium text-slate-900 hover:underline">
                      {m.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{m.type === 'LITIGATION' ? 'Litigation' : 'Non-Litigation'}</td>
                  <td className="px-4 py-2">{m.client_name || '—'}</td>
                  <td className="px-4 py-2">{m.current_step.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-2">
                    <Badge tone={statusTone[m.status] ?? 'slate'}>{m.status.replaceAll('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-2">{m.founder_iteration_counter}</td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
