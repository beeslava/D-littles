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



@Injectable({
providedIn: 'root'
})
export class AdminAuthService {

private currentUser: User | null = null;

constructor() {


onAuthStateChanged(auth, (user) => {

  this.currentUser = user;

});


}

/**

* Get currently signed-in Firebase user
  */
  getUser(): User | null {


return this.currentUser;


}

/**

* Admin login
  */
  async login(
  email: string,
  password: string
  ): Promise<User> {


const credential =



  await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

const user = credential.user;


/**
 * Check administrator record
 */
const adminRef =
  ref(database, `users/${user.uid}`);

const snapshot =
  await get(adminRef);


if (!snapshot.exists()) {

  await signOut(auth);

  throw new Error(
    'This account is not authorized as an administrator.'
  );

}


const userData =
  snapshot.val();


if (userData.role !== 'admin') {

  await signOut(auth);

  throw new Error(
    'This account does not have administrator access.'
  );

}


this.currentUser = user;

return user;


}

/**

* Admin logout
  */
  async logout(): Promise<void> {


await signOut(auth);



this.currentUser = null;


}

/**

* Check whether current user is an admin
  */
  async isAdmin(): Promise<boolean> {


const user = auth.currentUser;

if (!user) {
  return false;
}


const adminRef =
  ref(database, `users/${user.uid}`);

const snapshot =
  await get(adminRef);


if (!snapshot.exists()) {
  return false;
}


return snapshot.val().role === 'admin';

}

}
