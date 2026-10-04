import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  get,
  ref,
  query,
  orderByChild,
  equalTo
} from 'firebase/database';

import { database } from '../../core/firebase.config';

interface GalleryItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  status: 'draft' | 'published';
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  createdBy?: string;
  createdByName?: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './gallery.html',
  styleUrls: ['./gallery.css']
})
export class Gallery implements OnInit {

  // =========================================================
  // DATA
  // =========================================================

  galleryItems: GalleryItem[] = [];

  filteredGalleryItems: GalleryItem[] = [];

  categories: string[] = [
    'All',
    'School Life',
    'Academics',
    'Sports',
    'Events',
    'Activities',
    'Facilities',
    'Students',
    'Staff',
    'Other'
  ];

  selectedCategory: string = 'All';

  searchTerm: string = '';

  loading: boolean = true;

  errorMessage: string = '';

  // =========================================================
  // MODAL
  // =========================================================

  selectedItem: GalleryItem | null = null;

  showModal: boolean = false;

  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(
    private cdr: ChangeDetectorRef
  ) {}

  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.loadGallery();
  }

  // =========================================================
  // LOAD GALLERY
  // =========================================================

  async loadGallery(): Promise<void> {

    this.loading = true;
    this.errorMessage = '';

    try {

      const galleryQuery = query(
        ref(database, 'gallery'),
        orderByChild('status'),
        equalTo('published')
      );

      const snapshot = await get(galleryQuery);

      const items: GalleryItem[] = [];

      if (snapshot.exists()) {

        snapshot.forEach(childSnapshot => {

          const data = childSnapshot.val() || {};

          items.push({
            id: childSnapshot.key || '',
            title: data.title || 'Untitled',
            description: data.description || '',
            imageUrl: data.imageUrl || '',
            category: data.category || 'Other',
            status: data.status || 'published',
            createdAt: Number(data.createdAt) || 0,
            updatedAt: Number(data.updatedAt) || 0,
            publishedAt: Number(data.publishedAt) || undefined,
            createdBy: data.createdBy || '',
            createdByName: data.createdByName || ''
          });

        });

      }

      // Newest published items first
      items.sort((a, b) => {

        const dateA =
          a.publishedAt ||
          a.createdAt ||
          0;

        const dateB =
          b.publishedAt ||
          b.createdAt ||
          0;

        return dateB - dateA;
      });

      this.galleryItems = items;

      this.applyFilters();

      this.loading = false;

      this.cdr.detectChanges();

      console.log(
        'Published gallery items loaded:',
        this.galleryItems.length
      );

    } catch (error) {

      console.error(
        'Error loading public gallery:',
        error
      );

      this.errorMessage =
        'Unable to load the gallery at the moment. Please try again later.';

      this.loading = false;

      this.cdr.detectChanges();
    }
  }

  // =========================================================
  // APPLY FILTERS
  // =========================================================

  applyFilters(): void {

    let items = [...this.galleryItems];

    // -------------------------------------------------------
    // CATEGORY FILTER
    // -------------------------------------------------------

    if (this.selectedCategory !== 'All') {

      items = items.filter(item =>
        item.category === this.selectedCategory
      );
    }

    // -------------------------------------------------------
    // SEARCH FILTER
    // -------------------------------------------------------

    const search = this.searchTerm
      .trim()
      .toLowerCase();

    if (search) {

      items = items.filter(item => {

        const title =
          (item.title || '').toLowerCase();

        const description =
          (item.description || '').toLowerCase();

        const category =
          (item.category || '').toLowerCase();

        return (
          title.includes(search) ||
          description.includes(search) ||
          category.includes(search)
        );

      });
    }

    this.filteredGalleryItems = items;
  }

  // =========================================================
  // CATEGORY
  // =========================================================

  selectCategory(category: string): void {

    this.selectedCategory = category;

    this.applyFilters();
  }

  // =========================================================
  // SEARCH
  // =========================================================

  onSearch(): void {

    this.applyFilters();
  }

  // =========================================================
  // OPEN IMAGE
  // =========================================================

  openImage(item: GalleryItem): void {

    this.selectedItem = item;

    this.showModal = true;

    document.body.style.overflow = 'hidden';
  }

  // =========================================================
  // CLOSE IMAGE
  // =========================================================

  closeModal(): void {

    this.showModal = false;

    this.selectedItem = null;

    document.body.style.overflow = '';
  }

  // =========================================================
  // PREVENT MODAL CLICK FROM CLOSING
  // =========================================================

  stopPropagation(event: Event): void {

    event.stopPropagation();
  }

  // =========================================================
  // IMAGE ERROR
  // =========================================================

  handleImageError(event: Event): void {

    const image =
      event.target as HTMLImageElement;

    image.style.display = 'none';
  }

  // =========================================================
  // DATE FORMAT
  // =========================================================

  formatDate(timestamp: number | undefined): string {

    if (!timestamp) {
      return '';
    }

    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString(
      'en-NG',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }
    );
  }

  // =========================================================
  // TRACK BY
  // =========================================================

  trackById(
    index: number,
    item: GalleryItem
  ): string {

    return item.id;
  }
}