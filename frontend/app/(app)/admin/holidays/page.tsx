'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { isApiError } from '@/lib/auth';
import { Button, Card, ErrorBanner, Field, Input, PageHeader, formatDate } from '@/components/ui';
import type { HolidayEntry } from '@/types/api';

export default function HolidaysPage() {
  const { data: holidays } = useQuery({
    queryKey: ['holidays'],
    queryFn: async (): Promise<HolidayEntry[]> => {
      const { data, error } = await supabase.from('holidays').select('*').order('date');
      if (error) throw error;
      return data;
    },
    staleTime: 300_000
  });

  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addHoliday = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('holidays').insert({ date, label });
      if (error) throw error;
    },
    onSuccess: () => {
      setError(null);
      setDate('');
      setLabel('');
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: (err) => setError(isApiError(err) ? err.message : err instanceof Error ? err.message : 'Something went wrong.')
  });

  const deleteHoliday = useMutation({
    mutationFn: async (holidayId: string) => {
      const { error } = await supabase.from('holidays').delete().eq('holiday_id', holidayId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] })
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    addHoliday.mutate();
  }

  return (
    <div>
      <PageHeader title="Holidays" subtitle="Dates here are treated as non-working days by the TAT and overdue-scoring engine." />
      <Card className="max-w-lg">
        <form onSubmit={onSubmit} className="mb-4 flex items-end gap-2">
          <Field label="Date">
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Label">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Diwali" />
          </Field>
          <Button type="submit" variant="secondary" disabled={addHoliday.isPending}>
            Add
          </Button>
        </form>
        {error && (
          <div className="mb-3">
            <ErrorBanner message={error} />
          </div>
        )}
        {!holidays || holidays.length === 0 ? (
          <p className="text-sm text-slate-500">No holidays configured.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {holidays.map((h) => (
              <li key={h.holiday_id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-1.5 text-sm">
                <span>
                  {formatDate(h.date)} — {h.label || 'Holiday'}
                </span>
                <button onClick={() => deleteHoliday.mutate(h.holiday_id)} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
