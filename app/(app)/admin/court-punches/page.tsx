'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useEmployees, employeeName } from '@/lib/useEmployees';
import { Card, EmptyState, LoadingState, PageHeader, Select, formatDateTime } from '@/components/ui';
import type { CourtPunch } from '@/types/api';

export default function AdminCourtPunchesPage() {
  const { data: employees } = useEmployees();
  const [employeeId, setEmployeeId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['court', 'listAll', employeeId],
    queryFn: async (): Promise<CourtPunch[]> => {
      let query = supabase.from('court_punches').select('*').order('punch_in_at', { ascending: false });
      if (employeeId) query = query.eq('employee_id', employeeId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const punches = data ?? [];

  return (
    <div>
      <PageHeader
        title="Court Punches"
        actions={
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-52">
            <option value="">All employees</option>
            {employees?.map((e) => (
              <option key={e.userId} value={e.userId}>
                {e.name}
              </option>
            ))}
          </Select>
        }
      />

      {isLoading || !data ? (
        <LoadingState />
      ) : punches.length === 0 ? (
        <EmptyState message="No court punches recorded." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Court</th>
                <th className="px-4 py-2">Punch In</th>
                <th className="px-4 py-2">Punch Out</th>
                <th className="px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {punches.map((p) => (
                <tr key={p.punch_id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium">{employeeName(employees, p.employee_id)}</td>
                  <td className="px-4 py-2">{p.court_name || '—'}</td>
                  <td className="px-4 py-2">{formatDateTime(p.punch_in_at)}</td>
                  <td className="px-4 py-2">{p.punch_out_at ? formatDateTime(p.punch_out_at) : <span className="text-amber-600">open</span>}</td>
                  <td className="px-4 py-2 text-slate-500">{p.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
