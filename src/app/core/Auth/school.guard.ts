import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router
} from '@angular/router';

import { SchoolAuthService } from './school-auth.service';


export const schoolGuard: CanActivateFn = async () => {

  const authService =
    inject(SchoolAuthService);

  const router =
    inject(Router);


  const user =
    authService.getUser();

  const userData =
    authService.getUserData();


  /**
   * No authenticated user
   */
  if (!user) {

    return router.createUrlTree([
      '/login'
    ]);

  }


  /**
   * No school user record
   */
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


  const data =
    authService.getUserData();


  /**
   * Still no user data
   */
  if (!data) {

    return router.createUrlTree([
      '/login'
    ]);

  }


  /**
   * Only school users can enter
   */
  const allowedRoles = [
    'student',
    'parent',
    'teacher'
  ];


  if (
    !allowedRoles.includes(
      data.role
    )
  ) {

    return router.createUrlTree([
      '/login'
    ]);

  }


  /**
   * Account must be active
   */
  if (
    data.status &&
    data.status !== 'active'
  ) {

    return router.createUrlTree([
      '/login'
    ]);

  }


  return true;

};