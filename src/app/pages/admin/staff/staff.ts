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
// STAFF MEMBER INTERFACE
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

  status: 'active' | 'inactive';

  createdAt: number;

  updatedAt?: number;
}


// =====================================================
// COMPONENT
// =====================================================

@Component({

  selector: 'app-staff',

  standalone: true,

  imports: [
    NgFor,
    NgIf,
    FormsModule,
    TitleCasePipe
  ],

  templateUrl: './staff.html',

  styleUrl: './staff.css'

})


export class Staff implements OnInit {


  // =====================================================
  // STAFF
  // =====================================================

  staff: StaffMember[] = [];


  // =====================================================
  // STATISTICS
  // =====================================================

  totalStaff = 0;

  activeStaff = 0;

  inactiveStaff = 0;


  // =====================================================
  // SEARCH / FILTER
  // =====================================================

  searchTerm = '';

  selectedPosition = '';

  selectedDepartment = '';

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

  showAddStaff = false;

  showStaffDetails = false;

  showEditStaff = false;

  showDeleteStaff = false;


  // =====================================================
  // SELECTED STAFF
  // =====================================================

  selectedStaff: StaffMember | null = null;

  staffToDelete: StaffMember | null = null;


  // =====================================================
  // FORM
  // =====================================================

  newStaff: Partial<StaffMember> = {

    staffId: '',

    fullName: '',

    email: '',

    phone: '',

    gender: '',

    position: '',

    department: '',

    qualification: '',

    employmentDate: '',

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

  ngOnInit(): void {

    this.loadStaff();

  }


  // =====================================================
  // LOAD STAFF
  // =====================================================

  async loadStaff(): Promise<void> {

    this.loading = true;

    this.errorMessage = '';

    try {

      const staffRef =
        ref(
          database,
          'staff'
        );


      const snapshot =
        await get(staffRef);


      if (!snapshot.exists()) {

        this.staff = [];

      } else {

        const data =
          snapshot.val();


        this.staff =
          Object.entries(data).map(
            ([key, value]: [string, any]) => {

              return {

                id: key,

                staffId:
                  value.staffId ||
                  this.generateStaffId(),

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


        this.staff.sort(
          (a, b) =>
            (b.createdAt || 0) -
            (a.createdAt || 0)
        );

      }


      this.calculateStats();


    } catch (error) {

      console.error(
        'Error loading staff:',
        error
      );

      this.errorMessage =
        'Unable to load teachers and staff. Please try again.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // GENERATE STAFF ID
  // =====================================================

  generateStaffId(): string {

    const randomNumber =
      Math.floor(
        100000 +
        Math.random() * 900000
      );


    return `DL-ST-${randomNumber}`;

  }


  // =====================================================
  // CALCULATE STATISTICS
  // =====================================================

  calculateStats(): void {

    this.totalStaff =
      this.staff.length;


    this.activeStaff =
      this.staff.filter(
        member =>
          member.status === 'active'
      ).length;


    this.inactiveStaff =
      this.staff.filter(
        member =>
          member.status === 'inactive'
      ).length;

  }


  // =====================================================
  // FILTERED STAFF
  // =====================================================

  get filteredStaff(): StaffMember[] {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    return this.staff.filter(
      member => {

        const matchesSearch =

          !search ||

          member.fullName
            .toLowerCase()
            .includes(search) ||

          member.staffId
            .toLowerCase()
            .includes(search) ||

          member.email
            .toLowerCase()
            .includes(search) ||

          member.phone
            .toLowerCase()
            .includes(search);


        const matchesPosition =

          !this.selectedPosition ||

          member.position ===
          this.selectedPosition;


        const matchesDepartment =

          !this.selectedDepartment ||

          member.department ===
          this.selectedDepartment;


        const matchesStatus =

          !this.selectedStatus ||

          member.status ===
          this.selectedStatus;


        return (

          matchesSearch &&

          matchesPosition &&

          matchesDepartment &&

          matchesStatus

        );

      }
    );

  }


  // =====================================================
  // OPEN ADD STAFF
  // =====================================================

  openAddStaff(): void {

    this.resetForm();

    this.errorMessage = '';

    this.successMessage = '';

    this.showAddStaff = true;

  }


  // =====================================================
  // CLOSE ADD STAFF
  // =====================================================

  closeAddStaff(): void {

    if (this.saving) {

      return;

    }


    this.showAddStaff = false;

  }


  // =====================================================
  // SAVE STAFF
  // =====================================================

  async saveStaff(): Promise<void> {

    if (this.saving) {

      return;

    }


    this.errorMessage = '';

    this.successMessage = '';


    if (!this.newStaff.fullName?.trim()) {

      this.errorMessage =
        'Please enter the staff member name.';

      return;

    }


    if (!this.newStaff.position?.trim()) {

      this.errorMessage =
        'Please select or enter the staff position.';

      return;

    }


    if (!this.newStaff.phone?.trim()) {

      this.errorMessage =
        'Please enter a phone number.';

      return;

    }


    this.saving = true;


    try {

      const staffRef =
        ref(
          database,
          'staff'
        );


      const newStaffRef =
        push(staffRef);


      const now =
        Date.now();


      const staffData: StaffMember = {

        id:
          newStaffRef.key!,

        staffId:
          this.newStaff.staffId?.trim() ||
          this.generateStaffId(),

        fullName:
          this.newStaff.fullName.trim(),

        email:
          this.newStaff.email?.trim() ||
          '',

        phone:
          this.newStaff.phone.trim(),

        gender:
          this.newStaff.gender?.trim() ||
          '',

        position:
          this.newStaff.position.trim(),

        department:
          this.newStaff.department?.trim() ||
          '',

        qualification:
          this.newStaff.qualification?.trim() ||
          '',

        employmentDate:
          this.newStaff.employmentDate ||
          '',

        address:
          this.newStaff.address?.trim() ||
          '',

        emergencyContact:
          this.newStaff.emergencyContact?.trim() ||
          '',

        status:
          this.newStaff.status ||
          'active',

        createdAt:
          now,

        updatedAt:
          now

      };


      await set(
        newStaffRef,
        staffData
      );


      this.staff.unshift(
        staffData
      );


      this.calculateStats();


      this.successMessage =
        `${staffData.fullName} has been added successfully.`;


      this.resetForm();

      this.showAddStaff = false;


    } catch (error) {

      console.error(
        'Error saving staff:',
        error
      );

      this.errorMessage =
        'Unable to save staff member. Please try again.';

    } finally {

      this.saving = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // VIEW STAFF
  // =====================================================

  viewStaff(
    member: StaffMember
  ): void {

    this.selectedStaff =
      {
        ...member
      };


    this.showStaffDetails =
      true;


    this.errorMessage = '';


    this.cdr.detectChanges();

  }


  // =====================================================
  // CLOSE VIEW STAFF
  // =====================================================

  closeStaffDetails(): void {

    this.showStaffDetails =
      false;


    this.selectedStaff =
      null;


    this.cdr.detectChanges();

  }


  // =====================================================
  // OPEN EDIT STAFF
  // =====================================================

  editStaff(
    member: StaffMember
  ): void {

    this.selectedStaff =
      {
        ...member
      };


    this.showEditStaff =
      true;


    this.errorMessage = '';


    this.cdr.detectChanges();

  }


  // =====================================================
  // CLOSE EDIT STAFF
  // =====================================================

  closeEditStaff(): void {

    if (this.updating) {

      return;

    }


    this.showEditStaff =
      false;


    this.selectedStaff =
      null;


    this.cdr.detectChanges();

  }


  // =====================================================
  // UPDATE STAFF
  // =====================================================

  async updateStaff(): Promise<void> {

    if (
      this.updating ||
      !this.selectedStaff
    ) {

      return;

    }


    this.errorMessage = '';


    if (
      !this.selectedStaff.fullName.trim()
    ) {

      this.errorMessage =
        'Please enter the staff member name.';

      return;

    }


    if (
      !this.selectedStaff.position.trim()
    ) {

      this.errorMessage =
        'Please enter the staff position.';

      return;

    }


    if (
      !this.selectedStaff.phone.trim()
    ) {

      this.errorMessage =
        'Please enter a phone number.';

      return;

    }


    this.updating = true;


    try {

      const staffRef =
        ref(
          database,
          `staff/${this.selectedStaff.id}`
        );


      const updatedStaff = {

        staffId:
          this.selectedStaff.staffId,

        fullName:
          this.selectedStaff.fullName.trim(),

        email:
          this.selectedStaff.email?.trim() ||
          '',

        phone:
          this.selectedStaff.phone.trim(),

        gender:
          this.selectedStaff.gender?.trim() ||
          '',

        position:
          this.selectedStaff.position.trim(),

        department:
          this.selectedStaff.department?.trim() ||
          '',

        qualification:
          this.selectedStaff.qualification?.trim() ||
          '',

        employmentDate:
          this.selectedStaff.employmentDate ||
          '',

        address:
          this.selectedStaff.address?.trim() ||
          '',

        emergencyContact:
          this.selectedStaff.emergencyContact?.trim() ||
          '',

        status:
          this.selectedStaff.status,

        createdAt:
          this.selectedStaff.createdAt,

        updatedAt:
          Date.now()

      };


      await update(
        staffRef,
        updatedStaff
      );


      const index =
        this.staff.findIndex(
          member =>
            member.id ===
            this.selectedStaff!.id
        );


      if (index !== -1) {

        this.staff[index] = {

          ...this.selectedStaff,

          ...updatedStaff

        };

      }


      this.calculateStats();


      this.successMessage =
        `${updatedStaff.fullName} has been updated successfully.`;


      this.showEditStaff =
        false;


      this.selectedStaff =
        null;


    } catch (error) {

      console.error(
        'Error updating staff:',
        error
      );

      this.errorMessage =
        'Unable to update staff member. Please try again.';

    } finally {

      this.updating = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // OPEN DELETE CONFIRMATION
  // =====================================================

  openDeleteStaff(
    member: StaffMember
  ): void {

    this.staffToDelete =
      member;


    this.deleteErrorMessage = '';

    this.showDeleteStaff =
      true;


    this.cdr.detectChanges();

  }


  // =====================================================
  // CLOSE DELETE CONFIRMATION
  // =====================================================

  closeDeleteStaff(): void {

    if (this.deleting) {

      return;

    }


    this.showDeleteStaff =
      false;


    this.staffToDelete =
      null;


    this.deleteErrorMessage = '';


    this.cdr.detectChanges();

  }


  // =====================================================
  // DELETE STAFF
  // =====================================================

  async deleteStaff(): Promise<void> {

    if (
      this.deleting ||
      !this.staffToDelete
    ) {

      return;

    }


    this.deleting = true;

    this.deleteErrorMessage = '';


    try {

      const member =
        this.staffToDelete;


      const staffRef =
        ref(
          database,
          `staff/${member.id}`
        );


      await remove(
        staffRef
      );


      this.staff =
        this.staff.filter(
          currentStaff =>
            currentStaff.id !==
            member.id
        );


      this.calculateStats();


      this.showDeleteStaff =
        false;


      this.staffToDelete =
        null;


      this.successMessage =
        `${member.fullName} has been deleted successfully.`;


    } catch (error) {

      console.error(
        'Error deleting staff:',
        error
      );

      this.deleteErrorMessage =
        'Unable to delete staff member. Please try again.';

    } finally {

      this.deleting = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // RESET FORM
  // =====================================================

  resetForm(): void {

    this.newStaff = {

      staffId: '',

      fullName: '',

      email: '',

      phone: '',

      gender: '',

      position: '',

      department: '',

      qualification: '',

      employmentDate: '',

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

    this.selectedPosition = '';

    this.selectedDepartment = '';

    this.selectedStatus = '';

  }

}

