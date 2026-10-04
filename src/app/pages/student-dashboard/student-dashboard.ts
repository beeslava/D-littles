import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import {
  NgIf,
  NgFor,
  DatePipe,
  DecimalPipe
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  Router,
  RouterLink
} from '@angular/router';

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';

import {
  auth
} from '../../core/firebase.config';

import {
  SchoolAuthService,
  SchoolUser
} from '../../core/Auth/school-auth.service';

import {
  Result,
  SchoolClass,
  Student,
  StudentService
} from '../../core/student.service';


@Component({
  selector: 'app-student-dashboard',

  standalone: true,

  imports: [
    NgIf,
    NgFor,
    DatePipe,
    RouterLink,
    DecimalPipe,
    FormsModule
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
  // CHANGE PASSWORD STATE
  // =========================================================

  showChangePassword = false;

  currentPassword = '';

  newPassword = '';

  confirmPassword = '';

  changingPassword = false;

  passwordSuccess = '';

  passwordError = '';


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(
    private schoolAuth: SchoolAuthService,
    private studentService: StudentService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}


  // =========================================================
  // INITIALIZE DASHBOARD
  // =========================================================

  async ngOnInit(): Promise<void> {

    try {

      // -------------------------------------------------------
      // WAIT FOR FIREBASE AUTH SESSION
      // -------------------------------------------------------

      await this.schoolAuth.waitForAuthReady();


      // -------------------------------------------------------
      // GET CURRENT USER DATA
      // -------------------------------------------------------

      this.currentUser =
        this.schoolAuth.getUserData();


      // -------------------------------------------------------
      // CHECK USER
      // -------------------------------------------------------

      if (!this.currentUser) {

        this.errorMessage =
          'Unable to load your account information.';

        this.loading = false;

        this.cdr.detectChanges();

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

        this.loading = false;

        this.cdr.detectChanges();

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

      this.cdr.detectChanges();

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

        this.cdr.detectChanges();

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


      // -------------------------------------------------------
      // CLEAR OLD ERROR
      // -------------------------------------------------------

      this.errorMessage = '';


      // -------------------------------------------------------
      // FORCE VIEW UPDATE
      // -------------------------------------------------------

      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Error loading student data:',
        error
      );

      this.errorMessage =
        'Unable to load your student information. Please try again.';

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // RELOAD DASHBOARD
  // =========================================================

  async refreshDashboard(): Promise<void> {

    this.loading = true;

    this.errorMessage = '';

    this.cdr.detectChanges();


    try {

      // -------------------------------------------------------
      // WAIT FOR AUTH SESSION
      // -------------------------------------------------------

      await this.schoolAuth.waitForAuthReady();


      // -------------------------------------------------------
      // GET CURRENT USER
      // -------------------------------------------------------

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
      // RELOAD DATA
      // -------------------------------------------------------

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

      this.cdr.detectChanges();

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
  // CHANGE PASSWORD
  // =========================================================

  async changePassword(): Promise<void> {

    // -------------------------------------------------------
    // PREVENT DOUBLE CLICK / DOUBLE SUBMISSION
    // -------------------------------------------------------

    if (this.changingPassword) {

      return;

    }


    // -------------------------------------------------------
    // CLEAR PREVIOUS MESSAGES
    // -------------------------------------------------------

    this.passwordSuccess = '';

    this.passwordError = '';


    // -------------------------------------------------------
    // VALIDATE CURRENT PASSWORD
    // -------------------------------------------------------

    if (!this.currentPassword.trim()) {

      this.passwordError =
        'Please enter your current password.';

      this.cdr.detectChanges();

      return;
    }


    // -------------------------------------------------------
    // VALIDATE NEW PASSWORD
    // -------------------------------------------------------

    if (!this.newPassword.trim()) {

      this.passwordError =
        'Please enter a new password.';

      this.cdr.detectChanges();

      return;
    }


    // -------------------------------------------------------
    // MINIMUM PASSWORD LENGTH
    // -------------------------------------------------------

    if (this.newPassword.length < 6) {

      this.passwordError =
        'Your new password must be at least 6 characters long.';

      this.cdr.detectChanges();

      return;
    }


    // -------------------------------------------------------
    // CHECK PASSWORD CONFIRMATION
    // -------------------------------------------------------

    if (
      this.newPassword !==
      this.confirmPassword
    ) {

      this.passwordError =
        'The new passwords do not match.';

      this.cdr.detectChanges();

      return;
    }


    // -------------------------------------------------------
    // CHECK FIREBASE USER
    // -------------------------------------------------------

    const user =
      auth.currentUser;


    if (!user) {

      this.passwordError =
        'Your session has expired. Please log in again.';

      this.cdr.detectChanges();

      return;
    }


    // -------------------------------------------------------
    // CHECK EMAIL
    // -------------------------------------------------------

    if (!user.email) {

      this.passwordError =
        'Your account email could not be found.';

      this.cdr.detectChanges();

      return;
    }


    // -------------------------------------------------------
    // START LOADING IMMEDIATELY
    // -------------------------------------------------------

    this.changingPassword = true;

    this.cdr.detectChanges();


    try {

      // -----------------------------------------------------
      // CREATE CURRENT PASSWORD CREDENTIAL
      // -----------------------------------------------------

      const credential =
        EmailAuthProvider.credential(
          user.email,
          this.currentPassword
        );


      // -----------------------------------------------------
      // RE-AUTHENTICATE USER
      // -----------------------------------------------------

      await reauthenticateWithCredential(
        user,
        credential
      );


      // -----------------------------------------------------
      // UPDATE PASSWORD
      // -----------------------------------------------------

      await updatePassword(
        user,
        this.newPassword
      );


      // -----------------------------------------------------
      // SUCCESS
      // -----------------------------------------------------

      this.passwordSuccess =
        'Your password has been changed successfully.';

      this.passwordError = '';


      // -----------------------------------------------------
      // CLEAR FORM
      // -----------------------------------------------------

      this.currentPassword = '';

      this.newPassword = '';

      this.confirmPassword = '';


      // -----------------------------------------------------
      // KEEP PASSWORD SECTION OPEN
      // -----------------------------------------------------

      this.showChangePassword = true;


    } catch (error: any) {

      console.error(
        'Change password error:',
        error
      );


      // -----------------------------------------------------
      // FIREBASE AUTH ERRORS
      // -----------------------------------------------------

      switch (error?.code) {

        case 'auth/wrong-password':

        case 'auth/invalid-credential':

          this.passwordError =
            'Your current password is incorrect.';

          break;


        case 'auth/weak-password':

          this.passwordError =
            'Your new password is too weak. Please use a stronger password.';

          break;


        case 'auth/requires-recent-login':

          this.passwordError =
            'For security, please log out and log in again before changing your password.';

          break;


        case 'auth/too-many-requests':

          this.passwordError =
            'Too many attempts. Please wait a while and try again.';

          break;


        default:

          this.passwordError =
            'Unable to change your password. Please check your current password and try again.';

          break;

      }

    } finally {

      // -----------------------------------------------------
      // STOP LOADING
      // -----------------------------------------------------

      this.changingPassword = false;


      // -----------------------------------------------------
      // FORCE UI UPDATE
      // -----------------------------------------------------

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // LOGOUT
  // =========================================================

 async logout(): Promise<void> {

  try {

    await this.schoolAuth.logout();

    await this.router.navigate(['/login']);

  } catch (error) {

    console.error(
      'Student logout error:',
      error
    );

  }

}

}