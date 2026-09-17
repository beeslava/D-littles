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

@Injectable({
providedIn: 'root'
})
export class SchoolAuthService {

private currentUser: User | null = null;

private currentUserData: SchoolUser | null = null;

constructor() {


onAuthStateChanged(
  auth,
  async (user) => {

    this.currentUser = user;

    if (user) {

      await this.loadUserData(
        user.uid
      );

    } else {

      this.currentUserData = null;

    }

  }
);


}

/**

* Get currently signed-in Firebase user
  */
  getUser(): User | null {

return this.currentUser;


}

/**

* Get currently signed-in school user
  */
  getUserData(): SchoolUser | null {


return this.currentUserData;


}

/**

* School user login
*
* Students log in using their School ID.
*
* Example:
*
* DL-S-000001
*
* Internally this becomes:
*
* [dl-s-000001@students.dlittles.com](mailto:dl-s-000001@students.dlittles.com)
*
* This matches the Firebase Auth account
* created by approveAdmissionApplication.
  */
  async login(
  schoolId: string,
  password: string
  ): Promise<User> {

const normalizedId =

  schoolId
    .trim()
    .toUpperCase();


if (!normalizedId) {

  throw new Error(
    'School ID is required.'
  );

}


if (!password) {

  throw new Error(
    'Password is required.'
  );

}


/**
 * Determine Firebase login email.
 *
 * Student IDs created by the admission
 * Cloud Function use:
 *
 * DL-S-000001
 *
 * and are converted internally to:
 *
 * dl-s-000001@students.dlittles.com
 */
let loginEmail =
  normalizedId;


if (
  normalizedId.startsWith('DL-S-')
) {

  loginEmail =
    `${normalizedId.toLowerCase()}@students.dlittles.com`;

}


/**
 * Authenticate with Firebase
 */
const credential =
  await signInWithEmailAndPassword(
    auth,
    loginEmail,
    password
  );


const user =
  credential.user;


/**
 * Load user record
 */
const userRef =
  ref(
    database,
    `users/${user.uid}`
  );


const snapshot =
  await get(userRef);


if (!snapshot.exists()) {

  await signOut(auth);

  throw new Error(
    'Your account could not be found.'
  );

}


const userData =
  snapshot.val();


/**
 * Allowed school user roles
 */
const allowedRoles = [
  'student',
  'parent',
  'teacher'
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


/**
 * Check account status
 */
if (
  userData.status &&
  userData.status !== 'active'
) {

  await signOut(auth);

  throw new Error(
    'This account is not currently active.'
  );

}


/**
 * Store authenticated user
 */
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

/**

* Load user data from Firebase
  */
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


if (!snapshot.exists()) {

  this.currentUserData =
    null;

  return;

}


const userData =
  snapshot.val();


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

/**

* Get Firebase ID token for backend authentication
  */
  async getIdToken(): Promise<string | null> {

const user =

  auth.currentUser;


if (!user) {

  return null;

}


return await user.getIdToken();


}

/**

* School user logout
  */
  async logout(): Promise<void> {


await signOut(auth);

this.currentUser =
  null;

this.currentUserData =
  null;


}

/**

* Check whether a school user is logged in
  */
  isLoggedIn(): boolean {


return !!auth.currentUser;


}

/**

* Check current user's role
  */
  hasRole(
  role: string
  ): boolean {


return (

  this.currentUserData?.role ===
  role
);


}

/**

* Check whether current user is a student
  */
  isStudent(): boolean {

return this.hasRole(

  'student'
);


}

/**

* Check whether current user is a parent
  */
  isParent(): boolean {

return this.hasRole(

  'parent'
);


}

/**

* Check whether current user is a teacher
  */
  isTeacher(): boolean {

return this.hasRole(

  'teacher'
);


}

}
