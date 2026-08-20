'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callApi } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';
import { isApiError } from '@/lib/auth';
import { useEmployees, employeeName } from '@/lib/useEmployees';
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Textarea, formatDate, formatDateTime } from '@/components/ui';
import type { AdminDashboard, IndependentTask, Matter, TaskPushRequest, TransferRequest } from '@/types/api';

/**
 * Single "approvals inbox" tab: every request type that needs a
 * Founder/Admin decision (founder-review drafts, matter transfers, task
 * due-date pushes) lives on this one page instead of being scattered
 * across separate tabs.
 */
export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const { data: employees } = useEmployees();

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: () => callApi<AdminDashboard>('dashboard_admin')
  });
  const { data: matters } = useQuery({
    queryKey: ['matters', 'list'],
    queryFn: async (): Promise<Matter[]> => {
      const { data, error } = await supabase.from('matters').select('*');
      if (error) throw error;
      return data;
    }
  });
  const { data: transferRequests } = useQuery({
    queryKey: ['transfers', 'list'],
    queryFn: async (): Promise<TransferRequest[]> => {
      const { data, error } = await supabase.from('transfer_requests').select('*').order('requested_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });
  const { data: pushRequests } = useQuery({
    queryKey: ['taskPushRequests', 'list'],
    queryFn: async (): Promise<TaskPushRequest[]> => {
      const { data, error } = await supabase.from('task_push_requests').select('*').order('requested_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });
  const { data: tasks } = useQuery({
    queryKey: ['tasks', 'list'],
    queryFn: async (): Promise<IndependentTask[]> => {
      const { data, error } = await supabase.from('independent_tasks').select('*');
      if (error) throw error;
      return data;
    }
  });

  const matterById = new Map((matters ?? []).map((m) => [m.matter_id, m]));
  const taskById = new Map((tasks ?? []).map((t) => [t.task_id, t]));

  const [notesByKey, setNotesByKey] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function invalidateAll() {
    setError(null);
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['matters'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
    queryClient.invalidateQueries({ queryKey: ['taskPushRequests'] });
  }

  const founderDecision = useMutation({
    mutationFn: (payload: { p_matter_id: string; p_cycle_id: string; p_decision: string; p_notes?: string }) =>
      callApi('matters_founder_decision', payload),
    onSuccess: invalidateAll,
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const decideTransfer = useMutation({
    mutationFn: (payload: { p_transfer_request_id: string; p_decision: string; p_notes?: string }) =>
      callApi('matters_decide_transfer', payload),
    onSuccess: invalidateAll,
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const decidePush = useMutation({
    mutationFn: (payload: { p_push_request_id: string; p_decision: string; p_notes?: string }) =>
      callApi('tasks_decide_push_request', payload),
    onSuccess: invalidateAll,
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const pendingFounder = dashboard?.pendingFounderDecisions ?? [];
  const pendingTransfers = transferRequests?.filter((t) => t.status === 'PENDING') ?? [];
  const decidedTransfers = transferRequests?.filter((t) => t.status !== 'PENDING') ?? [];
  const pendingPushes = pushRequests?.filter((p) => p.status === 'PENDING') ?? [];
  const decidedPushes = pushRequests?.filter((p) => p.status !== 'PENDING') ?? [];

  const totalPending = pendingFounder.length + pendingTransfers.length + pendingPushes.length;
  const anyPending = totalPending > 0;
  const anyLoading = founderDecision.isPending || decideTransfer.isPending || decidePush.isPending;

  return (
    <div>
      <PageHeader title="Approvals" subtitle={anyPending ? `${totalPending} item(s) need your decision.` : 'Everything is decided.'} />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Founder Review — Drafts ({pendingFounder.length})</h2>
          {pendingFounder.length === 0 ? (
            <EmptyState message="Nothing awaiting your review." />
          ) : (
            <ul className="flex flex-col gap-3">
              {pendingFounder.map((c) => {
                const matter = matterById.get(c.matter_id);
                const key = 'founder-' + c.cycle_id;
                return (
                  <li key={c.cycle_id} className="rounded-md border border-slate-200 p-3">
                    <div className="mb-1 text-sm">
                      <Link href={`/matters/${c.matter_id}`} className="font-medium hover:underline">
                        {matter?.title ?? 'Matter'}
                      </Link>{' '}
                      <Badge tone="purple">iteration #{c.founder_iteration_number}</Badge>
                    </div>
                    <div className="mb-2 text-xs text-slate-500">
                      Submitted {formatDateTime(c.submitted_at)} by {employeeName(employees, c.submitted_by)}
                      {matter && ` · owner ${employeeName(employees, matter.employee_id)}`}
                    </div>
                    <Textarea
                      rows={1}
                      placeholder="Notes (required if requesting changes)"
                      value={notesByKey[key] ?? ''}
                      onChange={(e) => setNotesByKey((s) => ({ ...s, [key]: e.target.value }))}
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Button
                        disabled={anyLoading}
                        onClick={() => founderDecision.mutate({ p_matter_id: c.matter_id, p_cycle_id: c.cycle_id, p_decision: 'APPROVED', p_notes: notesByKey[key] })}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        disabled={anyLoading || !(notesByKey[key] ?? '').trim()}
                        title={!(notesByKey[key] ?? '').trim() ? 'Add a note explaining what needs to change first' : undefined}
                        onClick={() =>
                          founderDecision.mutate({ p_matter_id: c.matter_id, p_cycle_id: c.cycle_id, p_decision: 'CHANGES_REQUESTED', p_notes: notesByKey[key] })
                        }
                      >
                        Request Changes
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Matter Transfers — Pending ({pendingTransfers.length})</h2>
          {pendingTransfers.length === 0 ? (
            <EmptyState message="No pending transfer requests." />
          ) : (
            <ul className="flex flex-col gap-3">
              {pendingTransfers.map((t) => {
                const key = 'transfer-' + t.transfer_request_id;
                return (
                  <li key={t.transfer_request_id} className="rounded-md border border-slate-200 p-3">
                    <div className="mb-1 text-sm">
                      <Link href={`/matters/${t.matter_id}`} className="font-medium hover:underline">
                        {matterById.get(t.matter_id)?.title ?? 'Matter'}
                      </Link>
                      : {employeeName(employees, t.from_employee_id)} → {employeeName(employees, t.to_employee_id)}
                    </div>
                    <div className="mb-2 text-xs text-slate-500">
                      Requested {formatDateTime(t.requested_at)} — {t.reason}
                    </div>
                    <Textarea
                      rows={1}
                      placeholder="Decision notes (optional)"
                      value={notesByKey[key] ?? ''}
                      onChange={(e) => setNotesByKey((s) => ({ ...s, [key]: e.target.value }))}
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Button
                        disabled={anyLoading}
                        onClick={() => decideTransfer.mutate({ p_transfer_request_id: t.transfer_request_id, p_decision: 'APPROVED', p_notes: notesByKey[key] })}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        disabled={anyLoading}
                        onClick={() => decideTransfer.mutate({ p_transfer_request_id: t.transfer_request_id, p_decision: 'REJECTED', p_notes: notesByKey[key] })}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {decidedTransfers.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-slate-500">History ({decidedTransfers.length})</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {decidedTransfers.map((t) => (
                  <li key={t.transfer_request_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <span>
                      <Link href={`/matters/${t.matter_id}`} className="font-medium hover:underline">
                        {matterById.get(t.matter_id)?.title ?? 'Matter'}
                      </Link>{' '}
                      {employeeName(employees, t.from_employee_id)} → {employeeName(employees, t.to_employee_id)}
                    </span>
                    <Badge tone={t.status === 'APPROVED' ? 'green' : 'red'}>{t.status}</Badge>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Task Due-Date Pushes — Pending ({pendingPushes.length})</h2>
          {pendingPushes.length === 0 ? (
            <EmptyState message="No pending push requests." />
          ) : (
            <ul className="flex flex-col gap-3">
              {pendingPushes.map((p) => {
                const key = 'push-' + p.push_request_id;
                return (
                  <li key={p.push_request_id} className="rounded-md border border-slate-200 p-3">
                    <div className="mb-1 text-sm">
                      <Link href={`/tasks/${p.task_id}`} className="font-medium hover:underline">
                        {taskById.get(p.task_id)?.title ?? 'Task'}
                      </Link>
                      : {formatDate(p.current_due_at)} → {formatDate(p.requested_due_at)}
                    </div>
                    <div className="mb-2 text-xs text-slate-500">
                      Requested {formatDateTime(p.requested_at)} — {p.reason}
                    </div>
                    <Textarea
                      rows={1}
                      placeholder="Decision notes (optional)"
                      value={notesByKey[key] ?? ''}
                      onChange={(e) => setNotesByKey((s) => ({ ...s, [key]: e.target.value }))}
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Button disabled={anyLoading} onClick={() => decidePush.mutate({ p_push_request_id: p.push_request_id, p_decision: 'APPROVED', p_notes: notesByKey[key] })}>
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        disabled={anyLoading}
                        onClick={() => decidePush.mutate({ p_push_request_id: p.push_request_id, p_decision: 'REJECTED', p_notes: notesByKey[key] })}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {decidedPushes.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-slate-500">History ({decidedPushes.length})</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {decidedPushes.map((p) => (
                  <li key={p.push_request_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <span>
                      <Link href={`/tasks/${p.task_id}`} className="font-medium hover:underline">
                        {taskById.get(p.task_id)?.title ?? 'Task'}
                      </Link>{' '}
                      {formatDate(p.current_due_at)} → {formatDate(p.requested_due_at)}
                    </span>
                    <Badge tone={p.status === 'APPROVED' || p.status === 'AUTO_APPROVED' ? 'green' : 'red'}>{p.status.replaceAll('_', ' ')}</Badge>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      </div>
    </div>
  );
}
