import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SchoolAuthService } from '../../../core/Auth/school-auth.service';
import { NgIf } from '@angular/common';




@Component({
  selector: 'app-school-login',
  standalone: true,
  imports: [
    FormsModule,
    NgIf
  ],
  templateUrl: './school-login.html',
  styleUrl: './school-login.css'
})
export class SchoolLogin {

  email = '';

  password = '';

  loading = false;

  errorMessage = '';


  constructor(
    private schoolAuth: SchoolAuthService,
    private router: Router
  ) {}


  async login(): Promise<void> {

    this.errorMessage = '';


    if (
      !this.email.trim() ||
      !this.password
    ) {

      this.errorMessage =
        'Please enter your email and password.';

      return;

    }


    this.loading = true;


    try {

      await this.schoolAuth.login(
        this.email.trim(),
        this.password
      );


      const user =
        this.schoolAuth.getUserData();


      if (!user) {

        throw new Error(
          'Unable to load your account information.'
        );

      }


      switch (user.role) {

        case 'student':

          await this.router.navigate([
            '/student/dashboard'
          ]);

          break;


        case 'parent':

          await this.router.navigate([
            '/parent/dashboard'
          ]);

          break;


        case 'teacher':

          await this.router.navigate([
            '/teacher/dashboard'
          ]);

          break;


        default:

          await this.schoolAuth.logout();

          this.errorMessage =
            'Your account does not have a valid school role.';

          break;

      }

    } catch (error: any) {

      console.error(
        'School login error:',
        error
      );


      this.errorMessage =
        error?.message ||
        'Unable to sign in. Please check your details and try again.';

    } finally {

      this.loading = false;

    }

  }

}