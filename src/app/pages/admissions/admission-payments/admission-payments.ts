import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import {
  CommonModule,
  DecimalPipe
} from '@angular/common';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import {
  FirebaseService
} from '../../../core/firebase.service';


// =========================================================
// ADMISSION APPLICATION INTERFACE
// =========================================================
//
// This interface represents the SAFE admission information
// returned by the backend for the public payment page.
//
// The browser does NOT receive the complete private admission
// record from Firebase.
//
// Backend:
// GET /api/admissions/payment/application/:applicationId
//
// =========================================================

interface AdmissionApplication {

  id: string;

  applicationId: string;

  applicationNumber: string;

  status: string;

  applicationFee: number;

  paymentStatus:
    | 'unpaid'
    | 'paid'
    | 'pending'
    | 'failed';

  paymentAmount: number;

  paymentReference: string;

  paymentDate: string;

  paymentVerifiedAt?: number;

  submittedAt?: string;

  studentName: string;

  classApplied: string;

  // -------------------------------------------------------
  // SAFE PARENT / GUARDIAN INFORMATION
  // -------------------------------------------------------
  //
  // Only the fields needed by the payment page are returned.
  //
  // We do NOT expose the complete admission record.
  //
  parentGuardian: {

    name: string;

    phone: string;

    email: string;

    relationship: string;

  };

}


// =========================================================
// PAYMENT INITIALIZATION RESPONSE
// =========================================================

interface PaymentInitializeResponse {

  success: boolean;

  message: string;

  applicationId: string;

  applicationFee: number;

  amountKobo: number;

  reference: string;

  accessCode: string;

  authorizationUrl: string;

  paymentStatus?: string;

  alreadyPaid?: boolean;

}


// =========================================================
// PAYMENT VERIFICATION RESPONSE
// =========================================================

interface PaymentVerifyResponse {

  success: boolean;

  paid: boolean;

  message: string;

  paymentStatus: string;

  reference: string;

  amount: number;

}


// =========================================================
// COMPONENT
// =========================================================

@Component({

  selector: 'app-admission-payment',

  standalone: true,

  imports: [
    CommonModule,
    DecimalPipe
  ],

  templateUrl: './admission-payments.html',

  styleUrl: './admission-payments.css'

})
export class AdmissionPayment implements OnInit {


  // =======================================================
  // APPLICATION
  // =======================================================

  applicationId = '';

  application:
    AdmissionApplication | null =
    null;


  // =======================================================
  // UI STATE
  // =======================================================

  loading = true;

  paying = false;

  verifying = false;


  // =======================================================
  // MESSAGES
  // =======================================================

  errorMessage = '';

  successMessage = '';


  // =======================================================
  // APPLICATION FEE
  // =======================================================

  readonly applicationFee = 5000;


  // =======================================================
  // BACKEND URL
  // =======================================================

  /**
   * IMPORTANT:
   *
   * Do NOT put the Paystack secret key here.
   *
   * Angular only communicates with the D-Littles backend.
   *
   * The Paystack secret key remains inside the backend
   * environment variables.
   *
   * This property is retained for compatibility/documentation.
   * Payment requests themselves are handled by FirebaseService.
   */

  private readonly backendUrl =
    'https://d-littles.onrender.com';


  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor(

    private readonly route:
      ActivatedRoute,

    private readonly router:
      Router,

    private readonly firebaseService:
      FirebaseService,

    private readonly cdr:
      ChangeDetectorRef

  ) {}


  // =======================================================
  // INITIALIZATION
  // =======================================================

  async ngOnInit(): Promise<void> {

    this.applicationId =
      this.route.snapshot.paramMap.get(
        'applicationId'
      ) || '';


    // -----------------------------------------------------
    // CHECK APPLICATION ID
    // -----------------------------------------------------

    if (!this.applicationId) {

      this.errorMessage =
        'Application ID is missing. Please return to the admissions page.';

      this.loading = false;

      this.cdr.detectChanges();

      return;

    }


    // -----------------------------------------------------
    // LOAD APPLICATION
    // -----------------------------------------------------

    await this.loadApplication();


    // -----------------------------------------------------
    // CHECK PAYSTACK CALLBACK
    // -----------------------------------------------------
    //
    // Paystack redirects back to:
    //
    // /admissions/payment/:applicationId?reference=xxxxx
    //
    // The reference is sent to our backend.
    //
    // We NEVER trust the browser to decide whether payment
    // was successful.
    //
    // The backend verifies directly with Paystack.
    // -----------------------------------------------------

    const reference =
      this.route.snapshot.queryParamMap.get(
        'reference'
      ) ||
      this.route.snapshot.queryParamMap.get(
        'trxref'
      );


    if (reference) {

      await this.verifyPayment(
        reference
      );

    }

  }


  // =======================================================
  // LOAD APPLICATION
  // =======================================================
  //
  // The FirebaseService now loads the application through:
  //
  // GET
  // /api/admissions/payment/application/:applicationId
  //
  // It does NOT directly read Firebase RTDB.
  //
  // =======================================================

  async loadApplication(): Promise<void> {

    this.loading = true;

    this.errorMessage = '';

    this.successMessage = '';

    this.cdr.detectChanges();


    try {

      console.log(
        'Loading admission application:',
        this.applicationId
      );


      const application =
        await this.firebaseService
          .getAdmissionApplication(
            this.applicationId
          );


      // ---------------------------------------------------
      // ASSIGN BACKEND RESPONSE
      // ---------------------------------------------------

      this.application =
        application as AdmissionApplication;


      console.log(
        'Admission application loaded:',
        this.application
      );


      // ---------------------------------------------------
      // NORMALIZE PAYMENT DATA
      // ---------------------------------------------------

      if (this.application) {

        this.application.applicationFee =
          Number(
            this.application.applicationFee ||
            this.applicationFee
          );


        this.application.paymentAmount =
          Number(
            this.application.paymentAmount ||
            0
          );


        const paymentStatus =
          String(
            this.application.paymentStatus ||
            'unpaid'
          ).toLowerCase();


        // -------------------------------------------------
        // NORMALIZE PAYMENT STATUS
        // -------------------------------------------------

        if (
          paymentStatus === 'paid' ||
          paymentStatus === 'pending' ||
          paymentStatus === 'failed' ||
          paymentStatus === 'unpaid'
        ) {

          this.application.paymentStatus =
            paymentStatus as
            | 'unpaid'
            | 'paid'
            | 'pending'
            | 'failed';

        } else {

          this.application.paymentStatus =
            'unpaid';

        }


        // -------------------------------------------------
        // PAYMENT REFERENCE
        // -------------------------------------------------

        this.application.paymentReference =
          this.application.paymentReference ||
          '';


        // -------------------------------------------------
        // PAYMENT DATE
        // -------------------------------------------------

        this.application.paymentDate =
          this.application.paymentDate ||
          '';


        // -------------------------------------------------
        // STUDENT
        // -------------------------------------------------

        this.application.studentName =
          this.application.studentName ||
          '';


        this.application.classApplied =
          this.application.classApplied ||
          '';


        // -------------------------------------------------
        // PARENT / GUARDIAN
        // -------------------------------------------------

        this.application.parentGuardian = {

          name:
            this.application.parentGuardian?.name ||
            '',

          phone:
            this.application.parentGuardian?.phone ||
            '',

          email:
            this.application.parentGuardian?.email ||
            '',

          relationship:
            this.application.parentGuardian?.relationship ||
            ''

        };

      }

    } catch (error) {

      console.error(
        'Error loading admission application:',
        error
      );


      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to load the admission application.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // APPLICANT NAME
  // =======================================================

  get applicantName(): string {

    return (
      this.application?.studentName ||
      ''
    );

  }


  // =======================================================
  // CLASS LABEL
  // =======================================================

  get classAppliedLabel(): string {

    const value =
      this.application?.classApplied ||
      '';


    switch (value) {

      case 'early-years':

        return 'Early Years';


      case 'early_years':

        return 'Early Years';


      case 'early years':

        return 'Early Years';


      case 'primary':

        return 'Primary';


      case 'secondary':

        return 'Secondary';


      default:

        return value ||
          'Not specified';

    }

  }


  // =======================================================
  // IS PAID
  // =======================================================

  get isPaid(): boolean {

    return (
      this.application?.paymentStatus ===
      'paid'
    );

  }


  // =======================================================
  // PAYMENT STATUS LABEL
  // =======================================================

  get paymentStatusLabel(): string {

    if (!this.application) {

      return 'Unknown';

    }


    switch (
      this.application.paymentStatus
    ) {

      case 'paid':

        return 'Paid';


      case 'pending':

        return 'Payment Pending';


      case 'failed':

        return 'Payment Failed';


      case 'unpaid':

      default:

        return 'Unpaid';

    }

  }


  // =======================================================
  // PAYMENT STATUS CSS CLASS
  // =======================================================

  get paymentStatusClass(): string {

    if (!this.application) {

      return 'status-unpaid';

    }


    switch (
      this.application.paymentStatus
    ) {

      case 'paid':

        return 'status-paid';


      case 'pending':

        return 'status-pending';


      case 'failed':

        return 'status-failed';


      case 'unpaid':

      default:

        return 'status-unpaid';

    }

  }


  // =======================================================
  // START PAYMENT
  // =======================================================
  //
  // FLOW:
  //
  // Angular
  //    ↓
  // D-Littles Backend
  //    ↓
  // Paystack Initialize
  //    ↓
  // Paystack Checkout
  //    ↓
  // Angular Callback
  //    ↓
  // D-Littles Backend Verify
  //    ↓
  // Firebase
  //
  // =======================================================

  async payApplicationFee(): Promise<void> {

    // -----------------------------------------------------
    // APPLICATION MUST EXIST
    // -----------------------------------------------------

    if (!this.application) {

      this.errorMessage =
        'Admission application could not be loaded.';

      this.cdr.detectChanges();

      return;

    }


    // -----------------------------------------------------
    // PREVENT DOUBLE PAYMENT
    // -----------------------------------------------------

    if (this.isPaid) {

      this.successMessage =
        'Your application fee has already been paid.';

      this.cdr.detectChanges();

      return;

    }


    // -----------------------------------------------------
    // PREVENT MULTIPLE CLICKS
    // -----------------------------------------------------

    if (
      this.paying ||
      this.verifying
    ) {

      return;

    }


    // -----------------------------------------------------
    // CLEAR PREVIOUS MESSAGES
    // -----------------------------------------------------

    this.paying = true;

    this.errorMessage = '';

    this.successMessage = '';

    this.cdr.detectChanges();


    try {

      console.log(
        'Initializing admission payment:',
        {

          applicationId:
            this.applicationId,

          applicationNumber:
            this.application.applicationNumber,

          amount:
            this.application.applicationFee ||
            this.applicationFee

        }
      );


      // ---------------------------------------------------
      // CALL FIREBASE SERVICE
      // ---------------------------------------------------
      //
      // The service calls:
      //
      // POST
      // /api/admissions/payment/initialize
      //
      // ---------------------------------------------------

      const data =
        await this.firebaseService
          .initializeAdmissionPayment(
            this.applicationId
          );


      // ---------------------------------------------------
      // VALIDATE RESPONSE
      // ---------------------------------------------------

      if (
        !data ||
        data.success !== true
      ) {

        throw new Error(

          data?.message ||

          'The payment could not be initialized.'

        );

      }


      // ---------------------------------------------------
      // ALREADY PAID
      // ---------------------------------------------------

      if (
        data.alreadyPaid === true ||
        data.paymentStatus === 'paid'
      ) {

        this.application.paymentStatus =
          'paid';

        this.successMessage =
          'Your application fee has already been paid.';

        this.cdr.detectChanges();

        return;

      }


      if (
        !data.authorizationUrl
      ) {

        throw new Error(
          'Paystack did not return a checkout URL.'
        );

      }


      if (
        !data.reference
      ) {

        throw new Error(
          'Paystack did not return a payment reference.'
        );

      }


      // ---------------------------------------------------
      // UPDATE LOCAL APPLICATION STATE
      // ---------------------------------------------------

      this.application.paymentStatus =
        'pending';


      this.application.paymentAmount =
        Number(
          data.applicationFee ||
          this.applicationFee
        );


      this.application.paymentReference =
        data.reference;


      this.application.paymentDate =
        '';


      this.successMessage =
        'Redirecting you to the secure Paystack payment page...';


      this.cdr.detectChanges();


      console.log(
        'Payment initialized successfully:',
        {

          reference:
            data.reference,

          amount:
            data.applicationFee,

          authorizationUrl:
            data.authorizationUrl

        }
      );


      // ---------------------------------------------------
      // REDIRECT TO PAYSTACK
      // ---------------------------------------------------
      //
      // Paystack returns an authorization URL from the
      // backend.
      //
      // The secret key is never exposed to Angular.
      // ---------------------------------------------------

      window.location.href =
        data.authorizationUrl;


    } catch (error) {

      console.error(
        'Application payment error:',
        error
      );


      this.errorMessage =
        error instanceof Error

          ? error.message

          : 'Unable to start the payment. Please try again.';

    } finally {

      this.paying = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // VERIFY PAYMENT
  // =======================================================

  async verifyPayment(
    reference: string
  ): Promise<void> {

    const cleanReference =
      String(
        reference || ''
      ).trim();


    if (!cleanReference) {

      return;

    }


    // -----------------------------------------------------
    // PREVENT DUPLICATE VERIFICATION
    // -----------------------------------------------------

    if (this.verifying) {

      return;

    }


    this.verifying = true;

    this.loading = true;

    this.errorMessage = '';

    this.successMessage =
      'Verifying your payment. Please wait...';

    this.cdr.detectChanges();


    try {

      console.log(
        'Verifying admission payment:',
        {

          applicationId:
            this.applicationId,

          reference:
            cleanReference

        }
      );


      // ---------------------------------------------------
      // CALL FIREBASE SERVICE
      // ---------------------------------------------------
      //
      // The service calls:
      //
      // GET
      // /api/admissions/payment/verify/:applicationId/:reference
      //
      // ---------------------------------------------------

      const data =
        await this.firebaseService
          .verifyAdmissionPayment(
            this.applicationId,
            cleanReference
          );


      // ---------------------------------------------------
      // PAYMENT SUCCESS
      // ---------------------------------------------------

      if (
        data?.paid === true ||
        data?.paymentStatus === 'paid'
      ) {

        this.successMessage =
          'Payment successful. Your admission application fee has been confirmed.';


        // -------------------------------------------------
        // RELOAD THROUGH BACKEND
        // -------------------------------------------------

        await this.loadApplication();


        // -------------------------------------------------
        // REMOVE PAYMENT REFERENCE FROM URL
        // -------------------------------------------------

        await this.router.navigate(
          [
            '/admissions/payment',
            this.applicationId
          ],
          {
            replaceUrl: true
          }
        );


        this.successMessage =
          'Payment successful. Your admission application fee has been confirmed.';


        console.log(
          'Admission payment verified successfully:',
          data
        );


        this.cdr.detectChanges();

        return;

      }


      // ---------------------------------------------------
      // PAYMENT NOT SUCCESSFUL
      // ---------------------------------------------------

      if (
        data?.paymentStatus === 'pending'
      ) {

        this.successMessage =
          'Your payment is still being processed. Please wait a moment and refresh this page.';

      } else {

        this.errorMessage =
          data?.message ||
          'The payment was not successful. Please try again.';

      }


      // ---------------------------------------------------
      // RELOAD APPLICATION
      // ---------------------------------------------------

      await this.loadApplication();


      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Admission payment verification error:',
        error
      );


      this.errorMessage =
        error instanceof Error

          ? error.message

          : 'Unable to verify your payment. Please try again.';


      // ---------------------------------------------------
      // STILL RELOAD APPLICATION
      // ---------------------------------------------------

      try {

        await this.loadApplication();

      } catch (reloadError) {

        console.error(
          'Unable to reload application after payment verification error:',
          reloadError
        );

      }

    } finally {

      this.verifying = false;

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // RETRY PAYMENT
  // =======================================================

  async retryPayment(): Promise<void> {

    if (
      this.paying ||
      this.verifying
    ) {

      return;

    }


    await this.loadApplication();


    if (
      this.application?.paymentStatus ===
      'paid'
    ) {

      this.successMessage =
        'Your application fee has already been paid.';

      this.cdr.detectChanges();

      return;

    }


    await this.payApplicationFee();

  }


  // =======================================================
  // BACK TO ADMISSIONS
  // =======================================================

  goBackToAdmissions(): void {

    this.router.navigate([
      '/admissions'
    ]);

  }


  // =======================================================
  // GO TO HOME
  // =======================================================

  goToHome(): void {

    this.router.navigate([
      '/'
    ]);

  }

}