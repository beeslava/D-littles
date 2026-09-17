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
  AdminAuthService
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

    await this.loadDashboardStatistics();

  }


  // =========================================================
  // TOGGLE ACADEMICS DROPDOWN
  // =========================================================

  toggleAcademics(): void {

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

      // -------------------------------------------------------
      // LOAD ADMISSIONS
      // -------------------------------------------------------

      const admissionsRef =
        ref(
          database,
          'admissions'
        );

      const admissionsSnapshot =
        await get(admissionsRef);


      // Reset values

      this.totalApplications = 0;

      this.pendingAdmissions = 0;


      if (admissionsSnapshot.exists()) {

        const data =
          admissionsSnapshot.val();


        const applications =
          Object.values(data) as any[];


        // Total applications

        this.totalApplications =
          applications.length;


        // Pending applications

        this.pendingAdmissions =
          applications.filter(
            application =>
              String(
                application?.status || 'pending'
              ).toLowerCase() === 'pending'
          ).length;

      }


      // -------------------------------------------------------
      // STUDENTS
      // -------------------------------------------------------

      // Students statistics will be connected
      // to the students Firebase path.

      this.totalStudents = 0;


      // -------------------------------------------------------
      // STAFF
      // -------------------------------------------------------

      // Staff statistics will be connected
      // to the staff Firebase path.

      this.totalStaff = 0;


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

    window.location.href = '/admin';

  }

}