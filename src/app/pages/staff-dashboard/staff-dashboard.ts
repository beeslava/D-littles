import {
  NgFor,
  NgIf,
  TitleCasePipe
} from '@angular/common';

import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import {
  FormsModule
} from '@angular/forms';

import {
  Router,
  RouterLink
} from '@angular/router';

import {
  get,
  ref
} from 'firebase/database';

import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';

import {
  SchoolAuthService,
  SchoolUser
} from '../../core/Auth/school-auth.service';

import {
  database
} from '../../core/firebase.config';


// =====================================================
// STAFF MEMBER
// =====================================================

interface StaffMember {

  id: string;

  staffId: string;

  fullName: string;

  email: string;

  phone: string;

  gender: string;

  position: string;

  department: string;

  qualification: string;

  employmentDate: string;

  address: string;

  emergencyContact: string;

  status: string;

  createdAt: number;

  updatedAt?: number;
}


// =====================================================
// SCHOOL CLASS
// =====================================================

interface SchoolClass {

  id: string;

  classCode: string;

  className: string;

  section: string;

  classTeacherId: string;

  classTeacherName: string;

  room: string;

  capacity: number;

  academicYear: string;

  status: string;

  description: string;

  createdAt: number;

  updatedAt?: number;
}


// =====================================================
// SCHOOL SUBJECT
// =====================================================

interface SchoolSubject {

  id: string;

  subjectCode: string;

  subjectName: string;

  category: string;

  description: string;

  status: string;

  createdAt: number;

  updatedAt?: number;
}


// =====================================================
// TEACHING ASSIGNMENT
// =====================================================

interface TeachingAssignment {

  id: string;

  classId: string;

  subjectId: string;

  teacherId: string;

  className: string;

  subjectName: string;

  teacherName: string;

  createdAt: number;

  updatedAt?: number;
}


// =====================================================
// STUDENT
// =====================================================

interface Student {

  id: string;

  studentId: string;

  fullName: string;

  firstName?: string;

  lastName?: string;

  gender?: string;

  dateOfBirth?: string;

  classId?: string;

  className?: string;

  status?: string;

  createdAt?: number;

  updatedAt?: number;
}


// =====================================================
// COMPONENT
// =====================================================

@Component({

  selector: 'app-staff-dashboard',

  standalone: true,

  imports: [
    NgIf,
    NgFor,
    FormsModule,
    RouterLink,
    TitleCasePipe
  ],

  templateUrl: './staff-dashboard.html',

  styleUrl: './staff-dashboard.css'

})


export class StaffDashboard implements OnInit {


  // =====================================================
  // CURRENT USER
  // =====================================================

  currentUser: SchoolUser | null = null;


  // =====================================================
  // STAFF
  // =====================================================

  staffMember: StaffMember | null = null;


  // =====================================================
  // ASSIGNMENTS
  // =====================================================

  assignments: TeachingAssignment[] = [];


  // =====================================================
  // CLASSES
  // =====================================================

  myClasses: SchoolClass[] = [];


  // =====================================================
  // SUBJECTS
  // =====================================================

  mySubjects: SchoolSubject[] = [];


  // =====================================================
  // STUDENTS
  // =====================================================

  myStudents: Student[] = [];


  // =====================================================
  // STATISTICS
  // =====================================================

  totalClasses = 0;

  totalSubjects = 0;

  totalStudents = 0;


  // =====================================================
  // UI STATE
  // =====================================================

  loading = true;

  errorMessage = '';


  // =====================================================
  // CHANGE PASSWORD
  // =====================================================

  showChangePassword = false;

  currentPassword = '';

  newPassword = '';

  confirmPassword = '';

  changingPassword = false;

  passwordError = '';

  passwordSuccess = '';


  // =====================================================
  // CONSTRUCTOR
  // =====================================================

  constructor(

    private readonly authService: SchoolAuthService,

    private readonly router: Router,

    private readonly cdr: ChangeDetectorRef

  ) {}


  // =====================================================
  // INIT
  // =====================================================

  ngOnInit(): void {

    this.currentUser =
      this.authService.getUserData();

    this.loadDashboard();

  }


  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  async loadDashboard(): Promise<void> {

    this.loading = true;

    this.errorMessage = '';


    try {

      // -------------------------------------------------
      // GET CURRENT USER
      // -------------------------------------------------

      this.currentUser =
        this.authService.getUserData();


      if (!this.currentUser) {

        this.router.navigate(['/login']);

        return;

      }


      if (
        this.currentUser.role !== 'staff'
      ) {

        this.router.navigate(['/login']);

        return;

      }


      if (
        !this.currentUser.staffId
      ) {

        this.errorMessage =
          'Your account is not linked to a staff member. Please contact the school administrator.';

        return;

      }


      // -------------------------------------------------
      // LOAD STAFF
      // -------------------------------------------------

      const staffSnapshot =
        await get(
          ref(
            database,
            'staff'
          )
        );


      if (!staffSnapshot.exists()) {

        this.errorMessage =
          'Staff information could not be found.';

        return;

      }


      const staffData =
        staffSnapshot.val();


      const staffEntries =
        Object.entries(
          staffData
        ) as [string, any][];


      // -------------------------------------------------
      // FIND STAFF BY STAFF ID
      // -------------------------------------------------

      const staffEntry =
        staffEntries.find(
          ([id, value]) =>
            value?.staffId ===
            this.currentUser!.staffId
        );


      if (!staffEntry) {

        this.errorMessage =
          'Your staff record could not be found. Please contact the school administrator.';

        return;

      }


      const [
        staffRecordId,
        staffValue
      ] = staffEntry;


      this.staffMember = {

        id: staffRecordId,

        staffId:
          staffValue.staffId ||
          '',

        fullName:
          staffValue.fullName ||
          this.currentUser.fullName ||
          '',

        email:
          staffValue.email ||
          '',

        phone:
          staffValue.phone ||
          '',

        gender:
          staffValue.gender ||
          '',

        position:
          staffValue.position ||
          '',

        department:
          staffValue.department ||
          '',

        qualification:
          staffValue.qualification ||
          '',

        employmentDate:
          staffValue.employmentDate ||
          '',

        address:
          staffValue.address ||
          '',

        emergencyContact:
          staffValue.emergencyContact ||
          '',

        status:
          staffValue.status ||
          'active',

        createdAt:
          staffValue.createdAt ||
          Date.now(),

        updatedAt:
          staffValue.updatedAt ||
          undefined

      };


      // -------------------------------------------------
      // LOAD ASSIGNMENTS
      // -------------------------------------------------

      const assignmentSnapshot =
        await get(
          ref(
            database,
            'teachingAssignments'
          )
        );


      if (
        !assignmentSnapshot.exists()
      ) {

        this.assignments = [];

      } else {

        const assignmentData =
          assignmentSnapshot.val();


        this.assignments =
          Object.entries(
            assignmentData
          )
          .map(
            ([id, value]: [string, any]) => ({

              id,

              classId:
                value.classId ||
                '',

              subjectId:
                value.subjectId ||
                '',

              teacherId:
                value.teacherId ||
                '',

              className:
                value.className ||
                '',

              subjectName:
                value.subjectName ||
                '',

              teacherName:
                value.teacherName ||
                '',

              createdAt:
                value.createdAt ||
                Date.now(),

              updatedAt:
                value.updatedAt ||
                undefined

            })
          )
          .filter(
            assignment =>
              assignment.teacherId ===
              staffRecordId
          );

      }


      // -------------------------------------------------
      // LOAD CLASSES
      // -------------------------------------------------

      const classSnapshot =
        await get(
          ref(
            database,
            'classes'
          )
        );


      const classes: SchoolClass[] = [];


      if (
        classSnapshot.exists()
      ) {

        const classData =
          classSnapshot.val();


        Object.entries(
          classData
        ).forEach(
          ([id, value]: [string, any]) => {

            if (
              value.status === 'inactive'
            ) {

              return;

            }


            classes.push({

              id,

              classCode:
                value.classCode ||
                '',

              className:
                value.className ||
                '',

              section:
                value.section ||
                '',

              classTeacherId:
                value.classTeacherId ||
                '',

              classTeacherName:
                value.classTeacherName ||
                '',

              room:
                value.room ||
                '',

              capacity:
                Number(
                  value.capacity || 0
                ),

              academicYear:
                value.academicYear ||
                '',

              status:
                value.status ||
                'active',

              description:
                value.description ||
                '',

              createdAt:
                value.createdAt ||
                Date.now(),

              updatedAt:
                value.updatedAt ||
                undefined

            });

          }
        );

      }


      // -------------------------------------------------
      // MAP MY CLASSES
      // -------------------------------------------------

      const classIds =
        new Set(
          this.assignments.map(
            assignment =>
              assignment.classId
          )
        );


      this.myClasses =
        classes.filter(
          schoolClass =>
            classIds.has(
              schoolClass.id
            )
        );


      // -------------------------------------------------
      // LOAD SUBJECTS
      // -------------------------------------------------

      const subjectSnapshot =
        await get(
          ref(
            database,
            'subjects'
          )
        );


      const subjects: SchoolSubject[] = [];


      if (
        subjectSnapshot.exists()
      ) {

        const subjectData =
          subjectSnapshot.val();


        Object.entries(
          subjectData
        ).forEach(
          ([id, value]: [string, any]) => {

            if (
              value.status === 'inactive'
            ) {

              return;

            }


            subjects.push({

              id,

              subjectCode:
                value.subjectCode ||
                '',

              subjectName:
                value.subjectName ||
                '',

              category:
                value.category ||
                '',

              description:
                value.description ||
                '',

              status:
                value.status ||
                'active',

              createdAt:
                value.createdAt ||
                Date.now(),

              updatedAt:
                value.updatedAt ||
                undefined

            });

          }
        );

      }


      // -------------------------------------------------
      // MAP MY SUBJECTS
      // -------------------------------------------------

      const subjectIds =
        new Set(
          this.assignments.map(
            assignment =>
              assignment.subjectId
          )
        );


      this.mySubjects =
        subjects.filter(
          subject =>
            subjectIds.has(
              subject.id
            )
        );


      // -------------------------------------------------
      // LOAD STUDENTS
      // -------------------------------------------------

      const studentSnapshot =
        await get(
          ref(
            database,
            'students'
          )
        );


      const students: Student[] = [];


      if (
        studentSnapshot.exists()
      ) {

        const studentData =
          studentSnapshot.val();


        Object.entries(
          studentData
        ).forEach(
          ([id, value]: [string, any]) => {

            if (
              value.status === 'inactive'
            ) {

              return;

            }


            students.push({

              id,

              studentId:
                value.studentId ||
                id,

              fullName:
                value.fullName ||
                `${value.firstName || ''} ${value.lastName || ''}`.trim(),

              firstName:
                value.firstName ||
                '',

              lastName:
                value.lastName ||
                '',

              gender:
                value.gender ||
                '',

              dateOfBirth:
                value.dateOfBirth ||
                '',

              classId:
                value.classId ||
                '',

              className:
                value.className ||
                '',

              status:
                value.status ||
                'active',

              createdAt:
                value.createdAt ||
                undefined,

              updatedAt:
                value.updatedAt ||
                undefined

            });

          }
        );

      }


      // -------------------------------------------------
      // MAP MY STUDENTS
      // -------------------------------------------------

      const myClassIds =
        new Set(
          this.myClasses.map(
            schoolClass =>
              schoolClass.id
          )
        );


      this.myStudents =
        students.filter(
          student =>
            student.classId &&
            myClassIds.has(
              student.classId
            )
        );


      // -------------------------------------------------
      // STATISTICS
      // -------------------------------------------------

      this.totalClasses =
        this.myClasses.length;


      this.totalSubjects =
        this.mySubjects.length;


      this.totalStudents =
        this.myStudents.length;


    } catch (error) {

      console.error(
        'Error loading staff dashboard:',
        error
      );


      this.errorMessage =
        'Unable to load your staff dashboard. Please try again.';


    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // OPEN CHANGE PASSWORD
  // =====================================================

  openChangePassword(): void {

    this.passwordError = '';

    this.passwordSuccess = '';

    this.currentPassword = '';

    this.newPassword = '';

    this.confirmPassword = '';

    this.showChangePassword = true;

  }


  // =====================================================
  // CLOSE CHANGE PASSWORD
  // =====================================================

  closeChangePassword(): void {

    if (this.changingPassword) {

      return;

    }

    this.showChangePassword = false;

    this.passwordError = '';

    this.passwordSuccess = '';

    this.currentPassword = '';

    this.newPassword = '';

    this.confirmPassword = '';

  }


  // =====================================================
  // CHANGE PASSWORD
  // =====================================================

  async changePassword(): Promise<void> {

    this.passwordError = '';

    this.passwordSuccess = '';


    // -------------------------------------------------
    // VALIDATE CURRENT PASSWORD
    // -------------------------------------------------

    if (!this.currentPassword) {

      this.passwordError =
        'Please enter your current password.';

      return;

    }


    // -------------------------------------------------
    // VALIDATE NEW PASSWORD
    // -------------------------------------------------

    if (!this.newPassword) {

      this.passwordError =
        'Please enter a new password.';

      return;

    }


    if (this.newPassword.length < 6) {

      this.passwordError =
        'Your new password must be at least 6 characters long.';

      return;

    }


    // -------------------------------------------------
    // CONFIRM PASSWORD
    // -------------------------------------------------

    if (
      this.newPassword !==
      this.confirmPassword
    ) {

      this.passwordError =
        'The new passwords do not match.';

      return;

    }


    // -------------------------------------------------
    // PREVENT SAME PASSWORD
    // -------------------------------------------------

    if (
      this.currentPassword ===
      this.newPassword
    ) {

      this.passwordError =
        'Your new password must be different from your current password.';

      return;

    }


    this.changingPassword = true;


    try {

      const auth =
        getAuth();

      const user =
        auth.currentUser;


      if (!user) {

        this.passwordError =
          'Your login session has expired. Please log in again.';

        this.router.navigate(['/login']);

        return;

      }


      if (!user.email) {

        this.passwordError =
          'Your account does not have a valid email address.';

        return;

      }


      // -------------------------------------------------
      // RE-AUTHENTICATE
      // -------------------------------------------------

      const credential =
        EmailAuthProvider.credential(
          user.email,
          this.currentPassword
        );


      await reauthenticateWithCredential(
        user,
        credential
      );


      // -------------------------------------------------
      // UPDATE PASSWORD
      // -------------------------------------------------

      await updatePassword(
        user,
        this.newPassword
      );


      // -------------------------------------------------
      // SUCCESS
      // -------------------------------------------------

      this.passwordSuccess =
        'Your password has been changed successfully.';


      this.currentPassword = '';

      this.newPassword = '';

      this.confirmPassword = '';


    } catch (error: any) {

      console.error(
        'Error changing staff password:',
        error
      );


      if (
        error?.code ===
        'auth/invalid-credential' ||
        error?.code ===
        'auth/wrong-password'
      ) {

        this.passwordError =
          'Your current password is incorrect.';

      } else if (
        error?.code ===
        'auth/weak-password'
      ) {

        this.passwordError =
          'The new password is too weak. Please choose a stronger password.';

      } else if (
        error?.code ===
        'auth/requires-recent-login'
      ) {

        this.passwordError =
          'For security, please log out and log in again before changing your password.';

      } else {

        this.passwordError =
          'Unable to change your password. Please try again.';

      }

    } finally {

      this.changingPassword = false;

      this.cdr.detectChanges();

    }

  }


  // =====================================================
  // REFRESH
  // =====================================================

  refreshDashboard(): void {

    this.loadDashboard();

  }


  // =====================================================
  // LOGOUT
  // =====================================================

  logout(): void {

    this.authService.logout();

    this.router.navigate(['/login']);

  }

}