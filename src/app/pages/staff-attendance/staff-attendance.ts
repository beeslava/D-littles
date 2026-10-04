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
  push,
  ref,
  remove,
  update,
  query,
  orderByChild,
  equalTo
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

  className?: string;
  subjectName?: string;
  teacherName?: string;

  status?: string;
}


interface SchoolClass {
  id: string;
  className: string;
  section?: string;
  status?: string;
}


interface Student {
  id: string;
  studentId: string;

  fullName: string;

  firstName?: string;
  lastName?: string;

  classId?: string;
  className?: string;

  status?: string;
}


interface AcademicSession {
  id: string;

  name?: string;
  sessionName?: string;
  academicYear?: string;

  status?: string;
}


interface AcademicTerm {
  id: string;

  name?: string;
  termName?: string;

  status?: string;
}


type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'excused';


interface AttendanceRecord {
  id: string;

  date: string;

  classId: string;
  className: string;

  studentId: string;
  studentName: string;

  status: AttendanceStatus;

  remark?: string;

  teacherId: string;
  teacherName: string;

  sessionId: string;
  sessionName: string;

  termId: string;
  termName: string;

  createdAt: number;
  updatedAt: number;
}


interface AttendanceForm {
  studentId: string;

  status: AttendanceStatus;

  remark: string;
}


// =========================================================
// COMPONENT
// =========================================================

@Component({
  selector: 'app-staff-attendance',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],

  templateUrl: './staff-attendance.html',

  styleUrl: './staff-attendance.css'
})
export class StaffAttendance implements OnInit {

  // =======================================================
  // USER / STAFF
  // =======================================================

  currentUser: SchoolUser | null = null;

  /*
   * staffId
   * -------------------------------------------------------
   * Value stored inside:
   *
   * /users/{uid}/staffId
   *
   * Attendance uses this value as teacherId.
   */
  staffId = '';

  /*
   * staffRecordId
   * -------------------------------------------------------
   * Actual Firebase record key under:
   *
   * /staff/{recordId}
   *
   * Teaching assignments use this value.
   */
  staffRecordId = '';

  staffName = '';


  // =======================================================
  // DATA
  // =======================================================

  assignments: StaffAssignment[] = [];

  classes: SchoolClass[] = [];

  students: Student[] = [];

  sessions: AcademicSession[] = [];

  terms: AcademicTerm[] = [];

  attendanceRecords: AttendanceRecord[] = [];


  // =======================================================
  // SELECTION
  // =======================================================

  selectedClassId = '';

  selectedDate = this.getTodayDate();

  selectedSessionId = '';

  selectedTermId = '';


  // =======================================================
  // CURRENT CLASS STUDENTS
  // =======================================================

  classStudents: Student[] = [];

  attendanceForms: AttendanceForm[] = [];


  // =======================================================
  // EDITING
  // =======================================================

  editingAttendanceId = '';

  editingStudentId = '';


  // =======================================================
  // UI STATE
  // =======================================================

  loading = false;

  saving = false;

  deleting = false;

  errorMessage = '';

  successMessage = '';


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

    this.loading = true;

    this.clearMessages();

    try {

      await this.authService.waitForAuthReady();


      const firebaseUser =
        this.authService.getCurrentUser();


      if (!firebaseUser) {

        this.errorMessage =
          'Unable to identify your staff account. Please login again.';

        return;
      }


      const user =
        this.authService.getUserData();


      if (!user) {

        this.errorMessage =
          'Unable to load your staff profile. Please login again.';

        return;
      }


      this.currentUser = user;


      if (user.role !== 'staff') {

        this.errorMessage =
          'You are not authorized to access staff attendance.';

        return;
      }


      this.staffId =
        user.staffId || '';


      if (!this.staffId) {

        this.errorMessage =
          'Your staff ID could not be found.';

        return;
      }


      await this.loadStaffRecord(
        firebaseUser.uid
      );


      if (!this.staffRecordId) {

        this.errorMessage =
          'Your staff record could not be found.';

        return;
      }


      console.log(
        'Firebase UID:',
        firebaseUser.uid
      );

      console.log(
        'Staff ID from /users:',
        this.staffId
      );

      console.log(
        'Staff record key:',
        this.staffRecordId
      );

      console.log(
        'Attendance teacherId will use:',
        this.staffId
      );


      await this.loadClasses();

      await this.loadAssignments();

      await this.loadStudents();

      await this.loadSessions();

      await this.loadTerms();


      // ---------------------------------------------------
      // DEFAULT SESSION
      // ---------------------------------------------------

      if (
        !this.selectedSessionId &&
        this.sessions.length
      ) {

        const activeSession =
          this.sessions.find(
            session =>
              session.status === 'active'
          );

        this.selectedSessionId =
          activeSession?.id ||
          this.sessions[0].id;
      }


      // ---------------------------------------------------
      // DEFAULT TERM
      // ---------------------------------------------------

      if (
        !this.selectedTermId &&
        this.terms.length
      ) {

        const activeTerm =
          this.terms.find(
            term =>
              term.status === 'active'
          );

        this.selectedTermId =
          activeTerm?.id ||
          this.terms[0].id;
      }


      await this.loadAttendanceRecords();

      this.refreshAttendanceForms();

    } catch (error) {

      console.error(
        'Staff attendance initialization error:',
        error
      );

      this.errorMessage =
        'Unable to load staff attendance. Please try again.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();
    }
  }


  // =======================================================
  // LOAD STAFF RECORD
  // =======================================================

  async loadStaffRecord(
    uid: string
  ): Promise<void> {

    const snapshot =
      await get(
        ref(database, 'staff')
      );


    if (!snapshot.exists()) {
      return;
    }


    const data =
      snapshot.val();


    for (
      const id of Object.keys(data)
    ) {

      const value =
        data[id];


      if (
        value?.uid === uid ||
        value?.staffId === this.staffId ||
        id === this.staffId
      ) {

        this.staffRecordId = id;

        this.staffName =
          value.fullName ||
          value.name ||
          this.currentUser?.fullName ||
          'Staff';

        break;
      }
    }
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


    if (!snapshot.exists()) {

      this.classes = [];

      return;
    }


    const data =
      snapshot.val();


    this.classes =
      Object.keys(data)

        .map(id => ({

          id,

          className:
            data[id].className ||
            data[id].name ||
            '',

          section:
            data[id].section ||
            '',

          status:
            data[id].status ||
            'active'

        }))

        .filter(
          item =>
            item.status === 'active'
        );
  }


  // =======================================================
  // LOAD TEACHING ASSIGNMENTS
  // =======================================================

  async loadAssignments(): Promise<void> {

    const snapshot =
      await get(
        ref(
          database,
          'teachingAssignments'
        )
      );


    if (!snapshot.exists()) {

      this.assignments = [];

      return;
    }


    const data =
      snapshot.val();


    this.assignments =
      Object.keys(data)

        .map(id => ({

          id,

          teacherId:
            data[id].teacherId ||
            '',

          classId:
            data[id].classId ||
            '',

          subjectId:
            data[id].subjectId ||
            '',

          className:
            data[id].className ||
            '',

          subjectName:
            data[id].subjectName ||
            '',

          teacherName:
            data[id].teacherName ||
            '',

          status:
            data[id].status ||
            'active'

        }))

        .filter(
          assignment =>
            assignment.teacherId ===
              this.staffRecordId &&

            assignment.status ===
              'active'
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


    if (!snapshot.exists()) {

      this.students = [];

      return;
    }


    const data =
      snapshot.val();


    this.students =
      Object.keys(data)

        .map(id => {

          const student =
            data[id];


          const schoolClass =
            this.classes.find(
              item =>
                item.id ===
                student.classId
            );


          return {

            id,

            studentId:
              student.studentId ||
              id,

            fullName:
              student.fullName ||
              `${student.firstName || ''} ${student.lastName || ''}`.trim(),

            firstName:
              student.firstName ||
              '',

            lastName:
              student.lastName ||
              '',

            classId:
              student.classId ||
              '',

            className:
              student.className ||
              schoolClass?.className ||
              '',

            status:
              student.status ||
              'active'

          };

        })

        .filter(
          student =>
            student.status === 'active'
        );
  }


  // =======================================================
  // LOAD ACADEMIC SESSIONS
  // =======================================================

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


    const data =
      snapshot.val();


    this.sessions =
      Object.keys(data)

        .map(id => ({

          id,

          name:
            data[id].name ||
            '',

          sessionName:
            data[id].sessionName ||
            '',

          academicYear:
            data[id].academicYear ||
            '',

          status:
            data[id].status ||
            'active'

        }))

        .filter(
          session =>
            session.status ===
            'active'
        );
  }


  // =======================================================
  // LOAD ACADEMIC TERMS
  // =======================================================

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


    const data =
      snapshot.val();


    this.terms =
      Object.keys(data)

        .map(id => ({

          id,

          name:
            data[id].name ||
            '',

          termName:
            data[id].termName ||
            '',

          status:
            data[id].status ||
            'active'

        }))

        .filter(
          term =>
            term.status ===
            'active'
        );
  }


  // =======================================================
  // LOAD ATTENDANCE RECORDS
  // =======================================================

  async loadAttendanceRecords(): Promise<void> {

    if (!this.staffId) {

      console.warn(
        'Cannot load attendance: staffId is empty.'
      );

      this.attendanceRecords = [];

      return;
    }


    console.log(
      'Loading attendance for staffId:',
      this.staffId
    );


    const attendanceQuery =
      query(

        ref(
          database,
          'attendance'
        ),

        orderByChild(
          'teacherId'
        ),

        equalTo(
          this.staffId
        )
      );


    const snapshot =
      await get(
        attendanceQuery
      );


    console.log(
      'Attendance query successful:',
      snapshot.exists()
    );


    if (!snapshot.exists()) {

      this.attendanceRecords = [];

      return;
    }


    const data =
      snapshot.val();


    this.attendanceRecords =
      Object.keys(data)

        .map(id => {

          const record =
            data[id];


          return {

            id,

            date:
              record.date ||
              '',

            classId:
              record.classId ||
              '',

            className:
              record.className ||
              '',

            studentId:
              record.studentId ||
              '',

            studentName:
              record.studentName ||
              '',

            status:
              record.status ||
              'present',

            remark:
              record.remark ||
              '',

            teacherId:
              record.teacherId ||
              '',

            teacherName:
              record.teacherName ||
              '',

            sessionId:
              record.sessionId ||
              '',

            sessionName:
              record.sessionName ||
              '',

            termId:
              record.termId ||
              '',

            termName:
              record.termName ||
              '',

            createdAt:
              Number(
                record.createdAt
              ) ||
              Date.now(),

            updatedAt:
              Number(
                record.updatedAt
              ) ||
              Date.now()

          } as AttendanceRecord;

        })

        .sort(
          (a, b) => {

            const dateCompare =
              b.date.localeCompare(
                a.date
              );


            if (
              dateCompare !== 0
            ) {

              return dateCompare;
            }


            return (
              a.studentName || ''
            ).localeCompare(
              b.studentName || ''
            );
          }
        );
  }


  // =======================================================
  // TODAY
  // =======================================================

  getTodayDate(): string {

    const date =
      new Date();


    const year =
      date.getFullYear();


    const month =
      String(
        date.getMonth() + 1
      ).padStart(
        2,
        '0'
      );


    const day =
      String(
        date.getDate()
      ).padStart(
        2,
        '0'
      );


    return `${year}-${month}-${day}`;
  }


  // =======================================================
  // CLASS CHANGE
  // =======================================================

  onClassChange(): void {

    this.editingAttendanceId = '';

    this.editingStudentId = '';

    this.clearMessages();

    this.refreshAttendanceForms();
  }


  // =======================================================
  // SESSION CHANGE
  // =======================================================

  onSessionChange(): void {

    this.editingAttendanceId = '';

    this.editingStudentId = '';

    this.clearMessages();

    this.refreshAttendanceForms();
  }


  // =======================================================
  // TERM CHANGE
  // =======================================================

  onTermChange(): void {

    this.editingAttendanceId = '';

    this.editingStudentId = '';

    this.clearMessages();

    this.refreshAttendanceForms();
  }


  // =======================================================
  // DATE CHANGE
  // =======================================================

  onDateChange(): void {

    this.editingAttendanceId = '';

    this.editingStudentId = '';

    this.clearMessages();

    this.refreshAttendanceForms();
  }


  // =======================================================
  // REFRESH ATTENDANCE FORMS
  // =======================================================

  refreshAttendanceForms(): void {

    this.clearMessages();

    this.editingAttendanceId = '';

    this.editingStudentId = '';


    if (!this.selectedClassId) {

      this.classStudents = [];

      this.attendanceForms = [];

      return;
    }


    if (
      !this.isAssignmentAllowed(
        this.selectedClassId
      )
    ) {

      this.classStudents = [];

      this.attendanceForms = [];

      this.errorMessage =
        'You are not assigned to this class.';

      return;
    }


    this.classStudents =
      this.students.filter(
        student =>
          student.classId ===
          this.selectedClassId
      );


    this.attendanceForms =
      this.classStudents.map(
        student => {

          const existing =
            this.findAttendanceRecord(
              student.studentId
            );


          return {

            studentId:
              student.studentId,

            status:
              existing?.status ||
              'present',

            remark:
              existing?.remark ||
              ''

          };

        }
      );
  }


  // =======================================================
  // CHECK CLASS ASSIGNMENT
  // =======================================================

  isAssignmentAllowed(
    classId: string
  ): boolean {

    return this.assignments.some(
      assignment =>

        assignment.classId ===
          classId &&

        assignment.teacherId ===
          this.staffRecordId &&

        assignment.status ===
          'active'
    );
  }


  // =======================================================
  // FIND ATTENDANCE RECORD
  // =======================================================

  findAttendanceRecord(
    studentId: string
  ): AttendanceRecord | undefined {

    return this.attendanceRecords.find(
      record =>

        record.studentId ===
          studentId &&

        record.classId ===
          this.selectedClassId &&

        record.date ===
          this.selectedDate &&

        record.sessionId ===
          this.selectedSessionId &&

        record.termId ===
          this.selectedTermId
    );
  }


  // =======================================================
  // GET ATTENDANCE FORM
  // =======================================================

  getAttendanceForm(
    studentOrId: Student | string
  ): AttendanceForm {

    const studentId =
      typeof studentOrId === 'string'
        ? studentOrId
        : studentOrId.studentId;


    let form =
      this.attendanceForms.find(
        item =>
          item.studentId ===
          studentId
      );


    if (!form) {

      form = {

        studentId,

        status:
          'present',

        remark:
          ''

      };


      this.attendanceForms.push(
        form
      );
    }


    return form;
  }


  // =======================================================
  // SET STATUS
  // =======================================================

  setAttendanceStatus(
    studentOrId: Student | string,
    status: AttendanceStatus
  ): void {

    const form =
      this.getAttendanceForm(
        studentOrId
      );


    form.status =
      status;
  }


  // =======================================================
  // STATUS COUNT
  // =======================================================

  getStatusCount(
    status: AttendanceStatus
  ): number {

    return this.attendanceForms.filter(
      form =>
        form.status ===
        status
    ).length;
  }


  // =======================================================
  // ATTENDANCE SUMMARY
  // =======================================================

  getTotalStudents(): number {

    return this.classStudents.length;
  }


  getPresentCount(): number {

    return this.getStatusCount(
      'present'
    );
  }


  getAbsentCount(): number {

    return this.getStatusCount(
      'absent'
    );
  }


  getLateCount(): number {

    return this.getStatusCount(
      'late'
    );
  }


  getExcusedCount(): number {

    return this.getStatusCount(
      'excused'
    );
  }


  getAttendancePercentage(): number {

    const total =
      this.getTotalStudents();


    if (!total) {
      return 0;
    }


    const present =
      this.getPresentCount();


    return Number(
      (
        (present / total) *
        100
      ).toFixed(1)
    );
  }


  // =======================================================
  // MARK ALL PRESENT
  // =======================================================

  markAllPresent(): void {

    if (!this.classStudents.length) {

      this.errorMessage =
        'There are no students in the selected class.';

      return;
    }


    const hasExistingChanges =
      this.attendanceForms.some(
        form =>
          form.status !== 'present' ||
          !!form.remark.trim()
      );


    if (hasExistingChanges) {

      const confirmed =
        window.confirm(
          'This will mark every student as Present and clear their remarks. Continue?'
        );


      if (!confirmed) {
        return;
      }
    }


    for (
      const student of this.classStudents
    ) {

      const form =
        this.getAttendanceForm(
          student.studentId
        );


      form.status =
        'present';

      form.remark =
        '';
    }


    this.editingAttendanceId = '';

    this.editingStudentId = '';

    this.clearMessages();


    this.successMessage =
      'All students have been marked Present.';

    this.cdr.detectChanges();
  }


  // =======================================================
  // RESET ATTENDANCE
  // =======================================================

  resetAttendance(): void {

    if (!this.classStudents.length) {
      return;
    }


    const confirmed =
      window.confirm(
        'Reset all attendance statuses to Present?'
      );


    if (!confirmed) {
      return;
    }


    for (
      const student of this.classStudents
    ) {

      const form =
        this.getAttendanceForm(
          student.studentId
        );


      form.status =
        'present';

      form.remark =
        '';
    }


    this.editingAttendanceId = '';

    this.editingStudentId = '';

    this.clearMessages();


    this.successMessage =
      'Attendance has been reset.';

    this.cdr.detectChanges();
  }


  // =======================================================
  // SAVE ATTENDANCE
  // =======================================================

  async saveAttendance(
    _student?: Student
  ): Promise<void> {

    if (
      !this.selectedClassId ||
      !this.selectedSessionId ||
      !this.selectedTermId
    ) {

      this.errorMessage =
        'Please select class, session and term before saving.';

      return;
    }


    if (
      !this.isAssignmentAllowed(
        this.selectedClassId
      )
    ) {

      this.errorMessage =
        'You are not assigned to this class.';

      return;
    }


    if (!this.classStudents.length) {

      this.errorMessage =
        'There are no students in this class.';

      return;
    }


    if (!this.staffId) {

      this.errorMessage =
        'Your staff ID could not be identified. Please login again.';

      return;
    }


    this.saving = true;

    this.clearMessages();


    try {

      const now =
        Date.now();


      const selectedClass =
        this.classes.find(
          item =>
            item.id ===
            this.selectedClassId
        );


      // ---------------------------------------------------
      // SAVE ALL STUDENTS
      // ---------------------------------------------------

      for (
        const student of this.classStudents
      ) {

        const form =
          this.getAttendanceForm(
            student
          );


        const existing =
          this.findAttendanceRecord(
            student.studentId
          );


        const attendanceData = {

          date:
            this.selectedDate,

          classId:
            this.selectedClassId,

          className:
            selectedClass?.className ||
            student.className ||
            '',

          studentId:
            student.studentId,

          studentName:
            student.fullName,

          status:
            form.status,

          remark:
            form.remark ||
            '',

          /*
           * IMPORTANT:
           * Attendance uses staffId,
           * NOT staffRecordId.
           */
          teacherId:
            this.staffId,

          teacherName:
            this.staffName,

          sessionId:
            this.selectedSessionId,

          sessionName:
            this.getSelectedSessionName(),

          termId:
            this.selectedTermId,

          termName:
            this.getSelectedTermName(),

          createdAt:
            existing?.createdAt ||
            now,

          updatedAt:
            now
        };


        // -------------------------------------------------
        // UPDATE EXISTING
        // -------------------------------------------------

        if (existing) {

          await update(

            ref(
              database,
              `attendance/${existing.id}`
            ),

            attendanceData
          );

        }


        // -------------------------------------------------
        // CREATE NEW
        // -------------------------------------------------

        else {

          const newRef =
            push(
              ref(
                database,
                'attendance'
              )
            );


          await update(
            newRef,
            attendanceData
          );
        }
      }


      // ---------------------------------------------------
      // RELOAD
      // ---------------------------------------------------

      await this.loadAttendanceRecords();

      this.refreshAttendanceForms();


      this.successMessage =
        'Attendance saved successfully.';


      this.editingAttendanceId = '';

      this.editingStudentId = '';


    } catch (error) {

      console.error(
        'Save attendance error:',
        error
      );


      this.errorMessage =
        'Unable to save attendance. Please try again.';

    } finally {

      this.saving = false;

      this.cdr.detectChanges();
    }
  }


  // =======================================================
  // EDIT ATTENDANCE
  // =======================================================

  editAttendance(
    record: AttendanceRecord
  ): void {

    this.selectedClassId =
      record.classId;

    this.selectedDate =
      record.date;

    this.selectedSessionId =
      record.sessionId;

    this.selectedTermId =
      record.termId;


    this.editingAttendanceId =
      record.id;

    this.editingStudentId =
      record.studentId;


    this.refreshAttendanceForms();


    const form =
      this.getAttendanceForm(
        record.studentId
      );


    form.status =
      record.status;

    form.remark =
      record.remark ||
      '';


    this.successMessage = '';

    this.errorMessage = '';

    this.cdr.detectChanges();
  }


  // =======================================================
  // DELETE ATTENDANCE
  // =======================================================

  async deleteAttendance(
    recordOrStudent:
      AttendanceRecord | Student
  ): Promise<void> {

    let record:
      AttendanceRecord | undefined;


    // -----------------------------------------------------
    // IF ATTENDANCE RECORD
    // -----------------------------------------------------

    if (
      'date' in recordOrStudent &&
      'teacherId' in recordOrStudent
    ) {

      record =
        recordOrStudent as AttendanceRecord;

    }


    // -----------------------------------------------------
    // IF STUDENT
    // -----------------------------------------------------

    else {

      const student =
        recordOrStudent as Student;


      record =
        this.getSavedAttendance(
          student
        ) || undefined;
    }


    if (!record) {

      this.errorMessage =
        'No saved attendance record was found for this student.';

      return;
    }


    const confirmed =
      window.confirm(
        `Delete attendance for ${record.studentName}?`
      );


    if (!confirmed) {
      return;
    }


    this.deleting = true;

    this.clearMessages();


    try {

      await remove(
        ref(
          database,
          `attendance/${record.id}`
        )
      );


      await this.loadAttendanceRecords();

      this.refreshAttendanceForms();


      this.successMessage =
        'Attendance deleted successfully.';


      if (
        this.editingAttendanceId ===
        record.id
      ) {

        this.editingAttendanceId = '';

        this.editingStudentId = '';
      }


    } catch (error) {

      console.error(
        'Delete attendance error:',
        error
      );


      this.errorMessage =
        'Unable to delete attendance. Please try again.';

    } finally {

      this.deleting = false;

      this.cdr.detectChanges();
    }
  }


  // =======================================================
  // DELETE SAVED ATTENDANCE
  // =======================================================

  async deleteSavedAttendance(
    record: AttendanceRecord
  ): Promise<void> {

    await this.deleteAttendance(
      record
    );
  }


  // =======================================================
  // GET SAVED ATTENDANCE FOR STUDENT
  // =======================================================

  getSavedAttendance(
    student: Student
  ): AttendanceRecord | null {

    return (
      this.findAttendanceRecord(
        student.studentId
      ) || null
    );
  }


  // =======================================================
  // IS EDITING STUDENT
  // =======================================================

  isEditingStudent(
    student: Student
  ): boolean {

    return (
      this.editingStudentId ===
      student.studentId
    );
  }


  // =======================================================
  // HAS SAVED ATTENDANCE
  // =======================================================

  hasSavedAttendance(
    studentOrId: Student | string
  ): boolean {

    const studentId =
      typeof studentOrId === 'string'
        ? studentOrId
        : studentOrId.studentId;


    return !!this.findAttendanceRecord(
      studentId
    );
  }


  // =======================================================
  // SELECTED ATTENDANCE RECORDS
  // =======================================================

  getSelectedAttendanceRecords():
    AttendanceRecord[] {

    return this.attendanceRecords.filter(

      record =>

        record.classId ===
          this.selectedClassId &&

        record.date ===
          this.selectedDate &&

        record.sessionId ===
          this.selectedSessionId &&

        record.termId ===
          this.selectedTermId
    );
  }


  // =======================================================
  // CLASS NAME
  // =======================================================

  getSelectedClassName(): string {

    const schoolClass =
      this.classes.find(
        item =>
          item.id ===
          this.selectedClassId
      );


    return (
      schoolClass?.className ||
      ''
    );
  }


  // =======================================================
  // SESSION NAME
  // =======================================================

  getSelectedSessionName(): string {

    const session =
      this.sessions.find(
        item =>
          item.id ===
          this.selectedSessionId
      );


    return (
      session?.sessionName ||
      session?.name ||
      session?.academicYear ||
      ''
    );
  }


  // =======================================================
  // TERM NAME
  // =======================================================

  getSelectedTermName(): string {

    const term =
      this.terms.find(
        item =>
          item.id ===
          this.selectedTermId
      );


    return (
      term?.termName ||
      term?.name ||
      ''
    );
  }


  // =======================================================
  // CANCEL EDIT
  // =======================================================

  cancelEdit(): void {

    this.editingAttendanceId = '';

    this.editingStudentId = '';

    this.refreshAttendanceForms();
  }


  // =======================================================
  // CLEAR SELECTION
  // =======================================================

  clearSelection(): void {

    this.selectedClassId = '';

    this.classStudents = [];

    this.attendanceForms = [];

    this.editingAttendanceId = '';

    this.editingStudentId = '';

    this.clearMessages();
  }


  // =======================================================
  // CLEAR MESSAGES
  // =======================================================

  clearMessages(): void {

    this.errorMessage = '';

    this.successMessage = '';
  }


  // =======================================================
  // REFRESH
  // =======================================================

  async refresh(): Promise<void> {

    this.loading = true;

    this.clearMessages();


    try {

      await this.loadAttendanceRecords();

      this.refreshAttendanceForms();

    } catch (error) {

      console.error(
        'Refresh attendance error:',
        error
      );


      this.errorMessage =
        'Unable to refresh attendance.';

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
  }

}
