import {
  Component,
  OnInit
} from '@angular/core';

import {
  NgIf,
  NgFor,
  DatePipe,
  DecimalPipe
} from '@angular/common';

import {
  RouterLink
} from '@angular/router';

import {
  SchoolAuthService,
  SchoolUser
} from '../../core/Auth/school-auth.service';
import { Result, SchoolClass, Student, StudentService } from '../../core/student.service';




@Component({
  selector: 'app-student-dashboard',
  standalone: true,

  imports: [
    NgIf,
    NgFor,
    DatePipe,
    RouterLink,
    DecimalPipe
  ],

  templateUrl: './student-dashboard.html',

  styleUrl: './student-dashboard.css'
})
export class StudentDashboard implements OnInit {

  // =========================================================
  // USER
  // =========================================================

  currentUser: SchoolUser | null = null;


  // =========================================================
  // STUDENT DATA
  // =========================================================

  student: Student | null = null;

  studentClass: SchoolClass | null = null;

  results: Result[] = [];


  // =========================================================
  // PAGE STATE
  // =========================================================

  loading = true;

  errorMessage = '';

  currentDate = new Date();


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(
    private schoolAuth: SchoolAuthService,
    private studentService: StudentService
  ) {}


  // =========================================================
  // INITIALIZE DASHBOARD
  // =========================================================

  async ngOnInit(): Promise<void> {

    try {

      this.currentUser =
        this.schoolAuth.getUserData();


      // -------------------------------------------------------
      // CHECK USER
      // -------------------------------------------------------

      if (!this.currentUser) {

        this.errorMessage =
          'Unable to load your account information.';

        return;
      }


      // -------------------------------------------------------
      // CHECK ROLE
      // -------------------------------------------------------

      if (
        this.currentUser.role !== 'student'
      ) {

        this.errorMessage =
          'This dashboard is only available to students.';

        return;
      }


      // -------------------------------------------------------
      // LOAD DASHBOARD DATA
      // -------------------------------------------------------

      await this.loadStudent();

    } catch (error) {

      console.error(
        'Student dashboard error:',
        error
      );

      this.errorMessage =
        'Unable to load your dashboard. Please try again.';

    } finally {

      this.loading = false;

    }

  }


  // =========================================================
  // LOAD STUDENT
  // =========================================================

  async loadStudent(): Promise<void> {

    if (!this.currentUser) {
      return;
    }


    try {

      const dashboardData =
        await this.studentService.getDashboardData(
          this.currentUser
        );


      // -------------------------------------------------------
      // CHECK STUDENT RECORD
      // -------------------------------------------------------

      if (!dashboardData.student) {

        this.errorMessage =
          'Your student record could not be found. Please contact the school administrator.';

        return;
      }


      // -------------------------------------------------------
      // STORE DATA
      // -------------------------------------------------------

      this.student =
        dashboardData.student;

      this.studentClass =
        dashboardData.studentClass;

      this.results =
        dashboardData.results;


    } catch (error) {

      console.error(
        'Error loading student data:',
        error
      );

      this.errorMessage =
        'Unable to load your student information. Please try again.';

    }

  }


  // =========================================================
  // RELOAD DASHBOARD
  // =========================================================

  async refreshDashboard(): Promise<void> {

    this.loading = true;

    this.errorMessage = '';

    try {

      this.currentUser =
        this.schoolAuth.getUserData();


      if (!this.currentUser) {

        this.errorMessage =
          'Unable to load your account information.';

        return;
      }


      await this.loadStudent();

    } catch (error) {

      console.error(
        'Dashboard refresh error:',
        error
      );

      this.errorMessage =
        'Unable to refresh your dashboard.';

    } finally {

      this.loading = false;

    }

  }


  // =========================================================
  // GET STUDENT DISPLAY NAME
  // =========================================================

  getStudentName(): string {

    if (!this.student) {

      return 'Student';

    }


    if (this.student.fullName) {

      return this.student.fullName;

    }


    return [
      this.student.firstName,
      this.student.middleName,
      this.student.lastName
    ]

      .filter(Boolean)

      .join(' ');

  }


  // =========================================================
  // GET CLASS DISPLAY NAME
  // =========================================================

  getClassName(): string {

    if (this.studentClass) {

      const className =
        this.studentClass.className || '';

      const section =
        this.studentClass.section || '';


      return section
        ? `${className} - ${section}`
        : className;

    }


    return (
      this.student?.className ||
      this.student?.class ||
      'Not assigned'
    );

  }


  // =========================================================
  // TOTAL PUBLISHED SUBJECTS
  // =========================================================

  get totalSubjects(): number {

    return this.results.length;

  }


  // =========================================================
  // AVERAGE RESULT
  // =========================================================

  get averageScore(): number {

    if (!this.results.length) {

      return 0;

    }


    const total =
      this.results.reduce(
        (sum, result) =>
          sum + (result.total || 0),
        0
      );


    return (
      total /
      this.results.length
    );

  }


  // =========================================================
  // LOGOUT
  // =========================================================

  async logout(): Promise<void> {

    try {

      await this.schoolAuth.logout();

      window.location.href =
        '/#/login';

    } catch (error) {

      console.error(
        'Student logout error:',
        error
      );

    }

  }

}