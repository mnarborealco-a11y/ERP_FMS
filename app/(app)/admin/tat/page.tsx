'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { isApiError } from '@/lib/auth';
import { Button, Card, ErrorBanner, Field, Input, PageHeader, Select } from '@/components/ui';
import type { TatSetting, TatUnit } from '@/types/api';

const TAT_STEPS: { key: string; label: string }[] = [
  { key: 'STEP1', label: 'Step 1 — List of Dates / Notes' },
  { key: 'STEP2', label: 'Step 2 — Preparing Brief' },
  { key: 'CLIENT_APPROVAL', label: 'Send for Client Approval' },
  { key: 'FILING', label: 'Filing / Execution' }
];

export default function TatPage() {
  const { data: tatSettings, isLoading: tatLoading } = useQuery({
    queryKey: ['config'],
    queryFn: async (): Promise<TatSetting[]> => {
      const { data, error } = await supabase.from('tat_settings').select('*');
      if (error) throw error;
      return data;
    },
    staleTime: 300_000
  });

  const tatByKey = new Map((tatSettings ?? []).map((row) => [row.step_key, row]));

  return (
    <div>
      <PageHeader title="Turnaround Times" subtitle="Business-day/hour aware — skips weekends and dates configured under Holidays." />
      <Card className="max-w-lg">
        {tatLoading || !tatSettings ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            {TAT_STEPS.map((step) => (
              <TatRow key={step.key} stepKey={step.key} label={step.label} current={tatByKey.get(step.key)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TatRow({ stepKey, label, current }: { stepKey: string; label: string; current?: TatSetting }) {
  const queryClient = useQueryClient();
  // TatRow only mounts once `current` has loaded (see TatPage), and the
  // key/value only otherwise changes via this row's own mutation below, so
  // a plain lazy initial state covers it - no effect-based sync needed.
  const [value, setValue] = useState(() => String(current?.value ?? ''));
  const [unit, setUnit] = useState<TatUnit>(() => current?.unit ?? 'DAYS');
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tat_settings').update({ value: Number(value), unit }).eq('step_key', stepKey);
      if (error) throw error;
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
    onError: (err) => setError(isApiError(err) ? err.message : err instanceof Error ? err.message : 'Something went wrong.')
  });

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
      <div className="flex items-end gap-2">
        <Field label="Value">
          <Input type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)} className="w-24" />
        </Field>
        <Field label="Unit">
          <Select value={unit} onChange={(e) => setUnit(e.target.value as TatUnit)} className="w-28">
            <option value="DAYS">Days</option>
            <option value="HOURS">Hours</option>
          </Select>
        </Field>
        <Button variant="secondary" onClick={() => update.mutate()} disabled={update.isPending || !value}>
          Save
        </Button>
      </div>
      {error && (
        <div className="mt-2">
          <ErrorBanner message={error} />
        </div>
      )}
    </div>
  );
}
