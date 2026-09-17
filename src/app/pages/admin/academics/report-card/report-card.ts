import {
  NgFor,
  NgIf,
  DecimalPipe
} from '@angular/common';

import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnInit
} from '@angular/core';

import {
  FormsModule
} from '@angular/forms';

import {
  get,
  ref
} from 'firebase/database';

import { database } from '../../../../core/firebase.config';


interface Student {
  id: string;
  studentId: string;
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  classId: string;
  className?: string;
  section?: string;
  status?: string;
}


interface SchoolClass {
  id: string;
  classCode?: string;
  className: string;
  section?: string;
  status?: string;
}


interface AcademicSession {
  id: string;
  name: string;
  status: string;
}


interface AcademicTerm {
  id: string;
  sessionId: string;
  sessionName: string;
  name: string;
  status: string;
}


interface StudentResult {
  id: string;

  studentId: string;
  studentName: string;

  classId: string;
  className: string;

  subjectId: string;
  subjectName: string;

  teacherId?: string;
  teacherName?: string;

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

  createdAt?: number;
  updatedAt?: number;
}


interface ReportSubject {
  subjectName: string;
  teacherName: string;

  ca1: number;
  ca2: number;
  exam: number;

  total: number;
  grade: string;
  remark: string;
}


@Component({
  selector: 'app-report-cards',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    FormsModule,
    DecimalPipe
  ],
  templateUrl: './report-card.html',
  styleUrl: './report-card.css'
})
export class ReportCards implements OnInit {

  /* =====================================================
     DATA
  ===================================================== */

  students: Student[] = [];
  classes: SchoolClass[] = [];
  sessions: AcademicSession[] = [];
  terms: AcademicTerm[] = [];
  results: StudentResult[] = [];

  filteredStudents: Student[] = [];
  filteredTerms: AcademicTerm[] = [];


  /* =====================================================
     SELECTED FILTERS
  ===================================================== */

  selectedSessionId = '';
  selectedTermId = '';
  selectedClassId = '';
  selectedStudentId = '';


  /* =====================================================
     REPORT DATA
  ===================================================== */

  reportSubjects: ReportSubject[] = [];

  selectedStudent: Student | null = null;
  selectedClass: SchoolClass | null = null;
  selectedSession: AcademicSession | null = null;
  selectedTerm: AcademicTerm | null = null;


  /* =====================================================
     REPORT STATISTICS
  ===================================================== */

  totalSubjects = 0;
  totalMarks = 0;
  averageScore = 0;

  overallGrade = '-';
  overallRemark = '-';


  /* =====================================================
     UI STATE
  ===================================================== */

  loading = false;
  generating = false;

  successMessage = '';
  errorMessage = '';

  reportGenerated = false;


  /* =====================================================
     CONSTRUCTOR
  ===================================================== */

  constructor(
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}


  /* =====================================================
     INIT
  ===================================================== */

  ngOnInit(): void {

    this.loadInitialData();

  }


  /* =====================================================
     LOAD ALL DATA
  ===================================================== */

  async loadInitialData(): Promise<void> {

    this.loading = true;

    this.clearMessages();

    try {

      await Promise.all([
        this.loadStudents(),
        this.loadClasses(),
        this.loadSessions(),
        this.loadTerms(),
        this.loadResults()
      ]);


      this.zone.run(() => {

        this.loading = false;

        this.filterStudents();

        this.filterTerms();

        this.cdr.detectChanges();

      });

    } catch (error) {

      console.error(
        'Error loading report card data:',
        error
      );


      this.zone.run(() => {

        this.loading = false;

        this.errorMessage =
          'Unable to load report card data. Please try again.';

        this.cdr.detectChanges();

      });

    }

  }


  /* =====================================================
     LOAD STUDENTS
  ===================================================== */

  async loadStudents(): Promise<void> {

    const snapshot =
      await get(
        ref(database, 'students')
      );


    const data =
      snapshot.val();


    this.students = [];


    if (!data) {

      return;

    }


    Object.entries(data).forEach(
      ([id, value]: [string, any]) => {

        const student =
          value || {};


        const fullName =
          student.fullName ||
          [
            student.firstName,
            student.middleName,
            student.lastName
          ]
            .filter(Boolean)
            .join(' ');


        this.students.push({

          id,

          studentId:
            student.studentId ||
            student.admissionNumber ||
            id,

          fullName,

          firstName:
            student.firstName || '',

          middleName:
            student.middleName || '',

          lastName:
            student.lastName || '',

          classId:
            student.classId || '',

          className:
            student.className || '',

          section:
            student.section || '',

          status:
            student.status || 'active'

        });

      }
    );


    this.students.sort(
      (a, b) =>
        a.fullName.localeCompare(
          b.fullName
        )
    );

  }


  /* =====================================================
     LOAD CLASSES
  ===================================================== */

  async loadClasses(): Promise<void> {

    const snapshot =
      await get(
        ref(database, 'classes')
      );


    const data =
      snapshot.val();


    this.classes = [];


    if (!data) {

      return;

    }


    Object.entries(data).forEach(
      ([id, value]: [string, any]) => {

        const schoolClass =
          value || {};


        this.classes.push({

          id,

          classCode:
            schoolClass.classCode || '',

          className:
            schoolClass.className || '',

          section:
            schoolClass.section || '',

          status:
            schoolClass.status || 'active'

        });

      }
    );


    this.classes.sort(
      (a, b) =>
        a.className.localeCompare(
          b.className
        )
    );

  }


  /* =====================================================
     LOAD SESSIONS
  ===================================================== */

  async loadSessions(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'academicSessions'
        )
      );


    const data =
      snapshot.val();


    this.sessions = [];


    if (!data) {

      return;

    }


    Object.entries(data).forEach(
      ([id, value]: [string, any]) => {

        const session =
          value || {};


        this.sessions.push({

          id,

          name:
            session.name || '',

          status:
            session.status || 'active'

        });

      }
    );


    this.sessions.sort(
      (a, b) =>
        b.name.localeCompare(
          a.name
        )
    );

  }


  /* =====================================================
     LOAD TERMS
  ===================================================== */

  async loadTerms(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'academicTerms'
        )
      );


    const data =
      snapshot.val();


    this.terms = [];


    if (!data) {

      return;

    }


    Object.entries(data).forEach(
      ([id, value]: [string, any]) => {

        const term =
          value || {};


        this.terms.push({

          id,

          sessionId:
            term.sessionId || '',

          sessionName:
            term.sessionName || '',

          name:
            term.name || '',

          status:
            term.status || 'active'

        });

      }
    );

  }


  /* =====================================================
     LOAD RESULTS
  ===================================================== */

  async loadResults(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'results'
        )
      );


    const data =
      snapshot.val();


    this.results = [];


    if (!data) {

      return;

    }


    Object.entries(data).forEach(
      ([id, value]: [string, any]) => {

        const result =
          value || {};


        this.results.push({

          id,

          studentId:
            result.studentId || '',

          studentName:
            result.studentName || '',

          classId:
            result.classId || '',

          className:
            result.className || '',

          subjectId:
            result.subjectId || '',

          subjectName:
            result.subjectName || '',

          teacherId:
            result.teacherId || '',

          teacherName:
            result.teacherName || '',

          sessionId:
            result.sessionId || '',

          sessionName:
            result.sessionName || '',

          termId:
            result.termId || '',

          termName:
            result.termName || '',

          ca1:
            Number(result.ca1) || 0,

          ca2:
            Number(result.ca2) || 0,

          exam:
            Number(result.exam) || 0,

          total:
            Number(result.total) || 0,

          grade:
            result.grade || '',

          remark:
            result.remark || '',

          status:
            result.status === 'published'
              ? 'published'
              : 'draft',

          createdAt:
            result.createdAt || 0,

          updatedAt:
            result.updatedAt || 0

        });

      }
    );

  }


  /* =====================================================
     SESSION CHANGE
  ===================================================== */

  onSessionChange(): void {

    this.selectedTermId = '';

    this.selectedStudentId = '';

    this.reportGenerated = false;

    this.clearReport();

    this.filterTerms();

  }


  /* =====================================================
     TERM FILTER
  ===================================================== */

  filterTerms(): void {

    if (!this.selectedSessionId) {

      this.filteredTerms = [];

      return;

    }


    this.filteredTerms =
      this.terms.filter(
        term =>
          term.sessionId ===
          this.selectedSessionId
      );

  }


  /* =====================================================
     CLASS CHANGE
  ===================================================== */

  onClassChange(): void {

    this.selectedStudentId = '';

    this.reportGenerated = false;

    this.clearReport();

    this.filterStudents();

  }


  /* =====================================================
     FILTER STUDENTS BY CLASS
  ===================================================== */

  filterStudents(): void {

    if (!this.selectedClassId) {

      this.filteredStudents = [];

      return;

    }


    this.filteredStudents =
      this.students.filter(
        student =>
          student.classId ===
          this.selectedClassId
      );


    console.log(
      'Selected class:',
      this.selectedClassId
    );

    console.log(
      'Students in selected class:',
      this.filteredStudents
    );

  }


  /* =====================================================
     STUDENT CHANGE
  ===================================================== */

  onStudentChange(): void {

    this.reportGenerated = false;

    this.clearReport();


    console.log(
      'Selected student ID:',
      this.selectedStudentId
    );

  }


  /* =====================================================
     GENERATE REPORT
  ===================================================== */

  async generateReport(): Promise<void> {

    this.clearMessages();


    // ===================================================
    // VALIDATE SESSION
    // ===================================================

    if (!this.selectedSessionId) {

      this.errorMessage =
        'Please select an academic session.';

      return;

    }


    // ===================================================
    // VALIDATE TERM
    // ===================================================

    if (!this.selectedTermId) {

      this.errorMessage =
        'Please select an academic term.';

      return;

    }


    // ===================================================
    // VALIDATE CLASS
    // ===================================================

    if (!this.selectedClassId) {

      this.errorMessage =
        'Please select a class.';

      return;

    }


    // ===================================================
    // VALIDATE STUDENT
    // ===================================================

    if (!this.selectedStudentId) {

      this.errorMessage =
        'Please select a student.';

      return;

    }


    // ===================================================
    // FIND SELECTED STUDENT
    // ===================================================

    const student =
      this.students.find(
        item =>
          item.id ===
          this.selectedStudentId
      );


    if (!student) {

      this.errorMessage =
        'The selected student could not be found. Please select the student again.';

      return;

    }


    // ===================================================
    // START GENERATION
    // ===================================================

    this.generating = true;


    try {

      // -------------------------------------------------
      // SELECT STUDENT
      // -------------------------------------------------

      this.selectedStudent =
        student;


      // -------------------------------------------------
      // SELECT CLASS
      // -------------------------------------------------

      this.selectedClass =
        this.classes.find(
          schoolClass =>
            schoolClass.id ===
            this.selectedClassId
        ) || null;


      // -------------------------------------------------
      // SELECT SESSION
      // -------------------------------------------------

      this.selectedSession =
        this.sessions.find(
          session =>
            session.id ===
            this.selectedSessionId
        ) || null;


      // -------------------------------------------------
      // SELECT TERM
      // -------------------------------------------------

      this.selectedTerm =
        this.terms.find(
          term =>
            term.id ===
            this.selectedTermId
        ) || null;


      // =================================================
      // FIND PUBLISHED RESULTS
      // =================================================

      const studentResults =
        this.results.filter(
          result => {

            /*
             * A result may store either:
             *
             * 1. Firebase student record ID
             * OR
             * 2. Actual student/admission ID
             *
             * We support both.
             */

            const matchesStudent =
              result.studentId ===
                student.id ||

              result.studentId ===
                student.studentId;


            const matchesClass =
              result.classId ===
              this.selectedClassId;


            const matchesSession =
              result.sessionId ===
              this.selectedSessionId;


            const matchesTerm =
              result.termId ===
              this.selectedTermId;


            const isPublished =
              result.status ===
              'published';


            return (
              matchesStudent &&
              matchesClass &&
              matchesSession &&
              matchesTerm &&
              isPublished
            );

          }
        );


      // =================================================
      // BUILD REPORT SUBJECTS
      // =================================================

      this.reportSubjects =
        studentResults.map(
          result => ({

            subjectName:
              result.subjectName,

            teacherName:
              result.teacherName || '-',

            ca1:
              result.ca1,

            ca2:
              result.ca2,

            exam:
              result.exam,

            total:
              result.total,

            grade:
              result.grade,

            remark:
              result.remark

          })
        );


      // =================================================
      // CALCULATE STATISTICS
      // =================================================

      this.calculateReportStatistics();


      // =================================================
      // UPDATE UI
      // =================================================

      this.zone.run(() => {

        this.reportGenerated = true;

        this.generating = false;

        this.cdr.detectChanges();

      });


      // =================================================
      // RESULT MESSAGE
      // =================================================

      if (
        this.reportSubjects.length === 0
      ) {

        this.errorMessage =
          'No published results were found for this student for the selected session and term.';

      } else {

        this.successMessage =
          'Report card generated successfully.';

      }


    } catch (error) {

      console.error(
        'Error generating report:',
        error
      );


      this.zone.run(() => {

        this.generating = false;

        this.errorMessage =
          'Unable to generate the report card.';

        this.cdr.detectChanges();

      });

    }

  }


  /* =====================================================
     CALCULATE REPORT STATISTICS
  ===================================================== */

  calculateReportStatistics(): void {

    this.totalSubjects =
      this.reportSubjects.length;


    this.totalMarks =
      this.reportSubjects.reduce(
        (sum, subject) =>
          sum +
          Number(subject.total || 0),
        0
      );


    this.averageScore =
      this.totalSubjects > 0
        ? this.totalMarks /
          this.totalSubjects
        : 0;


    this.overallGrade =
      this.getGrade(
        this.averageScore
      );


    this.overallRemark =
      this.getRemark(
        this.averageScore
      );

  }


  /* =====================================================
     GRADE
  ===================================================== */

  getGrade(score: number): string {

    if (score >= 80) {

      return 'A';

    }


    if (score >= 70) {

      return 'B';

    }


    if (score >= 60) {

      return 'C';

    }


    if (score >= 50) {

      return 'D';

    }


    if (score >= 40) {

      return 'E';

    }


    return 'F';

  }


  /* =====================================================
     REMARK
  ===================================================== */

  getRemark(score: number): string {

    if (score >= 80) {

      return 'Excellent';

    }


    if (score >= 70) {

      return 'Very Good';

    }


    if (score >= 60) {

      return 'Good';

    }


    if (score >= 50) {

      return 'Pass';

    }


    if (score >= 40) {

      return 'Needs Improvement';

    }


    return 'Fail';

  }


  /* =====================================================
     CLEAR REPORT
  ===================================================== */

  clearReport(): void {

    this.reportSubjects = [];

    this.selectedStudent = null;

    this.selectedClass = null;

    this.selectedSession = null;

    this.selectedTerm = null;

    this.totalSubjects = 0;

    this.totalMarks = 0;

    this.averageScore = 0;

    this.overallGrade = '-';

    this.overallRemark = '-';

  }


  /* =====================================================
     CLEAR MESSAGES
  ===================================================== */

  clearMessages(): void {

    this.successMessage = '';

    this.errorMessage = '';

  }


  /* =====================================================
     PRINT REPORT
  ===================================================== */

  printReport(): void {

    if (!this.reportGenerated) {

      return;

    }


    window.print();

  }

}