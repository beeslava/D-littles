import { inject } from '@angular/core';
import {
  Router,
  CanActivateFn,
} from '@angular/router';

import {
  AdminAuthService,
  AdminPermission,
} from './Auth/admin-auth.service';


// =========================================================
// ADMIN OR SUB-ADMIN GUARD
// =========================================================
//
// Allows:
// - Main Admin
// - Active Sub Admin
//
// Used when a route should be accessible to any
// authenticated administrator.
// =========================================================

export const adminGuard: CanActivateFn = async () => {
  const adminAuthService = inject(AdminAuthService);
  const router = inject(Router);

  const allowed =
    await adminAuthService.isAdminOrSubAdmin();

  if (allowed) {
    return true;
  }

  // Return a UrlTree instead of starting a second
  // navigation from inside the guard.
  return router.createUrlTree(['/admin']);
};


// =========================================================
// ADMIN PERMISSION GUARD
// =========================================================
//
// Main Admin:
// - Always allowed.
//
// Active Sub Admin:
// - Must have the requested permission.
//
// Examples:
//
// adminPermissionGuard('dashboard')
// adminPermissionGuard('students')
// adminPermissionGuard('fees')
// adminPermissionGuard('payments')
// adminPermissionGuard('results')
// =========================================================

export function adminPermissionGuard(
  permission: AdminPermission
): CanActivateFn {
  return async () => {
    const adminAuthService = inject(AdminAuthService);
    const router = inject(Router);

    // -----------------------------------------------------
    // MAIN ADMIN
    // -----------------------------------------------------
    //
    // Main Admin has unrestricted access to all
    // administrative modules.
    //
    if (await adminAuthService.isAdmin()) {
      return true;
    }


    // -----------------------------------------------------
    // SUB ADMIN / PERMISSION CHECK
    // -----------------------------------------------------
    //
    // hasPermission() is responsible for determining
    // whether the currently authenticated administrator
    // has this specific permission.
    //
    const allowed =
      await adminAuthService.hasPermission(permission);

    if (allowed) {
      return true;
    }


    // -----------------------------------------------------
    // UNAUTHORIZED
    // -----------------------------------------------------
    //
    // The user is authenticated but does not have
    // permission to access this module.
    //
    // Send them back to the admin dashboard.
    //
    return router.createUrlTree([
      '/admin/dashboard',
    ]);
  };
}


// =========================================================
// MAIN ADMIN ONLY GUARD
// =========================================================
//
// Allows ONLY the Main Administrator.
//
// Used for highly privileged administration areas such as:
//
// - Sub Admin management
// - Creating Sub Admin accounts
// - Editing Sub Admin permissions
// - Deactivating Sub Admin accounts
//
// A Sub Admin is blocked even if they have other
// administrative permissions.
// =========================================================

export const mainAdminGuard: CanActivateFn = async () => {
  const adminAuthService = inject(AdminAuthService);
  const router = inject(Router);

  const allowed =
    await adminAuthService.isAdmin();

  if (allowed) {
    return true;
  }

  // Sub Admin or unauthorized user.
  return router.createUrlTree([
    '/admin/dashboard',
  ]);
};

