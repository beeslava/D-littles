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

interface NewsItem {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  category: string;
  imageUrl: string;
  authorName: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

@Component({
  selector: 'app-news',
  standalone: true,

  // IMPORTANT:
  // FormsModule is required because news.html uses [(ngModel)]
  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './news.html',
  styleUrls: ['./news.css']
})
export class News implements OnInit {

  // =========================================================
  // DATA
  // =========================================================

  news: NewsItem[] = [];

  filteredNews: NewsItem[] = [];

  selectedNews: NewsItem | null = null;

  // =========================================================
  // UI STATE
  // =========================================================

  loading = true;

  errorMessage = '';

  searchTerm = '';

  selectedCategory = 'All';

  // =========================================================
  // CATEGORIES
  // =========================================================

  categories: string[] = [
    'All',
    'General',
    'Announcement',
    'Academic',
    'Admissions',
    'Events',
    'Sports',
    'School Life'
  ];

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
    this.loadNews();
  }

  // =========================================================
  // LOAD PUBLISHED NEWS
  // =========================================================

  async loadNews(): Promise<void> {

    this.loading = true;
    this.errorMessage = '';

    try {

      const newsQuery = query(
        ref(database, 'news'),
        orderByChild('status'),
        equalTo('published')
      );

      const snapshot = await get(newsQuery);

      const loadedNews: NewsItem[] = [];

      if (snapshot.exists()) {

        snapshot.forEach(childSnapshot => {

          const data = childSnapshot.val();

          loadedNews.push({
            id: childSnapshot.key || '',

            title: data.title || '',

            content: data.content || '',

            excerpt:
              data.excerpt ||
              this.createExcerpt(data.content || ''),

            category: data.category || 'General',

            imageUrl: data.imageUrl || '',

            authorName: data.authorName || 'D Little Private School',

            status: data.status || 'published',

            createdAt: Number(data.createdAt) || 0,

            updatedAt: Number(data.updatedAt) || 0,

            publishedAt:
              data.publishedAt
                ? Number(data.publishedAt)
                : undefined
          });

        });

      }

      // Newest published news first
      loadedNews.sort((a, b) => {

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

      this.news = loadedNews;

      this.applyFilters();

      console.log(
        'Published news loaded:',
        this.news
      );

    } catch (error) {

      console.error(
        'Error loading public news:',
        error
      );

      this.errorMessage =
        'Unable to load school news. Please try again later.';

      this.news = [];
      this.filteredNews = [];

    } finally {

      this.loading = false;

      this.cdr.detectChanges();
    }
  }

  // =========================================================
  // CREATE EXCERPT
  // =========================================================

  private createExcerpt(
    content: string
  ): string {

    const cleanContent =
      content
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleanContent.length <= 180) {
      return cleanContent;
    }

    return (
      cleanContent.substring(0, 180).trim() +
      '...'
    );
  }

  // =========================================================
  // APPLY SEARCH + CATEGORY FILTER
  // =========================================================

  applyFilters(): void {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();

    this.filteredNews =
      this.news.filter(item => {

        const matchesCategory =
          this.selectedCategory === 'All' ||
          item.category === this.selectedCategory;

        if (!matchesCategory) {
          return false;
        }

        if (!search) {
          return true;
        }

        const searchableText = [
          item.title,
          item.content,
          item.excerpt,
          item.category,
          item.authorName
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(search);
      });
  }

  // =========================================================
  // SEARCH
  // =========================================================

  onSearch(): void {
    this.applyFilters();
  }

  // =========================================================
  // CATEGORY
  // =========================================================

  selectCategory(
    category: string
  ): void {

    this.selectedCategory = category;

    this.applyFilters();
  }

  // =========================================================
  // OPEN NEWS
  // =========================================================

  openNews(
    item: NewsItem
  ): void {

    this.selectedNews = item;

    document.body.style.overflow = 'hidden';
  }

  // =========================================================
  // CLOSE NEWS
  // =========================================================

  closeNews(): void {

    this.selectedNews = null;

    document.body.style.overflow = '';
  }

  // =========================================================
  // IMAGE ERROR
  // =========================================================

  handleImageError(
    event: Event
  ): void {

    const image =
      event.target as HTMLImageElement;

    image.style.display = 'none';
  }

  // =========================================================
  // FORMAT DATE
  // =========================================================

  formatDate(
    timestamp: number | undefined
  ): string {

    if (!timestamp) {
      return '';
    }

    return new Date(timestamp).toLocaleDateString(
      'en-NG',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }
    );
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

