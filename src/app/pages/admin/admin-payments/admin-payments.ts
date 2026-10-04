import {
  Component,
  OnInit
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  get,
  push,
  ref,
  remove,
  update
} from 'firebase/database';

import {
  database
} from '../../../core/firebase.config';

import {
  AdminAuthService
} from '../../../core/Auth/admin-auth.service';


// =========================================================
// INTERFACES
// =========================================================

interface Student {
  id: string;
  studentId: string;
  uid?: string;

  firstName: string;
  middleName?: string;
  lastName: string;

  fullName: string;

  classId?: string;
  className?: string;

  parentId?: string;
  parentCode?: string;

  status?: string;
}


interface FeeStructure {
  id: string;

  title: string;
  description?: string;

  classId: string;
  className: string;

  accountNumber?: string;

  items: FeeItem[];

  totalAmount: number;

  status: 'active' | 'inactive';

  createdAt?: number;
  updatedAt?: number;
}


interface FeeItem {
  name: string;
  amount: number;
}


interface Payment {
  id: string;

  studentId: string;
  studentRecordId?: string;
  studentUid?: string;
  parentId?: string;
  studentName: string;

  classId?: string;
  className?: string;

  feeId: string;
  feeTitle: string;

  accountNumber?: string;

  totalFee: number;
  amountPaid: number;
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
    | 'unpaid'
    | 'partially_paid'
    | 'paid';

  notes?: string;

  createdAt: number;
  updatedAt: number;

  createdBy?: string;
  createdByName?: string;
}


// =========================================================
// COMPONENT
// =========================================================

@Component({
  selector: 'app-admin-payments',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './admin-payments.html',

  styleUrls: ['./admin-payments.css']
})
export class AdminPayments implements OnInit {

  // =======================================================
  // DATA
  // =======================================================

  students: Student[] = [];

  fees: FeeStructure[] = [];

  payments: Payment[] = [];

  filteredPayments: Payment[] = [];


  // =======================================================
  // STATE
  // =======================================================

  loading = false;

  saving = false;

  studentsLoading = false;

  feesLoading = false;


  // =======================================================
  // SEARCH / FILTERS
  // =======================================================

  searchTerm = '';

  statusFilter = '';

  paymentMethodFilter = '';


  // =======================================================
  // MODALS
  // =======================================================

  showModal = false;

  showViewModal = false;

  editingPayment: Payment | null = null;

  selectedPayment: Payment | null = null;


  // =======================================================
  // ALERTS
  // =======================================================

  successMessage = '';

  errorMessage = '';


  // =======================================================
  // FORM
  // =======================================================

  form = {
    studentId: '',

    feeId: '',

    amountPaid: 0,

    paymentReference: '',

    paymentMethod:
      'cash' as
        | 'cash'
        | 'bank_transfer'
        | 'pos'
        | 'online'
        | 'other',

    paymentDate: '',

    notes: ''
  };


  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor(
    private adminAuthService: AdminAuthService
  ) {}


  // =======================================================
  // INIT
  // =======================================================

  async ngOnInit(): Promise<void> {

    this.setDefaultPaymentDate();

    await this.loadStudents();

    await this.loadFees();

    await this.loadPayments();

  }


  // =======================================================
  // DEFAULT DATE
  // =======================================================

  private setDefaultPaymentDate(): void {

    const today = new Date();

    const year =
      today.getFullYear();

    const month =
      String(today.getMonth() + 1)
        .padStart(2, '0');

    const day =
      String(today.getDate())
        .padStart(2, '0');

    this.form.paymentDate =
      `${year}-${month}-${day}`;

  }


  // =======================================================
  // LOAD STUDENTS
  // =======================================================

  async loadStudents(): Promise<void> {

    this.studentsLoading = true;

    try {

      const snapshot =
        await get(
          ref(database, 'students')
        );

      if (!snapshot.exists()) {

        this.students = [];

        return;
      }

      const data =
        snapshot.val();

      this.students =
        Object.entries(data)
          .map(
            ([id, value]: [string, any]):
              Student => {

              const firstName =
                value?.firstName ||
                value?.firstname ||
                '';

              const middleName =
                value?.middleName ||
                value?.middlename ||
                '';

              const lastName =
                value?.lastName ||
                value?.lastname ||
                '';

              const fullName =
                value?.fullName ||
                [
                  firstName,
                  middleName,
                  lastName
                ]
                  .filter(Boolean)
                  .join(' ');

              return {

                id,

                studentId:
                  value?.studentId ||
                  id,

                uid:
                  value?.uid ||
                  '',

                firstName,

                middleName,

                lastName,

                fullName,

                classId:
                  value?.classId ||
                  '',

                className:
                  value?.className ||
                  value?.class ||
                  '',

                parentId:
                  value?.parentId ||
                  '',

                parentCode:
                  value?.parentCode ||
                  '',

                status:
                  value?.status ||
                  'active'

              };

            }
          )
          .filter(
            student =>
              student.status !== 'inactive'
          )
          .sort(
            (a, b) =>
              a.fullName.localeCompare(
                b.fullName
              )
          );

    } catch (error) {

      console.error(
        'Error loading students:',
        error
      );

      this.errorMessage =
        'Unable to load students.';

    } finally {

      this.studentsLoading = false;

    }

  }


  // =======================================================
  // LOAD FEE STRUCTURES
  // =======================================================

  async loadFees(): Promise<void> {

    this.feesLoading = true;

    try {

      const snapshot =
        await get(
          ref(database, 'fees')
        );

      if (!snapshot.exists()) {

        this.fees = [];

        return;
      }

      const data =
        snapshot.val();

      this.fees =
        Object.entries(data)
          .map(
            ([id, value]: [string, any]):
              FeeStructure => {

              const items: FeeItem[] =
                Array.isArray(value?.items)
                  ? value.items.map(
                      (item: any):
                        FeeItem => ({
                          name:
                            item?.name || '',

                          amount:
                            Number(
                              item?.amount
                            ) || 0
                        })
                    )
                  : [];

              const status:
                'active' | 'inactive' =
                value?.status === 'inactive'
                  ? 'inactive'
                  : 'active';

              const totalAmount =
                Number(
                  value?.totalAmount
                ) ||
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
                );

              return {

                id,

                title:
                  value?.title || '',

                description:
                  value?.description || '',

                classId:
                  value?.classId || '',

                className:
                  value?.className || '',

                accountNumber:
                  String(
                    value?.accountNumber || ''
                  ),

                items,

                totalAmount,

                status,

                createdAt:
                  Number(
                    value?.createdAt
                  ) || 0,

                updatedAt:
                  Number(
                    value?.updatedAt
                  ) || 0

              };

            }
          )
          .filter(
            fee =>
              fee.status === 'active'
          )
          .sort(
            (a, b) =>
              a.title.localeCompare(
                b.title
              )
          );

    } catch (error) {

      console.error(
        'Error loading fee structures:',
        error
      );

      this.errorMessage =
        'Unable to load fee structures.';

    } finally {

      this.feesLoading = false;

    }

  }


  // =======================================================
  // LOAD PAYMENTS
  // =======================================================

  async loadPayments(): Promise<void> {

    this.loading = true;

    try {

      const snapshot =
        await get(
          ref(database, 'payments')
        );

      if (!snapshot.exists()) {

        this.payments = [];

        this.applyFilters();

        return;
      }

      const data =
        snapshot.val();

      this.payments =
        Object.entries(data)
          .map(
            ([id, value]: [string, any]):
              Payment => {

              const totalFee =
                Number(
                  value?.totalFee
                ) || 0;

              const amountPaid =
                Number(
                  value?.amountPaid
                ) || 0;

              const balance =
                Math.max(
                  totalFee - amountPaid,
                  0
                );

              let status:
                | 'unpaid'
                | 'partially_paid'
                | 'paid';

              if (amountPaid <= 0) {

                status = 'unpaid';

              } else if (
                amountPaid >= totalFee &&
                totalFee > 0
              ) {

                status = 'paid';

              } else {

                status =
                  'partially_paid';

              }

              return {

                id,

                studentId:
                  value?.studentId ||
                  '',

                studentRecordId:
                  value?.studentRecordId ||
                  '',

                studentUid:
                  value?.studentUid ||
                  '',

                parentId:
                  value?.parentId ||
                  '',

                studentName:
                  value?.studentName ||
                  '',

                classId:
                  value?.classId ||
                  '',

                className:
                  value?.className ||
                  '',

                feeId:
                  value?.feeId ||
                  '',

                feeTitle:
                  value?.feeTitle ||
                  '',

                accountNumber:
                  value?.accountNumber ||
                  '',

                totalFee,

                amountPaid,

                balance,

                paymentReference:
                  value?.paymentReference ||
                  '',

                paymentMethod:
                  value?.paymentMethod ||
                  'cash',

                paymentDate:
                  value?.paymentDate ||
                  '',

                status,

                notes:
                  value?.notes ||
                  '',

                createdAt:
                  Number(
                    value?.createdAt
                  ) || 0,

                updatedAt:
                  Number(
                    value?.updatedAt
                  ) || 0,

                createdBy:
                  value?.createdBy ||
                  '',

                createdByName:
                  value?.createdByName ||
                  ''

              };

            }
          )
          .sort(
            (a, b) =>
              b.createdAt -
              a.createdAt
          );

      this.applyFilters();

    } catch (error) {

      console.error(
        'Error loading payments:',
        error
      );

      this.errorMessage =
        'Unable to load payment records.';

    } finally {

      this.loading = false;

    }

  }


  // =======================================================
  // FILTER PAYMENTS
  // =======================================================

  applyFilters(): void {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();

    this.filteredPayments =
      this.payments.filter(
        payment => {

          const matchesSearch =
            !search ||
            payment.studentName
              .toLowerCase()
              .includes(search) ||

            payment.studentId
              .toLowerCase()
              .includes(search) ||

            payment.feeTitle
              .toLowerCase()
              .includes(search) ||

            payment.paymentReference
              .toLowerCase()
              .includes(search);

          const matchesStatus =
            !this.statusFilter ||
            payment.status ===
              this.statusFilter;

          const matchesMethod =
            !this.paymentMethodFilter ||
            payment.paymentMethod ===
              this.paymentMethodFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesMethod
          );

        }
      );

  }


  // =======================================================
  // SELECTED STUDENT
  // =======================================================

  get selectedStudent(): Student | null {

    if (!this.form.studentId) {

      return null;
    }

    return (
      this.students.find(
        student =>
          student.studentId ===
          this.form.studentId
      ) || null
    );

  }


  // =======================================================
  // SELECTED FEE
  // =======================================================

  get selectedFee(): FeeStructure | null {

    if (!this.form.feeId) {

      return null;
    }

    return (
      this.fees.find(
        fee =>
          fee.id ===
          this.form.feeId
      ) || null
    );

  }


  // =======================================================
  // TOTAL FEE
  // =======================================================

  get totalFee(): number {

    return (
      this.selectedFee?.totalAmount ||
      0
    );

  }


  // =======================================================
  // CURRENT BALANCE
  // =======================================================

  get currentBalance(): number {

    return Math.max(
      this.totalFee -
      Number(
        this.form.amountPaid || 0
      ),
      0
    );

  }


  // =======================================================
  // PAYMENT STATUS
  // =======================================================

  get paymentStatus():
    | 'unpaid'
    | 'partially_paid'
    | 'paid' {

    const paid =
      Number(
        this.form.amountPaid
      ) || 0;

    if (paid <= 0) {

      return 'unpaid';

    }

    if (
      paid >= this.totalFee &&
      this.totalFee > 0
    ) {

      return 'paid';

    }

    return 'partially_paid';

  }


  // =======================================================
  // OPEN CREATE MODAL
  // =======================================================

  openCreateModal(): void {

    this.editingPayment = null;

    this.clearMessages();

    this.form = {

      studentId: '',

      feeId: '',

      amountPaid: 0,

      paymentReference: '',

      paymentMethod: 'cash',

      paymentDate: '',

      notes: ''

    };

    this.setDefaultPaymentDate();

    this.showModal = true;

  }


  // =======================================================
  // OPEN EDIT MODAL
  // =======================================================

  openEditModal(
    payment: Payment
  ): void {

    this.editingPayment =
      payment;

    this.clearMessages();

    this.form = {

      studentId:
        payment.studentId,

      feeId:
        payment.feeId,

      amountPaid:
        payment.amountPaid,

      paymentReference:
        payment.paymentReference,

      paymentMethod:
        payment.paymentMethod,

      paymentDate:
        payment.paymentDate,

      notes:
        payment.notes || ''

    };

    this.showModal = true;

  }


  // =======================================================
  // CLOSE MODAL
  // =======================================================

  closeModal(): void {

    if (this.saving) {

      return;
    }

    this.showModal = false;

    this.editingPayment = null;

  }


  // =======================================================
  // VIEW PAYMENT
  // =======================================================

  viewPayment(
    payment: Payment
  ): void {

    this.selectedPayment =
      payment;

    this.showViewModal = true;

  }


  // =======================================================
  // CLOSE VIEW MODAL
  // =======================================================

  closeViewModal(): void {

    this.showViewModal = false;

    this.selectedPayment = null;

  }


  // =======================================================
  // SAVE PAYMENT
  // =======================================================

  async savePayment(): Promise<void> {

    this.clearMessages();

    if (!this.form.studentId) {

      this.errorMessage =
        'Please select a student.';

      return;
    }

    if (!this.form.feeId) {

      this.errorMessage =
        'Please select a fee structure.';

      return;
    }

    if (!this.form.paymentDate) {

      this.errorMessage =
        'Please select a payment date.';

      return;
    }

    const amountPaid =
      Number(
        this.form.amountPaid
      ) || 0;

    if (amountPaid < 0) {

      this.errorMessage =
        'Payment amount cannot be negative.';

      return;
    }

    if (this.totalFee <= 0) {

      this.errorMessage =
        'The selected fee structure has no valid amount.';

      return;
    }

    if (amountPaid > this.totalFee) {

      this.errorMessage =
        'Payment cannot be greater than the total fee.';

      return;
    }

    const student =
      this.students.find(
        item =>
          item.studentId ===
          this.form.studentId
      );

    const fee =
      this.fees.find(
        item =>
          item.id ===
          this.form.feeId
      );

    if (!student) {

      this.errorMessage =
        'Selected student could not be found.';

      return;
    }

    if (!fee) {

      this.errorMessage =
        'Selected fee structure could not be found.';

      return;
    }

    if (!student.parentId) {

      this.errorMessage =
        'This student is not linked to a parent account.';

      return;
    }

    this.saving = true;

    try {

      const now =
        Date.now();

      const balance =
        Math.max(
          fee.totalAmount -
          amountPaid,
          0
        );

      let status:
        | 'unpaid'
        | 'partially_paid'
        | 'paid';

      if (amountPaid <= 0) {

        status = 'unpaid';

      } else if (
        amountPaid >= fee.totalAmount
      ) {

        status = 'paid';

      } else {

        status =
          'partially_paid';

      }

      const adminUser =
        this.adminAuthService.getUser();

      const adminName =
        adminUser?.displayName ||
        adminUser?.email ||
        'Administrator';

      const basePayment = {

        studentId:
          student.studentId,

        studentRecordId:
          student.id,

        studentUid:
          student.uid || '',

        parentId:
          student.parentId || '',

        studentName:
          student.fullName,

        classId:
          student.classId ||
          fee.classId ||
          '',

        className:
          student.className ||
          fee.className ||
          '',

        feeId:
          fee.id,

        feeTitle:
          fee.title,

        accountNumber:
          fee.accountNumber || '',

        totalFee:
          fee.totalAmount,

        amountPaid,

        balance,

        paymentReference:
          this.form.paymentReference
            .trim(),

        paymentMethod:
          this.form.paymentMethod,

        paymentDate:
          this.form.paymentDate,

        status,

        notes:
          this.form.notes.trim(),

        updatedAt:
          now,

        createdBy:
          adminUser?.uid || '',

        createdByName:
          adminName

      };


      // ===================================================
      // UPDATE EXISTING PAYMENT
      // ===================================================

      if (this.editingPayment) {

        await update(
          ref(
            database,
            `payments/${this.editingPayment.id}`
          ),
          basePayment
        );

        this.successMessage =
          'Payment updated successfully.';

      }


      // ===================================================
      // CREATE PAYMENT
      // ===================================================

      else {

        const paymentRef =
          push(
            ref(
              database,
              'payments'
            )
          );

        await update(
          paymentRef,
          {
            ...basePayment,

            createdAt:
              now
          }
        );

        this.successMessage =
          'Payment recorded successfully.';

      }

      this.showModal = false;

      this.editingPayment = null;

      await this.loadPayments();

    } catch (error) {

      console.error(
        'Error saving payment:',
        error
      );

      this.errorMessage =
        'Unable to save payment. Please try again.';

    } finally {

      this.saving = false;

    }

  }


  // =======================================================
  // DELETE PAYMENT
  // =======================================================

  async deletePayment(
    payment: Payment
  ): Promise<void> {

    const confirmed =
      window.confirm(
        `Delete the payment of ${this.formatCurrency(payment.amountPaid)} for ${payment.studentName}?`
      );

    if (!confirmed) {

      return;
    }

    this.clearMessages();

    try {

      await remove(
        ref(
          database,
          `payments/${payment.id}`
        )
      );

      this.successMessage =
        'Payment deleted successfully.';

      await this.loadPayments();

    } catch (error) {

      console.error(
        'Error deleting payment:',
        error
      );

      this.errorMessage =
        'Unable to delete payment. Please try again.';

    }

  }


  // =======================================================
  // STATISTICS
  // =======================================================

  get totalPayments(): number {

    return this.payments.length;

  }


  get totalCollected(): number {

    return this.payments.reduce(
      (
        total,
        payment
      ) =>
        total +
        payment.amountPaid,
      0
    );

  }


  get totalOutstanding(): number {

    return this.payments.reduce(
      (
        total,
        payment
      ) =>
        total +
        payment.balance,
      0
    );

  }


  get paidCount(): number {

    return this.payments.filter(
      payment =>
        payment.status ===
        'paid'
    ).length;

  }


  get partiallyPaidCount(): number {

    return this.payments.filter(
      payment =>
        payment.status ===
        'partially_paid'
    ).length;

  }


  get unpaidCount(): number {

    return this.payments.filter(
      payment =>
        payment.status ===
        'unpaid'
    ).length;

  }


  // =======================================================
  // FORMAT CURRENCY
  // =======================================================

  formatCurrency(
    amount: number
  ): string {

    return new Intl.NumberFormat(
      'en-NG',
      {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2
      }
    ).format(
      Number(amount) || 0
    );

  }


  // =======================================================
  // FORMAT DATE
  // =======================================================

  formatDate(
    date: string | number
  ): string {

    if (!date) {

      return '—';
    }

    const parsedDate =
      typeof date === 'number'
        ? new Date(date)
        : new Date(
            `${date}T00:00:00`
          );

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {

      return '—';
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


  // =======================================================
  // STATUS LABEL
  // =======================================================

  getStatusLabel(
    status:
      | 'unpaid'
      | 'partially_paid'
      | 'paid'
  ): string {

    switch (status) {

      case 'paid':
        return 'Paid';

      case 'partially_paid':
        return 'Partially Paid';

      case 'unpaid':
        return 'Unpaid';

      default:
        return status;

    }

  }


  // =======================================================
  // PAYMENT METHOD LABEL
  // =======================================================

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
        return method || '—';

    }

  }


  // =======================================================
  // TRACK BY
  // =======================================================

  trackByPaymentId(
    index: number,
    payment: Payment
  ): string {

    return payment.id;

  }


  // =======================================================
  // CLEAR MESSAGES
  // =======================================================

  clearMessages(): void {

    this.successMessage = '';

    this.errorMessage = '';

  }

}