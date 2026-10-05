'use client';

import { FormEvent, use, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callApi } from '@/lib/apiClient';
import { isApiError } from '@/lib/auth';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  Textarea
} from '@/components/ui';
import type {
  FieldOption,
  StepActorRole,
  StepKind,
  TatUnit,
  WorkflowDefinitionGetResponse,
  WorkflowFieldDefinition,
  WorkflowFieldType,
  WorkflowListRow,
  WorkflowStep
} from '@/types/api';

export default function WorkflowBuilderPage({ params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = use(params);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['super-admin', 'workflow', workflowId],
    queryFn: () => callApi<WorkflowDefinitionGetResponse>('workflow_definition_get', { p_workflow_id: workflowId })
  });

  const { data: allWorkflows } = useQuery({
    queryKey: ['super-admin', 'workflows'],
    queryFn: () => callApi<WorkflowListRow[]>('super_admin_list_workflows')
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'workflow', workflowId] });

  if (isLoading || !data) return <LoadingState />;
  if (error) return <ErrorBanner message={isApiError(error) ? error.message : 'Failed to load workflow.'} />;
  const { workflow, steps, fields } = data;
  if (!workflow) return <ErrorBanner message="Workflow not found." />;

  const stepsSorted = steps.slice().sort((a, b) => a.order_index - b.order_index);
  const workflowFields = fields.filter((f) => !f.step_id).sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={workflow.name}
        subtitle={`${workflow.key} · ${workflow.entity_label} (${workflow.entity_id_prefix}…) · created by ${workflow.created_by_role === 'COMPANY_ADMIN' ? 'Company Admin' : 'Employee'}`}
        actions={<Badge tone={workflow.status === 'ACTIVE' ? 'green' : 'slate'}>{workflow.status}</Badge>}
      />

      <MetadataCard workflowId={workflowId} workflow={workflow} onSaved={invalidate} />

      <StepsCard workflowId={workflowId} steps={stepsSorted} onChanged={invalidate} />

      <FieldsCard
        workflowId={workflowId}
        steps={stepsSorted}
        workflowFields={workflowFields}
        allFields={fields}
        allWorkflows={allWorkflows ?? []}
        onChanged={invalidate}
      />
    </div>
  );
}

// -----------------------------------------------------------------------
// Metadata
// -----------------------------------------------------------------------

function MetadataCard({
  workflowId,
  workflow,
  onSaved
}: {
  workflowId: string;
  workflow: WorkflowDefinitionGetResponse['workflow'];
  onSaved: () => void;
}) {
  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(workflow?.name ?? '');
    setDescription(workflow?.description ?? '');
  }, [workflow]);

  const save = useMutation({
    mutationFn: () => callApi('workflow_definition_update', { p_workflow_id: workflowId, p_name: name.trim(), p_description: description.trim() || null }),
    onSuccess: () => {
      setError(null);
      onSaved();
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const toggleStatus = useMutation({
    mutationFn: () =>
      callApi('workflow_definition_update', { p_workflow_id: workflowId, p_status: workflow?.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' }),
    onSuccess: onSaved,
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Definition</h2>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
        className="flex flex-col gap-3"
      >
        <Field label="Name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={description ?? ''} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <ErrorBanner message={error} />}
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => toggleStatus.mutate()} disabled={toggleStatus.isPending}>
            {workflow?.status === 'ACTIVE' ? 'Archive' : 'Reactivate'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Steps
// -----------------------------------------------------------------------

function stepName(steps: WorkflowStep[], id: string | null): string {
  if (!id) return '(terminal — finishes the instance)';
  return steps.find((s) => s.id === id)?.name ?? '(unknown step)';
}

function StepsCard({ workflowId, steps, onChanged }: { workflowId: string; steps: WorkflowStep[]; onChanged: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [editStep, setEditStep] = useState<WorkflowStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deleteStep = useMutation({
    mutationFn: (stepId: string) => callApi('workflow_step_delete', { p_step_id: stepId }),
    onSuccess: onChanged,
    onError: (err) => setError(isApiError(err) ? err.message : 'Delete failed — this step may still be referenced by an instance or another step.')
  });

  const [reordering, setReordering] = useState(false);

  async function moveStep(index: number, direction: 'up' | 'down') {
    const otherIndex = direction === 'up' ? index - 1 : index + 1;
    if (otherIndex < 0 || otherIndex >= steps.length) return;
    const a = steps[index];
    const b = steps[otherIndex];
    setError(null);
    setReordering(true);
    try {
      await Promise.all([
        callApi('workflow_step_update', { p_step_id: a.id, p_order_index: b.order_index }),
        callApi('workflow_step_update', { p_step_id: b.id, p_order_index: a.order_index })
      ]);
      onChanged();
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Reorder failed.');
    } finally {
      setReordering(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Steps</h2>
        <Button variant="secondary" onClick={() => setShowNew(true)}>
          Add Step
        </Button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Steps are created with no next/reject target, then wired afterward once every step exists — that two-phase flow is expected, not a bug.
      </p>
      {error && (
        <div className="mb-3">
          <ErrorBanner message={error} />
        </div>
      )}
      {steps.length === 0 ? (
        <p className="text-sm text-slate-500">No steps yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {steps.map((s, index) => (
            <li key={s.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label="Move up"
                    className="leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    disabled={reordering || index === 0}
                    onClick={() => moveStep(index, 'up')}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    className="leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    disabled={reordering || index === steps.length - 1}
                    onClick={() => moveStep(index, 'down')}
                  >
                    ▼
                  </button>
                </div>
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-slate-400">{s.key}</span>
                {s.is_entry_step && <Badge tone="purple">Entry</Badge>}
                <Badge tone={s.step_kind === 'DECISION' ? 'blue' : 'slate'}>{s.step_kind}</Badge>
                <Badge tone="slate">
                  {s.actor_role === 'ASSIGNEE' ? 'Assignee' : s.actor_role === 'CLIENT' ? 'Client' : 'Company Admin'}
                </Badge>
                {s.scores_on_reentry && <Badge tone="amber">scores on re-entry</Badge>}
                {s.scores_on_overdue && <Badge tone="amber">scores on overdue</Badge>}
                <div className="ml-auto flex gap-2">
                  <Button variant="secondary" onClick={() => setEditStep(s)}>
                    Edit / Wire
                  </Button>
                  <Button
                    variant="danger"
                    disabled={deleteStep.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete step "${s.name}"? This fails safely if any instance still references it.`)) deleteStep.mutate(s.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                next → {stepName(steps, s.next_step_id)}
                {s.step_kind === 'DECISION' && <> · reject → {stepName(steps, s.reject_next_step_id)}</>}
                {s.default_tat_value != null && (
                  <>
                    {' '}
                    · default TAT {s.default_tat_value} {s.default_tat_unit?.toLowerCase()}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showNew && <NewStepModal workflowId={workflowId} steps={steps} onClose={() => setShowNew(false)} onCreated={onChanged} />}
      {editStep && <EditStepModal step={editStep} steps={steps} onClose={() => setEditStep(null)} onSaved={onChanged} />}
    </Card>
  );
}

function NewStepModal({
  workflowId,
  steps,
  onClose,
  onCreated
}: {
  workflowId: string;
  steps: WorkflowStep[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [stepKind, setStepKind] = useState<StepKind>('ACTION');
  const [actorRole, setActorRole] = useState<StepActorRole>('ASSIGNEE');
  const [isEntryStep, setIsEntryStep] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New steps always go to the end of the list -- order only controls display
  // order here (execution order is graph-driven), so there's nothing for the
  // user to decide; reordering afterward is done with the Move Up/Down arrows.
  const nextOrderIndex = steps.length === 0 ? 0 : Math.max(...steps.map((s) => s.order_index)) + 1;

  const create = useMutation({
    mutationFn: () =>
      callApi('workflow_step_create', {
        p_workflow_id: workflowId,
        p_key: key.trim().toUpperCase().replaceAll(' ', '_'),
        p_name: name.trim(),
        p_step_kind: stepKind,
        p_actor_role: actorRole,
        p_is_entry_step: isEntryStep,
        p_order_index: nextOrderIndex
      }),
    onSuccess: () => {
      onCreated();
      onClose();
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  return (
    <Modal open onClose={onClose} title="Add Step">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="flex flex-col gap-3"
      >
        <Field label="Key (unique within this workflow)">
          <Input required value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. FOUNDER_REVIEW" />
        </Field>
        <Field label="Name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Founder Review" />
        </Field>
        <Field label="Kind">
          <Select value={stepKind} onChange={(e) => setStepKind(e.target.value as StepKind)}>
            <option value="ACTION">Action — one actor completes it, moves on</option>
            <option value="DECISION">Decision — approve, or reject to another step</option>
          </Select>
        </Field>
        <Field label="Who works this step?">
          <Select value={actorRole} onChange={(e) => setActorRole(e.target.value as StepActorRole)}>
            <option value="ASSIGNEE">The instance's assignee</option>
            <option value="COMPANY_ADMIN">The company's admin</option>
            <option value="CLIENT">The attached client</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isEntryStep} onChange={(e) => setIsEntryStep(e.target.checked)} />
          This is the entry step (exactly one per workflow)
        </label>
        {error && <ErrorBanner message={error} />}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create Step'}
        </Button>
      </form>
    </Modal>
  );
}

function EditStepModal({
  step,
  steps,
  onClose,
  onSaved
}: {
  step: WorkflowStep;
  steps: WorkflowStep[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(step.name);
  const [nextStepId, setNextStepId] = useState(step.next_step_id ?? '');
  const [rejectStepId, setRejectStepId] = useState(step.reject_next_step_id ?? '');
  const [requiresNotes, setRequiresNotes] = useState(step.requires_notes_on_reject);
  const [tatEnabled, setTatEnabled] = useState(step.default_tat_value != null);
  const [tatValue, setTatValue] = useState(step.default_tat_value != null ? String(step.default_tat_value) : '');
  const [tatUnit, setTatUnit] = useState<TatUnit>(step.default_tat_unit ?? 'DAYS');
  const [scoresOnReentry, setScoresOnReentry] = useState(step.scores_on_reentry);
  const [scoresOnOverdue, setScoresOnOverdue] = useState(step.scores_on_overdue);
  const [actorRole, setActorRole] = useState<StepActorRole>(step.actor_role);
  const [error, setError] = useState<string | null>(null);

  const otherSteps = steps.filter((s) => s.id !== step.id);

  const save = useMutation({
    mutationFn: () =>
      callApi('workflow_step_update', {
        p_step_id: step.id,
        p_name: name.trim(),
        p_next_step_id: nextStepId || null,
        p_clear_next_step: nextStepId === '',
        p_reject_next_step_id: rejectStepId || null,
        p_clear_reject_next_step: rejectStepId === '',
        p_requires_notes_on_reject: requiresNotes,
        p_default_tat_value: tatEnabled && tatValue ? Number(tatValue) : null,
        p_default_tat_unit: tatEnabled && tatValue ? tatUnit : null,
        p_clear_default_tat: !tatEnabled,
        p_scores_on_reentry: scoresOnReentry,
        p_scores_on_overdue: scoresOnOverdue,
        p_actor_role: actorRole
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  return (
    <Modal open onClose={onClose} title={`Edit "${step.name}"`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="flex flex-col gap-3"
      >
        <Field label="Name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Who works this step?">
          <Select value={actorRole} onChange={(e) => setActorRole(e.target.value as StepActorRole)}>
            <option value="ASSIGNEE">The instance's assignee</option>
            <option value="COMPANY_ADMIN">The company's admin</option>
            <option value="CLIENT">The attached client</option>
          </Select>
        </Field>
        <Field label={step.step_kind === 'DECISION' ? 'Next step (on approval)' : 'Next step'}>
          <Select value={nextStepId} onChange={(e) => setNextStepId(e.target.value)}>
            <option value="">— none (terminal) —</option>
            {otherSteps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        {step.step_kind === 'DECISION' && (
          <>
            <Field label="Reject target (required for decision steps)">
              <Select required value={rejectStepId} onChange={(e) => setRejectStepId(e.target.value)}>
                <option value="">Select…</option>
                {otherSteps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={requiresNotes} onChange={(e) => setRequiresNotes(e.target.checked)} />
              Require notes when rejecting
            </label>
          </>
        )}
        <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={tatEnabled} onChange={(e) => setTatEnabled(e.target.checked)} />
            Default TAT for this step
          </label>
          {tatEnabled && (
            <div className="flex gap-2">
              <Input type="number" min={1} value={tatValue} onChange={(e) => setTatValue(e.target.value)} className="w-24" />
              <Select value={tatUnit} onChange={(e) => setTatUnit(e.target.value as TatUnit)} className="w-28">
                <option value="DAYS">Days</option>
                <option value="HOURS">Hours</option>
              </Select>
            </div>
          )}
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={scoresOnReentry} onChange={(e) => setScoresOnReentry(e.target.checked)} /> Scores on re-entry
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={scoresOnOverdue} onChange={(e) => setScoresOnOverdue(e.target.checked)} /> Scores on overdue
          </label>
        </div>
        {error && <ErrorBanner message={error} />}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Modal>
  );
}

// -----------------------------------------------------------------------
// Fields
// -----------------------------------------------------------------------

const FIELD_TYPES: WorkflowFieldType[] = ['TEXT', 'NUMBER', 'DATE', 'SINGLE_SELECT', 'MULTI_SELECT', 'EMPLOYEE_PICKER', 'YES_NO', 'INSTANCE_REFERENCE'];

function FieldsCard({
  workflowId,
  steps,
  workflowFields,
  allFields,
  allWorkflows,
  onChanged
}: {
  workflowId: string;
  steps: WorkflowStep[];
  workflowFields: WorkflowFieldDefinition[];
  allFields: WorkflowFieldDefinition[];
  allWorkflows: WorkflowListRow[];
  onChanged: () => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [editField, setEditField] = useState<WorkflowFieldDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const deleteField = useMutation({
    mutationFn: (fieldId: string) => callApi('workflow_field_delete', { p_field_id: fieldId }),
    onSuccess: onChanged,
    onError: (err) => setError(isApiError(err) ? err.message : 'Delete failed.')
  });

  async function moveField(group: WorkflowFieldDefinition[], index: number, direction: 'up' | 'down') {
    const otherIndex = direction === 'up' ? index - 1 : index + 1;
    if (otherIndex < 0 || otherIndex >= group.length) return;
    const a = group[index];
    const b = group[otherIndex];
    setError(null);
    setReordering(true);
    try {
      await Promise.all([
        callApi('workflow_field_update', { p_field_id: a.id, p_order_index: b.order_index }),
        callApi('workflow_field_update', { p_field_id: b.id, p_order_index: a.order_index })
      ]);
      onChanged();
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Reorder failed.');
    } finally {
      setReordering(false);
    }
  }

  function fieldRow(f: WorkflowFieldDefinition, group: WorkflowFieldDefinition[], index: number) {
    return (
      <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
        <div className="flex flex-col">
          <button
            type="button"
            aria-label="Move up"
            className="leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30"
            disabled={reordering || index === 0}
            onClick={() => moveField(group, index, 'up')}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Move down"
            className="leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30"
            disabled={reordering || index === group.length - 1}
            onClick={() => moveField(group, index, 'down')}
          >
            ▼
          </button>
        </div>
        <span className="font-medium">{f.label}</span>
        <span className="text-xs text-slate-400">{f.key}</span>
        <Badge tone="blue">{f.field_type}</Badge>
        {f.is_required && <Badge tone="amber">required</Badge>}
        {f.penalize_client_on_no && <Badge tone="amber">penalizes client on &quot;No&quot;</Badge>}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setEditField(f)}>
            Edit
          </Button>
          <Button
            variant="danger"
            disabled={deleteField.isPending}
            onClick={() => {
              if (window.confirm(`Delete field "${f.label}"?`)) deleteField.mutate(f.id);
            }}
          >
            Delete
          </Button>
        </div>
      </li>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Custom Fields</h2>
        <Button variant="secondary" onClick={() => setShowNew(true)}>
          Add Field
        </Button>
      </div>
      {error && (
        <div className="mb-3">
          <ErrorBanner message={error} />
        </div>
      )}

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow-level (filled once, at creation)</h3>
      {workflowFields.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">None.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">{workflowFields.map((f, i) => fieldRow(f, workflowFields, i))}</ul>
      )}

      {steps.map((s) => {
        const stepFields = allFields.filter((f) => f.step_id === s.id).sort((a, b) => a.order_index - b.order_index);
        return (
          <div key={s.id} className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.name} (filled when working this step)</h3>
            {stepFields.length === 0 ? (
              <p className="text-sm text-slate-500">None.</p>
            ) : (
              <ul className="flex flex-col gap-2">{stepFields.map((f, i) => fieldRow(f, stepFields, i))}</ul>
            )}
          </div>
        );
      })}

      {showNew && (
        <NewFieldModal
          workflowId={workflowId}
          steps={steps}
          allFields={allFields}
          allWorkflows={allWorkflows}
          onClose={() => setShowNew(false)}
          onCreated={onChanged}
        />
      )}
      {editField && <EditFieldModal field={editField} onClose={() => setEditField(null)} onSaved={onChanged} />}
    </Card>
  );
}

function OptionsEditor({ options, onChange }: { options: FieldOption[]; onChange: (o: FieldOption[]) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
      {options.map((o, i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder="value"
            value={o.value}
            onChange={(e) => onChange(options.map((opt, idx) => (idx === i ? { ...opt, value: e.target.value } : opt)))}
          />
          <Input
            placeholder="label"
            value={o.label}
            onChange={(e) => onChange(options.map((opt, idx) => (idx === i ? { ...opt, label: e.target.value } : opt)))}
          />
          <Button type="button" variant="ghost" onClick={() => onChange(options.filter((_, idx) => idx !== i))}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => onChange([...options, { value: '', label: '' }])}>
        Add Option
      </Button>
    </div>
  );
}

function NewFieldModal({
  workflowId,
  steps,
  allFields,
  allWorkflows,
  onClose,
  onCreated
}: {
  workflowId: string;
  steps: WorkflowStep[];
  allFields: WorkflowFieldDefinition[];
  allWorkflows: WorkflowListRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<WorkflowFieldType>('TEXT');
  const [stepId, setStepId] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState<FieldOption[]>([{ value: '', label: '' }]);
  const [referencesWorkflowId, setReferencesWorkflowId] = useState('');
  const [penalizeClientOnNo, setPenalizeClientOnNo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsOptions = fieldType === 'SINGLE_SELECT' || fieldType === 'MULTI_SELECT';
  const needsReference = fieldType === 'INSTANCE_REFERENCE';
  const isYesNo = fieldType === 'YES_NO';
  // New fields always go to the end of their group (workflow-level, or a
  // given step) -- order only controls display order, so there's nothing
  // for the user to decide; reorder afterward with the Move Up/Down arrows.
  const siblingFields = allFields.filter((f) => (stepId ? f.step_id === stepId : !f.step_id));
  const nextOrderIndex = siblingFields.length === 0 ? 0 : Math.max(...siblingFields.map((f) => f.order_index)) + 1;

  const create = useMutation({
    mutationFn: () =>
      callApi('workflow_field_create', {
        p_workflow_id: workflowId,
        p_key: key.trim().toLowerCase().replaceAll(' ', '_'),
        p_label: label.trim(),
        p_field_type: fieldType,
        p_step_id: stepId || null,
        p_is_required: isRequired,
        p_order_index: nextOrderIndex,
        p_options: needsOptions ? options.filter((o) => o.value && o.label) : null,
        p_references_workflow_id: needsReference ? referencesWorkflowId || null : null,
        p_penalize_client_on_no: isYesNo ? penalizeClientOnNo : false
      }),
    onSuccess: () => {
      onCreated();
      onClose();
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  return (
    <Modal open onClose={onClose} title="Add Field">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="flex flex-col gap-3"
      >
        <Field label="Key (unique within this workflow)">
          <Input required value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. client_name" />
        </Field>
        <Field label="Label">
          <Input required value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={fieldType} onChange={(e) => setFieldType(e.target.value as WorkflowFieldType)}>
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Applies to">
          <Select value={stepId} onChange={(e) => setStepId(e.target.value)}>
            <option value="">Workflow-level (filled once, at creation)</option>
            {steps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (filled when working this step)
              </option>
            ))}
          </Select>
        </Field>
        {needsOptions && (
          <Field label="Options">
            <OptionsEditor options={options} onChange={setOptions} />
          </Field>
        )}
        {needsReference && (
          <Field label="References workflow">
            <Select required value={referencesWorkflowId} onChange={(e) => setReferencesWorkflowId(e.target.value)}>
              <option value="">Select…</option>
              {allWorkflows.map(({ workflow }) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
          Required
        </label>
        {isYesNo && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={penalizeClientOnNo} onChange={(e) => setPenalizeClientOnNo(e.target.checked)} />
            Give the client a penalty point when this is answered &quot;No&quot; (requires a Client attached to the instance)
          </label>
        )}
        {error && <ErrorBanner message={error} />}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create Field'}
        </Button>
      </form>
    </Modal>
  );
}

function EditFieldModal({ field, onClose, onSaved }: { field: WorkflowFieldDefinition; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(field.label);
  const [isRequired, setIsRequired] = useState(field.is_required);
  const [options, setOptions] = useState<FieldOption[]>((field.options as FieldOption[] | null) ?? [{ value: '', label: '' }]);
  const [penalizeClientOnNo, setPenalizeClientOnNo] = useState(field.penalize_client_on_no);
  const [error, setError] = useState<string | null>(null);

  const needsOptions = field.field_type === 'SINGLE_SELECT' || field.field_type === 'MULTI_SELECT';
  const isYesNo = field.field_type === 'YES_NO';

  const save = useMutation({
    mutationFn: () =>
      callApi('workflow_field_update', {
        p_field_id: field.id,
        p_label: label.trim(),
        p_is_required: isRequired,
        p_options: needsOptions ? options.filter((o) => o.value && o.label) : null,
        p_penalize_client_on_no: isYesNo ? penalizeClientOnNo : false
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  return (
    <Modal open onClose={onClose} title={`Edit "${field.label}"`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="flex flex-col gap-3"
      >
        <p className="text-xs text-slate-500">Key, type, and step assignment can't be changed here — delete and recreate the field for that.</p>
        <Field label="Label">
          <Input required value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        {needsOptions && (
          <Field label="Options">
            <OptionsEditor options={options} onChange={setOptions} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
          Required
        </label>
        {isYesNo && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={penalizeClientOnNo} onChange={(e) => setPenalizeClientOnNo(e.target.checked)} />
            Give the client a penalty point when this is answered &quot;No&quot; (requires a Client attached to the instance)
          </label>
        )}
        {error && <ErrorBanner message={error} />}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Modal>
  );
}
