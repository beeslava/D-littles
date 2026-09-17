import {
  DatePipe,
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

import { database } from '../../../core/firebase.config';


// =====================================================
// CLASS
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
  createdAt: number;
  updatedAt?: number;
}


// =====================================================
// SUBJECT
// =====================================================

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


// =====================================================
// STAFF
// =====================================================

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

  createdAt: number;
  updatedAt?: number;
}


// =====================================================
// COMPONENT
// =====================================================

@Component({
  selector: 'app-teaching-assignments',
  standalone: true,

  imports: [
    NgFor,
    NgIf,
    FormsModule,
    DatePipe
  ],

  templateUrl: './teaching-assignment.html',
  styleUrl: './teaching-assignment.css'
})


export class TeachingAssignments implements OnInit {


  // =====================================================
  // DATA
  // =====================================================

  classes: SchoolClass[] = [];

  subjects: SchoolSubject[] = [];

  staff: StaffMember[] = [];

  assignments: TeachingAssignment[] = [];


  // =====================================================
  // STATISTICS
  // =====================================================

  totalAssignments = 0;

  totalClasses = 0;

  totalSubjects = 0;


  // =====================================================
  // FILTERS
  // =====================================================

  searchTerm = '';

  selectedClass = '';

  selectedSubject = '';

  selectedTeacher = '';


  // =====================================================
  // UI STATE
  // =====================================================

  loading = false;

  saving = false;

  updating = false;

  deleting = false;


  // =====================================================
  // MESSAGES
  // =====================================================

  successMessage = '';

  errorMessage = '';


  // =====================================================
  // MODALS
  // =====================================================

  showAddAssignment = false;

  showAssignmentDetails = false;

  showEditAssignment = false;

  showDeleteAssignment = false;


  // =====================================================
  // SELECTED ASSIGNMENTS
  // =====================================================

  selectedAssignment:
    TeachingAssignment | null = null;

  assignmentToDelete:
    TeachingAssignment | null = null;


  // =====================================================
  // NEW ASSIGNMENT
  // =====================================================

  newAssignment = {
    classId: '',
    subjectId: '',
    teacherId: ''
  };


  // =====================================================
  // EDIT ASSIGNMENT
  // =====================================================

  editAssignmentData = {
    id: '',
    classId: '',
    subjectId: '',
    teacherId: ''
  };


  // =====================================================
  // CONSTRUCTOR
  // =====================================================

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}


  // =====================================================
  // INIT
  // =====================================================

  ngOnInit(): void {

    this.loadData();

  }


  // =====================================================
  // CLEAR MESSAGES
  // =====================================================

  clearMessages(): void {

    this.successMessage = '';

    this.errorMessage = '';

  }


  // =====================================================
  // LOAD ALL DATA
  // =====================================================

  async loadData(): Promise<void> {

    /*
     * Set loading immediately.
     */
    this.loading = true;

    this.clearMessages();

    /*
     * Tell Angular to display the loading state
     * before Firebase requests begin.
     */
    this.cdr.detectChanges();


    try {

      /*
       * Load classes first.
       */
      await this.loadClasses();


      /*
       * Load subjects second.
       */
      await this.loadSubjects();


      /*
       * Load staff third.
       */
      await this.loadStaff();


      /*
       * Load assignments last.
       *
       * This ensures class, subject and teacher
       * names are already available when assignments
       * are mapped.
       */
      await this.loadAssignments();


      /*
       * Calculate statistics.
       */
      this.ngZone.run(() => {

        this.totalClasses =
          this.classes.length;

        this.totalSubjects =
          this.subjects.length;

        this.totalAssignments =
          this.assignments.length;

      });


    } catch (error) {

      console.error(
        'Error loading teaching assignment data:',
        error
      );


      /*
       * Make sure the error message is also
       * handled inside Angular.
       */
      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to load teaching assignment data. Please try again.';

      });

    } finally {

      /*
       * IMPORTANT:
       *
       * Firebase async operations can finish outside
       * Angular's normal change-detection cycle.
       *
       * Running this inside NgZone guarantees that
       * the loading screen disappears automatically.
       */
      this.ngZone.run(() => {

        this.loading = false;

        this.cdr.detectChanges();

      });

    }

  }


  // =====================================================
  // LOAD CLASSES
  // =====================================================

  async loadClasses(): Promise<void> {

    try {

      const snapshot = await get(
        ref(database, 'classes')
      );


      if (!snapshot.exists()) {

        this.classes = [];

        console.log(
          'No classes found in Firebase.'
        );

        return;

      }


      const data = snapshot.val();


      this.classes = Object.entries(data)

        .map(
          ([id, value]: [string, any]) => ({
            id,
            ...value
          })
        )

        .filter(
          (item: SchoolClass) =>
            item.status === 'active'
        )

        .sort(
          (
            a: SchoolClass,
            b: SchoolClass
          ) =>

            `${a.className} ${a.section}`

              .localeCompare(
                `${b.className} ${b.section}`
              )

        );


      console.log(
        'Classes loaded:',
        this.classes
      );


    } catch (error) {

      console.error(
        'Error loading classes:',
        error
      );

      this.classes = [];

      throw error;

    }

  }


  // =====================================================
  // LOAD SUBJECTS
  // =====================================================

  async loadSubjects(): Promise<void> {

    try {

      const snapshot = await get(
        ref(database, 'subjects')
      );


      if (!snapshot.exists()) {

        this.subjects = [];

        console.log(
          'No subjects found in Firebase.'
        );

        return;

      }


      const data = snapshot.val();


      this.subjects = Object.entries(data)

        .map(
          ([id, value]: [string, any]) => ({
            id,
            ...value
          })
        )

        .filter(
          (item: SchoolSubject) =>
            item.status === 'active'
        )

        .sort(
          (
            a: SchoolSubject,
            b: SchoolSubject
          ) =>

            a.subjectName.localeCompare(
              b.subjectName
            )

        );


      console.log(
        'Subjects loaded:',
        this.subjects
      );


    } catch (error) {

      console.error(
        'Error loading subjects:',
        error
      );

      this.subjects = [];

      throw error;

    }

  }


  // =====================================================
  // LOAD STAFF
  // =====================================================

  async loadStaff(): Promise<void> {

    try {

      const snapshot = await get(
        ref(database, 'staff')
      );


      if (!snapshot.exists()) {

        this.staff = [];

        console.log(
          'No staff found in Firebase.'
        );

        return;

      }


      const data = snapshot.val();


      this.staff = Object.entries(data)

        .map(
          ([id, value]: [string, any]) => ({
            id,
            ...value
          })
        )

        .filter(
          (item: StaffMember) =>
            item.status === 'active'
        )

        .sort(
          (
            a: StaffMember,
            b: StaffMember
          ) =>

            a.fullName.localeCompare(
              b.fullName
            )

        );


      console.log(
        'Staff loaded:',
        this.staff
      );


    } catch (error) {

      console.error(
        'Error loading staff:',
        error
      );

      this.staff = [];

      throw error;

    }

  }


  // =====================================================
  // LOAD ASSIGNMENTS
  // =====================================================

  async loadAssignments(): Promise<void> {

    try {

      const snapshot = await get(
        ref(
          database,
          'teachingAssignments'
        )
      );


      if (!snapshot.exists()) {

        this.assignments = [];

        console.log(
          'No teaching assignments found.'
        );

        return;

      }


      const data = snapshot.val();


      this.assignments = Object.entries(data)

        .map(
          (
            [id, value]: [string, any]
          ) => {

            const assignment =
              value as TeachingAssignment;


            const schoolClass =
              this.classes.find(
                item =>
                  item.id ===
                  assignment.classId
              );


            const subject =
              this.subjects.find(
                item =>
                  item.id ===
                  assignment.subjectId
              );


            const teacher =
              this.staff.find(
                item =>
                  item.id ===
                  assignment.teacherId
              );


            return {

              id,

              classId:
                assignment.classId || '',

              subjectId:
                assignment.subjectId || '',

              teacherId:
                assignment.teacherId || '',


              className:

                schoolClass

                  ? `${schoolClass.className} ${schoolClass.section}`.trim()

                  : 'Unknown Class',


              subjectName:

                subject

                  ? subject.subjectName

                  : 'Unknown Subject',


              teacherName:

                teacher

                  ? teacher.fullName

                  : 'Unknown Teacher',


              createdAt:
                assignment.createdAt ||
                Date.now(),


              updatedAt:
                assignment.updatedAt

            };

          }

        )

        .sort(
          (
            a,
            b
          ) =>

            a.className.localeCompare(
              b.className
            )

        );


      console.log(
        'Teaching assignments loaded:',
        this.assignments
      );


    } catch (error) {

      console.error(
        'Error loading teaching assignments:',
        error
      );

      this.assignments = [];

      throw error;

    }

  }


  // =====================================================
  // FILTERED ASSIGNMENTS
  // =====================================================

  get filteredAssignments():
    TeachingAssignment[] {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    return this.assignments.filter(
      assignment => {

        const matchesSearch =

          !search ||

          assignment.className
            .toLowerCase()
            .includes(search) ||

          assignment.subjectName
            .toLowerCase()
            .includes(search) ||

          assignment.teacherName
            .toLowerCase()
            .includes(search);


        const matchesClass =

          !this.selectedClass ||

          assignment.classId ===
          this.selectedClass;


        const matchesSubject =

          !this.selectedSubject ||

          assignment.subjectId ===
          this.selectedSubject;


        const matchesTeacher =

          !this.selectedTeacher ||

          assignment.teacherId ===
          this.selectedTeacher;


        return (

          matchesSearch &&

          matchesClass &&

          matchesSubject &&

          matchesTeacher

        );

      }

    );

  }


  // =====================================================
  // OPEN ADD MODAL
  // =====================================================

  openAddAssignment(): void {

    this.clearMessages();

    this.resetForm();

    this.showAddAssignment = true;

  }


  // =====================================================
  // CLOSE ADD MODAL
  // =====================================================

  closeAddAssignment(): void {

    if (this.saving) {

      return;

    }


    this.showAddAssignment = false;

    this.resetForm();

  }


  // =====================================================
  // SAVE ASSIGNMENT
  // =====================================================

  async saveAssignment(): Promise<void> {

    this.clearMessages();


    if (!this.newAssignment.classId) {

      this.errorMessage =
        'Please select a class.';

      return;

    }


    if (!this.newAssignment.subjectId) {

      this.errorMessage =
        'Please select a subject.';

      return;

    }


    if (!this.newAssignment.teacherId) {

      this.errorMessage =
        'Please select a teacher.';

      return;

    }


    const duplicate =
      this.assignments.some(
        assignment =>

          assignment.classId ===
          this.newAssignment.classId &&

          assignment.subjectId ===
          this.newAssignment.subjectId

      );


    if (duplicate) {

      this.errorMessage =
        'This subject is already assigned to this class.';

      return;

    }


    this.saving = true;

    this.cdr.detectChanges();


    try {

      const assignmentRef =
        push(
          ref(
            database,
            'teachingAssignments'
          )
        );


      const now = Date.now();


      const assignmentData = {

        classId:
          this.newAssignment.classId,

        subjectId:
          this.newAssignment.subjectId,

        teacherId:
          this.newAssignment.teacherId,

        createdAt:
          now

      };


      await update(
        assignmentRef,
        assignmentData
      );


      const schoolClass =
        this.classes.find(
          item =>
            item.id ===
            this.newAssignment.classId
        );


      const subject =
        this.subjects.find(
          item =>
            item.id ===
            this.newAssignment.subjectId
        );


      const teacher =
        this.staff.find(
          item =>
            item.id ===
            this.newAssignment.teacherId
        );


      const newRecord:
        TeachingAssignment = {

        id:
          assignmentRef.key || '',

        classId:
          this.newAssignment.classId,

        subjectId:
          this.newAssignment.subjectId,

        teacherId:
          this.newAssignment.teacherId,


        className:

          schoolClass

            ? `${schoolClass.className} ${schoolClass.section}`.trim()

            : 'Unknown Class',


        subjectName:

          subject

            ? subject.subjectName

            : 'Unknown Subject',


        teacherName:

          teacher

            ? teacher.fullName

            : 'Unknown Teacher',


        createdAt:
          now

      };


      this.ngZone.run(() => {

        this.assignments.unshift(
          newRecord
        );

        this.totalAssignments =
          this.assignments.length;

        this.successMessage =
          'Teaching assignment created successfully.';

        this.showAddAssignment =
          false;

        this.resetForm();

        this.cdr.detectChanges();

      });


    } catch (error) {

      console.error(
        'Error saving teaching assignment:',
        error
      );


      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to save the teaching assignment. Please try again.';

      });

    } finally {

      this.ngZone.run(() => {

        this.saving = false;

        this.cdr.detectChanges();

      });

    }

  }


  // =====================================================
  // VIEW ASSIGNMENT
  // =====================================================

  viewAssignment(
    assignment: TeachingAssignment
  ): void {

    this.clearMessages();

    this.selectedAssignment =
      assignment;

    this.showAssignmentDetails =
      true;

  }


  // =====================================================
  // CLOSE DETAILS
  // =====================================================

  closeAssignmentDetails(): void {

    this.showAssignmentDetails =
      false;

    this.selectedAssignment =
      null;

  }


  // =====================================================
  // OPEN EDIT
  // =====================================================

  openEditAssignment(
    assignment: TeachingAssignment
  ): void {

    this.clearMessages();


    this.editAssignmentData = {

      id:
        assignment.id,

      classId:
        assignment.classId,

      subjectId:
        assignment.subjectId,

      teacherId:
        assignment.teacherId

    };


    this.showEditAssignment =
      true;

  }


  // =====================================================
  // CLOSE EDIT
  // =====================================================

  closeEditAssignment(): void {

    if (this.updating) {

      return;

    }


    this.showEditAssignment =
      false;


    this.editAssignmentData = {

      id: '',

      classId: '',

      subjectId: '',

      teacherId: ''

    };

  }


  // =====================================================
  // UPDATE ASSIGNMENT
  // =====================================================

  async updateAssignment(): Promise<void> {

    this.clearMessages();


    const {
      id,
      classId,
      subjectId,
      teacherId
    } = this.editAssignmentData;


    if (!id) {

      this.errorMessage =
        'Invalid teaching assignment.';

      return;

    }


    if (!classId) {

      this.errorMessage =
        'Please select a class.';

      return;

    }


    if (!subjectId) {

      this.errorMessage =
        'Please select a subject.';

      return;

    }


    if (!teacherId) {

      this.errorMessage =
        'Please select a teacher.';

      return;

    }


    const duplicate =
      this.assignments.some(
        assignment =>

          assignment.id !== id &&

          assignment.classId === classId &&

          assignment.subjectId === subjectId

      );


    if (duplicate) {

      this.errorMessage =
        'This subject is already assigned to this class.';

      return;

    }


    this.updating = true;

    this.cdr.detectChanges();


    try {

      const assignmentRef =
        ref(
          database,
          `teachingAssignments/${id}`
        );


      const updatedAt =
        Date.now();


      await update(
        assignmentRef,
        {
          classId,
          subjectId,
          teacherId,
          updatedAt
        }
      );


      const schoolClass =
        this.classes.find(
          item =>
            item.id === classId
        );


      const subject =
        this.subjects.find(
          item =>
            item.id === subjectId
        );


      const teacher =
        this.staff.find(
          item =>
            item.id === teacherId
        );


      const index =
        this.assignments.findIndex(
          item =>
            item.id === id
        );


      this.ngZone.run(() => {

        if (index !== -1) {

          const oldAssignment =
            this.assignments[index];


          this.assignments[index] = {

            ...oldAssignment,

            classId,

            subjectId,

            teacherId,


            className:

              schoolClass

                ? `${schoolClass.className} ${schoolClass.section}`.trim()

                : 'Unknown Class',


            subjectName:

              subject

                ? subject.subjectName

                : 'Unknown Subject',


            teacherName:

              teacher

                ? teacher.fullName

                : 'Unknown Teacher',


            updatedAt

          };

        }


        this.assignments =
          [...this.assignments];


        this.totalAssignments =
          this.assignments.length;


        this.successMessage =
          'Teaching assignment updated successfully.';


        this.closeEditAssignment();

        this.cdr.detectChanges();

      });


    } catch (error) {

      console.error(
        'Error updating teaching assignment:',
        error
      );


      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to update the teaching assignment. Please try again.';

      });

    } finally {

      this.ngZone.run(() => {

        this.updating = false;

        this.cdr.detectChanges();

      });

    }

  }


  // =====================================================
  // OPEN DELETE
  // =====================================================

  openDeleteAssignment(
    assignment: TeachingAssignment
  ): void {

    this.clearMessages();

    this.assignmentToDelete =
      assignment;

    this.showDeleteAssignment =
      true;

  }


  // =====================================================
  // CLOSE DELETE
  // =====================================================

  closeDeleteAssignment(): void {

    if (this.deleting) {

      return;

    }


    this.showDeleteAssignment =
      false;

    this.assignmentToDelete =
      null;

  }


  // =====================================================
  // DELETE ASSIGNMENT
  // =====================================================

  async deleteAssignment(): Promise<void> {

    if (!this.assignmentToDelete) {

      return;

    }


    this.deleting = true;

    this.clearMessages();

    this.cdr.detectChanges();


    const assignmentId =
      this.assignmentToDelete.id;


    try {

      await remove(
        ref(
          database,
          `teachingAssignments/${assignmentId}`
        )
      );


      this.ngZone.run(() => {

        this.assignments =
          this.assignments.filter(
            assignment =>
              assignment.id !==
              assignmentId
          );


        this.totalAssignments =
          this.assignments.length;


        this.successMessage =
          'Teaching assignment deleted successfully.';


        this.showDeleteAssignment =
          false;


        this.assignmentToDelete =
          null;


        this.cdr.detectChanges();

      });


    } catch (error) {

      console.error(
        'Error deleting teaching assignment:',
        error
      );


      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to delete the teaching assignment. Please try again.';

      });

    } finally {

      this.ngZone.run(() => {

        this.deleting = false;

        this.cdr.detectChanges();

      });

    }

  }


  // =====================================================
  // RESET FORM
  // =====================================================

  resetForm(): void {

    this.newAssignment = {

      classId: '',

      subjectId: '',

      teacherId: ''

    };

  }


  // =====================================================
  // CLEAR FILTERS
  // =====================================================

  clearFilters(): void {

    this.searchTerm = '';

    this.selectedClass = '';

    this.selectedSubject = '';

    this.selectedTeacher = '';

  }

}

