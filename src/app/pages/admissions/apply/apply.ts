import {
  ChangeDetectorRef,
  Component
} from '@angular/core';

import {
  DecimalPipe
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  Router,
  RouterLink
} from '@angular/router';

import {
  FirebaseService
} from '../../../core/firebase.service';


@Component({
  selector: 'app-apply',

  standalone: true,

  imports: [
    FormsModule,
    RouterLink,
    DecimalPipe
  ],

  templateUrl: './apply.html',

  styleUrl: './apply.css'
})
export class Apply {

  // =========================================================
  // APPLICATION STATE
  // =========================================================

  submitted = false;

  submitting = false;

  applicationNumber = '';

  applicationId = '';

  errorMessage = '';


  // =========================================================
  // APPLICATION FEE
  // =========================================================

  readonly applicationFee = 5000;


  // =========================================================
  // APPLICATION FORM
  // =========================================================

  application = {

    studentFirstName: '',

    studentMiddleName: '',

    studentLastName: '',

    dateOfBirth: '',

    gender: '',

    classApplied: '',

    parentName: '',

    parentPhone: '',

    parentEmail: '',

    relationship: '',

    previousSchool: '',

    previousClass: '',

    emergencyName: '',

    emergencyPhone: '',

    additionalNotes: '',

    declaration: false

  };


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(

    private readonly firebaseService:
      FirebaseService,

    private readonly router:
      Router,

    private readonly cdr:
      ChangeDetectorRef

  ) {}


  // =========================================================
  // SUBMIT APPLICATION
  // =========================================================

  async submitApplication(): Promise<void> {

    console.log(
      '1. Submit button clicked'
    );


    // ---------------------------------------------------------
    // PREVENT DOUBLE SUBMISSION
    // ---------------------------------------------------------

    if (this.submitting) {

      return;

    }


    // ---------------------------------------------------------
    // CHECK DECLARATION
    // ---------------------------------------------------------

    if (!this.application.declaration) {

      this.errorMessage =
        'Please accept the declaration before submitting.';

      this.cdr.detectChanges();

      return;

    }


    // ---------------------------------------------------------
    // START SUBMISSION
    // ---------------------------------------------------------

    this.submitting = true;

    this.errorMessage = '';

    this.cdr.detectChanges();


    try {

      console.log(
        '2. Submitting application through backend'
      );


      // -------------------------------------------------------
      // SAVE APPLICATION THROUGH RENDER BACKEND
      // -------------------------------------------------------
      //
      // The browser does NOT write directly to:
      //
      // /admissions
      //
      // The Render backend uses Firebase Admin SDK.
      //

      const result =
        await this.firebaseService
          .submitAdmissionApplication(
            this.application
          );


      console.log(
        '3. Backend application result:',
        result
      );


      // -------------------------------------------------------
      // VALIDATE APPLICATION ID
      // -------------------------------------------------------

      if (
        !result ||
        !result.applicationId
      ) {

        throw new Error(
          'Application was created, but no application ID was returned.'
        );

      }


      // -------------------------------------------------------
      // SAVE APPLICATION DETAILS
      // -------------------------------------------------------

      this.applicationId =
        result.applicationId;

      this.applicationNumber =
        result.applicationNumber || '';


      console.log(
        'Application ID:',
        this.applicationId
      );

      console.log(
        'Application Number:',
        this.applicationNumber
      );

      console.log(
        'Application Fee:',
        result.applicationFee ||
        this.applicationFee
      );


      // -------------------------------------------------------
      // MARK AS SUBMITTED
      // -------------------------------------------------------

      this.submitted = true;


      // -------------------------------------------------------
      // BUILD PAYMENT URL
      // -------------------------------------------------------

      const paymentUrl =
        `/admissions/payment/${this.applicationId}`;


      console.log(
        '4. Navigating to application payment page:',
        paymentUrl
      );


      // -------------------------------------------------------
      // NAVIGATE TO PAYMENT PAGE
      // -------------------------------------------------------

      const navigationSuccessful =
        await this.router.navigateByUrl(
          paymentUrl
        );


      console.log(
        'Payment page navigation result:',
        navigationSuccessful
      );


      // -------------------------------------------------------
      // CHECK NAVIGATION
      // -------------------------------------------------------

      if (!navigationSuccessful) {

        throw new Error(
          'The application was submitted successfully, but the payment page could not be opened.'
        );

      }


    } catch (error) {

      console.error(
        '5. Admission submission error:',
        error
      );


      this.errorMessage =
        error instanceof Error
          ? error.message
          : String(error);


      this.submitted = false;


    } finally {

      console.log(
        '6. Application submission process finished'
      );


      this.submitting = false;

      this.cdr.detectChanges();

    }

  }

}