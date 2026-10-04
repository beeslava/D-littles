import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  get,
  ref,
  query,
  orderByChild,
  equalTo
} from 'firebase/database';

import { database } from '../../core/firebase.config';

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
  selector: 'app-events',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './events.html',
  styleUrls: ['./events.css']
})
export class Events implements OnInit {

  events: SchoolEvent[] = [];
  filteredEvents: SchoolEvent[] = [];

  selectedEvent: SchoolEvent | null = null;

  searchTerm = '';

  loading = true;
  errorMessage = '';

  constructor(
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  // =========================================================
  // LOAD PUBLISHED EVENTS
  // =========================================================

  async loadEvents(): Promise<void> {

    this.loading = true;
    this.errorMessage = '';

    try {

      const eventsQuery = query(
        ref(database, 'events'),
        orderByChild('status'),
        equalTo('published')
      );

      const snapshot = await get(eventsQuery);

      const loadedEvents: SchoolEvent[] = [];

      if (snapshot.exists()) {

        const data = snapshot.val();

        Object.keys(data).forEach(id => {

          const event = data[id];

          loadedEvents.push({
            id,
            title: event.title || '',
            description: event.description || '',
            date: event.date || '',
            startTime: event.startTime || '',
            endTime: event.endTime || '',
            venue: event.venue || '',
            status: event.status || 'published',
            createdAt: event.createdAt || 0,
            updatedAt: event.updatedAt || 0
          });

        });
      }

      // Sort by event date and start time
      loadedEvents.sort((a, b) => {

        const dateA = new Date(
          `${a.date}T${a.startTime || '00:00'}`
        ).getTime();

        const dateB = new Date(
          `${b.date}T${b.startTime || '00:00'}`
        ).getTime();

        return dateA - dateB;
      });

      this.events = loadedEvents;

      this.applyFilters();

      console.log(
        'Published events loaded:',
        this.events
      );

    } catch (error) {

      console.error(
        'Error loading public events:',
        error
      );

      this.errorMessage =
        'Unable to load events at the moment. Please try again later.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();
    }
  }

  // =========================================================
  // SEARCH
  // =========================================================

  applyFilters(): void {

    const search = this.searchTerm
      .trim()
      .toLowerCase();

    this.filteredEvents = this.events.filter(event => {

      if (!search) {
        return true;
      }

      return (
        event.title.toLowerCase().includes(search) ||
        event.description.toLowerCase().includes(search) ||
        event.venue.toLowerCase().includes(search)
      );

    });
  }

  // =========================================================
  // EVENT DETAILS
  // =========================================================

  openEvent(event: SchoolEvent): void {

    this.selectedEvent = event;

    document.body.style.overflow = 'hidden';
  }

  closeEvent(): void {

    this.selectedEvent = null;

    document.body.style.overflow = '';
  }

  // =========================================================
  // DATE FORMATTING
  // =========================================================

  formatDate(date: string): string {

    if (!date) {
      return '';
    }

    const parsedDate = new Date(`${date}T00:00:00`);

    if (isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString(
      'en-GB',
      {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }
    );
  }

  // =========================================================
  // DAY
  // =========================================================

  getDay(date: string): string {

    if (!date) {
      return '';
    }

    const parsedDate = new Date(`${date}T00:00:00`);

    if (isNaN(parsedDate.getTime())) {
      return '';
    }

    return parsedDate.toLocaleDateString(
      'en-GB',
      {
        weekday: 'short'
      }
    );
  }

  // =========================================================
  // MONTH
  // =========================================================

  getMonth(date: string): string {

    if (!date) {
      return '';
    }

    const parsedDate = new Date(`${date}T00:00:00`);

    if (isNaN(parsedDate.getTime())) {
      return '';
    }

    return parsedDate.toLocaleDateString(
      'en-GB',
      {
        month: 'short'
      }
    );
  }

  // =========================================================
  // DAY NUMBER
  // =========================================================

  getDayNumber(date: string): string {

    if (!date) {
      return '';
    }

    const parsedDate = new Date(`${date}T00:00:00`);

    if (isNaN(parsedDate.getTime())) {
      return '';
    }

    return parsedDate.toLocaleDateString(
      'en-GB',
      {
        day: '2-digit'
      }
    );
  }

  // =========================================================
  // TIME FORMATTING
  // =========================================================

  formatTime(time: string): string {

    if (!time) {
      return '';
    }

    const parts = time.split(':');

    if (parts.length < 2) {
      return time;
    }

    let hour = Number(parts[0]);
    const minute = parts[1];

    const period = hour >= 12
      ? 'PM'
      : 'AM';

    hour = hour % 12;

    if (hour === 0) {
      hour = 12;
    }

    return `${hour}:${minute} ${period}`;
  }

  // =========================================================
  // CLOSE MODAL WHEN CLICKING BACKDROP
  // =========================================================

  onBackdropClick(event: MouseEvent): void {

    if (
      event.target === event.currentTarget
    ) {
      this.closeEvent();
    }
  }

}

