'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, isApiError } from '@/lib/auth';
import { callApi } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';
import { useEmployees, employeeName } from '@/lib/useEmployees';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, LoadingState, Modal, PageHeader, Select, Textarea, formatDate, isOverdue } from '@/components/ui';
import type { IndependentTask, TaskMutationResponse, TaskPriority } from '@/types/api';

const priorityTone: Record<TaskPriority, 'slate' | 'blue' | 'amber' | 'red'> = {
  LOW: 'slate',
  MEDIUM: 'blue',
  HIGH: 'amber',
  URGENT: 'red'
};

const statusTone: Record<string, 'slate' | 'green' | 'amber' | 'red'> = {
  OPEN: 'slate',
  IN_PROGRESS: 'amber',
  DONE: 'green',
  CANCELLED: 'red'
};

export default function TasksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'FOUNDER_ADMIN';
  const { data: employees } = useEmployees();

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'list'],
    queryFn: async (): Promise<IndependentTask[]> => {
      const { data, error } = await supabase.from('independent_tasks').select('*').order('due_at');
      if (error) throw error;
      return data;
    }
  });

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueAt, setDueAt] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createTask = useMutation({
    mutationFn: () =>
      callApi<TaskMutationResponse>('tasks_create', {
        p_title: title,
        p_description: description,
        p_priority: priority,
        p_due_at: dueAt ? new Date(dueAt).toISOString() : '',
        p_assigned_to: employeeId
      }),
    onSuccess: () => {
      setError(null);
      setTitle('');
      setDescription('');
      setDueAt('');
      setEmployeeId('');
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createTask.mutate();
  }

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Tasks' : 'My Tasks'}
        actions={isAdmin ? <Button onClick={() => setShowCreate(true)}>New Task</Button> : undefined}
      />

      {isAdmin && (
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Task">
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Field label="Title">
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Description">
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority">
                <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </Field>
              <Field label="Due date">
                <Input type="date" required value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </Field>
            </div>
            <Field label="Assign to">
              <Select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">Select employee…</option>
                {employees?.map((emp) => (
                  <option key={emp.userId} value={emp.userId}>
                    {emp.name}
                  </option>
                ))}
              </Select>
            </Field>
            {error && <ErrorBanner message={error} />}
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending ? 'Creating…' : 'Create Task'}
            </Button>
          </form>
        </Modal>
      )}

      {isLoading || !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState message="No tasks yet." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Task</th>
                {isAdmin && <th className="px-4 py-2">Assigned To</th>}
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.task_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/tasks/${t.task_id}`} className="font-medium text-slate-900 hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  {isAdmin && <td className="px-4 py-2">{employeeName(employees, t.assigned_to)}</td>}
                  <td className="px-4 py-2">
                    <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    {formatDate(t.due_at)}
                    {isOverdue(t.due_at) && t.status !== 'DONE' && t.status !== 'CANCELLED' && (
                      <Badge tone="red">overdue</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={statusTone[t.status]}>{t.status.replaceAll('_', ' ')}</Badge>
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
