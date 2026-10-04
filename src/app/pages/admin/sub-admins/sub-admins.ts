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
  AdminAuthService,
  AdminPermission
} from '../../../core/Auth/admin-auth.service';


// =========================================================
// TYPES
// =========================================================

interface SubAdmin {
  uid: string;

  subAdminId?: string;

  fullName?: string;

  email?: string;

  phone?: string;

  role?: 'subadmin';

  status?: string;

  permissions?: Partial<
    Record<AdminPermission, boolean>
  >;

  createdAt?: number;

  updatedAt?: number;
}


interface PermissionItem {
  key: AdminPermission;

  label: string;

  description: string;
}


interface ApiResponse {
  success?: boolean;

  message?: string;

  error?: string;

  subAdmin?: SubAdmin;

  subAdmins?: SubAdmin[];

  data?: any;

  credentials?: {
    uid?: string;
    subAdminId?: string;
    email?: string;
    password?: string;
  };
}


// =========================================================
// COMPONENT
// =========================================================

@Component({
  selector: 'app-sub-admins',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './sub-admins.html',

  styleUrl: './sub-admins.css'
})
export class SubAdmins implements OnInit {


  // =======================================================
  // API
  // =======================================================

  private readonly API_URL =
    'https://d-littles.onrender.com/api/subadmins';


  // =======================================================
  // STATE
  // =======================================================

  subAdmins: SubAdmin[] = [];

  filteredSubAdmins: SubAdmin[] = [];

  loading = false;

  saving = false;

  deleting = false;


  // =======================================================
  // SEARCH
  // =======================================================

  searchTerm = '';


  // =======================================================
  // MODALS
  // =======================================================

  showCreateModal = false;

  showEditModal = false;

  showCredentialsModal = false;

  showDeleteModal = false;


  // =======================================================
  // SELECTED SUB ADMIN
  // =======================================================

  selectedSubAdmin: SubAdmin | null = null;


  // =======================================================
  // CREDENTIALS
  // =======================================================

  generatedCredentials = {
    uid: '',
    subAdminId: '',
    email: '',
    password: ''
  };


  // =======================================================
  // FORM
  // =======================================================

  form = {
    fullName: '',
    phone: '',
    permissions: {} as Partial<
      Record<AdminPermission, boolean>
    >
  };


  // =======================================================
  // PERMISSIONS
  // =======================================================

  readonly permissionItems: PermissionItem[] = [

    {
      key: 'admissions',

      label: 'Admissions',

      description:
        'Manage admission applications and admission processing.'
    },

    {
      key: 'students',

      label: 'Students',

      description:
        'View and manage student records.'
    },

    {
      key: 'parents',

      label: 'Parents & Guardians',

      description:
        'View and manage parent and guardian records.'
    },

    {
      key: 'staff',

      label: 'Teachers & Staff',

      description:
        'Manage teachers and other staff records.'
    },

    {
      key: 'classes',

      label: 'Classes',

      description:
        'Manage school classes and class information.'
    },

    {
      key: 'subjects',

      label: 'Subjects',

      description:
        'Manage subjects and subject information.'
    },

    {
      key: 'teachingAssignments',

      label: 'Teaching Assignments',

      description:
        'Manage staff teaching assignments.'
    },

    {
      key: 'academics',

      label: 'Academics',

      description:
        'Access academic administration.'
    },

    {
      key: 'results',

      label: 'Results',

      description:
        'Manage student results and report cards.'
    },

    {
      key: 'attendance',

      label: 'Attendance',

      description:
        'Manage student and staff attendance.'
    },

    {
      key: 'messages',

      label: 'Messages',

      description:
        'Manage school administration messages.'
    },

    {
      key: 'fees',

      label: 'School Fees',

      description:
        'Manage school fee structures and fee records.'
    },

    {
      key: 'payments',

      label: 'Payments',

      description:
        'View and manage school payment records.'
    },

    {
      key: 'news',

      label: 'News',

      description:
        'Manage school news and announcements.'
    },

    {
      key: 'events',

      label: 'Events',

      description:
        'Manage school events.'
    },

    {
      key: 'gallery',

      label: 'Gallery',

      description:
        'Manage school gallery content.'
    }

  ];


  // =======================================================
  // DEFAULT PERMISSIONS
  // =======================================================

  private readonly defaultPermissions:
    Partial<Record<AdminPermission, boolean>> = {

      admissions: true,

      students: true,

      parents: true,

      staff: false,

      classes: true,

      subjects: true,

      teachingAssignments: true,

      academics: true,

      results: true,

      attendance: true,

      messages: true,

      fees: true,

      payments: true,

      news: false,

      events: false,

      gallery: false

    };


  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor(
    private readonly adminAuthService:
      AdminAuthService
  ) {}


  // =======================================================
  // INIT
  // =======================================================

  async ngOnInit(): Promise<void> {

    const isAdmin =
      await this.adminAuthService.isAdmin();

    if (!isAdmin) {

      return;

    }

    await this.loadSubAdmins();

  }


  // =======================================================
  // LOAD SUB ADMINS
  // =======================================================

  async loadSubAdmins(): Promise<void> {

    this.loading = true;

    try {

      const response =
        await this.apiRequest(
          '',
          'GET'
        ) as ApiResponse;


      const records =
        response.subAdmins ||
        response.data ||
        [];


      this.subAdmins =
        Array.isArray(records)
          ? records
          : [];


      this.applySearch();

    } catch (error) {

      console.error(
        'Error loading Sub Admins:',
        error
      );

      this.showError(
        this.getErrorMessage(
          error,
          'Unable to load Sub Admin accounts.'
        )
      );

    } finally {

      this.loading = false;

    }

  }


  // =======================================================
  // SEARCH
  // =======================================================

  onSearch(): void {

    this.applySearch();

  }


  applySearch(): void {

    const term =
      this.searchTerm
        .trim()
        .toLowerCase();


    if (!term) {

      this.filteredSubAdmins =
        [...this.subAdmins];

      return;

    }


    this.filteredSubAdmins =
      this.subAdmins.filter(
        (subAdmin) => {

          return (

            String(
              subAdmin.fullName || ''
            )
              .toLowerCase()
              .includes(term)

            ||

            String(
              subAdmin.subAdminId || ''
            )
              .toLowerCase()
              .includes(term)

            ||

            String(
              subAdmin.email || ''
            )
              .toLowerCase()
              .includes(term)

            ||

            String(
              subAdmin.phone || ''
            )
              .toLowerCase()
              .includes(term)

            ||

            String(
              subAdmin.status || ''
            )
              .toLowerCase()
              .includes(term)

          );

        }
      );

  }


  // =======================================================
  // CREATE MODAL
  // =======================================================

  openCreateModal(): void {

    this.resetForm();

    this.showCreateModal = true;

  }


  closeCreateModal(): void {

    if (this.saving) {

      return;

    }

    this.showCreateModal = false;

  }


  // =======================================================
  // RESET FORM
  // =======================================================

  resetForm(): void {

    this.form = {

      fullName: '',

      phone: '',

      permissions: {
        ...this.defaultPermissions
      }

    };

  }


  // =======================================================
  // TOGGLE PERMISSION
  // =======================================================

  togglePermission(
    permission: AdminPermission
  ): void {

    this.form.permissions[permission] =
      !this.form.permissions[permission];

  }


  // =======================================================
  // CHECK PERMISSION
  // =======================================================

  hasFormPermission(
    permission: AdminPermission
  ): boolean {

    return (
      this.form.permissions[permission] === true
    );

  }


  // =======================================================
  // SELECT ALL
  // =======================================================

  selectAllPermissions(): void {

    for (
      const item of this.permissionItems
    ) {

      this.form.permissions[item.key] =
        true;

    }

  }


  // =======================================================
  // CLEAR ALL
  // =======================================================

  clearAllPermissions(): void {

    for (
      const item of this.permissionItems
    ) {

      this.form.permissions[item.key] =
        false;

    }

  }


  // =======================================================
  // CREATE SUB ADMIN
  // =======================================================

  async createSubAdmin(): Promise<void> {

    if (this.saving) {

      return;

    }


    const fullName =
      this.form.fullName.trim();


    if (!fullName) {

      this.showError(
        'Please enter the Sub Admin full name.'
      );

      return;

    }


    this.saving = true;


    try {

      const response =
        await this.apiRequest(
          '/create',
          'POST',
          {

            fullName,

            phone:
              this.form.phone.trim(),

            permissions:
              this.form.permissions

          }
        ) as ApiResponse;


      if (
        response.success === false
      ) {

        throw new Error(
          response.message ||
          response.error ||
          'Unable to create Sub Admin.'
        );

      }


      const credentials =
        response.credentials ||
        {};


      this.generatedCredentials = {

        uid:
          credentials.uid ||
          response.subAdmin?.uid ||
          '',

        subAdminId:
          credentials.subAdminId ||
          response.subAdmin?.subAdminId ||
          '',

        email:
          credentials.email ||
          response.subAdmin?.email ||
          '',

        password:
          credentials.password ||
          ''

      };


      this.showCreateModal = false;

      this.showCredentialsModal = true;


      await this.loadSubAdmins();


      this.showSuccess(
        'Sub Admin account created successfully.'
      );

    } catch (error) {

      console.error(
        'Error creating Sub Admin:',
        error
      );

      this.showError(
        this.getErrorMessage(
          error,
          'Unable to create Sub Admin account.'
        )
      );

    } finally {

      this.saving = false;

    }

  }


  // =======================================================
  // EDIT
  // =======================================================

  openEditModal(
    subAdmin: SubAdmin
  ): void {

    this.selectedSubAdmin =
      subAdmin;


    this.form = {

      fullName:
        subAdmin.fullName || '',

      phone:
        subAdmin.phone || '',

      permissions: {

        ...this.defaultPermissions,

        ...(subAdmin.permissions || {})

      }

    };


    this.showEditModal = true;

  }


  closeEditModal(): void {

    if (this.saving) {

      return;

    }

    this.showEditModal = false;

    this.selectedSubAdmin = null;

  }


  // =======================================================
  // UPDATE
  // =======================================================

  async updateSubAdmin(): Promise<void> {

    if (
      this.saving ||
      !this.selectedSubAdmin
    ) {

      return;

    }


    const fullName =
      this.form.fullName.trim();


    if (!fullName) {

      this.showError(
        'Please enter the Sub Admin full name.'
      );

      return;

    }


    this.saving = true;


    try {

      const response =
        await this.apiRequest(
          `/${encodeURIComponent(
            this.selectedSubAdmin.uid
          )}`,
          'PUT',
          {

            fullName,

            phone:
              this.form.phone.trim(),

            permissions:
              this.form.permissions

          }
        ) as ApiResponse;


      if (
        response.success === false
      ) {

        throw new Error(
          response.message ||
          response.error ||
          'Unable to update Sub Admin.'
        );

      }


      this.showEditModal = false;

      this.selectedSubAdmin = null;


      await this.loadSubAdmins();


      this.showSuccess(
        'Sub Admin updated successfully.'
      );

    } catch (error) {

      console.error(
        'Error updating Sub Admin:',
        error
      );

      this.showError(
        this.getErrorMessage(
          error,
          'Unable to update Sub Admin.'
        )
      );

    } finally {

      this.saving = false;

    }

  }


  // =======================================================
  // DELETE / DEACTIVATE MODAL
  // =======================================================

  openDeleteModal(
    subAdmin: SubAdmin
  ): void {

    this.selectedSubAdmin =
      subAdmin;

    this.showDeleteModal = true;

  }


  closeDeleteModal(): void {

    if (this.deleting) {

      return;

    }

    this.showDeleteModal = false;

    this.selectedSubAdmin = null;

  }


  // =======================================================
  // DEACTIVATE
  // =======================================================

  async deactivateSubAdmin(): Promise<void> {

    if (
      this.deleting ||
      !this.selectedSubAdmin
    ) {

      return;

    }


    this.deleting = true;


    try {

      const response =
        await this.apiRequest(
          `/${encodeURIComponent(
            this.selectedSubAdmin.uid
          )}`,
          'DELETE'
        ) as ApiResponse;


      if (
        response.success === false
      ) {

        throw new Error(
          response.message ||
          response.error ||
          'Unable to deactivate Sub Admin.'
        );

      }


      this.showDeleteModal = false;

      this.selectedSubAdmin = null;


      await this.loadSubAdmins();


      this.showSuccess(
        'Sub Admin account deactivated successfully.'
      );

    } catch (error) {

      console.error(
        'Error deactivating Sub Admin:',
        error
      );

      this.showError(
        this.getErrorMessage(
          error,
          'Unable to deactivate Sub Admin.'
        )
      );

    } finally {

      this.deleting = false;

    }

  }


  // =======================================================
  // REACTIVATE
  // =======================================================

  async reactivateSubAdmin(
    subAdmin: SubAdmin
  ): Promise<void> {

    if (this.saving) {

      return;

    }


    const confirmed =
      window.confirm(
        `Reactivate ${subAdmin.fullName || 'this Sub Admin'}?`
      );


    if (!confirmed) {

      return;

    }


    this.saving = true;


    try {

      const response =
        await this.apiRequest(
          `/${encodeURIComponent(
            subAdmin.uid
          )}`,
          'PUT',
          {

            fullName:
              subAdmin.fullName || '',

            phone:
              subAdmin.phone || '',

            permissions:
              subAdmin.permissions || {},

            status:
              'active'

          }
        ) as ApiResponse;


      if (
        response.success === false
      ) {

        throw new Error(
          response.message ||
          response.error ||
          'Unable to reactivate Sub Admin.'
        );

      }


      await this.loadSubAdmins();


      this.showSuccess(
        'Sub Admin account reactivated successfully.'
      );

    } catch (error) {

      console.error(
        'Error reactivating Sub Admin:',
        error
      );

      this.showError(
        this.getErrorMessage(
          error,
          'Unable to reactivate Sub Admin.'
        )
      );

    } finally {

      this.saving = false;

    }

  }


  // =======================================================
  // CREDENTIALS
  // =======================================================

  closeCredentialsModal(): void {

    this.showCredentialsModal = false;

  }


  // =======================================================
  // COPY CREDENTIAL
  // =======================================================

  async copyText(
    value: string
  ): Promise<void> {

    if (!value) {

      return;

    }


    try {

      await navigator.clipboard.writeText(
        value
      );

      this.showSuccess(
        'Copied to clipboard.'
      );

    } catch (error) {

      console.error(
        'Clipboard error:',
        error
      );

      this.showError(
        'Unable to copy to clipboard.'
      );

    }

  }


  // =======================================================
  // FORMAT DATE
  // =======================================================

  formatDate(
    timestamp?: number
  ): string {

    if (!timestamp) {

      return '—';

    }


    return new Intl.DateTimeFormat(
      'en-NG',
      {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    ).format(
      new Date(timestamp)
    );

  }


  // =======================================================
  // STATUS
  // =======================================================

  isActive(
    subAdmin: SubAdmin
  ): boolean {

    return (
      subAdmin.status === 'active'
    );

  }


  // =======================================================
  // PERMISSION COUNT
  // =======================================================

  permissionCount(
    subAdmin: SubAdmin
  ): number {

    const permissions =
      subAdmin.permissions || {};


    return Object.values(
      permissions
    ).filter(
      value => value === true
    ).length;

  }


  // =======================================================
  // API REQUEST
  // =======================================================

  private async apiRequest(
    endpoint: string,
    method: string,
    body?: any
  ): Promise<any> {

    const user =
      this.adminAuthService.getUser();


    if (!user) {

      throw new Error(
        'Your administrator session has expired. Please log in again.'
      );

    }


    const token =
      await user.getIdToken();


    const options: RequestInit = {

      method,

      headers: {

        'Authorization':
          `Bearer ${token}`,

        'Content-Type':
          'application/json'

      }

    };


    if (
      body !== undefined &&
      method !== 'GET'
    ) {

      options.body =
        JSON.stringify(body);

    }


    const response =
      await fetch(
        `${this.API_URL}${endpoint}`,
        options
      );


    let result: any = null;


    try {

      result =
        await response.json();

    } catch {

      result = null;

    }


    if (!response.ok) {

      throw new Error(
        result?.message ||
        result?.error ||
        `Request failed with status ${response.status}.`
      );

    }


    return result;

  }


  // =======================================================
  // ERROR MESSAGE
  // =======================================================

  private getErrorMessage(
    error: unknown,
    fallback: string
  ): string {

    if (error instanceof Error) {

      return error.message;

    }


    if (
      typeof error === 'string'
    ) {

      return error;

    }


    return fallback;

  }


  // =======================================================
  // SUCCESS MESSAGE
  // =======================================================

  private showSuccess(
    message: string
  ): void {

    window.alert(message);

  }


  // =======================================================
  // ERROR MESSAGE
  // =======================================================

  private showError(
    message: string
  ): void {

    window.alert(message);

  }

}