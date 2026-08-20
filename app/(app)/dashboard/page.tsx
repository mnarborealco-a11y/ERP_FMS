'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { callApi } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';
import { Badge, Card, EmptyState, LoadingState, PageHeader, formatDate, formatDateTime } from '@/components/ui';
import type { AdminDashboard, EmployeeDashboard } from '@/types/api';

function useMatterTitles() {
  const { data } = useQuery({
    queryKey: ['matters', 'titles'],
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase.from('matters').select('matter_id, title');
      if (error) throw error;
      return new Map(data.map((m) => [m.matter_id, m.title]));
    },
    staleTime: 60_000
  });
  return (matterId: string) => data?.get(matterId) ?? matterId;
}

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'FOUNDER_ADMIN' ? <AdminDashboardView /> : <EmployeeDashboardView />;
}

function AdminDashboardView() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: () => callApi<AdminDashboard>('dashboard_admin')
  });
  const matterTitle = useMatterTitles();

  if (isLoading || !data) return <LoadingState />;

  const statusEntries = Object.entries(data.mattersByStatus);

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Firm-wide overview" />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statusEntries.length === 0 && <div className="col-span-full text-sm text-slate-500">No matters yet.</div>}
        {statusEntries.map(([status, count]) => (
          <Card key={status}>
            <div className="text-2xl font-semibold text-slate-900">{count}</div>
            <div className="text-xs text-slate-500">{status.replaceAll('_', ' ')}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pending Founder Decisions ({data.pendingFounderDecisions.length})</h2>
          {data.pendingFounderDecisions.length === 0 ? (
            <EmptyState message="Nothing awaiting your review." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.pendingFounderDecisions.map((c) => (
                <li key={c.cycle_id}>
                  <Link href={`/matters/${c.matter_id}`} className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                    <span className="font-medium">{matterTitle(c.matter_id)}</span> — iteration {c.founder_iteration_number} · submitted{' '}
                    {formatDateTime(c.submitted_at)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pending Transfer Requests ({data.pendingTransfers.length})</h2>
          {data.pendingTransfers.length === 0 ? (
            <EmptyState message="No pending transfers." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.pendingTransfers.map((t) => (
                <li key={t.transfer_request_id}>
                  <Link href="/admin/approvals" className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                    <span className="font-medium">{matterTitle(t.matter_id)}</span>: {t.reason}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pending Task Push Requests ({data.pendingTaskPushes.length})</h2>
          {data.pendingTaskPushes.length === 0 ? (
            <EmptyState message="No pending push requests." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.pendingTaskPushes.map((p) => (
                <li key={p.push_request_id}>
                  <Link href="/admin/approvals" className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                    Task due-date push → {formatDate(p.requested_due_at)}: {p.reason}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Overdue ({data.overdueSteps.length + data.overdueTasks.length})
          </h2>
          {data.overdueSteps.length === 0 && data.overdueTasks.length === 0 ? (
            <EmptyState message="Nothing overdue." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.overdueSteps.map((s) => (
                <li key={s.step_instance_id} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
                  <Link href={`/matters/${s.matter_id}`} className="font-medium">
                    {matterTitle(s.matter_id)}
                  </Link>{' '}
                  — {s.step_type.replaceAll('_', ' ')} <Badge tone="red">overdue</Badge>
                </li>
              ))}
              {data.overdueTasks.map((t) => (
                <li key={t.task_id} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
                  <Link href={`/tasks/${t.task_id}`} className="font-medium">
                    {t.title}
                  </Link>{' '}
                  <Badge tone="red">overdue</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmployeeDashboardView() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'employee'],
    queryFn: () => callApi<EmployeeDashboard>('dashboard_employee')
  });
  const matterTitle = useMatterTitles();

  if (isLoading || !data) return <LoadingState />;

  return (
    <div>
      <PageHeader title="My Dashboard" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Matters Needing Action ({data.myMattersNeedingAction.length})</h2>
          {data.myMattersNeedingAction.length === 0 ? (
            <EmptyState message="Nothing needs your action right now." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.myMattersNeedingAction.map((m) => (
                <li key={m.matter_id}>
                  <Link href={`/matters/${m.matter_id}`} className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                    <span className="font-medium">{m.title}</span> — {m.current_step.replaceAll('_', ' ')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Open Tasks ({data.myOpenTasks.length})</h2>
          {data.myOpenTasks.length === 0 ? (
            <EmptyState message="No open tasks." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.myOpenTasks.map((t) => (
                <li key={t.task_id}>
                  <Link href={`/tasks/${t.task_id}`} className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                    <span className="font-medium">{t.title}</span> — due {formatDate(t.due_at)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pending Requests</h2>
          {data.myPendingRequests.transfers.length === 0 && data.myPendingRequests.taskPushes.length === 0 ? (
            <EmptyState message="No pending requests." />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.myPendingRequests.transfers.map((t) => (
                <li key={t.transfer_request_id} className="rounded-md border border-slate-200 px-3 py-2">
                  Transfer of {matterTitle(t.matter_id)} → <Badge tone="amber">pending</Badge>
                </li>
              ))}
              {data.myPendingRequests.taskPushes.map((p) => (
                <li key={p.push_request_id} className="rounded-md border border-slate-200 px-3 py-2">
                  Push due date to {formatDate(p.requested_due_at)} <Badge tone="amber">pending</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Overdue ({data.myOverdueItems.steps.length + data.myOverdueItems.tasks.length})
          </h2>
          {data.myOverdueItems.steps.length === 0 && data.myOverdueItems.tasks.length === 0 ? (
            <EmptyState message="Nothing overdue. Nice work." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.myOverdueItems.steps.map((s) => (
                <li key={s.step_instance_id} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
                  <Link href={`/matters/${s.matter_id}`} className="font-medium">
                    {matterTitle(s.matter_id)}
                  </Link>{' '}
                  — {s.step_type.replaceAll('_', ' ')}
                </li>
              ))}
              {data.myOverdueItems.tasks.map((t) => (
                <li key={t.task_id} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
                  <Link href={`/tasks/${t.task_id}`} className="font-medium">
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
