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

import { database } from '../../../core/firebase.config';


// =====================================================
// PARENT INTERFACE
// =====================================================

interface Parent {

  id: string;

  parentId: string;

  fullName: string;

  relationship: string;

  phone: string;

  email: string;

  occupation: string;

  address: string;

  emergencyContact: string;

  status: 'active' | 'inactive';

  createdAt: number;

  updatedAt?: number;
}


// =====================================================
// STUDENT SUMMARY
// =====================================================

interface StudentSummary {

  id: string;

  studentId: string;

  firstName: string;

  middleName: string;

  lastName: string;

  gender: string;

  dateOfBirth: string;

  class: string;

  parentId: string;

  status: string;
}


// =====================================================
// COMPONENT
// =====================================================

@Component({

  selector: 'app-parents',

  standalone: true,

  imports: [
    NgFor,
    NgIf,
    FormsModule,
    TitleCasePipe
  ],

  templateUrl: './parents.html',

  styleUrl: './parents.css'

})


export class Parents implements OnInit {


  // =====================================================
  // PARENTS
  // =====================================================

  parents: Parent[] = [];


  // =====================================================
  // STUDENTS
  // =====================================================

  students: StudentSummary[] = [];

  parentChildren: StudentSummary[] = [];

  loadingChildren = false;


  // =====================================================
  // STATISTICS
  // =====================================================

  totalParents = 0;

  activeParents = 0;

  inactiveParents = 0;


  // =====================================================
  // SEARCH / FILTER
  // =====================================================

  searchTerm = '';

  selectedRelationship = '';

  selectedStatus = '';


  // =====================================================
  // UI STATE
  // =====================================================

  loading = false;

  saving = false;

  updating = false;

  deleting = false;


  // =====================================================
  // MODALS
  // =====================================================

  showAddParent = false;

  showParentDetails = false;

  showEditParent = false;

  showDeleteParent = false;


  // =====================================================
  // SELECTED PARENT
  // =====================================================

  selectedParent: Parent | null = null;

  parentToDelete: Parent | null = null;


  // =====================================================
  // FORM
  // =====================================================

  newParent: Partial<Parent> = {

    parentId: '',

    fullName: '',

    relationship: '',

    phone: '',

    email: '',

    occupation: '',

    address: '',

    emergencyContact: '',

    status: 'active'

  };


  // =====================================================
  // MESSAGES
  // =====================================================

  errorMessage = '';

  successMessage = '';

  deleteErrorMessage = '';


  // =====================================================
  // CONSTRUCTOR
  // =====================================================

  constructor(
    private readonly cdr: ChangeDetectorRef
  ) {}


  // =====================================================
  // INIT
  // =====================================================

  async ngOnInit(): Promise<void> {

    /*
     * Load parents and students at the same time.
     *
     * This is the important change that fixes the
     * "click View twice" problem.
     */

    await Promise.all([
      this.loadParents(),
      this.loadStudents()
    ]);

  }


  // =====================================================
  // LOAD PARENTS
  // =====================================================

  async loadParents(): Promise<void> {

    this.loading = true;

    this.errorMessage = '';

    try {

      const parentsRef =
        ref(
          database,
          'parents'
        );

      const snapshot =
        await get(parentsRef);


      if (snapshot.exists()) {

        const data =
          snapshot.val();


        this.parents =
          Object.entries(data).map(
            ([key, value]: [string, any]) => {

              return {

                id: key,

                parentId:
                  value.parentId ||
                  this.generateParentId(),

                fullName:
                  value.fullName ||
                  '',

                relationship:
                  value.relationship ||
                  '',

                phone:
                  value.phone ||
                  '',

                email:
                  value.email ||
                  '',

                occupation:
                  value.occupation ||
                  '',

                address:
                  value.address ||
                  '',

                emergencyContact:
                  value.emergencyContact ||
                  '',

                status:
                  value.status === 'inactive'
                    ? 'inactive'
                    : 'active',

                createdAt:
                  value.createdAt ||
                  Date.now(),

                updatedAt:
                  value.updatedAt ||
                  undefined

              };

            }
          );


        this.parents.sort(
          (a, b) =>
            (b.createdAt || 0) -
            (a.createdAt || 0)
        );


      } else {

        this.parents = [];

      }


      this.calculateStats();


    } catch (error) {

      console.error(
        'Error loading parents:',
        error
      );

      this.errorMessage =
        'Unable to load parents. Please try again.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // LOAD STUDENTS
  // =====================================================

  async loadStudents(): Promise<void> {

    this.loadingChildren = true;

    try {

      const studentsRef =
        ref(
          database,
          'students'
        );

      const snapshot =
        await get(studentsRef);


      /*
       * No students in database.
       */

      if (!snapshot.exists()) {

        this.students = [];

        this.parentChildren = [];

        return;

      }


      const data =
        snapshot.val();


      this.students =
        Object.entries(data).map(
          ([key, value]: [string, any]) => {

            return {

              id: key,

              studentId:
                value.studentId ||
                key,

              firstName:
                value.firstName ||
                '',

              middleName:
                value.middleName ||
                '',

              lastName:
                value.lastName ||
                '',

              gender:
                value.gender ||
                '',

              dateOfBirth:
                value.dateOfBirth ||
                '',

              class:
                value.class ||
                value.classApplied ||
                '',

              parentId:
                value.parentId ||
                '',

              status:
                value.status ||
                'active'

            };

          }
        );


      /*
       * If a parent modal is already open,
       * immediately calculate its children.
       */

      this.updateParentChildren();


    } catch (error) {

      console.error(
        'Error loading students:',
        error
      );

      this.students = [];

      this.parentChildren = [];

    } finally {

      this.loadingChildren = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // UPDATE CURRENT PARENT'S CHILDREN
  // =====================================================

  updateParentChildren(): void {

    if (!this.selectedParent) {

      this.parentChildren = [];

      return;

    }


    const selectedParentId =
      String(
        this.selectedParent.parentId ||
        ''
      ).trim();


    const selectedFirebaseId =
      String(
        this.selectedParent.id ||
        ''
      ).trim();


    this.parentChildren =
      this.students.filter(
        student => {

          const studentParentId =
            String(
              student.parentId ||
              ''
            ).trim();


          return (

            studentParentId ===
            selectedParentId

            ||

            studentParentId ===
            selectedFirebaseId

          );

        }
      );


    console.log(
      'Selected Parent:',
      this.selectedParent
    );

    console.log(
      'Parent ID:',
      selectedParentId
    );

    console.log(
      'Firebase Parent ID:',
      selectedFirebaseId
    );

    console.log(
      'Linked Students:',
      this.parentChildren
    );

  }


  // =====================================================
  // GET STUDENT FULL NAME
  // =====================================================

  getStudentName(
    student: StudentSummary
  ): string {

    return [

      student.firstName,

      student.middleName,

      student.lastName

    ]

      .filter(Boolean)

      .join(' ')

      .trim();

  }


  // =====================================================
  // GET CHILDREN COUNT
  // =====================================================

  getChildrenCount(
    parent: Parent
  ): number {

    const parentId =
      String(
        parent.parentId ||
        ''
      ).trim();


    const firebaseParentId =
      String(
        parent.id ||
        ''
      ).trim();


    return this.students.filter(
      student => {

        const studentParentId =
          String(
            student.parentId ||
            ''
          ).trim();


        return (

          studentParentId ===
          parentId

          ||

          studentParentId ===
          firebaseParentId

        );

      }
    ).length;

  }


  // =====================================================
  // GENERATE PARENT ID
  // =====================================================

  generateParentId(): string {

    const randomNumber =
      Math.floor(
        100000 +
        Math.random() * 900000
      );


    return `DL-P-${randomNumber}`;

  }


  // =====================================================
  // CALCULATE STATISTICS
  // =====================================================

  calculateStats(): void {

    this.totalParents =
      this.parents.length;


    this.activeParents =
      this.parents.filter(
        parent =>
          parent.status === 'active'
      ).length;


    this.inactiveParents =
      this.parents.filter(
        parent =>
          parent.status === 'inactive'
      ).length;

  }


  // =====================================================
  // FILTERED PARENTS
  // =====================================================

  get filteredParents(): Parent[] {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    return this.parents.filter(
      parent => {

        const matchesSearch =

          !search ||

          parent.fullName
            .toLowerCase()
            .includes(search) ||

          parent.parentId
            .toLowerCase()
            .includes(search) ||

          parent.phone
            .toLowerCase()
            .includes(search) ||

          parent.email
            .toLowerCase()
            .includes(search);


        const matchesRelationship =

          !this.selectedRelationship ||

          parent.relationship ===
          this.selectedRelationship;


        const matchesStatus =

          !this.selectedStatus ||

          parent.status ===
          this.selectedStatus;


        return (

          matchesSearch &&

          matchesRelationship &&

          matchesStatus

        );

      }
    );

  }


  // =====================================================
  // OPEN ADD PARENT
  // =====================================================

  openAddParent(): void {

    this.resetForm();

    this.errorMessage = '';

    this.successMessage = '';

    this.showAddParent = true;

  }


  // =====================================================
  // CLOSE ADD PARENT
  // =====================================================

  closeAddParent(): void {

    if (this.saving) {

      return;

    }


    this.showAddParent = false;

  }


  // =====================================================
  // SAVE PARENT
  // =====================================================

  async saveParent(): Promise<void> {

    if (this.saving) {

      return;

    }


    this.errorMessage = '';

    this.successMessage = '';


    if (!this.newParent.fullName?.trim()) {

      this.errorMessage =
        'Please enter the parent or guardian name.';

      return;

    }


    if (!this.newParent.relationship?.trim()) {

      this.errorMessage =
        'Please select the relationship.';

      return;

    }


    if (!this.newParent.phone?.trim()) {

      this.errorMessage =
        'Please enter a phone number.';

      return;

    }


    this.saving = true;


    try {

      const parentsRef =
        ref(
          database,
          'parents'
        );


      const newParentRef =
        push(parentsRef);


      const now =
        Date.now();


      const parentData: Parent = {

        id:
          newParentRef.key!,

        parentId:
          this.newParent.parentId?.trim() ||
          this.generateParentId(),

        fullName:
          this.newParent.fullName.trim(),

        relationship:
          this.newParent.relationship.trim(),

        phone:
          this.newParent.phone.trim(),

        email:
          this.newParent.email?.trim() ||
          '',

        occupation:
          this.newParent.occupation?.trim() ||
          '',

        address:
          this.newParent.address?.trim() ||
          '',

        emergencyContact:
          this.newParent.emergencyContact?.trim() ||
          '',

        status:
          this.newParent.status ||
          'active',

        createdAt:
          now,

        updatedAt:
          now

      };


      await set(
        newParentRef,
        parentData
      );


      this.parents.unshift(
        parentData
      );


      this.calculateStats();


      this.successMessage =
        `${parentData.fullName} has been added successfully.`;


      this.resetForm();

      this.showAddParent = false;


    } catch (error) {

      console.error(
        'Error saving parent:',
        error
      );

      this.errorMessage =
        'Unable to save parent. Please try again.';

    } finally {

      this.saving = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // VIEW PARENT
  // =====================================================

  viewParent(
    parent: Parent
  ): void {

    /*
     * Students have already been loaded during
     * ngOnInit().
     *
     * Therefore View is now instant.
     */

    this.selectedParent =
      {
        ...parent
      };


    this.updateParentChildren();


    this.showParentDetails =
      true;


    this.loadingChildren = false;


    this.cdr.detectChanges();


    console.log(
      'Viewing parent:',
      this.selectedParent
    );

    console.log(
      'Children:',
      this.parentChildren
    );

  }


  // =====================================================
  // CLOSE VIEW PARENT
  // =====================================================

  closeParentDetails(): void {

    this.showParentDetails =
      false;


    this.selectedParent =
      null;


    this.parentChildren =
      [];


    this.cdr.detectChanges();

  }


  // =====================================================
  // OPEN EDIT PARENT
  // =====================================================

  editParent(
    parent: Parent
  ): void {

    this.selectedParent =
      {
        ...parent
      };


    this.showEditParent =
      true;


    this.errorMessage = '';


    this.cdr.detectChanges();

  }


  // =====================================================
  // CLOSE EDIT PARENT
  // =====================================================

  closeEditParent(): void {

    if (this.updating) {

      return;

    }


    this.showEditParent =
      false;


    this.selectedParent =
      null;


    this.cdr.detectChanges();

  }


  // =====================================================
  // UPDATE PARENT
  // =====================================================

  async updateParent(): Promise<void> {

    if (
      this.updating ||
      !this.selectedParent
    ) {

      return;

    }


    this.errorMessage = '';


    if (
      !this.selectedParent.fullName.trim()
    ) {

      this.errorMessage =
        'Please enter the parent or guardian name.';

      return;

    }


    if (
      !this.selectedParent.relationship.trim()
    ) {

      this.errorMessage =
        'Please select the relationship.';

      return;

    }


    if (
      !this.selectedParent.phone.trim()
    ) {

      this.errorMessage =
        'Please enter a phone number.';

      return;

    }


    this.updating = true;


    try {

      const parentRef =
        ref(
          database,
          `parents/${this.selectedParent.id}`
        );


      const updatedParent = {

        parentId:
          this.selectedParent.parentId,

        fullName:
          this.selectedParent.fullName.trim(),

        relationship:
          this.selectedParent.relationship.trim(),

        phone:
          this.selectedParent.phone.trim(),

        email:
          this.selectedParent.email?.trim() ||
          '',

        occupation:
          this.selectedParent.occupation?.trim() ||
          '',

        address:
          this.selectedParent.address?.trim() ||
          '',

        emergencyContact:
          this.selectedParent.emergencyContact?.trim() ||
          '',

        status:
          this.selectedParent.status,

        createdAt:
          this.selectedParent.createdAt,

        updatedAt:
          Date.now()

      };


      await update(
        parentRef,
        updatedParent
      );


      const index =
        this.parents.findIndex(
          parent =>
            parent.id ===
            this.selectedParent!.id
        );


      if (index !== -1) {

        this.parents[index] = {

          ...this.selectedParent,

          ...updatedParent

        };

      }


      this.calculateStats();


      this.successMessage =
        `${updatedParent.fullName} has been updated successfully.`;


      this.showEditParent =
        false;


      this.selectedParent =
        null;


    } catch (error) {

      console.error(
        'Error updating parent:',
        error
      );

      this.errorMessage =
        'Unable to update parent. Please try again.';

    } finally {

      this.updating = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // OPEN DELETE CONFIRMATION
  // =====================================================

  async openDeleteParent(
    parent: Parent
  ): Promise<void> {

    this.parentToDelete =
      parent;


    this.deleteErrorMessage = '';


    this.showDeleteParent =
      true;


    this.cdr.detectChanges();

  }


  // =====================================================
  // CLOSE DELETE CONFIRMATION
  // =====================================================

  closeDeleteParent(): void {

    if (this.deleting) {

      return;

    }


    this.showDeleteParent =
      false;


    this.parentToDelete =
      null;


    this.deleteErrorMessage = '';


    this.cdr.detectChanges();

  }


  // =====================================================
  // CHECK WHETHER PARENT HAS CHILDREN
  // =====================================================

  async parentHasStudents(
    parent: Parent
  ): Promise<boolean> {

    /*
     * First check the students already loaded
     * in memory.
     */

    const linkedLocally =
      this.students.some(
        student => {

          const studentParentId =
            String(
              student.parentId ||
              ''
            ).trim();


          const parentId =
            String(
              parent.parentId ||
              ''
            ).trim();


          const firebaseParentId =
            String(
              parent.id ||
              ''
            ).trim();


          return (

            studentParentId ===
            parentId

            ||

            studentParentId ===
            firebaseParentId

          );

        }
      );


    if (linkedLocally) {

      return true;

    }


    /*
     * Fallback Firebase check.
     *
     * This protects against stale student data.
     */

    const studentsRef =
      ref(
        database,
        'students'
      );


    const snapshot =
      await get(studentsRef);


    if (!snapshot.exists()) {

      return false;

    }


    const students =
      snapshot.val();


    return Object.values(students)
      .some(
        (value: any) => {

          const student =
            value || {};


          return (

            student.parentId ===
            parent.parentId

            ||

            student.parentId ===
            parent.id

          );

        }
      );

  }


  // =====================================================
  // DELETE PARENT
  // =====================================================

  async deleteParent(): Promise<void> {

    if (
      this.deleting ||
      !this.parentToDelete
    ) {

      return;

    }


    this.deleting = true;

    this.deleteErrorMessage = '';


    try {

      const parent =
        this.parentToDelete;


      // -------------------------------------------------
      // NEVER DELETE A PARENT WHO HAS LINKED STUDENTS
      // -------------------------------------------------

      const hasStudents =
        await this.parentHasStudents(
          parent
        );


      if (hasStudents) {

        this.deleteErrorMessage =
          'This parent cannot be deleted because one or more students are still linked to this parent. Reassign the students first.';

        return;

      }


      const parentRef =
        ref(
          database,
          `parents/${parent.id}`
        );


      await remove(
        parentRef
      );


      this.parents =
        this.parents.filter(
          currentParent =>
            currentParent.id !==
            parent.id
        );


      this.calculateStats();


      this.showDeleteParent =
        false;


      this.parentToDelete =
        null;


      this.successMessage =
        `${parent.fullName} has been deleted successfully.`;


    } catch (error) {

      console.error(
        'Error deleting parent:',
        error
      );


      this.deleteErrorMessage =
        'Unable to delete parent. Please try again.';

    } finally {

      this.deleting = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // RESET FORM
  // =====================================================

  resetForm(): void {

    this.newParent = {

      parentId: '',

      fullName: '',

      relationship: '',

      phone: '',

      email: '',

      occupation: '',

      address: '',

      emergencyContact: '',

      status: 'active'

    };

  }


  // =====================================================
  // CLEAR FILTERS
  // =====================================================

  clearFilters(): void {

    this.searchTerm = '';

    this.selectedRelationship = '';

    this.selectedStatus = '';

  }

}

