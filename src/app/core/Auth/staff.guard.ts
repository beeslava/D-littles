import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router
} from '@angular/router';

import { SchoolAuthService } from './school-auth.service';


export const staffGuard: CanActivateFn = async () => {

  const authService =
    inject(SchoolAuthService);

  const router =
    inject(Router);


  // =========================================================
  // CHECK AUTHENTICATED USER
  // =========================================================

  const user =
    authService.getUser();


  if (!user) {

    return router.createUrlTree([
      '/login'
    ]);

  }


  // =========================================================
  // WAIT FOR SCHOOL USER DATA
  // =========================================================

  let userData =
    authService.getUserData();


  if (!userData) {

    await new Promise<void>((resolve) => {

      const checkUser = () => {

        if (
          authService.getUserData() !== null ||
          authService.getUser() === null
        ) {

          resolve();

        } else {

          setTimeout(
            checkUser,
            100
          );

        }

      };

      checkUser();

    });

  }


  userData =
    authService.getUserData();


  // =========================================================
  // NO USER DATA
  // =========================================================

  if (!userData) {

    return router.createUrlTree([
      '/login'
    ]);

  }


  // =========================================================
  // STAFF ONLY
  // =========================================================

  if (
    userData.role !== 'staff'
  ) {

    return router.createUrlTree([
      '/login'
    ]);

  }


  // =========================================================
  // STAFF ACCOUNT MUST BE ACTIVE
  // =========================================================

  if (
    userData.status &&
    userData.status !== 'active'
  ) {

    return router.createUrlTree([
      '/login'
    ]);

  }


  // =========================================================
  // STAFF AUTHORIZED
  // =========================================================

  return true;

};