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
  selector: 'app-parent-dashboard',

  standalone: true,

  imports: [
    NgIf,
    NgFor,
    DatePipe,
    DecimalPipe,
    RouterLink,
    FormsModule
  ],

  templateUrl: './parent-dashboard.html',

  styleUrl: './parent-dashboard.css'
})
export class ParentDashboard implements OnInit {


  // =========================================================
  // PARENT USER
  // =========================================================

  currentUser: SchoolUser | null = null;


  // =========================================================
  // CHILDREN
  // =========================================================

  children: Student[] = [];


  // =========================================================
  // SELECTED CHILD
  // =========================================================

  selectedChild: Student | null = null;


  // =========================================================
  // SELECTED CHILD CLASS
  // =========================================================

  selectedChildClass: SchoolClass | null = null;


  // =========================================================
  // SELECTED CHILD RESULTS
  // =========================================================

  selectedChildResults: Result[] = [];


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

      await this.schoolAuth.waitForAuthReady();

      this.currentUser =
        this.schoolAuth.getUserData();


      if (!this.currentUser) {

        this.errorMessage =
          'Unable to load your account information.';

        return;
      }


      if (
        this.currentUser.role !== 'parent'
      ) {

        this.errorMessage =
          'This dashboard is only available to parents.';

        return;
      }


      await this.loadChildren();

    } catch (error) {

      console.error(
        'Parent dashboard error:',
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
  // LOAD CHILDREN
  // =========================================================

  async loadChildren(): Promise<void> {

    if (!this.currentUser) {
      return;
    }

    try {

      this.children =
        await this.studentService.getChildrenForParent(
          this.currentUser
        );


      // -------------------------------------------------------
      // NO CHILDREN
      // -------------------------------------------------------

      if (!this.children.length) {

        this.selectedChild = null;

        this.selectedChildClass = null;

        this.selectedChildResults = [];

        this.errorMessage =
          'No student records are currently linked to your parent account.';

        return;
      }


      // -------------------------------------------------------
      // CLEAR ERROR
      // -------------------------------------------------------

      this.errorMessage = '';


      // -------------------------------------------------------
      // SELECT FIRST CHILD
      // -------------------------------------------------------

      this.selectedChild =
        this.children[0];


      // -------------------------------------------------------
      // LOAD CHILD DATA
      // -------------------------------------------------------

      await this.loadChildData(
        this.selectedChild
      );

    } catch (error) {

      console.error(
        'Error loading parent children:',
        error
      );

      this.errorMessage =
        'Unable to load your children information.';

    } finally {

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // SELECT CHILD
  // =========================================================

  async selectChild(
    child: Student
  ): Promise<void> {

    if (!child) {
      return;
    }

    this.selectedChild =
      child;

    await this.loadChildData(
      child
    );

  }


  // =========================================================
  // LOAD SELECTED CHILD DATA
  // =========================================================

  async loadChildData(
    child: Student
  ): Promise<void> {

    if (!child) {
      return;
    }

    try {

      // -------------------------------------------------------
      // RESET
      // -------------------------------------------------------

      this.selectedChildClass = null;

      this.selectedChildResults = [];


      // -------------------------------------------------------
      // LOAD CLASS
      // -------------------------------------------------------

      if (
        child.classId &&
        child.classId.trim()
      ) {

        this.selectedChildClass =
          await this.studentService.getStudentClass(
            child.classId
          );

      }


      // -------------------------------------------------------
      // FALLBACK CLASS
      // -------------------------------------------------------

      if (
        !this.selectedChildClass &&
        (
          child.className ||
          child.class
        )
      ) {

        const className =
          child.className ||
          child.class ||
          '';


        this.selectedChildClass = {

          id:
            child.classId ||
            className,

          className

        };

      }


      // -------------------------------------------------------
      // LOAD RESULTS
      // -------------------------------------------------------

      if (
        this.currentUser?.uid &&
        (
          child.studentId ||
          child.id
        )
      ) {

        console.log(
          '================================================'
        );

        console.log(
          'PARENT RESULT LOAD'
        );

        console.log(
          'Parent Firebase UID:',
          this.currentUser.uid
        );

        console.log(
          'Child school studentId:',
          child.studentId
        );

        console.log(
          'Child Firebase record ID:',
          child.id
        );

        console.log(
          '================================================'
        );


        // -----------------------------------------------------
        // GET ALL PUBLISHED RESULTS FOR PARENT'S CHILDREN
        // -----------------------------------------------------

        const allResults =
          await this.studentService.getChildrenResults(
            this.currentUser
          );


        // -----------------------------------------------------
        // NORMALIZE CHILD IDS
        // -----------------------------------------------------

        const schoolStudentId =
          String(
            child.studentId || ''
          )
            .trim()
            .toUpperCase();


        const studentRecordId =
          String(
            child.id || ''
          )
            .trim()
            .toUpperCase();


        // -----------------------------------------------------
        // SELECT THIS CHILD'S RESULTS
        // -----------------------------------------------------

        this.selectedChildResults =
          allResults.filter(
            result => {

              const resultStudentId =
                String(
                  result.studentId || ''
                )
                  .trim()
                  .toUpperCase();


              const resultRecordId =
                String(
                  result.studentRecordId || ''
                )
                  .trim()
                  .toUpperCase();


              return (
                resultStudentId ===
                  schoolStudentId ||

                resultStudentId ===
                  studentRecordId ||

                resultRecordId ===
                  studentRecordId
              );

            }
          );


        console.log(
          '================================================'
        );

        console.log(
          'RESULTS LOADED FOR CHILD:',
          child.studentId
        );

        console.log(
          'Selected child results:',
          this.selectedChildResults
        );

        console.log(
          'Selected result count:',
          this.selectedChildResults.length
        );

        console.log(
          '================================================'
        );

      }


    } catch (error) {

      console.error(
        'Error loading child data:',
        error
      );

      this.errorMessage =
        'Unable to load this student information.';

    } finally {

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // REFRESH DASHBOARD
  // =========================================================

  async refreshDashboard(): Promise<void> {

    this.loading = true;

    this.errorMessage = '';

    this.cdr.detectChanges();


    try {

      await this.schoolAuth.waitForAuthReady();

      this.currentUser =
        this.schoolAuth.getUserData();


      if (!this.currentUser) {

        this.errorMessage =
          'Unable to load your account information.';

        return;
      }


      if (
        this.currentUser.role !== 'parent'
      ) {

        this.errorMessage =
          'This dashboard is only available to parents.';

        return;
      }


      await this.loadChildren();

    } catch (error) {

      console.error(
        'Parent dashboard refresh error:',
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
  // PARENT NAME
  // =========================================================

  getParentName(): string {

    return (
      this.currentUser?.fullName ||
      'Parent'
    );

  }


  // =========================================================
  // CHILD NAME
  // =========================================================

  getChildName(
    child: Student
  ): string {

    if (child.fullName) {
      return child.fullName;
    }

    return [

      child.firstName,

      child.middleName,

      child.lastName

    ]
      .filter(Boolean)
      .join(' ') ||

      'Student';

  }


  // =========================================================
  // SELECTED CHILD CLASS NAME
  // =========================================================

  getSelectedClassName(): string {

    if (this.selectedChildClass) {

      const className =
        this.selectedChildClass.className ||
        '';

      const section =
        this.selectedChildClass.section ||
        '';

      return section
        ? `${className} - ${section}`
        : className;

    }


    return (
      this.selectedChild?.className ||
      this.selectedChild?.class ||
      'Not assigned'
    );

  }


  // =========================================================
  // CHILD RESULT COUNT
  // =========================================================

  get totalResults(): number {

    return this.selectedChildResults.length;

  }


  // =========================================================
  // CHILD AVERAGE SCORE
  // =========================================================

  get averageScore(): number {

    if (
      !this.selectedChildResults.length
    ) {

      return 0;

    }


    const total =
      this.selectedChildResults.reduce(

        (sum, result) =>

          sum +
          Number(result.total || 0),

        0

      );


    return (
      total /
      this.selectedChildResults.length
    );

  }


  // =========================================================
  // CHANGE PASSWORD
  // =========================================================

  async changePassword(): Promise<void> {

    if (this.changingPassword) {
      return;
    }


    this.passwordSuccess = '';

    this.passwordError = '';


    // -------------------------------------------------------
    // CURRENT PASSWORD
    // -------------------------------------------------------

    if (!this.currentPassword.trim()) {

      this.passwordError =
        'Please enter your current password.';

      this.cdr.detectChanges();

      return;

    }


    // -------------------------------------------------------
    // NEW PASSWORD
    // -------------------------------------------------------

    if (!this.newPassword.trim()) {

      this.passwordError =
        'Please enter a new password.';

      this.cdr.detectChanges();

      return;

    }


    // -------------------------------------------------------
    // PASSWORD LENGTH
    // -------------------------------------------------------

    if (
      this.newPassword.length < 6
    ) {

      this.passwordError =
        'Your new password must be at least 6 characters long.';

      this.cdr.detectChanges();

      return;

    }


    // -------------------------------------------------------
    // CONFIRM PASSWORD
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
    // FIREBASE USER
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
    // EMAIL
    // -------------------------------------------------------

    if (!user.email) {

      this.passwordError =
        'Your account email could not be found.';

      this.cdr.detectChanges();

      return;

    }


    this.changingPassword = true;

    this.cdr.detectChanges();


    try {

      const credential =
        EmailAuthProvider.credential(
          user.email,
          this.currentPassword
        );


      await reauthenticateWithCredential(
        user,
        credential
      );


      await updatePassword(
        user,
        this.newPassword
      );


      this.passwordSuccess =
        'Your password has been changed successfully.';

      this.passwordError = '';

      this.currentPassword = '';

      this.newPassword = '';

      this.confirmPassword = '';

      this.showChangePassword = false;


    } catch (error: any) {

      console.error(
        'Parent change password error:',
        error
      );


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

      this.changingPassword = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // LOGOUT
  // =========================================================

  async logout(): Promise<void> {

    try {

      await this.schoolAuth.logout();

      await this.router.navigate([
        '/home'
      ]);

    } catch (error) {

      console.error(
        'Parent logout error:',
        error
      );

    }

  }

}

