import {
  ChangeDetectorRef,
  Component
} from '@angular/core';

import {
  RouterLink,
  RouterLinkActive
} from '@angular/router';

import {
  get,
  ref
} from 'firebase/database';

import { database } from '../../../core/firebase.config';

import {
  AdminAuthService,
  AdminPermission
} from '../../../core/Auth/admin-auth.service';

import {
  CommonModule,
  NgIf
} from '@angular/common';


@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    CommonModule,
    NgIf
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard {

  // =========================================================
  // ADMIN
  // =========================================================

  adminName = 'Administrator';


  /**
   * True only for the Main Administrator.
   *
   * Main Administrator:
   * - Can see all sidebar modules.
   * - Can manage Sub Admins.
   *
   * Sub Admin:
   * - Can only see assigned modules.
   */
  isMainAdmin = false;


  /**
   * True when the current account is a Sub Admin.
   */
  isSubAdmin = false;


  // =========================================================
  // PERMISSIONS
  // =========================================================

  /**
   * Permissions assigned to the current account.
   *
   * Main Admin:
   * Every permission is treated as allowed.
   *
   * Sub Admin:
   * Only permissions explicitly set to true are allowed.
   */
  permissions: Partial<
    Record<AdminPermission, boolean>
  > = {};


  /**
   * True after the permission/account information
   * has finished loading.
   *
   * This prevents the sidebar from briefly displaying
   * incorrect items while permissions are loading.
   */
  permissionsLoaded = false;


  // =========================================================
  // ACADEMICS DROPDOWN
  // =========================================================

  academicsOpen = false;


  // =========================================================
  // DASHBOARD STATISTICS
  // =========================================================

  totalStudents = 0;

  totalApplications = 0;

  pendingAdmissions = 0;

  totalStaff = 0;


  // =========================================================
  // LOADING
  // =========================================================

  loading = false;

  errorMessage = '';


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly cdr: ChangeDetectorRef
  ) {

    const user =
      this.adminAuthService.getUser();


    if (user?.email) {

      this.adminName =
        user.email;

    }

  }


  // =========================================================
  // INIT
  // =========================================================

  async ngOnInit(): Promise<void> {

    try {

      // -------------------------------------------------------
      // LOAD CURRENT ADMIN PROFILE
      // -------------------------------------------------------

      const userData =
        this.adminAuthService.getUserData();


      if (userData?.fullName) {

        this.adminName =
          userData.fullName;

      } else if (userData?.email) {

        this.adminName =
          userData.email;

      }


      // -------------------------------------------------------
      // DETERMINE ACCOUNT TYPE
      // -------------------------------------------------------

      this.isMainAdmin =
        await this.adminAuthService.isAdmin();


      this.isSubAdmin =
        await this.adminAuthService.isSubAdmin();


      // -------------------------------------------------------
      // LOAD PERMISSIONS
      // -------------------------------------------------------

      this.permissions =
        await this.adminAuthService.getPermissions();


      // -------------------------------------------------------
      // PERMISSIONS ARE NOW READY
      // -------------------------------------------------------

      this.permissionsLoaded = true;


      // -------------------------------------------------------
      // LOAD DASHBOARD STATISTICS
      // -------------------------------------------------------

      await this.loadDashboardStatistics();


      // -------------------------------------------------------
      // REFRESH UI
      // -------------------------------------------------------

      this.cdr.detectChanges();

    } catch (error) {

      console.error(
        'Failed to initialize admin dashboard:',
        error
      );


      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to load administrator information.';


      /**
       * We still mark permissions as loaded so that the
       * application does not remain permanently stuck
       * in a loading state.
       */
      this.permissionsLoaded = true;


      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // PERMISSION CHECK
  // =========================================================

  /**
   * Determines whether the current account can see
   * a particular sidebar item.
   *
   * Main Admin:
   *   Always true.
   *
   * Sub Admin:
   *   Only true when their permission is explicitly true.
   */
  canAccess(
    permission: AdminPermission
  ): boolean {

    // -------------------------------------------------------
    // MAIN ADMIN
    // -------------------------------------------------------

    if (this.isMainAdmin) {

      return true;

    }


    // -------------------------------------------------------
    // PERMISSIONS NOT LOADED YET
    // -------------------------------------------------------

    if (!this.permissionsLoaded) {

      return false;

    }


    // -------------------------------------------------------
    // SUB ADMIN
    // -------------------------------------------------------

    return (
      this.permissions[permission] === true
    );

  }


  // =========================================================
  // ACADEMICS VISIBILITY
  // =========================================================

  /**
   * Academics is a parent/dropdown navigation item.
   *
   * It should appear when the user has access to:
   *
   * - Academics
   * - Results
   *
   * Main Admin automatically sees it.
   */
  canSeeAcademics(): boolean {

    // -------------------------------------------------------
    // MAIN ADMIN
    // -------------------------------------------------------

    if (this.isMainAdmin) {

      return true;

    }


    // -------------------------------------------------------
    // SUB ADMIN
    // -------------------------------------------------------

    return (
      this.canAccess('academics') ||
      this.canAccess('results')
    );

  }


  // =========================================================
  // ACADEMIC MANAGEMENT VISIBILITY
  // =========================================================

  canSeeAcademicManagement(): boolean {

    return this.canAccess(
      'academics'
    );

  }


  // =========================================================
  // ACADEMIC RESULTS VISIBILITY
  // =========================================================

  canSeeAcademicResults(): boolean {

    return this.canAccess(
      'results'
    );

  }


  // =========================================================
  // REPORT CARDS VISIBILITY
  // =========================================================

  /**
   * Report Cards currently uses the existing
   * "results" permission because there is no separate
   * reportCards permission in AdminPermission.
   */
  canSeeReportCards(): boolean {

    return this.canAccess(
      'results'
    );

  }


  // =========================================================
  // TOGGLE ACADEMICS DROPDOWN
  // =========================================================

  toggleAcademics(): void {

    // -------------------------------------------------------
    // SAFETY CHECK
    // -------------------------------------------------------

    if (!this.canSeeAcademics()) {

      return;

    }


    // -------------------------------------------------------
    // TOGGLE
    // -------------------------------------------------------

    this.academicsOpen =
      !this.academicsOpen;

  }


  // =========================================================
  // LOAD DASHBOARD STATISTICS
  // =========================================================

  async loadDashboardStatistics(): Promise<void> {

    if (this.loading) {

      return;

    }


    this.loading = true;

    this.errorMessage = '';


    try {

      // =====================================================
      // ADMISSIONS
      // =====================================================

      /**
       * Only read admissions when the current account
       * has admissions permission.
       *
       * This prevents a Sub Admin without admissions
       * permission from attempting an unauthorized
       * Firebase read.
       */

      if (
        this.canAccess('admissions')
      ) {

        const admissionsRef =
          ref(
            database,
            'admissions'
          );


        const admissionsSnapshot =
          await get(admissionsRef);


        this.totalApplications = 0;

        this.pendingAdmissions = 0;


        if (
          admissionsSnapshot.exists()
        ) {

          const data =
            admissionsSnapshot.val();


          const applications =
            Object.values(data) as any[];


          this.totalApplications =
            applications.length;


          this.pendingAdmissions =
            applications.filter(
              application =>
                String(
                  application?.status ||
                  'pending'
                ).toLowerCase() === 'pending'
            ).length;

        }

      } else {

        this.totalApplications = 0;

        this.pendingAdmissions = 0;

      }


      // =====================================================
      // STUDENTS
      // =====================================================

      /**
       * Only load student statistics when the account
       * has the Students permission.
       *
       * The actual student statistics can be connected
       * here when required.
       */

      if (
        this.canAccess('students')
      ) {

        this.totalStudents = 0;

      } else {

        this.totalStudents = 0;

      }


      // =====================================================
      // STAFF
      // =====================================================

      /**
       * Only load staff statistics when the account
       * has the Staff permission.
       *
       * The actual staff statistics can be connected
       * here when required.
       */

      if (
        this.canAccess('staff')
      ) {

        this.totalStaff = 0;

      } else {

        this.totalStaff = 0;

      }


    } catch (error) {

      console.error(
        'Failed to load dashboard statistics:',
        error
      );


      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to load dashboard statistics.';


    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // LOGOUT
  // =========================================================

  async logout(): Promise<void> {

    await this.adminAuthService.logout();

    window.location.href =
      '/admin';

  }

}