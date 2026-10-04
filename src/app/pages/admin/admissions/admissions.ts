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


// =========================================================
// ADMISSION INTERFACE
// =========================================================

interface AdmissionApplication {

  applicationId: string;

  applicationNumber: string;

  status: string;

  submittedAt: string;

  // =======================================================
  // PAYMENT INFORMATION
  // =======================================================

  applicationFee: number;

  paymentStatus: string;

  paymentAmount: number;

  paymentReference: string;

  paymentDate: string;

  paymentVerifiedAt?: number | string;

  // =======================================================
  // ACCOUNT INFORMATION
  // =======================================================

  studentId?: string;

  studentUid?: string;

  parentId?: string;

  parentUid?: string;

  approvedAt?: string;

  updatedAt?: string;

  // =======================================================
  // STUDENT
  // =======================================================

  student: {

    firstName: string;

    middleName?: string;

    lastName: string;

    dateOfBirth: string;

    gender: string;

    classApplied: string;

  };

  // =======================================================
  // PARENT / GUARDIAN
  // =======================================================

  parentGuardian: {

    name: string;

    phone: string;

    email: string;

    relationship: string;

  };

  // =======================================================
  // PREVIOUS SCHOOL
  // =======================================================

  previousSchool: {

    name: string;

    previousClass: string;

  };

  // =======================================================
  // EMERGENCY CONTACT
  // =======================================================

  emergencyContact: {

    name: string;

    phone: string;

  };

  additionalNotes?: string;

  declarationAccepted?: boolean;

}


// =========================================================
// APPROVAL CREDENTIALS
// =========================================================

interface ApprovalCredentials {

  applicationNumber?: string;

  student: {

    studentId: string;

    temporaryPassword: string | null;

    email: string;

    uid?: string;

  };

  parent: {

    parentId: string;

    temporaryPassword: string | null;

    email: string;

    uid?: string;

    accountCreated: boolean;

  };

  existingParent: boolean;

}


// =========================================================
// COMPONENT
// =========================================================

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

  applications: AdmissionApplication[] = [];

  filteredApplications: AdmissionApplication[] = [];

  selectedApplication:
    AdmissionApplication | null = null;


  // =========================================================
  // APPROVAL CREDENTIALS
  // =========================================================

  approvalCredentials:
    ApprovalCredentials | null = null;

  showCredentialsModal = false;


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

        const data = snapshot.val();


        Object.entries(data).forEach(
          ([key, value]: [string, any]) => {

            // =================================================
            // PAYMENT NORMALIZATION
            //
            // Older applications may not have payment fields.
            // =================================================

            const applicationFee =
              Number(
                value.applicationFee ??
                5000
              );


            const paymentAmount =
              Number(
                value.paymentAmount ??
                0
              );


            const paymentStatus =
              String(
                value.paymentStatus ??
                'unpaid'
              ).toLowerCase();


            const paymentReference =
              String(
                value.paymentReference ??
                ''
              );


            const paymentDate =
              String(
                value.paymentDate ??
                ''
              );


            const paymentVerifiedAt =
              value.paymentVerifiedAt ??
              '';


            // =================================================
            // BUILD APPLICATION
            // =================================================

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

              // =================================================
              // PAYMENT INFORMATION
              // =================================================

              applicationFee,

              paymentStatus,

              paymentAmount,

              paymentReference,

              paymentDate,

              paymentVerifiedAt,

              // =================================================
              // ACCOUNT INFORMATION
              // =================================================

              studentId:
                value.studentId ||
                '',

              studentUid:
                value.studentUid ||
                '',

              parentId:
                value.parentId ||
                '',

              parentUid:
                value.parentUid ||
                '',

              approvedAt:
                value.approvedAt ||
                '',

              updatedAt:
                value.updatedAt ||
                '',

              // =================================================
              // STUDENT
              // =================================================

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

              // =================================================
              // PARENT / GUARDIAN
              // =================================================

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

              // =================================================
              // PREVIOUS SCHOOL
              // =================================================

              previousSchool: {

                name:
                  value.previousSchool?.name ||
                  '',

                previousClass:
                  value.previousSchool?.previousClass ||
                  ''

              },

              // =================================================
              // EMERGENCY CONTACT
              // =================================================

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


      // =======================================================
      // NEWEST FIRST
      // =======================================================

      this.applications.sort(

        (a, b) =>

          new Date(
            b.submittedAt
          ).getTime() -

          new Date(
            a.submittedAt
          ).getTime()

      );


      // =======================================================
      // STATISTICS
      // =======================================================

      this.calculateStatistics();


      // =======================================================
      // FILTER
      // =======================================================

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


          const parentId =
            (
              application.parentId ||
              ''
            ).toLowerCase();


          const paymentReference =
            (
              application.paymentReference ||
              ''
            ).toLowerCase();


          const paymentStatus =
            (
              application.paymentStatus ||
              ''
            ).toLowerCase();


          return (

            studentName.includes(search) ||

            parentName.includes(search) ||

            applicationNumber.includes(search) ||

            classApplied.includes(search) ||

            studentId.includes(search) ||

            parentId.includes(search) ||

            paymentReference.includes(search) ||

            paymentStatus.includes(search)

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
  // PAYMENT STATUS
  // =========================================================

  getPaymentStatusClass(
    status: string
  ): string {

    switch (
      String(status || '')
        .toLowerCase()
        .trim()
    ) {

      case 'paid':
        return 'paid';


      case 'pending':
        return 'payment-pending';


      case 'failed':
        return 'payment-failed';


      case 'unpaid':
      default:
        return 'unpaid';

    }

  }


  // =========================================================
  // PAYMENT STATUS LABEL
  // =========================================================

  getPaymentStatusLabel(
    status: string
  ): string {

    switch (
      String(status || '')
        .toLowerCase()
        .trim()
    ) {

      case 'paid':
        return 'PAID';


      case 'pending':
        return 'PAYMENT PENDING';


      case 'failed':
        return 'PAYMENT FAILED';


      case 'unpaid':
      default:
        return 'UNPAID';

    }

  }


  // =========================================================
  // PAYMENT CONFIRMATION
  // =========================================================

  isPaymentConfirmed(
    application:
      AdmissionApplication
  ): boolean {

    return (

      String(
        application.paymentStatus || ''
      )
        .toLowerCase()
        .trim() === 'paid'

      &&

      Number(
        application.paymentAmount || 0
      ) >=

      Number(
        application.applicationFee || 5000
      )

      &&

      !!(
        application.paymentReference
      )

    );

  }


  // =========================================================
  // FORMAT PAYMENT AMOUNT
  // =========================================================

  formatAmount(
    amount: number
  ): string {

    return Number(
      amount || 0
    ).toLocaleString(
      'en-NG',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );

  }


  // =========================================================
  // PAYMENT DATE
  // =========================================================

  formatPaymentDate(
    date: string | number
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

      return String(date);

    }


    return parsedDate.toLocaleString(
      'en-NG',
      {

        day: '2-digit',

        month: 'short',

        year: 'numeric',

        hour: '2-digit',

        minute: '2-digit'

      }
    );

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
    // PAYMENT MUST BE CONFIRMED
    // -------------------------------------------------------

    if (
      !this.isPaymentConfirmed(
        application
      )
    ) {

      window.alert(

        `This application cannot be approved yet.\n\n` +

        `Admission payment has not been confirmed.\n\n` +

        `Required payment: ₦${this.formatAmount(
          application.applicationFee || 5000
        )}\n` +

        `Current payment status: ${this.getPaymentStatusLabel(
          application.paymentStatus
        )}`

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

        `Payment: CONFIRMED\n` +

        `Amount Paid: ₦${this.formatAmount(
          application.paymentAmount
        )}\n` +

        `Payment Reference: ${application.paymentReference}\n\n` +

        `A student account and parent account will be created automatically.`

      );


    if (!confirmed) {
      return;
    }


    this.updating = true;

    this.errorMessage = '';


    try {

      // =====================================================
      // CALL SECURE BACKEND
      // =====================================================

      const rawResult =
        await this.firebaseService
          .approveAdmissionApplication(
            application.applicationId
          );


      // =====================================================
      // DEBUG FULL RESPONSE
      // =====================================================

      console.log(
        'FULL ADMISSION APPROVAL RESPONSE:',
        rawResult
      );


      // =====================================================
      // NORMALIZE RESPONSE
      // =====================================================

      const result: any =
        rawResult?.data ??
        rawResult?.result ??
        rawResult;


      console.log(
        'NORMALIZED ADMISSION RESPONSE:',
        result
      );


      // =====================================================
      // CHECK RESPONSE
      // =====================================================

      if (!result) {

        throw new Error(
          'The server returned an empty response after approving the admission.'
        );

      }


      // =====================================================
      // EXTRACT STUDENT ACCOUNT
      // =====================================================

      const studentResult: any =

        result.student ??

        result.studentAccount ??

        result.account?.student ??

        (
          result.studentId ||
          result.studentUid
            ? {

                studentId:
                  result.studentId ??
                  '',

                uid:
                  result.studentUid ??
                  '',

                email:
                  result.studentEmail ??
                  '',

                temporaryPassword:
                  result.studentTemporaryPassword ??
                  result.temporaryPassword ??
                  null

              }
            : null
        );


      // =====================================================
      // EXTRACT PARENT ACCOUNT
      // =====================================================

      const parentResult: any =

        result.parent ??

        result.parentAccount ??

        result.account?.parent ??

        (
          result.parentId ||
          result.parentUid
            ? {

                parentId:
                  result.parentId ??
                  '',

                uid:
                  result.parentUid ??
                  '',

                email:
                  result.parentEmail ??
                  '',

                temporaryPassword:
                  result.parentTemporaryPassword ??
                  null,

                accountCreated:
                  result.parentAccountCreated ??
                  result.accountCreated ??
                  true

              }
            : null
        );


      // =====================================================
      // DEBUG EXTRACTED ACCOUNTS
      // =====================================================

      console.log(
        'STUDENT ACCOUNT RESPONSE:',
        studentResult
      );


      console.log(
        'PARENT ACCOUNT RESPONSE:',
        parentResult
      );


      // =====================================================
      // VERIFY REQUIRED ACCOUNT INFORMATION
      // =====================================================

      if (!studentResult) {

        throw new Error(
          'The admission was approved, but the student account information was not returned by the server.'
        );

      }


      if (!parentResult) {

        throw new Error(
          'The admission was approved, but the parent account information was not returned by the server.'
        );

      }


      // =====================================================
      // EXTRACT STUDENT CREDENTIALS
      // =====================================================

      const finalStudentId =
        studentResult.studentId ??
        result.studentId ??
        '';


      const finalStudentUid =
        studentResult.uid ??
        result.studentUid ??
        '';


      const finalStudentEmail =
        studentResult.email ??
        result.studentEmail ??
        '';


      const finalStudentPassword =
        studentResult.temporaryPassword ??
        result.studentTemporaryPassword ??
        result.temporaryPassword ??
        null;


      // =====================================================
      // EXTRACT PARENT CREDENTIALS
      // =====================================================

      const finalParentId =
        parentResult.parentId ??
        result.parentId ??
        '';


      const finalParentUid =
        parentResult.uid ??
        result.parentUid ??
        '';


      const finalParentEmail =
        parentResult.email ??
        result.parentEmail ??
        '';


      const finalParentPassword =
        parentResult.temporaryPassword ??
        result.parentTemporaryPassword ??
        null;


      const finalParentAccountCreated =
        parentResult.accountCreated ??
        result.parentAccountCreated ??
        result.accountCreated ??
        true;


      // =====================================================
      // VALIDATE IDs
      // =====================================================

      if (!finalStudentId) {

        throw new Error(
          'The admission was approved, but the Student ID was not returned by the server.'
        );

      }


      if (!finalParentId) {

        throw new Error(
          'The admission was approved, but the Parent ID was not returned by the server.'
        );

      }


      // =====================================================
      // UPDATE LOCAL APPLICATION
      // =====================================================

      application.status =
        'approved';


      application.studentId =
        finalStudentId;


      application.studentUid =
        finalStudentUid;


      application.parentId =
        finalParentId;


      application.parentUid =
        finalParentUid;


      application.approvedAt =
        result.approvedAt ??
        new Date().toISOString();


      // =====================================================
      // STORE CREDENTIALS
      // =====================================================

      this.approvalCredentials = {

        applicationNumber:
          result.applicationNumber ??
          application.applicationNumber,


        student: {

          studentId:
            finalStudentId,

          temporaryPassword:
            finalStudentPassword,

          email:
            finalStudentEmail,

          uid:
            finalStudentUid

        },


        parent: {

          parentId:
            finalParentId,

          temporaryPassword:
            finalParentPassword,

          email:
            finalParentEmail,

          uid:
            finalParentUid,

          accountCreated:
            finalParentAccountCreated === true

        },


        existingParent:
          result.existingParent === true

      };


      // =====================================================
      // DEBUG FINAL CREDENTIALS
      // =====================================================

      console.log(
        'FINAL APPROVAL CREDENTIALS:',
        this.approvalCredentials
      );


      // =====================================================
      // SHOW CREDENTIALS MODAL
      // =====================================================

      this.showCredentialsModal =
        true;


      document.body.style.overflow =
        'hidden';


      // =====================================================
      // REFRESH STATISTICS
      // =====================================================

      this.calculateStatistics();

      this.filterApplications();


      // =====================================================
      // UPDATE SELECTED APPLICATION
      // =====================================================

      if (
        this.selectedApplication?.applicationId ===
        application.applicationId
      ) {

        this.selectedApplication =
          application;

      }


      // =====================================================
      // SUCCESS MESSAGE
      // =====================================================

      console.log(
        'Account credentials prepared successfully:',
        this.approvalCredentials
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
  // CLOSE CREDENTIALS MODAL
  // =========================================================

  closeCredentialsModal(): void {

    this.showCredentialsModal =
      false;


    this.approvalCredentials =
      null;


    document.body.style.overflow =
      '';

  }


  // =========================================================
  // COPY TEXT
  // =========================================================

  async copyCredential(
    value: string
  ): Promise<void> {

    if (!value) {
      return;
    }


    try {

      await navigator.clipboard.writeText(
        value
      );


      window.alert(
        'Copied to clipboard.'
      );


    } catch (error) {

      console.error(
        'Unable to copy credential:',
        error
      );


      window.alert(
        'Unable to copy automatically. Please copy it manually.'
      );

    }

  }


  // =========================================================
  // COPY ALL CREDENTIALS
  // =========================================================

  async copyAllCredentials(): Promise<void> {

    if (!this.approvalCredentials) {
      return;
    }


    const student =
      this.approvalCredentials.student;


    const parent =
      this.approvalCredentials.parent;


    let text =

      `D-LITTLES SCHOOL\n` +

      `ADMISSION ACCOUNT CREDENTIALS\n\n` +

      `STUDENT ACCOUNT\n` +

      `Student ID: ${student.studentId}\n` +

      `Temporary Password: ${student.temporaryPassword || 'Not generated'}\n` +

      `Email: ${student.email}\n\n` +

      `PARENT ACCOUNT\n` +

      `Parent ID: ${parent.parentId}\n`;


    if (
      parent.temporaryPassword
    ) {

      text +=
        `Temporary Password: ${parent.temporaryPassword}\n`;

    } else {

      text +=
        `Password: Existing parent account - no new password generated.\n`;

    }


    text +=
      `Email: ${parent.email}\n`;


    await this.copyCredential(
      text
    );

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
        return 'approved';


      case 'rejected':
        return 'rejected';


      default:
        return 'pending';

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