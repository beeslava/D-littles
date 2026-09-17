import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/navbar/navbar';
import { Footer } from './shared/footer/footer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    Navbar,
    Footer
  ],
  template: `
    <app-navbar></app-navbar>

    <main class="site-main">
      <router-outlet></router-outlet>
    </main>

    <app-footer></app-footer>
  `,
  styleUrl: './app.css'
})
export class App {}