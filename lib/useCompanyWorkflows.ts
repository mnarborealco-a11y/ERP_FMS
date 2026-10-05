import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import { useAuth } from './auth';

export interface CompanyWorkflowNavItem {
  key: string;
  name: string;
  entityLabel: string;
}

// Drives the AppShell's per-workflow nav links from data instead of
// hardcoding each workflow -- so a newly assigned workflow just appears here
// without a code change. Additive alongside the legacy Matters/Court
// Appearances links until those are retired at Phase 2 cutover.
export function useCompanyWorkflows() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['company', 'workflows', user?.companyId],
    enabled: !!user?.companyId,
    queryFn: async (): Promise<CompanyWorkflowNavItem[]> => {
      const { data, error } = await supabase
        .from('company_workflow_assignments')
        .select('workflow_id, workflow_definitions(key, name, entity_label, status)')
        .eq('company_id', user!.companyId!)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? [])
        .map((row) => row.workflow_definitions)
        .filter((w) => !!w && w.status === 'ACTIVE')
        .map((w) => ({ key: w!.key, name: w!.name, entityLabel: w!.entity_label }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 60_000
  });
}
