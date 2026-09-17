import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdminAuthService } from './Auth/admin-auth.service';



export const adminGuard = async (): Promise<boolean> => {

const adminAuthService =
inject(AdminAuthService);

const router =
inject(Router);

const isAdmin =
await adminAuthService.isAdmin();

if (isAdmin) {
return true;
}

await router.navigate(['/admin']);

return false;

};
