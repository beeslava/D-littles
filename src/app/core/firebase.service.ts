import { Injectable } from '@angular/core';

import {
  auth
} from './firebase.config';


// =========================================================
// ADMISSION PAYMENT RESPONSE TYPES
// =========================================================

export interface AdmissionPaymentInitializeResponse {

  success: boolean;

  message: string;

  applicationId: string;

  applicationFee: number;

  amountKobo: number;

  reference: string;

  accessCode: string;

  authorizationUrl: string;

  /**
   * Current payment status returned by the backend.
   *
   * Examples:
   * - unpaid
   * - pending
   * - paid
   * - failed
   */
  paymentStatus?: string;

  /**
   * True when the backend detects that the admission
   * application fee has already been successfully paid.
   */
  alreadyPaid?: boolean;

}


// =========================================================
// ADMISSION PAYMENT VERIFICATION RESPONSE
// =========================================================

export interface AdmissionPaymentVerifyResponse {

  success: boolean;

  paid: boolean;

  message: string;

  paymentStatus: string;

  reference: string;

  amount: number;

}


// =========================================================
// ADMISSION APPLICATION RESPONSE TYPES
// =========================================================

export interface AdmissionApplicationSubmitResponse {

  success: boolean;

  message: string;

  applicationId: string;

  applicationNumber: string;

  applicationFee: number;

  paymentStatus: string;

}


// =========================================================
// SAFE ADMISSION APPLICATION PAYMENT INFORMATION
// =========================================================

export interface AdmissionApplicationPaymentInfo {

  success: boolean;

  application: {

    applicationId: string;

    applicationNumber: string;

    status: string;

    applicationFee: number;

    paymentStatus: string;

    paymentAmount: number;

    paymentReference: string;

    paymentDate: string;

    studentName: string;

    classApplied: string;

  };

}


// =========================================================
// FIREBASE SERVICE
// =========================================================

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {


  // =======================================================
  // RENDER BACKEND
  // =======================================================

  /**
   * Public backend URL.
   *
   * IMPORTANT:
   *
   * The Paystack secret key is NEVER stored in Angular.
   *
   * PAYSTACK_SECRET_KEY remains inside the Render backend.
   */

  private readonly backendUrl =
    'https://d-littles.onrender.com';


  // =======================================================
  // APPLICATION FEE
  // =======================================================

  /**
   * Official admission application fee.
   *
   * Amount is stored in Naira.
   *
   * ₦5,000 = 500,000 Kobo when sent to Paystack.
   */

  readonly applicationFee =
    5000;


  // =========================================================
  // SUBMIT ADMISSION APPLICATION
  // =========================================================
  //
  // IMPORTANT:
  //
  // The browser MUST NOT write directly to:
  //
  //     /admissions
  //
  // Admission records contain private applicant information.
  //
  // Instead:
  //
  // Angular
  //    ↓
  // Render backend
  //    ↓
  // Firebase Admin SDK
  //    ↓
  // /admissions/{applicationId}
  //
  // Backend endpoint:
  //
  // POST /api/admissions/application
  //
  // =========================================================

  async submitAdmissionApplication(
    application: any
  ): Promise<AdmissionApplicationSubmitResponse> {

    // -----------------------------------------------------
    // VALIDATE APPLICATION
    // -----------------------------------------------------

    if (!application) {

      throw new Error(
        'Application information is required.'
      );

    }


    try {

      console.log(
        'Submitting admission application through backend...'
      );


      // ---------------------------------------------------
      // PREPARE SAFE APPLICATION PAYLOAD
      // ---------------------------------------------------
      //
      // The frontend does NOT send:
      //
      // - application ID
      // - application number
      // - payment status
      // - payment amount
      // - payment reference
      // - payment verification
      //
      // The backend generates all of those values.
      //
      // ---------------------------------------------------

      const payload = {

        studentFirstName:
          String(
            application.studentFirstName || ''
          ).trim(),

        studentMiddleName:
          String(
            application.studentMiddleName || ''
          ).trim(),

        studentLastName:
          String(
            application.studentLastName || ''
          ).trim(),

        dateOfBirth:
          String(
            application.dateOfBirth || ''
          ).trim(),

        gender:
          String(
            application.gender || ''
          ).trim(),

        classApplied:
          String(
            application.classApplied || ''
          ).trim(),

        parentName:
          String(
            application.parentName || ''
          ).trim(),

        parentPhone:
          String(
            application.parentPhone || ''
          ).trim(),

        parentEmail:
          String(
            application.parentEmail || ''
          ).trim(),

        relationship:
          String(
            application.relationship || ''
          ).trim(),

        previousSchool:
          String(
            application.previousSchool || ''
          ).trim(),

        previousClass:
          String(
            application.previousClass || ''
          ).trim(),

        emergencyName:
          String(
            application.emergencyName || ''
          ).trim(),

        emergencyPhone:
          String(
            application.emergencyPhone || ''
          ).trim(),

        additionalNotes:
          String(
            application.additionalNotes || ''
          ).trim(),

        declaration:
          application.declaration === true

      };


      // ---------------------------------------------------
      // BASIC CLIENT-SIDE VALIDATION
      // ---------------------------------------------------

      if (
        !payload.studentFirstName
      ) {

        throw new Error(
          'Student first name is required.'
        );

      }


      if (
        !payload.studentLastName
      ) {

        throw new Error(
          'Student last name is required.'
        );

      }


      if (
        !payload.dateOfBirth
      ) {

        throw new Error(
          'Student date of birth is required.'
        );

      }


      if (
        !payload.gender
      ) {

        throw new Error(
          'Student gender is required.'
        );

      }


      if (
        !payload.classApplied
      ) {

        throw new Error(
          'Class applied for is required.'
        );

      }


      if (
        !payload.parentName
      ) {

        throw new Error(
          'Parent or guardian name is required.'
        );

      }


      if (
        !payload.parentPhone
      ) {

        throw new Error(
          'Parent or guardian phone number is required.'
        );

      }


      if (
        !payload.parentEmail
      ) {

        throw new Error(
          'Parent or guardian email address is required.'
        );

      }


      if (
        !payload.relationship
      ) {

        throw new Error(
          'Parent or guardian relationship is required.'
        );

      }


      if (
        payload.declaration !== true
      ) {

        throw new Error(
          'Please accept the declaration before submitting.'
        );

      }


      // ---------------------------------------------------
      // CALL RENDER BACKEND
      // ---------------------------------------------------

      const response =
        await fetch(
          `${this.backendUrl}/api/admissions/application`,
          {

            method:
              'POST',

            headers: {

              'Content-Type':
                'application/json',

              'Accept':
                'application/json'

            },

            body:
              JSON.stringify(
                payload
              )

          }
        );


      // ---------------------------------------------------
      // READ BACKEND RESPONSE
      // ---------------------------------------------------

      let data:
        AdmissionApplicationSubmitResponse | null =
        null;


      try {

        data =
          await response.json();

      } catch {

        data =
          null;

      }


      // ---------------------------------------------------
      // HANDLE BACKEND ERROR
      // ---------------------------------------------------

      if (!response.ok) {

        console.error(
          'Admission application backend error:',
          data
        );


        if (
          response.status === 400
        ) {

          throw new Error(
            data?.message ||
            'Please check the application information and try again.'
          );

        }


        if (
          response.status === 409
        ) {

          throw new Error(
            data?.message ||
            'An application with this information already exists.'
          );

        }


        if (
          response.status === 429
        ) {

          throw new Error(
            data?.message ||
            'Too many applications have been submitted. Please try again later.'
          );

        }


        if (
          response.status >= 500
        ) {

          throw new Error(
            data?.message ||
            'The admission server is temporarily unavailable. Please try again.'
          );

        }


        throw new Error(
          data?.message ||
          'Unable to submit the admission application.'
        );

      }


      // ---------------------------------------------------
      // VALIDATE SUCCESS RESPONSE
      // ---------------------------------------------------

      if (
        !data ||
        data.success !== true
      ) {

        throw new Error(
          data?.message ||
          'The admission application could not be submitted.'
        );

      }


      if (
        !data.applicationId
      ) {

        throw new Error(
          'The application was submitted, but no application ID was returned.'
        );

      }


      console.log(
        'Admission application submitted successfully:',
        data
      );


      return data;

    } catch (error: any) {

      console.error(
        'Submit admission application error:',
        error
      );


      throw new Error(

        error?.message ||

        'Unable to submit the admission application.'

      );

    }

  }


  // =========================================================
  // GET ADMISSION APPLICATION
  // =========================================================
  //
  // IMPORTANT:
  //
  // The browser MUST NOT directly read:
  //
  //     /admissions/{applicationId}
  //
  // Instead:
  //
  // Angular
  //    ↓
  // GET /api/admissions/payment/application/{applicationId}
  //    ↓
  // Render backend
  //    ↓
  // Firebase Admin SDK
  //
  // The backend returns only the safe payment information.
  //
  // =========================================================

  async getAdmissionApplication(
    applicationId: string
  ) {

    const cleanApplicationId =
      String(
        applicationId || ''
      ).trim();


    // -----------------------------------------------------
    // VALIDATE APPLICATION ID
    // -----------------------------------------------------

    if (!cleanApplicationId) {

      throw new Error(
        'Application ID is required.'
      );

    }


    try {

      console.log(
        'Loading admission application through backend:',
        cleanApplicationId
      );


      // ---------------------------------------------------
      // CALL RENDER BACKEND
      // ---------------------------------------------------

      const response =
        await fetch(

          `${this.backendUrl}` +
          `/api/admissions/payment/application/` +
          `${encodeURIComponent(cleanApplicationId)}`,

          {

            method:
              'GET',

            headers: {

              'Accept':
                'application/json'

            }

          }

        );


      // ---------------------------------------------------
      // READ RESPONSE
      // ---------------------------------------------------

      let data:
        AdmissionApplicationPaymentInfo | null =
        null;


      try {

        data =
          await response.json();

      } catch {

        data =
          null;

      }


      // ---------------------------------------------------
      // HANDLE BACKEND ERROR
      // ---------------------------------------------------

      if (!response.ok) {

        console.error(
          'Get admission application backend error:',
          data
        );


        if (
          response.status === 404
        ) {

          throw new Error(
            'Admission application not found.'
          );

        }


        if (
          response.status === 400
        ) {

          throw new Error(
            'Invalid admission application ID.'
          );

        }


        throw new Error(
          'Unable to load the admission application.'
        );

      }


      // ---------------------------------------------------
      // VALIDATE RESPONSE
      // ---------------------------------------------------

      if (
        !data ||
        data.success !== true ||
        !data.application
      ) {

        throw new Error(
          'The admission application could not be loaded.'
        );

      }


      console.log(
        'Admission application loaded successfully:',
        data.application
      );


      // ---------------------------------------------------
      // RETURN THE APPLICATION
      // ---------------------------------------------------
      //
      // admission-payments.ts expects an application object.
      //
      // Add id using the backend applicationId.
      //
      // ---------------------------------------------------

      return {

        id:
          data.application.applicationId,

        ...data.application

      };

    } catch (error: any) {

      console.error(
        'Get admission application error:',
        error
      );


      throw new Error(

        error?.message ||

        'Unable to load the admission application.'

      );

    }

  }


  // =========================================================
  // INITIALIZE ADMISSION FEE PAYMENT
  // =========================================================
  //
  // Angular
  //    ↓
  // FirebaseService
  //    ↓
  // Render Backend
  //    ↓
  // Paystack
  //
  // The Paystack secret key NEVER comes to Angular.
  //
  // Endpoint:
  //
  // POST /api/admissions/payment/initialize
  //
  // =========================================================

  async initializeAdmissionPayment(
    applicationId: string
  ): Promise<AdmissionPaymentInitializeResponse> {

    // -----------------------------------------------------
    // VALIDATE APPLICATION ID
    // -----------------------------------------------------

    const cleanApplicationId =
      String(
        applicationId || ''
      ).trim();


    if (!cleanApplicationId) {

      throw new Error(
        'Application ID is required.'
      );

    }


    try {

      console.log(
        'Initializing admission fee payment:',
        cleanApplicationId
      );


      // ---------------------------------------------------
      // CALL BACKEND
      // ---------------------------------------------------

      const response =
        await fetch(
          `${this.backendUrl}/api/admissions/payment/initialize`,
          {

            method:
              'POST',

            headers: {

              'Content-Type':
                'application/json',

              'Accept':
                'application/json'

            },

            body:
              JSON.stringify({

                applicationId:
                  cleanApplicationId

              })

          }
        );


      // ---------------------------------------------------
      // READ RESPONSE
      // ---------------------------------------------------

      let data:
        AdmissionPaymentInitializeResponse | null =
        null;


      try {

        data =
          await response.json();

      } catch {

        data =
          null;

      }


      // ---------------------------------------------------
      // HANDLE BACKEND ERROR
      // ---------------------------------------------------

      if (!response.ok) {

        console.error(
          'Admission payment initialization error:',
          data
        );


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
            'This application fee has already been paid.'
          );

        }


        if (
          response.status === 400
        ) {

          throw new Error(
            data?.message ||
            'Unable to initialize this payment.'
          );

        }


        throw new Error(
          data?.message ||
          'Unable to initialize the admission fee payment.'
        );

      }


      // ---------------------------------------------------
      // VALIDATE SUCCESS RESPONSE
      // ---------------------------------------------------

      if (
        !data ||
        data.success !== true
      ) {

        throw new Error(
          data?.message ||
          'Payment initialization failed.'
        );

      }


      // ---------------------------------------------------
      // ALREADY PAID RESPONSE
      // ---------------------------------------------------
      //
      // The backend may legitimately return success=true
      // when the application has already been paid.
      //
      // In that case there may be no new Paystack checkout
      // URL or reference.
      //
      // ---------------------------------------------------

      if (
        data.alreadyPaid === true ||
        data.paymentStatus === 'paid'
      ) {

        return data;

      }


      // ---------------------------------------------------
      // VALIDATE NEW PAYMENT RESPONSE
      // ---------------------------------------------------

      if (
        !data.authorizationUrl
      ) {

        throw new Error(
          'Paystack checkout URL was not returned.'
        );

      }


      if (
        !data.reference
      ) {

        throw new Error(
          'Payment reference was not returned.'
        );

      }


      console.log(
        'Admission payment initialized successfully:',
        data
      );


      return data;

    } catch (error: any) {

      console.error(
        'Initialize admission payment error:',
        error
      );


      throw new Error(

        error?.message ||

        'Unable to initialize the admission fee payment.'

      );

    }

  }


  // =========================================================
  // VERIFY ADMISSION FEE PAYMENT
  // =========================================================
  //
  // Angular sends the Paystack reference to the backend.
  //
  // Backend:
  //
  // 1. Calls Paystack
  // 2. Verifies the transaction
  // 3. Checks reference
  // 4. Checks amount
  // 5. Checks currency
  // 6. Updates Firebase
  //
  // Endpoint:
  //
  // GET /api/admissions/payment/verify/:applicationId/:reference
  //
  // =========================================================

  async verifyAdmissionPayment(
    applicationId: string,
    reference: string
  ): Promise<AdmissionPaymentVerifyResponse> {

    const cleanApplicationId =
      String(
        applicationId || ''
      ).trim();


    const cleanReference =
      String(
        reference || ''
      ).trim();


    if (!cleanApplicationId) {

      throw new Error(
        'Application ID is required.'
      );

    }


    if (!cleanReference) {

      throw new Error(
        'Payment reference is required.'
      );

    }


    try {

      console.log(
        'Verifying admission payment:',
        {
          applicationId:
            cleanApplicationId,

          reference:
            cleanReference
        }
      );


      // ---------------------------------------------------
      // CALL BACKEND
      // ---------------------------------------------------

      const response =
        await fetch(

          `${this.backendUrl}` +
          `/api/admissions/payment/verify/` +
          `${encodeURIComponent(cleanApplicationId)}/` +
          `${encodeURIComponent(cleanReference)}`,

          {

            method:
              'GET',

            headers: {

              'Accept':
                'application/json'

            }

          }

        );


      // ---------------------------------------------------
      // READ RESPONSE
      // ---------------------------------------------------

      let data:
        AdmissionPaymentVerifyResponse | null =
        null;


      try {

        data =
          await response.json();

      } catch {

        data =
          null;

      }


      // ---------------------------------------------------
      // HANDLE BACKEND ERROR
      // ---------------------------------------------------

      if (!response.ok) {

        console.error(
          'Admission payment verification error:',
          data
        );


        if (
          response.status === 404
        ) {

          throw new Error(
            data?.message ||
            'Admission application or payment was not found.'
          );

        }


        if (
          response.status === 400
        ) {

          throw new Error(
            data?.message ||
            'The payment could not be verified.'
          );

        }


        throw new Error(
          data?.message ||
          'Unable to verify the admission payment.'
        );

      }


      // ---------------------------------------------------
      // VALIDATE RESPONSE
      // ---------------------------------------------------

      if (!data) {

        throw new Error(
          'The payment verification server returned an empty response.'
        );

      }


      console.log(
        'Admission payment verification response:',
        data
      );


      return data;

    } catch (error: any) {

      console.error(
        'Verify admission payment error:',
        error
      );


      throw new Error(

        error?.message ||

        'Unable to verify the admission payment.'

      );

    }

  }


  // =========================================================
  // APPROVE ADMISSION APPLICATION
  // =========================================================
  //
  // Approval is handled by the Render backend.
  //
  // Angular sends the Firebase ID token.
  //
  // The backend:
  //
  // - verifies the administrator
  // - verifies payment
  // - generates Student ID
  // - generates Parent ID
  // - creates Firebase Auth student account
  // - creates Firebase Auth parent account
  // - creates students/{id}
  // - creates parents/{id}
  // - creates users/{uid}
  // - updates the admission
  // - sends admission notifications
  // - returns temporary credentials
  //
  // =========================================================

  async approveAdmissionApplication(
    applicationId: string
  ) {

    const cleanApplicationId =
      String(
        applicationId || ''
      ).trim();


    if (!cleanApplicationId) {

      throw new Error(
        'Application ID is required.'
      );

    }


    // -----------------------------------------------------
    // CHECK CURRENT USER
    // -----------------------------------------------------

    const currentUser =
      auth.currentUser;


    if (!currentUser) {

      throw new Error(
        'You must be signed in as an administrator.'
      );

    }


    try {

      // ---------------------------------------------------
      // GET FIREBASE ID TOKEN
      // ---------------------------------------------------

      const token =
        await currentUser.getIdToken();


      // ---------------------------------------------------
      // CALL RENDER BACKEND
      // ---------------------------------------------------

      const response =
        await fetch(
          `${this.backendUrl}/api/admissions/approve`,
          {

            method:
              'POST',

            headers: {

              'Content-Type':
                'application/json',

              'Authorization':
                `Bearer ${token}`

            },

            body:
              JSON.stringify({

                applicationId:
                  cleanApplicationId

              })

          }
        );


      // ---------------------------------------------------
      // READ RESPONSE
      // ---------------------------------------------------

      let data: any =
        null;


      try {

        data =
          await response.json();

      } catch {

        data =
          null;

      }


      // ---------------------------------------------------
      // HANDLE BACKEND ERRORS
      // ---------------------------------------------------

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


      // ---------------------------------------------------
      // SUCCESS
      // ---------------------------------------------------

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

}