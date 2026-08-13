'use client';

import { useQuery } from '@tanstack/react-query';
import { callApi } from '@/lib/apiClient';
import { Card, LoadingState, PageHeader } from '@/components/ui';
import type { MyScoreSummary } from '@/types/api';

export default function MyScorePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['scoring', 'mySummary'],
    queryFn: () => callApi<MyScoreSummary>('scoring_get_my_summary')
  });

  if (isLoading || !data) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="My Score"
        subtitle="These are penalty points — lower is better. +1 for each resubmission to the Founder after the first; +1 per extra working day an item is overdue."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-md">
        <Card>
          <div className={`text-3xl font-semibold ${data.avgPointsPerTwoWeeks > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {data.avgPointsPerTwoWeeks}
          </div>
          <div className="mt-1 text-xs text-slate-500">Avg penalty points / 2 weeks (rolling, lower is better)</div>
        </Card>
        <Card>
          <div className={`text-3xl font-semibold ${data.totalPoints > 0 ? 'text-red-600' : 'text-green-600'}`}>{data.totalPoints}</div>
          <div className="mt-1 text-xs text-slate-500">Total penalty points (all time, lower is better)</div>
        </Card>
      </div>
    </div>
  );
}
