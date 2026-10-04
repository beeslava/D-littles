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

interface NewsItem {
  id: string;

  title: string;
  content: string;
  excerpt: string;

  category: string;

  imageUrl: string;

  authorId: string;
  authorName: string;

  status: 'draft' | 'published';

  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

@Component({
  selector: 'app-admin-news',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './news.html',
  styleUrls: ['./news.css']
})
export class AdminNews implements OnInit {

  // =========================================================
  // NEWS DATA
  // =========================================================

  news: NewsItem[] = [];

  filteredNews: NewsItem[] = [];

  // =========================================================
  // FORM
  // =========================================================

  showForm = false;

  editingNewsId: string | null = null;

  formTitle = '';
  formContent = '';
  formExcerpt = '';
  formCategory = 'General';
  formImageUrl = '';
  formStatus: 'draft' | 'published' = 'draft';

  // =========================================================
  // SEARCH / FILTER
  // =========================================================

  searchTerm = '';

  selectedCategory = 'All';

  selectedStatus = 'All';

  categories = [
    'General',
    'Announcement',
    'Academic',
    'Admissions',
    'Events',
    'Sports',
    'School Life'
  ];

  // =========================================================
  // UI STATE
  // =========================================================

  loading = false;

  saving = false;

  deleting = false;

  errorMessage = '';

  successMessage = '';

  // =========================================================
  // CONFIRM DELETE
  // =========================================================

  showDeleteModal = false;

  newsToDelete: NewsItem | null = null;

  // =========================================================
  // STATS
  // =========================================================

  get totalNews(): number {
    return this.news.length;
  }

  get publishedNews(): number {
    return this.news.filter(
      item => item.status === 'published'
    ).length;
  }

  get draftNews(): number {
    return this.news.filter(
      item => item.status === 'draft'
    ).length;
  }

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

  async ngOnInit(): Promise<void> {

    await this.loadNews();

  }

  // =========================================================
  // LOAD NEWS
  // =========================================================

  async loadNews(): Promise<void> {

    this.loading = true;

    this.clearMessages();

    try {

      const newsRef = ref(
        database,
        'news'
      );

      const snapshot = await get(newsRef);

      this.news = [];

      if (snapshot.exists()) {

        const data = snapshot.val();

        Object.entries(data).forEach(
          ([id, value]: [string, any]) => {

            this.news.push({

              id,

              title:
                value.title || '',

              content:
                value.content || '',

              excerpt:
                value.excerpt || '',

              category:
                value.category || 'General',

              imageUrl:
                value.imageUrl || '',

              authorId:
                value.authorId || '',

              authorName:
                value.authorName || 'Administrator',

              status:
                value.status === 'published'
                  ? 'published'
                  : 'draft',

              createdAt:
                Number(value.createdAt) ||
                Date.now(),

              updatedAt:
                Number(value.updatedAt) ||
                Number(value.createdAt) ||
                Date.now(),

              publishedAt:
                value.publishedAt
                  ? Number(value.publishedAt)
                  : undefined

            });

          }
        );

      }

      // Newest first
      this.news.sort(
        (a, b) =>
          b.createdAt - a.createdAt
      );

      this.applyFilters();

    } catch (error) {

      console.error(
        'Error loading news:',
        error
      );

      this.errorMessage =
        'Unable to load news. Please try again.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }

  // =========================================================
  // OPEN CREATE FORM
  // =========================================================

  openCreateForm(): void {

    this.editingNewsId = null;

    this.resetForm();

    this.showForm = true;

    this.clearMessages();

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }

  // =========================================================
  // OPEN EDIT FORM
  // =========================================================

  openEditForm(item: NewsItem): void {

    this.editingNewsId = item.id;

    this.formTitle =
      item.title;

    this.formContent =
      item.content;

    this.formExcerpt =
      item.excerpt;

    this.formCategory =
      item.category;

    this.formImageUrl =
      item.imageUrl;

    this.formStatus =
      item.status;

    this.showForm = true;

    this.clearMessages();

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

    this.editingNewsId = null;

    this.resetForm();

  }

  // =========================================================
  // RESET FORM
  // =========================================================

  resetForm(): void {

    this.formTitle = '';

    this.formContent = '';

    this.formExcerpt = '';

    this.formCategory = 'General';

    this.formImageUrl = '';

    this.formStatus = 'draft';

  }

  // =========================================================
  // SAVE NEWS
  // =========================================================

  async saveNews(): Promise<void> {

    this.clearMessages();

    const title =
      this.formTitle.trim();

    const content =
      this.formContent.trim();

    const excerpt =
      this.formExcerpt.trim();

    if (!title) {

      this.errorMessage =
        'Please enter a news title.';

      return;

    }

    if (!content) {

      this.errorMessage =
        'Please enter the news content.';

      return;

    }

    this.saving = true;

    try {

      const currentUser =
        this.adminAuthService.getUser();

      const authorId =
        currentUser?.uid || '';

      const authorName =
        currentUser?.displayName ||
        currentUser?.email ||
        'Administrator';

      const now =
        Date.now();

      // =====================================================
      // EDIT EXISTING NEWS
      // =====================================================

      if (this.editingNewsId) {

        const existingNews =
          this.news.find(
            item =>
              item.id ===
              this.editingNewsId
          );

        const updateData: any = {

          title,

          content,

          excerpt:
            excerpt ||
            this.createExcerpt(content),

          category:
            this.formCategory,

          imageUrl:
            this.formImageUrl.trim(),

          status:
            this.formStatus,

          updatedAt:
            now

        };

        // Add published date when publishing
        if (
          this.formStatus === 'published'
        ) {

          updateData.publishedAt =
            existingNews?.publishedAt ||
            now;

        } else {

          updateData.publishedAt =
            null;

        }

        await update(
          ref(
            database,
            `news/${this.editingNewsId}`
          ),
          updateData
        );

        this.successMessage =
          'News updated successfully.';

      }

      // =====================================================
      // CREATE NEW NEWS
      // =====================================================

      else {

        const newsRef =
          push(
            ref(
              database,
              'news'
            )
          );

        const newsData: any = {

          title,

          content,

          excerpt:
            excerpt ||
            this.createExcerpt(content),

          category:
            this.formCategory,

          imageUrl:
            this.formImageUrl.trim(),

          authorId,

          authorName,

          status:
            this.formStatus,

          createdAt:
            now,

          updatedAt:
            now

        };

        if (
          this.formStatus ===
          'published'
        ) {

          newsData.publishedAt =
            now;

        }

        await update(
          newsRef,
          newsData
        );

        this.successMessage =
          'News created successfully.';

      }

      this.showForm = false;

      this.editingNewsId = null;

      this.resetForm();

      await this.loadNews();

    } catch (error) {

      console.error(
        'Error saving news:',
        error
      );

      this.errorMessage =
        'Unable to save the news. Please try again.';

    } finally {

      this.saving = false;

      this.cdr.detectChanges();

    }

  }

  // =========================================================
  // CREATE EXCERPT
  // =========================================================

  createExcerpt(
    content: string
  ): string {

    const cleanContent =
      content
        .replace(/\s+/g, ' ')
        .trim();

    if (
      cleanContent.length <= 180
    ) {

      return cleanContent;

    }

    return (
      cleanContent.substring(
        0,
        180
      ) + '...'
    );

  }

  // =========================================================
  // OPEN DELETE MODAL
  // =========================================================

  confirmDelete(
    item: NewsItem
  ): void {

    this.newsToDelete =
      item;

    this.showDeleteModal =
      true;

    this.clearMessages();

  }

  // =========================================================
  // CLOSE DELETE MODAL
  // =========================================================

  cancelDelete(): void {

    if (this.deleting) {
      return;
    }

    this.showDeleteModal =
      false;

    this.newsToDelete =
      null;

  }

  // =========================================================
  // DELETE NEWS
  // =========================================================

  async deleteNews(): Promise<void> {

    if (!this.newsToDelete) {
      return;
    }

    this.deleting = true;

    this.clearMessages();

    try {

      await remove(
        ref(
          database,
          `news/${this.newsToDelete.id}`
        )
      );

      this.successMessage =
        'News deleted successfully.';

      this.showDeleteModal =
        false;

      this.newsToDelete =
        null;

      await this.loadNews();

    } catch (error) {

      console.error(
        'Error deleting news:',
        error
      );

      this.errorMessage =
        'Unable to delete the news. Please try again.';

    } finally {

      this.deleting = false;

      this.cdr.detectChanges();

    }

  }

  // =========================================================
  // TOGGLE PUBLISH STATUS
  // =========================================================

  async togglePublish(
    item: NewsItem
  ): Promise<void> {

    this.clearMessages();

    try {

      const now =
        Date.now();

      const newStatus =
        item.status === 'published'
          ? 'draft'
          : 'published';

      const updateData: any = {

        status:
          newStatus,

        updatedAt:
          now

      };

      if (
        newStatus ===
        'published'
      ) {

        updateData.publishedAt =
          item.publishedAt ||
          now;

      } else {

        updateData.publishedAt =
          null;

      }

      await update(
        ref(
          database,
          `news/${item.id}`
        ),
        updateData
      );

      this.successMessage =
        newStatus === 'published'
          ? 'News published successfully.'
          : 'News moved to draft.';

      await this.loadNews();

    } catch (error) {

      console.error(
        'Error changing news status:',
        error
      );

      this.errorMessage =
        'Unable to change the news status.';

    }

  }

  // =========================================================
  // FILTER NEWS
  // =========================================================

  applyFilters(): void {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();

    this.filteredNews =
      this.news.filter(item => {

        const matchesSearch =
          !search ||
          item.title
            .toLowerCase()
            .includes(search) ||
          item.content
            .toLowerCase()
            .includes(search) ||
          item.category
            .toLowerCase()
            .includes(search);

        const matchesCategory =
          this.selectedCategory ===
            'All' ||
          item.category ===
            this.selectedCategory;

        const matchesStatus =
          this.selectedStatus ===
            'All' ||
          item.status ===
            this.selectedStatus;

        return (
          matchesSearch &&
          matchesCategory &&
          matchesStatus
        );

      });

  }

  // =========================================================
  // CLEAR FILTERS
  // =========================================================

  clearFilters(): void {

    this.searchTerm = '';

    this.selectedCategory =
      'All';

    this.selectedStatus =
      'All';

    this.applyFilters();

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
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }
    );

  }

  // =========================================================
  // IMAGE ERROR
  // =========================================================

  handleImageError(
    event: Event
  ): void {

    const image =
      event.target as HTMLImageElement;

    image.style.display =
      'none';

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

  trackByNewsId(
    index: number,
    item: NewsItem
  ): string {

    return item.id;

  }

}

