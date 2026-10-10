import {
  ChangeDetectorRef,
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
  Router,
  RouterLink
} from '@angular/router';

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';

import {
  auth
} from '../../../core/firebase.config';

import {
  AdminAuthService
} from '../../../core/Auth/admin-auth.service';


// =========================================================
// COMPONENT
// =========================================================

@Component({
  selector: 'app-change-password',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
   
  ],

  templateUrl: './changepassward.html',
  styleUrl: './changepassward.css'
})
export class ChangePassword implements OnInit {

  // =======================================================
  // FORM
  // =======================================================

  currentPassword = '';

  newPassword = '';

  confirmPassword = '';


  // =======================================================
  // UI STATE
  // =======================================================

  loading = false;

  successMessage = '';

  errorMessage = '';

  showCurrentPassword = false;

  showNewPassword = false;

  showConfirmPassword = false;


  // =======================================================
  // PASSWORD REQUIREMENTS
  // =======================================================

  readonly minimumPasswordLength = 8;


  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor(
    private readonly router: Router,
    private readonly adminAuthService: AdminAuthService,
    private readonly cdr: ChangeDetectorRef
  ) {}


  // =======================================================
  // INIT
  // =======================================================

  ngOnInit(): void {

    this.clearMessages();

  }


  // =======================================================
  // CLEAR MESSAGES
  // =======================================================

  private clearMessages(): void {

    this.successMessage = '';

    this.errorMessage = '';

  }


  // =======================================================
  // TOGGLE CURRENT PASSWORD
  // =======================================================

  toggleCurrentPassword(): void {

    this.showCurrentPassword =
      !this.showCurrentPassword;

  }


  // =======================================================
  // TOGGLE NEW PASSWORD
  // =======================================================

  toggleNewPassword(): void {

    this.showNewPassword =
      !this.showNewPassword;

  }


  // =======================================================
  // TOGGLE CONFIRM PASSWORD
  // =======================================================

  toggleConfirmPassword(): void {

    this.showConfirmPassword =
      !this.showConfirmPassword;

  }


  // =======================================================
  // PASSWORD STRENGTH
  // =======================================================

  getPasswordStrength(): string {

    if (!this.newPassword) {

      return '';

    }


    if (this.newPassword.length < 8) {

      return 'weak';

    }


    let score = 0;


    if (/[a-z]/.test(this.newPassword)) {

      score++;

    }


    if (/[A-Z]/.test(this.newPassword)) {

      score++;

    }


    if (/[0-9]/.test(this.newPassword)) {

      score++;

    }


    if (/[^A-Za-z0-9]/.test(this.newPassword)) {

      score++;

    }


    if (this.newPassword.length >= 12) {

      score++;

    }


    if (score <= 1) {

      return 'weak';

    }


    if (score <= 3) {

      return 'medium';

    }


    return 'strong';

  }


  // =======================================================
  // PASSWORD STRENGTH LABEL
  // =======================================================

  getPasswordStrengthLabel(): string {

    const strength =
      this.getPasswordStrength();


    if (strength === 'weak') {

      return 'Weak password';

    }


    if (strength === 'medium') {

      return 'Medium password';

    }


    if (strength === 'strong') {

      return 'Strong password';

    }


    return '';

  }


  // =======================================================
  // PASSWORD MATCH
  // =======================================================

  passwordsMatch(): boolean {

    if (!this.confirmPassword) {

      return true;

    }


    return (
      this.newPassword ===
      this.confirmPassword
    );

  }


  // =======================================================
  // CHANGE PASSWORD
  // =======================================================

  async changePassword(): Promise<void> {

    if (this.loading) {

      return;

    }


    this.clearMessages();


    // -----------------------------------------------------
    // VALIDATE CURRENT PASSWORD
    // -----------------------------------------------------

    if (!this.currentPassword.trim()) {

      this.errorMessage =
        'Please enter your current password.';

      this.cdr.detectChanges();

      return;

    }


    // -----------------------------------------------------
    // VALIDATE NEW PASSWORD
    // -----------------------------------------------------

    if (!this.newPassword.trim()) {

      this.errorMessage =
        'Please enter your new password.';

      this.cdr.detectChanges();

      return;

    }


    // -----------------------------------------------------
    // MINIMUM LENGTH
    // -----------------------------------------------------

    if (
      this.newPassword.length <
      this.minimumPasswordLength
    ) {

      this.errorMessage =
        `Your new password must be at least ${this.minimumPasswordLength} characters long.`;

      this.cdr.detectChanges();

      return;

    }


    // -----------------------------------------------------
    // CONFIRM PASSWORD
    // -----------------------------------------------------

    if (!this.confirmPassword.trim()) {

      this.errorMessage =
        'Please confirm your new password.';

      this.cdr.detectChanges();

      return;

    }


    // -----------------------------------------------------
    // PASSWORD MATCH
    // -----------------------------------------------------

    if (
      this.newPassword !==
      this.confirmPassword
    ) {

      this.errorMessage =
        'The new passwords do not match.';

      this.cdr.detectChanges();

      return;

    }


    // -----------------------------------------------------
    // PREVENT SAME PASSWORD
    // -----------------------------------------------------

    if (
      this.currentPassword ===
      this.newPassword
    ) {

      this.errorMessage =
        'Your new password must be different from your current password.';

      this.cdr.detectChanges();

      return;

    }


    // -----------------------------------------------------
    // GET FIREBASE USER
    // -----------------------------------------------------

    const user =
      auth.currentUser;


    if (!user) {

      this.errorMessage =
        'Your administrator session has expired. Please log in again.';

      this.cdr.detectChanges();

      return;

    }


    // -----------------------------------------------------
    // GET USER EMAIL
    // -----------------------------------------------------

    const email =
      user.email;


    if (!email) {

      this.errorMessage =
        'Unable to identify your administrator account email.';

      this.cdr.detectChanges();

      return;

    }


    // -----------------------------------------------------
    // START LOADING
    // -----------------------------------------------------

    this.loading = true;

    this.cdr.detectChanges();


    try {

      // ===================================================
      // 1. RE-AUTHENTICATE USER
      // ===================================================

      const credential =
        EmailAuthProvider.credential(
          email,
          this.currentPassword
        );


      await reauthenticateWithCredential(
        user,
        credential
      );


      // ===================================================
      // 2. UPDATE FIREBASE PASSWORD
      // ===================================================

      await updatePassword(
        user,
        this.newPassword
      );


      // ===================================================
      // 3. SUCCESS
      // ===================================================

      this.currentPassword = '';

      this.newPassword = '';

      this.confirmPassword = '';

      this.successMessage =
        'Your password has been changed successfully.';


      this.loading = false;

      this.cdr.detectChanges();


    } catch (error: any) {

      console.error(
        'Change password error:',
        error
      );


      this.loading = false;


      // ===================================================
      // FIREBASE ERROR HANDLING
      // ===================================================

      const errorCode =
        error?.code || '';


      switch (errorCode) {

        case 'auth/wrong-password':

        case 'auth/invalid-credential':

        case 'auth/invalid-login-credentials':

          this.errorMessage =
            'Your current password is incorrect.';

          break;


        case 'auth/weak-password':

          this.errorMessage =
            'The new password is too weak. Please choose a stronger password.';

          break;


        case 'auth/password-does-not-meet-requirements':

          this.errorMessage =
            'The new password does not meet Firebase password requirements.';

          break;


        case 'auth/requires-recent-login':

          this.errorMessage =
            'For security reasons, please log out and log in again before changing your password.';

          break;


        case 'auth/user-disabled':

          this.errorMessage =
            'This administrator account has been disabled.';

          break;


        case 'auth/network-request-failed':

          this.errorMessage =
            'A network error occurred. Please check your internet connection and try again.';

          break;


        case 'auth/too-many-requests':

          this.errorMessage =
            'Too many attempts were made. Please wait a few minutes and try again.';

          break;


        default:

          this.errorMessage =
            error?.message ||
            'Unable to change your password. Please try again.';

          break;

      }


      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // CANCEL
  // =======================================================

  cancel(): void {

    this.router.navigate([
      '/admin/dashboard'
    ]);

  }


  // =======================================================
  // LOGOUT
  // =======================================================

  async logout(): Promise<void> {

    try {

      await this.adminAuthService.logout();

      await this.router.navigate([
        '/admin/login'
      ]);

    } catch (error) {

      console.error(
        'Logout error:',
        error
      );

      this.errorMessage =
        'Unable to log out. Please try again.';

      this.cdr.detectChanges();

    }

  }

}