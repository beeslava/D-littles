import { Injectable } from '@angular/core';

import {
  Database,
  get,
  push,
  ref,
  set
} from 'firebase/database';

import {
  auth
} from './firebase.config';

import { database } from './firebase.config';


@Injectable({
  providedIn: 'root'
})
export class FirebaseService {

  private readonly db: Database = database;

  // =========================================================
  // RENDER BACKEND
  // =========================================================

  private readonly backendUrl =
    'https://d-littles.onrender.com';


  // =========================================================
  // SUBMIT ADMISSION APPLICATION
  // =========================================================

  async submitAdmissionApplication(
    application: any
  ) {

    const admissionsRef =
      ref(
        this.db,
        'admissions'
      );

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

      status:
        'pending',

      submittedAt:
        new Date().toISOString(),

      student: {

        firstName:
          application.studentFirstName ||
          '',

        middleName:
          application.studentMiddleName ||
          '',

        lastName:
          application.studentLastName ||
          '',

        dateOfBirth:
          application.dateOfBirth ||
          '',

        gender:
          application.gender ||
          '',

        classApplied:
          application.classApplied ||
          ''

      },

      parentGuardian: {

        name:
          application.parentName ||
          '',

        phone:
          application.parentPhone ||
          '',

        email:
          application.parentEmail ||
          '',

        relationship:
          application.relationship ||
          ''

      },

      previousSchool: {

        name:
          application.previousSchool ||
          '',

        previousClass:
          application.previousClass ||
          ''

      },

      emergencyContact: {

        name:
          application.emergencyName ||
          '',

        phone:
          application.emergencyPhone ||
          ''

      },

      additionalNotes:
        application.additionalNotes ||
        '',

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
  // Approval is now handled by the Render backend.
  //
  // Angular sends the Firebase ID token.
  //
  // The backend:
  //
  // - verifies the administrator
  // - generates Student ID
  // - generates Parent ID
  // - creates Firebase Auth student account
  // - creates students/{id}
  // - creates users/{uid}
  // - updates the admission
  // - returns the temporary password
  //
  // Firebase Admin credentials NEVER reach Angular.
  // =========================================================

  async approveAdmissionApplication(
    applicationId: string
  ) {

    if (!applicationId) {

      throw new Error(
        'Application ID is required.'
      );

    }


    // -------------------------------------------------------
    // CHECK CURRENT USER
    // -------------------------------------------------------

    const currentUser =
      auth.currentUser;


    if (!currentUser) {

      throw new Error(
        'You must be signed in as an administrator.'
      );

    }


    try {

      // -----------------------------------------------------
      // GET FIREBASE ID TOKEN
      // -----------------------------------------------------

      const token =
        await currentUser.getIdToken();


      // -----------------------------------------------------
      // CALL RENDER BACKEND
      // -----------------------------------------------------

      const response =
        await fetch(
          `${this.backendUrl}/api/admissions/approve`,
          {
            method: 'POST',

            headers: {

              'Content-Type':
                'application/json',

              'Authorization':
                `Bearer ${token}`

            },

            body:
              JSON.stringify({
                applicationId
              })

          }
        );


      // -----------------------------------------------------
      // READ RESPONSE
      // -----------------------------------------------------

      let data: any = null;


      try {

        data =
          await response.json();

      } catch {

        data = null;

      }


      // -----------------------------------------------------
      // HANDLE BACKEND ERRORS
      // -----------------------------------------------------

      if (!response.ok) {

        console.error(
          'Admission approval backend error:',
          data
        );


        if (
          response.status === 401
        ) {

          throw new Error(
            'You must be signed in as an administrator.'
          );

        }


        if (
          response.status === 403
        ) {

          throw new Error(
            'You do not have permission to approve admissions.'
          );

        }


        if (
          response.status === 404
        ) {

          throw new Error(
            data?.message ||
            'Admission application not found.'
          );

        }


        if (
          response.status === 409
        ) {

          throw new Error(
            data?.message ||
            'This admission has already been approved.'
          );

        }


        if (
          response.status === 412
        ) {

          throw new Error(
            data?.message ||
            'This admission cannot be approved.'
          );

        }


        throw new Error(
          data?.message ||
          'Unable to approve the admission application.'
        );

      }


      // -----------------------------------------------------
      // SUCCESS
      // -----------------------------------------------------

      return data;

    } catch (error: any) {

      console.error(
        'Admission approval error:',
        error
      );


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