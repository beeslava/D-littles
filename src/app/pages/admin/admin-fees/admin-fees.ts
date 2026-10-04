import {
  Component,
  OnInit,
  ChangeDetectorRef
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

interface FeeItem {
  name: string;
  amount: number;
}

interface SchoolFee {
  id: string;
  title: string;
  description: string;
  classId: string;
  className: string;
  accountNumber: string;
  items: FeeItem[];
  totalAmount: number;
  status: 'active' | 'inactive';
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  createdByName?: string;
}

interface SchoolClass {
  id: string;
  name: string;
  section?: string;
  level?: string;
  status?: string;
}


// =========================================================
// COMPONENT
// =========================================================

@Component({
  selector: 'app-admin-fees',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './admin-fees.html',
  styleUrls: ['./admin-fees.css']
})
export class AdminFees implements OnInit {

  // =======================================================
  // DATA
  // =======================================================

  fees: SchoolFee[] = [];

  filteredFees: SchoolFee[] = [];

  classes: SchoolClass[] = [];


  // =======================================================
  // UI STATE
  // =======================================================

  loading = false;

  saving = false;

  showModal = false;

  editingFee: SchoolFee | null = null;

  selectedFee: SchoolFee | null = null;

  showViewModal = false;


  // =======================================================
  // SEARCH / FILTER
  // =======================================================

  searchTerm = '';

  statusFilter = 'all';

  classFilter = 'all';


  // =======================================================
  // MESSAGES
  // =======================================================

  successMessage = '';

  errorMessage = '';


  // =======================================================
  // FORM
  // =======================================================

  form = {
    title: '',
    description: '',
    classId: '',
    accountNumber: '',
    status: 'active' as 'active' | 'inactive'
  };


  feeItems: FeeItem[] = [];


  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor(
    private adminAuthService: AdminAuthService,
    private cdr: ChangeDetectorRef
  ) {}


  // =======================================================
  // INIT
  // =======================================================

  async ngOnInit(): Promise<void> {

    await this.loadClasses();

    await this.loadFees();

  }


  // =======================================================
  // LOAD CLASSES
  // =======================================================

  async loadClasses(): Promise<void> {

    try {

      const snapshot = await get(
        ref(database, 'classes')
      );

      if (!snapshot.exists()) {

        this.classes = [];

        return;
      }

      const data = snapshot.val();

      this.classes = Object.entries(data)
        .map(([id, value]: [string, any]): SchoolClass => {

          return {
            id,

            name:
              value.name ||
              value.className ||
              value.title ||
              id,

            section:
              value.section ||
              value.category ||
              '',

            level:
              value.level ||
              '',

            status:
              value.status ||
              'active'
          };

        })
        .filter(
          classItem =>
            classItem.status !== 'inactive'
        )
        .sort(
          (a, b) =>
            a.name.localeCompare(b.name)
        );

    } catch (error) {

      console.error(
        'Error loading classes:',
        error
      );

      this.errorMessage =
        'Unable to load school classes.';

    }

  }


  // =======================================================
  // LOAD FEES
  // =======================================================

  async loadFees(): Promise<void> {

    this.loading = true;

    this.clearMessages();

    try {

      const snapshot = await get(
        ref(database, 'fees')
      );

      if (!snapshot.exists()) {

        this.fees = [];

        this.applyFilters();

        return;
      }

      const data = snapshot.val();

      this.fees = Object.entries(data)
        .map(([id, value]: [string, any]): SchoolFee => {

          const items: FeeItem[] =
            Array.isArray(value.items)
              ? value.items.map(
                  (item: any): FeeItem => ({
                    name:
                      item?.name || '',

                    amount:
                      Number(item?.amount) || 0
                  })
                )
              : [];

          const feeStatus:
            'active' | 'inactive' =
            value?.status === 'inactive'
              ? 'inactive'
              : 'active';

          const totalAmount =
            Number(value?.totalAmount) ||
            items.reduce(
              (
                total: number,
                item: FeeItem
              ) =>
                total +
                Number(item.amount || 0),
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

            status:
              feeStatus,

            createdAt:
              Number(value?.createdAt) || 0,

            updatedAt:
              Number(value?.updatedAt) || 0,

            createdBy:
              value?.createdBy || '',

            createdByName:
              value?.createdByName || ''

          };

        })
        .sort(
          (a, b) =>
            b.updatedAt - a.updatedAt
        );

      this.applyFilters();

    } catch (error) {

      console.error(
        'Error loading school fees:',
        error
      );

      this.errorMessage =
        'Unable to load school fees.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // FILTER
  // =======================================================

  applyFilters(): void {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();

    this.filteredFees =
      this.fees.filter(
        (fee: SchoolFee) => {

          const matchesSearch =
            !search ||
            fee.title
              .toLowerCase()
              .includes(search) ||
            fee.className
              .toLowerCase()
              .includes(search) ||
            fee.description
              .toLowerCase()
              .includes(search) ||
            fee.accountNumber
              .toLowerCase()
              .includes(search);

          const matchesStatus =
            this.statusFilter === 'all' ||
            fee.status === this.statusFilter;

          const matchesClass =
            this.classFilter === 'all' ||
            fee.classId === this.classFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesClass
          );

        }
      );

  }


  // =======================================================
  // CURRENCY
  // =======================================================

  formatCurrency(amount: number): string {

    return new Intl.NumberFormat(
      'en-NG',
      {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2
      }
    ).format(amount || 0);

  }


  // =======================================================
  // TOTAL
  // =======================================================

  get totalAmount(): number {

    return this.feeItems.reduce(
      (
        total: number,
        item: FeeItem
      ) =>
        total +
        (Number(item.amount) || 0),
      0
    );

  }


  // =======================================================
  // ADD FEE ITEM
  // =======================================================

  addFeeItem(): void {

    this.feeItems.push({
      name: '',
      amount: 0
    });

  }


  // =======================================================
  // REMOVE FEE ITEM
  // =======================================================

  removeFeeItem(index: number): void {

    if (
      index < 0 ||
      index >= this.feeItems.length
    ) {

      return;

    }

    this.feeItems.splice(index, 1);

  }


  // =======================================================
  // OPEN CREATE MODAL
  // =======================================================

  openCreateModal(): void {

    this.editingFee = null;

    this.form = {

      title: '',

      description: '',

      classId: '',

      accountNumber: '',

      status: 'active'

    };

    this.feeItems = [

      {
        name: 'Tuition Fee',
        amount: 0
      }

    ];

    this.clearMessages();

    this.showModal = true;

    this.cdr.detectChanges();

  }


  // =======================================================
  // OPEN EDIT MODAL
  // =======================================================

  openEditModal(
    fee: SchoolFee
  ): void {

    this.editingFee = fee;

    this.form = {

      title:
        fee.title,

      description:
        fee.description,

      classId:
        fee.classId,

      accountNumber:
        fee.accountNumber || '',

      status:
        fee.status

    };

    this.feeItems =
      fee.items.map(
        (item: FeeItem): FeeItem => ({
          name: item.name,
          amount: item.amount
        })
      );

    if (
      this.feeItems.length === 0
    ) {

      this.feeItems.push({
        name: '',
        amount: 0
      });

    }

    this.clearMessages();

    this.showModal = true;

    this.cdr.detectChanges();

  }


  // =======================================================
  // CLOSE FORM MODAL
  // =======================================================

  closeModal(): void {

    if (this.saving) {

      return;

    }

    this.showModal = false;

    this.editingFee = null;

  }


  // =======================================================
  // GET CLASS NAME
  // =======================================================

  getSelectedClassName(): string {

    const selected =
      this.classes.find(
        (item: SchoolClass) =>
          item.id === this.form.classId
      );

    return selected?.name || '';

  }


  // =======================================================
  // SAVE FEE
  // =======================================================

  async saveFee(): Promise<void> {

    this.clearMessages();

    const title =
      this.form.title.trim();

    if (!title) {

      this.errorMessage =
        'Please enter a fee title.';

      return;

    }

    if (!this.form.classId) {

      this.errorMessage =
        'Please select a class.';

      return;

    }

    const validItems: FeeItem[] =
      this.feeItems
        .filter(
          (item: FeeItem) =>
            item.name.trim() &&
            Number(item.amount) > 0
        )
        .map(
          (item: FeeItem): FeeItem => ({
            name:
              item.name.trim(),

            amount:
              Number(item.amount)
          })
        );

    if (
      validItems.length === 0
    ) {

      this.errorMessage =
        'Please add at least one fee item with a valid amount.';

      return;

    }

    this.saving = true;

    try {

      const currentUser =
        this.adminAuthService.getUser();

      const now =
        Date.now();

      const className =
        this.getSelectedClassName();

      const totalAmount =
        validItems.reduce(
          (
            total: number,
            item: FeeItem
          ) =>
            total + item.amount,
          0
        );

      const accountNumber =
        this.form.accountNumber.trim();


      // ===================================================
      // CREATE
      // ===================================================

      if (!this.editingFee) {

        const feesRef =
          ref(database, 'fees');

        const newFeeRef =
          push(feesRef);

        const feeId =
          newFeeRef.key || '';

        const feeData = {

          id: feeId,

          title,

          description:
            this.form.description.trim(),

          classId:
            this.form.classId,

          className,

          accountNumber,

          items:
            validItems,

          totalAmount,

          status:
            this.form.status,

          createdAt:
            now,

          updatedAt:
            now,

          createdBy:
            currentUser?.uid || '',

          createdByName:
            currentUser?.displayName ||
            currentUser?.email ||
            'Administrator'

        };

        await update(
          newFeeRef,
          feeData
        );

        this.successMessage =
          'School fee structure created successfully.';

      }


      // ===================================================
      // EDIT
      // ===================================================

      else {

        const feeRef =
          ref(
            database,
            `fees/${this.editingFee.id}`
          );

        const updatedData = {

          title,

          description:
            this.form.description.trim(),

          classId:
            this.form.classId,

          className,

          accountNumber,

          items:
            validItems,

          totalAmount,

          status:
            this.form.status,

          updatedAt:
            now

        };

        await update(
          feeRef,
          updatedData
        );

        this.successMessage =
          'School fee structure updated successfully.';

      }


      this.showModal = false;

      this.editingFee = null;

      await this.loadFees();

    } catch (error) {

      console.error(
        'Error saving school fee:',
        error
      );

      this.errorMessage =
        'Unable to save the school fee. Please try again.';

    } finally {

      this.saving = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // VIEW FEE
  // =======================================================

  viewFee(
    fee: SchoolFee
  ): void {

    this.selectedFee = fee;

    this.showViewModal = true;

    this.clearMessages();

  }


  // =======================================================
  // CLOSE VIEW MODAL
  // =======================================================

  closeViewModal(): void {

    this.showViewModal = false;

    this.selectedFee = null;

  }


  // =======================================================
  // TOGGLE STATUS
  // =======================================================

  async toggleStatus(
    fee: SchoolFee
  ): Promise<void> {

    this.clearMessages();

    try {

      const newStatus:
        'active' | 'inactive' =
        fee.status === 'active'
          ? 'inactive'
          : 'active';

      await update(
        ref(
          database,
          `fees/${fee.id}`
        ),
        {

          status:
            newStatus,

          updatedAt:
            Date.now()

        }
      );

      this.successMessage =
        newStatus === 'active'
          ? 'Fee structure activated.'
          : 'Fee structure deactivated.';

      await this.loadFees();

    } catch (error) {

      console.error(
        'Error changing fee status:',
        error
      );

      this.errorMessage =
        'Unable to change fee status.';

    }

  }


  // =======================================================
  // DELETE
  // =======================================================

  async deleteFee(
    fee: SchoolFee
  ): Promise<void> {

    this.clearMessages();

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${fee.title}" for ${fee.className}?`
      );

    if (!confirmed) {

      return;

    }

    try {

      await remove(
        ref(
          database,
          `fees/${fee.id}`
        )
      );

      this.successMessage =
        'School fee structure deleted successfully.';

      if (
        this.selectedFee?.id === fee.id
      ) {

        this.closeViewModal();

      }

      await this.loadFees();

    } catch (error) {

      console.error(
        'Error deleting school fee:',
        error
      );

      this.errorMessage =
        'Unable to delete the school fee.';

    }

  }


  // =======================================================
  // STATISTICS
  // =======================================================

  get totalFeeStructures(): number {

    return this.fees.length;

  }


  get activeFeeStructures(): number {

    return this.fees.filter(
      (fee: SchoolFee) =>
        fee.status === 'active'
    ).length;

  }


  get inactiveFeeStructures(): number {

    return this.fees.filter(
      (fee: SchoolFee) =>
        fee.status === 'inactive'
    ).length;

  }


  get totalConfiguredAmount(): number {

    return this.fees.reduce(
      (
        total: number,
        fee: SchoolFee
      ) =>
        total +
        Number(fee.totalAmount || 0),
      0
    );

  }


  // =======================================================
  // DATE
  // =======================================================

  formatDate(
    timestamp: number
  ): string {

    if (!timestamp) {

      return '—';

    }

    return new Intl.DateTimeFormat(
      'en-NG',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    ).format(
      new Date(timestamp)
    );

  }


  // =======================================================
  // CLEAR MESSAGES
  // =======================================================

  clearMessages(): void {

    this.successMessage = '';

    this.errorMessage = '';

  }


  // =======================================================
  // TRACK BY
  // =======================================================

  trackByFeeId(
    index: number,
    fee: SchoolFee
  ): string {

    return fee.id;

  }


  trackByItem(
    index: number,
    item: FeeItem
  ): number {

    return index;

  }

}