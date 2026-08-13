'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callApi } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';
import { isApiError, useAuth } from '@/lib/auth';
import { Button, Card, EmptyState, ErrorBanner, Field, Input, LoadingState, PageHeader, Select, formatDate } from '@/components/ui';
import type { CourtAppearance, CourtAppearanceResponse, Matter } from '@/types/api';

function todayLocalDate(): string {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function CourtAppearancesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: myMatters } = useQuery({
    queryKey: ['matters', 'mine', user?.userId],
    enabled: !!user,
    queryFn: async (): Promise<Matter[]> => {
      const { data, error } = await supabase.from('matters').select('*').eq('employee_id', user!.userId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['court', 'myAppearances', user?.userId],
    enabled: !!user,
    queryFn: async (): Promise<CourtAppearance[]> => {
      const { data, error } = await supabase
        .from('court_appearances')
        .select('*')
        .eq('employee_id', user!.userId)
        .order('appearance_date', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const [matterId, setMatterId] = useState('');
  const [courtName, setCourtName] = useState('');
  const [appearanceDate, setAppearanceDate] = useState(todayLocalDate());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createAppearance = useMutation({
    mutationFn: () =>
      callApi<CourtAppearanceResponse>('court_appearances_create', {
        p_matter_id: matterId,
        p_court_name: courtName,
        p_appearance_date: appearanceDate,
        p_note: note || undefined
      }),
    onSuccess: () => {
      setError(null);
      setMatterId('');
      setCourtName('');
      setAppearanceDate(todayLocalDate());
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['court'] });
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createAppearance.mutate();
  }

  const matterTitle = (id: string) => myMatters?.find((m) => m.matter_id === id)?.title;

  if (isLoading || !data) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Court Appearances" subtitle="Log an appearance for one of your matters. Dates can be backdated." />

      <Card className="mb-6 max-w-md">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="Matter">
            <Select required value={matterId} onChange={(e) => setMatterId(e.target.value)}>
              <option value="">Select matter…</option>
              {myMatters?.map((m) => (
                <option key={m.matter_id} value={m.matter_id}>
                  {m.matter_id} — {m.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Court">
            <Input required value={courtName} onChange={(e) => setCourtName(e.target.value)} placeholder="e.g. District Court, Room 4" />
          </Field>
          <Field label="Date">
            <Input type="date" required max={todayLocalDate()} value={appearanceDate} onChange={(e) => setAppearanceDate(e.target.value)} />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && <ErrorBanner message={error} />}
          <Button type="submit" disabled={createAppearance.isPending}>
            {createAppearance.isPending ? 'Logging…' : 'Log Appearance'}
          </Button>
        </form>
      </Card>

      {data.length === 0 ? (
        <EmptyState message="No court appearances logged yet." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Matter</th>
                <th className="px-4 py-2">Court</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.appearance_id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    {a.matter_id}
                    {matterTitle(a.matter_id) && <span className="text-slate-500"> — {matterTitle(a.matter_id)}</span>}
                  </td>
                  <td className="px-4 py-2">{a.court_name}</td>
                  <td className="px-4 py-2">{formatDate(a.appearance_date)}</td>
                  <td className="px-4 py-2 text-slate-500">{a.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
