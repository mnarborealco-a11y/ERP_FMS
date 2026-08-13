'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useEmployees, employeeName } from '@/lib/useEmployees';
import { Badge, Card, EmptyState, LoadingState, PageHeader, formatDateTime } from '@/components/ui';
import type { ScoreLedgerEntry } from '@/types/api';

const eventTone: Record<string, 'purple' | 'red' | 'slate'> = {
  FOUNDER_RESUBMISSION: 'purple',
  OVERDUE_STEP: 'red',
  OVERDUE_TASK: 'red',
  ADMIN_ADJUSTMENT: 'slate'
};

export default function EmployeeLedgerPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = use(params);
  const { data: employees } = useEmployees();

  const { data, isLoading } = useQuery({
    queryKey: ['scoring', 'ledger', employeeId],
    queryFn: async (): Promise<ScoreLedgerEntry[]> => {
      const { data, error } = await supabase
        .from('score_ledger')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const entries = data ?? [];
  const total = entries.reduce((sum, e) => sum + Number(e.points), 0);

  return (
    <div>
      <PageHeader
        title={`${employeeName(employees, employeeId)} — Score Ledger`}
        subtitle={`Total: ${total} penalty point(s) — lower is better`}
      />

      {isLoading || !data ? (
        <LoadingState />
      ) : entries.length === 0 ? (
        <EmptyState message="No scoring events yet." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Points</th>
                <th className="px-4 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.ledger_id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-500">{formatDateTime(e.created_at)}</td>
                  <td className="px-4 py-2">
                    <Badge tone={eventTone[e.event_type] ?? 'slate'}>{e.event_type.replaceAll('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-2 font-medium">+{e.points}</td>
                  <td className="px-4 py-2 text-slate-700">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
