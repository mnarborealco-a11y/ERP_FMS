'use client';

import { FormEvent, use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth, isApiError } from '@/lib/auth';
import { callApi } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';
import { useEmployees } from '@/lib/useEmployees';
import { useClients } from '@/lib/useClients';
import { FieldInput } from '@/components/workflow/FieldInput';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  formatDate
} from '@/components/ui';
import type {
  CompanyWorkflowAssignment,
  RecurrenceUnit,
  RecurringScheduleMutationResponse,
  TatUnit,
  WorkflowDefinition,
  WorkflowFieldDefinition,
  WorkflowInstance,
  WorkflowInstanceMutationResponse,
  WorkflowRecurringSchedule,
  WorkflowStep
} from '@/types/api';

function recurrenceLabel(interval: number, unit: RecurrenceUnit): string {
  const unitLabel = { DAYS: 'day', WEEKS: 'week', MONTHS: 'month' }[unit];
  return interval === 1 ? `Every ${unitLabel}` : `Every ${interval} ${unitLabel}s`;
}

export default function WorkflowInstanceListPage({ params }: { params: Promise<{ workflowKey: string }> }) {
  const { workflowKey } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'FOUNDER_ADMIN';
  const { data: employees } = useEmployees();
  const { data: clients } = useClients();

  const { data: workflow, isLoading: workflowLoading } = useQuery({
    queryKey: ['workflow-def', workflowKey],
    queryFn: async (): Promise<WorkflowDefinition | null> => {
      const { data, error } = await supabase.from('workflow_definitions').select('*').eq('key', workflowKey).maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const { data: steps } = useQuery({
    queryKey: ['workflow-steps', workflow?.id],
    queryFn: async (): Promise<WorkflowStep[]> => {
      const { data, error } = await supabase.from('workflow_steps').select('*').eq('workflow_id', workflow!.id).order('order_index');
      if (error) throw error;
      return data;
    },
    enabled: !!workflow
  });

  const { data: fields } = useQuery({
    queryKey: ['workflow-fields', workflow?.id],
    queryFn: async (): Promise<WorkflowFieldDefinition[]> => {
      const { data, error } = await supabase.from('workflow_field_definitions').select('*').eq('workflow_id', workflow!.id).order('order_index');
      if (error) throw error;
      return data;
    },
    enabled: !!workflow
  });

  const { data: assignment } = useQuery({
    queryKey: ['workflow-assignment', workflow?.id, user?.companyId],
    queryFn: async (): Promise<CompanyWorkflowAssignment | null> => {
      const { data, error } = await supabase
        .from('company_workflow_assignments')
        .select('*')
        .eq('workflow_id', workflow!.id)
        .eq('company_id', user!.companyId!)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workflow && !!user?.companyId
  });

  const { data: instances, isLoading: instancesLoading } = useQuery({
    queryKey: ['workflow-instances', workflow?.id],
    queryFn: async (): Promise<WorkflowInstance[]> => {
      const { data, error } = await supabase.from('workflow_instances').select('*').eq('workflow_id', workflow!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workflow
  });

  const { data: schedules } = useQuery({
    queryKey: ['workflow-recurring-schedules', workflow?.id],
    queryFn: async (): Promise<WorkflowRecurringSchedule[]> => {
      const { data, error } = await supabase
        .from('workflow_recurring_schedules')
        .select('*')
        .eq('workflow_id', workflow!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workflow && isAdmin
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showNewSchedule, setShowNewSchedule] = useState(false);

  if (workflowLoading) return <LoadingState />;
  if (!workflow) return <ErrorBanner message="Workflow not found." />;

  const canCreate = (workflow.created_by_role === 'COMPANY_ADMIN' && user?.role === 'FOUNDER_ADMIN') || (workflow.created_by_role === 'ASSIGNEE' && user?.role === 'EMPLOYEE');
  const stepById = new Map((steps ?? []).map((s) => [s.id, s]));
  const employeeById = new Map((employees ?? []).map((e) => [e.userId, e.name]));
  const clientById = new Map((clients ?? []).map((c) => [c.userId, c.name]));

  return (
    <div>
      <PageHeader
        title={isAdmin ? `${workflow.name}` : `My ${workflow.name}`}
        subtitle={workflow.description ?? undefined}
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="secondary" onClick={() => setShowNewSchedule(true)}>
                New Recurring Schedule
              </Button>
            )}
            {canCreate && <Button onClick={() => setShowCreate(true)}>New {workflow.entity_label}</Button>}
          </div>
        }
      />

      {showCreate && steps && fields && (
        <CreateInstanceModal
          workflow={workflow}
          steps={steps}
          fields={fields}
          assignment={assignment ?? null}
          onClose={() => setShowCreate(false)}
          onCreated={(instanceId) => {
            queryClient.invalidateQueries({ queryKey: ['workflow-instances', workflow.id] });
            router.push(`/workflows/instance/${instanceId}`);
          }}
        />
      )}

      {showNewSchedule && steps && fields && (
        <NewRecurringScheduleModal
          workflow={workflow}
          steps={steps}
          fields={fields}
          assignment={assignment ?? null}
          onClose={() => setShowNewSchedule(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['workflow-recurring-schedules', workflow.id] });
            queryClient.invalidateQueries({ queryKey: ['workflow-instances', workflow.id] });
            setShowNewSchedule(false);
          }}
        />
      )}

      {isAdmin && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recurring Schedules</h2>
          {!schedules || schedules.length === 0 ? (
            <p className="text-sm text-slate-500">No recurring schedules yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {schedules.map((s) => (
                <RecurringScheduleRow key={s.id} schedule={s} employeeById={employeeById} clientById={clientById} workflowId={workflow.id} />
              ))}
            </ul>
          )}
        </Card>
      )}

      {instancesLoading || !instances ? (
        <LoadingState />
      ) : instances.length === 0 ? (
        <EmptyState message={`No ${workflow.entity_label.toLowerCase()}s yet.`} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">{workflow.entity_label}</th>
                <th className="px-4 py-2">Current Step</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/workflows/instance/${i.id}`} className="font-medium text-slate-900 hover:underline">
                      {i.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{i.current_step_id ? (stepById.get(i.current_step_id)?.name ?? '—') : '—'}</td>
                  <td className="px-4 py-2">
                    <Badge tone={i.status === 'COMPLETED' ? 'green' : i.status === 'CANCELLED' ? 'red' : 'blue'}>{i.status.replaceAll('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function CreateInstanceModal({
  workflow,
  steps,
  fields,
  assignment,
  onClose,
  onCreated
}: {
  workflow: WorkflowDefinition;
  steps: WorkflowStep[];
  fields: WorkflowFieldDefinition[];
  assignment: CompanyWorkflowAssignment | null;
  onClose: () => void;
  onCreated: (instanceId: string) => void;
}) {
  const { user } = useAuth();
  const { data: employees } = useEmployees();
  const { data: clients } = useClients();

  const entryStep = steps.find((s) => s.is_entry_step) ?? null;
  const isOneStepFlow = !!entryStep && entryStep.step_kind === 'ACTION' && entryStep.next_step_id === null;
  const workflowFields = fields.filter((f) => !f.step_id).sort((a, b) => a.order_index - b.order_index);
  const entryStepFields = entryStep ? fields.filter((f) => f.step_id === entryStep.id).sort((a, b) => a.order_index - b.order_index) : [];
  const visibleFields = isOneStepFlow ? [...workflowFields, ...entryStepFields] : workflowFields;
  const needsClient = steps.some((s) => s.actor_role === 'CLIENT') || fields.some((f) => f.penalize_client_on_no);

  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState(workflow.created_by_role === 'ASSIGNEE' ? (user?.userId ?? '') : '');
  const [clientId, setClientId] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [tatEnabled, setTatEnabled] = useState<Record<string, boolean>>({});
  const [tatValue, setTatValue] = useState<Record<string, string>>({});
  const [tatUnit, setTatUnit] = useState<Record<string, TatUnit>>({});
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const tat = steps
        .filter((s) => tatEnabled[s.id] && tatValue[s.id])
        .map((s) => ({ step_key: s.key, value: Number(tatValue[s.id]), unit: tatUnit[s.id] ?? 'DAYS' }));

      const created = await callApi<WorkflowInstanceMutationResponse>('workflow_instance_create', {
        p_workflow_id: workflow.id,
        p_title: title.trim(),
        p_assigned_to: assignedTo,
        p_field_values: values,
        p_tat: tat,
        p_client_id: needsClient ? clientId : null
      });

      if (isOneStepFlow && entryStep) {
        return callApi<WorkflowInstanceMutationResponse>('workflow_instance_complete_action', {
          p_instance_id: created.instance.id,
          p_step_id: entryStep.id,
          p_field_values: values
        });
      }
      return created;
    },
    onSuccess: (data) => onCreated(data.instance.id),
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <Modal open onClose={onClose} title={`New ${workflow.entity_label}`}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Title">
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        {workflow.created_by_role === 'COMPANY_ADMIN' && (
          <Field label="Assign to">
            <Select required value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Select user…</option>
              {employees?.map((e) => (
                <option key={e.userId} value={e.userId}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {needsClient && (
          <Field label="Client">
            <Select required value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client…</option>
              {clients?.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {visibleFields.map((f) => (
          <FieldInput key={f.id} definition={f} value={values[f.key]} onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))} />
        ))}

        {assignment?.tat_mode === 'PER_INSTANCE' && (
          <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
            <span className="text-xs font-medium text-slate-600">TAT (optional — a step left unchecked has no due date / timeline)</span>
            {steps.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2">
                <label className="flex flex-1 items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!tatEnabled[s.id]}
                    onChange={(e) => setTatEnabled((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                  />
                  {s.name}
                </label>
                {tatEnabled[s.id] && (
                  <>
                    <Input
                      type="number"
                      min={1}
                      required
                      value={tatValue[s.id] ?? ''}
                      onChange={(e) => setTatValue((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      className="w-20"
                    />
                    <Select
                      value={tatUnit[s.id] ?? 'DAYS'}
                      onChange={(e) => setTatUnit((prev) => ({ ...prev, [s.id]: e.target.value as TatUnit }))}
                      className="w-24"
                    >
                      <option value="DAYS">Days</option>
                      <option value="HOURS">Hours</option>
                    </Select>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <ErrorBanner message={error} />}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : `Create ${workflow.entity_label}`}
        </Button>
      </form>
    </Modal>
  );
}

function RecurringScheduleRow({
  schedule,
  employeeById,
  clientById,
  workflowId
}: {
  schedule: WorkflowRecurringSchedule;
  employeeById: Map<string, string>;
  clientById: Map<string, string>;
  workflowId: string;
}) {
  const queryClient = useQueryClient();
  const { data: employees } = useEmployees();
  const [reassigning, setReassigning] = useState(false);
  const [newAssignee, setNewAssignee] = useState(schedule.assigned_to);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['workflow-recurring-schedules', workflowId] });

  const reassign = useMutation({
    mutationFn: () => callApi('recurring_schedule_update', { p_schedule_id: schedule.id, p_assigned_to: newAssignee }),
    onSuccess: () => {
      invalidate();
      setReassigning(false);
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const togglePause = useMutation({
    mutationFn: () => callApi('recurring_schedule_update', { p_schedule_id: schedule.id, p_is_active: !schedule.is_active }),
    onSuccess: invalidate,
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  return (
    <li className="flex flex-col gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{schedule.client_id ? (clientById.get(schedule.client_id) ?? 'Unknown client') : 'No client'}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-600">{employeeById.get(schedule.assigned_to) ?? 'Unknown'}</span>
        <Badge tone={schedule.is_active ? 'green' : 'slate'}>{schedule.is_active ? 'Active' : 'Paused'}</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setReassigning((v) => !v)}>
            Reassign
          </Button>
          <Button variant="secondary" disabled={togglePause.isPending} onClick={() => togglePause.mutate()}>
            {schedule.is_active ? 'Pause' : 'Resume'}
          </Button>
        </div>
      </div>
      <div className="text-xs text-slate-500">
        {recurrenceLabel(schedule.recurrence_interval, schedule.recurrence_unit)}, starting {formatDate(schedule.anchor_date)} · next due{' '}
        {formatDate(schedule.next_due_date)}
      </div>
      {reassigning && (
        <div className="flex items-center gap-2">
          <Select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} className="max-w-xs">
            {employees?.map((e) => (
              <option key={e.userId} value={e.userId}>
                {e.name}
              </option>
            ))}
          </Select>
          <Button disabled={reassign.isPending} onClick={() => reassign.mutate()}>
            Save
          </Button>
        </div>
      )}
      {error && <ErrorBanner message={error} />}
    </li>
  );
}

function NewRecurringScheduleModal({
  workflow,
  steps,
  fields,
  assignment,
  onClose,
  onCreated
}: {
  workflow: WorkflowDefinition;
  steps: WorkflowStep[];
  fields: WorkflowFieldDefinition[];
  assignment: CompanyWorkflowAssignment | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: employees } = useEmployees();
  const { data: clients } = useClients();

  const workflowFields = fields.filter((f) => !f.step_id).sort((a, b) => a.order_index - b.order_index);

  const [assignedTo, setAssignedTo] = useState('');
  const [clientId, setClientId] = useState('');
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>('MONTHS');
  const [anchorDate, setAnchorDate] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [tatEnabled, setTatEnabled] = useState<Record<string, boolean>>({});
  const [tatValue, setTatValue] = useState<Record<string, string>>({});
  const [tatUnit, setTatUnit] = useState<Record<string, TatUnit>>({});
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const stepTatOverrides = steps
        .filter((s) => tatEnabled[s.id] && tatValue[s.id])
        .map((s) => ({ step_key: s.key, value: Number(tatValue[s.id]), unit: tatUnit[s.id] ?? 'DAYS' }));

      return callApi<RecurringScheduleMutationResponse>('recurring_schedule_create', {
        p_workflow_id: workflow.id,
        p_assigned_to: assignedTo,
        p_recurrence_interval: Number(recurrenceInterval),
        p_recurrence_unit: recurrenceUnit,
        p_anchor_date: anchorDate,
        p_client_id: clientId || null,
        p_field_values: values,
        p_step_tat_overrides: stepTatOverrides
      });
    },
    onSuccess: () => onCreated(),
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <Modal open onClose={onClose} title={`New Recurring Schedule — ${workflow.entity_label}`}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Assign to">
          <Select required value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Select employee…</option>
            {employees?.map((e) => (
              <option key={e.userId} value={e.userId}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Client (optional)">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">No client</option>
            {clients?.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-wrap items-end gap-2">
          <Field label="Repeat every">
            <Input type="number" min={1} required value={recurrenceInterval} onChange={(e) => setRecurrenceInterval(e.target.value)} className="w-20" />
          </Field>
          <Field label="Unit">
            <Select value={recurrenceUnit} onChange={(e) => setRecurrenceUnit(e.target.value as RecurrenceUnit)} className="w-28">
              <option value="DAYS">Day(s)</option>
              <option value="WEEKS">Week(s)</option>
              <option value="MONTHS">Month(s)</option>
            </Select>
          </Field>
          <Field label="Starting on (fixed date)">
            <Input type="date" required value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          A new {workflow.entity_label.toLowerCase()} is created automatically on this date, then again every cycle after — e.g. the 7th of every
          month. The day you pick here is the fixed deadline each cycle is scored against.
        </p>

        {workflowFields.map((f) => (
          <FieldInput key={f.id} definition={f} value={values[f.key]} onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))} />
        ))}

        {assignment?.tat_mode === 'PER_INSTANCE' && (
          <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
            <span className="text-xs font-medium text-slate-600">
              Per-step pacing TAT (optional, reapplied every cycle) — separate from the fixed deadline above
            </span>
            {steps.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2">
                <label className="flex flex-1 items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!tatEnabled[s.id]}
                    onChange={(e) => setTatEnabled((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                  />
                  {s.name}
                </label>
                {tatEnabled[s.id] && (
                  <>
                    <Input
                      type="number"
                      min={1}
                      required
                      value={tatValue[s.id] ?? ''}
                      onChange={(e) => setTatValue((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      className="w-20"
                    />
                    <Select
                      value={tatUnit[s.id] ?? 'DAYS'}
                      onChange={(e) => setTatUnit((prev) => ({ ...prev, [s.id]: e.target.value as TatUnit }))}
                      className="w-24"
                    >
                      <option value="DAYS">Days</option>
                      <option value="HOURS">Hours</option>
                    </Select>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <ErrorBanner message={error} />}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create Schedule'}
        </Button>
      </form>
    </Modal>
  );
}
