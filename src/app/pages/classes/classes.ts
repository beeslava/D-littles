import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  get,
  ref
} from 'firebase/database';

import { database } from '../../core/firebase.config';

interface SchoolClass {
  id: string;
  name: string;
  code: string;
  description: string;
  status: string;
  createdAt?: number;
}

@Component({
  selector: 'app-classes',
  standalone: true,

  imports: [
    CommonModule
  ],

  templateUrl: './classes.html',
  styleUrls: ['./classes.css']
})
export class Classes implements OnInit {

  classes: SchoolClass[] = [];

  loading = true;
  errorMessage = '';

  constructor(
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadClasses();
  }

  // =========================================================
  // LOAD CLASSES
  // =========================================================

  async loadClasses(): Promise<void> {

    this.loading = true;
    this.errorMessage = '';

    try {

      const snapshot = await get(
        ref(database, 'classes')
      );

      const loadedClasses: SchoolClass[] = [];

      if (snapshot.exists()) {

        const data = snapshot.val();

        Object.keys(data).forEach(id => {

          const item = data[id];

          // Only show active classes publicly
          if (
            item.status &&
            item.status.toLowerCase() !== 'active'
          ) {
            return;
          }

          loadedClasses.push({
            id,
            name: item.name || item.className || '',
            code: item.code || item.classCode || '',
            description: item.description || '',
            status: item.status || 'active',
            createdAt: item.createdAt || 0
          });

        });
      }

      // Sort alphabetically
      loadedClasses.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      this.classes = loadedClasses;

      console.log(
        'Public classes loaded:',
        this.classes
      );

    } catch (error) {

      console.error(
        'Error loading public classes:',
        error
      );

      this.errorMessage =
        'Unable to load classes at the moment. Please try again later.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();
    }
  }

}

