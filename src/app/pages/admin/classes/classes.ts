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
// STAFF INTERFACE
// =====================================================

interface StaffMember {

  id: string;

  staffId: string;

  fullName: string;

  position: string;

  department: string;

  status: string;

}


// =====================================================
// CLASS INTERFACE
// =====================================================

interface SchoolClass {

  id: string;

  classCode: string;

  className: string;

  section: string;

  /*
   * This is the MAIN / CLASS TEACHER.
   *
   * It is NOT the teacher for every subject.
   *
   * Subject teachers will be handled later
   * through the Teaching Assignments module.
   */

  classTeacherId: string;

  classTeacherName: string;

  room: string;

  capacity: number;

  academicYear: string;

  status: 'active' | 'inactive';

  description: string;

  createdAt: number;

  updatedAt?: number;

}


// =====================================================
// COMPONENT
// =====================================================

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    FormsModule
  ],
  templateUrl: './classes.html',
  styleUrl: './classes.css'
})
export class Classes implements OnInit {


  // ===================================================
  // DATA
  // ===================================================

  classes: SchoolClass[] = [];

  staff: StaffMember[] = [];


  // ===================================================
  // STATISTICS
  // ===================================================

  totalClasses = 0;

  activeClasses = 0;

  inactiveClasses = 0;

  totalCapacity = 0;


  // ===================================================
  // FILTERS
  // ===================================================

  searchTerm = '';

  selectedSection = '';

  selectedStatus = '';


  // ===================================================
  // UI STATES
  // ===================================================

  loading = false;

  saving = false;

  updating = false;

  deleting = false;


  // ===================================================
  // MESSAGES
  // ===================================================

  successMessage = '';

  errorMessage = '';


  // ===================================================
  // MODALS
  // ===================================================

  showAddClass = false;

  showClassDetails = false;

  showEditClass = false;

  showDeleteClass = false;


  // ===================================================
  // SELECTED CLASS
  // ===================================================

  selectedClass: SchoolClass | null = null;

  classToDelete: SchoolClass | null = null;


  // ===================================================
  // NEW CLASS FORM
  // ===================================================

  newClass = {

    classCode: '',

    className: '',

    section: '',

    /*
     * Optional main/class teacher.
     *
     * Subject teachers will NOT be stored here.
     */

    classTeacherId: '',

    classTeacherName: '',

    room: '',

    capacity: 30,

    academicYear: '',

    status: 'active' as 'active' | 'inactive',

    description: ''

  };


  // ===================================================
  // EDIT CLASS FORM
  // ===================================================

  editClassData = {

    id: '',

    classCode: '',

    className: '',

    section: '',

    classTeacherId: '',

    classTeacherName: '',

    room: '',

    capacity: 30,

    academicYear: '',

    status: 'active' as 'active' | 'inactive',

    description: ''

  };


  // ===================================================
  // CONSTRUCTOR
  // ===================================================

  constructor(
    private cdr: ChangeDetectorRef
  ) {}


  // ===================================================
  // INIT
  // ===================================================

  ngOnInit(): void {

    this.loadClasses();

    this.loadStaff();

  }


  // ===================================================
  // LOAD CLASSES
  // ===================================================

  async loadClasses(): Promise<void> {

    this.loading = true;

    this.errorMessage = '';

    try {

      const snapshot =
        await get(
          ref(database, 'classes')
        );

      const data =
        snapshot.val();

      this.classes = [];

      if (data) {

        Object.entries(data).forEach(
          ([id, value]: [string, any]) => {

            this.classes.push({

              id,

              classCode:
                value.classCode || '',

              className:
                value.className || '',

              section:
                value.section || '',

              classTeacherId:
                value.classTeacherId || '',

              classTeacherName:
                value.classTeacherName || '',

              room:
                value.room || '',

              capacity:
                Number(value.capacity) || 0,

              academicYear:
                value.academicYear || '',

              status:
                value.status === 'inactive'
                  ? 'inactive'
                  : 'active',

              description:
                value.description || '',

              createdAt:
                Number(value.createdAt) ||
                Date.now(),

              updatedAt:
                value.updatedAt
                  ? Number(value.updatedAt)
                  : undefined

            });

          }
        );

      }

      this.classes.sort(
        (a, b) =>
          b.createdAt - a.createdAt
      );

      this.calculateStats();

      this.cdr.detectChanges();

    } catch (error) {

      console.error(
        'Error loading classes:',
        error
      );

      this.errorMessage =
        'Unable to load classes. Please try again.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // ===================================================
  // LOAD ACTIVE STAFF
  // ===================================================

  async loadStaff(): Promise<void> {

    try {

      const snapshot =
        await get(
          ref(database, 'staff')
        );

      const data =
        snapshot.val();

      this.staff = [];

      if (data) {

        Object.entries(data).forEach(
          ([id, value]: [string, any]) => {

            if (
              value.status === 'inactive'
            ) {

              return;

            }

            this.staff.push({

              id,

              staffId:
                value.staffId || '',

              fullName:
                value.fullName || '',

              position:
                value.position || '',

              department:
                value.department || '',

              status:
                value.status || 'active'

            });

          }
        );

      }

      this.staff.sort(
        (a, b) =>
          a.fullName.localeCompare(
            b.fullName
          )
      );

      this.cdr.detectChanges();

    } catch (error) {

      console.error(
        'Error loading staff:',
        error
      );

    }

  }


  // ===================================================
  // CALCULATE STATISTICS
  // ===================================================

  calculateStats(): void {

    this.totalClasses =
      this.classes.length;

    this.activeClasses =
      this.classes.filter(
        item =>
          item.status === 'active'
      ).length;

    this.inactiveClasses =
      this.classes.filter(
        item =>
          item.status === 'inactive'
      ).length;

    this.totalCapacity =
      this.classes.reduce(
        (total, item) =>
          total +
          Number(item.capacity || 0),
        0
      );

  }


  // ===================================================
  // FILTERED CLASSES
  // ===================================================

  get filteredClasses(): SchoolClass[] {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();

    return this.classes.filter(
      item => {

        const matchesSearch =
          !search ||

          item.className
            .toLowerCase()
            .includes(search) ||

          item.classCode
            .toLowerCase()
            .includes(search) ||

          item.section
            .toLowerCase()
            .includes(search) ||

          item.classTeacherName
            .toLowerCase()
            .includes(search) ||

          item.room
            .toLowerCase()
            .includes(search);


        const matchesSection =
          !this.selectedSection ||
          item.section ===
            this.selectedSection;


        const matchesStatus =
          !this.selectedStatus ||
          item.status ===
            this.selectedStatus;


        return (
          matchesSearch &&
          matchesSection &&
          matchesStatus
        );

      }
    );

  }


  // ===================================================
  // OPEN ADD CLASS
  // ===================================================

  openAddClass(): void {

    this.resetForm();

    this.showAddClass = true;

    this.clearMessages();

  }


  // ===================================================
  // CLOSE ADD CLASS
  // ===================================================

  closeAddClass(): void {

    if (this.saving) {

      return;

    }

    this.showAddClass = false;

  }


  // ===================================================
  // GENERATE CLASS CODE
  // ===================================================

  generateClassCode(): string {

    const number =
      Math.floor(
        1000 +
        Math.random() * 9000
      );

    return `DL-CLS-${number}`;

  }


  // ===================================================
  // SELECT CLASS TEACHER
  // ===================================================

  selectTeacher(): void {

    const teacher =
      this.staff.find(
        member =>
          member.id ===
          this.newClass.classTeacherId
      );

    this.newClass.classTeacherName =
      teacher?.fullName || '';

  }


  // ===================================================
  // SELECT EDIT CLASS TEACHER
  // ===================================================

  selectEditTeacher(): void {

    const teacher =
      this.staff.find(
        member =>
          member.id ===
          this.editClassData.classTeacherId
      );

    this.editClassData.classTeacherName =
      teacher?.fullName || '';

  }


  // ===================================================
  // SAVE CLASS
  // ===================================================

  async saveClass(): Promise<void> {

    if (this.saving) {

      return;

    }

    this.errorMessage = '';

    this.successMessage = '';


    if (
      !this.newClass.className.trim()
    ) {

      this.errorMessage =
        'Please enter the class name.';

      return;

    }


    if (
      !this.newClass.section.trim()
    ) {

      this.errorMessage =
        'Please enter the class section.';

      return;

    }


    if (
      !this.newClass.academicYear.trim()
    ) {

      this.errorMessage =
        'Please enter the academic year.';

      return;

    }


    if (
      Number(this.newClass.capacity) <= 0
    ) {

      this.errorMessage =
        'Please enter a valid class capacity.';

      return;

    }


    this.saving = true;


    try {

      const classCode =
        this.newClass.classCode.trim() ||
        this.generateClassCode();


      const classRef =
        push(
          ref(database, 'classes')
        );


      const now =
        Date.now();


      const classData: SchoolClass = {

        id:
          classRef.key!,

        classCode,

        className:
          this.newClass.className.trim(),

        section:
          this.newClass.section.trim(),

        /*
         * This is ONLY the main/class teacher.
         *
         * Subject teachers will be stored
         * in teachingAssignments later.
         */

        classTeacherId:
          this.newClass.classTeacherId,

        classTeacherName:
          this.newClass.classTeacherName,

        room:
          this.newClass.room.trim(),

        capacity:
          Number(this.newClass.capacity),

        academicYear:
          this.newClass.academicYear.trim(),

        status:
          this.newClass.status,

        description:
          this.newClass.description.trim(),

        createdAt:
          now,

        updatedAt:
          now

      };


      await update(
        classRef,
        classData
      );


      this.classes.unshift(
        classData
      );


      this.calculateStats();


      this.successMessage =
        'Class added successfully.';


      this.showAddClass = false;

      this.resetForm();


      this.cdr.detectChanges();

    } catch (error) {

      console.error(
        'Error saving class:',
        error
      );

      this.errorMessage =
        'Unable to save class. Please try again.';

    } finally {

      this.saving = false;

      this.cdr.detectChanges();

    }

  }


  // ===================================================
  // VIEW CLASS
  // ===================================================

  viewClass(
    schoolClass: SchoolClass
  ): void {

    this.selectedClass =
      schoolClass;

    this.showClassDetails =
      true;

    this.clearMessages();

  }


  // ===================================================
  // CLOSE DETAILS
  // ===================================================

  closeClassDetails(): void {

    this.showClassDetails =
      false;

    this.selectedClass =
      null;

  }


  // ===================================================
  // EDIT CLASS
  // ===================================================

  editClass(
    schoolClass: SchoolClass
  ): void {

    this.selectedClass =
      schoolClass;


    this.editClassData = {

      id:
        schoolClass.id,

      classCode:
        schoolClass.classCode,

      className:
        schoolClass.className,

      section:
        schoolClass.section,

      classTeacherId:
        schoolClass.classTeacherId,

      classTeacherName:
        schoolClass.classTeacherName,

      room:
        schoolClass.room,

      capacity:
        schoolClass.capacity,

      academicYear:
        schoolClass.academicYear,

      status:
        schoolClass.status,

      description:
        schoolClass.description

    };


    this.showEditClass =
      true;

    this.clearMessages();

  }


  // ===================================================
  // CLOSE EDIT
  // ===================================================

  closeEditClass(): void {

    if (this.updating) {

      return;

    }

    this.showEditClass =
      false;

  }


  // ===================================================
  // UPDATE CLASS
  // ===================================================

  async updateClass(): Promise<void> {

    if (
      this.updating ||
      !this.editClassData.id
    ) {

      return;

    }


    this.errorMessage = '';

    this.successMessage = '';


    if (
      !this.editClassData.className.trim()
    ) {

      this.errorMessage =
        'Please enter the class name.';

      return;

    }


    if (
      !this.editClassData.section.trim()
    ) {

      this.errorMessage =
        'Please enter the class section.';

      return;

    }


    if (
      !this.editClassData.academicYear.trim()
    ) {

      this.errorMessage =
        'Please enter the academic year.';

      return;

    }


    if (
      Number(this.editClassData.capacity) <= 0
    ) {

      this.errorMessage =
        'Please enter a valid class capacity.';

      return;

    }


    this.updating = true;


    try {

      const updates = {

        classCode:
          this.editClassData.classCode.trim(),

        className:
          this.editClassData.className.trim(),

        section:
          this.editClassData.section.trim(),

        /*
         * Main/class teacher only.
         */

        classTeacherId:
          this.editClassData.classTeacherId,

        classTeacherName:
          this.editClassData.classTeacherName,

        room:
          this.editClassData.room.trim(),

        capacity:
          Number(this.editClassData.capacity),

        academicYear:
          this.editClassData.academicYear.trim(),

        status:
          this.editClassData.status,

        description:
          this.editClassData.description.trim(),

        updatedAt:
          Date.now()

      };


      await update(
        ref(
          database,
          `classes/${this.editClassData.id}`
        ),
        updates
      );


      const index =
        this.classes.findIndex(
          item =>
            item.id ===
            this.editClassData.id
        );


      if (index !== -1) {

        this.classes[index] = {

          ...this.classes[index],

          ...updates

        };

      }


      this.calculateStats();


      this.successMessage =
        'Class updated successfully.';


      this.showEditClass =
        false;


      this.cdr.detectChanges();

    } catch (error) {

      console.error(
        'Error updating class:',
        error
      );

      this.errorMessage =
        'Unable to update class. Please try again.';

    } finally {

      this.updating = false;

      this.cdr.detectChanges();

    }

  }


  // ===================================================
  // OPEN DELETE
  // ===================================================

  openDeleteClass(
    schoolClass: SchoolClass
  ): void {

    this.classToDelete =
      schoolClass;

    this.showDeleteClass =
      true;

    this.clearMessages();

  }


  // ===================================================
  // CLOSE DELETE
  // ===================================================

  closeDeleteClass(): void {

    if (this.deleting) {

      return;

    }

    this.showDeleteClass =
      false;

    this.classToDelete =
      null;

  }


  // ===================================================
  // DELETE CLASS
  // ===================================================

  async deleteClass(): Promise<void> {

    if (
      this.deleting ||
      !this.classToDelete
    ) {

      return;

    }


    this.deleting = true;

    this.errorMessage = '';

    this.successMessage = '';


    try {

      const id =
        this.classToDelete.id;


      await remove(
        ref(
          database,
          `classes/${id}`
        )
      );


      this.classes =
        this.classes.filter(
          item =>
            item.id !== id
        );


      this.calculateStats();


      this.successMessage =
        'Class deleted successfully.';


      this.showDeleteClass = false;

      this.classToDelete = null;


      this.cdr.detectChanges();

    } catch (error) {

      console.error(
        'Error deleting class:',
        error
      );

      this.errorMessage =
        'Unable to delete class. Please try again.';

    } finally {

      this.deleting = false;

      this.cdr.detectChanges();

    }

  }


  // ===================================================
  // RESET FORM
  // ===================================================

  resetForm(): void {

    this.newClass = {

      classCode:
        this.generateClassCode(),

      className: '',

      section: '',

      classTeacherId: '',

      classTeacherName: '',

      room: '',

      capacity: 30,

      academicYear: '',

      status: 'active',

      description: ''

    };

  }


  // ===================================================
  // CLEAR FILTERS
  // ===================================================

  clearFilters(): void {

    this.searchTerm = '';

    this.selectedSection = '';

    this.selectedStatus = '';

  }


  // ===================================================
  // CLEAR MESSAGES
  // ===================================================

  clearMessages(): void {

    this.successMessage = '';

    this.errorMessage = '';

  }

}

