import {
  DatePipe,
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
  update
} from 'firebase/database';

import { database } from '../../../core/firebase.config';
import { pipe } from 'rxjs';


// =====================================================
// SUBJECT INTERFACE
// =====================================================

interface SchoolSubject {

  id: string;

  subjectCode: string;

  subjectName: string;

  category: string;

  description: string;

  status: 'active' | 'inactive';

  createdAt: number;

  updatedAt?: number;

}


// =====================================================
// COMPONENT
// =====================================================

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    FormsModule,
    DatePipe,
    TitleCasePipe
  ],
  templateUrl: './subjects.html',
  styleUrl: './subjects.css'
})
export class Subjects implements OnInit {


  // ===================================================
  // DATA
  // ===================================================

  subjects: SchoolSubject[] = [];


  // ===================================================
  // STATISTICS
  // ===================================================

  totalSubjects = 0;

  activeSubjects = 0;

  inactiveSubjects = 0;


  // ===================================================
  // FILTERS
  // ===================================================

  searchTerm = '';

  selectedCategory = '';

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

  showAddSubject = false;

  showSubjectDetails = false;

  showEditSubject = false;

  showDeleteSubject = false;


  // ===================================================
  // SELECTED SUBJECT
  // ===================================================

  selectedSubject: SchoolSubject | null = null;

  subjectToDelete: SchoolSubject | null = null;


  // ===================================================
  // NEW SUBJECT FORM
  // ===================================================

  newSubject = {

    subjectCode: '',

    subjectName: '',

    category: '',

    description: '',

    status: 'active' as 'active' | 'inactive'

  };


  // ===================================================
  // EDIT SUBJECT FORM
  // ===================================================

  editSubjectData = {

    id: '',

    subjectCode: '',

    subjectName: '',

    category: '',

    description: '',

    status: 'active' as 'active' | 'inactive'

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

    this.loadSubjects();

  }


  // ===================================================
  // CLEAR MESSAGES
  // ===================================================

  clearMessages(): void {

    this.successMessage = '';

    this.errorMessage = '';

  }


  // ===================================================
  // LOAD SUBJECTS
  // ===================================================

  async loadSubjects(): Promise<void> {

    this.loading = true;

    this.errorMessage = '';

    try {

      const snapshot =
        await get(
          ref(database, 'subjects')
        );

      const data =
        snapshot.val();

      this.subjects = [];

      if (data) {

        Object.entries(data).forEach(
          ([id, value]: [string, any]) => {

            this.subjects.push({

              id,

              subjectCode:
                value.subjectCode || '',

              subjectName:
                value.subjectName || '',

              category:
                value.category || '',

              description:
                value.description || '',

              status:
                value.status === 'inactive'
                  ? 'inactive'
                  : 'active',

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

      this.subjects.sort(
        (a, b) =>
          b.createdAt - a.createdAt
      );

      this.calculateStats();

      this.cdr.detectChanges();

    } catch (error) {

      console.error(
        'Error loading subjects:',
        error
      );

      this.errorMessage =
        'Unable to load subjects. Please try again.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // ===================================================
  // CALCULATE STATISTICS
  // ===================================================

  calculateStats(): void {

    this.totalSubjects =
      this.subjects.length;

    this.activeSubjects =
      this.subjects.filter(
        item =>
          item.status === 'active'
      ).length;

    this.inactiveSubjects =
      this.subjects.filter(
        item =>
          item.status === 'inactive'
      ).length;

  }


  // ===================================================
  // FILTERED SUBJECTS
  // ===================================================

  get filteredSubjects(): SchoolSubject[] {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();

    return this.subjects.filter(
      item => {

        const matchesSearch =
          !search ||

          item.subjectName
            .toLowerCase()
            .includes(search) ||

          item.subjectCode
            .toLowerCase()
            .includes(search) ||

          item.category
            .toLowerCase()
            .includes(search);


        const matchesCategory =
          !this.selectedCategory ||
          item.category ===
            this.selectedCategory;


        const matchesStatus =
          !this.selectedStatus ||
          item.status ===
            this.selectedStatus;


        return (
          matchesSearch &&
          matchesCategory &&
          matchesStatus
        );

      }
    );

  }


  // ===================================================
  // OPEN ADD SUBJECT
  // ===================================================

  openAddSubject(): void {

    this.resetForm();

    this.showAddSubject = true;

    this.clearMessages();

  }


  // ===================================================
  // CLOSE ADD SUBJECT
  // ===================================================

  closeAddSubject(): void {

    if (this.saving) {

      return;

    }

    this.showAddSubject = false;

  }


  // ===================================================
  // GENERATE SUBJECT CODE
  // ===================================================

  generateSubjectCode(): string {

    const number =
      Math.floor(
        1000 +
        Math.random() * 9000
      );

    return `DL-SUB-${number}`;

  }


  // ===================================================
  // SAVE SUBJECT
  // ===================================================

  async saveSubject(): Promise<void> {

    if (this.saving) {

      return;

    }

    this.clearMessages();


    if (
      !this.newSubject.subjectName.trim()
    ) {

      this.errorMessage =
        'Please enter the subject name.';

      return;

    }


    if (
      !this.newSubject.category.trim()
    ) {

      this.errorMessage =
        'Please select or enter the subject category.';

      return;

    }


    this.saving = true;


    try {

      const subjectCode =
        this.newSubject.subjectCode.trim() ||
        this.generateSubjectCode();


      const subjectRef =
        push(
          ref(database, 'subjects')
        );


      const now =
        Date.now();


      const subjectData: SchoolSubject = {

        id:
          subjectRef.key!,

        subjectCode,

        subjectName:
          this.newSubject.subjectName.trim(),

        category:
          this.newSubject.category.trim(),

        description:
          this.newSubject.description.trim(),

        status:
          this.newSubject.status,

        createdAt:
          now,

        updatedAt:
          now

      };


      await update(
        subjectRef,
        subjectData
      );


      this.subjects.unshift(
        subjectData
      );


      this.calculateStats();


      this.successMessage =
        'Subject added successfully.';


      this.showAddSubject = false;

      this.resetForm();


      this.cdr.detectChanges();

    } catch (error) {

      console.error(
        'Error saving subject:',
        error
      );

      this.errorMessage =
        'Unable to save subject. Please try again.';

    } finally {

      this.saving = false;

      this.cdr.detectChanges();

    }

  }


  // ===================================================
  // VIEW SUBJECT
  // ===================================================

  viewSubject(
    subject: SchoolSubject
  ): void {

    this.selectedSubject =
      subject;

    this.showSubjectDetails =
      true;

    this.clearMessages();

  }


  // ===================================================
  // CLOSE SUBJECT DETAILS
  // ===================================================

  closeSubjectDetails(): void {

    this.showSubjectDetails =
      false;

    this.selectedSubject =
      null;

  }


  // ===================================================
  // EDIT SUBJECT
  // ===================================================

  editSubject(
    subject: SchoolSubject
  ): void {

    this.selectedSubject =
      subject;


    this.editSubjectData = {

      id:
        subject.id,

      subjectCode:
        subject.subjectCode,

      subjectName:
        subject.subjectName,

      category:
        subject.category,

      description:
        subject.description,

      status:
        subject.status

    };


    this.showEditSubject =
      true;

    this.clearMessages();

  }


  // ===================================================
  // CLOSE EDIT
  // ===================================================

  closeEditSubject(): void {

    if (this.updating) {

      return;

    }

    this.showEditSubject =
      false;

  }


  // ===================================================
  // UPDATE SUBJECT
  // ===================================================

  async updateSubject(): Promise<void> {

    if (
      this.updating ||
      !this.editSubjectData.id
    ) {

      return;

    }


    this.clearMessages();


    if (
      !this.editSubjectData.subjectName.trim()
    ) {

      this.errorMessage =
        'Please enter the subject name.';

      return;

    }


    if (
      !this.editSubjectData.category.trim()
    ) {

      this.errorMessage =
        'Please select or enter the subject category.';

      return;

    }


    this.updating = true;


    try {

      const updates = {

        subjectCode:
          this.editSubjectData.subjectCode.trim(),

        subjectName:
          this.editSubjectData.subjectName.trim(),

        category:
          this.editSubjectData.category.trim(),

        description:
          this.editSubjectData.description.trim(),

        status:
          this.editSubjectData.status,

        updatedAt:
          Date.now()

      };


      await update(
        ref(
          database,
          `subjects/${this.editSubjectData.id}`
        ),
        updates
      );


      const index =
        this.subjects.findIndex(
          item =>
            item.id ===
            this.editSubjectData.id
        );


      if (index !== -1) {

        this.subjects[index] = {

          ...this.subjects[index],

          ...updates

        };

      }


      this.calculateStats();


      this.successMessage =
        'Subject updated successfully.';


      this.showEditSubject =
        false;


      this.cdr.detectChanges();

    } catch (error) {

      console.error(
        'Error updating subject:',
        error
      );

      this.errorMessage =
        'Unable to update subject. Please try again.';

    } finally {

      this.updating = false;

      this.cdr.detectChanges();

    }

  }


  // ===================================================
  // OPEN DELETE
  // ===================================================

  openDeleteSubject(
    subject: SchoolSubject
  ): void {

    this.subjectToDelete =
      subject;

    this.showDeleteSubject =
      true;

    this.clearMessages();

  }


  // ===================================================
  // CLOSE DELETE
  // ===================================================

  closeDeleteSubject(): void {

    if (this.deleting) {

      return;

    }

    this.showDeleteSubject =
      false;

    this.subjectToDelete =
      null;

  }


  // ===================================================
  // DELETE SUBJECT
  // ===================================================

  async deleteSubject(): Promise<void> {

    if (
      this.deleting ||
      !this.subjectToDelete
    ) {

      return;

    }


    this.deleting = true;

    this.clearMessages();


    try {

      const id =
        this.subjectToDelete.id;


      await remove(
        ref(
          database,
          `subjects/${id}`
        )
      );


      this.subjects =
        this.subjects.filter(
          item =>
            item.id !== id
        );


      this.calculateStats();


      this.successMessage =
        'Subject deleted successfully.';


      this.showDeleteSubject = false;

      this.subjectToDelete = null;


      this.cdr.detectChanges();

    } catch (error) {

      console.error(
        'Error deleting subject:',
        error
      );

      this.errorMessage =
        'Unable to delete subject. Please try again.';

    } finally {

      this.deleting = false;

      this.cdr.detectChanges();

    }

  }


  // ===================================================
  // RESET FORM
  // ===================================================

  resetForm(): void {

    this.newSubject = {

      subjectCode:
        this.generateSubjectCode(),

      subjectName: '',

      category: '',

      description: '',

      status: 'active'

    };

  }


  // ===================================================
  // CLEAR FILTERS
  // ===================================================

  clearFilters(): void {

    this.searchTerm = '';

    this.selectedCategory = '';

    this.selectedStatus = '';

  }

}


