'use client';

import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, isApiError } from '@/lib/auth';
import { callApi } from '@/lib/apiClient';
import { useEmployees, employeeName } from '@/lib/useEmployees';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Textarea,
  formatDate,
  formatDateTime,
  isOverdue
} from '@/components/ui';
import type { TaskGetResponse, TaskStatus } from '@/types/api';

export default function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: employees } = useEmployees();
  const isAdmin = user?.role === 'FOUNDER_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'get', taskId],
    queryFn: () => callApi<TaskGetResponse>('task_detail', { p_task_id: taskId })
  });

  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  const updateStatus = useMutation({
    mutationFn: (status: TaskStatus) => callApi('tasks_update_status', { p_task_id: taskId, p_status: status }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const [adminNewDueAt, setAdminNewDueAt] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const adminPush = useMutation({
    mutationFn: () =>
      callApi('tasks_admin_push_due_date', { p_task_id: taskId, p_new_due_at: new Date(adminNewDueAt).toISOString(), p_notes: adminNotes }),
    onSuccess: () => {
      setError(null);
      setAdminNewDueAt('');
      setAdminNotes('');
      invalidate();
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const [empNewDueAt, setEmpNewDueAt] = useState('');
  const [empReason, setEmpReason] = useState('');
  const requestPush = useMutation({
    mutationFn: () =>
      callApi('tasks_request_push_due_date', { p_task_id: taskId, p_requested_due_at: new Date(empNewDueAt).toISOString(), p_reason: empReason }),
    onSuccess: () => {
      setError(null);
      setEmpNewDueAt('');
      setEmpReason('');
      invalidate();
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  if (isLoading || !data) return <LoadingState />;
  const { task, pushRequests } = data;
  if (!task) return <ErrorBanner message="Task not found." />;
  const isOwner = user?.role === 'EMPLOYEE' && task.assigned_to === user.userId;
  const hasPendingPush = pushRequests.some((p) => p.status === 'PENDING');

  return (
    <div>
      <PageHeader title={task.title} subtitle={`Assigned to ${employeeName(employees, task.assigned_to)}`} />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="blue">{task.priority}</Badge>
            <Badge tone={task.status === 'DONE' ? 'green' : task.status === 'CANCELLED' ? 'red' : 'slate'}>{task.status.replaceAll('_', ' ')}</Badge>
            {isOverdue(task.due_at) && task.status !== 'DONE' && task.status !== 'CANCELLED' && <Badge tone="red">overdue</Badge>}
          </div>
          <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">{task.description || 'No description.'}</p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Original due date</dt>
              <dd>{formatDate(task.original_due_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Current due date</dt>
              <dd className="font-medium">{formatDate(task.due_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Created</dt>
              <dd>{formatDateTime(task.created_at)}</dd>
            </div>
            {task.completed_at && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Completed</dt>
                <dd>{formatDateTime(task.completed_at)}</dd>
              </div>
            )}
          </dl>

          {(isOwner || isAdmin) && task.status !== 'DONE' && task.status !== 'CANCELLED' && (
            <div className="mt-4 flex flex-wrap gap-2">
              {task.status === 'OPEN' && (
                <Button variant="secondary" onClick={() => updateStatus.mutate('IN_PROGRESS')} disabled={updateStatus.isPending}>
                  Mark In Progress
                </Button>
              )}
              <Button onClick={() => updateStatus.mutate('DONE')} disabled={updateStatus.isPending}>
                Mark Done
              </Button>
              {isAdmin && (
                <Button variant="danger" onClick={() => updateStatus.mutate('CANCELLED')} disabled={updateStatus.isPending}>
                  Cancel Task
                </Button>
              )}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Due Date Push</h2>
            {isAdmin && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  adminPush.mutate();
                }}
                className="mb-4 flex flex-col gap-2"
              >
                <Field label="New due date">
                  <Input type="date" required value={adminNewDueAt} onChange={(e) => setAdminNewDueAt(e.target.value)} />
                </Field>
                <Field label="Notes (optional)">
                  <Textarea rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
                </Field>
                <Button type="submit" variant="secondary" disabled={adminPush.isPending}>
                  Push Due Date (applies immediately)
                </Button>
              </form>
            )}
            {isOwner && !isAdmin && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  requestPush.mutate();
                }}
                className="mb-4 flex flex-col gap-2"
              >
                <Field label="Requested new due date">
                  <Input type="date" required value={empNewDueAt} onChange={(e) => setEmpNewDueAt(e.target.value)} />
                </Field>
                <Field label="Reason (required)">
                  <Textarea rows={2} required value={empReason} onChange={(e) => setEmpReason(e.target.value)} />
                </Field>
                <Button type="submit" variant="secondary" disabled={requestPush.isPending || hasPendingPush}>
                  {hasPendingPush ? 'A push request is already pending' : 'Request Push (needs admin approval)'}
                </Button>
              </form>
            )}

            {pushRequests.length === 0 ? (
              <p className="text-sm text-slate-500">No due-date changes yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pushRequests
                  .slice()
                  .sort((a, b) => b.requested_at.localeCompare(a.requested_at))
                  .map((p) => (
                    <li key={p.push_request_id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={p.status === 'APPROVED' || p.status === 'AUTO_APPROVED' ? 'green' : p.status === 'REJECTED' ? 'red' : 'amber'}>
                          {p.status.replaceAll('_', ' ')}
                        </Badge>
                        <span className="text-slate-500">
                          {formatDate(p.current_due_at)} → {formatDate(p.requested_due_at)}
                        </span>
                      </div>
                      {p.reason && <div className="mt-1 text-slate-700">{p.reason}</div>}
                      <div className="mt-1 text-xs text-slate-400">Requested {formatDateTime(p.requested_at)}</div>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
