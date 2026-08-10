'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callApi } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';
import { isApiError, useAuth } from '@/lib/auth';
import { Button, Card, ErrorBanner, Field, Input, LoadingState, PageHeader, formatDateTime } from '@/components/ui';
import type { CourtPunch, CourtPunchResponse } from '@/types/api';

export default function CourtPunchPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['court', 'myPunches', user?.userId],
    enabled: !!user,
    queryFn: async (): Promise<CourtPunch[]> => {
      const { data, error } = await supabase
        .from('court_punches')
        .select('*')
        .eq('employee_id', user!.userId)
        .order('punch_in_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const [courtName, setCourtName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['court'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  const punchIn = useMutation({
    mutationFn: () => callApi<CourtPunchResponse>('court_punch_in', { p_court_name: courtName, p_note: note }),
    onSuccess: () => {
      setError(null);
      setCourtName('');
      setNote('');
      invalidate();
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  const punchOut = useMutation({
    mutationFn: (punchId: string) => callApi<CourtPunchResponse>('court_punch_out', { p_punch_id: punchId }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    punchIn.mutate();
  }

  if (isLoading || !data) return <LoadingState />;

  const openPunch = data.find((p) => !p.punch_out_at);
  const history = data.filter((p) => p.punch_out_at).sort((a, b) => b.punch_in_at.localeCompare(a.punch_in_at));

  return (
    <div>
      <PageHeader title="Court Hours" subtitle="Punch in when you arrive at court, punch out when you leave." />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <Card className="mb-6 max-w-md">
        {openPunch ? (
          <div className="text-center">
            <p className="mb-1 text-sm text-slate-500">Punched in since</p>
            <p className="mb-4 text-lg font-semibold text-slate-900">{formatDateTime(openPunch.punch_in_at)}</p>
            {openPunch.court_name && <p className="mb-4 text-sm text-slate-600">{openPunch.court_name}</p>}
            <Button variant="danger" className="w-full" onClick={() => punchOut.mutate(openPunch.punch_id)} disabled={punchOut.isPending}>
              Punch Out
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Field label="Court (optional)">
              <Input value={courtName} onChange={(e) => setCourtName(e.target.value)} placeholder="e.g. District Court, Room 4" />
            </Field>
            <Field label="Note (optional)">
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Button type="submit" disabled={punchIn.isPending}>
              Punch In
            </Button>
          </form>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Court</th>
              <th className="px-4 py-2">Punch In</th>
              <th className="px-4 py-2">Punch Out</th>
              <th className="px-4 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No completed punches yet.
                </td>
              </tr>
            ) : (
              history.map((p) => (
                <tr key={p.punch_id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{p.court_name || '—'}</td>
                  <td className="px-4 py-2">{formatDateTime(p.punch_in_at)}</td>
                  <td className="px-4 py-2">{formatDateTime(p.punch_out_at)}</td>
                  <td className="px-4 py-2 text-slate-500">{p.note || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
