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
   * Sub Admins will have this set to false.
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
   * Main Admin receives every permission.
   *
   * Sub Admin receives only the permissions assigned
   * to their account.
   */
  permissions: Partial<
    Record<AdminPermission, boolean>
  > = {};


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
    // LOAD DASHBOARD STATISTICS
    // -------------------------------------------------------

    await this.loadDashboardStatistics();


    // -------------------------------------------------------
    // REFRESH UI
    // -------------------------------------------------------

    this.cdr.detectChanges();

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

    if (this.isMainAdmin) {

      return true;

    }


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

    // Do nothing if the account has no Academics access.

    if (!this.canSeeAcademics()) {

      return;

    }


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

      // -----------------------------------------------------
      // LOAD ADMISSIONS
      // -----------------------------------------------------

      /**
       * Only attempt to read admissions when the current
       * account actually has admissions permission.
       *
       * This is important because Firebase rules may deny
       * the read for a Sub Admin without this permission.
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


      // -----------------------------------------------------
      // STUDENTS
      // -----------------------------------------------------

      /**
       * Students statistics will be connected to the
       * students Firebase path.
       *
       * Only display/load it when permission exists.
       */
      if (
        this.canAccess('students')
      ) {

        this.totalStudents = 0;

      } else {

        this.totalStudents = 0;

      }


      // -----------------------------------------------------
      // STAFF
      // -----------------------------------------------------

      /**
       * Staff statistics will be connected to the
       * staff Firebase path.
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