import {
  NgFor,
  NgIf,
  TitleCasePipe
} from '@angular/common';

import {
  ChangeDetectorRef,
  Component,
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
  set,
  update
} from 'firebase/database';

import {
  database
} from '../../../core/firebase.config';


// =========================================================
// PARENT OPTION
// =========================================================

interface ParentOption {

  id: string;

  parentId: string;

  fullName: string;

  relationship: string;

  phone: string;

  email: string;

}


// =========================================================
// CLASS OPTION
// =========================================================

interface ClassOption {

  id: string;

  classCode: string;

  className: string;

  section: string;

  classTeacherName: string;

  status: string;

}


// =========================================================
// STUDENT INTERFACE
// =========================================================

interface Student {

  id: string;

  studentId: string;

  firstName: string;

  middleName: string;

  lastName: string;

  gender: string;

  dateOfBirth: string;

  /*
   * Existing class field is preserved.
   */
  class: string;

  /*
   * New class relationship.
   */
  classId: string;

  className: string;

  // Parent relationship

  parentId: string;

  parentName: string;

  parentPhone: string;

  parentEmail: string;

  address: string;

  status: string;

  createdAt: string;

  updatedAt: string;

}


// =========================================================
// COMPONENT
// =========================================================

@Component({

  selector: 'app-students',

  standalone: true,

  imports: [
    FormsModule,
    NgIf,
    NgFor,
    TitleCasePipe
  ],

  templateUrl: './students.html',

  styleUrl: './students.css'

})


export class Students implements OnInit {


  // =========================================================
  // STATISTICS
  // =========================================================

  totalStudents = 0;

  activeStudents = 0;

  maleStudents = 0;

  femaleStudents = 0;


  // =========================================================
  // STUDENTS
  // =========================================================

  students: Student[] = [];


  // =========================================================
  // CLASSES
  // =========================================================

  classes: ClassOption[] = [];

  classesLoading = false;

  classLoadError = '';


  // =========================================================
  // PARENTS
  // =========================================================

  parents: ParentOption[] = [];

  parentsLoading = false;

  parentLoadError = '';


  // =========================================================
  // SEARCH / FILTER
  // =========================================================

  searchTerm = '';

  selectedClass = '';

  selectedStatus = '';


  // =========================================================
  // UI STATE
  // =========================================================

  showAddStudent = false;

  showStudentDetails = false;

  showEditStudent = false;

  showDeleteStudent = false;

  showAssignClass = false;

  loading = false;

  saving = false;

  updating = false;

  deleting = false;

  assigningClass = false;

  errorMessage = '';

  successMessage = '';

  editErrorMessage = '';

  editSuccessMessage = '';

  deleteErrorMessage = '';

  classAssignErrorMessage = '';

  classAssignSuccessMessage = '';


  // =========================================================
  // SELECTED STUDENT
  // =========================================================

  selectedStudent: Student | null = null;

  editingStudent: Student | null = null;

  studentToDelete: Student | null = null;

  studentToAssign: Student | null = null;


  // =========================================================
  // SELECTED CLASS FOR ASSIGNMENT
  // =========================================================

  selectedClassIdForAssignment = '';


  // =========================================================
  // STUDENT FORM
  // =========================================================

  student = {

    firstName: '',

    middleName: '',

    lastName: '',

    gender: '',

    dateOfBirth: '',

    studentId: '',

    class: '',

    classId: '',

    className: '',

    parentId: '',

    parentName: '',

    parentPhone: '',

    parentEmail: '',

    address: '',

    status: 'active'

  };


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(
    private cdr: ChangeDetectorRef
  ) {}


  // =========================================================
  // INITIALIZE
  // =========================================================

  async ngOnInit(): Promise<void> {

    await Promise.all([
      this.loadParents(),
      this.loadClasses()
    ]);

    await this.loadStudents();

  }


  // =========================================================
  // LOAD CLASSES
  // =========================================================

  async loadClasses(): Promise<void> {

    this.classesLoading = true;

    this.classLoadError = '';

    try {

      console.log(
        'Loading classes from Firebase...'
      );

      const classesRef =
        ref(database, 'classes');

      const snapshot =
        await get(classesRef);

      this.classes = [];

      if (snapshot.exists()) {

        const data =
          snapshot.val();

        Object.entries(data).forEach(
          ([key, value]: [string, any]) => {

            const className =
              value?.className ||
              '';

            if (!className.trim()) {

              return;

            }

            const classOption: ClassOption = {

              id: key,

              classCode:
                value?.classCode ||
                '',

              className:
                className.trim(),

              section:
                value?.section ||
                '',

              classTeacherName:
                value?.classTeacherName ||
                '',

              status:
                value?.status ||
                'active'

            };

            this.classes.push(
              classOption
            );

          }
        );

      }


      /*
       * Only active classes should normally
       * be available for student assignment.
       */

      this.classes =
        this.classes.filter(
          item =>
            item.status.toLowerCase() ===
            'active'
        );


      this.classes.sort(
        (a, b) =>
          this.getClassDisplayName(a)
            .localeCompare(
              this.getClassDisplayName(b)
            )
      );


      console.log(
        'Classes loaded:',
        this.classes
      );


    } catch (error) {

      console.error(
        'Failed to load classes:',
        error
      );

      this.classLoadError =

        error instanceof Error

          ? error.message

          : 'Unable to load classes.';

    } finally {

      this.classesLoading = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // CLASS DISPLAY NAME
  // =========================================================

  getClassDisplayName(
    schoolClass: ClassOption
  ): string {

    const section =
      schoolClass.section
        ? ` ${schoolClass.section}`
        : '';

    return `${schoolClass.className}${section}`;

  }


  // =========================================================
  // LOAD PARENTS
  // =========================================================

  async loadParents(): Promise<void> {

    this.parentsLoading = true;

    this.parentLoadError = '';

    try {

      console.log(
        'Loading parents from Firebase...'
      );

      const parentsRef =
        ref(database, 'parents');

      const snapshot =
        await get(parentsRef);

      this.parents = [];


      if (snapshot.exists()) {

        const data =
          snapshot.val();


        Object.entries(data).forEach(
          ([key, value]: [string, any]) => {

            const firebaseKey = key;


            const parentId =
              value?.parentId ||
              firebaseKey;


            const fullName =
              value?.fullName ||
              value?.fullname ||
              value?.name ||
              '';


            if (!fullName.trim()) {

              return;

            }


            this.parents.push({

              id: firebaseKey,

              parentId,

              fullName:
                fullName.trim(),

              relationship:
                value?.relationship ||
                'Guardian',

              phone:
                value?.phone ||
                value?.phoneNumber ||
                '',

              email:
                value?.email ||
                ''

            });

          }

        );

      }


      this.parents.sort(
        (a, b) =>
          a.fullName.localeCompare(
            b.fullName
          )
      );


      console.log(
        'Parents loaded:',
        this.parents
      );


    } catch (error) {

      console.error(
        'Failed to load parents:',
        error
      );


      this.parentLoadError =

        error instanceof Error

          ? error.message

          : 'Unable to load parents.';

    } finally {

      this.parentsLoading = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // PARENT SELECTION
  // =========================================================

  onParentChange(
    parentId: string,
    target: 'add' | 'edit'
  ): void {

    console.log(
      'Parent selected:',
      parentId,
      target
    );


    const parent =
      this.parents.find(
        item =>
          item.parentId === parentId
      );


    if (!parent) {

      if (target === 'add') {

        this.student.parentId = '';

        this.student.parentName = '';

        this.student.parentPhone = '';

        this.student.parentEmail = '';

      } else if (this.editingStudent) {

        this.editingStudent.parentId = '';

        this.editingStudent.parentName = '';

        this.editingStudent.parentPhone = '';

        this.editingStudent.parentEmail = '';

      }


      this.cdr.detectChanges();

      return;

    }


    if (target === 'add') {

      this.student.parentId =
        parent.parentId;

      this.student.parentName =
        parent.fullName;

      this.student.parentPhone =
        parent.phone;

      this.student.parentEmail =
        parent.email;

    }


    if (
      target === 'edit' &&
      this.editingStudent
    ) {

      this.editingStudent.parentId =
        parent.parentId;

      this.editingStudent.parentName =
        parent.fullName;

      this.editingStudent.parentPhone =
        parent.phone;

      this.editingStudent.parentEmail =
        parent.email;

    }


    this.cdr.detectChanges();

  }


  // =========================================================
  // CLASS SELECTION FOR ADD STUDENT
  // =========================================================

  onClassChange(
    classId: string,
    target: 'add' | 'edit'
  ): void {

    const selectedClass =
      this.classes.find(
        item =>
          item.id === classId
      );


    if (!selectedClass) {

      if (target === 'add') {

        this.student.classId = '';

        this.student.className = '';

        this.student.class = '';

      } else if (this.editingStudent) {

        this.editingStudent.classId = '';

        this.editingStudent.className = '';

        this.editingStudent.class = '';

      }

      this.cdr.detectChanges();

      return;

    }


    const displayName =
      this.getClassDisplayName(
        selectedClass
      );


    if (target === 'add') {

      this.student.classId =
        selectedClass.id;

      this.student.className =
        displayName;

      this.student.class =
        displayName;

    }


    if (
      target === 'edit' &&
      this.editingStudent
    ) {

      this.editingStudent.classId =
        selectedClass.id;

      this.editingStudent.className =
        displayName;

      this.editingStudent.class =
        displayName;

    }


    this.cdr.detectChanges();

  }


  // =========================================================
  // OPEN ADD STUDENT FORM
  // =========================================================

  openAddStudent(): void {

    this.resetForm();

    this.errorMessage = '';

    this.successMessage = '';

    this.showAddStudent = true;

    this.cdr.detectChanges();

  }


  // =========================================================
  // CLOSE ADD STUDENT FORM
  // =========================================================

  closeAddStudent(): void {

    if (this.saving) {

      return;

    }

    this.showAddStudent = false;

    this.errorMessage = '';

    this.cdr.detectChanges();

  }


  // =========================================================
  // VIEW STUDENT
  // =========================================================

  viewStudent(
    student: Student
  ): void {

    this.selectedStudent = {
      ...student
    };

    this.showStudentDetails = true;

    this.cdr.detectChanges();

  }


  // =========================================================
  // CLOSE STUDENT DETAILS
  // =========================================================

  closeStudentDetails(): void {

    this.showStudentDetails = false;

    this.selectedStudent = null;

    this.cdr.detectChanges();

  }


  // =========================================================
  // EDIT STUDENT
  // =========================================================

  editStudent(
    student: Student
  ): void {

    this.editingStudent = {
      ...student
    };

    this.editErrorMessage = '';

    this.editSuccessMessage = '';

    this.showEditStudent = true;

    this.cdr.detectChanges();

  }


  // =========================================================
  // CLOSE EDIT STUDENT
  // =========================================================

  closeEditStudent(): void {

    if (this.updating) {

      return;

    }

    this.showEditStudent = false;

    this.editingStudent = null;

    this.editErrorMessage = '';

    this.editSuccessMessage = '';

    this.cdr.detectChanges();

  }


  // =========================================================
  // UPDATE STUDENT
  // =========================================================

  async updateStudent(): Promise<void> {

    if (!this.editingStudent) {

      return;

    }

    if (this.updating) {

      return;

    }


    if (

      !this.editingStudent.firstName.trim() ||

      !this.editingStudent.lastName.trim() ||

      !this.editingStudent.gender ||

      !this.editingStudent.dateOfBirth ||

      !this.editingStudent.parentId ||

      !this.editingStudent.parentName.trim() ||

      !this.editingStudent.parentPhone.trim()

    ) {

      this.editErrorMessage =
        'Please fill in all required fields, including the parent or guardian.';

      this.cdr.detectChanges();

      return;

    }


    this.updating = true;

    this.editErrorMessage = '';

    this.editSuccessMessage = '';

    this.cdr.detectChanges();


    try {

      const firstName =
        this.editingStudent.firstName
          .trim()
          .replace(/\s+/g, ' ');


      const middleName =
        (this.editingStudent.middleName || '')
          .trim()
          .replace(/\s+/g, ' ');


      const lastName =
        this.editingStudent.lastName
          .trim()
          .replace(/\s+/g, ' ');


      const parentName =
        this.editingStudent.parentName
          .trim()
          .replace(/\s+/g, ' ');


      const parentPhone =
        this.editingStudent.parentPhone
          .trim();


      const parentEmail =
        (this.editingStudent.parentEmail || '')
          .trim()
          .toLowerCase();


      const address =
        (this.editingStudent.address || '')
          .trim()
          .replace(/\s+/g, ' ');


      let studentId =
        (this.editingStudent.studentId || '')
          .trim()
          .toUpperCase();


      if (!studentId) {

        studentId =
          this.generateStudentId();

      }


      const studentRef =
        ref(
          database,
          `students/${this.editingStudent.id}`
        );


      const snapshot =
        await get(studentRef);


      if (!snapshot.exists()) {

        this.editErrorMessage =
          'This student record could not be found. Please reload the page.';

        return;

      }


      const updatedStudent = {

        studentId,

        firstName,

        middleName,

        lastName,

        gender:
          this.editingStudent.gender,

        dateOfBirth:
          this.editingStudent.dateOfBirth,

        class:
          this.editingStudent.class || '',

        classId:
          this.editingStudent.classId || '',

        className:
          this.editingStudent.className || '',

        parentId:
          this.editingStudent.parentId,

        parentName,

        parentPhone,

        parentEmail,

        address,

        status:
          this.editingStudent.status || 'active',

        createdAt:
          this.editingStudent.createdAt,

        updatedAt:
          new Date().toISOString()

      };


      await update(
        studentRef,
        updatedStudent
      );


      const index =
        this.students.findIndex(
          s =>
            s.id ===
            this.editingStudent?.id
        );


      if (index !== -1) {

        this.students[index] = {

          ...this.students[index],

          ...updatedStudent

        };

      }


      if (

        this.selectedStudent &&

        this.selectedStudent.id ===
        this.editingStudent.id

      ) {

        this.selectedStudent = {

          ...this.selectedStudent,

          ...updatedStudent

        };

      }


      this.calculateStatistics();


      this.editSuccessMessage =
        'Student information updated successfully.';


      this.cdr.detectChanges();


      setTimeout(() => {

        this.showEditStudent = false;

        this.editingStudent = null;

        this.editSuccessMessage = '';

        this.cdr.detectChanges();

      }, 700);


    } catch (error) {

      console.error(
        'Failed to update student:',
        error
      );


      this.editErrorMessage =

        error instanceof Error

          ? error.message

          : 'Unable to update student. Please try again.';


      this.cdr.detectChanges();


    } finally {

      this.updating = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // LOAD STUDENTS
  // =========================================================

  async loadStudents(): Promise<void> {

    if (this.loading) {

      return;

    }


    this.loading = true;

    this.errorMessage = '';

    this.cdr.detectChanges();


    try {

      const studentsRef =
        ref(database, 'students');

      const snapshot =
        await get(studentsRef);

      this.students = [];


      if (snapshot.exists()) {

        const data =
          snapshot.val();


        Object.entries(data).forEach(
          ([key, value]: [string, any]) => {

            const classId =
              value?.classId ||
              '';

            const className =
              value?.className ||
              value?.class ||
              '';


            const student: Student = {

              id: key,

              studentId:
                value?.studentId ||
                key,

              firstName:
                value?.firstName ||
                '',

              middleName:
                value?.middleName ||
                '',

              lastName:
                value?.lastName ||
                '',

              gender:
                value?.gender ||
                '',

              dateOfBirth:
                value?.dateOfBirth ||
                '',

              class:
                value?.class ||
                className,

              classId,

              className,

              parentId:
                value?.parentId ||
                '',

              parentName:
                value?.parentName ||
                '',

              parentPhone:
                value?.parentPhone ||
                '',

              parentEmail:
                value?.parentEmail ||
                '',

              address:
                value?.address ||
                '',

              status:
                value?.status ||
                'active',

              createdAt:
                value?.createdAt ||
                '',

              updatedAt:
                value?.updatedAt ||
                ''

            };


            this.students.push(
              student
            );

          }
        );

      }


      this.students.sort(
        (a, b) => {

          const dateA =
            new Date(a.createdAt)
              .getTime();

          const dateB =
            new Date(b.createdAt)
              .getTime();

          return dateB - dateA;

        }
      );


      this.calculateStatistics();


    } catch (error) {

      console.error(
        'Failed to load students:',
        error
      );


      this.errorMessage =

        error instanceof Error

          ? error.message

          : 'Unable to load students.';


    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // FILTERED STUDENTS
  // =========================================================

  get filteredStudents(): Student[] {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    return this.students.filter(
      student => {

        const fullName =
          this.getStudentName(student)
            .toLowerCase();


        const matchesSearch =

          !search ||

          fullName.includes(search) ||

          student.studentId
            .toLowerCase()
            .includes(search) ||

          student.parentName
            .toLowerCase()
            .includes(search) ||

          student.parentPhone
            .toLowerCase()
            .includes(search) ||

          student.parentEmail
            .toLowerCase()
            .includes(search);


        const matchesClass =

          !this.selectedClass ||

          student.classId ===
          this.selectedClass ||

          student.class ===
          this.selectedClass;


        const matchesStatus =

          !this.selectedStatus ||

          student.status
            .toLowerCase() ===
          this.selectedStatus.toLowerCase();


        return (

          matchesSearch &&

          matchesClass &&

          matchesStatus

        );

      }
    );

  }


  // =========================================================
  // CALCULATE STATISTICS
  // =========================================================

  calculateStatistics(): void {

    this.totalStudents =
      this.students.length;


    this.activeStudents =
      this.students.filter(
        student =>
          student.status
            .toLowerCase() ===
          'active'
      ).length;


    this.maleStudents =
      this.students.filter(
        student =>
          student.gender
            .toLowerCase() ===
          'male'
      ).length;


    this.femaleStudents =
      this.students.filter(
        student =>
          student.gender
            .toLowerCase() ===
          'female'
      ).length;

  }


  // =========================================================
  // SAVE STUDENT
  // =========================================================

  async saveStudent(): Promise<void> {

    if (

      !this.student.firstName.trim() ||

      !this.student.lastName.trim() ||

      !this.student.gender ||

      !this.student.dateOfBirth ||

      !this.student.parentId ||

      !this.student.parentName.trim() ||

      !this.student.parentPhone.trim()

    ) {

      this.errorMessage =
        'Please fill in all required fields, including the parent or guardian.';

      this.cdr.detectChanges();

      return;

    }


    if (this.saving) {

      return;

    }


    this.saving = true;

    this.errorMessage = '';

    this.successMessage = '';

    this.cdr.detectChanges();


    try {

      const firstName =
        this.student.firstName
          .trim()
          .replace(/\s+/g, ' ');


      const middleName =
        this.student.middleName
          .trim()
          .replace(/\s+/g, ' ');


      const lastName =
        this.student.lastName
          .trim()
          .replace(/\s+/g, ' ');


      const parentName =
        this.student.parentName
          .trim()
          .replace(/\s+/g, ' ');


      const parentPhone =
        this.student.parentPhone
          .trim();


      const parentEmail =
        this.student.parentEmail
          .trim()
          .toLowerCase();


      const address =
        this.student.address
          .trim()
          .replace(/\s+/g, ' ');


      let studentId =
        this.student.studentId
          .trim()
          .toUpperCase();


      if (!studentId) {

        studentId =
          this.generateStudentId();

      }


      const studentsRef =
        ref(database, 'students');


      const newStudentRef =
        push(studentsRef);


      const firebaseId =
        newStudentRef.key;


      if (!firebaseId) {

        throw new Error(
          'Unable to generate student record ID.'
        );

      }


      const now =
        new Date().toISOString();


      const studentData: Student = {

        id: firebaseId,

        studentId,

        firstName,

        middleName,

        lastName,

        gender:
          this.student.gender,

        dateOfBirth:
          this.student.dateOfBirth,

        class:
          this.student.class || '',

        classId:
          this.student.classId || '',

        className:
          this.student.className || '',

        parentId:
          this.student.parentId,

        parentName,

        parentPhone,

        parentEmail,

        address,

        status:
          this.student.status ||
          'active',

        createdAt: now,

        updatedAt: now

      };


      await set(
        newStudentRef,
        studentData
      );


      this.students = [
        studentData,
        ...this.students
      ];


      this.calculateStatistics();


      this.successMessage =
        `${firstName} ${lastName} has been registered successfully.`;


      this.showAddStudent = false;

      this.resetForm();

      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Failed to save student:',
        error
      );


      this.errorMessage =

        error instanceof Error

          ? error.message

          : 'Unable to save student. Please try again.';


      this.cdr.detectChanges();


    } finally {

      this.saving = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // OPEN ASSIGN CLASS
  // =========================================================

  openAssignClass(
    student: Student
  ): void {

    this.studentToAssign = {
      ...student
    };

    this.selectedClassIdForAssignment =
      student.classId || '';

    this.classAssignErrorMessage = '';

    this.classAssignSuccessMessage = '';

    this.showAssignClass = true;

    this.cdr.detectChanges();

  }


  // =========================================================
  // CLOSE ASSIGN CLASS
  // =========================================================

  closeAssignClass(): void {

    if (this.assigningClass) {

      return;

    }

    this.showAssignClass = false;

    this.studentToAssign = null;

    this.selectedClassIdForAssignment = '';

    this.classAssignErrorMessage = '';

    this.classAssignSuccessMessage = '';

    this.cdr.detectChanges();

  }


  // =========================================================
  // ASSIGN CLASS
  // =========================================================

  async assignClass(): Promise<void> {

    if (
      !this.studentToAssign ||
      this.assigningClass
    ) {

      return;

    }


    if (!this.selectedClassIdForAssignment) {

      this.classAssignErrorMessage =
        'Please select a class.';

      this.cdr.detectChanges();

      return;

    }


    const selectedClass =
      this.classes.find(
        item =>
          item.id ===
          this.selectedClassIdForAssignment
      );


    if (!selectedClass) {

      this.classAssignErrorMessage =
        'The selected class could not be found.';

      this.cdr.detectChanges();

      return;

    }


    this.assigningClass = true;

    this.classAssignErrorMessage = '';

    this.classAssignSuccessMessage = '';

    this.cdr.detectChanges();


    try {

      const displayName =
        this.getClassDisplayName(
          selectedClass
        );


      const studentRef =
        ref(
          database,
          `students/${this.studentToAssign.id}`
        );


      await update(
        studentRef,
        {

          classId:
            selectedClass.id,

          className:
            displayName,

          class:
            displayName,

          updatedAt:
            new Date().toISOString()

        }
      );


      const index =
        this.students.findIndex(
          student =>
            student.id ===
            this.studentToAssign?.id
        );


      if (index !== -1) {

        this.students[index] = {

          ...this.students[index],

          classId:
            selectedClass.id,

          className:
            displayName,

          class:
            displayName,

          updatedAt:
            new Date().toISOString()

        };

      }


      if (
        this.selectedStudent &&
        this.selectedStudent.id ===
        this.studentToAssign.id
      ) {

        this.selectedStudent = {

          ...this.selectedStudent,

          classId:
            selectedClass.id,

          className:
            displayName,

          class:
            displayName

        };

      }


      this.classAssignSuccessMessage =
        `${this.getStudentName(this.studentToAssign)} has been assigned to ${displayName}.`;


      this.cdr.detectChanges();


      setTimeout(() => {

        this.showAssignClass = false;

        this.studentToAssign = null;

        this.selectedClassIdForAssignment = '';

        this.classAssignSuccessMessage = '';

        this.cdr.detectChanges();

      }, 700);


    } catch (error) {

      console.error(
        'Failed to assign class:',
        error
      );


      this.classAssignErrorMessage =

        error instanceof Error

          ? error.message

          : 'Unable to assign the class. Please try again.';


      this.cdr.detectChanges();

    } finally {

      this.assigningClass = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // REMOVE STUDENT FROM CLASS
  // =========================================================

  async removeClassAssignment(
    student: Student
  ): Promise<void> {

    if (this.assigningClass) {

      return;

    }


    try {

      this.assigningClass = true;

      const studentRef =
        ref(
          database,
          `students/${student.id}`
        );


      await update(
        studentRef,
        {

          classId: '',

          className: '',

          class: '',

          updatedAt:
            new Date().toISOString()

        }
      );


      const index =
        this.students.findIndex(
          item =>
            item.id ===
            student.id
        );


      if (index !== -1) {

        this.students[index] = {

          ...this.students[index],

          classId: '',

          className: '',

          class: ''

        };

      }


      if (
        this.selectedStudent &&
        this.selectedStudent.id ===
        student.id
      ) {

        this.selectedStudent = {

          ...this.selectedStudent,

          classId: '',

          className: '',

          class: ''

        };

      }


      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Failed to remove class:',
        error
      );


      this.errorMessage =

        error instanceof Error

          ? error.message

          : 'Unable to remove student from class.';


      this.cdr.detectChanges();

    } finally {

      this.assigningClass = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // GENERATE STUDENT ID
  // =========================================================

  private generateStudentId(): string {

    const randomNumber =
      Math.floor(
        100000 +
        Math.random() * 900000
      );


    return `DL-${randomNumber}`;

  }


  // =========================================================
  // RESET FORM
  // =========================================================

  resetForm(): void {

    this.student = {

      firstName: '',

      middleName: '',

      lastName: '',

      gender: '',

      dateOfBirth: '',

      studentId: '',

      class: '',

      classId: '',

      className: '',

      parentId: '',

      parentName: '',

      parentPhone: '',

      parentEmail: '',

      address: '',

      status: 'active'

    };

  }


  // =========================================================
  // GET FULL STUDENT NAME
  // =========================================================

  getStudentName(
    student: Student
  ): string {

    return [

      student.firstName,

      student.middleName,

      student.lastName

    ]

      .filter(Boolean)

      .join(' ');

  }


  // =========================================================
  // OPEN DELETE CONFIRMATION
  // =========================================================

  openDeleteStudent(
    student: Student
  ): void {

    if (this.deleting) {

      return;

    }


    this.studentToDelete = {
      ...student
    };


    this.deleteErrorMessage = '';

    this.showDeleteStudent = true;


    this.cdr.detectChanges();

  }


  // =========================================================
  // CLOSE DELETE CONFIRMATION
  // =========================================================

  closeDeleteStudent(): void {

    if (this.deleting) {

      return;

    }


    this.showDeleteStudent = false;

    this.studentToDelete = null;

    this.deleteErrorMessage = '';


    this.cdr.detectChanges();

  }


  // =========================================================
  // DELETE STUDENT
  // =========================================================

  async deleteStudent(): Promise<void> {

    if (
      !this.studentToDelete ||
      this.deleting
    ) {

      return;

    }


    const studentId =
      this.studentToDelete.id;


    if (!studentId) {

      this.deleteErrorMessage =
        'Unable to delete this student because the student ID is missing.';

      this.cdr.detectChanges();

      return;

    }


    this.deleting = true;

    this.deleteErrorMessage = '';

    this.cdr.detectChanges();


    try {

      const studentRef =
        ref(
          database,
          `students/${studentId}`
        );


      await remove(studentRef);


      this.students =
        this.students.filter(
          student =>
            student.id !== studentId
        );


      if (
        this.selectedStudent?.id ===
        studentId
      ) {

        this.selectedStudent = null;

        this.showStudentDetails = false;

      }


      if (
        this.editingStudent?.id ===
        studentId
      ) {

        this.editingStudent = null;

        this.showEditStudent = false;

      }


      this.calculateStatistics();


      this.showDeleteStudent = false;

      this.studentToDelete = null;

      this.deleteErrorMessage = '';


      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Failed to delete student:',
        error
      );


      this.deleteErrorMessage =

        error instanceof Error

          ? error.message

          : 'Unable to delete student. Please try again.';


      this.cdr.detectChanges();


    } finally {

      this.deleting = false;

      this.cdr.detectChanges();

    }

  }

}