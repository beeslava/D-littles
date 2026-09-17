import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminAuthService } from '../../../core/Auth/admin-auth.service';



@Component({
selector: 'app-admin-login',
standalone: true,
imports: [FormsModule, RouterLink],
templateUrl: './admin-login.html',
styleUrl: './admin-login.css'
})
export class AdminLogin {

email = '';
password = '';

loading = false;
errorMessage = '';

showPassword = false;

constructor(
private readonly adminAuthService: AdminAuthService,
private readonly router: Router
) {}

async login(): Promise<void> {


if (this.loading) {
  return;
}


if (!this.email || !this.password) {

  this.errorMessage =
    'Please enter your email and password.';

  return;

}


this.loading = true;
this.errorMessage = '';


try {

  await this.adminAuthService.login(
    this.email.trim(),
    this.password
  );


  await this.router.navigate([
    '/admin/dashboard'
  ]);


} catch (error) {

  console.error(
    'Admin login error:',
    error
  );


  this.errorMessage =
    error instanceof Error
      ? error.message
      : 'Unable to sign in. Please check your credentials.';


} finally {

  this.loading = false;

}


}

togglePassword(): void {


this.showPassword =
  !this.showPassword;


}

}
