import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { EmployeeSummary } from '@/types/api';

export function useEmployees() {
  return useQuery({
    queryKey: ['users', 'employees'],
    queryFn: async (): Promise<EmployeeSummary[]> => {
      const { data, error } = await supabase.from('active_employees').select('id, name').order('name');
      if (error) throw error;
      return (data ?? []).map((row) => ({ userId: row.id as string, name: row.name as string }));
    },
    staleTime: 60_000
  });
}

export function employeeName(employees: EmployeeSummary[] | undefined, userId: string | null | undefined): string {
  if (!userId) return '—';
  return employees?.find((e) => e.userId === userId)?.name ?? userId;
}
