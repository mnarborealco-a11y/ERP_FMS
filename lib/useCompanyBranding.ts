import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import { useAuth } from './auth';
import { contrastTextColor } from './contrastColor';

const DEFAULT_NAME = 'Master ERP';
const DEFAULT_COLOR_PRIMARY = '#547afd';
const DEFAULT_COLOR_SECONDARY = '#3d5fe0';

export interface CompanyBranding {
  companyId: string | null;
  name: string;
  logoUrl: string | null;
  colorPrimary: string;
  colorSecondary: string;
  textOnPrimary: '#000000' | '#ffffff';
  textOnSecondary: '#000000' | '#ffffff';
}

const defaultBranding: CompanyBranding = {
  companyId: null,
  name: DEFAULT_NAME,
  logoUrl: '/master-erp-logo.png',
  colorPrimary: DEFAULT_COLOR_PRIMARY,
  colorSecondary: DEFAULT_COLOR_SECONDARY,
  textOnPrimary: contrastTextColor(DEFAULT_COLOR_PRIMARY),
  textOnSecondary: contrastTextColor(DEFAULT_COLOR_SECONDARY)
};

// SUPER_ADMIN has no companyId, so this naturally falls back to the default
// Master ERP look for that role -- no special-casing needed.
export function useCompanyBranding() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['company', 'branding', user?.companyId],
    enabled: !!user?.companyId,
    queryFn: async (): Promise<CompanyBranding> => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, logo_url, color_primary, color_secondary')
        .eq('id', user!.companyId!)
        .single();
      if (error) throw error;
      const colorPrimary = data.color_primary || DEFAULT_COLOR_PRIMARY;
      const colorSecondary = data.color_secondary || DEFAULT_COLOR_SECONDARY;
      return {
        companyId: data.id,
        name: data.name,
        logoUrl: data.logo_url,
        colorPrimary,
        colorSecondary,
        textOnPrimary: contrastTextColor(colorPrimary),
        textOnSecondary: contrastTextColor(colorSecondary)
      };
    },
    staleTime: 60_000,
    placeholderData: defaultBranding
  });
}

export { defaultBranding };
