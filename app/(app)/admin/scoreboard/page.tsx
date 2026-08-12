'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callApi } from '@/lib/apiClient';
import { isApiError } from '@/lib/auth';
import { Button, Card, EmptyState, ErrorBanner, LoadingState, PageHeader } from '@/components/ui';
import type { ScoreSummaryRow } from '@/types/api';

export default function ScoreboardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['scoring', 'summary'],
    queryFn: () => callApi<ScoreSummaryRow[]>('scoring_get_summary')
  });

  const [error, setError] = useState<string | null>(null);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);

  const recompute = useMutation({
    mutationFn: () => callApi<{ added: number }>('scoring_recompute_overdue_now'),
    onSuccess: (res) => {
      setError(null);
      setAddedMsg(`Scan complete — ${res.added} new overdue point(s) added.`);
      queryClient.invalidateQueries({ queryKey: ['scoring'] });
    },
    onError: (err) => setError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  return (
    <div>
      <PageHeader
        title="Scoreboard"
        subtitle="+1 for each resubmission to the Founder after the first; +1 per extra working day an item is overdue."
        actions={
          <Button variant="secondary" onClick={() => recompute.mutate()} disabled={recompute.isPending}>
            {recompute.isPending ? 'Scanning…' : 'Recompute Overdue Now'}
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {addedMsg && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{addedMsg}</div>}

      {isLoading || !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState message="No users yet." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Resubmissions</th>
                <th className="px-4 py-2">Overdue Steps</th>
                <th className="px-4 py-2">Overdue Tasks</th>
                <th className="px-4 py-2">Total Points</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.employeeId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/admin/scoreboard/${row.employeeId}`} className="font-medium text-slate-900 hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{row.byType.FOUNDER_RESUBMISSION ?? 0}</td>
                  <td className="px-4 py-2">{row.byType.OVERDUE_STEP ?? 0}</td>
                  <td className="px-4 py-2">{row.byType.OVERDUE_TASK ?? 0}</td>
                  <td className="px-4 py-2 font-semibold">{row.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
