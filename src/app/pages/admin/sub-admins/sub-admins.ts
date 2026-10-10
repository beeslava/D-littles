import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  HttpClient,
  HttpHeaders
} from '@angular/common/http';

import { firstValueFrom } from 'rxjs';

import {
  AdminAuthService,
  AdminPermission
} from '../../../core/Auth/admin-auth.service';


// =========================================================
// INTERFACES
// =========================================================

interface SubAdmin {
  uid: string;
  subAdminId: string;
  fullName: string;
  email: string;
  phone?: string;

  role: 'subadmin';

  status: 'active' | 'inactive';

  permissions: Partial<
    Record<AdminPermission, boolean>
  >;

  createdAt?: number;
  updatedAt?: number;
}


interface SubAdminCredentials {
  uid?: string;
  subAdminId: string;
  email: string;
  temporaryPassword: string;
}


interface ApiResponse {
  success?: boolean;
  message?: string;

  subAdmins?: SubAdmin[];

  subAdmin?: SubAdmin;

  credentials?: {
    uid?: string;
    subAdminId?: string;
    email?: string;
    temporaryPassword?: string;
    password?: string;
  };

  data?: {
    subAdmins?: SubAdmin[];

    subAdmin?: SubAdmin;

    credentials?: {
      uid?: string;
      subAdminId?: string;
      email?: string;
      temporaryPassword?: string;
      password?: string;
    };

    [key: string]: any;
  };

  [key: string]: any;
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
  // DATA
  // =======================================================

  subAdmins: SubAdmin[] = [];

  selectedSubAdmin: SubAdmin | null = null;

  credentials: SubAdminCredentials | null = null;


  // =======================================================
  // UI STATE
  // =======================================================

  loading = false;

  saving = false;

  disabling = false;

  deleting = false;

  errorMessage = '';

  successMessage = '';

  searchTerm = '';

  statusFilter:
    | 'all'
    | 'active'
    | 'inactive' = 'all';


  showFormModal = false;

  showCredentialsModal = false;

  isEditMode = false;


  // =======================================================
  // FORM
  // =======================================================

  form = {
    fullName: '',

    phone: '',

    permissions:
      this.createDefaultPermissions(),

    status:
      'active' as 'active' | 'inactive'
  };


  // =======================================================
  // PERMISSION LIST
  // =======================================================

  readonly permissionList: Array<{
    key: Exclude<AdminPermission, 'dashboard'>;
    label: string;
    icon: string;
  }> = [

    {
      key: 'admissions',
      label: 'Admissions',
      icon: 'fas fa-user-plus'
    },

    {
      key: 'students',
      label: 'Students',
      icon: 'fas fa-user-graduate'
    },

    {
      key: 'parents',
      label: 'Parents & Guardians',
      icon: 'fas fa-users'
    },

    {
      key: 'staff',
      label: 'Teachers & Staff',
      icon: 'fas fa-chalkboard-teacher'
    },

    {
      key: 'classes',
      label: 'Classes',
      icon: 'fas fa-school'
    },

    {
      key: 'subjects',
      label: 'Subjects',
      icon: 'fas fa-book'
    },

    {
      key: 'teachingAssignments',
      label: 'Teaching Assignments',
      icon: 'fas fa-tasks'
    },

    {
      key: 'academics',
      label: 'Academics',
      icon: 'fas fa-graduation-cap'
    },

    {
      key: 'results',
      label: 'Results',
      icon: 'fas fa-chart-bar'
    },

    {
      key: 'attendance',
      label: 'Attendance',
      icon: 'fas fa-calendar-check'
    },

    {
      key: 'messages',
      label: 'Messages',
      icon: 'fas fa-envelope'
    },

    {
      key: 'fees',
      label: 'School Fees',
      icon: 'fas fa-money-bill-wave'
    },

    {
      key: 'payments',
      label: 'Payments',
      icon: 'fas fa-credit-card'
    },

    {
      key: 'news',
      label: 'News',
      icon: 'fas fa-newspaper'
    },

    {
      key: 'events',
      label: 'Events',
      icon: 'fas fa-calendar-alt'
    },

    {
      key: 'gallery',
      label: 'Gallery',
      icon: 'fas fa-images'
    }
  ];


  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor(
    private readonly http: HttpClient,
    private readonly adminAuthService: AdminAuthService,
    private readonly cdr: ChangeDetectorRef
  ) {}


  // =======================================================
  // INIT
  // =======================================================

  async ngOnInit(): Promise<void> {

    await this.loadSubAdmins();

    this.detectChanges();
  }


  // =======================================================
  // MANUAL CHANGE DETECTION
  // =======================================================

  private detectChanges(): void {

    try {

      this.cdr.detectChanges();

    } catch (error) {

      console.warn(
        'Change detection refresh skipped:',
        error
      );
    }
  }


  // =======================================================
  // DEFAULT PERMISSIONS
  // =======================================================

  private createDefaultPermissions(): Partial<
    Record<AdminPermission, boolean>
  > {

    return {

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
  }


  // =======================================================
  // AUTH HEADERS
  // =======================================================

  private async getHeaders(): Promise<HttpHeaders> {

    const user =
      this.adminAuthService.getUser();

    if (!user) {

      throw new Error(
        'You are not authenticated.'
      );
    }

    const token =
      await user.getIdToken(true);

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }


  // =======================================================
  // LOAD SUB ADMINS
  // =======================================================

  async loadSubAdmins(): Promise<void> {

    this.loading = true;

    this.clearMessages();

    this.detectChanges();

    try {

      const headers =
        await this.getHeaders();

      const response =
        await firstValueFrom(
          this.http.get<ApiResponse>(
            this.API_URL,
            { headers }
          )
        );

      this.subAdmins =
        response.subAdmins ??
        response.data?.subAdmins ??
        [];

      console.log(
        'Sub-admins loaded:',
        this.subAdmins
      );

    } catch (error: any) {

      console.error(
        'Unable to load sub-admins:',
        error
      );

      this.errorMessage =
        this.getErrorMessage(
          error,
          'Unable to load sub-admins.'
        );

    } finally {

      this.loading = false;

      this.detectChanges();
    }
  }


  // =======================================================
  // SILENT REFRESH
  // =======================================================

  private async refreshSubAdminsSilently(): Promise<void> {

    try {

      const headers =
        await this.getHeaders();

      const response =
        await firstValueFrom(
          this.http.get<ApiResponse>(
            this.API_URL,
            { headers }
          )
        );

      this.subAdmins =
        response.subAdmins ??
        response.data?.subAdmins ??
        [];

      this.detectChanges();

    } catch (error) {

      console.error(
        'Silent sub-admin refresh failed:',
        error
      );
    }
  }


  // =======================================================
  // CREATE MODAL
  // =======================================================

  openCreateModal(): void {

    this.isEditMode = false;

    this.selectedSubAdmin = null;

    this.credentials = null;

    this.form = {

      fullName: '',

      phone: '',

      permissions:
        this.createDefaultPermissions(),

      status: 'active'
    };

    this.clearMessages();

    this.showFormModal = true;

    this.detectChanges();
  }


  // =======================================================
  // EDIT MODAL
  // =======================================================

  openEditModal(
    subAdmin: SubAdmin
  ): void {

    this.isEditMode = true;

    this.selectedSubAdmin =
      subAdmin;

    this.form = {

      fullName:
        subAdmin.fullName ?? '',

      phone:
        subAdmin.phone ?? '',

      permissions: {

        ...this.createDefaultPermissions(),

        ...(subAdmin.permissions ?? {})
      },

      status:
        subAdmin.status === 'inactive'
          ? 'inactive'
          : 'active'
    };

    this.clearMessages();

    this.showFormModal = true;

    this.detectChanges();
  }


  // =======================================================
  // CLOSE FORM MODAL
  // =======================================================

  closeFormModal(): void {

    if (this.saving) {
      return;
    }

    this.showFormModal = false;

    this.selectedSubAdmin = null;

    this.detectChanges();
  }


  // =======================================================
  // SAVE SUB ADMIN
  // =======================================================

  async saveSubAdmin(): Promise<void> {

    const fullName =
      this.form.fullName.trim();

    if (!fullName) {

      this.errorMessage =
        'Please enter the sub-admin full name.';

      this.detectChanges();

      return;
    }

    this.saving = true;

    this.errorMessage = '';

    this.successMessage = '';

    this.detectChanges();

    try {

      const headers =
        await this.getHeaders();

      if (this.isEditMode) {

        await this.updateSubAdmin(
          headers
        );

      } else {

        await this.createSubAdmin(
          headers
        );
      }

    } catch (error: any) {

      console.error(
        'Save sub-admin error:',
        error
      );

      this.errorMessage =
        this.getErrorMessage(
          error,
          'Unable to save sub-admin.'
        );

    } finally {

      this.saving = false;

      this.detectChanges();
    }
  }


  // =======================================================
  // CREATE SUB ADMIN
  // =======================================================

  private async createSubAdmin(
    headers: HttpHeaders
  ): Promise<void> {

    const payload = {

      fullName:
        this.form.fullName.trim(),

      phone:
        this.form.phone.trim(),

      permissions:
        this.form.permissions
    };


    const response =
      await firstValueFrom(
        this.http.post<ApiResponse>(
          `${this.API_URL}/create`,
          payload,
          { headers }
        )
      );


    const extractedCredentials =
      this.extractCredentials(
        response
      );


    if (
      !extractedCredentials ||
      !extractedCredentials.temporaryPassword
    ) {

      console.error(
        'Sub-admin creation response did not contain credentials.'
      );

      throw new Error(
        'The sub-admin account was created, but the temporary password was not returned by the server.'
      );
    }


    this.credentials =
      extractedCredentials;


    this.showFormModal = false;

    this.showCredentialsModal = true;


    this.successMessage =
      response.message ??
      'Sub-admin created successfully.';


    await this.refreshSubAdminsSilently();

    this.detectChanges();
  }


  // =======================================================
  // UPDATE SUB ADMIN
  // =======================================================

  private async updateSubAdmin(
    headers: HttpHeaders
  ): Promise<void> {

    if (!this.selectedSubAdmin) {

      throw new Error(
        'No sub-admin selected.'
      );
    }


    const payload = {

      fullName:
        this.form.fullName.trim(),

      phone:
        this.form.phone.trim(),

      permissions:
        this.form.permissions,

      status:
        this.form.status
    };


    const response =
      await firstValueFrom(
        this.http.put<ApiResponse>(
          `${this.API_URL}/${this.selectedSubAdmin.uid}`,
          payload,
          { headers }
        )
      );


    this.showFormModal = false;

    this.selectedSubAdmin = null;


    this.successMessage =
      response.message ??
      'Sub-admin updated successfully.';


    await this.loadSubAdmins();

    this.detectChanges();
  }


  // =======================================================
  // TOGGLE STATUS
  // =======================================================
  //
  // ACTIVE  -> DEACTIVATE
  // INACTIVE -> REACTIVATE
  //
  // IMPORTANT:
  //
  // Status changes use PUT.
  //
  // Permanent deletion uses DELETE
  // through deleteSubAdmin().
  //
  // =======================================================

  async toggleStatus(
    subAdmin: SubAdmin
  ): Promise<void> {

    if (
      this.disabling ||
      this.deleting
    ) {

      return;
    }


    if (!subAdmin?.uid) {

      this.errorMessage =
        'Invalid Sub Admin account.';

      this.detectChanges();

      return;
    }


    const isActive =
      subAdmin.status === 'active';


    const action =
      isActive
        ? 'deactivate'
        : 'reactivate';


    const confirmed =
      window.confirm(

        isActive

          ? `Deactivate ${subAdmin.fullName}'s Sub Admin account?\n\n` +

            `Sub Admin ID: ${subAdmin.subAdminId}\n` +

            `Email: ${subAdmin.email}\n\n` +

            `The account will no longer be able to sign in, ` +

            `but the account and permissions will be preserved.\n\n` +

            `You can reactivate it later.`

          : `Reactivate ${subAdmin.fullName}'s Sub Admin account?\n\n` +

            `They will be able to sign in again and use their assigned permissions.`
      );


    if (!confirmed) {
      return;
    }


    this.disabling = true;

    this.clearMessages();

    this.detectChanges();


    try {

      const headers =
        await this.getHeaders();


      const response =
        await firstValueFrom(
          this.http.put<ApiResponse>(
            `${this.API_URL}/${subAdmin.uid}`,
            {
              status:
                action === 'deactivate'
                  ? 'inactive'
                  : 'active'
            },
            { headers }
          )
        );


      this.successMessage =
        response.message ??
        (
          action === 'deactivate'

            ? `${subAdmin.fullName}'s Sub Admin account was deactivated successfully.`

            : `${subAdmin.fullName}'s Sub Admin account was reactivated successfully.`
        );


      await this.loadSubAdmins();

    } catch (error: any) {

      console.error(
        `${action} sub-admin error:`,
        error
      );

      this.errorMessage =
        this.getErrorMessage(
          error,

          action === 'deactivate'

            ? 'Unable to deactivate Sub Admin account.'

            : 'Unable to reactivate Sub Admin account.'
        );

    } finally {

      this.disabling = false;

      this.detectChanges();
    }
  }


  // =======================================================
  // PERMANENTLY DELETE SUB ADMIN
  // =======================================================
  //
  // DELETE endpoint permanently removes:
  //
  // 1. Firebase Authentication account
  // 2. users/{uid}
  // 3. subAdmins/{uid}
  //
  // This is NOT deactivation.
  //
  // =======================================================

  async deleteSubAdmin(
    subAdmin: SubAdmin
  ): Promise<void> {

    if (
      this.deleting ||
      this.disabling
    ) {

      return;
    }


    if (!subAdmin?.uid) {

      this.errorMessage =
        'Invalid Sub Admin account.';

      this.detectChanges();

      return;
    }


    const confirmed =
      window.confirm(

        `PERMANENTLY DELETE ${subAdmin.fullName}'s Sub Admin account?\n\n` +

        `Sub Admin ID: ${subAdmin.subAdminId}\n` +

        `Email: ${subAdmin.email}\n\n` +

        `WARNING: This action cannot be undone.\n\n` +

        `The Firebase login account, user record, Sub Admin record, ` +

        `permissions and account data will be permanently deleted.\n\n` +

        `Click OK only if you are absolutely sure.`
      );


    if (!confirmed) {
      return;
    }


    this.deleting = true;

    this.clearMessages();

    this.detectChanges();


    try {

      const headers =
        await this.getHeaders();


      const response =
        await firstValueFrom(
          this.http.delete<ApiResponse>(
            `${this.API_URL}/${subAdmin.uid}`,
            { headers }
          )
        );


      // Remove immediately from the current UI list.
      this.subAdmins =
        this.subAdmins.filter(
          item =>
            item.uid !== subAdmin.uid
        );


      this.selectedSubAdmin = null;


      this.successMessage =
        response.message ??
        `${subAdmin.fullName}'s Sub Admin account was permanently deleted.`;


      this.detectChanges();


      // Refresh from backend to make sure
      // the displayed list matches production data.
      await this.refreshSubAdminsSilently();


    } catch (error: any) {

      console.error(
        'Permanent sub-admin deletion error:',
        error
      );


      this.errorMessage =
        this.getErrorMessage(
          error,
          'Unable to permanently delete Sub Admin account.'
        );

    } finally {

      this.deleting = false;

      this.detectChanges();
    }
  }


  // =======================================================
  // CLOSE CREDENTIALS MODAL
  // =======================================================

  closeCredentialsModal(): void {

    this.showCredentialsModal =
      false;

    this.credentials = null;

    this.detectChanges();
  }


  // =======================================================
  // COPY ALL CREDENTIALS
  // =======================================================

  async copyCredentials(): Promise<void> {

    if (!this.credentials) {
      return;
    }


    const text = [

      `D Little Private School`,

      `Sub Admin ID: ${this.credentials.subAdminId}`,

      `Email: ${this.credentials.email}`,

      `Temporary Password: ${this.credentials.temporaryPassword}`

    ].join('\n');


    await this.copyText(text);


    this.successMessage =
      'Credentials copied successfully.';

    this.detectChanges();
  }


  // =======================================================
  // COPY SINGLE VALUE
  // =======================================================

  async copySingleValue(
    value: string,
    label: string
  ): Promise<void> {

    if (!value) {
      return;
    }


    await this.copyText(value);


    this.successMessage =
      `${label} copied successfully.`;

    this.detectChanges();
  }


  // =======================================================
  // CLIPBOARD
  // =======================================================

  private async copyText(
    text: string
  ): Promise<void> {

    try {

      await navigator.clipboard.writeText(
        text
      );

    } catch {

      const textarea =
        document.createElement(
          'textarea'
        );

      textarea.value = text;

      textarea.style.position =
        'fixed';

      textarea.style.opacity =
        '0';

      document.body.appendChild(
        textarea
      );

      textarea.select();

      document.execCommand(
        'copy'
      );

      textarea.remove();
    }
  }


  // =======================================================
  // SELECT ALL PERMISSIONS
  // =======================================================

  selectAllPermissions(): void {

    for (
      const permission
      of this.permissionList
    ) {

      this.form.permissions[
        permission.key
      ] = true;
    }

    this.detectChanges();
  }


  // =======================================================
  // CLEAR ALL PERMISSIONS
  // =======================================================

  clearAllPermissions(): void {

    for (
      const permission
      of this.permissionList
    ) {

      this.form.permissions[
        permission.key
      ] = false;
    }

    this.detectChanges();
  }


  // =======================================================
  // CHECK PERMISSION
  // =======================================================

  hasPermission(
    permission: AdminPermission
  ): boolean {

    return (
      this.form.permissions[
        permission
      ] === true
    );
  }


  // =======================================================
  // PERMISSION COUNT
  // =======================================================

  getPermissionCount(
    subAdmin: SubAdmin
  ): number {

    return Object.values(
      subAdmin.permissions ?? {}
    ).filter(
      value => value === true
    ).length;
  }


  // =======================================================
  // FILTERED SUB ADMINS
  // =======================================================

  get filteredSubAdmins(): SubAdmin[] {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    return this.subAdmins.filter(
      subAdmin => {

        const fullName =
          String(
            subAdmin.fullName ?? ''
          ).toLowerCase();

        const subAdminId =
          String(
            subAdmin.subAdminId ?? ''
          ).toLowerCase();

        const email =
          String(
            subAdmin.email ?? ''
          ).toLowerCase();

        const phone =
          String(
            subAdmin.phone ?? ''
          ).toLowerCase();


        const matchesSearch =
          !search ||
          fullName.includes(search) ||
          subAdminId.includes(search) ||
          email.includes(search) ||
          phone.includes(search);


        const matchesStatus =
          this.statusFilter === 'all' ||
          subAdmin.status ===
            this.statusFilter;


        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );
  }


  // =======================================================
  // COUNTS
  // =======================================================

  get totalCount(): number {

    return this.subAdmins.length;
  }


  get activeCount(): number {

    return this.subAdmins.filter(
      subAdmin =>
        subAdmin.status === 'active'
    ).length;
  }


  get inactiveCount(): number {

    return this.subAdmins.filter(
      subAdmin =>
        subAdmin.status === 'inactive'
    ).length;
  }


  // =======================================================
  // CLEAR MESSAGES
  // =======================================================

  private clearMessages(): void {

    this.errorMessage = '';

    this.successMessage = '';
  }


  // =======================================================
  // ERROR MESSAGE
  // =======================================================

  private getErrorMessage(
    error: any,
    fallback: string
  ): string {

    if (
      error?.error?.message &&
      typeof error.error.message === 'string'
    ) {

      return error.error.message;
    }


    if (
      error?.message &&
      typeof error.message === 'string'
    ) {

      return error.message;
    }


    if (
      typeof error?.error === 'string'
    ) {

      return error.error;
    }


    return fallback;
  }


  // =======================================================
  // EXTRACT CREDENTIALS
  // =======================================================

  private extractCredentials(
    response: ApiResponse
  ): SubAdminCredentials | null {

    const credentials =
      response.credentials ??
      response.data?.credentials;


    if (!credentials) {
      return null;
    }


    const subAdminId =
      credentials.subAdminId ??
      '';


    const email =
      credentials.email ??
      '';


    const temporaryPassword =
      credentials.temporaryPassword ??
      credentials.password ??
      '';


    if (
      !subAdminId ||
      !email ||
      !temporaryPassword
    ) {

      return null;
    }


    return {

      uid:
        credentials.uid ??
        '',

      subAdminId,

      email,

      temporaryPassword
    };
  }
}