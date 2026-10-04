import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  get,
  ref
} from 'firebase/database';

import { database } from '../../core/firebase.config';

interface SchoolStaff {
  id: string;
  staffId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  position: string;
  qualification: string;
  email: string;
  phone: string;
  photoUrl: string;
  status: string;
  bio: string;
}

@Component({
  selector: 'app-staff',
  standalone: true,

  imports: [
    CommonModule
  ],

  templateUrl: './staff.html',
  styleUrls: ['./staff.css']
})
export class Staff implements OnInit {

  staff: SchoolStaff[] = [];

  loading = true;
  errorMessage = '';

  selectedStaff: SchoolStaff | null = null;

  constructor(
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStaff();
  }

  // =========================================================
  // LOAD STAFF
  // =========================================================

  async loadStaff(): Promise<void> {

    this.loading = true;
    this.errorMessage = '';

    try {

      const snapshot = await get(
        ref(database, 'staff')
      );

      const loadedStaff: SchoolStaff[] = [];

      if (snapshot.exists()) {

        const data = snapshot.val();

        Object.keys(data).forEach(id => {

          const item = data[id];

          // Only show active staff publicly
          if (
            item.status &&
            item.status.toLowerCase() !== 'active'
          ) {
            return;
          }

          const firstName =
            item.firstName ||
            item.firstname ||
            '';

          const lastName =
            item.lastName ||
            item.lastname ||
            '';

          const fullName =
            item.fullName ||
            item.name ||
            `${firstName} ${lastName}`.trim();

          loadedStaff.push({
            id,

            staffId:
              item.staffId ||
              item.id ||
              id,

            fullName,

            firstName,

            lastName,

            role:
              item.role ||
              'Staff',

            department:
              item.department ||
              '',

            position:
              item.position ||
              item.jobTitle ||
              item.title ||
              '',

            qualification:
              item.qualification ||
              item.qualifications ||
              '',

            email:
              item.email ||
              '',

            phone:
              item.phone ||
              item.phoneNumber ||
              '',

            photoUrl:
              item.photoUrl ||
              item.photo ||
              item.imageUrl ||
              '',

            status:
              item.status ||
              'active',

            bio:
              item.bio ||
              item.description ||
              ''
          });

        });
      }

      // Sort alphabetically
      loadedStaff.sort((a, b) =>
        a.fullName.localeCompare(b.fullName)
      );

      this.staff = loadedStaff;

      console.log(
        'Public staff loaded:',
        this.staff
      );

    } catch (error) {

      console.error(
        'Error loading public staff:',
        error
      );

      this.errorMessage =
        'Unable to load staff information at the moment. Please try again later.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();
    }
  }

  // =========================================================
  // STAFF DETAILS
  // =========================================================

  openStaff(staff: SchoolStaff): void {

    this.selectedStaff = staff;

    document.body.style.overflow = 'hidden';
  }

  closeStaff(): void {

    this.selectedStaff = null;

    document.body.style.overflow = '';
  }

  // =========================================================
  // BACKDROP
  // =========================================================

  onBackdropClick(event: MouseEvent): void {

    if (
      event.target === event.currentTarget
    ) {
      this.closeStaff();
    }
  }

  // =========================================================
  // PHOTO FALLBACK
  // =========================================================

  getInitials(name: string): string {

    if (!name) {
      return 'DL';
    }

    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 1) {
      return parts[0]
        .substring(0, 2)
        .toUpperCase();
    }

    return (
      parts[0].charAt(0) +
      parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }

}

