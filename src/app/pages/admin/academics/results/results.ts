import {
  NgFor,
  NgIf
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
  push,
  ref,
  remove,
  update
} from 'firebase/database';

import { database } from '../../../../core/firebase.config';


interface Student {
  id: string;
  studentId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  classId?: string;
  className?: string;
  status: string;
}


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
  createdAt: number;
  updatedAt?: number;
}


interface SchoolSubject {
  id: string;
  subjectCode: string;
  subjectName: string;
  category: string;
  description: string;
  status: string;
  createdAt: number;
  updatedAt?: number;
}


interface StaffMember {
  id: string;
  staffId: string;
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  position: string;
  department: string;
  qualification: string;
  employmentDate: string;
  address: string;
  emergencyContact: string;
  status: string;
  createdAt: number;
  updatedAt?: number;
}


interface TeachingAssignment {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;

  className: string;
  subjectName: string;
  teacherName: string;

  createdAt: number;
  updatedAt?: number;
}


interface AcademicSession {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: number;
  updatedAt?: number;
}


interface AcademicTerm {
  id: string;
  sessionId: string;
  sessionName: string;

  name:
    | 'First Term'
    | 'Second Term'
    | 'Third Term';

  status: 'active' | 'inactive';

  createdAt: number;
  updatedAt?: number;
}


interface AcademicResult {
  id: string;

  studentId: string;
  studentName: string;

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


@Component({
  selector: 'app-results',

  standalone: true,

  imports: [
    NgFor,
    NgIf,
    FormsModule
  ],

  templateUrl: './results.html',

  styleUrl: './results.css'
})
export class Results implements OnInit {

  students: Student[] = [];

  classes: SchoolClass[] = [];

  subjects: SchoolSubject[] = [];

  staff: StaffMember[] = [];

  teachingAssignments: TeachingAssignment[] = [];

  sessions: AcademicSession[] = [];

  terms: AcademicTerm[] = [];

  results: AcademicResult[] = [];


  totalResults = 0;

  publishedResults = 0;

  draftResults = 0;

  passedResults = 0;

  failedResults = 0;


  searchTerm = '';

  classFilter = '';

  subjectFilter = '';

  sessionFilter = '';

  termFilter = '';

  statusFilter = '';


  loading = false;

  saving = false;

  updating = false;

  deleting = false;


  successMessage = '';

  errorMessage = '';


  showAddResult = false;

  showResultDetails = false;

  showEditResult = false;

  showDeleteResult = false;


  selectedResult: AcademicResult | null = null;

  resultToDelete: AcademicResult | null = null;


  newResult = {

    studentId: '',

    classId: '',

    subjectId: '',

    teacherId: '',

    sessionId: '',

    termId: '',

    ca1: 0,

    ca2: 0,

    exam: 0,

    status: 'draft' as 'draft' | 'published'

  };


  editResultData = {

    id: '',

    studentId: '',

    classId: '',

    subjectId: '',

    teacherId: '',

    sessionId: '',

    termId: '',

    ca1: 0,

    ca2: 0,

    exam: 0,

    status: 'draft' as 'draft' | 'published'

  };


  constructor(

    private cdr: ChangeDetectorRef,

    private ngZone: NgZone

  ) {}


  ngOnInit(): void {

    this.loadData();

  }


  async loadData(): Promise<void> {

    this.loading = true;

    this.clearMessages();

    this.cdr.detectChanges();


    try {

      await Promise.all([

        this.loadStudents(),

        this.loadClasses(),

        this.loadSubjects(),

        this.loadStaff(),

        this.loadTeachingAssignments(),

        this.loadSessions()

      ]);


      await this.loadTerms();

      await this.loadResults();


      this.ngZone.run(() => {

        this.calculateStatistics();

      });


    } catch (error) {

      console.error(
        'Error loading academic results:',
        error
      );


      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to load academic results. Please try again.';

      });

    } finally {

      this.ngZone.run(() => {

        this.loading = false;

        this.cdr.detectChanges();

      });

    }

  }


  async loadStudents(): Promise<void> {

    const snapshot =
      await get(ref(database, 'students'));


    if (!snapshot.exists()) {

      this.students = [];

      return;

    }


    const data = snapshot.val();


    this.students = Object.entries(data)

      .map(([id, value]: [string, any]) => {

        const fullName =
          value.fullName ||
          value.name ||
          `${value.firstName || ''} ${value.lastName || ''}`.trim();


        return {

          id,

          studentId:
            value.studentId ||
            id,

          fullName,

          firstName:
            value.firstName,

          lastName:
            value.lastName,

          classId:
            value.classId ||
            '',

          className:
            value.className ||
            '',

          status:
            value.status ||
            'active'

        };

      })

      .filter(
        student =>
          student.status === 'active'
      )

      .sort(
        (a, b) =>
          a.fullName.localeCompare(b.fullName)
      );

  }


  async loadClasses(): Promise<void> {

    const snapshot =
      await get(ref(database, 'classes'));


    if (!snapshot.exists()) {

      this.classes = [];

      return;

    }


    const data = snapshot.val();


    this.classes = Object.entries(data)

      .map(([id, value]: [string, any]) => ({

        id,

        classCode:
          value.classCode ||
          '',

        className:
          value.className ||
          '',

        section:
          value.section ||
          '',

        classTeacherId:
          value.classTeacherId ||
          '',

        classTeacherName:
          value.classTeacherName ||
          '',

        room:
          value.room ||
          '',

        capacity:
          Number(value.capacity) ||
          0,

        academicYear:
          value.academicYear ||
          '',

        status:
          value.status ||
          'inactive',

        description:
          value.description ||
          '',

        createdAt:
          value.createdAt ||
          0,

        updatedAt:
          value.updatedAt

      }))

      .filter(
        schoolClass =>
          schoolClass.status === 'active'
      )

      .sort(
        (a, b) =>
          a.className.localeCompare(b.className)
      );

  }


  async loadSubjects(): Promise<void> {

    const snapshot =
      await get(ref(database, 'subjects'));


    if (!snapshot.exists()) {

      this.subjects = [];

      return;

    }


    const data = snapshot.val();


    this.subjects = Object.entries(data)

      .map(([id, value]: [string, any]) => ({

        id,

        subjectCode:
          value.subjectCode ||
          '',

        subjectName:
          value.subjectName ||
          '',

        category:
          value.category ||
          '',

        description:
          value.description ||
          '',

        status:
          value.status ||
          'inactive',

        createdAt:
          value.createdAt ||
          0,

        updatedAt:
          value.updatedAt

      }))

      .filter(
        subject =>
          subject.status === 'active'
      )

      .sort(
        (a, b) =>
          a.subjectName.localeCompare(
            b.subjectName
          )
      );

  }


  async loadStaff(): Promise<void> {

    const snapshot =
      await get(ref(database, 'staff'));


    if (!snapshot.exists()) {

      this.staff = [];

      return;

    }


    const data = snapshot.val();


    this.staff = Object.entries(data)

      .map(([id, value]: [string, any]) => ({

        id,

        staffId:
          value.staffId ||
          id,

        fullName:
          value.fullName ||
          '',

        email:
          value.email ||
          '',

        phone:
          value.phone ||
          '',

        gender:
          value.gender ||
          '',

        position:
          value.position ||
          '',

        department:
          value.department ||
          '',

        qualification:
          value.qualification ||
          '',

        employmentDate:
          value.employmentDate ||
          '',

        address:
          value.address ||
          '',

        emergencyContact:
          value.emergencyContact ||
          '',

        status:
          value.status ||
          'inactive',

        createdAt:
          value.createdAt ||
          0,

        updatedAt:
          value.updatedAt

      }))

      .filter(
        teacher =>
          teacher.status === 'active'
      )

      .sort(
        (a, b) =>
          a.fullName.localeCompare(
            b.fullName
          )
      );

  }


  async loadTeachingAssignments(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'teachingAssignments'
        )
      );


    if (!snapshot.exists()) {

      this.teachingAssignments = [];

      return;

    }


    const data = snapshot.val();


    this.teachingAssignments =
      Object.entries(data)

        .map(([id, value]: [string, any]) => {

          const schoolClass =
            this.classes.find(
              item =>
                item.id ===
                value.classId
            );


          const subject =
            this.subjects.find(
              item =>
                item.id ===
                value.subjectId
            );


          const teacher =
            this.staff.find(
              item =>
                item.id ===
                value.teacherId
            );


          return {

            id,

            classId:
              value.classId ||
              '',

            subjectId:
              value.subjectId ||
              '',

            teacherId:
              value.teacherId ||
              '',

            className:
              schoolClass?.className ||
              value.className ||
              'Unknown Class',

            subjectName:
              subject?.subjectName ||
              value.subjectName ||
              'Unknown Subject',

            teacherName:
              teacher?.fullName ||
              value.teacherName ||
              'Unknown Teacher',

            createdAt:
              value.createdAt ||
              0,

            updatedAt:
              value.updatedAt

          };

        });

  }


  async loadSessions(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'academicSessions'
        )
      );


    if (!snapshot.exists()) {

      this.sessions = [];

      return;

    }


    const data = snapshot.val();


    this.sessions = Object.entries(data)

      .map(([id, value]: [string, any]) => ({

        id,

        name:
          value.name ||
          '',

        status:
          value.status ||
          'inactive',

        createdAt:
          value.createdAt ||
          0,

        updatedAt:
          value.updatedAt

      }))

      .filter(
        session =>
          session.status === 'active'
      )

      .sort(
        (a, b) =>
          b.createdAt -
          a.createdAt
      );

  }


  async loadTerms(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'academicTerms'
        )
      );


    if (!snapshot.exists()) {

      this.terms = [];

      return;

    }


    const data = snapshot.val();


    this.terms = Object.entries(data)

      .map(([id, value]: [string, any]) => {

        const session =
          this.sessions.find(
            item =>
              item.id ===
              value.sessionId
          );


        return {

          id,

          sessionId:
            value.sessionId ||
            '',

          sessionName:
            session?.name ||
            value.sessionName ||
            'Unknown Session',

          name:
            value.name ||
            'First Term',

          status:
            value.status ||
            'inactive',

          createdAt:
            value.createdAt ||
            0,

          updatedAt:
            value.updatedAt

        };

      })

      .filter(
        term =>
          term.status === 'active'
      )

      .sort(
        (a, b) =>
          b.createdAt -
          a.createdAt
      );

  }


  async loadResults(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'results'
        )
      );


    if (!snapshot.exists()) {

      this.results = [];

      return;

    }


    const data = snapshot.val();


    this.results = Object.entries(data)

      .map(([id, value]: [string, any]) => {

        return {

          id,

          studentId:
            value.studentId ||
            '',

          studentName:
            value.studentName ||
            'Unknown Student',

          classId:
            value.classId ||
            '',

          className:
            value.className ||
            'Unknown Class',

          subjectId:
            value.subjectId ||
            '',

          subjectName:
            value.subjectName ||
            'Unknown Subject',

          teacherId:
            value.teacherId ||
            '',

          teacherName:
            value.teacherName ||
            'Unknown Teacher',

          sessionId:
            value.sessionId ||
            '',

          sessionName:
            value.sessionName ||
            'Unknown Session',

          termId:
            value.termId ||
            '',

          termName:
            value.termName ||
            'Unknown Term',

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
            value.status ||
            'draft',

          createdAt:
            value.createdAt ||
            0,

          updatedAt:
            value.updatedAt

        };

      })

      .sort(
        (a, b) =>
          b.createdAt -
          a.createdAt
      );

  }


  get filteredResults(): AcademicResult[] {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    return this.results.filter(
      result => {

        const matchesSearch =

          !search ||

          result.studentName
            .toLowerCase()
            .includes(search) ||

          result.subjectName
            .toLowerCase()
            .includes(search) ||

          result.className
            .toLowerCase()
            .includes(search) ||

          result.teacherName
            .toLowerCase()
            .includes(search);


        const matchesClass =
          !this.classFilter ||
          result.classId ===
            this.classFilter;


        const matchesSubject =
          !this.subjectFilter ||
          result.subjectId ===
            this.subjectFilter;


        const matchesSession =
          !this.sessionFilter ||
          result.sessionId ===
            this.sessionFilter;


        const matchesTerm =
          !this.termFilter ||
          result.termId ===
            this.termFilter;


        const matchesStatus =
          !this.statusFilter ||
          result.status ===
            this.statusFilter;


        return (

          matchesSearch &&

          matchesClass &&

          matchesSubject &&

          matchesSession &&

          matchesTerm &&

          matchesStatus

        );

      }

    );

  }


  calculateStatistics(): void {

    this.totalResults =
      this.results.length;


    this.publishedResults =
      this.results.filter(
        result =>
          result.status ===
          'published'
      ).length;


    this.draftResults =
      this.results.filter(
        result =>
          result.status ===
          'draft'
      ).length;


    this.passedResults =
      this.results.filter(
        result =>
          result.total >= 40
      ).length;


    this.failedResults =
      this.results.filter(
        result =>
          result.total < 40
      ).length;

  }


  get availableSubjects(): SchoolSubject[] {

    if (!this.newResult.classId) {

      return [];

    }


    const subjectIds =
      this.teachingAssignments

        .filter(
          assignment =>
            assignment.classId ===
            this.newResult.classId
        )

        .map(
          assignment =>
            assignment.subjectId
        );


    return this.subjects.filter(
      subject =>
        subjectIds.includes(
          subject.id
        )
    );

  }


  get availableTeachers(): StaffMember[] {

    if (
      !this.newResult.classId ||
      !this.newResult.subjectId
    ) {

      return [];

    }


    const teacherIds =
      this.teachingAssignments

        .filter(
          assignment =>

            assignment.classId ===
            this.newResult.classId &&

            assignment.subjectId ===
            this.newResult.subjectId

        )

        .map(
          assignment =>
            assignment.teacherId
        );


    return this.staff.filter(
      teacher =>
        teacherIds.includes(
          teacher.id
        )
    );

  }


  get availableEditSubjects(): SchoolSubject[] {

    if (!this.editResultData.classId) {

      return [];

    }


    const subjectIds =
      this.teachingAssignments

        .filter(
          assignment =>
            assignment.classId ===
            this.editResultData.classId
        )

        .map(
          assignment =>
            assignment.subjectId
        );


    return this.subjects.filter(
      subject =>
        subjectIds.includes(
          subject.id
        )
    );

  }


  get availableEditTeachers(): StaffMember[] {

    if (
      !this.editResultData.classId ||
      !this.editResultData.subjectId
    ) {

      return [];

    }


    const teacherIds =
      this.teachingAssignments

        .filter(
          assignment =>

            assignment.classId ===
            this.editResultData.classId &&

            assignment.subjectId ===
            this.editResultData.subjectId

        )

        .map(
          assignment =>
            assignment.teacherId
        );


    return this.staff.filter(
      teacher =>
        teacherIds.includes(
          teacher.id
        )
    );

  }


  get studentsForSelectedClass(): Student[] {

    if (!this.newResult.classId) {

      return this.students;

    }


    const selectedClass =
      this.classes.find(
        item =>
          item.id ===
          this.newResult.classId
      );


    return this.students.filter(
      student => {

        if (
          student.classId
        ) {

          return (
            student.classId ===
            this.newResult.classId
          );

        }


        if (
          student.className &&
          selectedClass
        ) {

          return (
            student.className
              .toLowerCase() ===
            selectedClass.className
              .toLowerCase()
          );

        }


        return true;

      }

    );

  }


  get studentsForEditClass(): Student[] {

    if (!this.editResultData.classId) {

      return this.students;

    }


    const selectedClass =
      this.classes.find(
        item =>
          item.id ===
          this.editResultData.classId
      );


    return this.students.filter(
      student => {

        if (
          student.classId
        ) {

          return (
            student.classId ===
            this.editResultData.classId
          );

        }


        if (
          student.className &&
          selectedClass
        ) {

          return (
            student.className
              .toLowerCase() ===
            selectedClass.className
              .toLowerCase()
          );

        }


        return true;

      }

    );

  }


  onNewClassChange(): void {

    this.newResult.studentId = '';

    this.newResult.subjectId = '';

    this.newResult.teacherId = '';

  }


  onNewSubjectChange(): void {

    this.newResult.teacherId = '';

  }


  onEditClassChange(): void {

    this.editResultData.studentId = '';

    this.editResultData.subjectId = '';

    this.editResultData.teacherId = '';

  }


  onEditSubjectChange(): void {

    this.editResultData.teacherId = '';

  }


  calculateTotal(
    ca1: number,
    ca2: number,
    exam: number
  ): number {

    const first =
      Number(ca1) || 0;

    const second =
      Number(ca2) || 0;

    const examination =
      Number(exam) || 0;


    return Math.min(
      100,
      first +
      second +
      examination
    );

  }


  getGrade(total: number): string {

    if (total >= 70) {

      return 'A';

    }

    if (total >= 60) {

      return 'B';

    }

    if (total >= 50) {

      return 'C';

    }

    if (total >= 45) {

      return 'D';

    }

    if (total >= 40) {

      return 'E';

    }

    return 'F';

  }


  getRemark(total: number): string {

    if (total >= 70) {

      return 'Excellent';

    }

    if (total >= 60) {

      return 'Very Good';

    }

    if (total >= 50) {

      return 'Good';

    }

    if (total >= 45) {

      return 'Fair';

    }

    if (total >= 40) {

      return 'Pass';

    }

    return 'Fail';

  }


  getNewResultTotal(): number {

    return this.calculateTotal(

      this.newResult.ca1,

      this.newResult.ca2,

      this.newResult.exam

    );

  }


  getNewResultGrade(): string {

    return this.getGrade(
      this.getNewResultTotal()
    );

  }


  getNewResultRemark(): string {

    return this.getRemark(
      this.getNewResultTotal()
    );

  }


  getEditResultTotal(): number {

    return this.calculateTotal(

      this.editResultData.ca1,

      this.editResultData.ca2,

      this.editResultData.exam

    );

  }


  getEditResultGrade(): string {

    return this.getGrade(
      this.getEditResultTotal()
    );

  }


  getEditResultRemark(): string {

    return this.getRemark(
      this.getEditResultTotal()
    );

  }


  async saveResult(): Promise<void> {

    if (!this.newResult.studentId) {

      this.errorMessage =
        'Please select a student.';

      return;

    }


    if (!this.newResult.classId) {

      this.errorMessage =
        'Please select a class.';

      return;

    }


    if (!this.newResult.subjectId) {

      this.errorMessage =
        'Please select a subject.';

      return;

    }


    if (!this.newResult.teacherId) {

      this.errorMessage =
        'Please select the assigned teacher.';

      return;

    }


    if (!this.newResult.sessionId) {

      this.errorMessage =
        'Please select an academic session.';

      return;

    }


    if (!this.newResult.termId) {

      this.errorMessage =
        'Please select an academic term.';

      return;

    }


    if (
      this.newResult.ca1 < 0 ||
      this.newResult.ca1 > 20
    ) {

      this.errorMessage =
        'CA1 must be between 0 and 20.';

      return;

    }


    if (
      this.newResult.ca2 < 0 ||
      this.newResult.ca2 > 20
    ) {

      this.errorMessage =
        'CA2 must be between 0 and 20.';

      return;

    }


    if (
      this.newResult.exam < 0 ||
      this.newResult.exam > 60
    ) {

      this.errorMessage =
        'Exam must be between 0 and 60.';

      return;

    }


    const duplicate =
      this.results.some(

        result =>

          result.studentId ===
          this.newResult.studentId &&

          result.subjectId ===
          this.newResult.subjectId &&

          result.sessionId ===
          this.newResult.sessionId &&

          result.termId ===
          this.newResult.termId

      );


    if (duplicate) {

      this.errorMessage =
        'A result already exists for this student, subject, session and term.';

      return;

    }


    const assignment =
      this.teachingAssignments.find(

        item =>

          item.classId ===
          this.newResult.classId &&

          item.subjectId ===
          this.newResult.subjectId &&

          item.teacherId ===
          this.newResult.teacherId

      );


    if (!assignment) {

      this.errorMessage =
        'The selected teacher is not assigned to this subject for the selected class.';

      return;

    }


    this.saving = true;

    this.clearMessages();


    try {

      const student =
        this.students.find(
          item =>
            item.id ===
            this.newResult.studentId
        );


      const schoolClass =
        this.classes.find(
          item =>
            item.id ===
            this.newResult.classId
        );


      const subject =
        this.subjects.find(
          item =>
            item.id ===
            this.newResult.subjectId
        );


      const teacher =
        this.staff.find(
          item =>
            item.id ===
            this.newResult.teacherId
        );


      const session =
        this.sessions.find(
          item =>
            item.id ===
            this.newResult.sessionId
        );


      const term =
        this.terms.find(
          item =>
            item.id ===
            this.newResult.termId
        );


      const resultRef =
        push(
          ref(
            database,
            'results'
          )
        );


      const now =
        Date.now();


      const total =
        this.getNewResultTotal();


      const result: AcademicResult = {

        id:
          resultRef.key!,

        studentId:
          this.newResult.studentId,

        studentName:
          student?.fullName ||
          'Unknown Student',

        classId:
          this.newResult.classId,

        className:
          schoolClass?.className ||
          'Unknown Class',

        subjectId:
          this.newResult.subjectId,

        subjectName:
          subject?.subjectName ||
          'Unknown Subject',

        teacherId:
          this.newResult.teacherId,

        teacherName:
          teacher?.fullName ||
          'Unknown Teacher',

        sessionId:
          this.newResult.sessionId,

        sessionName:
          session?.name ||
          'Unknown Session',

        termId:
          this.newResult.termId,

        termName:
          term?.name ||
          'Unknown Term',

        ca1:
          Number(
            this.newResult.ca1
          ),

        ca2:
          Number(
            this.newResult.ca2
          ),

        exam:
          Number(
            this.newResult.exam
          ),

        total,

        grade:
          this.getGrade(total),

        remark:
          this.getRemark(total),

        status:
          this.newResult.status,

        createdAt:
          now

      };


      await update(
        resultRef,
        result
      );


      this.ngZone.run(() => {

        this.results.unshift(
          result
        );

        this.calculateStatistics();

        this.successMessage =
          'Academic result saved successfully.';

        this.showAddResult =
          false;

        this.resetNewResult();

        this.saving =
          false;

        this.cdr.detectChanges();

      });


    } catch (error) {

      console.error(
        'Error saving result:',
        error
      );


      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to save academic result. Please try again.';

        this.saving =
          false;

        this.cdr.detectChanges();

      });

    }

  }


  viewResult(
    result: AcademicResult
  ): void {

    this.clearMessages();

    this.selectedResult =
      result;

    this.showResultDetails =
      true;

  }


  closeResultDetails(): void {

    this.showResultDetails =
      false;

    this.selectedResult =
      null;

  }


  openAddResult(): void {

    this.clearMessages();

    this.resetNewResult();

    this.showAddResult =
      true;

  }


  closeAddResult(): void {

    this.showAddResult =
      false;

  }


  openEditResult(
    result: AcademicResult
  ): void {

    this.clearMessages();


    this.editResultData = {

      id:
        result.id,

      studentId:
        result.studentId,

      classId:
        result.classId,

      subjectId:
        result.subjectId,

      teacherId:
        result.teacherId,

      sessionId:
        result.sessionId,

      termId:
        result.termId,

      ca1:
        result.ca1,

      ca2:
        result.ca2,

      exam:
        result.exam,

      status:
        result.status

    };


    this.showEditResult =
      true;

  }


  closeEditResult(): void {

    this.showEditResult =
      false;

  }


  async updateResult(): Promise<void> {

    if (!this.editResultData.studentId) {

      this.errorMessage =
        'Please select a student.';

      return;

    }


    if (!this.editResultData.classId) {

      this.errorMessage =
        'Please select a class.';

      return;

    }


    if (!this.editResultData.subjectId) {

      this.errorMessage =
        'Please select a subject.';

      return;

    }


    if (!this.editResultData.teacherId) {

      this.errorMessage =
        'Please select the assigned teacher.';

      return;

    }


    if (!this.editResultData.sessionId) {

      this.errorMessage =
        'Please select an academic session.';

      return;

    }


    if (!this.editResultData.termId) {

      this.errorMessage =
        'Please select an academic term.';

      return;

    }


    if (
      this.editResultData.ca1 < 0 ||
      this.editResultData.ca1 > 20
    ) {

      this.errorMessage =
        'CA1 must be between 0 and 20.';

      return;

    }


    if (
      this.editResultData.ca2 < 0 ||
      this.editResultData.ca2 > 20
    ) {

      this.errorMessage =
        'CA2 must be between 0 and 20.';

      return;

    }


    if (
      this.editResultData.exam < 0 ||
      this.editResultData.exam > 60
    ) {

      this.errorMessage =
        'Exam must be between 0 and 60.';

      return;

    }


    const duplicate =
      this.results.some(

        result =>

          result.id !==
          this.editResultData.id &&

          result.studentId ===
          this.editResultData.studentId &&

          result.subjectId ===
          this.editResultData.subjectId &&

          result.sessionId ===
          this.editResultData.sessionId &&

          result.termId ===
          this.editResultData.termId

      );


    if (duplicate) {

      this.errorMessage =
        'Another result already exists for this student, subject, session and term.';

      return;

    }


    const assignment =
      this.teachingAssignments.find(

        item =>

          item.classId ===
          this.editResultData.classId &&

          item.subjectId ===
          this.editResultData.subjectId &&

          item.teacherId ===
          this.editResultData.teacherId

      );


    if (!assignment) {

      this.errorMessage =
        'The selected teacher is not assigned to this subject for the selected class.';

      return;

    }


    this.updating =
      true;

    this.clearMessages();


    try {

      const student =
        this.students.find(
          item =>
            item.id ===
            this.editResultData.studentId
        );


      const schoolClass =
        this.classes.find(
          item =>
            item.id ===
            this.editResultData.classId
        );


      const subject =
        this.subjects.find(
          item =>
            item.id ===
            this.editResultData.subjectId
        );


      const teacher =
        this.staff.find(
          item =>
            item.id ===
            this.editResultData.teacherId
        );


      const session =
        this.sessions.find(
          item =>
            item.id ===
            this.editResultData.sessionId
        );


      const term =
        this.terms.find(
          item =>
            item.id ===
            this.editResultData.termId
        );


      const total =
        this.getEditResultTotal();


      const now =
        Date.now();


      await update(

        ref(
          database,
          `results/${this.editResultData.id}`
        ),

        {

          studentId:
            this.editResultData.studentId,

          studentName:
            student?.fullName ||
            'Unknown Student',

          classId:
            this.editResultData.classId,

          className:
            schoolClass?.className ||
            'Unknown Class',

          subjectId:
            this.editResultData.subjectId,

          subjectName:
            subject?.subjectName ||
            'Unknown Subject',

          teacherId:
            this.editResultData.teacherId,

          teacherName:
            teacher?.fullName ||
            'Unknown Teacher',

          sessionId:
            this.editResultData.sessionId,

          sessionName:
            session?.name ||
            'Unknown Session',

          termId:
            this.editResultData.termId,

          termName:
            term?.name ||
            'Unknown Term',

          ca1:
            Number(
              this.editResultData.ca1
            ),

          ca2:
            Number(
              this.editResultData.ca2
            ),

          exam:
            Number(
              this.editResultData.exam
            ),

          total,

          grade:
            this.getGrade(total),

          remark:
            this.getRemark(total),

          status:
            this.editResultData.status,

          updatedAt:
            now

        }

      );


      this.ngZone.run(() => {

        const index =
          this.results.findIndex(
            result =>
              result.id ===
              this.editResultData.id
          );


        if (index !== -1) {

          this.results[index] = {

            ...this.results[index],

            studentId:
              this.editResultData.studentId,

            studentName:
              student?.fullName ||
              'Unknown Student',

            classId:
              this.editResultData.classId,

            className:
              schoolClass?.className ||
              'Unknown Class',

            subjectId:
              this.editResultData.subjectId,

            subjectName:
              subject?.subjectName ||
              'Unknown Subject',

            teacherId:
              this.editResultData.teacherId,

            teacherName:
              teacher?.fullName ||
              'Unknown Teacher',

            sessionId:
              this.editResultData.sessionId,

            sessionName:
              session?.name ||
              'Unknown Session',

            termId:
              this.editResultData.termId,

            termName:
              term?.name ||
              'Unknown Term',

            ca1:
              Number(
                this.editResultData.ca1
              ),

            ca2:
              Number(
                this.editResultData.ca2
              ),

            exam:
              Number(
                this.editResultData.exam
              ),

            total,

            grade:
              this.getGrade(total),

            remark:
              this.getRemark(total),

            status:
              this.editResultData.status,

            updatedAt:
              now

          };

        }


        this.calculateStatistics();

        this.successMessage =
          'Academic result updated successfully.';

        this.showEditResult =
          false;

        this.updating =
          false;

        this.cdr.detectChanges();

      });


    } catch (error) {

      console.error(
        'Error updating result:',
        error
      );


      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to update academic result. Please try again.';

        this.updating =
          false;

        this.cdr.detectChanges();

      });

    }

  }


  openDeleteResult(
    result: AcademicResult
  ): void {

    this.clearMessages();

    this.resultToDelete =
      result;

    this.showDeleteResult =
      true;

  }


  closeDeleteResult(): void {

    this.showDeleteResult =
      false;

    this.resultToDelete =
      null;

  }


  async deleteResult(): Promise<void> {

    if (!this.resultToDelete) {

      return;

    }


    const result =
      this.resultToDelete;


    this.deleting =
      true;

    this.clearMessages();


    try {

      await remove(

        ref(
          database,
          `results/${result.id}`
        )

      );


      this.ngZone.run(() => {

        this.results =
          this.results.filter(
            item =>
              item.id !==
              result.id
          );


        this.calculateStatistics();


        this.successMessage =
          'Academic result deleted successfully.';


        this.showDeleteResult =
          false;

        this.resultToDelete =
          null;

        this.deleting =
          false;


        this.cdr.detectChanges();

      });


    } catch (error) {

      console.error(
        'Error deleting result:',
        error
      );


      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to delete academic result. Please try again.';

        this.deleting =
          false;

        this.cdr.detectChanges();

      });

    }

  }


  resetNewResult(): void {

    this.newResult = {

      studentId: '',

      classId: '',

      subjectId: '',

      teacherId: '',

      sessionId: '',

      termId: '',

      ca1: 0,

      ca2: 0,

      exam: 0,

      status: 'draft'

    };

  }


  clearFilters(): void {

    this.searchTerm = '';

    this.classFilter = '';

    this.subjectFilter = '';

    this.sessionFilter = '';

    this.termFilter = '';

    this.statusFilter = '';

  }


  clearMessages(): void {

    this.successMessage = '';

    this.errorMessage = '';

  }

}