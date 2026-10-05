'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useEmployees } from '@/lib/useEmployees';
import { Field, Input, Select, Textarea } from '@/components/ui';
import type { FieldOption, WorkflowFieldDefinition } from '@/types/api';

// Editable counterpart to FieldValue -- renders one input generically by
// field_type, reporting raw JS values back up (jsonb-shaped, matching how
// workflow_instance_field_values.value is stored). Never declared inside a
// page body, per project convention (loses state on remount).
export function FieldInput({
  definition,
  value,
  onChange
}: {
  definition: WorkflowFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const options = (definition.options as FieldOption[] | null) ?? [];

  switch (definition.field_type) {
    case 'TEXT':
      return (
        <Field label={definition.label}>
          <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} required={definition.is_required} />
        </Field>
      );
    case 'NUMBER':
      return (
        <Field label={definition.label}>
          <Input
            type="number"
            value={value === null || value === undefined ? '' : (value as number)}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            required={definition.is_required}
          />
        </Field>
      );
    case 'DATE':
      return (
        <Field label={definition.label}>
          <Input
            type="date"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            required={definition.is_required}
          />
        </Field>
      );
    case 'YES_NO':
      return (
        <Field label={definition.label}>
          <Select value={value === true ? 'yes' : value === false ? 'no' : ''} onChange={(e) => onChange(e.target.value === 'yes')}>
            <option value="" disabled>
              Select…
            </option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
        </Field>
      );
    case 'SINGLE_SELECT':
      return (
        <Field label={definition.label}>
          <Select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} required={definition.is_required}>
            <option value="" disabled>
              Select…
            </option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      );
    case 'MULTI_SELECT': {
      const values = Array.isArray(value) ? (value as string[]) : [];
      function toggle(v: string) {
        onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
      }
      return (
        <Field label={definition.label}>
          <div className="flex flex-col gap-1.5 rounded-md border border-slate-300 px-3 py-2">
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={values.includes(o.value)} onChange={() => toggle(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </Field>
      );
    }
    case 'EMPLOYEE_PICKER':
      return <EmployeePickerInput definition={definition} value={value} onChange={onChange} />;
    case 'INSTANCE_REFERENCE':
      return <InstanceReferenceInput definition={definition} value={value} onChange={onChange} />;
    default:
      return (
        <Field label={definition.label}>
          <Textarea value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />
        </Field>
      );
  }
}

function EmployeePickerInput({
  definition,
  value,
  onChange
}: {
  definition: WorkflowFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { data: employees } = useEmployees();
  return (
    <Field label={definition.label}>
      <Select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} required={definition.is_required}>
        <option value="" disabled>
          Select…
        </option>
        {employees?.map((e) => (
          <option key={e.userId} value={e.userId}>
            {e.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function InstanceReferenceInput({
  definition,
  value,
  onChange
}: {
  definition: WorkflowFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { data: instances } = useQuery({
    queryKey: ['workflow-instances-picker', definition.references_workflow_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_instances')
        .select('id, title')
        .eq('workflow_id', definition.references_workflow_id as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!definition.references_workflow_id,
    staleTime: 30_000
  });

  return (
    <Field label={definition.label}>
      <Select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} required={definition.is_required}>
        <option value="" disabled>
          Select…
        </option>
        {instances?.map((i) => (
          <option key={i.id} value={i.id}>
            {i.id} — {i.title}
          </option>
        ))}
      </Select>
    </Field>
  );
}
