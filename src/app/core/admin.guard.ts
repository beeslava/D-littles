import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

import {
  AdminAuthService,
  AdminPermission,
} from './Auth/admin-auth.service';

/**
 * =========================================================
 * ADMIN OR SUB-ADMIN GUARD
 * =========================================================
 *
 * Allows:
 * - Main admin
 * - Active sub-admin
 *
 * Used for the general /admin area.
 */
export const adminGuard: CanActivateFn = async () => {
  const adminAuthService = inject(AdminAuthService);
  const router = inject(Router);

  const allowed =
    await adminAuthService.isAdminOrSubAdmin();

  if (allowed) {
    return true;
  }

  await router.navigate(['/admin']);

  return false;
};


/**
 * =========================================================
 * PERMISSION GUARD
 * =========================================================
 *
 * Main admin:
 * - Always allowed.
 *
 * Sub-admin:
 * - Must have the requested permission.
 *
 * Example:
 *
 * adminPermissionGuard('students')
 * adminPermissionGuard('fees')
 * adminPermissionGuard('results')
 */
export function adminPermissionGuard(
  permission: AdminPermission
): CanActivateFn {
  return async () => {
    const adminAuthService = inject(AdminAuthService);
    const router = inject(Router);

    // Main admin has unrestricted access.
    if (await adminAuthService.isAdmin()) {
      return true;
    }

    // Sub-admin must have the specific permission.
    const allowed =
      await adminAuthService.hasPermission(permission);

    if (allowed) {
      return true;
    }

    await router.navigate([
      '/admin/dashboard',
    ]);

    return false;
  };
}


/**
 * =========================================================
 * MAIN ADMIN ONLY GUARD
 * =========================================================
 *
 * Allows ONLY the main administrator.
 *
 * This is used for sensitive administration areas such as:
 *
 * - Sub Admin management
 * - Creating sub-admin accounts
 * - Editing sub-admin permissions
 * - Deactivating sub-admin accounts
 *
 * Sub-admins are deliberately blocked even if they have
 * other administrative permissions.
 */
export const mainAdminGuard: CanActivateFn = async () => {
  const adminAuthService = inject(AdminAuthService);
  const router = inject(Router);

  const allowed =
    await adminAuthService.isAdmin();

  if (allowed) {
    return true;
  }

  await router.navigate([
    '/admin/dashboard',
  ]);

  return false;
};