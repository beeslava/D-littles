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

import { database } from '../../../core/firebase.config';
import { AdminAuthService } from '../../../core/Auth/admin-auth.service';

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
  selector: 'app-admin-gallery',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './admin-gallery.html',
  styleUrls: ['./admin-gallery.css']
})
export class AdminGallery implements OnInit {

  // =========================================================
  // DATA
  // =========================================================

  galleryItems: GalleryItem[] = [];

  filteredItems: GalleryItem[] = [];

  loading = false;
  saving = false;

  errorMessage = '';
  successMessage = '';

  searchTerm = '';
  selectedCategory = 'all';
  selectedStatus = 'all';

  showModal = false;
  editingItem: GalleryItem | null = null;

  // =========================================================
  // CATEGORIES
  // =========================================================

  categories: string[] = [
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

  // =========================================================
  // FORM
  // =========================================================

  form: GalleryItem = this.createEmptyForm();

  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(
    private adminAuthService: AdminAuthService,
    private cdr: ChangeDetectorRef
  ) {}

  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.loadGallery();
  }

  // =========================================================
  // CREATE EMPTY FORM
  // =========================================================

  createEmptyForm(): GalleryItem {
    return {
      id: '',
      title: '',
      description: '',
      imageUrl: '',
      category: 'School Life',
      status: 'draft',
      createdAt: 0,
      updatedAt: 0
    };
  }

  // =========================================================
  // LOAD GALLERY
  // =========================================================

  async loadGallery(): Promise<void> {

    this.loading = true;
    this.errorMessage = '';

    try {

      const snapshot = await get(
        ref(database, 'gallery')
      );

      this.galleryItems = [];

      if (snapshot.exists()) {

        const data = snapshot.val();

        Object.entries(data).forEach(
          ([id, value]: [string, any]) => {

            const item: GalleryItem = {
              id,

              title:
                typeof value.title === 'string'
                  ? value.title
                  : '',

              description:
                typeof value.description === 'string'
                  ? value.description
                  : '',

              imageUrl:
                typeof value.imageUrl === 'string'
                  ? value.imageUrl
                  : '',

              category:
                typeof value.category === 'string'
                  ? value.category
                  : 'Other',

              status:
                value.status === 'published'
                  ? 'published'
                  : 'draft',

              createdAt:
                typeof value.createdAt === 'number'
                  ? value.createdAt
                  : 0,

              updatedAt:
                typeof value.updatedAt === 'number'
                  ? value.updatedAt
                  : (
                      typeof value.createdAt === 'number'
                        ? value.createdAt
                        : 0
                    ),

              createdBy:
                typeof value.createdBy === 'string'
                  ? value.createdBy
                  : '',

              createdByName:
                typeof value.createdByName === 'string'
                  ? value.createdByName
                  : ''
            };

            /*
             * IMPORTANT:
             *
             * Do NOT assign:
             *
             * publishedAt: undefined
             *
             * Firebase does not allow undefined values.
             *
             * Only add publishedAt when it actually exists.
             */

            if (
              typeof value.publishedAt === 'number' &&
              value.publishedAt > 0
            ) {
              item.publishedAt = value.publishedAt;
            }

            this.galleryItems.push(item);
          }
        );
      }

      // =====================================================
      // SORT NEWEST FIRST
      // =====================================================

      this.galleryItems.sort(
        (a, b) =>
          (b.createdAt || 0) -
          (a.createdAt || 0)
      );

      this.applyFilters();

    } catch (error) {

      console.error(
        'Error loading gallery:',
        error
      );

      this.errorMessage =
        'Unable to load gallery items.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();
    }
  }

  // =========================================================
  // FILTERS
  // =========================================================

  applyFilters(): void {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();

    this.filteredItems =
      this.galleryItems.filter(item => {

        const matchesSearch =
          !search ||
          item.title
            .toLowerCase()
            .includes(search) ||
          item.description
            .toLowerCase()
            .includes(search) ||
          item.category
            .toLowerCase()
            .includes(search);

        const matchesCategory =
          this.selectedCategory === 'all' ||
          item.category === this.selectedCategory;

        const matchesStatus =
          this.selectedStatus === 'all' ||
          item.status === this.selectedStatus;

        return (
          matchesSearch &&
          matchesCategory &&
          matchesStatus
        );
      });
  }

  // =========================================================
  // SEARCH
  // =========================================================

  onSearchChange(): void {
    this.applyFilters();
  }

  // =========================================================
  // MODAL - CREATE
  // =========================================================

  openCreateModal(): void {

    this.editingItem = null;

    this.form =
      this.createEmptyForm();

    this.clearMessages();

    this.showModal = true;
  }

  // =========================================================
  // MODAL - EDIT
  // =========================================================

  openEditModal(
    item: GalleryItem
  ): void {

    this.editingItem = item;

    this.form = {
      id: item.id,
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      category: item.category,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy || '',
      createdByName: item.createdByName || ''
    };

    /*
     * Only add publishedAt when it exists.
     * Never put undefined into the object.
     */

    if (
      typeof item.publishedAt === 'number' &&
      item.publishedAt > 0
    ) {
      this.form.publishedAt =
        item.publishedAt;
    }

    this.clearMessages();

    this.showModal = true;
  }

  // =========================================================
  // CLOSE MODAL
  // =========================================================

  closeModal(): void {

    if (this.saving) {
      return;
    }

    this.showModal = false;

    this.editingItem = null;

    this.form =
      this.createEmptyForm();
  }

  // =========================================================
  // SAVE GALLERY ITEM
  // =========================================================

  async saveGalleryItem(): Promise<void> {

    this.clearMessages();

    // =======================================================
    // CLEAN FORM VALUES
    // =======================================================

    const title =
      (this.form.title || '').trim();

    const description =
      (this.form.description || '').trim();

    const imageUrl =
      (this.form.imageUrl || '').trim();

    const category =
      (this.form.category || '').trim();

    const status =
      this.form.status === 'published'
        ? 'published'
        : 'draft';

    // =======================================================
    // VALIDATION
    // =======================================================

    if (!title) {

      this.errorMessage =
        'Please enter a gallery title.';

      return;
    }

    if (!imageUrl) {

      this.errorMessage =
        'Please enter an image URL.';

      return;
    }

    if (!category) {

      this.errorMessage =
        'Please select a category.';

      return;
    }

    this.saving = true;

    try {

      const currentUser =
        this.adminAuthService.getUser();

      const now = Date.now();

      // =====================================================
      // EDIT EXISTING ITEM
      // =====================================================

      if (this.editingItem) {

        const updates: any = {
          title,
          description,
          imageUrl,
          category,
          status,
          updatedAt: now
        };

        // ---------------------------------------------------
        // PUBLISH
        // ---------------------------------------------------

        if (
          status === 'published'
        ) {

          /*
           * If it was already published and already has
           * publishedAt, keep the original publication date.
           *
           * Otherwise create a new publishedAt timestamp.
           */

          if (
            this.editingItem.status === 'published' &&
            typeof this.editingItem.publishedAt === 'number' &&
            this.editingItem.publishedAt > 0
          ) {

            updates.publishedAt =
              this.editingItem.publishedAt;

          } else {

            updates.publishedAt = now;
          }
        }

        // ---------------------------------------------------
        // DRAFT
        // ---------------------------------------------------

        if (
          status === 'draft'
        ) {

          /*
           * Firebase update() cannot receive undefined.
           *
           * null removes the value, but we use the Firebase
           * special removeValue() operation below.
           */

          const publishedAtRef =
            ref(
              database,
              `gallery/${this.editingItem.id}/publishedAt`
            );

          await update(
            ref(
              database,
              `gallery/${this.editingItem.id}`
            ),
            updates
          );

          await remove(
            publishedAtRef
          );

        } else {

          await update(
            ref(
              database,
              `gallery/${this.editingItem.id}`
            ),
            updates
          );
        }

        this.successMessage =
          'Gallery item updated successfully.';

      }

      // =====================================================
      // CREATE NEW ITEM
      // =====================================================

      else {

        const galleryRef =
          push(
            ref(database, 'gallery')
          );

        if (!galleryRef.key) {

          throw new Error(
            'Unable to create gallery record.'
          );
        }

        /*
         * IMPORTANT:
         *
         * Do NOT create publishedAt: undefined.
         *
         * Build the object first and only add publishedAt
         * when the item is actually published.
         */

        const item: any = {
          id: galleryRef.key,
          title,
          description,
          imageUrl,
          category,
          status,
          createdAt: now,
          updatedAt: now,
          createdBy:
            currentUser?.uid || '',
          createdByName:
            currentUser?.displayName ||
            currentUser?.email ||
            'Administrator'
        };

        // ---------------------------------------------------
        // ONLY ADD publishedAt FOR PUBLISHED ITEMS
        // ---------------------------------------------------

        if (
          status === 'published'
        ) {
          item.publishedAt = now;
        }

        await update(
          galleryRef,
          item
        );

        this.successMessage =
          'Gallery item created successfully.';
      }

      // =====================================================
      // CLOSE AND RELOAD
      // =====================================================

      this.closeModal();

      await this.loadGallery();

      this.cdr.detectChanges();

    } catch (error) {

      console.error(
        'Error saving gallery item:',
        error
      );

      this.errorMessage =
        'Unable to save gallery item. Please try again.';

      this.cdr.detectChanges();

    } finally {

      this.saving = false;
    }
  }

  // =========================================================
  // PUBLISH / UNPUBLISH
  // =========================================================

  async togglePublish(
    item: GalleryItem
  ): Promise<void> {

    this.clearMessages();

    try {

      const newStatus =
        item.status === 'published'
          ? 'draft'
          : 'published';

      const now = Date.now();

      const itemRef =
        ref(
          database,
          `gallery/${item.id}`
        );

      // =====================================================
      // PUBLISH
      // =====================================================

      if (
        newStatus === 'published'
      ) {

        await update(
          itemRef,
          {
            status: 'published',
            publishedAt: now,
            updatedAt: now
          }
        );

        this.successMessage =
          'Gallery item published successfully.';
      }

      // =====================================================
      // MOVE BACK TO DRAFT
      // =====================================================

      else {

        await update(
          itemRef,
          {
            status: 'draft',
            updatedAt: now
          }
        );

        /*
         * Remove publishedAt completely.
         * This prevents old publication dates from remaining
         * on draft items.
         */

        await remove(
          ref(
            database,
            `gallery/${item.id}/publishedAt`
          )
        );

        this.successMessage =
          'Gallery item moved back to draft.';
      }

      await this.loadGallery();

    } catch (error) {

      console.error(
        'Error changing gallery status:',
        error
      );

      this.errorMessage =
        'Unable to update gallery status.';

      this.cdr.detectChanges();
    }
  }

  // =========================================================
  // DELETE
  // =========================================================

  async deleteItem(
    item: GalleryItem
  ): Promise<void> {

    this.clearMessages();

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${item.title}"?`
      );

    if (!confirmed) {
      return;
    }

    try {

      await remove(
        ref(
          database,
          `gallery/${item.id}`
        )
      );

      this.successMessage =
        'Gallery item deleted successfully.';

      await this.loadGallery();

    } catch (error) {

      console.error(
        'Error deleting gallery item:',
        error
      );

      this.errorMessage =
        'Unable to delete gallery item.';

      this.cdr.detectChanges();
    }
  }

  // =========================================================
  // IMAGE ERROR
  // =========================================================

  handleImageError(
    event: Event
  ): void {

    const image =
      event.target as HTMLImageElement;

    if (image) {
      image.style.display = 'none';
    }
  }

  // =========================================================
  // FORMAT DATE
  // =========================================================

  formatDate(
    timestamp: number
  ): string {

    if (!timestamp) {
      return '-';
    }

    return new Date(
      timestamp
    ).toLocaleDateString(
      'en-NG',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    );
  }

  // =========================================================
  // STATS
  // =========================================================

  get totalItems(): number {

    return this.galleryItems.length;
  }

  get publishedItems(): number {

    return this.galleryItems.filter(
      item =>
        item.status === 'published'
    ).length;
  }

  get draftItems(): number {

    return this.galleryItems.filter(
      item =>
        item.status === 'draft'
    ).length;
  }

  // =========================================================
  // CLEAR MESSAGES
  // =========================================================

  clearMessages(): void {

    this.errorMessage = '';

    this.successMessage = '';
  }
}

