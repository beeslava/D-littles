import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  get,
  push,
  ref,
  remove,
  update
} from 'firebase/database';
import { AdminAuthService } from '../../../core/Auth/admin-auth.service';
import { database } from '../../../core/firebase.config';




interface SchoolEvent {
  id: string;

  title: string;
  description: string;

  date: string;
  startTime: string;
  endTime: string;

  venue: string;

  status: 'draft' | 'published';

  createdAt?: number;
  updatedAt?: number;
}


@Component({
  selector: 'app-admin-events',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './events.html',
  styleUrls: ['./events.css']
})
export class AdminEvents implements OnInit {

  // =========================================================
  // EVENTS
  // =========================================================

  events: SchoolEvent[] = [];

  filteredEvents: SchoolEvent[] = [];


  // =========================================================
  // FORM
  // =========================================================

  showForm = false;

  editingEventId = '';

  formTitle = '';

  formDescription = '';

  formDate = '';

  formStartTime = '';

  formEndTime = '';

  formVenue = '';

  formStatus: 'draft' | 'published' = 'draft';


  // =========================================================
  // STATE
  // =========================================================

  loading = false;

  saving = false;

  deleting = false;

  errorMessage = '';

  successMessage = '';


  // =========================================================
  // SEARCH
  // =========================================================

  searchTerm = '';

  statusFilter = 'all';


  constructor(
    private authService: AdminAuthService,
    private cdr: ChangeDetectorRef
  ) {}


  // =========================================================
  // INIT
  // =========================================================

  async ngOnInit(): Promise<void> {

    await this.loadEvents();

  }


  // =========================================================
  // LOAD EVENTS
  // =========================================================

  async loadEvents(): Promise<void> {

    try {

      this.loading = true;

      this.clearMessages();

      const snapshot = await get(
        ref(database, 'events')
      );


      if (!snapshot.exists()) {

        this.events = [];

        this.filteredEvents = [];

        return;
      }


      const data = snapshot.val();

      const loadedEvents: SchoolEvent[] = [];


      Object.entries(data).forEach(
        ([id, value]: [string, any]) => {

          loadedEvents.push({

            id,

            title:
              value.title || '',

            description:
              value.description || '',

            date:
              value.date || '',

            startTime:
              value.startTime || '',

            endTime:
              value.endTime || '',

            venue:
              value.venue || '',

            status:
              value.status === 'published'
                ? 'published'
                : 'draft',

            createdAt:
              value.createdAt || 0,

            updatedAt:
              value.updatedAt || 0

          });

        }
      );


      loadedEvents.sort(
        (a, b) => {

          const dateA =
            new Date(
              `${a.date}T${a.startTime || '00:00'}`
            ).getTime();

          const dateB =
            new Date(
              `${b.date}T${b.startTime || '00:00'}`
            ).getTime();

          return dateA - dateB;

        }
      );


      this.events = loadedEvents;

      this.applyFilters();


      console.log(
        'Events loaded:',
        this.events
      );

    } catch (error) {

      console.error(
        'Error loading events:',
        error
      );

      this.errorMessage =
        'Unable to load school events.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // APPLY FILTERS
  // =========================================================

  applyFilters(): void {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    this.filteredEvents =
      this.events.filter(
        event => {

          const matchesSearch =
            !search ||
            event.title
              .toLowerCase()
              .includes(search) ||
            event.description
              .toLowerCase()
              .includes(search) ||
            event.venue
              .toLowerCase()
              .includes(search);


          const matchesStatus =
            this.statusFilter === 'all' ||
            event.status === this.statusFilter;


          return (
            matchesSearch &&
            matchesStatus
          );

        }
      );

  }


  // =========================================================
  // OPEN CREATE FORM
  // =========================================================

  openCreateForm(): void {

    this.clearMessages();

    this.editingEventId = '';

    this.formTitle = '';

    this.formDescription = '';

    this.formDate = '';

    this.formStartTime = '';

    this.formEndTime = '';

    this.formVenue = '';

    this.formStatus = 'draft';

    this.showForm = true;

  }


  // =========================================================
  // OPEN EDIT FORM
  // =========================================================

  openEditForm(
    event: SchoolEvent
  ): void {

    this.clearMessages();

    this.editingEventId =
      event.id;

    this.formTitle =
      event.title;

    this.formDescription =
      event.description;

    this.formDate =
      event.date;

    this.formStartTime =
      event.startTime;

    this.formEndTime =
      event.endTime;

    this.formVenue =
      event.venue;

    this.formStatus =
      event.status;

    this.showForm = true;

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }


  // =========================================================
  // CLOSE FORM
  // =========================================================

  closeForm(): void {

    if (this.saving) {
      return;
    }

    this.showForm = false;

    this.resetForm();

  }


  // =========================================================
  // RESET FORM
  // =========================================================

  resetForm(): void {

    this.editingEventId = '';

    this.formTitle = '';

    this.formDescription = '';

    this.formDate = '';

    this.formStartTime = '';

    this.formEndTime = '';

    this.formVenue = '';

    this.formStatus = 'draft';

  }


  // =========================================================
  // SAVE EVENT
  // =========================================================

  async saveEvent(): Promise<void> {

    this.clearMessages();


    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (!this.formTitle.trim()) {

      this.errorMessage =
        'Please enter the event title.';

      return;
    }


    if (!this.formDescription.trim()) {

      this.errorMessage =
        'Please enter the event description.';

      return;
    }


    if (!this.formDate) {

      this.errorMessage =
        'Please select the event date.';

      return;
    }


    if (!this.formStartTime) {

      this.errorMessage =
        'Please enter the event start time.';

      return;
    }


    if (!this.formVenue.trim()) {

      this.errorMessage =
        'Please enter the event venue.';

      return;
    }


    try {

      this.saving = true;


      const currentUser =
        this.authService.getUser();


      if (!currentUser) {

        this.errorMessage =
          'Your admin session has expired. Please login again.';

        return;
      }


      const now =
        Date.now();


      // =====================================================
      // EDIT EXISTING EVENT
      // =====================================================

      if (this.editingEventId) {

        const eventRef =
          ref(
            database,
            `events/${this.editingEventId}`
          );


        await update(
          eventRef,
          {

            title:
              this.formTitle.trim(),

            description:
              this.formDescription.trim(),

            date:
              this.formDate,

            startTime:
              this.formStartTime,

            endTime:
              this.formEndTime || '',

            venue:
              this.formVenue.trim(),

            status:
              this.formStatus,

            updatedAt:
              now

          }
        );


        this.successMessage =
          'Event updated successfully.';

      }


      // =====================================================
      // CREATE NEW EVENT
      // =====================================================

      else {

        const eventsRef =
          ref(
            database,
            'events'
          );


        const newEventRef =
          push(eventsRef);


        await update(
          newEventRef,
          {

            title:
              this.formTitle.trim(),

            description:
              this.formDescription.trim(),

            date:
              this.formDate,

            startTime:
              this.formStartTime,

            endTime:
              this.formEndTime || '',

            venue:
              this.formVenue.trim(),

            status:
              this.formStatus,

            createdAt:
              now,

            updatedAt:
              now,

            createdBy:
              currentUser.uid

          }
        );


        this.successMessage =
          'Event created successfully.';

      }


      this.showForm = false;

      this.resetForm();

      await this.loadEvents();


    } catch (error) {

      console.error(
        'Error saving event:',
        error
      );

      this.errorMessage =
        'Unable to save the event. Please try again.';

    } finally {

      this.saving = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // TOGGLE PUBLISH
  // =========================================================

  async togglePublish(
    event: SchoolEvent
  ): Promise<void> {

    this.clearMessages();


    try {

      const newStatus =
        event.status === 'published'
          ? 'draft'
          : 'published';


      await update(
        ref(
          database,
          `events/${event.id}`
        ),
        {

          status:
            newStatus,

          updatedAt:
            Date.now()

        }
      );


      this.successMessage =
        newStatus === 'published'
          ? 'Event published successfully.'
          : 'Event moved back to draft.';


      await this.loadEvents();


    } catch (error) {

      console.error(
        'Error changing event status:',
        error
      );

      this.errorMessage =
        'Unable to change the event status.';

    }

  }


  // =========================================================
  // DELETE EVENT
  // =========================================================

  async deleteEvent(
    event: SchoolEvent
  ): Promise<void> {

    this.clearMessages();


    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${event.title}"?`
      );


    if (!confirmed) {
      return;
    }


    try {

      this.deleting = true;


      await remove(
        ref(
          database,
          `events/${event.id}`
        )
      );


      this.successMessage =
        'Event deleted successfully.';


      await this.loadEvents();


    } catch (error) {

      console.error(
        'Error deleting event:',
        error
      );

      this.errorMessage =
        'Unable to delete the event.';

    } finally {

      this.deleting = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // FORMAT DATE
  // =========================================================

  formatDate(
    date: string
  ): string {

    if (!date) {
      return '—';
    }


    const parsedDate =
      new Date(
        `${date}T00:00:00`
      );


    if (isNaN(parsedDate.getTime())) {
      return date;
    }


    return parsedDate.toLocaleDateString(
      'en-NG',
      {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }
    );

  }


  // =========================================================
  // FORMAT TIME
  // =========================================================

  formatTime(
    time: string
  ): string {

    if (!time) {
      return '';
    }


    const parts =
      time.split(':');


    if (parts.length < 2) {
      return time;
    }


    const hour =
      Number(parts[0]);

    const minute =
      parts[1];


    const suffix =
      hour >= 12
        ? 'PM'
        : 'AM';


    const displayHour =
      hour % 12 || 12;


    return `${displayHour}:${minute} ${suffix}`;

  }


  // =========================================================
  // GET EVENT STATUS
  // =========================================================

  getStatusClass(
    status: string
  ): string {

    return status === 'published'
      ? 'status-published'
      : 'status-draft';

  }


  // =========================================================
  // CLEAR MESSAGES
  // =========================================================

  clearMessages(): void {

    this.errorMessage = '';

    this.successMessage = '';

  }


  // =========================================================
  // TRACK BY
  // =========================================================

  trackByEventId(
    index: number,
    event: SchoolEvent
  ): string {

    return event.id;

  }

}

