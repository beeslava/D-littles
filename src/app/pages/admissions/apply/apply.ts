import {
ChangeDetectorRef,
Component
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { FirebaseService } from '../../../core/firebase.service';

@Component({
selector: 'app-apply',
standalone: true,
imports: [
FormsModule,
RouterLink
],
templateUrl: './apply.html',
styleUrl: './apply.css'
})
export class Apply {

submitted = false;
submitting = false;

applicationNumber = '';

errorMessage = '';

application = {

studentFirstName: '',
studentMiddleName: '',
studentLastName: '',
dateOfBirth: '',
gender: '',
classApplied: '',

parentName: '',
parentPhone: '',
parentEmail: '',
relationship: '',

previousSchool: '',
previousClass: '',

emergencyName: '',
emergencyPhone: '',

additionalNotes: '',
declaration: false


};

constructor(
private readonly firebaseService: FirebaseService,
private readonly cdr: ChangeDetectorRef
) {}

async submitApplication() {


console.log('1. Submit button clicked');


// Prevent accidental double submission
if (this.submitting) {
  return;
}


// Check declaration
if (!this.application.declaration) {

  this.errorMessage =
    'Please accept the declaration before submitting.';

  this.cdr.detectChanges();

  return;
}


// Start loading
this.submitting = true;
this.errorMessage = '';

this.cdr.detectChanges();


try {

  console.log('2. Calling Firebase service');


  const result =
    await this.firebaseService
      .submitAdmissionApplication(
        this.application
      );


  console.log(
    '3. Firebase result:',
    result
  );


  // Store application number
  this.applicationNumber =
    result.applicationNumber;


  // Show success screen
  this.submitted = true;


  // Stop loading immediately
  this.submitting = false;


  // Force Angular to update the page
  this.cdr.detectChanges();


  console.log(
    '4. Application submitted successfully'
  );


} catch (error) {

  console.error(
    '5. Admission submission error:',
    error
  );


  this.errorMessage =
    error instanceof Error
      ? error.message
      : String(error);


  this.submitting = false;


  this.cdr.detectChanges();


} finally {

  console.log(
    '6. Finally reached'
  );


  this.submitting = false;

  this.cdr.detectChanges();

}


}

}
