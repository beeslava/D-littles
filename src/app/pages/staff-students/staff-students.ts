import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  get,
  ref
} from 'firebase/database';

import { database } from '../../core/firebase.config';

import {
  SchoolAuthService,
  SchoolUser
} from '../../core/Auth/school-auth.service';


// =========================================================
// INTERFACES
// =========================================================

interface StaffAssignment {
  id: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  sessionId?: string;
  termId?: string;
  status?: string;
}

interface SchoolClass {
  id: string;
  className: string;
  status?: string;
}

interface Student {
  id: string;
  studentId: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  gender?: string;
  dateOfBirth?: string;
  classId?: string;
  className?: string;
  parentId?: string;
  parentName?: string;
  parentPhone?: string;
  status?: string;
}


// =========================================================
// GROUPED CLASS INTERFACE
// =========================================================

interface ClassStudentGroup {
  classId: string;
  className: string;
  students: Student[];
}


// =========================================================
// COMPONENT
// =========================================================

@Component({
  selector: 'app-staff-students',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],

  templateUrl: './staff-students.html',
  styleUrl: './staff-students.css'
})
export class StaffStudents implements OnInit {

  // =======================================================
  // USER
  // =======================================================

  currentUser: SchoolUser | null = null;

  staffId = '';
  staffRecordId = '';


  // =======================================================
  // DATA
  // =======================================================

  assignments: StaffAssignment[] = [];

  classes: SchoolClass[] = [];

  students: Student[] = [];

  filteredStudents: Student[] = [];


  // =======================================================
  // GROUPED STUDENTS
  //
  // Each class gets its own group.
  //
  // Example:
  //
  // Primary 1
  //   - Student A
  //   - Student B
  //
  // Primary 2
  //   - Student C
  //   - Student D
  // =======================================================

  groupedStudents: ClassStudentGroup[] = [];


  // =======================================================
  // FILTERS
  // =======================================================

  searchTerm = '';

  selectedClassId = '';


  // =======================================================
  // STATE
  // =======================================================

  loading = true;

  errorMessage = '';


  // =======================================================
  // STATS
  // =======================================================

  totalStudents = 0;

  totalClasses = 0;


  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor(
    private authService: SchoolAuthService,
    private cdr: ChangeDetectorRef
  ) {}


  // =======================================================
  // INIT
  // =======================================================

  async ngOnInit(): Promise<void> {

    try {

      this.loading = true;
      this.errorMessage = '';

      this.cdr.detectChanges();


      // ===================================================
      // 1. CHECK FIREBASE AUTH USER
      // ===================================================

      const firebaseUser =
        this.authService.getUser();


      if (!firebaseUser) {

        this.errorMessage =
          'You are not logged in.';

        this.loading = false;

        this.cdr.detectChanges();

        return;
      }


      console.log(
        'STAFF STUDENTS FIREBASE UID:',
        firebaseUser.uid
      );


      // ===================================================
      // 2. WAIT FOR SCHOOL USER DATA
      // ===================================================

      let userData =
        this.authService.getUserData();


      if (!userData) {

        await new Promise<void>((resolve) => {

          const checkUser = () => {

            const latestUserData =
              this.authService.getUserData();

            const latestFirebaseUser =
              this.authService.getUser();


            if (
              latestUserData !== null ||
              latestFirebaseUser === null
            ) {

              resolve();

            } else {

              setTimeout(
                checkUser,
                100
              );

            }

          };

          checkUser();

        });

      }


      // ===================================================
      // 3. GET LATEST SCHOOL USER DATA
      // ===================================================

      userData =
        this.authService.getUserData();


      if (!userData) {

        this.errorMessage =
          'Unable to load your account information.';

        this.loading = false;

        this.cdr.detectChanges();

        return;
      }


      this.currentUser = userData;


      console.log(
        'STAFF STUDENTS USER:',
        this.currentUser
      );


      // ===================================================
      // 4. VERIFY STAFF ROLE
      // ===================================================

      if (
        this.currentUser.role !== 'staff'
      ) {

        console.error(
          'STAFF STUDENTS ACCESS DENIED. ROLE:',
          this.currentUser.role
        );

        this.errorMessage =
          'Access denied. Staff access is required.';

        this.loading = false;

        this.cdr.detectChanges();

        return;
      }


      // ===================================================
      // 5. GET STAFF ID
      // ===================================================

      this.staffId =
        this.currentUser.staffId || '';


      console.log(
        'STAFF ID FROM USER:',
        this.staffId
      );


      if (!this.staffId) {

        this.errorMessage =
          'Your staff ID could not be found.';

        this.loading = false;

        this.cdr.detectChanges();

        return;
      }


      // ===================================================
      // 6. LOAD STAFF STUDENTS
      // ===================================================

      await this.loadStudents();


    } catch (error) {

      console.error(
        'Staff Students initialization error:',
        error
      );

      this.errorMessage =
        'Unable to load the staff students page.';


    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // LOAD STUDENTS
  // =======================================================

  async loadStudents(): Promise<void> {

    try {

      this.loading = true;
      this.errorMessage = '';

      this.cdr.detectChanges();


      // ===================================================
      // 1. VERIFY USER
      // ===================================================

      if (!this.currentUser) {

        throw new Error(
          'Staff user information is unavailable.'
        );

      }


      if (
        this.currentUser.role !== 'staff'
      ) {

        throw new Error(
          'Access denied. Staff access is required.'
        );

      }


      this.staffId =
        this.currentUser.staffId || '';


      if (!this.staffId) {

        throw new Error(
          'Staff ID could not be found.'
        );

      }


      // ===================================================
      // 2. FIND STAFF RECORD
      // ===================================================

      const staffSnapshot =
        await get(
          ref(
            database,
            'staff'
          )
        );


      if (!staffSnapshot.exists()) {

        throw new Error(
          'Staff records not found.'
        );

      }


      const staffData =
        staffSnapshot.val();


      console.log(
        'STAFF ID:',
        this.staffId
      );

      console.log(
        'STAFF UID:',
        this.currentUser.uid
      );

      console.log(
        'ALL STAFF RECORDS:',
        staffData
      );


      let foundStaffRecordId = '';


      // ===================================================
      // FIND STAFF RECORD
      // ===================================================

      for (
        const [recordId, value]
        of Object.entries(staffData)
      ) {

        const staff =
          value as any;


        console.log(
          'CHECKING STAFF RECORD:',
          recordId,
          staff
        );


        // PRIMARY MATCH: FIREBASE UID

        if (
          this.currentUser.uid &&
          staff.uid === this.currentUser.uid
        ) {

          foundStaffRecordId =
            recordId;

          console.log(
            'STAFF MATCHED BY UID:',
            foundStaffRecordId
          );

          break;
        }


        // SECONDARY MATCH: STAFF ID

        if (
          staff.staffId === this.staffId
        ) {

          foundStaffRecordId =
            recordId;

          console.log(
            'STAFF MATCHED BY STAFF ID:',
            foundStaffRecordId
          );

          break;
        }


        // LEGACY MATCH: ID FIELD

        if (
          staff.id === this.staffId
        ) {

          foundStaffRecordId =
            recordId;

          console.log(
            'STAFF MATCHED BY ID FIELD:',
            foundStaffRecordId
          );

          break;
        }


        // LEGACY MATCH: FIREBASE RECORD KEY

        if (
          recordId === this.staffId
        ) {

          foundStaffRecordId =
            recordId;

          console.log(
            'STAFF MATCHED BY RECORD KEY:',
            foundStaffRecordId
          );

          break;
        }

      }


      // ===================================================
      // STAFF RECORD NOT FOUND
      // ===================================================

      if (!foundStaffRecordId) {

        console.error(
          'STAFF RECORD NOT FOUND',
          {
            firebaseUid:
              this.currentUser.uid,

            staffId:
              this.staffId
          }
        );


        throw new Error(
          `Your staff record could not be found for Staff ID ${this.staffId}.`
        );

      }


      // ===================================================
      // SAVE STAFF RECORD ID
      // ===================================================

      this.staffRecordId =
        foundStaffRecordId;


      console.log(
        'FINAL STAFF RECORD ID:',
        this.staffRecordId
      );


      // ===================================================
      // 3. LOAD TEACHING ASSIGNMENTS
      // ===================================================

      const assignmentsSnapshot =
        await get(
          ref(
            database,
            'teachingAssignments'
          )
        );


      this.assignments = [];


      if (
        assignmentsSnapshot.exists()
      ) {

        const assignmentData =
          assignmentsSnapshot.val();


        Object.entries(
          assignmentData
        ).forEach(
          (
            [id, value]:
            [string, any]
          ) => {

            if (!value) {
              return;
            }


            /*
             * teachingAssignments.teacherId
             * contains the Firebase /staff
             * record key.
             */

            if (
              value.teacherId ===
                this.staffRecordId &&

              value.status !==
                'inactive'
            ) {

              this.assignments.push({

                id,

                ...value

              });

            }

          }
        );

      }


      console.log(
        'STAFF ASSIGNMENTS:',
        this.assignments
      );


      // ===================================================
      // 4. GET ASSIGNED CLASS IDS
      // ===================================================

      const assignedClassIds =
        Array.from(
          new Set(
            this.assignments
              .map(
                assignment =>
                  assignment.classId
              )
              .filter(Boolean)
          )
        );


      console.log(
        'ASSIGNED CLASS IDS:',
        assignedClassIds
      );


      // ===================================================
      // 5. LOAD CLASSES
      // ===================================================

      const classesSnapshot =
        await get(
          ref(
            database,
            'classes'
          )
        );


      this.classes = [];


      if (
        classesSnapshot.exists()
      ) {

        const classData =
          classesSnapshot.val();


        Object.entries(
          classData
        ).forEach(
          (
            [id, value]:
            [string, any]
          ) => {

            if (!value) {
              return;
            }


            if (
              assignedClassIds.includes(id) &&
              value.status !== 'inactive'
            ) {

              this.classes.push({

                id,

                className:
                  value.className ||
                  value.name ||
                  'Unnamed Class',

                status:
                  value.status

              });

            }

          }
        );

      }


      // ===================================================
      // SORT CLASSES
      // ===================================================

      this.classes.sort(
        (a, b) =>
          a.className.localeCompare(
            b.className
          )
      );


      console.log(
        'STAFF CLASSES:',
        this.classes
      );


      // ===================================================
      // 6. LOAD STUDENTS
      // ===================================================

      const studentsSnapshot =
        await get(
          ref(
            database,
            'students'
          )
        );


      this.students = [];


      if (
        studentsSnapshot.exists()
      ) {

        const studentData =
          studentsSnapshot.val();


        Object.entries(
          studentData
        ).forEach(
          (
            [id, value]:
            [string, any]
          ) => {

            if (!value) {
              return;
            }


            /*
             * Only students belonging to classes
             * assigned to this staff member.
             */

            if (
              value.classId &&
              assignedClassIds.includes(
                value.classId
              ) &&
              value.status !== 'inactive'
            ) {

              const studentClass =
                this.classes.find(
                  classroom =>
                    classroom.id ===
                    value.classId
                );


              this.students.push({

                id,

                studentId:
                  value.studentId ||
                  id,

                firstName:
                  value.firstName ||
                  '',

                lastName:
                  value.lastName ||
                  '',

                fullName:
                  value.fullName ||
                  `${value.firstName || ''} ${value.lastName || ''}`
                    .trim() ||
                  'Unnamed Student',

                gender:
                  value.gender ||
                  '',

                dateOfBirth:
                  value.dateOfBirth ||
                  '',

                classId:
                  value.classId ||
                  '',

                className:
                  studentClass?.className ||
                  value.className ||
                  'Unknown Class',

                parentId:
                  value.parentId ||
                  '',

                parentName:
                  value.parentName ||
                  '',

                parentPhone:
                  value.parentPhone ||
                  value.phone ||
                  '',

                status:
                  value.status ||
                  'active'

              });

            }

          }
        );

      }


      // ===================================================
      // 7. SORT STUDENTS
      // ===================================================

      this.students.sort(
        (a, b) =>
          a.fullName.localeCompare(
            b.fullName
          )
      );


      // ===================================================
      // 8. STATS
      // ===================================================

      this.totalStudents =
        this.students.length;

      this.totalClasses =
        this.classes.length;


      // ===================================================
      // 9. APPLY FILTERS
      // ===================================================

      this.applyFilters();


      console.log(
        'STAFF STUDENTS:',
        this.students
      );


      // ===================================================
      // FORCE ANGULAR UI UPDATE
      // ===================================================

      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Error loading staff students:',
        error
      );


      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to load your students. Please try again.';


      this.cdr.detectChanges();


    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // FILTER STUDENTS
  // =======================================================

  applyFilters(): void {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    this.filteredStudents =
      this.students.filter(
        student => {

          const matchesSearch =
            !search ||

            student.fullName
              .toLowerCase()
              .includes(search) ||

            student.studentId
              .toLowerCase()
              .includes(search) ||

            (student.className || '')
              .toLowerCase()
              .includes(search);


          const matchesClass =
            !this.selectedClassId ||

            student.classId ===
              this.selectedClassId;


          return (
            matchesSearch &&
            matchesClass
          );

        }
      );


    // =====================================================
    // REBUILD CLASS GROUPS
    // =====================================================

    this.buildClassGroups();

  }


  // =======================================================
  // BUILD CLASS GROUPS
  //
  // This creates one student collection per class.
  // The HTML will use groupedStudents to create
  // a separate table for every class.
  // =======================================================

  buildClassGroups(): void {

    const groups =
      new Map<string, ClassStudentGroup>();


    // =====================================================
    // CREATE GROUPS FROM STAFF CLASSES
    // =====================================================

    this.classes.forEach(
      classroom => {

        groups.set(
          classroom.id,
          {
            classId:
              classroom.id,

            className:
              classroom.className,

            students: []
          }
        );

      }
    );


    // =====================================================
    // ADD FILTERED STUDENTS TO THEIR CLASS
    // =====================================================

    this.filteredStudents.forEach(
      student => {

        if (!student.classId) {
          return;
        }


        const group =
          groups.get(
            student.classId
          );


        if (group) {

          group.students.push(
            student
          );

        }

      }
    );


    // =====================================================
    // ONLY SHOW CLASSES THAT HAVE STUDENTS
    // =====================================================

    this.groupedStudents =
      Array.from(
        groups.values()
      ).filter(
        group =>
          group.students.length > 0
      );


    // =====================================================
    // SORT GROUPS BY CLASS NAME
    // =====================================================

    this.groupedStudents.sort(
      (a, b) =>
        a.className.localeCompare(
          b.className
        )
    );


    console.log(
      'GROUPED STAFF STUDENTS:',
      this.groupedStudents
    );

  }


  // =======================================================
  // CLEAR FILTERS
  // =======================================================

  clearFilters(): void {

    this.searchTerm = '';

    this.selectedClassId = '';

    this.applyFilters();

    this.cdr.detectChanges();

  }


  // =======================================================
  // REFRESH
  // =======================================================

  async refresh(): Promise<void> {

    if (this.loading) {
      return;
    }


    await this.loadStudents();

    this.cdr.detectChanges();

  }


  // =======================================================
  // LOGOUT
  // =======================================================

  logout(): void {

    this.authService.logout();

    window.location.href =
      '/#/login';

  }

}

