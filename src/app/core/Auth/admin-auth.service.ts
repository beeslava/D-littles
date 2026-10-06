import { Injectable } from '@angular/core';

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

import {
  get,
  ref
} from 'firebase/database';

import { auth, database } from '../firebase.config';


// =========================================================
// SUB ADMIN PERMISSIONS
// =========================================================

export type AdminPermission =
  | 'dashboard'
  | 'admissions'
  | 'students'
  | 'parents'
  | 'staff'
  | 'classes'
  | 'subjects'
  | 'teachingAssignments'
  | 'academics'
  | 'results'
  | 'attendance'
  | 'messages'
  | 'fees'
  | 'payments'
  | 'news'
  | 'events'
  | 'gallery';


// =========================================================
// ADMIN USER DATA
// =========================================================

export interface AdminUserData {

  uid: string;

  fullName?: string;

  email?: string;

  phone?: string;

  role: 'admin' | 'subadmin';

  status?: string;

  subAdminId?: string;

  permissions?: Partial<
    Record<AdminPermission, boolean>
  >;

  createdAt?: number;

  updatedAt?: number;

}


// =========================================================
// SERVICE
// =========================================================

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {

  private currentUser: User | null = null;

  private currentUserData:
    AdminUserData | null = null;

  /**
   * Keeps track of whether Firebase has finished
   * restoring the authentication session.
   */
  private authReady = false;

  /**
   * Promise used by the route guard to wait for
   * Firebase authentication to initialize.
   */
  private authReadyPromise: Promise<User | null>;


  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor() {

    this.authReadyPromise =
      new Promise((resolve) => {

        onAuthStateChanged(
          auth,
          async (user) => {

            this.currentUser =
              user;

            /**
             * Load the administrator/sub-admin
             * RTDB record when Firebase restores
             * an existing session.
             */
            if (user) {

              try {

                await this.loadUserData(
                  user.uid
                );

              } catch (error) {

                console.error(
                  'Error loading administrator profile:',
                  error
                );

                this.currentUserData =
                  null;

              }

            } else {

              this.currentUserData =
                null;

            }

            this.authReady =
              true;

            resolve(user);

          }
        );

      });

  }


  // =======================================================
  // GET FIREBASE USER
  // =======================================================

  /**
   * Get currently signed-in Firebase user.
   */
  getUser(): User | null {

    return this.currentUser;

  }


  // =======================================================
  // GET ADMIN PROFILE
  // =======================================================

  /**
   * Get the currently authenticated administrator
   * or sub-administrator profile.
   */
  getUserData(): AdminUserData | null {

    return this.currentUserData;

  }


  // =======================================================
  // LOAD USER DATA
  // =======================================================

  private async loadUserData(
    uid: string
  ): Promise<AdminUserData | null> {

    const userRef =
      ref(
        database,
        `users/${uid}`
      );

    const snapshot =
      await get(userRef);


    if (!snapshot.exists()) {

      this.currentUserData =
        null;

      return null;

    }


    const data =
      snapshot.val();


    if (
      data?.role !== 'admin' &&
      data?.role !== 'subadmin'
    ) {

      this.currentUserData =
        null;

      return null;

    }


    const userData:
      AdminUserData = {

        uid,

        fullName:
          data.fullName,

        email:
          data.email,

        phone:
          data.phone,

        role:
          data.role,

        status:
          data.status,

        subAdminId:
          data.subAdminId,

        permissions:
          data.permissions,

        createdAt:
          data.createdAt,

        updatedAt:
          data.updatedAt,

      };


    // =====================================================
    // LOAD SUB ADMIN RECORD
    // =====================================================

    if (
      data.role === 'subadmin'
    ) {

      const subAdminRef =
        ref(
          database,
          `subAdmins/${uid}`
        );

      const subAdminSnapshot =
        await get(subAdminRef);


      if (
        subAdminSnapshot.exists()
      ) {

        const subAdminData =
          subAdminSnapshot.val();


        userData.permissions =
          subAdminData.permissions ||
          {};

        userData.status =
          subAdminData.status ||
          data.status;

        userData.subAdminId =
          subAdminData.subAdminId ||
          data.subAdminId;

        userData.fullName =
          subAdminData.fullName ||
          data.fullName;

        userData.email =
          subAdminData.email ||
          data.email;

        userData.phone =
          subAdminData.phone ||
          data.phone;

      }

    }


    this.currentUserData =
      userData;


    return userData;

  }


  // =======================================================
  // NORMALIZE ADMIN LOGIN
  // =======================================================
  //
  // Supports:
  //
  // Main Admin:
  //     admin@example.com
  //
  // Sub Admin:
  //     DL-SA-254337
  //
  // becomes:
  //
  //     dl-sa-254337@admin.dlittles.com
  //
  // =======================================================

  private normalizeLoginEmail(
    loginValue: string
  ): string {

    const value =
      loginValue
        .trim();


    if (!value) {

      throw new Error(
        'Admin email or Sub Admin ID is required.'
      );

    }


    // =====================================================
    // SUB ADMIN ID
    // =====================================================

    if (
      value
        .toUpperCase()
        .startsWith('DL-SA-')
    ) {

      return (
        `${value.toLowerCase()}@admin.dlittles.com`
      );

    }


    // =====================================================
    // NORMAL ADMIN EMAIL
    // =====================================================

    return value.toLowerCase();

  }


  // =======================================================
  // LOGIN
  // =======================================================

  /**
   * Administrator / Sub Admin login.
   *
   * Accepts either:
   *
   * 1. Main Admin email
   * 2. Sub Admin ID
   */
  async login(
    emailOrSubAdminId: string,
    password: string
  ): Promise<User> {


    // =====================================================
    // VALIDATE LOGIN VALUE
    // =====================================================

    const loginEmail =
      this.normalizeLoginEmail(
        emailOrSubAdminId
      );


    // =====================================================
    // VALIDATE PASSWORD
    // =====================================================

    if (!password) {

      throw new Error(
        'Password is required.'
      );

    }


    // =====================================================
    // FIREBASE AUTHENTICATION
    // =====================================================

    const credential =
      await signInWithEmailAndPassword(
        auth,
        loginEmail,
        password
      );


    const user =
      credential.user;


    // =====================================================
    // LOAD USER RECORD
    // =====================================================

    const userRef =
      ref(
        database,
        `users/${user.uid}`
      );

    const snapshot =
      await get(userRef);


    if (!snapshot.exists()) {

      await signOut(auth);

      this.currentUser =
        null;

      this.currentUserData =
        null;

      throw new Error(
        'This account is not authorized as an administrator.'
      );

    }


    const userData =
      snapshot.val();


    // =====================================================
    // CHECK ROLE
    // =====================================================

    if (
      userData.role !== 'admin' &&
      userData.role !== 'subadmin'
    ) {

      await signOut(auth);

      this.currentUser =
        null;

      this.currentUserData =
        null;

      throw new Error(
        'This account does not have administrator access.'
      );

    }


    // =====================================================
    // MAIN ADMIN STATUS
    // =====================================================

    if (
      userData.role === 'admin' &&
      userData.status === 'inactive'
    ) {

      await signOut(auth);

      this.currentUser =
        null;

      this.currentUserData =
        null;

      throw new Error(
        'This administrator account is inactive.'
      );

    }


    // =====================================================
    // SUB ADMIN CHECK
    // =====================================================

    if (
      userData.role === 'subadmin'
    ) {

      const subAdminRef =
        ref(
          database,
          `subAdmins/${user.uid}`
        );

      const subAdminSnapshot =
        await get(subAdminRef);


      if (
        !subAdminSnapshot.exists()
      ) {

        await signOut(auth);

        this.currentUser =
          null;

        this.currentUserData =
          null;

        throw new Error(
          'This Sub Admin account is not properly configured.'
        );

      }


      const subAdminData =
        subAdminSnapshot.val();


      if (
        subAdminData.status !== 'active'
      ) {

        await signOut(auth);

        this.currentUser =
          null;

        this.currentUserData =
          null;

        throw new Error(
          'This Sub Admin account is inactive.'
        );

      }

    }


    // =====================================================
    // SAVE CURRENT USER
    // =====================================================

    this.currentUser =
      user;


    await this.loadUserData(
      user.uid
    );


    return user;

  }


  // =======================================================
  // LOGOUT
  // =======================================================

  /**
   * Administrator logout.
   */
  async logout(): Promise<void> {

    await signOut(auth);

    this.currentUser =
      null;

    this.currentUserData =
      null;

  }


  // =======================================================
  // WAIT FOR AUTH
  // =======================================================

  private async getAuthenticatedUser():
    Promise<User | null> {

    let user: User | null;


    if (!this.authReady) {

      user =
        await this.authReadyPromise;

    } else {

      user =
        auth.currentUser ||
        this.currentUser;

    }


    if (user) {

      this.currentUser =
        user;

    }


    return user;

  }


  // =======================================================
  // IS MAIN ADMIN
  // =======================================================

  /**
   * Returns true ONLY for the main administrator.
   *
   * A Sub Admin will return false here.
   */
  async isAdmin(): Promise<boolean> {

    const user =
      await this.getAuthenticatedUser();


    if (!user) {

      return false;

    }


    if (
      this.currentUserData?.role === 'admin' &&
      this.currentUserData.status !== 'inactive'
    ) {

      return true;

    }


    try {

      const userRef =
        ref(
          database,
          `users/${user.uid}`
        );

      const snapshot =
        await get(userRef);


      if (!snapshot.exists()) {

        return false;

      }


      const userData =
        snapshot.val();


      const allowed =
        userData?.role === 'admin' &&
        userData?.status !== 'inactive';


      if (allowed) {

        this.currentUserData = {

          uid:
            user.uid,

          fullName:
            userData.fullName,

          email:
            userData.email,

          phone:
            userData.phone,

          role:
            'admin',

          status:
            userData.status,

          createdAt:
            userData.createdAt,

          updatedAt:
            userData.updatedAt,

        };

      }


      return allowed;

    } catch (error) {

      console.error(
        'Error checking administrator access:',
        error
      );

      return false;

    }

  }


  // =======================================================
  // IS SUB ADMIN
  // =======================================================

  /**
   * Returns true for an active Sub Admin.
   */
  async isSubAdmin(): Promise<boolean> {

    const user =
      await this.getAuthenticatedUser();


    if (!user) {

      return false;

    }


    if (
      this.currentUserData?.role !== 'subadmin'
    ) {

      return false;

    }


    if (
      this.currentUserData.status === 'inactive'
    ) {

      return false;

    }


    try {

      const subAdminRef =
        ref(
          database,
          `subAdmins/${user.uid}`
        );

      const snapshot =
        await get(subAdminRef);


      if (!snapshot.exists()) {

        return false;

      }


      const subAdminData =
        snapshot.val();


      return (
        subAdminData?.status === 'active'
      );

    } catch (error) {

      console.error(
        'Error checking Sub Admin access:',
        error
      );

      return false;

    }

  }


  // =======================================================
  // IS ADMIN OR SUB ADMIN
  // =======================================================

  /**
   * Returns true for:
   *
   * - Main Admin
   * - Active Sub Admin
   */
  async isAdminOrSubAdmin(): Promise<boolean> {

    const user =
      await this.getAuthenticatedUser();


    if (!user) {

      return false;

    }


    if (
      await this.isAdmin()
    ) {

      return true;

    }


    return await this.isSubAdmin();

  }


  // =======================================================
  // CHECK PERMISSION
  // =======================================================

  /**
   * Check whether the current account has
   * a particular administrator permission.
   *
   * Main Admin automatically has every permission.
   */
  async hasPermission(
    permission: AdminPermission
  ): Promise<boolean> {

    const user =
      await this.getAuthenticatedUser();


    if (!user) {

      return false;

    }


    // =====================================================
    // MAIN ADMIN
    // =====================================================

    if (
      await this.isAdmin()
    ) {

      return true;

    }


    // =====================================================
    // SUB ADMIN
    // =====================================================

    if (
      !(await this.isSubAdmin())
    ) {

      return false;

    }


    // =====================================================
    // DASHBOARD
    // =====================================================

    if (
      permission === 'dashboard'
    ) {

      /**
       * Every active Sub Admin can access
       * the administration dashboard.
       */
      return true;

    }


    // =====================================================
    // PERMISSION RECORD
    // =====================================================

    const permissions =
      this.currentUserData?.permissions;


    if (!permissions) {

      return false;

    }


    return (
      permissions[permission] === true
    );

  }


  // =======================================================
  // GET PERMISSIONS
  // =======================================================

  /**
   * Returns the current Sub Admin permission object.
   *
   * Main Admin receives all permissions as true.
   */
  async getPermissions():
    Promise<
      Partial<Record<AdminPermission, boolean>>
    > {

    const isAdmin =
      await this.isAdmin();


    if (isAdmin) {

      return {

        dashboard: true,

        admissions: true,

        students: true,

        parents: true,

        staff: true,

        classes: true,

        subjects: true,

        teachingAssignments: true,

        academics: true,

        results: true,

        attendance: true,

        messages: true,

        fees: true,

        payments: true,

        news: true,

        events: true,

        gallery: true,

      };

    }


    return (
      this.currentUserData?.permissions ||
      {}
    );

  }

}