'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useEmployees, employeeName } from '@/lib/useEmployees';
import { Card, EmptyState, LoadingState, PageHeader, Select, formatDate } from '@/components/ui';
import type { CourtAppearance } from '@/types/api';

export default function AdminCourtAppearancesPage() {
  const { data: employees } = useEmployees();
  const [employeeId, setEmployeeId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['court', 'listAll', employeeId],
    queryFn: async (): Promise<CourtAppearance[]> => {
      let query = supabase.from('court_appearances').select('*').order('appearance_date', { ascending: false });
      if (employeeId) query = query.eq('employee_id', employeeId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const appearances = data ?? [];

  return (
    <div>
      <PageHeader
        title="Court Appearances"
        actions={
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-52">
            <option value="">All users</option>
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
      ) : appearances.length === 0 ? (
        <EmptyState message="No court appearances logged." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Matter</th>
                <th className="px-4 py-2">Court</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {appearances.map((a) => (
                <tr key={a.appearance_id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium">{employeeName(employees, a.employee_id)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/matters/${a.matter_id}`} className="hover:underline">
                      {a.matter_id}
                    </Link>
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
