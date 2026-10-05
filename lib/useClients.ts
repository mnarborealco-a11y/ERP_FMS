import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { EmployeeSummary } from '@/types/api';

export function useClients() {
  return useQuery({
    queryKey: ['users', 'clients'],
    queryFn: async (): Promise<EmployeeSummary[]> => {
      const { data, error } = await supabase.from('active_clients').select('id, name').order('name');
      if (error) throw error;
      return (data ?? []).map((row) => ({ userId: row.id as string, name: row.name as string }));
    },
    staleTime: 60_000
  });
}

export function clientName(clients: EmployeeSummary[] | undefined, userId: string | null | undefined): string {
  if (!userId) return '—';
  return clients?.find((c) => c.userId === userId)?.name ?? userId;
}
