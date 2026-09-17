import { Routes } from '@angular/router';

import { adminGuard } from './core/admin.guard';
import { schoolGuard } from './core/Auth/school.guard';

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
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/admin-dashboard/admin-dashboard')
        .then(m => m.AdminDashboard)
  },


  // =====================================================
  // ADMIN ADMISSIONS
  // =====================================================

  {
    path: 'admin/admissions',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/admissions/admissions')
        .then(m => m.Admissions)
  },


  // =====================================================
  // ADMIN STUDENTS
  // =====================================================

  {
    path: 'admin/students',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/students/students')
        .then(m => m.Students)
  },


  // =====================================================
  // ADMIN PARENTS & GUARDIANS
  // =====================================================

  {
    path: 'admin/parents',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/parents/parents')
        .then(m => m.Parents)
  },


  // =====================================================
  // ADMIN TEACHERS & STAFF
  // =====================================================

  {
    path: 'admin/staff',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/staff/staff')
        .then(m => m.Staff)
  },


  // =====================================================
  // ADMIN CLASSES
  // =====================================================

  {
    path: 'admin/classes',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/classes/classes')
        .then(m => m.Classes)
  },

  {
  path: 'admin/subjects',
  loadComponent: () =>
    import('./pages/admin/subjects/subjects')
      .then(m => m.Subjects),
  canActivate: [adminGuard]
},

{
  path: 'admin/teaching-assignments',
  loadComponent: () =>
    import('./pages/admin/teaching-assignment/teaching-assignment')
      .then(m => m.TeachingAssignments),
  canActivate: [adminGuard]
},

{
  path: 'admin/academics',
  loadComponent: () =>
    import('./pages/admin/academics/academics')
      .then(m => m.Academics),
  canActivate: [adminGuard]
},

{
  path: 'admin/academics/results',
  loadComponent: () =>
    import('./pages/admin/academics/results/results')
      .then(m => m.Results),
  canActivate: [adminGuard]
},

{
  path: 'admin/academics/report-cards',
  loadComponent: () =>
    import('./pages/admin/academics/report-card/report-card')
      .then(m => m.ReportCards),
  canActivate: [adminGuard]
},


{
  path: 'login',
  loadComponent: () =>
    import('./pages/auth/school-login/school-login')
      .then(m => m.SchoolLogin)
},

{
  path: 'student/dashboard',
  loadComponent: () =>
    import('./pages/student-dashboard/student-dashboard')
      .then(m => m.StudentDashboard),
  canActivate: [schoolGuard]
},


  // =====================================================
  // FALLBACK
  // =====================================================

  {
    path: '**',
    redirectTo: 'home'
  }

];