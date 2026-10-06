import { Routes } from '@angular/router';

import {
  adminPermissionGuard,
  mainAdminGuard
} from './core/admin.guard';

import { schoolGuard } from './core/Auth/school.guard';

import { staffGuard } from './core/Auth/staff.guard';


// =====================================================
// SUB ADMIN
// =====================================================
//
// IMPORTANT:
// SubAdmins is imported directly instead of being loaded
// through loadComponent().
//
// This prevents Angular from attempting to JIT-compile
// the SubAdmins component at runtime.
// =====================================================

import { SubAdmins } from './pages/admin/sub-admins/sub-admins';


export const routes: Routes = [

  // =====================================================
  // ROOT
  // =====================================================

  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },


  // =====================================================
  // PUBLIC PAGES
  // =====================================================

  {
    path: 'home',
    loadComponent: () =>
      import('./pages/home/home')
        .then(m => m.Home)
  },

  {
    path: 'about',
    loadComponent: () =>
      import('./pages/about/about')
        .then(m => m.About)
  },

  {
    path: 'academics',
    loadComponent: () =>
      import('./pages/academics/academics')
        .then(m => m.Academics)
  },

  {
    path: 'admissions/apply',
    loadComponent: () =>
      import('./pages/admissions/apply/apply')
        .then(m => m.Apply)
  },

  {
    path: 'admissions/payment/:applicationId',
    loadComponent: () =>
      import('./pages/admissions/admission-payments/admission-payments')
        .then(m => m.AdmissionPayment)
  },

  {
    path: 'admissions',
    loadComponent: () =>
      import('./pages/admissions/admissions')
        .then(m => m.Admissions)
  },

  {
    path: 'classes',
    loadComponent: () =>
      import('./pages/classes/classes')
        .then(m => m.Classes)
  },

  {
    path: 'staff',
    loadComponent: () =>
      import('./pages/staff/staff')
        .then(m => m.Staff)
  },

  {
    path: 'news',
    loadComponent: () =>
      import('./pages/news/news')
        .then(m => m.News)
  },

  {
    path: 'events',
    loadComponent: () =>
      import('./pages/events/events')
        .then(m => m.Events)
  },

  {
    path: 'gallery',
    loadComponent: () =>
      import('./pages/gallery/gallery')
        .then(m => m.Gallery)
  },

  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact')
        .then(m => m.Contact)
  },


  // =====================================================
  // ADMIN LOGIN
  // =====================================================

  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin/admin-login/admin-login')
        .then(m => m.AdminLogin)
  },


  // =====================================================
  // ADMIN DASHBOARD
  // =====================================================

  {
    path: 'admin/dashboard',

    canActivate: [
      adminPermissionGuard('dashboard')
    ],

    loadComponent: () =>
      import('./pages/admin/admin-dashboard/admin-dashboard')
        .then(m => m.AdminDashboard)
  },


  // =====================================================
  // ADMIN ADMISSIONS
  // =====================================================

  {
    path: 'admin/admissions',

    canActivate: [
      adminPermissionGuard('admissions')
    ],

    loadComponent: () =>
      import('./pages/admin/admissions/admissions')
        .then(m => m.Admissions)
  },


  // =====================================================
  // ADMIN STUDENTS
  // =====================================================

  {
    path: 'admin/students',

    canActivate: [
      adminPermissionGuard('students')
    ],

    loadComponent: () =>
      import('./pages/admin/students/students')
        .then(m => m.Students)
  },


  // =====================================================
  // ADMIN NEWS
  // =====================================================

  {
    path: 'admin/news',

    canActivate: [
      adminPermissionGuard('news')
    ],

    loadComponent: () =>
      import('./pages/admin/news/news')
        .then(m => m.AdminNews)
  },


  // =====================================================
  // ADMIN EVENTS
  // =====================================================

  {
    path: 'admin/events',

    canActivate: [
      adminPermissionGuard('events')
    ],

    loadComponent: () =>
      import('./pages/admin/events/events')
        .then(m => m.AdminEvents)
  },


  // =====================================================
  // ADMIN GALLERY
  // =====================================================

  {
    path: 'admin/gallery',

    canActivate: [
      adminPermissionGuard('gallery')
    ],

    loadComponent: () =>
      import('./pages/admin/admin-gallery/admin-gallery')
        .then(m => m.AdminGallery)
  },


  // =====================================================
  // ADMIN SCHOOL FEES
  // =====================================================

  {
    path: 'admin/fees',

    canActivate: [
      adminPermissionGuard('fees')
    ],

    loadComponent: () =>
      import('./pages/admin/admin-fees/admin-fees')
        .then(m => m.AdminFees)
  },


  // =====================================================
  // ADMIN PAYMENTS
  // =====================================================

  {
    path: 'admin/payments',

    canActivate: [
      adminPermissionGuard('payments')
    ],

    loadComponent: () =>
      import('./pages/admin/admin-payments/admin-payments')
        .then(m => m.AdminPayments)
  },


  // =====================================================
  // ADMIN PARENTS & GUARDIANS
  // =====================================================

  {
    path: 'admin/parents',

    canActivate: [
      adminPermissionGuard('parents')
    ],

    loadComponent: () =>
      import('./pages/admin/parents/parents')
        .then(m => m.Parents)
  },


  // =====================================================
  // ADMIN TEACHERS & STAFF
  // =====================================================

  {
    path: 'admin/staff',

    canActivate: [
      adminPermissionGuard('staff')
    ],

    loadComponent: () =>
      import('./pages/admin/staff/staff')
        .then(m => m.Staff)
  },


  // =====================================================
  // ADMIN MESSAGES
  // =====================================================

  {
    path: 'admin/messages',

    canActivate: [
      adminPermissionGuard('messages')
    ],

    loadComponent: () =>
      import('./pages/admin/admin-messages/admin-messages')
        .then(m => m.AdminMessages)
  },


  // =====================================================
  // ADMIN SUB ADMINS
  // =====================================================
  //
  // IMPORTANT:
  // This section is MAIN ADMIN ONLY.
  //
  // Sub-admins can manage school modules according to
  // their permissions, but they cannot create, edit,
  // deactivate, or manage other sub-admin accounts.
  //
  // SubAdmins is intentionally loaded directly rather
  // than through loadComponent() to avoid the runtime
  // JIT compilation error.
  // =====================================================

  {
    path: 'admin/sub-admins',

    canActivate: [
      mainAdminGuard
    ],

    component: SubAdmins
  },


  // =====================================================
  // ADMIN CLASSES
  // =====================================================

  {
    path: 'admin/classes',

    canActivate: [
      adminPermissionGuard('classes')
    ],

    loadComponent: () =>
      import('./pages/admin/classes/classes')
        .then(m => m.Classes)
  },


  // =====================================================
  // ADMIN SUBJECTS
  // =====================================================

  {
    path: 'admin/subjects',

    canActivate: [
      adminPermissionGuard('subjects')
    ],

    loadComponent: () =>
      import('./pages/admin/subjects/subjects')
        .then(m => m.Subjects)
  },


  // =====================================================
  // ADMIN TEACHING ASSIGNMENTS
  // =====================================================

  {
    path: 'admin/teaching-assignments',

    canActivate: [
      adminPermissionGuard('teachingAssignments')
    ],

    loadComponent: () =>
      import('./pages/admin/teaching-assignment/teaching-assignment')
        .then(m => m.TeachingAssignments)
  },


  // =====================================================
  // ADMIN ACADEMICS
  // =====================================================

  {
    path: 'admin/academics',

    canActivate: [
      adminPermissionGuard('academics')
    ],

    loadComponent: () =>
      import('./pages/admin/academics/academics')
        .then(m => m.Academics)
  },


  // =====================================================
  // ADMIN RESULTS
  // =====================================================

  {
    path: 'admin/academics/results',

    canActivate: [
      adminPermissionGuard('results')
    ],

    loadComponent: () =>
      import('./pages/admin/academics/results/results')
        .then(m => m.Results)
  },


  // =====================================================
  // ADMIN REPORT CARDS
  // =====================================================

  {
    path: 'admin/academics/report-cards',

    canActivate: [
      adminPermissionGuard('results')
    ],

    loadComponent: () =>
      import('./pages/admin/academics/report-card/report-card')
        .then(m => m.ReportCards)
  },


  // =====================================================
  // SCHOOL LOGIN
  // =====================================================

  {
    path: 'login',

    loadComponent: () =>
      import('./pages/auth/school-login/school-login')
        .then(m => m.SchoolLogin)
  },


  // =====================================================
  // STUDENT ROUTES
  // =====================================================

  {
    path: 'student/dashboard',

    loadComponent: () =>
      import('./pages/student-dashboard/student-dashboard')
        .then(m => m.StudentDashboard),

    canActivate: [
      schoolGuard
    ]

  },

  {
    path: 'student/messeges',

    loadComponent: () =>
      import('./pages/student-messeges/student-messeges')
        .then(m => m.StudentMessage),

    canActivate: [
      schoolGuard
    ]

  },


  // =====================================================
  // PARENT ROUTES
  // =====================================================

  {
    path: 'parent/dashboard',

    loadComponent: () =>
      import('./pages/parent-dashboard/parent-dashboard')
        .then(m => m.ParentDashboard),

    canActivate: [
      schoolGuard
    ]

  },


  // =====================================================
  // PARENT MESSAGES
  // =====================================================

  {
    path: 'parent/messages',

    canActivate: [
      schoolGuard
    ],

    loadComponent: () =>
      import('./pages/parent-messages/parent-messages')
        .then(m => m.ParentMessages)

  },


  // =====================================================
  // PARENT RESULTS
  // =====================================================

  {
    path: 'parent/results',

    canActivate: [
      schoolGuard
    ],

    loadComponent: () =>
      import('./pages/parent-results/parent-results')
        .then(m => m.ParentResult)

  },


  // =====================================================
  // PARENT REPORT CARD
  // =====================================================

  {
    path: 'parent/report-card',

    canActivate: [
      schoolGuard
    ],

    loadComponent: () =>
      import('./pages/parent-reportcard/parent-reportcard')
        .then(m => m.ParentReportCard)

  },


  // =====================================================
  // PARENT FEES
  // =====================================================

  {
    path: 'parent/fees',

    canActivate: [
      schoolGuard
    ],

    loadComponent: () =>
      import('./pages/parent-fees/parent-fees')
        .then(m => m.ParentFees)

  },


  // =====================================================
  // STAFF DASHBOARD
  // =====================================================

  {
    path: 'staff/dashboard',

    canActivate: [
      staffGuard
    ],

    loadComponent: () =>
      import('./pages/staff-dashboard/staff-dashboard')
        .then(m => m.StaffDashboard)

  },


  // =====================================================
  // STAFF CLASSES
  // =====================================================

  {
    path: 'staff/classes',

    canActivate: [
      staffGuard
    ],

    loadComponent: () =>
      import('./pages/staff-classes/staff-classes')
        .then(m => m.StaffClasses)

  },


  // =====================================================
  // STAFF STUDENTS
  // =====================================================

  {
    path: 'staff/students',

    canActivate: [
      staffGuard
    ],

    loadComponent: () =>
      import('./pages/staff-students/staff-students')
        .then(m => m.StaffStudents)

  },


  // =====================================================
  // STAFF RESULTS
  // =====================================================

  {
    path: 'staff/results',

    canActivate: [
      staffGuard
    ],

    loadComponent: () =>
      import('./pages/staff-results/staff-results')
        .then(m => m.StaffResult)

  },


  // =====================================================
  // STAFF ATTENDANCE
  // =====================================================

  {
    path: 'staff/attendance',

    canActivate: [
      staffGuard
    ],

    loadComponent: () =>
      import('./pages/staff-attendance/staff-attendance')
        .then(m => m.StaffAttendance)

  },


  // =====================================================
  // STAFF MESSAGES
  // =====================================================

  {
    path: 'staff/messages',

    canActivate: [
      staffGuard
    ],

    loadComponent: () =>
      import('./pages/staff-messeges/staff-messeges')
        .then(m => m.StaffMessages)

  },


  // =====================================================
  // FALLBACK
  // =====================================================

  {
    path: '**',
    redirectTo: 'home'
  }

];
