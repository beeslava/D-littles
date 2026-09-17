import {
  ChangeDetectorRef,
  Component
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import {
  get,
  ref,
  update
} from 'firebase/database';

import { database } from '../../../core/firebase.config';

import { FormsModule } from '@angular/forms';

import { FirebaseService } from '../../../core/firebase.service';


interface AdmissionApplication {

  applicationId: string;

  applicationNumber: string;

  status: string;

  submittedAt: string;

  studentId?: string;

  studentUid?: string;

  parentId?: string;

  approvedAt?: string;

  updatedAt?: string;

  student: {

    firstName: string;

    middleName?: string;

    lastName: string;

    dateOfBirth: string;

    gender: string;

    classApplied: string;
  };

  parentGuardian: {

    name: string;

    phone: string;

    email: string;

    relationship: string;
  };

  previousSchool: {

    name: string;

    previousClass: string;
  };

  emergencyContact: {

    name: string;

    phone: string;
  };

  additionalNotes?: string;

  declarationAccepted?: boolean;
}


@Component({

  selector: 'app-admissions',

  standalone: true,

  imports: [
    CommonModule,
    RouterLink,
    FormsModule
  ],

  templateUrl: './admissions.html',

  styleUrl: './admissions.css'
})
export class Admissions {

  // =========================================================
  // APPLICATIONS
  // =========================================================

  applications:
    AdmissionApplication[] = [];

  filteredApplications:
    AdmissionApplication[] = [];


  selectedApplication:
    AdmissionApplication | null = null;


  // =========================================================
  // SEARCH
  // =========================================================

  searchTerm = '';


  // =========================================================
  // LOADING
  // =========================================================

  loading = false;

  errorMessage = '';

  updating = false;


  // =========================================================
  // STATISTICS
  // =========================================================

  totalApplications = 0;

  pendingApplications = 0;

  approvedApplications = 0;

  rejectedApplications = 0;


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(

    private readonly firebaseService:
      FirebaseService,

    private readonly cdr:
      ChangeDetectorRef

  ) {}


  // =========================================================
  // INIT
  // =========================================================

  async ngOnInit(): Promise<void> {

    await this.loadApplications();

  }


  // =========================================================
  // LOAD APPLICATIONS
  // =========================================================

  async loadApplications(): Promise<void> {

    if (this.loading) {
      return;
    }


    this.loading = true;

    this.errorMessage = '';


    try {

      const admissionsRef =
        ref(
          database,
          'admissions'
        );


      const snapshot =
        await get(admissionsRef);


      this.applications = [];


      if (snapshot.exists()) {

        const data =
          snapshot.val();


        Object.entries(data).forEach(
          ([key, value]: [string, any]) => {

            this.applications.push({

              applicationId:
                value.applicationId ||
                key,


              applicationNumber:
                value.applicationNumber ||
                'N/A',


              status:
                value.status ||
                'pending',


              submittedAt:
                value.submittedAt ||
                '',


              studentId:
                value.studentId ||
                '',


              studentUid:
                value.studentUid ||
                '',


              parentId:
                value.parentId ||
                '',


              approvedAt:
                value.approvedAt ||
                '',


              updatedAt:
                value.updatedAt ||
                '',


              student: {

                firstName:
                  value.student?.firstName ||
                  '',

                middleName:
                  value.student?.middleName ||
                  '',

                lastName:
                  value.student?.lastName ||
                  '',

                dateOfBirth:
                  value.student?.dateOfBirth ||
                  '',

                gender:
                  value.student?.gender ||
                  '',

                classApplied:
                  value.student?.classApplied ||
                  ''
              },


              parentGuardian: {

                name:
                  value.parentGuardian?.name ||
                  '',

                phone:
                  value.parentGuardian?.phone ||
                  '',

                email:
                  value.parentGuardian?.email ||
                  '',

                relationship:
                  value.parentGuardian?.relationship ||
                  ''
              },


              previousSchool: {

                name:
                  value.previousSchool?.name ||
                  '',

                previousClass:
                  value.previousSchool?.previousClass ||
                  ''
              },


              emergencyContact: {

                name:
                  value.emergencyContact?.name ||
                  '',

                phone:
                  value.emergencyContact?.phone ||
                  ''
              },


              additionalNotes:
                value.additionalNotes ||
                '',


              declarationAccepted:
                value.declarationAccepted ||
                false

            });

          }
        );

      }


      // =====================================================
      // NEWEST FIRST
      // =====================================================

      this.applications.sort(

        (a, b) =>

          new Date(
            b.submittedAt
          ).getTime() -

          new Date(
            a.submittedAt
          ).getTime()

      );


      this.calculateStatistics();

      this.filterApplications();


    } catch (error) {

      console.error(
        'Failed to load admissions:',
        error
      );


      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to load admission applications.';


    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // STATISTICS
  // =========================================================

  calculateStatistics(): void {

    this.totalApplications =
      this.applications.length;


    this.pendingApplications =
      this.applications.filter(

        application =>

          application.status.toLowerCase() ===
          'pending'

      ).length;


    this.approvedApplications =
      this.applications.filter(

        application =>

          application.status.toLowerCase() ===
          'approved'

      ).length;


    this.rejectedApplications =
      this.applications.filter(

        application =>

          application.status.toLowerCase() ===
          'rejected'

      ).length;

  }


  // =========================================================
  // SEARCH
  // =========================================================

  filterApplications(): void {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    if (!search) {

      this.filteredApplications =
        [...this.applications];

      return;

    }


    this.filteredApplications =
      this.applications.filter(

        application => {

          const studentName =
            this.getStudentName(
              application
            ).toLowerCase();


          const parentName =
            application.parentGuardian.name
              .toLowerCase();


          const applicationNumber =
            application.applicationNumber
              .toLowerCase();


          const classApplied =
            application.student.classApplied
              .toLowerCase();


          const studentId =
            (
              application.studentId ||
              ''
            ).toLowerCase();


          return (

            studentName.includes(search) ||

            parentName.includes(search) ||

            applicationNumber.includes(search) ||

            classApplied.includes(search) ||

            studentId.includes(search)

          );

        }

      );

  }


  // =========================================================
  // STUDENT NAME
  // =========================================================

  getStudentName(
    application:
      AdmissionApplication
  ): string {

    return [

      application.student.firstName,

      application.student.middleName,

      application.student.lastName

    ]

      .filter(Boolean)

      .join(' ');

  }


  // =========================================================
  // VIEW APPLICATION
  // =========================================================

  viewApplication(
    application:
      AdmissionApplication
  ): void {

    this.selectedApplication =
      application;


    document.body.style.overflow =
      'hidden';

  }


  // =========================================================
  // CLOSE APPLICATION
  // =========================================================

  closeApplication(): void {

    this.selectedApplication =
      null;


    document.body.style.overflow =
      '';

  }


  // =========================================================
  // APPROVE APPLICATION
  // =========================================================

  async approveApplication(
    application:
      AdmissionApplication
  ): Promise<void> {

    if (this.updating) {
      return;
    }


    // -------------------------------------------------------
    // PREVENT DOUBLE APPROVAL
    // -------------------------------------------------------

    if (
      application.status.toLowerCase() ===
      'approved'
    ) {

      window.alert(
        'This application has already been approved.'
      );

      return;

    }


    // -------------------------------------------------------
    // CONFIRM APPROVAL
    // -------------------------------------------------------

    const confirmed =
      window.confirm(

        `Are you sure you want to approve this application?\n\n` +

        `Student: ${this.getStudentName(application)}\n` +

        `Parent/Guardian: ${application.parentGuardian.name}\n\n` +

        `A student account will be created automatically.`

      );


    if (!confirmed) {
      return;
    }


    this.updating = true;

    this.errorMessage = '';


    try {

      // =====================================================
      // CALL SECURE CLOUD FUNCTION
      // =====================================================

      const result =
        await this.firebaseService
          .approveAdmissionApplication(
            application.applicationId
          );


      console.log(
        'Admission approved:',
        result
      );


      // =====================================================
      // UPDATE LOCAL APPLICATION
      // =====================================================

      application.status =
        'approved';


      application.studentId =
        result.studentId;


      application.studentUid =
        result.studentUid;


      application.parentId =
        result.parentId;


      application.approvedAt =
        new Date().toISOString();


      // =====================================================
      // REFRESH STATISTICS
      // =====================================================

      this.calculateStatistics();

      this.filterApplications();


      // =====================================================
      // KEEP MODAL UPDATED
      // =====================================================

      if (
        this.selectedApplication?.applicationId ===
        application.applicationId
      ) {

        this.selectedApplication =
          application;

      }


      // =====================================================
      // PARENT MESSAGE
      // =====================================================

      const parentMessage =
        result.existingParent

          ? 'Existing parent record was linked.'

          : 'New parent record was created.';


      // =====================================================
      // STUDENT LOGIN CREDENTIALS
      // =====================================================

      const credentialsMessage =

        `Student Login Credentials\n\n` +

        `Student ID: ${result.studentId}\n` +

        `Temporary Password: ${result.temporaryPassword}\n\n` +

        `The student should use the Student ID and password ` +

        `to sign in. The internal Firebase email is not required.`;


      // =====================================================
      // SHOW SUCCESS MESSAGE
      // =====================================================

      window.alert(

        `Application approved successfully.\n\n` +

        `Student ID: ${result.studentId}\n` +

        `Parent ID: ${result.parentId}\n\n` +

        `${parentMessage}\n\n` +

        `${credentialsMessage}\n\n` +

        `Please keep these credentials secure.`

      );


    } catch (error) {

      console.error(
        'Failed to approve application:',
        error
      );


      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to approve application.';


    } finally {

      this.updating = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // REJECT APPLICATION
  // =========================================================

  async rejectApplication(
    application:
      AdmissionApplication
  ): Promise<void> {

    await this.changeStatus(
      application,
      'rejected'
    );

  }


  // =========================================================
  // CHANGE STATUS
  // =========================================================

  async changeStatus(
    application:
      AdmissionApplication,

    status:
      'rejected'
  ): Promise<void> {

    if (this.updating) {
      return;
    }


    const confirmed =
      window.confirm(

        `Are you sure you want to reject this application?`

      );


    if (!confirmed) {
      return;
    }


    this.updating = true;

    this.errorMessage = '';


    try {

      const applicationRef =
        ref(
          database,
          `admissions/${application.applicationId}`
        );


      await update(
        applicationRef,
        {

          status,

          updatedAt:
            new Date().toISOString()

        }
      );


      application.status =
        status;


      this.calculateStatistics();

      this.filterApplications();


      if (
        this.selectedApplication?.applicationId ===
        application.applicationId
      ) {

        this.selectedApplication =
          application;

      }


    } catch (error) {

      console.error(
        'Failed to reject application:',
        error
      );


      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to reject application.';


    } finally {

      this.updating = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // STATUS CLASS
  // =========================================================

  getStatusClass(
    status: string
  ): string {

    switch (
      status.toLowerCase()
    ) {

      case 'approved':
        return 'status-approved';


      case 'rejected':
        return 'status-rejected';


      default:
        return 'status-pending';

    }

  }


  // =========================================================
  // FORMAT DATE
  // =========================================================

  formatDate(
    date: string
  ): string {

    if (!date) {
      return 'N/A';
    }


    const parsedDate =
      new Date(date);


    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {

      return date;

    }


    return parsedDate.toLocaleDateString(
      'en-NG',
      {

        day: '2-digit',

        month: 'short',

        year: 'numeric'

      }
    );

  }

}

