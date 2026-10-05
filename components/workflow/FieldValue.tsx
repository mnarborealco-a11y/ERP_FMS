'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useEmployees, employeeName } from '@/lib/useEmployees';
import { Badge, formatDate } from '@/components/ui';
import type { FieldOption, WorkflowFieldDefinition } from '@/types/api';

function optionLabel(options: unknown, value: string): string {
  const opts = (options as FieldOption[] | null) ?? [];
  return opts.find((o) => o.value === value)?.label ?? value;
}

// Renders a single field's stored value generically by field_type -- the
// read-only counterpart to FieldInput. Never declared inside a page body,
// per project convention (loses state on remount).
export function FieldValue({ definition, value }: { definition: WorkflowFieldDefinition; value: unknown }) {
  const { data: employees } = useEmployees();

  if (value === null || value === undefined || value === '') return <span className="text-slate-400">—</span>;

  switch (definition.field_type) {
    case 'TEXT':
    case 'NUMBER':
      return <span>{String(value)}</span>;
    case 'DATE':
      return <span>{formatDate(String(value))}</span>;
    case 'YES_NO':
      return <Badge tone={value ? 'green' : 'slate'}>{value ? 'Yes' : 'No'}</Badge>;
    case 'SINGLE_SELECT':
      return <Badge tone="blue">{optionLabel(definition.options, String(value))}</Badge>;
    case 'MULTI_SELECT': {
      const values = Array.isArray(value) ? (value as string[]) : [];
      if (values.length === 0) return <span className="text-slate-400">—</span>;
      return (
        <span className="flex flex-wrap gap-1">
          {values.map((v) => (
            <Badge key={v} tone="blue">
              {optionLabel(definition.options, v)}
            </Badge>
          ))}
        </span>
      );
    }
    case 'EMPLOYEE_PICKER':
      return <span>{employeeName(employees, String(value))}</span>;
    case 'INSTANCE_REFERENCE':
      return <InstanceReferenceValue instanceId={String(value)} />;
    default:
      return <span>{String(value)}</span>;
  }
}

function InstanceReferenceValue({ instanceId }: { instanceId: string }) {
  const { data } = useQuery({
    queryKey: ['workflow-instance-title', instanceId],
    queryFn: async () => {
      const { data, error } = await supabase.from('workflow_instances').select('id, title').eq('id', instanceId).single();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000
  });

  if (!data) return <span className="text-slate-400">{instanceId}</span>;
  return (
    <Link href={`/workflows/instance/${data.id}`} className="text-brand-dark hover:underline">
      {data.title}
    </Link>
  );
}
