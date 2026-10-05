'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callApi } from '@/lib/apiClient';
import { isApiError } from '@/lib/auth';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, LoadingState, Modal, PageHeader, Select } from '@/components/ui';
import type { StepActorRole, WorkflowDefinitionMutationResponse, WorkflowListRow } from '@/types/api';

export default function SuperAdminWorkflowsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['super-admin', 'workflows'],
    queryFn: () => callApi<WorkflowListRow[]>('super_admin_list_workflows')
  });

  const [showNew, setShowNew] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [entityLabel, setEntityLabel] = useState('');
  const [entityIdPrefix, setEntityIdPrefix] = useState('');
  const [createdByRole, setCreatedByRole] = useState<StepActorRole>('COMPANY_ADMIN');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const createWorkflow = useMutation({
    mutationFn: () =>
      callApi<WorkflowDefinitionMutationResponse>('workflow_definition_create', {
        p_key: key.trim().toUpperCase().replaceAll(' ', '_'),
        p_name: name.trim(),
        p_entity_label: entityLabel.trim(),
        p_entity_id_prefix: entityIdPrefix.trim().toUpperCase(),
        p_created_by_role: createdByRole,
        p_description: description.trim() || null
      }),
    onSuccess: () => {
      setFormError(null);
      setShowNew(false);
      setKey('');
      setName('');
      setEntityLabel('');
      setEntityIdPrefix('');
      setCreatedByRole('COMPANY_ADMIN');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'workflows'] });
    },
    onError: (err) => setFormError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createWorkflow.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Workflows"
        subtitle="Process definitions any company can be assigned. Matters and Court Appearance are both just workflows here — not special-cased."
        actions={<Button onClick={() => setShowNew(true)}>New Workflow</Button>}
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={isApiError(error) ? error.message : 'Failed to load workflows.'} />
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Workflow">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="Key (unique, e.g. MATTERS)">
            <Input required value={key} onChange={(e) => setKey(e.target.value)} />
          </Field>
          <Field label="Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Matters" />
          </Field>
          <Field label="Entity label (singular, e.g. Matter)">
            <Input required value={entityLabel} onChange={(e) => setEntityLabel(e.target.value)} />
          </Field>
          <Field label="Entity ID prefix (e.g. M-)">
            <Input required value={entityIdPrefix} onChange={(e) => setEntityIdPrefix(e.target.value)} placeholder="M-" />
          </Field>
          <Field label="Who can create new instances?">
            <Select value={createdByRole} onChange={(e) => setCreatedByRole(e.target.value as StepActorRole)}>
              <option value="COMPANY_ADMIN">Company Admin (assigns to an employee)</option>
              <option value="ASSIGNEE">Employee (self-service)</option>
            </Select>
          </Field>
          <Field label="Description (optional)">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          {formError && <ErrorBanner message={formError} />}
          <Button type="submit" disabled={createWorkflow.isPending}>
            {createWorkflow.isPending ? 'Creating…' : 'Create Workflow'}
          </Button>
        </form>
      </Modal>

      {isLoading || !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState message="No workflows yet." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Workflow</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Steps</th>
                <th className="px-4 py-2">Companies assigned</th>
              </tr>
            </thead>
            <tbody>
              {data.map(({ workflow, stepCount, companyCount }) => (
                <tr key={workflow.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/super-admin/workflows/${workflow.id}`} className="font-medium text-slate-900 hover:underline">
                      {workflow.name}
                    </Link>
                    <div className="text-xs text-slate-400">{workflow.key}</div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={workflow.status === 'ACTIVE' ? 'green' : 'slate'}>{workflow.status}</Badge>
                  </td>
                  <td className="px-4 py-2">{stepCount}</td>
                  <td className="px-4 py-2">{companyCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
