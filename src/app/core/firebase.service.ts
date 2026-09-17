import { Injectable } from '@angular/core';

import {
  Database,
  get,
  push,
  ref,
  set
} from 'firebase/database';

import {
  getFunctions,
  httpsCallable
} from 'firebase/functions';

import { database } from './firebase.config';


@Injectable({
  providedIn: 'root'
})
export class FirebaseService {

  private readonly db: Database = database;

  private readonly functions = getFunctions();


  // =========================================================
  // SUBMIT ADMISSION APPLICATION
  // =========================================================

  async submitAdmissionApplication(application: any) {

    const admissionsRef =
      ref(this.db, 'admissions');

    const applicationRef =
      push(admissionsRef);

    const applicationId =
      applicationRef.key;

    if (!applicationId) {
      throw new Error(
        'Unable to generate application ID.'
      );
    }

    const applicationNumber =
      await this.generateApplicationNumber();

    const applicationData = {

      applicationId,

      applicationNumber,

      status: 'pending',

      submittedAt:
        new Date().toISOString(),

      student: {

        firstName:
          application.studentFirstName || '',

        middleName:
          application.studentMiddleName || '',

        lastName:
          application.studentLastName || '',

        dateOfBirth:
          application.dateOfBirth || '',

        gender:
          application.gender || '',

        classApplied:
          application.classApplied || ''
      },

      parentGuardian: {

        name:
          application.parentName || '',

        phone:
          application.parentPhone || '',

        email:
          application.parentEmail || '',

        relationship:
          application.relationship || ''
      },

      previousSchool: {

        name:
          application.previousSchool || '',

        previousClass:
          application.previousClass || ''
      },

      emergencyContact: {

        name:
          application.emergencyName || '',

        phone:
          application.emergencyPhone || ''
      },

      additionalNotes:
        application.additionalNotes || '',

      declarationAccepted:
        true
    };


    await set(
      applicationRef,
      applicationData
    );


    return {

      applicationId,

      applicationNumber
    };
  }


  // =========================================================
  // APPROVE ADMISSION APPLICATION
  // =========================================================
  //
  // IMPORTANT:
  //
  // The actual approval is now handled by the secure
  // Firebase Cloud Function.
  //
  // The Angular application does NOT:
  //
  // - create Firebase Auth accounts
  // - create student login credentials
  // - generate Student IDs
  // - create users/{uid}
  // - directly approve the admission
  //
  // The Cloud Function handles all of those operations.
  // =========================================================

  async approveAdmissionApplication(
    applicationId: string
  ) {

    if (!applicationId) {

      throw new Error(
        'Application ID is required.'
      );
    }


    try {

      const approveFunction =
        httpsCallable<
          { applicationId: string },
          {
            success: boolean;

            applicationId: string;

            studentId: string;

            parentId: string;

            studentUid: string;

            existingParent: boolean;

            temporaryPassword: string;

            message: string;
          }
        >(
          this.functions,
          'approveAdmissionApplication'
        );


      const result =
        await approveFunction({
          applicationId
        });


      return result.data;

    } catch (error: any) {

      console.error(
        'Admission approval error:',
        error
      );


      /*
       * Firebase callable functions normally return
       * errors using Firebase Functions error codes.
       */

      if (error?.code === 'functions/unauthenticated') {

        throw new Error(
          'You must be signed in as an administrator.'
        );
      }


      if (error?.code === 'functions/permission-denied') {

        throw new Error(
          'You do not have permission to approve admissions.'
        );
      }


      if (error?.code === 'functions/not-found') {

        throw new Error(
          'Admission application not found.'
        );
      }


      if (error?.code === 'functions/already-exists') {

        throw new Error(
          error?.message ||
          'This admission has already been approved.'
        );
      }


      if (
        error?.code ===
        'functions/failed-precondition'
      ) {

        throw new Error(
          error?.message ||
          'This admission cannot be approved.'
        );
      }


      throw new Error(
        error?.message ||
        'Unable to approve the admission application.'
      );
    }
  }


  // =========================================================
  // GENERATE APPLICATION NUMBER
  // =========================================================

  private async generateApplicationNumber():
    Promise<string> {

    const year =
      new Date().getFullYear();

    const randomNumber =
      Math.floor(
        1000 +
        Math.random() * 9000
      );

    return `DLP-${year}-${randomNumber}`;
  }

}

