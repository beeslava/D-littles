import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import {
  NgIf,
  NgFor,
  DecimalPipe
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  Router
} from '@angular/router';

import {
  get,
  ref,
  query,
  orderByChild,
  equalTo
} from 'firebase/database';

import {
  database
} from '../../core/firebase.config';

import {
  SchoolAuthService,
  SchoolUser
} from '../../core/Auth/school-auth.service';

import {
  Student,
  StudentService
} from '../../core/student.service';


// =========================================================
// FEE ITEM
// =========================================================

interface FeeItem {

  name: string;

  amount: number;

}


// =========================================================
// FEE STRUCTURE
// =========================================================

interface SchoolFee {

  id: string;

  title: string;

  description: string;

  classId: string;

  className: string;

  accountNumber: string;

  items: FeeItem[];

  totalAmount: number;

  status:
    | 'active'
    | 'inactive';

  createdAt: number;

  updatedAt: number;

}


// =========================================================
// PAYMENT
// =========================================================

interface Payment {

  id: string;

  studentId: string;

  studentRecordId: string;

  studentUid: string;

  parentId: string;

  feeId: string;

  feeTitle: string;

  accountNumber: string;

  amountPaid: number;

  totalAmount: number;

  balance: number;

  paymentReference: string;

  paymentMethod:
    | 'cash'
    | 'bank_transfer'
    | 'pos'
    | 'online'
    | 'other';

  paymentDate: string;

  status:
    | 'pending'
    | 'paid'
    | 'partially_paid'
    | 'unpaid'
    | 'failed';

  createdAt: number;

}


// =========================================================
// CHILD FEE
// =========================================================

interface ChildFee {

  fee: SchoolFee;

  amountPaid: number;

  balance: number;

  status:
    | 'paid'
    | 'partially_paid'
    | 'unpaid';

}


// =========================================================
// PAYMENT INITIALIZATION RESPONSE
// =========================================================

interface PaymentInitializeResponse {

  success?: boolean;

  message?: string;

  paymentId?: string;

  feeId?: string;

  amount?: number;

  amountKobo?: number;

  reference?: string;

  accessCode?: string;

  authorizationUrl?: string;

}


// =========================================================
// PAYMENT VERIFICATION RESPONSE
// =========================================================

interface PaymentVerifyResponse {

  success?: boolean;

  paid?: boolean;

  message?: string;

  paymentStatus?: string;

  reference?: string;

  amount?: number;

  balance?: number;

}


// =========================================================
// COMPONENT
// =========================================================

@Component({

  selector: 'app-parent-fees',

  standalone: true,

  imports: [
    NgIf,
    NgFor,
    DecimalPipe,
    FormsModule
  ],

  templateUrl: './parent-fees.html',

  styleUrl: './parent-fees.css'

})
export class ParentFees implements OnInit {


  // =========================================================
  // BACKEND
  // =========================================================

  private readonly backendUrl =
    'https://d-littles.onrender.com';


  // =========================================================
  // CURRENT USER
  // =========================================================

  currentUser:
    SchoolUser | null = null;


  // =========================================================
  // CHILDREN
  // =========================================================

  children:
    Student[] = [];


  // =========================================================
  // SELECTED CHILD
  // =========================================================

  selectedChild:
    Student | null = null;


  // =========================================================
  // FEE DATA
  // =========================================================

  fees:
    SchoolFee[] = [];

  childFees:
    ChildFee[] = [];

  payments:
    Payment[] = [];


  // =========================================================
  // PAGE STATE
  // =========================================================

  loading = true;

  refreshing = false;

  paymentLoading = false;

  errorMessage = '';

  successMessage = '';


  // =========================================================
  // CURRENT PAYMENT
  // =========================================================

  selectedPaymentAmount = 0;

  selectedPaymentFee:
    ChildFee | null = null;


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(

    private schoolAuth:
      SchoolAuthService,

    private studentService:
      StudentService,

    private cdr:
      ChangeDetectorRef,

    private router:
      Router

  ) {}


  // =========================================================
  // INITIALIZATION
  // =========================================================

  async ngOnInit(): Promise<void> {

    try {

      await this.schoolAuth.waitForAuthReady();


      this.currentUser =
        this.schoolAuth.getUserData();


      if (!this.currentUser) {

        this.errorMessage =
          'Unable to load your account information.';

        return;

      }


      /*
       * Both parents and students can use the online school
       * fee payment system.
       */

      if (
        this.currentUser.role !== 'parent' &&
        this.currentUser.role !== 'student'
      ) {

        this.errorMessage =
          'This page is only available to parents and students.';

        return;

      }


      await this.loadChildren();

    } catch (error) {

      console.error(
        'Parent fees initialization error:',
        error
      );

      this.errorMessage =
        'Unable to load school fees. Please try again.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // LOAD CHILDREN
  // =========================================================

  async loadChildren(): Promise<void> {

    if (!this.currentUser) {

      return;

    }


    try {

      if (
        this.currentUser.role === 'parent'
      ) {

        this.children =
          await this.studentService.getChildrenForParent(
            this.currentUser
          );

      } else {

        this.children =
          await this.loadCurrentStudent();

      }


      console.log(
        'Students found for fees:',
        this.children
      );


      if (!this.children.length) {

        this.selectedChild = null;

        this.childFees = [];

        this.payments = [];

        this.errorMessage =
          'No student records are currently linked to your account.';

        return;

      }


      this.errorMessage = '';


      const existingSelectedId =
        this.normalize(
          this.selectedChild?.id
        );


      const existingSelectedStudentId =
        this.normalize(
          this.selectedChild?.studentId
        );


      const matchingChild =
        this.children.find(
          child =>
            (
              existingSelectedId &&
              this.normalize(child.id) ===
                existingSelectedId
            )
            ||
            (
              existingSelectedStudentId &&
              this.normalize(child.studentId) ===
                existingSelectedStudentId
            )
        );


      this.selectedChild =
        matchingChild ||
        this.children[0];


      await this.loadFeesForSelectedChild();

    } catch (error) {

      console.error(
        'Error loading students for fees:',
        error
      );

      this.errorMessage =
        'Unable to load your student information.';

    }

  }


  // =========================================================
  // LOAD CURRENT STUDENT
  // =========================================================

  private async loadCurrentStudent(): Promise<Student[]> {

    if (!this.currentUser) {

      return [];

    }


    const studentsRef =
      ref(
        database,
        'students'
      );


    const snapshot =
      await get(
        studentsRef
      );


    if (!snapshot.exists()) {

      return [];

    }


    const data =
      snapshot.val();


    const result:
      Student[] = [];


    const currentUid =
      this.normalize(
        this.currentUser.uid
      );


    const currentStudentId =
      this.normalize(
        this.currentUser.studentId
      );


    Object.entries(data).forEach(
      ([id, value]: [string, any]) => {

        const recordUid =
          this.normalize(
            value?.uid ||
            value?.studentUid
          );


        const recordStudentId =
          this.normalize(
            value?.studentId
          );


        const matchesUid =
          !!currentUid &&
          !!recordUid &&
          currentUid === recordUid;


        const matchesStudentId =
          !!currentStudentId &&
          !!recordStudentId &&
          currentStudentId === recordStudentId;


        if (
          !matchesUid &&
          !matchesStudentId
        ) {

          return;

        }


        result.push({

          id,

          ...value

        } as Student);

      }
    );


    if (!result.length) {

      const possibleRecord =
        this.childrenByRecordKey(
          data,
          this.currentUser.studentId
        );


      if (possibleRecord) {

        result.push(
          possibleRecord
        );

      }

    }


    return result;

  }


  // =========================================================
  // FALLBACK STUDENT RECORD MATCH
  // =========================================================

  private childrenByRecordKey(
    data: any,
    studentId?: string
  ): Student | null {

    if (!studentId) {

      return null;

    }


    const normalized =
      this.normalize(
        studentId
      );


    for (
      const [
        id,
        value
      ] of Object.entries(data)
    ) {

      if (
        this.normalize(id) ===
        normalized
      ) {

        return {

          id,

          ...(value as any)

        } as Student;

      }

    }


    return null;

  }


  // =========================================================
  // SELECT CHILD
  // =========================================================

  async selectChild(
    child: Student
  ): Promise<void> {

    if (!child) {

      return;

    }


    this.selectedChild =
      child;


    this.errorMessage = '';

    this.successMessage = '';

    this.childFees = [];

    this.payments = [];

    this.loading = true;


    this.cdr.detectChanges();


    try {

      await this.loadFeesForSelectedChild();

    } catch (error) {

      console.error(
        'Error changing selected child:',
        error
      );

      this.errorMessage =
        'Unable to load fees for this student.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // LOAD FEES FOR SELECTED CHILD
  // =========================================================

  async loadFeesForSelectedChild(): Promise<void> {

    if (!this.selectedChild) {

      return;

    }


    this.loading = true;

    this.errorMessage = '';

    this.successMessage = '';


    try {

      // -------------------------------------------------------
      // LOAD FEE STRUCTURES
      // -------------------------------------------------------

      const feesRef =
        ref(
          database,
          'fees'
        );


      const feesSnapshot =
        await get(
          feesRef
        );


      const loadedFees:
        SchoolFee[] = [];


      if (feesSnapshot.exists()) {

        const data =
          feesSnapshot.val();


        Object.entries(data).forEach(
          ([id, value]: [string, any]) => {

            const feeStatus:
              'active' | 'inactive' =
              value?.status === 'inactive'
                ? 'inactive'
                : 'active';


            const items:
              FeeItem[] =
              Array.isArray(value?.items)
                ? value.items.map(
                    (item: any) => ({

                      name:
                        String(
                          item?.name || ''
                        ),

                      amount:
                        Number(
                          item?.amount || 0
                        )

                    })
                  )
                : [];


            const totalAmount =
              Number(
                value?.totalAmount ||
                items.reduce(
                  (
                    total: number,
                    item: FeeItem
                  ) =>
                    total +
                    Number(
                      item.amount || 0
                    ),
                  0
                )
              );


            loadedFees.push({

              id,

              title:
                String(
                  value?.title ||
                  'School Fee'
                ),

              description:
                String(
                  value?.description ||
                  ''
                ),

              classId:
                String(
                  value?.classId ||
                  ''
                ),

              className:
                String(
                  value?.className ||
                  ''
                ),

              accountNumber:
                String(
                  value?.accountNumber ||
                  ''
                ),

              items,

              totalAmount,

              status:
                feeStatus,

              createdAt:
                Number(
                  value?.createdAt ||
                  0
                ),

              updatedAt:
                Number(
                  value?.updatedAt ||
                  0
                )

            });

          }
        );

      }


      this.fees =
        loadedFees;


      // -------------------------------------------------------
      // LOAD PAYMENTS
      // -------------------------------------------------------

      await this.loadPayments();


      // -------------------------------------------------------
      // BUILD CHILD FEES
      // -------------------------------------------------------

      this.childFees =
        this.fees

          .filter(
            fee =>
              fee.status === 'active'
          )

          .filter(
            fee =>
              this.feeBelongsToChild(
                fee,
                this.selectedChild!
              )
          )

          .map(
            fee =>
              this.buildChildFee(
                fee,
                this.selectedChild!
              )
          );


      if (!this.childFees.length) {

        this.successMessage =
          'No active fee structure has been assigned to this student\'s class yet.';

      }

    } catch (error) {

      console.error(
        'Error loading parent fees:',
        error
      );

      this.errorMessage =
        'Unable to load the school fees. Please try again.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // LOAD PAYMENTS
  // =========================================================

  async loadPayments(): Promise<void> {

    this.payments = [];


    if (!this.selectedChild) {

      return;

    }


    // -------------------------------------------------------
    // PARENT PAYMENTS
    // -------------------------------------------------------

    if (
      this.currentUser?.role === 'parent'
    ) {

      if (!this.currentUser.uid) {

        return;

      }


      const paymentsQuery =
        query(
          ref(
            database,
            'payments'
          ),

          orderByChild(
            'parentId'
          ),

          equalTo(
            this.currentUser.uid
          )
        );


      const snapshot =
        await get(
          paymentsQuery
        );


      if (!snapshot.exists()) {

        return;

      }


      this.mapPayments(
        snapshot.val()
      );

      return;

    }


    // -------------------------------------------------------
    // STUDENT PAYMENTS
    // -------------------------------------------------------

    const studentId =
      String(
        this.selectedChild.studentId ||
        this.currentUser?.studentId ||
        ''
      ).trim();


    if (!studentId) {

      return;

    }


    const paymentsQuery =
      query(
        ref(
          database,
          'payments'
        ),

        orderByChild(
          'studentId'
        ),

        equalTo(
          studentId
        )
      );


    const snapshot =
      await get(
        paymentsQuery
      );


    if (!snapshot.exists()) {

      return;

    }


    this.mapPayments(
      snapshot.val()
    );

  }


  // =========================================================
  // MAP PAYMENTS
  // =========================================================

  private mapPayments(
    data: any
  ): void {

    if (!this.selectedChild) {

      return;

    }


    const childStudentId =
      this.normalize(
        this.selectedChild.studentId
      );


    const childRecordId =
      this.normalize(
        this.selectedChild.id
      );


    const childUid =
      this.normalize(
        this.selectedChild.uid
      );


    Object.entries(data).forEach(
      ([id, value]: [string, any]) => {

        const paymentStudentId =
          this.normalize(
            value?.studentId
          );


        const paymentRecordId =
          this.normalize(
            value?.studentRecordId
          );


        const paymentStudentUid =
          this.normalize(
            value?.studentUid
          );


        const belongsToChild =

          (
            childStudentId &&
            paymentStudentId ===
              childStudentId
          )

          ||

          (
            childRecordId &&
            paymentRecordId ===
              childRecordId
          )

          ||

          (
            childRecordId &&
            paymentStudentId ===
              childRecordId
          )

          ||

          (
            childUid &&
            paymentStudentUid ===
              childUid
          );


        if (!belongsToChild) {

          return;

        }


        const rawStatus =
          String(
            value?.status ||
            'unpaid'
          )
            .trim()
            .toLowerCase();


        let paymentStatus:
          | 'pending'
          | 'paid'
          | 'partially_paid'
          | 'unpaid'
          | 'failed' =
            'unpaid';


        if (
          rawStatus === 'pending'
        ) {

          paymentStatus =
            'pending';

        } else if (
          rawStatus === 'failed'
        ) {

          paymentStatus =
            'failed';

        } else if (
          rawStatus === 'paid' ||
          rawStatus === 'success'
        ) {

          paymentStatus =
            'paid';

        } else if (
          rawStatus === 'partially_paid'
        ) {

          paymentStatus =
            'partially_paid';

        }


        this.payments.push({

          id,

          studentId:
            String(
              value?.studentId ||
              ''
            ),

          studentRecordId:
            String(
              value?.studentRecordId ||
              ''
            ),

          studentUid:
            String(
              value?.studentUid ||
              ''
            ),

          parentId:
            String(
              value?.parentId ||
              ''
            ),

          feeId:
            String(
              value?.feeId ||
              ''
            ),

          feeTitle:
            String(
              value?.feeTitle ||
              ''
            ),

          accountNumber:
            String(
              value?.accountNumber ||
              ''
            ),

          amountPaid:
            Number(
              value?.amountPaid ||
              0
            ),

          totalAmount:
            Number(
              value?.totalFee ||
              value?.totalAmount ||
              0
            ),

          balance:
            Number(
              value?.balance ||
              0
            ),

          paymentReference:
            String(
              value?.paymentReference ||
              ''
            ),

          paymentMethod:
            value?.paymentMethod ||
            'other',

          paymentDate:
            String(
              value?.paymentDate ||
              ''
            ),

          status:
            paymentStatus,

          createdAt:
            Number(
              value?.createdAt ||
              0
            )

        });

      }
    );


    this.payments.sort(
      (a, b) =>
        b.createdAt -
        a.createdAt
    );


    console.log(
      'Payments loaded:',
      this.payments
    );

  }


  // =========================================================
  // CHECK FEE BELONGS TO CHILD
  // =========================================================

  feeBelongsToChild(
    fee: SchoolFee,
    child: Student
  ): boolean {

    const feeClassId =
      this.normalize(
        fee.classId
      );


    const feeClassName =
      this.normalize(
        fee.className
      );


    const childClassId =
      this.normalize(
        child.classId
      );


    const childClassName =
      this.normalize(
        child.className ||
        child.class
      );


    if (
      feeClassId &&
      childClassId &&
      feeClassId === childClassId
    ) {

      return true;

    }


    if (
      feeClassName &&
      childClassName &&
      feeClassName === childClassName
    ) {

      return true;

    }


    if (
      !feeClassId &&
      !feeClassName
    ) {

      return true;

    }


    return false;

  }


  // =========================================================
  // BUILD CHILD FEE
  // =========================================================

  buildChildFee(
    fee: SchoolFee,
    child: Student
  ): ChildFee {

    const childStudentId =
      this.normalize(
        child.studentId
      );


    const childRecordId =
      this.normalize(
        child.id
      );


    /*
     * Only successful payments count toward the fee balance.
     *
     * Pending and failed Paystack payments do not reduce the
     * displayed balance.
     */

    const feePayments =
      this.payments.filter(
        payment => {

          const paymentStudentId =
            this.normalize(
              payment.studentId
            );


          const paymentRecordId =
            this.normalize(
              payment.studentRecordId
            );


          const sameStudent =

            (
              childStudentId &&
              paymentStudentId ===
                childStudentId
            )

            ||

            (
              childRecordId &&
              paymentRecordId ===
                childRecordId
            )

            ||

            (
              childRecordId &&
              paymentStudentId ===
                childRecordId
            );


          if (!sameStudent) {

            return false;

          }


          if (
            this.normalize(
              payment.feeId
            ) !==
            this.normalize(
              fee.id
            )
          ) {

            return false;

          }


          return (
            payment.status === 'paid' ||
            payment.status === 'partially_paid'
          );

        }
      );


    const amountPaid =
      feePayments.reduce(
        (
          total,
          payment
        ) =>
          total +
          Number(
            payment.amountPaid ||
            0
          ),
        0
      );


    const totalAmount =
      Number(
        fee.totalAmount ||
        0
      );


    const balance =
      Math.max(
        totalAmount -
        amountPaid,
        0
      );


    let status:
      | 'paid'
      | 'partially_paid'
      | 'unpaid' =
        'unpaid';


    if (
      totalAmount > 0 &&
      amountPaid >= totalAmount
    ) {

      status =
        'paid';

    } else if (
      amountPaid > 0
    ) {

      status =
        'partially_paid';

    }


    return {

      fee,

      amountPaid,

      balance,

      status

    };

  }


  // =========================================================
  // TOTAL FEES
  // =========================================================

  get totalFees(): number {

    return this.childFees.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.fee.totalAmount ||
          0
        ),
      0
    );

  }


  // =========================================================
  // TOTAL PAID
  // =========================================================

  get totalPaid(): number {

    return this.childFees.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.amountPaid ||
          0
        ),
      0
    );

  }


  // =========================================================
  // TOTAL BALANCE
  // =========================================================

  get totalBalance(): number {

    return this.childFees.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.balance ||
          0
        ),
      0
    );

  }


  // =========================================================
  // PAID FEE COUNT
  // =========================================================

  get paidFeeCount(): number {

    return this.childFees.filter(
      item =>
        item.status ===
        'paid'
    ).length;

  }


  // =========================================================
  // PARTIALLY PAID COUNT
  // =========================================================

  get partiallyPaidFeeCount(): number {

    return this.childFees.filter(
      item =>
        item.status ===
        'partially_paid'
    ).length;

  }


  // =========================================================
  // UNPAID FEE COUNT
  // =========================================================

  get unpaidFeeCount(): number {

    return this.childFees.filter(
      item =>
        item.status ===
        'unpaid'
    ).length;

  }


  // =========================================================
  // CHILD NAME
  // =========================================================

  getChildName(
    child: Student
  ): string {

    if (child.fullName) {

      return child.fullName;

    }


    return [

      child.firstName,

      child.middleName,

      child.lastName

    ]

      .filter(Boolean)

      .join(' ') ||

      'Student';

  }


  // =========================================================
  // CHILD CLASS
  // =========================================================

  getChildClass(
    child: Student
  ): string {

    return (
      child.className ||
      child.class ||
      'Class not assigned'
    );

  }


  // =========================================================
  // PAYMENT METHOD LABEL
  // =========================================================

  getPaymentMethodLabel(
    method: string
  ): string {

    switch (method) {

      case 'cash':
        return 'Cash';

      case 'bank_transfer':
        return 'Bank Transfer';

      case 'pos':
        return 'POS';

      case 'online':
        return 'Online';

      case 'other':
        return 'Other';

      default:
        return method ||
          'Other';

    }

  }


  // =========================================================
  // STATUS LABEL
  // =========================================================

  getStatusLabel(
    status:
      | 'paid'
      | 'partially_paid'
      | 'unpaid'
  ): string {

    switch (status) {

      case 'paid':
        return 'Paid';

      case 'partially_paid':
        return 'Partially Paid';

      default:
        return 'Unpaid';

    }

  }


  // =========================================================
  // NORMALIZE
  // =========================================================

  private normalize(
    value: any
  ): string {

    return String(
      value || ''
    )
      .trim()
      .toLowerCase();

  }


  // =========================================================
  // REFRESH
  // =========================================================

  async refresh(): Promise<void> {

    if (this.refreshing) {

      return;

    }


    this.refreshing = true;

    this.errorMessage = '';

    this.successMessage = '';


    this.cdr.detectChanges();


    try {

      await this.schoolAuth.waitForAuthReady();


      this.currentUser =
        this.schoolAuth.getUserData();


      if (!this.currentUser) {

        this.errorMessage =
          'Unable to load your account information.';

        return;

      }


      await this.loadChildren();


      this.successMessage =
        'Fees refreshed successfully.';

    } catch (error) {

      console.error(
        'Parent fees refresh error:',
        error
      );

      this.errorMessage =
        'Unable to refresh fees. Please try again.';

    } finally {

      this.refreshing = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // PAY ONLINE
  // =========================================================

  async payOnline(
    childFee: ChildFee
  ): Promise<void> {

    if (this.paymentLoading) {

      return;

    }


    if (!this.selectedChild) {

      this.errorMessage =
        'Please select a student before making a payment.';

      this.cdr.detectChanges();

      return;

    }


    if (!childFee?.fee?.id) {

      this.errorMessage =
        'The selected fee could not be identified.';

      this.cdr.detectChanges();

      return;

    }


    const balance =
      Number(
        childFee.balance ||
        0
      );


    if (
      !Number.isFinite(balance) ||
      balance <= 0
    ) {

      this.successMessage =
        'This fee has already been fully paid.';

      this.cdr.detectChanges();

      return;

    }


    this.errorMessage = '';

    this.successMessage = '';


    // -------------------------------------------------------
    // PAYMENT AMOUNT
    // -------------------------------------------------------

    const choice =
      window.prompt(
        [
          `Fee: ${childFee.fee.title}`,
          `Outstanding balance: ₦${this.formatAmount(balance)}`,
          '',
          'Enter the amount you want to pay.',
          `For full payment, enter: ${this.formatAmount(balance)}`,
          'For partial payment, enter any smaller amount.',
          '',
          'Cancel to return without paying.'
        ].join('\n'),
        this.formatAmount(balance)
      );


    if (
      choice === null
    ) {

      return;

    }


    const amount =
      Number(
        String(choice)
          .replace(/,/g, '')
          .replace(/₦/gi, '')
          .trim()
      );


    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      this.errorMessage =
        'Please enter a valid payment amount.';

      this.cdr.detectChanges();

      return;

    }


    if (
      amount > balance
    ) {

      this.errorMessage =
        `The payment amount cannot be greater than the outstanding balance of ₦${this.formatAmount(balance)}.`;

      this.cdr.detectChanges();

      return;

    }


    if (
      !Number.isInteger(amount)
    ) {

      this.errorMessage =
        'Please enter a whole naira amount.';

      this.cdr.detectChanges();

      return;

    }


    await this.initializeSchoolFeePayment(
      childFee,
      amount
    );

  }


  // =========================================================
  // INITIALIZE SCHOOL FEE PAYMENT
  // =========================================================

  private async initializeSchoolFeePayment(
    childFee: ChildFee,
    amount: number
  ): Promise<void> {

    if (!this.currentUser) {

      this.errorMessage =
        'Your account session could not be found. Please sign in again.';

      this.cdr.detectChanges();

      return;

    }


    if (!this.selectedChild) {

      this.errorMessage =
        'Please select a student before making a payment.';

      this.cdr.detectChanges();

      return;

    }


    this.paymentLoading = true;

    this.errorMessage = '';

    this.successMessage = '';

    this.selectedPaymentFee =
      childFee;

    this.selectedPaymentAmount =
      amount;


    this.cdr.detectChanges();


    try {

      // -------------------------------------------------------
      // FIREBASE ID TOKEN
      // -------------------------------------------------------

      const token =
        await this.schoolAuth.getIdToken();


      if (!token) {

        throw new Error(
          'Your login session has expired. Please sign in again.'
        );

      }


      // -------------------------------------------------------
      // STUDENT IDENTIFIERS
      // -------------------------------------------------------

      const studentId =
        String(
          this.selectedChild.studentId ||
          ''
        ).trim();


      const studentRecordId =
        String(
          this.selectedChild.id ||
          ''
        ).trim();


      /*
       * Student records may have a Firebase UID stored as
       * "uid" or "studentUid".
       *
       * For a student paying for themselves, the authenticated
       * Firebase UID is also available from currentUser.uid.
       */

      const studentUid =
        String(
          this.selectedChild.uid ||
          (
            this.currentUser.role === 'student'
              ? this.currentUser.uid
              : ''
          ) ||
          ''
        ).trim();


      if (
        !studentId &&
        !studentRecordId &&
        !studentUid
      ) {

        throw new Error(
          'The selected student record could not be identified.'
        );

      }


      // -------------------------------------------------------
      // INITIALIZE PAYMENT
      // -------------------------------------------------------

      const response =
        await fetch(
          `${this.backendUrl}/api/fees/payment/initialize`,
          {

            method:
              'POST',

            headers: {

              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${token}`

            },

            body:
              JSON.stringify({

                feeId:
                  childFee.fee.id,

                amount,

                studentId,

                studentRecordId,

                studentUid

              })

          }
        );


      let result:
        PaymentInitializeResponse;


      try {

        result =
          await response.json();

      } catch {

        throw new Error(
          'The payment server returned an invalid response.'
        );

      }


      if (
        !response.ok ||
        !result?.success
      ) {

        throw new Error(
          result?.message ||
          'Unable to initialize the school fee payment.'
        );

      }


      const authorizationUrl =
        String(
          result.authorizationUrl ||
          ''
        ).trim();


      const reference =
        String(
          result.reference ||
          ''
        ).trim();


      if (!authorizationUrl) {

        throw new Error(
          'Paystack did not return a payment checkout URL.'
        );

      }


      if (!reference) {

        throw new Error(
          'Paystack did not return a payment reference.'
        );

      }


      // -------------------------------------------------------
      // SAVE PAYMENT REFERENCE
      // -------------------------------------------------------

      this.storePendingPayment(
        result.paymentId || '',
        reference,
        childFee.fee.id
      );


      // -------------------------------------------------------
      // REDIRECT TO PAYSTACK
      // -------------------------------------------------------

      window.location.href =
        authorizationUrl;

    } catch (error: any) {

      console.error(
        'School fee payment initialization error:',
        error
      );


      this.paymentLoading = false;


      this.errorMessage =
        error?.message ||
        'Unable to start the online payment. Please try again.';


      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // STORE PENDING PAYMENT
  // =========================================================

  private storePendingPayment(
    paymentId: string,
    reference: string,
    feeId: string
  ): void {

    try {

      sessionStorage.setItem(
        'dlittles_pending_fee_payment',
        JSON.stringify({

          paymentId,

          reference,

          feeId,

          studentId:
            this.selectedChild?.studentId ||
            '',

          createdAt:
            Date.now()

        })
      );

    } catch (error) {

      console.warn(
        'Unable to store pending school fee payment:',
        error
      );

    }

  }


  // =========================================================
  // FORMAT AMOUNT
  // =========================================================

  private formatAmount(
    amount: number
  ): string {

    return Number(
      amount || 0
    ).toLocaleString(
      'en-NG',
      {

        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2

      }
    );

  }


  // =========================================================
  // GO TO DASHBOARD
  // =========================================================

  goToDashboard(): void {

    this.router.navigate([
      '/parent/dashboard'
    ]);

  }

}