import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  RouterLink
} from '@angular/router';

import {
  get,
  push,
  ref,
  remove,
  update
} from 'firebase/database';

import {
  database
} from '../../core/firebase.config';

import {
  SchoolAuthService,
  SchoolUser
} from '../../core/Auth/school-auth.service';


// =========================================================
// STAFF ASSIGNMENT
// =========================================================

interface StaffAssignment {

  id: string;

  teacherId: string;

  classId: string;

  subjectId: string;

  className?: string;

  subjectName?: string;

  teacherName?: string;

  status?: string;

}


// =========================================================
// CLASS
// =========================================================

interface SchoolClass {

  id: string;

  className: string;

  section?: string;

  status?: string;

}


// =========================================================
// SUBJECT
// =========================================================

interface SchoolSubject {

  id: string;

  subjectName: string;

  subjectCode?: string;

  status?: string;

}


// =========================================================
// STUDENT
// =========================================================

interface Student {

  id: string;

  studentId: string;

  fullName: string;

  firstName?: string;

  lastName?: string;

  classId?: string;

  className?: string;

  // Parent Firebase UID
  parentId?: string;

  status?: string;

}


// =========================================================
// ACADEMIC SESSION
// =========================================================

interface AcademicSession {

  id: string;

  name?: string;

  sessionName?: string;

  academicYear?: string;

  status?: string;

}


// =========================================================
// ACADEMIC TERM
// =========================================================

interface AcademicTerm {

  id: string;

  name?: string;

  termName?: string;

  status?: string;

}


// =========================================================
// RESULT
// =========================================================

interface AcademicResult {

  id: string;

  studentId: string;

  studentName: string;

  parentId: string;

  classId: string;

  className: string;

  subjectId: string;

  subjectName: string;

  teacherId: string;

  teacherName: string;

  sessionId: string;

  sessionName: string;

  termId: string;

  termName: string;

  ca1: number;

  ca2: number;

  exam: number;

  total: number;

  grade: string;

  remark: string;

  status: 'draft' | 'published';

  createdAt: number;

  updatedAt?: number;

}


// =========================================================
// RESULT FORM
// =========================================================

interface ResultForm {

  studentId: string;

  ca1: number | null;

  ca2: number | null;

  exam: number | null;

  remark: string;

}


// =========================================================
// COMPONENT
// =========================================================

@Component({

  selector: 'app-staff-result',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],

  templateUrl: './staff-results.html',

  styleUrl: './staff-results.css'

})

export class StaffResult implements OnInit {


  // =======================================================
  // USER
  // =======================================================

  currentUser:
    SchoolUser | null = null;

  staffId = '';

  staffRecordId = '';

  staffName = '';


  // =======================================================
  // DATA
  // =======================================================

  assignments:
    StaffAssignment[] = [];

  classes:
    SchoolClass[] = [];

  subjects:
    SchoolSubject[] = [];

  students:
    Student[] = [];

  sessions:
    AcademicSession[] = [];

  terms:
    AcademicTerm[] = [];

  results:
    AcademicResult[] = [];


  // =======================================================
  // CURRENT SELECTION
  // =======================================================

  selectedClassId = '';

  selectedSubjectId = '';

  selectedSessionId = '';

  selectedTermId = '';


  // =======================================================
  // CURRENT STUDENTS
  // =======================================================

  classStudents:
    Student[] = [];


  // =======================================================
  // RESULT FORMS
  // =======================================================

  resultForms:
    Record<string, ResultForm> = {};


  // =======================================================
  // EXISTING RESULTS
  // =======================================================

  existingResults:
    Record<string, AcademicResult> = {};


  // =======================================================
  // UI STATE
  // =======================================================

  loading = true;

  saving = false;

  deleting = false;

  errorMessage = '';

  successMessage = '';


  // =======================================================
  // EDIT MODE
  // =======================================================

  editingResultId = '';

  editingStudentId = '';


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

      this.clearMessages();


      const firebaseUser =
        this.authService.getUser();


      if (!firebaseUser) {

        this.errorMessage =
          'You are not logged in.';

        return;

      }


      let userData =
        this.authService.getUserData();


      if (!userData) {

        await new Promise<void>(
          resolve => {

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

          }
        );

      }


      userData =
        this.authService.getUserData();


      if (!userData) {

        this.errorMessage =
          'Unable to load your account information.';

        return;

      }


      this.currentUser =
        userData;


      if (
        this.currentUser.role !== 'staff'
      ) {

        this.errorMessage =
          'Access denied. Staff access is required.';

        return;

      }


      this.staffId =
        this.currentUser.staffId || '';


      if (!this.staffId) {

        this.errorMessage =
          'Your staff ID could not be found.';

        return;

      }


      await this.loadStaffRecord();

      await this.loadAssignments();

      await this.loadClasses();

      await this.loadSubjects();

      await this.loadStudents();

      await this.loadSessions();

      await this.loadTerms();

      await this.loadResults();


      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Staff Result initialization error:',
        error
      );


      this.errorMessage =
        'Unable to load the staff results page.';


    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // LOAD STAFF RECORD
  // =======================================================

  async loadStaffRecord(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'staff'
        )
      );


    if (!snapshot.exists()) {

      throw new Error(
        'Staff records not found.'
      );

    }


    const data =
      snapshot.val();


    for (
      const [recordId, value]
      of Object.entries(data)
    ) {

      const staff =
        value as any;


      if (
        this.currentUser?.uid &&
        staff.uid ===
        this.currentUser.uid
      ) {

        this.staffRecordId =
          recordId;

        this.staffName =
          staff.fullName || '';

        break;

      }


      if (
        staff.staffId ===
        this.staffId
      ) {

        this.staffRecordId =
          recordId;

        this.staffName =
          staff.fullName || '';

        break;

      }


      if (
        staff.id ===
        this.staffId
      ) {

        this.staffRecordId =
          recordId;

        this.staffName =
          staff.fullName || '';

        break;

      }


      if (
        recordId ===
        this.staffId
      ) {

        this.staffRecordId =
          recordId;

        this.staffName =
          staff.fullName || '';

        break;

      }

    }


    if (!this.staffRecordId) {

      throw new Error(
        `Your staff record could not be found for Staff ID ${this.staffId}.`
      );

    }

  }


  // =======================================================
  // LOAD ASSIGNMENTS
  // =======================================================

  async loadAssignments(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'teachingAssignments'
        )
      );


    this.assignments = [];


    if (!snapshot.exists()) {

      return;

    }


    const data =
      snapshot.val();


    Object.entries(data)
      .forEach(
        ([id, value]: [string, any]) => {

          if (!value) {

            return;

          }


          if (
            value.teacherId ===
              this.staffRecordId &&

            value.status !==
              'inactive'
          ) {

            this.assignments.push({

              id,

              teacherId:
                value.teacherId,

              classId:
                value.classId,

              subjectId:
                value.subjectId,

              className:
                value.className,

              subjectName:
                value.subjectName,

              teacherName:
                value.teacherName,

              status:
                value.status ||
                'active'

            });

          }

        }
      );

  }


  // =======================================================
  // LOAD CLASSES
  // =======================================================

  async loadClasses(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'classes'
        )
      );


    this.classes = [];


    if (!snapshot.exists()) {

      return;

    }


    const data =
      snapshot.val();


    Object.entries(data)
      .forEach(
        ([id, value]: [string, any]) => {

          if (!value) {

            return;

          }


          if (
            value.status ===
            'inactive'
          ) {

            return;

          }


          this.classes.push({

            id,

            className:
              value.className ||
              value.name ||
              'Unnamed Class',

            section:
              value.section ||
              '',

            status:
              value.status ||
              'active'

          });

        }
      );


    this.classes.sort(
      (a, b) =>
        `${a.className} ${a.section}`
          .localeCompare(
            `${b.className} ${b.section}`
          )
    );

  }


  // =======================================================
  // LOAD SUBJECTS
  // =======================================================

  async loadSubjects(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'subjects'
        )
      );


    this.subjects = [];


    if (!snapshot.exists()) {

      return;

    }


    const data =
      snapshot.val();


    Object.entries(data)
      .forEach(
        ([id, value]: [string, any]) => {

          if (!value) {

            return;

          }


          if (
            value.status ===
            'inactive'
          ) {

            return;

          }


          this.subjects.push({

            id,

            subjectName:
              value.subjectName ||
              value.name ||
              'Unnamed Subject',

            subjectCode:
              value.subjectCode ||
              '',

            status:
              value.status ||
              'active'

          });

        }
      );


    this.subjects.sort(
      (a, b) =>
        a.subjectName.localeCompare(
          b.subjectName
        )
    );

  }


  // =======================================================
  // LOAD STUDENTS
  // =======================================================

  async loadStudents(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'students'
        )
      );


    this.students = [];


    if (!snapshot.exists()) {

      return;

    }


    const data =
      snapshot.val();


    Object.entries(data)
      .forEach(
        ([id, value]: [string, any]) => {

          if (!value) {

            return;

          }


          if (
            value.status ===
            'inactive'
          ) {

            return;

          }


          const schoolClass =
            this.classes.find(
              item =>
                item.id ===
                value.classId
            );


          const student: Student = {

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

            classId:
              value.classId ||
              '',

            className:
              schoolClass
                ? `${schoolClass.className} ${schoolClass.section || ''}`.trim()
                : value.className ||
                  'Unknown Class',

            // IMPORTANT:
            // This is the parent's Firebase UID.
            parentId:
              value.parentId ||
              '',

            status:
              value.status ||
              'active'

          };


          this.students.push(
            student
          );


          console.log(
            'Student loaded for staff results:',
            {
              studentId:
                student.studentId,

              parentId:
                student.parentId,

              studentName:
                student.fullName
            }
          );

        }
      );

  }


  // =======================================================
  // LOAD SESSIONS
  // =======================================================

  async loadSessions(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'academicSessions'
        )
      );


    this.sessions = [];


    if (!snapshot.exists()) {

      return;

    }


    const data =
      snapshot.val();


    Object.entries(data)
      .forEach(
        ([id, value]: [string, any]) => {

          if (!value) {

            return;

          }


          if (
            value.status ===
            'inactive'
          ) {

            return;

          }


          this.sessions.push({

            id,

            name:
              value.name ||
              value.sessionName ||
              value.academicYear ||
              id,

            sessionName:
              value.sessionName ||
              value.name ||
              value.academicYear ||
              id,

            academicYear:
              value.academicYear ||
              '',

            status:
              value.status ||
              'active'

          });

        }
      );

  }


  // =======================================================
  // LOAD TERMS
  // =======================================================

  async loadTerms(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'academicTerms'
        )
      );


    this.terms = [];


    if (!snapshot.exists()) {

      return;

    }


    const data =
      snapshot.val();


    Object.entries(data)
      .forEach(
        ([id, value]: [string, any]) => {

          if (!value) {

            return;

          }


          if (
            value.status ===
            'inactive'
          ) {

            return;

          }


          this.terms.push({

            id,

            name:
              value.name ||
              value.termName ||
              id,

            termName:
              value.termName ||
              value.name ||
              id,

            status:
              value.status ||
              'active'

          });

        }
      );

  }


  // =======================================================
  // LOAD RESULTS
  // =======================================================

  async loadResults(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'results'
        )
      );


    this.results = [];

    this.existingResults = {};


    if (!snapshot.exists()) {

      this.refreshStudentForms();

      return;

    }


    const data =
      snapshot.val();


    Object.entries(data)
      .forEach(
        ([id, value]: [string, any]) => {

          if (!value) {

            return;

          }


          // =================================================
          // ONLY LOAD THIS STAFF MEMBER'S RESULTS
          // =================================================

          if (
            value.teacherId !==
            this.staffRecordId
          ) {

            return;

          }


          const result:
            AcademicResult = {

            id,

            studentId:
              value.studentId ||
              '',

            parentId:
              value.parentId ||
              '',

            studentName:
              value.studentName ||
              '',

            classId:
              value.classId ||
              '',

            className:
              value.className ||
              '',

            subjectId:
              value.subjectId ||
              '',

            subjectName:
              value.subjectName ||
              '',

            teacherId:
              value.teacherId ||
              '',

            teacherName:
              value.teacherName ||
              '',

            sessionId:
              value.sessionId ||
              '',

            sessionName:
              value.sessionName ||
              '',

            termId:
              value.termId ||
              '',

            termName:
              value.termName ||
              '',

            ca1:
              Number(value.ca1) ||
              0,

            ca2:
              Number(value.ca2) ||
              0,

            exam:
              Number(value.exam) ||
              0,

            total:
              Number(value.total) ||
              0,

            grade:
              value.grade ||
              '',

            remark:
              value.remark ||
              '',

            status:
              value.status ===
              'published'
                ? 'published'
                : 'draft',

            createdAt:
              Number(value.createdAt) ||
              Date.now(),

            updatedAt:
              value.updatedAt
                ? Number(value.updatedAt)
                : undefined

          };


          this.results.push(
            result
          );

        }
      );


    // =====================================================
    // NEWEST UPDATED RESULTS FIRST
    // =====================================================

    this.results.sort(
      (a, b) =>
        (
          Number(b.updatedAt) ||
          Number(b.createdAt) ||
          0
        ) -
        (
          Number(a.updatedAt) ||
          Number(a.createdAt) ||
          0
        )
    );


    this.refreshStudentForms();

  }


  // =======================================================
  // GET ASSIGNED SUBJECTS FOR CLASS
  // =======================================================

  getSubjectsForClass():
    SchoolSubject[] {

    if (!this.selectedClassId) {

      return [];

    }


    const subjectIds =
      Array.from(
        new Set(
          this.assignments
            .filter(
              assignment =>
                assignment.classId ===
                this.selectedClassId
            )
            .map(
              assignment =>
                assignment.subjectId
            )
        )
      );


    return this.subjects.filter(
      subject =>
        subjectIds.includes(
          subject.id
        )
    );

  }


  // =======================================================
  // CHECK WHETHER SELECTED CLASS + SUBJECT IS ALLOWED
  // =======================================================

  isAssignmentAllowed(): boolean {

    if (
      !this.selectedClassId ||
      !this.selectedSubjectId
    ) {

      return false;

    }


    return this.assignments.some(
      assignment =>

        assignment.classId ===
        this.selectedClassId &&

        assignment.subjectId ===
        this.selectedSubjectId

    );

  }


  // =======================================================
  // CLASS CHANGED
  // =======================================================

  onClassChange(): void {

    this.selectedSubjectId = '';

    this.classStudents = [];

    this.resultForms = {};

    this.existingResults = {};

    this.editingResultId = '';

    this.editingStudentId = '';

    this.clearMessages();

    this.cdr.detectChanges();

  }


  // =======================================================
  // SUBJECT CHANGED
  // =======================================================

  onSubjectChange(): void {

    this.editingResultId = '';

    this.editingStudentId = '';

    this.clearMessages();

    this.refreshStudentForms();

    this.cdr.detectChanges();

  }


  // =======================================================
  // SESSION CHANGED
  // =======================================================

  onSessionChange(): void {

    this.editingResultId = '';

    this.editingStudentId = '';

    this.refreshStudentForms();

    this.cdr.detectChanges();

  }


  // =======================================================
  // TERM CHANGED
  // =======================================================

  onTermChange(): void {

    this.editingResultId = '';

    this.editingStudentId = '';

    this.refreshStudentForms();

    this.cdr.detectChanges();

  }


  // =======================================================
  // REFRESH STUDENTS + FORMS
  // =======================================================

  refreshStudentForms(): void {

    if (
      !this.selectedClassId ||
      !this.selectedSubjectId
    ) {

      this.classStudents = [];

      this.resultForms = {};

      this.existingResults = {};

      return;

    }


    if (
      !this.isAssignmentAllowed()
    ) {

      this.classStudents = [];

      this.resultForms = {};

      this.existingResults = {};

      return;

    }


    this.classStudents =
      this.students
        .filter(
          student =>
            student.classId ===
            this.selectedClassId
        )
        .sort(
          (a, b) =>
            a.fullName.localeCompare(
              b.fullName
            )
        );


    this.resultForms = {};

    this.existingResults = {};


    this.classStudents.forEach(
      student => {

        const existing =
          this.results.find(
            result =>

              result.studentId ===
              student.studentId &&

              result.classId ===
              this.selectedClassId &&

              result.subjectId ===
              this.selectedSubjectId &&

              result.sessionId ===
              this.selectedSessionId &&

              result.termId ===
              this.selectedTermId

          );


        if (existing) {

          this.existingResults[
            student.studentId
          ] = existing;

        }


        this.resultForms[
          student.studentId
        ] = {

          studentId:
            student.studentId,

          ca1:
            existing
              ? existing.ca1
              : null,

          ca2:
            existing
              ? existing.ca2
              : null,

          exam:
            existing
              ? existing.exam
              : null,

          remark:
            existing
              ? existing.remark
              : ''

        };

      }
    );

  }


  // =======================================================
  // GET TOTAL
  // =======================================================

  getTotal(
    studentId: string
  ): number {

    const form =
      this.resultForms[
        studentId
      ];


    if (!form) {

      return 0;

    }


    return (
      Number(form.ca1) || 0
    ) +
    (
      Number(form.ca2) || 0
    ) +
    (
      Number(form.exam) || 0
    );

  }


  // =======================================================
  // GET GRADE
  // =======================================================

  getGrade(
    studentId: string
  ): string {

    const total =
      this.getTotal(
        studentId
      );


    if (total >= 80) {

      return 'A';

    }


    if (total >= 70) {

      return 'B';

    }


    if (total >= 60) {

      return 'C';

    }


    if (total >= 50) {

      return 'D';

    }


    if (total >= 40) {

      return 'E';

    }


    return 'F';

  }


  // =======================================================
  // GET DEFAULT REMARK
  // =======================================================

  getDefaultRemark(
    studentId: string
  ): string {

    const total =
      this.getTotal(
        studentId
      );


    if (total >= 80) {

      return 'Excellent';

    }


    if (total >= 70) {

      return 'Very Good';

    }


    if (total >= 60) {

      return 'Good';

    }


    if (total >= 50) {

      return 'Fair';

    }


    if (total >= 40) {

      return 'Pass';

    }


    return 'Needs Improvement';

  }


  // =======================================================
  // SAVE RESULT
  // =======================================================

  async saveResult(
    student: Student
  ): Promise<void> {

    this.clearMessages();


    // =====================================================
    // VALIDATE CLASS + SUBJECT
    // =====================================================

    if (
      !this.selectedClassId ||
      !this.selectedSubjectId
    ) {

      this.errorMessage =
        'Please select a class and subject.';

      return;

    }


    // =====================================================
    // VALIDATE SESSION
    // =====================================================

    if (
      !this.selectedSessionId
    ) {

      this.errorMessage =
        'Please select an academic session.';

      return;

    }


    // =====================================================
    // VALIDATE TERM
    // =====================================================

    if (
      !this.selectedTermId
    ) {

      this.errorMessage =
        'Please select an academic term.';

      return;

    }


    // =====================================================
    // VALIDATE ASSIGNMENT
    // =====================================================

    if (
      !this.isAssignmentAllowed()
    ) {

      this.errorMessage =
        'You are not assigned to teach this subject for this class.';

      return;

    }


    // =====================================================
    // FIND FORM
    // =====================================================

    const form =
      this.resultForms[
        student.studentId
      ];


    if (!form) {

      return;

    }


    // =====================================================
    // GET PARENT FIREBASE UID
    // =====================================================

    const parentId =
      String(
        student.parentId ||
        ''
      ).trim();


    // =====================================================
    // PARENT LINK IS REQUIRED
    // =====================================================

    if (!parentId) {

      console.error(
        'Student has no parentId:',
        student
      );


      this.errorMessage =
        `Unable to save ${student.fullName}'s result because the student is not linked to a parent account.`;

      return;

    }


    // =====================================================
    // FIND EXISTING RESULT
    // =====================================================

    const existing =
      this.existingResults[
        student.studentId
      ];


    // =====================================================
    // NEVER ALLOW STAFF TO MODIFY PUBLISHED RESULTS
    // =====================================================

    if (
      existing &&
      existing.status ===
        'published'
    ) {

      this.errorMessage =
        'Published results cannot be edited by staff. Please contact the administrator if a correction is required.';

      return;

    }


    // =====================================================
    // GET SCORES
    // =====================================================

    const ca1 =
      Number(form.ca1) || 0;

    const ca2 =
      Number(form.ca2) || 0;

    const exam =
      Number(form.exam) || 0;


    // =====================================================
    // VALIDATE CA1
    // =====================================================

    if (
      ca1 < 0 ||
      ca1 > 20
    ) {

      this.errorMessage =
        `CA1 for ${student.fullName} must be between 0 and 20.`;

      return;

    }


    // =====================================================
    // VALIDATE CA2
    // =====================================================

    if (
      ca2 < 0 ||
      ca2 > 20
    ) {

      this.errorMessage =
        `CA2 for ${student.fullName} must be between 0 and 20.`;

      return;

    }


    // =====================================================
    // VALIDATE EXAM
    // =====================================================

    if (
      exam < 0 ||
      exam > 60
    ) {

      this.errorMessage =
        `Exam for ${student.fullName} must be between 0 and 60.`;

      return;

    }


    this.saving = true;

    this.cdr.detectChanges();


    try {

      // ===================================================
      // FIND CLASS
      // ===================================================

      const schoolClass =
        this.classes.find(
          item =>
            item.id ===
            this.selectedClassId
        );


      // ===================================================
      // FIND SUBJECT
      // ===================================================

      const subject =
        this.subjects.find(
          item =>
            item.id ===
            this.selectedSubjectId
        );


      // ===================================================
      // FIND SESSION
      // ===================================================

      const session =
        this.sessions.find(
          item =>
            item.id ===
            this.selectedSessionId
        );


      // ===================================================
      // FIND TERM
      // ===================================================

      const term =
        this.terms.find(
          item =>
            item.id ===
            this.selectedTermId
        );


      // ===================================================
      // CALCULATE TOTAL
      // ===================================================

      const total =
        ca1 +
        ca2 +
        exam;


      // ===================================================
      // CALCULATE GRADE
      // ===================================================

      const grade =
        this.getGrade(
          student.studentId
        );


      // ===================================================
      // GET REMARK
      // ===================================================

      const remark =
        form.remark?.trim() ||
        this.getDefaultRemark(
          student.studentId
        );


      const now =
        Date.now();


      // ===================================================
      // RESULT DATA
      // ===================================================

      const resultData = {

        studentId:
          student.studentId,

        // IMPORTANT:
        // Parent Firebase UID.
        parentId,

        studentName:
          student.fullName,

        classId:
          this.selectedClassId,

        className:
          schoolClass
            ? `${schoolClass.className} ${schoolClass.section || ''}`.trim()
            : student.className ||
              '',

        subjectId:
          this.selectedSubjectId,

        subjectName:
          subject?.subjectName ||
          '',

        teacherId:
          this.staffRecordId,

        teacherName:
          this.staffName ||
          this.currentUser?.fullName ||
          '',

        sessionId:
          this.selectedSessionId,

        sessionName:
          session?.sessionName ||
          session?.name ||
          session?.academicYear ||
          '',

        termId:
          this.selectedTermId,

        termName:
          term?.termName ||
          term?.name ||
          '',

        ca1,

        ca2,

        exam,

        total,

        grade,

        remark,

        // Staff can only create/edit drafts.
        status:
          'draft' as const,

        createdAt:
          existing?.createdAt ||
          now,

        updatedAt:
          now

      };


      console.log(
        'Saving result:',
        resultData
      );


      // ===================================================
      // UPDATE EXISTING DRAFT
      // ===================================================

      if (existing) {

        await update(
          ref(
            database,
            `results/${existing.id}`
          ),
          resultData
        );


        const updatedResult:
          AcademicResult = {

          ...existing,

          ...resultData,

          id:
            existing.id,

          parentId

        };


        this.results =
          this.results.map(
            result =>
              result.id ===
              existing.id

                ? updatedResult

                : result
          );


        this.existingResults[
          student.studentId
        ] =
          updatedResult;


        this.successMessage =
          `Result for ${student.fullName} updated successfully.`;

      }


      // ===================================================
      // CREATE NEW RESULT
      // ===================================================

      else {

        const resultRef =
          push(
            ref(
              database,
              'results'
            )
          );


        await update(
          resultRef,
          resultData
        );


        const newResult:
          AcademicResult = {

          id:
            resultRef.key ||
            '',

          ...resultData,

          parentId

        };


        this.results.unshift(
          newResult
        );


        this.existingResults[
          student.studentId
        ] =
          newResult;


        this.successMessage =
          `Result for ${student.fullName} saved successfully.`;

      }


      // ===================================================
      // EXIT EDIT MODE
      // ===================================================

      this.editingResultId = '';

      this.editingStudentId = '';


      // ===================================================
      // SORT RESULTS
      // ===================================================

      this.results.sort(
        (a, b) =>
          (
            Number(b.updatedAt) ||
            Number(b.createdAt) ||
            0
          ) -
          (
            Number(a.updatedAt) ||
            Number(a.createdAt) ||
            0
          )
      );


      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Error saving result:',
        error
      );


      this.errorMessage =
        'Unable to save the result. Please try again.';


    } finally {

      this.saving = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // EDIT SAVED RESULT
  // =======================================================

  editSavedResult(
    result: AcademicResult
  ): void {

    if (
      result.status ===
      'published'
    ) {

      this.errorMessage =
        'Published results cannot be edited by staff.';

      return;

    }


    this.selectedClassId =
      result.classId;


    this.selectedSubjectId =
      result.subjectId;


    this.selectedSessionId =
      result.sessionId;


    this.selectedTermId =
      result.termId;


    this.refreshStudentForms();


    const student =
      this.students.find(
        item =>
          item.studentId ===
          result.studentId
      );


    if (!student) {

      this.errorMessage =
        'The student record for this result could not be found.';

      return;

    }


    this.editingResultId =
      result.id;

    this.editingStudentId =
      result.studentId;


    this.resultForms[
      student.studentId
    ] = {

      studentId:
        student.studentId,

      ca1:
        result.ca1,

      ca2:
        result.ca2,

      exam:
        result.exam,

      remark:
        result.remark

    };


    this.clearMessages();

    this.cdr.detectChanges();


    setTimeout(() => {

      const element =
        document.querySelector(
          'table'
        );


      if (element) {

        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

      }

    }, 50);

  }


  // =======================================================
  // DELETE SAVED RESULT
  // =======================================================

  async deleteSavedResult(
    result: AcademicResult
  ): Promise<void> {

    if (
      result.status ===
      'published'
    ) {

      this.errorMessage =
        'Published results cannot be deleted by staff.';

      return;

    }


    const confirmed =
      window.confirm(
        `Delete the result for ${result.studentName} in ${result.subjectName}?`
      );


    if (!confirmed) {

      return;

    }


    this.deleting = true;

    this.clearMessages();

    this.cdr.detectChanges();


    try {

      await remove(
        ref(
          database,
          `results/${result.id}`
        )
      );


      this.results =
        this.results.filter(
          item =>
            item.id !==
            result.id
        );


      if (
        result.classId ===
          this.selectedClassId &&

        result.subjectId ===
          this.selectedSubjectId &&

        result.sessionId ===
          this.selectedSessionId &&

        result.termId ===
          this.selectedTermId
      ) {

        delete this.existingResults[
          result.studentId
        ];


        const form =
          this.resultForms[
            result.studentId
          ];


        if (form) {

          form.ca1 = null;

          form.ca2 = null;

          form.exam = null;

          form.remark = '';

        }

      }


      if (
        this.editingResultId ===
        result.id
      ) {

        this.editingResultId = '';

        this.editingStudentId = '';

      }


      this.successMessage =
        `Result for ${result.studentName} deleted successfully.`;


    } catch (error) {

      console.error(
        'Error deleting saved result:',
        error
      );


      this.errorMessage =
        'Unable to delete the result. Please try again.';


    } finally {

      this.deleting = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // DELETE RESULT FROM STUDENT TABLE
  // =======================================================

  async deleteResult(
    student: Student
  ): Promise<void> {

    const existing =
      this.existingResults[
        student.studentId
      ];


    if (!existing) {

      return;

    }


    if (
      existing.status ===
      'published'
    ) {

      this.errorMessage =
        'Published results cannot be deleted by staff.';

      return;

    }


    const confirmed =
      window.confirm(
        `Delete the result for ${student.fullName}?`
      );


    if (!confirmed) {

      return;

    }


    this.deleting = true;

    this.clearMessages();

    this.cdr.detectChanges();


    try {

      await remove(
        ref(
          database,
          `results/${existing.id}`
        )
      );


      this.results =
        this.results.filter(
          result =>
            result.id !==
            existing.id
        );


      this.results.sort(
        (a, b) =>
          (
            Number(b.updatedAt) ||
            Number(b.createdAt) ||
            0
          ) -
          (
            Number(a.updatedAt) ||
            Number(a.createdAt) ||
            0
          )
      );


      delete this.existingResults[
        student.studentId
      ];


      const form =
        this.resultForms[
          student.studentId
        ];


      if (form) {

        form.ca1 = null;

        form.ca2 = null;

        form.exam = null;

        form.remark = '';

      }


      if (
        this.editingResultId ===
        existing.id
      ) {

        this.editingResultId = '';

        this.editingStudentId = '';

      }


      this.successMessage =
        `Result for ${student.fullName} deleted successfully.`;


    } catch (error) {

      console.error(
        'Error deleting result:',
        error
      );


      this.errorMessage =
        'Unable to delete the result. Please try again.';


    } finally {

      this.deleting = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // EDIT RESULT FROM STUDENT TABLE
  // =======================================================

  editResult(
    student: Student
  ): void {

    const existing =
      this.existingResults[
        student.studentId
      ];


    if (!existing) {

      return;

    }


    if (
      existing.status ===
      'published'
    ) {

      this.errorMessage =
        'Published results cannot be edited by staff.';

      return;

    }


    this.editingResultId =
      existing.id;

    this.editingStudentId =
      student.studentId;


    this.resultForms[
      student.studentId
    ] = {

      studentId:
        student.studentId,

      ca1:
        existing.ca1,

      ca2:
        existing.ca2,

      exam:
        existing.exam,

      remark:
        existing.remark

    };


    this.clearMessages();

    this.cdr.detectChanges();

  }


  // =======================================================
  // CANCEL EDIT
  // =======================================================

  cancelEdit(
    student: Student
  ): void {

    const existing =
      this.existingResults[
        student.studentId
      ];


    if (existing) {

      this.resultForms[
        student.studentId
      ] = {

        studentId:
          student.studentId,

        ca1:
          existing.ca1,

        ca2:
          existing.ca2,

        exam:
          existing.exam,

        remark:
          existing.remark

      };

    }


    this.editingResultId = '';

    this.editingStudentId = '';

    this.clearMessages();

    this.cdr.detectChanges();

  }


  // =======================================================
  // CHECK EXISTING RESULT
  // =======================================================

  hasResult(
    studentId: string
  ): boolean {

    return !!this.existingResults[
      studentId
    ];

  }


  // =======================================================
  // CHECK PUBLISHED
  // =======================================================

  isPublished(
    studentId: string
  ): boolean {

    return (
      this.existingResults[
        studentId
      ]?.status ===
      'published'
    );

  }


  // =======================================================
  // GET SELECTED CLASS NAME
  // =======================================================

  getSelectedClassName(): string {

    const classroom =
      this.classes.find(
        item =>
          item.id ===
          this.selectedClassId
      );


    if (!classroom) {

      return '';

    }


    return `${classroom.className} ${classroom.section || ''}`
      .trim();

  }


  // =======================================================
  // GET SELECTED SUBJECT NAME
  // =======================================================

  getSelectedSubjectName(): string {

    const subject =
      this.subjects.find(
        item =>
          item.id ===
          this.selectedSubjectId
      );


    return subject?.subjectName || '';

  }


  // =======================================================
  // CLEAR SELECTION
  // =======================================================

  clearSelection(): void {

    this.selectedClassId = '';

    this.selectedSubjectId = '';

    this.selectedSessionId = '';

    this.selectedTermId = '';

    this.classStudents = [];

    this.resultForms = {};

    this.existingResults = {};

    this.editingResultId = '';

    this.editingStudentId = '';

    this.clearMessages();

  }


  // =======================================================
  // CLEAR MESSAGES
  // =======================================================

  clearMessages(): void {

    this.successMessage = '';

    this.errorMessage = '';

  }


  // =======================================================
  // REFRESH
  // =======================================================

  async refresh(): Promise<void> {

    if (this.loading) {

      return;

    }


    this.clearMessages();

    this.loading = true;

    this.cdr.detectChanges();


    try {

      await this.loadAssignments();

      await this.loadClasses();

      await this.loadSubjects();

      await this.loadStudents();

      await this.loadSessions();

      await this.loadTerms();

      await this.loadResults();


    } catch (error) {

      console.error(
        'Error refreshing staff results:',
        error
      );


      this.errorMessage =
        'Unable to refresh results. Please try again.';


    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

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