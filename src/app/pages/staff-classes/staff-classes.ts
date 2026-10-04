import {
  NgFor,
  NgIf
} from '@angular/common';

import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import {
  Router,
  RouterLink
} from '@angular/router';

import {
  get,
  ref
} from 'firebase/database';

import {
  SchoolAuthService,
  SchoolUser
} from '../../core/Auth/school-auth.service';

import {
  database
} from '../../core/firebase.config';


// =====================================================
// SCHOOL CLASS
// =====================================================

interface SchoolClass {

  id: string;

  classCode: string;

  className: string;

  section: string;

  classTeacherId: string;

  classTeacherName: string;

  room: string;

  capacity: number;

  academicYear: string;

  status: string;

  description: string;

}


// =====================================================
// TEACHING ASSIGNMENT
// =====================================================

interface TeachingAssignment {

  id: string;

  classId: string;

  subjectId: string;

  teacherId: string;

  className: string;

  subjectName: string;

  teacherName: string;

}


// =====================================================
// COMPONENT
// =====================================================

@Component({

  selector: 'app-staff-classes',

  standalone: true,

  imports: [
    NgIf,
    NgFor,
    RouterLink
  ],

  templateUrl: './staff-classes.html',

  styleUrl: './staff-classes.css'

})


export class StaffClasses implements OnInit {


  // =====================================================
  // CURRENT USER
  // =====================================================

  currentUser: SchoolUser | null = null;


  // =====================================================
  // CLASSES
  // =====================================================

  myClasses: SchoolClass[] = [];


  // =====================================================
  // ASSIGNMENTS
  // =====================================================

  assignments: TeachingAssignment[] = [];


  // =====================================================
  // UI
  // =====================================================

  loading = true;

  errorMessage = '';


  // =====================================================
  // CONSTRUCTOR
  // =====================================================

  constructor(

    private readonly authService: SchoolAuthService,

    private readonly router: Router,

    private readonly cdr: ChangeDetectorRef

  ) {}


  // =====================================================
  // INIT
  // =====================================================

  ngOnInit(): void {

    this.currentUser =
      this.authService.getUserData();

    this.loadClasses();

  }


  // =====================================================
  // LOAD CLASSES
  // =====================================================

  async loadClasses(): Promise<void> {

    this.loading = true;

    this.errorMessage = '';


    try {

      // -------------------------------------------------
      // USER
      // -------------------------------------------------

      this.currentUser =
        this.authService.getUserData();


      if (!this.currentUser) {

        await this.authService.waitForAuthReady();

        this.currentUser =
          this.authService.getUserData();

      }


      if (!this.currentUser) {

        this.router.navigate(['/login']);

        return;

      }


      if (
        this.currentUser.role !== 'staff'
      ) {

        this.router.navigate(['/login']);

        return;

      }


      if (
        !this.currentUser.staffId
      ) {

        this.errorMessage =
          'Your account is not linked to a staff member. Please contact the school administrator.';

        return;

      }


      // -------------------------------------------------
      // FIND STAFF RECORD
      // -------------------------------------------------

      const staffSnapshot =
        await get(
          ref(
            database,
            'staff'
          )
        );


      if (!staffSnapshot.exists()) {

        this.errorMessage =
          'Staff information could not be found.';

        return;

      }


      const staffData =
        staffSnapshot.val();


      const staffEntry =
        (
          Object.entries(
            staffData
          ) as [string, any][]
        ).find(
          ([id, value]) =>
            value?.staffId ===
            this.currentUser!.staffId
        );


      if (!staffEntry) {

        this.errorMessage =
          'Your staff record could not be found. Please contact the school administrator.';

        return;

      }


      const staffRecordId =
        staffEntry[0];


      // -------------------------------------------------
      // LOAD TEACHING ASSIGNMENTS
      // -------------------------------------------------

      const assignmentSnapshot =
        await get(
          ref(
            database,
            'teachingAssignments'
          )
        );


      if (
        !assignmentSnapshot.exists()
      ) {

        this.assignments = [];

        this.myClasses = [];

        return;

      }


      const assignmentData =
        assignmentSnapshot.val();


      this.assignments =
        (
          Object.entries(
            assignmentData
          ) as [string, any][]
        )
        .map(
          ([id, value]) => ({

            id,

            classId:
              value?.classId ||
              '',

            subjectId:
              value?.subjectId ||
              '',

            teacherId:
              value?.teacherId ||
              '',

            className:
              value?.className ||
              '',

            subjectName:
              value?.subjectName ||
              '',

            teacherName:
              value?.teacherName ||
              ''

          })
        )
        .filter(
          assignment =>
            assignment.teacherId ===
            staffRecordId
        );


      // -------------------------------------------------
      // NO ASSIGNMENTS
      // -------------------------------------------------

      if (
        this.assignments.length === 0
      ) {

        this.myClasses = [];

        return;

      }


      // -------------------------------------------------
      // GET UNIQUE CLASS IDS
      // -------------------------------------------------

      const classIds =
        new Set(
          this.assignments
            .map(
              assignment =>
                assignment.classId
            )
            .filter(
              classId =>
                !!classId
            )
        );


      // -------------------------------------------------
      // LOAD CLASSES
      // -------------------------------------------------

      const classSnapshot =
        await get(
          ref(
            database,
            'classes'
          )
        );


      if (
        !classSnapshot.exists()
      ) {

        this.myClasses = [];

        return;

      }


      const classData =
        classSnapshot.val();


      const classes: SchoolClass[] = [];


      (
        Object.entries(
          classData
        ) as [string, any][]
      ).forEach(
        ([id, value]) => {

          if (
            value?.status ===
            'inactive'
          ) {

            return;

          }


          if (
            !classIds.has(id)
          ) {

            return;

          }


          classes.push({

            id,

            classCode:
              value?.classCode ||
              '',

            className:
              value?.className ||
              '',

            section:
              value?.section ||
              '',

            classTeacherId:
              value?.classTeacherId ||
              '',

            classTeacherName:
              value?.classTeacherName ||
              '',

            room:
              value?.room ||
              '',

            capacity:
              Number(
                value?.capacity || 0
              ),

            academicYear:
              value?.academicYear ||
              '',

            status:
              value?.status ||
              'active',

            description:
              value?.description ||
              ''

          });

        }
      );


      // -------------------------------------------------
      // SORT
      // -------------------------------------------------

      classes.sort(
        (a, b) =>
          a.className.localeCompare(
            b.className
          )
      );


      this.myClasses = classes;


    } catch (error) {

      console.error(
        'Error loading staff classes:',
        error
      );


      this.errorMessage =
        'Unable to load your classes. Please try again.';


    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // GET SUBJECTS FOR CLASS
  // =====================================================

  getSubjectsForClass(
    classId: string
  ): string[] {

    return this.assignments
      .filter(
        assignment =>
          assignment.classId ===
          classId
      )
      .map(
        assignment =>
          assignment.subjectName
      )
      .filter(
        (subject, index, subjects) =>
          !!subject &&
          subjects.indexOf(subject) === index
      );

  }


  // =====================================================
  // LOGOUT
  // =====================================================

  async logout(): Promise<void> {

    await this.authService.logout();

    this.router.navigate(['/login']);

  }

}