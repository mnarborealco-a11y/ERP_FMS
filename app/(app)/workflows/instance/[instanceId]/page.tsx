'use client';

import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, isApiError } from '@/lib/auth';
import { callApi } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';
import { useEmployees, employeeName } from '@/lib/useEmployees';
import { useClients, clientName } from '@/lib/useClients';
import { FieldInput } from '@/components/workflow/FieldInput';
import { FieldValue } from '@/components/workflow/FieldValue';
import { Badge, Button, Card, ErrorBanner, Field, LoadingState, PageHeader, Select, Textarea, formatDateTime, isOverdue } from '@/components/ui';
import type {
  WorkflowDefinition,
  WorkflowFieldDefinition,
  WorkflowInstanceGetResponse,
  WorkflowStep
} from '@/types/api';

export default function WorkflowInstanceDetailPage({ params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = use(params);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: employees } = useEmployees();
  const { data: clients } = useClients();

  const { data, isLoading, error } = useQuery({
    queryKey: ['workflow-instance', instanceId],
    queryFn: () => callApi<WorkflowInstanceGetResponse>('workflow_instance_get', { p_instance_id: instanceId })
  });

  const { data: workflow } = useQuery({
    queryKey: ['workflow-def-by-id', data?.instance?.workflow_id],
    queryFn: async (): Promise<WorkflowDefinition> => {
      const { data: row, error } = await supabase.from('workflow_definitions').select('*').eq('id', data!.instance!.workflow_id).single();
      if (error) throw error;
      return row;
    },
    enabled: !!data?.instance
  });

  const { data: steps } = useQuery({
    queryKey: ['workflow-steps', data?.instance?.workflow_id],
    queryFn: async (): Promise<WorkflowStep[]> => {
      const { data: rows, error } = await supabase.from('workflow_steps').select('*').eq('workflow_id', data!.instance!.workflow_id);
      if (error) throw error;
      return rows;
    },
    enabled: !!data?.instance
  });

  const { data: fields } = useQuery({
    queryKey: ['workflow-fields', data?.instance?.workflow_id],
    queryFn: async (): Promise<WorkflowFieldDefinition[]> => {
      const { data: rows, error } = await supabase.from('workflow_field_definitions').select('*').eq('workflow_id', data!.instance!.workflow_id);
      if (error) throw error;
      return rows;
    },
    enabled: !!data?.instance
  });

  const [actionError, setActionError] = useState<string | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['workflow-instance', instanceId] });
    queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
  }

  const completeAction = useMutation({
    mutationFn: (payload: { p_instance_id: string; p_step_id: string; p_field_values: Record<string, unknown> }) =>
      callApi('workflow_instance_complete_action', payload),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (err) => setActionError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const decide = useMutation({
    mutationFn: (payload: {
      p_instance_id: string;
      p_step_id: string;
      p_instance_step_id: string;
      p_decision: 'APPROVED' | 'CHANGES_REQUESTED';
      p_notes: string | null;
      p_field_values: Record<string, unknown>;
    }) => callApi('workflow_instance_decide', payload),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (err) => setActionError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const [transferTo, setTransferTo] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const requestTransfer = useMutation({
    mutationFn: (payload: { p_instance_id: string; p_to_employee_id: string; p_reason: string }) =>
      callApi('workflow_instance_request_transfer', payload),
    onSuccess: () => {
      setActionError(null);
      setTransferTo('');
      setTransferReason('');
      invalidateAll();
    },
    onError: (err) => setActionError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const decideTransfer = useMutation({
    mutationFn: (payload: { p_transfer_request_id: string; p_decision: 'APPROVED' | 'REJECTED' }) =>
      callApi('workflow_instance_decide_transfer', payload),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (err) => setActionError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  if (isLoading || !data || !workflow || !steps || !fields) return <LoadingState />;
  if (error) return <ErrorBanner message={isApiError(error) ? error.message : 'Failed to load.'} />;
  const { instance, steps: instanceSteps, decisions, fieldValues, transferRequests } = data;
  if (!instance) return <ErrorBanner message={`${workflow.entity_label} not found.`} />;

  const isAdmin = user?.role === 'FOUNDER_ADMIN';
  const isAssignee = user?.role === 'EMPLOYEE' && instance.assigned_to === user.userId;
  const isClientOwner = user?.role === 'CLIENT' && instance.client_id === user.userId;
  const currentStepDef = steps.find((s) => s.id === instance.current_step_id) ?? null;
  const actorMatches = (stepDef: WorkflowStep) =>
    stepDef.actor_role === 'ASSIGNEE' ? isAssignee : stepDef.actor_role === 'CLIENT' ? isClientOwner : isAdmin;
  const workflowFieldValues = fieldValues.filter((v) => v.instance_step_id === null);
  const stepFieldValues = fieldValues.filter((v) => v.instance_step_id !== null);
  const pendingTransfer = transferRequests.find((t) => t.status === 'PENDING');
  const anyMutationLoading = completeAction.isPending || decide.isPending;

  function fieldDef(fieldId: string) {
    return fields!.find((f) => f.id === fieldId);
  }

  return (
    <div>
      <PageHeader
        title={instance.title}
        subtitle={`${workflow.entity_label} · ${instance.id} · Assigned to ${employeeName(employees, instance.assigned_to)}${
          instance.client_id ? ` · Client: ${clientName(clients, instance.client_id)}` : ''
        }`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone={instance.status === 'COMPLETED' ? 'green' : instance.status === 'CANCELLED' ? 'red' : 'blue'}>
                {instance.status.replaceAll('_', ' ')}
              </Badge>
              {currentStepDef && <Badge tone="purple">{currentStepDef.name}</Badge>}
            </div>

            {workflowFieldValues.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {workflowFieldValues.map((v) => {
                  const def = fieldDef(v.field_id);
                  if (!def) return null;
                  return (
                    <div key={v.id} className="flex items-center gap-2 text-sm">
                      <span className="w-32 shrink-0 text-slate-500">{def.label}</span>
                      <FieldValue definition={def} value={v.value} />
                    </div>
                  );
                })}
              </div>
            )}

            {actionError && (
              <div className="mb-4">
                <ErrorBanner message={actionError} />
              </div>
            )}

            {instance.status !== 'IN_PROGRESS' ? (
              <p className="text-sm text-slate-500">This {workflow.entity_label.toLowerCase()} is {instance.status.toLowerCase()}.</p>
            ) : !currentStepDef ? (
              <p className="text-sm text-slate-500">No active step.</p>
            ) : currentStepDef.step_kind === 'ACTION' ? (
              <ActionStepForm
                fields={fields.filter((f) => f.step_id === currentStepDef.id)}
                canAct={actorMatches(currentStepDef)}
                disabled={anyMutationLoading}
                onSubmit={(values) =>
                  completeAction.mutate({ p_instance_id: instance.id, p_step_id: currentStepDef.id, p_field_values: values })
                }
              />
            ) : (
              <DecisionStepForm
                fields={fields.filter((f) => f.step_id === currentStepDef.id)}
                requiresNotesOnReject={currentStepDef.requires_notes_on_reject}
                canAct={actorMatches(currentStepDef)}
                disabled={anyMutationLoading}
                pendingInstanceStepId={
                  decisions.find((d) => d.step_id === currentStepDef.id && d.decision === 'PENDING')?.instance_step_id ?? null
                }
                onDecide={(decision, notes, values) => {
                  const pending = decisions.find((d) => d.step_id === currentStepDef.id && d.decision === 'PENDING');
                  if (!pending) return;
                  decide.mutate({
                    p_instance_id: instance.id,
                    p_step_id: currentStepDef.id,
                    p_instance_step_id: pending.instance_step_id,
                    p_decision: decision,
                    p_notes: notes || null,
                    p_field_values: values
                  });
                }}
              />
            )}
          </Card>

          {stepFieldValues.length > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Field Values</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {stepFieldValues.map((v) => {
                  const def = fieldDef(v.field_id);
                  if (!def) return null;
                  const stepRow = instanceSteps.find((s) => s.id === v.instance_step_id);
                  const stepDef = stepRow ? steps.find((s) => s.id === stepRow.step_id) : undefined;
                  return (
                    <li key={v.id} className="rounded-md border border-slate-200 px-3 py-2">
                      <div className="text-xs text-slate-400">
                        {stepDef?.name}
                        {stepRow && stepRow.entry_number > 1 ? ` (entry #${stepRow.entry_number})` : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-32 shrink-0 text-slate-500">{def.label}</span>
                        <FieldValue definition={def} value={v.value} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">History</h2>
            {instanceSteps.length === 0 ? (
              <p className="text-sm text-slate-500">No history yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {instanceSteps
                  .slice()
                  .sort((a, b) => a.started_at.localeCompare(b.started_at))
                  .map((s) => {
                    const stepDef = steps.find((sd) => sd.id === s.step_id);
                    const decision = decisions.find((d) => d.instance_step_id === s.id);
                    return (
                      <li key={s.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {stepDef?.name}
                            {s.entry_number > 1 ? ` (entry #${s.entry_number})` : ''}
                          </span>
                          <Badge tone={s.status.startsWith('BREACHED') ? 'red' : s.status === 'DONE' ? 'green' : 'slate'}>
                            {s.status.replaceAll('_', ' ')}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {s.due_at ? (
                            <>
                              TAT {s.tat_value} {s.tat_unit?.toLowerCase()} · due {formatDateTime(s.due_at)}
                              {isOverdue(s.due_at) && !s.completed_at && <span className="ml-1 font-semibold text-red-600">OVERDUE</span>}
                            </>
                          ) : (
                            'No timeline'
                          )}
                        </div>
                        {decision && (
                          <div className="mt-1 flex items-center gap-2">
                            <Badge tone={decision.decision === 'APPROVED' ? 'green' : decision.decision === 'CHANGES_REQUESTED' ? 'red' : 'amber'}>
                              {decision.decision.replaceAll('_', ' ')}
                            </Badge>
                            {decision.scored_point && <Badge tone="red">+1 point</Badge>}
                            {decision.decision_notes && <span className="text-slate-700">{decision.decision_notes}</span>}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Transfer</h2>
            {pendingTransfer ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <div>Pending transfer to {employeeName(employees, pendingTransfer.to_employee_id)}</div>
                <div className="mt-1 text-xs text-amber-700">{pendingTransfer.reason}</div>
                {isAdmin && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={decideTransfer.isPending}
                      onClick={() => decideTransfer.mutate({ p_transfer_request_id: pendingTransfer.id, p_decision: 'APPROVED' })}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      disabled={decideTransfer.isPending}
                      onClick={() => decideTransfer.mutate({ p_transfer_request_id: pendingTransfer.id, p_decision: 'REJECTED' })}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ) : isAssignee && instance.status === 'IN_PROGRESS' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  requestTransfer.mutate({ p_instance_id: instance.id, p_to_employee_id: transferTo, p_reason: transferReason });
                }}
                className="flex flex-col gap-3"
              >
                <Field label="Transfer to">
                  <Select required value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                    <option value="">Select employee…</option>
                    {employees
                      ?.filter((e) => e.userId !== instance.assigned_to)
                      .map((e) => (
                        <option key={e.userId} value={e.userId}>
                          {e.name}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label="Reason">
                  <Textarea required rows={2} value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
                </Field>
                <Button type="submit" variant="secondary" disabled={requestTransfer.isPending}>
                  Request Transfer (needs admin approval)
                </Button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">No pending transfer.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionStepForm({
  fields,
  canAct,
  disabled,
  onSubmit
}: {
  fields: WorkflowFieldDefinition[];
  canAct: boolean;
  disabled: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  if (!canAct) return <p className="text-sm text-slate-500">Waiting on the assignee for this step.</p>;

  return (
    <div className="flex flex-col gap-3">
      {fields
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((f) => (
          <FieldInput key={f.id} definition={f} value={values[f.key]} onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))} />
        ))}
      <Button
        onClick={() => onSubmit(values)}
        disabled={disabled || fields.some((f) => f.is_required && (values[f.key] === undefined || values[f.key] === null || values[f.key] === ''))}
      >
        Complete
      </Button>
    </div>
  );
}

function DecisionStepForm({
  fields,
  requiresNotesOnReject,
  canAct,
  disabled,
  pendingInstanceStepId,
  onDecide
}: {
  fields: WorkflowFieldDefinition[];
  requiresNotesOnReject: boolean;
  canAct: boolean;
  disabled: boolean;
  pendingInstanceStepId: string | null;
  onDecide: (decision: 'APPROVED' | 'CHANGES_REQUESTED', notes: string, values: Record<string, unknown>) => void;
}) {
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});

  if (!canAct) return <p className="text-sm text-slate-500">Awaiting decision.</p>;
  if (!pendingInstanceStepId) return <p className="text-sm text-slate-500">No pending decision.</p>;

  return (
    <div className="flex flex-col gap-3">
      {fields
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((f) => (
          <FieldInput key={f.id} definition={f} value={values[f.key]} onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))} />
        ))}
      <Field label="Notes (required if requesting changes)">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button onClick={() => onDecide('APPROVED', notes, values)} disabled={disabled}>
          Approve
        </Button>
        <Button
          variant="danger"
          onClick={() => onDecide('CHANGES_REQUESTED', notes, values)}
          disabled={disabled || (requiresNotesOnReject && !notes.trim())}
          title={requiresNotesOnReject && !notes.trim() ? 'Add a note explaining what needs to change first' : undefined}
        >
          Request Changes
        </Button>
      </div>
    </div>
  );
}
