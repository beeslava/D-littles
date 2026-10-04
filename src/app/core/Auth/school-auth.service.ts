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

import {
  auth,
  database
} from '../firebase.config';


// =========================================================
// SCHOOL USER
// =========================================================

export interface SchoolUser {

  uid: string;

  fullName: string;

  email: string;

  role: string;

  phone?: string;

  studentId?: string;

  parentId?: string;

  staffId?: string;

  status?: string;

}


// =========================================================
// SCHOOL AUTH SERVICE
// =========================================================

@Injectable({
  providedIn: 'root'
})
export class SchoolAuthService {


  // =========================================================
  // CURRENT FIREBASE USER
  // =========================================================

  private currentUser: User | null = null;


  // =========================================================
  // CURRENT SCHOOL USER DATA
  // =========================================================

  private currentUserData: SchoolUser | null = null;


  // =========================================================
  // AUTH INITIALIZATION
  // =========================================================

  private authReady: Promise<void>;


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor() {

    this.authReady =
      new Promise<void>((resolve) => {

        onAuthStateChanged(
          auth,
          async (user) => {

            try {

              this.currentUser =
                user;


              if (user) {

                await this.loadUserData(
                  user.uid
                );

              } else {

                this.currentUserData =
                  null;

              }

            } catch (error) {

              console.error(
                'Error restoring school user session:',
                error
              );

              this.currentUserData =
                null;

            } finally {

              resolve();

            }

          }
        );

      });

  }


  // =========================================================
  // WAIT FOR AUTHENTICATION TO INITIALIZE
  // =========================================================

  async waitForAuthReady(): Promise<void> {

    await this.authReady;

  }


  // =========================================================
  // GET CURRENT FIREBASE USER
  // =========================================================

  getUser(): User | null {

    return this.currentUser;

  }


  // =========================================================
  // GET CURRENT FIREBASE USER
  // =========================================================
  //
  // Compatibility alias.
  //
  // Some pages may use getCurrentUser()
  // while other existing pages use getUser().
  //
  // =========================================================

  getCurrentUser(): User | null {

    return this.currentUser;

  }


  // =========================================================
  // GET CURRENT SCHOOL USER
  // =========================================================

  getUserData(): SchoolUser | null {

    return this.currentUserData;

  }


  // =========================================================
  // SCHOOL USER LOGIN
  // =========================================================
  //
  // Supported school IDs:
  //
  // DL-S-000001  -> Student
  // DL-P-000001  -> Parent
  // DL-T-000001  -> Staff / Teacher
  //
  // Teachers are STAFF.
  //
  // =========================================================

  async login(
    schoolId: string,
    password: string
  ): Promise<User> {


    // =======================================================
    // NORMALIZE SCHOOL ID
    // =======================================================

    const normalizedId =
      schoolId
        .trim()
        .toUpperCase();


    // =======================================================
    // VALIDATE SCHOOL ID
    // =======================================================

    if (!normalizedId) {

      throw new Error(
        'School ID is required.'
      );

    }


    // =======================================================
    // VALIDATE PASSWORD
    // =======================================================

    if (!password) {

      throw new Error(
        'Password is required.'
      );

    }


    // =======================================================
    // DETERMINE FIREBASE LOGIN EMAIL
    // =======================================================

    let loginEmail =
      normalizedId;


    // =======================================================
    // STUDENT LOGIN
    // =======================================================

    if (
      normalizedId.startsWith('DL-S-')
    ) {

      loginEmail =
        `${normalizedId.toLowerCase()}@students.dlittles.com`;

    }


    // =======================================================
    // PARENT LOGIN
    // =======================================================

    else if (
      normalizedId.startsWith('DL-P-')
    ) {

      loginEmail =
        `${normalizedId.toLowerCase()}@parents.dlittles.com`;

    }


    // =======================================================
    // STAFF / TEACHER LOGIN
    // =======================================================

    else if (
      normalizedId.startsWith('DL-T-')
    ) {

      loginEmail =
        `${normalizedId.toLowerCase()}@teachers.dlittles.com`;

    }


    // =======================================================
    // FIREBASE AUTHENTICATION
    // =======================================================

    const credential =
      await signInWithEmailAndPassword(
        auth,
        loginEmail,
        password
      );


    const user =
      credential.user;


    // =======================================================
    // LOAD USER RECORD
    // =======================================================

    const userRef =
      ref(
        database,
        `users/${user.uid}`
      );


    const snapshot =
      await get(userRef);


    // =======================================================
    // USER RECORD NOT FOUND
    // =======================================================

    if (!snapshot.exists()) {

      await signOut(auth);

      throw new Error(
        'Your account could not be found.'
      );

    }


    const userData =
      snapshot.val();


    // =======================================================
    // ALLOWED SCHOOL ROLES
    // =======================================================

    const allowedRoles = [

      'student',

      'parent',

      'staff'

    ];


    if (
      !allowedRoles.includes(
        userData.role
      )
    ) {

      await signOut(auth);

      throw new Error(
        'This account is not authorized for school user access.'
      );

    }


    // =======================================================
    // ACCOUNT STATUS
    // =======================================================

    if (
      userData.status &&
      userData.status !== 'active'
    ) {

      await signOut(auth);

      throw new Error(
        'This account is not currently active.'
      );

    }


    // =======================================================
    // STORE AUTHENTICATED USER
    // =======================================================

    this.currentUser =
      user;


    this.currentUserData = {

      uid:
        user.uid,

      fullName:
        userData.fullName ||
        userData.fullname ||
        userData.name ||
        '',

      email:
        userData.email ||
        user.email ||
        '',

      role:
        userData.role,

      phone:
        userData.phone ||
        userData.phoneNumber ||
        '',

      studentId:
        userData.studentId ||
        '',

      parentId:
        userData.parentId ||
        '',

      staffId:
        userData.staffId ||
        '',

      status:
        userData.status ||
        'active'

    };


    return user;

  }


  // =========================================================
  // LOAD USER DATA FROM FIREBASE
  // =========================================================

  private async loadUserData(
    uid: string
  ): Promise<void> {


    const userRef =
      ref(
        database,
        `users/${uid}`
      );


    const snapshot =
      await get(userRef);


    // =======================================================
    // USER RECORD DOES NOT EXIST
    // =======================================================

    if (!snapshot.exists()) {

      this.currentUserData =
        null;

      return;

    }


    const userData =
      snapshot.val();


    // =======================================================
    // STORE SCHOOL USER DATA
    // =======================================================

    this.currentUserData = {

      uid,

      fullName:
        userData.fullName ||
        userData.fullname ||
        userData.name ||
        '',

      email:
        userData.email ||
        auth.currentUser?.email ||
        '',

      role:
        userData.role ||
        '',

      phone:
        userData.phone ||
        userData.phoneNumber ||
        '',

      studentId:
        userData.studentId ||
        '',

      parentId:
        userData.parentId ||
        '',

      staffId:
        userData.staffId ||
        '',

      status:
        userData.status ||
        'active'

    };

  }


  // =========================================================
  // GET FIREBASE ID TOKEN
  // =========================================================

  async getIdToken(): Promise<string | null> {

    const user =
      auth.currentUser;


    if (!user) {

      return null;

    }


    return await user.getIdToken();

  }


  // =========================================================
  // SCHOOL USER LOGOUT
  // =========================================================

  async logout(): Promise<void> {

    await signOut(auth);


    this.currentUser =
      null;


    this.currentUserData =
      null;

  }


  // =========================================================
  // CHECK WHETHER USER IS LOGGED IN
  // =========================================================

  isLoggedIn(): boolean {

    return !!auth.currentUser;

  }


  // =========================================================
  // CHECK CURRENT USER ROLE
  // =========================================================

  hasRole(
    role: string
  ): boolean {

    return (
      this.currentUserData?.role ===
      role
    );

  }


  // =========================================================
  // CHECK WHETHER CURRENT USER IS A STUDENT
  // =========================================================

  isStudent(): boolean {

    return this.hasRole(
      'student'
    );

  }


  // =========================================================
  // CHECK WHETHER CURRENT USER IS A PARENT
  // =========================================================

  isParent(): boolean {

    return this.hasRole(
      'parent'
    );

  }


  // =========================================================
  // CHECK WHETHER CURRENT USER IS STAFF
  // =========================================================
  //
  // Teachers are STAFF.
  //
  // =========================================================

  isStaff(): boolean {

    return this.hasRole(
      'staff'
    );

  }

}

