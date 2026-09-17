import {
  NgFor,
  NgIf,
  DatePipe
} from '@angular/common';

import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnInit
} from '@angular/core';

import {
  FormsModule
} from '@angular/forms';

import {
  get,
  push,
  ref,
  remove,
  update
} from 'firebase/database';

import { database } from '../../../core/firebase.config';


interface AcademicSession {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: number;
  updatedAt?: number;
}


interface AcademicTerm {
  id: string;
  sessionId: string;
  sessionName: string;
  name: 'First Term' | 'Second Term' | 'Third Term';
  status: 'active' | 'inactive';
  createdAt: number;
  updatedAt?: number;
}


@Component({
  selector: 'app-academics',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    FormsModule,
    DatePipe
  ],
  templateUrl: './academics.html',
  styleUrl: './academics.css'
})
export class Academics implements OnInit {

  // =========================================================
  // DATA
  // =========================================================

  sessions: AcademicSession[] = [];
  terms: AcademicTerm[] = [];


  // =========================================================
  // STATISTICS
  // =========================================================

  totalSessions = 0;
  activeSessions = 0;
  totalTerms = 0;
  activeTerms = 0;


  // =========================================================
  // FILTERS
  // =========================================================

  sessionSearchTerm = '';
  termSearchTerm = '';

  sessionStatusFilter = '';
  termStatusFilter = '';


  // =========================================================
  // LOADING / SAVING STATES
  // =========================================================

  loading = false;

  savingSession = false;
  updatingSession = false;
  deletingSession = false;

  savingTerm = false;
  updatingTerm = false;
  deletingTerm = false;


  // =========================================================
  // MESSAGES
  // =========================================================

  successMessage = '';
  errorMessage = '';


  // =========================================================
  // SESSION MODALS
  // =========================================================

  showAddSession = false;
  showSessionDetails = false;
  showEditSession = false;
  showDeleteSession = false;


  // =========================================================
  // TERM MODALS
  // =========================================================

  showAddTerm = false;
  showTermDetails = false;
  showEditTerm = false;
  showDeleteTerm = false;


  // =========================================================
  // SELECTED RECORDS
  // =========================================================

  selectedSession: AcademicSession | null = null;
  sessionToDelete: AcademicSession | null = null;

  selectedTerm: AcademicTerm | null = null;
  termToDelete: AcademicTerm | null = null;


  // =========================================================
  // NEW SESSION
  // =========================================================

  newSession = {
    name: '',
    status: 'active' as 'active' | 'inactive'
  };


  // =========================================================
  // EDIT SESSION
  // =========================================================

  editSessionData = {
    id: '',
    name: '',
    status: 'active' as 'active' | 'inactive'
  };


  // =========================================================
  // NEW TERM
  // =========================================================

  newTerm = {
    sessionId: '',
    name: '' as 'First Term' | 'Second Term' | 'Third Term' | '',
    status: 'active' as 'active' | 'inactive'
  };


  // =========================================================
  // EDIT TERM
  // =========================================================

  editTermData = {
    id: '',
    sessionId: '',
    name: '' as 'First Term' | 'Second Term' | 'Third Term' | '',
    status: 'active' as 'active' | 'inactive'
  };


  // =========================================================
  // TERM OPTIONS
  // =========================================================

  readonly termOptions = [
    'First Term',
    'Second Term',
    'Third Term'
  ];


  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}


  // =========================================================
  // INITIALIZATION
  // =========================================================

  ngOnInit(): void {
    this.loadData();
  }


  // =========================================================
  // LOAD ALL DATA
  // =========================================================

  async loadData(): Promise<void> {

    this.loading = true;
    this.clearMessages();

    this.cdr.detectChanges();

    try {

      await this.loadSessions();
      await this.loadTerms();

      this.ngZone.run(() => {
        this.calculateStatistics();
      });

    } catch (error) {

      console.error(
        'Error loading academic data:',
        error
      );

      this.ngZone.run(() => {
        this.errorMessage =
          'Unable to load academic data. Please try again.';
      });

    } finally {

      this.ngZone.run(() => {
        this.loading = false;
        this.cdr.detectChanges();
      });

    }
  }


  // =========================================================
  // LOAD SESSIONS
  // =========================================================

  async loadSessions(): Promise<void> {

    const snapshot = await get(
      ref(database, 'academicSessions')
    );

    if (!snapshot.exists()) {
      this.sessions = [];
      return;
    }

    const data = snapshot.val();

    this.sessions = Object.entries(data)
      .map(([id, value]: [string, any]) => ({
        id,
        name: value.name || '',
        status: value.status || 'inactive',
        createdAt: value.createdAt || 0,
        updatedAt: value.updatedAt
      }))
      .sort((a, b) =>
        b.createdAt - a.createdAt
      );
  }


  // =========================================================
  // LOAD TERMS
  // =========================================================

  async loadTerms(): Promise<void> {

    const snapshot = await get(
      ref(database, 'academicTerms')
    );

    if (!snapshot.exists()) {
      this.terms = [];
      return;
    }

    const data = snapshot.val();

    this.terms = Object.entries(data)
      .map(([id, value]: [string, any]) => {

        const session = this.sessions.find(
          item => item.id === value.sessionId
        );

        return {
          id,
          sessionId: value.sessionId || '',
          sessionName:
            session?.name ||
            value.sessionName ||
            'Unknown Session',
          name: value.name || 'First Term',
          status: value.status || 'inactive',
          createdAt: value.createdAt || 0,
          updatedAt: value.updatedAt
        };

      })
      .sort((a, b) =>
        b.createdAt - a.createdAt
      );
  }


  // =========================================================
  // STATISTICS
  // =========================================================

  calculateStatistics(): void {

    this.totalSessions =
      this.sessions.length;

    this.activeSessions =
      this.sessions.filter(
        session => session.status === 'active'
      ).length;

    this.totalTerms =
      this.terms.length;

    this.activeTerms =
      this.terms.filter(
        term => term.status === 'active'
      ).length;
  }


  // =========================================================
  // FILTERED SESSIONS
  // =========================================================

  get filteredSessions(): AcademicSession[] {

    const search =
      this.sessionSearchTerm
        .trim()
        .toLowerCase();

    return this.sessions.filter(session => {

      const matchesSearch =
        !search ||
        session.name
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        !this.sessionStatusFilter ||
        session.status === this.sessionStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }


  // =========================================================
  // FILTERED TERMS
  // =========================================================

  get filteredTerms(): AcademicTerm[] {

    const search =
      this.termSearchTerm
        .trim()
        .toLowerCase();

    return this.terms.filter(term => {

      const matchesSearch =
        !search ||
        term.name
          .toLowerCase()
          .includes(search) ||
        term.sessionName
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        !this.termStatusFilter ||
        term.status === this.termStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }


  // =========================================================
  // SESSION — ADD
  // =========================================================

  openAddSession(): void {

    this.clearMessages();

    this.newSession = {
      name: '',
      status: 'active'
    };

    this.showAddSession = true;
  }


  closeAddSession(): void {
    this.showAddSession = false;
  }


  async saveSession(): Promise<void> {

    const name =
      this.newSession.name.trim();

    if (!name) {

      this.errorMessage =
        'Please enter an academic session.';

      return;
    }


    const duplicate =
      this.sessions.some(
        session =>
          session.name.toLowerCase() ===
          name.toLowerCase()
      );

    if (duplicate) {

      this.errorMessage =
        'This academic session already exists.';

      return;
    }


    this.savingSession = true;
    this.clearMessages();


    try {

      const sessionRef =
        push(ref(database, 'academicSessions'));

      const now = Date.now();

      const session: AcademicSession = {
        id: sessionRef.key!,
        name,
        status: this.newSession.status,
        createdAt: now
      };


      await update(
        sessionRef,
        session
      );


      this.ngZone.run(() => {

        this.sessions.unshift(session);

        this.calculateStatistics();

        this.successMessage =
          'Academic session added successfully.';

        this.showAddSession = false;

        this.resetSessionForm();

        this.savingSession = false;

        this.cdr.detectChanges();
      });


    } catch (error) {

      console.error(
        'Error saving academic session:',
        error
      );

      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to save academic session. Please try again.';

        this.savingSession = false;

        this.cdr.detectChanges();
      });
    }
  }


  // =========================================================
  // SESSION — VIEW
  // =========================================================

  viewSession(
    session: AcademicSession
  ): void {

    this.clearMessages();

    this.selectedSession =
      session;

    this.showSessionDetails = true;
  }


  closeSessionDetails(): void {

    this.showSessionDetails = false;

    this.selectedSession = null;
  }


  // =========================================================
  // SESSION — EDIT
  // =========================================================

  openEditSession(
    session: AcademicSession
  ): void {

    this.clearMessages();

    this.editSessionData = {
      id: session.id,
      name: session.name,
      status: session.status
    };

    this.showEditSession = true;
  }


  closeEditSession(): void {
    this.showEditSession = false;
  }


  async updateSession(): Promise<void> {

    const name =
      this.editSessionData.name.trim();

    if (!name) {

      this.errorMessage =
        'Please enter an academic session.';

      return;
    }


    const duplicate =
      this.sessions.some(
        session =>
          session.id !==
            this.editSessionData.id &&
          session.name.toLowerCase() ===
            name.toLowerCase()
      );

    if (duplicate) {

      this.errorMessage =
        'This academic session already exists.';

      return;
    }


    this.updatingSession = true;
    this.clearMessages();


    try {

      const now = Date.now();

      await update(
        ref(
          database,
          `academicSessions/${this.editSessionData.id}`
        ),
        {
          name,
          status:
            this.editSessionData.status,
          updatedAt: now
        }
      );


      this.ngZone.run(() => {

        const index =
          this.sessions.findIndex(
            session =>
              session.id ===
              this.editSessionData.id
          );


        if (index !== -1) {

          this.sessions[index] = {
            ...this.sessions[index],
            name,
            status:
              this.editSessionData.status,
            updatedAt: now
          };
        }


        this.terms =
          this.terms.map(term => {

            if (
              term.sessionId ===
              this.editSessionData.id
            ) {

              return {
                ...term,
                sessionName: name
              };
            }

            return term;
          });


        this.calculateStatistics();

        this.successMessage =
          'Academic session updated successfully.';

        this.showEditSession = false;

        this.updatingSession = false;

        this.cdr.detectChanges();
      });


    } catch (error) {

      console.error(
        'Error updating academic session:',
        error
      );

      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to update academic session. Please try again.';

        this.updatingSession = false;

        this.cdr.detectChanges();
      });
    }
  }


  // =========================================================
  // SESSION — DELETE
  // =========================================================

  openDeleteSession(
    session: AcademicSession
  ): void {

    this.clearMessages();

    this.sessionToDelete =
      session;

    this.showDeleteSession = true;
  }


  closeDeleteSession(): void {

    this.showDeleteSession = false;

    this.sessionToDelete = null;
  }


  async deleteSession(): Promise<void> {

    if (!this.sessionToDelete) {
      return;
    }


    const session =
      this.sessionToDelete;


    const hasTerms =
      this.terms.some(
        term =>
          term.sessionId ===
          session.id
      );


    if (hasTerms) {

      this.errorMessage =
        'This session cannot be deleted because it has academic terms. Delete the terms first.';

      return;
    }


    this.deletingSession = true;
    this.clearMessages();


    try {

      await remove(
        ref(
          database,
          `academicSessions/${session.id}`
        )
      );


      this.ngZone.run(() => {

        this.sessions =
          this.sessions.filter(
            item =>
              item.id !== session.id
          );

        this.calculateStatistics();

        this.successMessage =
          'Academic session deleted successfully.';

        this.showDeleteSession = false;

        this.sessionToDelete = null;

        this.deletingSession = false;

        this.cdr.detectChanges();
      });


    } catch (error) {

      console.error(
        'Error deleting academic session:',
        error
      );

      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to delete academic session. Please try again.';

        this.deletingSession = false;

        this.cdr.detectChanges();
      });
    }
  }


  // =========================================================
  // TERM — ADD
  // =========================================================

  openAddTerm(): void {

    this.clearMessages();

    this.newTerm = {
      sessionId: '',
      name: '',
      status: 'active'
    };

    this.showAddTerm = true;
  }


  closeAddTerm(): void {
    this.showAddTerm = false;
  }


  async saveTerm(): Promise<void> {

    if (!this.newTerm.sessionId) {

      this.errorMessage =
        'Please select an academic session.';

      return;
    }


    if (!this.newTerm.name) {

      this.errorMessage =
        'Please select a term.';

      return;
    }


    const duplicate =
      this.terms.some(
        term =>
          term.sessionId ===
            this.newTerm.sessionId &&
          term.name ===
            this.newTerm.name
      );


    if (duplicate) {

      this.errorMessage =
        'This term already exists for the selected academic session.';

      return;
    }


    this.savingTerm = true;
    this.clearMessages();


    try {

      const session =
        this.sessions.find(
          item =>
            item.id ===
            this.newTerm.sessionId
        );


      const termRef =
        push(ref(database, 'academicTerms'));

      const now = Date.now();

      const term: AcademicTerm = {
        id: termRef.key!,
        sessionId:
          this.newTerm.sessionId,
        sessionName:
          session?.name ||
          'Unknown Session',
        name:
          this.newTerm.name as
            'First Term' |
            'Second Term' |
            'Third Term',
        status:
          this.newTerm.status,
        createdAt: now
      };


      await update(
        termRef,
        term
      );


      this.ngZone.run(() => {

        this.terms.unshift(term);

        this.calculateStatistics();

        this.successMessage =
          'Academic term added successfully.';

        this.showAddTerm = false;

        this.resetTermForm();

        this.savingTerm = false;

        this.cdr.detectChanges();
      });


    } catch (error) {

      console.error(
        'Error saving academic term:',
        error
      );

      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to save academic term. Please try again.';

        this.savingTerm = false;

        this.cdr.detectChanges();
      });
    }
  }


  // =========================================================
  // TERM — VIEW
  // =========================================================

  viewTerm(
    term: AcademicTerm
  ): void {

    this.clearMessages();

    this.selectedTerm =
      term;

    this.showTermDetails = true;
  }


  closeTermDetails(): void {

    this.showTermDetails = false;

    this.selectedTerm = null;
  }


  // =========================================================
  // TERM — EDIT
  // =========================================================

  openEditTerm(
    term: AcademicTerm
  ): void {

    this.clearMessages();

    this.editTermData = {
      id: term.id,
      sessionId: term.sessionId,
      name: term.name,
      status: term.status
    };

    this.showEditTerm = true;
  }


  closeEditTerm(): void {
    this.showEditTerm = false;
  }


  async updateTerm(): Promise<void> {

    if (!this.editTermData.sessionId) {

      this.errorMessage =
        'Please select an academic session.';

      return;
    }


    if (!this.editTermData.name) {

      this.errorMessage =
        'Please select a term.';

      return;
    }


    const duplicate =
      this.terms.some(
        term =>
          term.id !==
            this.editTermData.id &&
          term.sessionId ===
            this.editTermData.sessionId &&
          term.name ===
            this.editTermData.name
      );


    if (duplicate) {

      this.errorMessage =
        'This term already exists for the selected academic session.';

      return;
    }


    this.updatingTerm = true;
    this.clearMessages();


    try {

      const session =
        this.sessions.find(
          item =>
            item.id ===
            this.editTermData.sessionId
        );


      const now = Date.now();


      await update(
        ref(
          database,
          `academicTerms/${this.editTermData.id}`
        ),
        {
          sessionId:
            this.editTermData.sessionId,
          sessionName:
            session?.name ||
            'Unknown Session',
          name:
            this.editTermData.name,
          status:
            this.editTermData.status,
          updatedAt: now
        }
      );


      this.ngZone.run(() => {

        const index =
          this.terms.findIndex(
            term =>
              term.id ===
              this.editTermData.id
          );


        if (index !== -1) {

          this.terms[index] = {
            ...this.terms[index],
            sessionId:
              this.editTermData.sessionId,
            sessionName:
              session?.name ||
              'Unknown Session',
            name:
              this.editTermData.name as
                'First Term' |
                'Second Term' |
                'Third Term',
            status:
              this.editTermData.status,
            updatedAt: now
          };
        }


        this.calculateStatistics();

        this.successMessage =
          'Academic term updated successfully.';

        this.showEditTerm = false;

        this.updatingTerm = false;

        this.cdr.detectChanges();
      });


    } catch (error) {

      console.error(
        'Error updating academic term:',
        error
      );

      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to update academic term. Please try again.';

        this.updatingTerm = false;

        this.cdr.detectChanges();
      });
    }
  }


  // =========================================================
  // TERM — DELETE
  // =========================================================

  openDeleteTerm(
    term: AcademicTerm
  ): void {

    this.clearMessages();

    this.termToDelete =
      term;

    this.showDeleteTerm = true;
  }


  closeDeleteTerm(): void {

    this.showDeleteTerm = false;

    this.termToDelete = null;
  }


  async deleteTerm(): Promise<void> {

    if (!this.termToDelete) {
      return;
    }


    const term =
      this.termToDelete;


    this.deletingTerm = true;
    this.clearMessages();


    try {

      await remove(
        ref(
          database,
          `academicTerms/${term.id}`
        )
      );


      this.ngZone.run(() => {

        this.terms =
          this.terms.filter(
            item =>
              item.id !== term.id
          );

        this.calculateStatistics();

        this.successMessage =
          'Academic term deleted successfully.';

        this.showDeleteTerm = false;

        this.termToDelete = null;

        this.deletingTerm = false;

        this.cdr.detectChanges();
      });


    } catch (error) {

      console.error(
        'Error deleting academic term:',
        error
      );

      this.ngZone.run(() => {

        this.errorMessage =
          'Unable to delete academic term. Please try again.';

        this.deletingTerm = false;

        this.cdr.detectChanges();
      });
    }
  }


  // =========================================================
  // RESET FORMS
  // =========================================================

  resetSessionForm(): void {

    this.newSession = {
      name: '',
      status: 'active'
    };
  }


  resetTermForm(): void {

    this.newTerm = {
      sessionId: '',
      name: '',
      status: 'active'
    };
  }


  // =========================================================
  // CLEAR FILTERS
  // =========================================================

  clearSessionFilters(): void {

    this.sessionSearchTerm = '';
    this.sessionStatusFilter = '';
  }


  clearTermFilters(): void {

    this.termSearchTerm = '';
    this.termStatusFilter = '';
  }


  // =========================================================
  // CLEAR MESSAGES
  // =========================================================

  clearMessages(): void {

    this.successMessage = '';
    this.errorMessage = '';
  }
}

