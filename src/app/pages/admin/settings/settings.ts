import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  get,
  ref,
  set
} from 'firebase/database';

import { database } from '../../../core/firebase.config';
import { AdminAuthService } from '../../../core/Auth/admin-auth.service';


// =========================================================
// INTERFACE
// =========================================================

interface SchoolSettings {

  schoolName: string;

  motto: string;

  address: string;

  phone: string;

  email: string;

  website: string;

  currentSession: string;

  currentTerm: string;

  sessionStartDate: string;

  sessionEndDate: string;

  termStartDate: string;

  termEndDate: string;

  admissionEmailNotifications: boolean;

  paymentEmailNotifications: boolean;

  smsNotifications: boolean;
}


// =========================================================
// DEFAULT SETTINGS
// =========================================================

const DEFAULT_SETTINGS: SchoolSettings = {

  schoolName: 'D Little Private School',

  motto: '',

  address: '',

  phone: '',

  email: '',

  website: '',

  currentSession: '',

  currentTerm: 'First Term',

  sessionStartDate: '',

  sessionEndDate: '',

  termStartDate: '',

  termEndDate: '',

  admissionEmailNotifications: true,

  paymentEmailNotifications: true,

  smsNotifications: false

};


// =========================================================
// COMPONENT
// =========================================================

@Component({

  selector: 'app-admin-settings',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './settings.html',

  styleUrl: './settings.css'

})


export class AdminSettings implements OnInit {


  // =======================================================
  // SETTINGS
  // =======================================================

  settings: SchoolSettings = {
    ...DEFAULT_SETTINGS
  };


  // =======================================================
  // ADMIN INFORMATION
  // =======================================================

  adminName = 'Administrator';

  adminEmail = '';


  // =======================================================
  // UI STATE
  // =======================================================

  loading = false;

  saving = false;

  saved = false;

  errorMessage = '';


  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor(

    private readonly adminAuthService: AdminAuthService,

    private readonly cdr: ChangeDetectorRef

  ) {

    const user =
      this.adminAuthService.getUser();

    const userData =
      this.adminAuthService.getUserData();


    this.adminEmail =
      user?.email ?? '';


    this.adminName =
      userData?.fullName ||
      user?.displayName ||
      user?.email ||
      'Administrator';

  }


  // =======================================================
  // INIT
  // =======================================================

  async ngOnInit(): Promise<void> {

    await this.loadSettings();

  }


  // =======================================================
  // LOAD SETTINGS
  // =======================================================

  async loadSettings(): Promise<void> {

    this.loading = true;

    this.errorMessage = '';

    this.saved = false;


    try {

      const settingsRef =
        ref(
          database,
          'settings/school'
        );


      const snapshot =
        await get(settingsRef);


      if (snapshot.exists()) {

        this.settings = {

          ...DEFAULT_SETTINGS,

          ...(snapshot.val() as Partial<SchoolSettings>)

        };

      } else {

        this.settings = {
          ...DEFAULT_SETTINGS
        };

      }


    } catch (error) {

      console.error(
        'Failed to load admin settings:',
        error
      );


      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to load school settings.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // SAVE SETTINGS
  // =======================================================

  async saveSettings(): Promise<void> {

    if (this.saving) {

      return;

    }


    this.saving = true;

    this.saved = false;

    this.errorMessage = '';


    try {

      const cleanSettings: SchoolSettings = {

        schoolName:
          this.settings.schoolName.trim(),

        motto:
          this.settings.motto.trim(),

        address:
          this.settings.address.trim(),

        phone:
          this.settings.phone.trim(),

        email:
          this.settings.email.trim(),

        website:
          this.settings.website.trim(),

        currentSession:
          this.settings.currentSession.trim(),

        currentTerm:
          this.settings.currentTerm,

        sessionStartDate:
          this.settings.sessionStartDate,

        sessionEndDate:
          this.settings.sessionEndDate,

        termStartDate:
          this.settings.termStartDate,

        termEndDate:
          this.settings.termEndDate,

        admissionEmailNotifications:
          this.settings.admissionEmailNotifications,

        paymentEmailNotifications:
          this.settings.paymentEmailNotifications,

        smsNotifications:
          this.settings.smsNotifications

      };


      // ---------------------------------------------------
      // VALIDATION
      // ---------------------------------------------------

      if (!cleanSettings.schoolName) {

        throw new Error(
          'School name is required.'
        );

      }


      // ---------------------------------------------------
      // SAVE TO FIREBASE
      // ---------------------------------------------------

      const settingsRef =
        ref(
          database,
          'settings/school'
        );


      await set(
        settingsRef,
        cleanSettings
      );


      this.settings =
        cleanSettings;


      this.saved = true;


      setTimeout(() => {

        this.saved = false;

        this.cdr.detectChanges();

      }, 3500);


    } catch (error) {

      console.error(
        'Failed to save admin settings:',
        error
      );


      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to save school settings.';


    } finally {

      this.saving = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // RESET FORM
  // =======================================================

  resetForm(): void {

    this.settings = {
      ...DEFAULT_SETTINGS
    };

    this.saved = false;

    this.errorMessage = '';

  }

}