import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import {
  NgIf,
  NgFor,
  DecimalPipe
} from '@angular/common';

import {
  RouterLink
} from '@angular/router';

import {
  SchoolAuthService,
  SchoolUser
} from '../../core/Auth/school-auth.service';

import {
  Result,
  Student,
  StudentService
} from '../../core/student.service';


@Component({
  selector: 'app-parent-result',

  standalone: true,

  imports: [
    NgIf,
    NgFor,
    DecimalPipe,
    RouterLink
  ],

  templateUrl: './parent-results.html',

  styleUrl: './parent-results.css'
})
export class ParentResult implements OnInit {


  // =========================================================
  // CURRENT PARENT
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
  // RESULTS
  // =========================================================

  results: Result[] = [];

  selectedChildResults: Result[] = [];


  // =========================================================
  // PAGE STATE
  // =========================================================

  loading = true;

  loadingResults = false;

  errorMessage = '';

  successMessage = '';


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(
    private schoolAuth: SchoolAuthService,
    private studentService: StudentService,
    private cdr: ChangeDetectorRef
  ) {}


  // =========================================================
  // INITIALIZE
  // =========================================================

  async ngOnInit(): Promise<void> {

    try {

      await this.schoolAuth.waitForAuthReady();

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
      // CHECK PARENT ROLE
      // -------------------------------------------------------

      if (
        this.currentUser.role !== 'parent'
      ) {

        this.errorMessage =
          'This page is only available to parents.';

        return;
      }


      // -------------------------------------------------------
      // LOAD CHILDREN
      // -------------------------------------------------------

      await this.loadChildren();


    } catch (error) {

      console.error(
        'Parent result initialization error:',
        error
      );

      this.errorMessage =
        'Unable to load the results page. Please try again.';

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

      this.errorMessage = '';

      this.successMessage = '';


      console.log(
        'Loading children for parent Firebase UID:',
        this.currentUser.uid
      );


      // -------------------------------------------------------
      // GET CHILDREN
      // -------------------------------------------------------

      this.children =
        await this.studentService.getChildrenForParent(
          this.currentUser
        );


      console.log(
        'Children loaded for parent:',
        this.children
      );


      // -------------------------------------------------------
      // NO CHILDREN
      // -------------------------------------------------------

      if (!this.children.length) {

        this.selectedChild = null;

        this.results = [];

        this.selectedChildResults = [];

        this.errorMessage =
          'No student records are currently linked to your parent account.';

        return;
      }


      // -------------------------------------------------------
      // SELECT FIRST CHILD
      // -------------------------------------------------------

      this.selectedChild =
        this.children[0];


      console.log(
        'Selected child:',
        this.selectedChild
      );


      // -------------------------------------------------------
      // LOAD SELECTED CHILD RESULTS
      // -------------------------------------------------------

      await this.loadResults();


    } catch (error) {

      console.error(
        'Error loading parent children:',
        error
      );

      this.errorMessage =
        'Unable to load your children information.';

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


    this.errorMessage = '';

    this.successMessage = '';


    console.log(
      'Child selected:',
      child.studentId
    );


    await this.loadResults();

  }


  // =========================================================
  // LOAD RESULTS FOR SELECTED CHILD
  // =========================================================
  //
  // IMPORTANT:
  //
  // Parents are NOT allowed to query results by studentId
  // directly under the current Firebase security rules.
  //
  // The parent must query:
  //
  //     parentId == currentUser.uid
  //
  // Firebase therefore returns ONLY results belonging
  // to the logged-in parent.
  //
  // We then filter those results for the selected child.
  //
  // =========================================================

  async loadResults(): Promise<void> {

    if (
      !this.currentUser ||
      !this.selectedChild
    ) {

      console.warn(
        'Cannot load results: parent or child is missing.'
      );

      return;
    }


    const studentId =
      this.selectedChild.studentId;


    // -------------------------------------------------------
    // MAKE SURE STUDENT ID EXISTS
    // -------------------------------------------------------

    if (!studentId) {

      console.error(
        'Selected child does not have a studentId:',
        this.selectedChild
      );

      this.errorMessage =
        'This student does not have a valid Student ID.';

      return;
    }


    this.loadingResults = true;

    this.errorMessage = '';

    this.successMessage = '';

    this.results = [];

    this.selectedChildResults = [];


    this.cdr.detectChanges();


    try {

      console.log(
        'Loading results for parent Firebase UID:',
        this.currentUser.uid
      );

      console.log(
        'Selected child student ID:',
        studentId
      );


      // =====================================================
      // LOAD RESULTS USING PARENT FIREBASE UID
      // =====================================================
      //
      // This matches your Firebase rule:
      //
      // query.orderByChild === 'parentId'
      //
      // query.equalTo === auth.uid
      //
      // =====================================================

      this.results =
        await this.studentService.getChildrenResults(
          this.currentUser
        );


      console.log(
        'All published results returned for parent:',
        this.results
      );


      // =====================================================
      // NORMALIZE SELECTED STUDENT ID
      // =====================================================

      const selectedStudentId =
        String(studentId)
          .trim()
          .toUpperCase();


      // =====================================================
      // FILTER RESULTS FOR SELECTED CHILD
      // =====================================================

      this.selectedChildResults =
        this.results.filter(
          result => {

            const resultStudentId =
              String(
                result.studentId || ''
              )
                .trim()
                .toUpperCase();


            const resultStatus =
              String(
                result.status || ''
              )
                .trim()
                .toLowerCase();


            return (
              resultStudentId === selectedStudentId &&
              resultStatus === 'published'
            );

          }
        );


      console.log(
        'Published results for selected child:',
        selectedStudentId,
        this.selectedChildResults
      );


      // =====================================================
      // NO RESULTS
      // =====================================================

      if (
        !this.selectedChildResults.length
      ) {

        this.successMessage = '';

        console.log(
          'No published results found for student:',
          selectedStudentId
        );

      } else {

        console.log(
          `Found ${this.selectedChildResults.length} published result(s) for ${selectedStudentId}.`
        );

      }


    } catch (error) {

      console.error(
        'Error loading parent results:',
        error
      );

      this.errorMessage =
        'Unable to load this student\'s results. Please try again.';

    } finally {

      this.loadingResults = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // REFRESH RESULTS
  // =========================================================

  async refreshResults(): Promise<void> {

    if (this.loadingResults) {
      return;
    }

    await this.loadResults();

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
  // SELECTED CHILD NAME
  // =========================================================

  getSelectedChildName(): string {

    if (!this.selectedChild) {

      return 'Student';

    }


    return this.getChildName(
      this.selectedChild
    );

  }


  // =========================================================
  // CLASS NAME
  // =========================================================

  getClassName(
    child: Student | null
  ): string {

    if (!child) {

      return 'Not assigned';

    }


    return (
      child.className ||
      child.class ||
      'Not assigned'
    );

  }


  // =========================================================
  // RESULT COUNT
  // =========================================================

  get totalResults(): number {

    return this.selectedChildResults.length;

  }


  // =========================================================
  // AVERAGE SCORE
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
  // HIGHEST SCORE
  // =========================================================

  get highestScore(): number {

    if (
      !this.selectedChildResults.length
    ) {

      return 0;

    }


    return Math.max(

      ...this.selectedChildResults.map(
        result =>
          Number(result.total || 0)
      )

    );

  }


  // =========================================================
  // LOWEST SCORE
  // =========================================================

  get lowestScore(): number {

    if (
      !this.selectedChildResults.length
    ) {

      return 0;

    }


    return Math.min(

      ...this.selectedChildResults.map(
        result =>
          Number(result.total || 0)
      )

    );

  }


  // =========================================================
  // TRACK RESULTS
  // =========================================================

  trackResult(
    index: number,
    result: Result
  ): string {

    return (
      result.id ||
      `${result.studentId}-${index}`
    );

  }

}