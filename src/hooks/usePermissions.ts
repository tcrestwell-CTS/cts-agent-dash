import { useIsAdmin, useIsOfficeAdmin, useIsBookkeeper } from "@/hooks/useAdmin";

export interface Permissions {
  isAdmin: boolean;
  isOfficeAdmin: boolean;
  isBookkeeper: boolean;
  canApproveBookings: boolean;
  canEditSettings: boolean;
  canViewFinancials: boolean;
  canManageTeam: boolean;
  canViewTeam: boolean;
  isLoading: boolean;
}

export function usePermissions(): Permissions {
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: isOfficeAdmin, isLoading: officeAdminLoading } = useIsOfficeAdmin();
  const { data: isBookkeeper, isLoading: bookkeeperLoading } = useIsBookkeeper();

  const isLoading = adminLoading || officeAdminLoading || bookkeeperLoading;

  return {
    isAdmin: !!isAdmin,
    isOfficeAdmin: !!isOfficeAdmin,
    isBookkeeper: !!isBookkeeper,
    canApproveBookings: !!isAdmin,
    canEditSettings: !!isAdmin,
    canViewFinancials: !!isAdmin || !!isOfficeAdmin || !!isBookkeeper,
    canManageTeam: !!isAdmin,
    canViewTeam: !!isAdmin || !!isOfficeAdmin || !!isBookkeeper,
    isLoading,
  };
}
