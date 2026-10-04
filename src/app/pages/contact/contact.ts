import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  push,
  ref,
  update
} from 'firebase/database';

import { database } from '../../core/firebase.config';

interface ContactMessage {
  id: string;

  senderId: string;
  senderName: string;
  senderRole: string;

  recipientId: string;
  recipientName: string;
  recipientRole: string;

  subject: string;
  body: string;

  type: 'individual';
  priority: 'normal' | 'important' | 'urgent';
  status: 'unread' | 'read';

  createdAt: number;
  readAt?: number;
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './contact.html',
  styleUrls: ['./contact.css']
})
export class Contact implements OnInit {

  submitting = false;

  successMessage = '';
  errorMessage = '';

  form = {
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  };

  constructor(
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.resetForm();
  }

  // =========================================================
  // SUBMIT CONTACT MESSAGE
  // =========================================================

  async submitForm(): Promise<void> {

    // Prevent double submission
    if (this.submitting) {
      return;
    }

    this.clearMessages();

    const name = this.form.name.trim();
    const email = this.form.email.trim();
    const phone = this.form.phone.trim();
    const subject = this.form.subject.trim();
    const message = this.form.message.trim();

    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (!name) {
      this.errorMessage = 'Please enter your name.';
      return;
    }

    if (!email) {
      this.errorMessage = 'Please enter your email address.';
      return;
    }

    if (!this.isValidEmail(email)) {
      this.errorMessage =
        'Please enter a valid email address.';
      return;
    }

    if (!subject) {
      this.errorMessage = 'Please enter a subject.';
      return;
    }

    if (!message) {
      this.errorMessage = 'Please enter your message.';
      return;
    }

    if (message.length < 10) {
      this.errorMessage =
        'Please enter a message of at least 10 characters.';
      return;
    }

    // -------------------------------------------------------
    // START LOADING
    // -------------------------------------------------------

    this.submitting = true;
    this.cdr.detectChanges();

    try {

      // =====================================================
      // SEND DIRECTLY TO ADMIN MESSAGES
      // =====================================================

      const messagesRef = ref(
        database,
        'messages'
      );

      const newMessageRef = push(
        messagesRef
      );

      const messageId = newMessageRef.key;

      if (!messageId) {
        throw new Error(
          'Unable to create message ID.'
        );
      }

      const now = Date.now();

      /*
       * The email and phone are included inside the body
       * because the Admin Messages system already uses
       * "body" for the actual message content.
       */

      const messageBody =
        `Website Contact Message\n\n` +
        `Name: ${name}\n` +
        `Email: ${email}\n` +
        `Phone: ${phone || 'Not provided'}\n\n` +
        `Message:\n${message}`;

      const adminMessage: ContactMessage = {
        id: messageId,

        // Website visitor
        senderId: `website-${messageId}`,
        senderName: name,
        senderRole: 'public',

        // D-Littles administration
        recipientId: 'admin',
        recipientName: 'D-Littles Administration',
        recipientRole: 'admin',

        subject,
        body: messageBody,

        type: 'individual',
        priority: 'normal',
        status: 'unread',

        createdAt: now
      };

      // =====================================================
      // SAVE TO /messages
      // =====================================================

      await update(
        ref(
          database,
          `messages/${messageId}`
        ),
        adminMessage as any
      );

      // =====================================================
      // SUCCESS
      // =====================================================

      this.successMessage =
        'Thank you for contacting D Little Private School. Your message has been sent to the school administration.';

      this.resetForm();

      console.log(
        'Contact message sent to admin:',
        adminMessage
      );

    } catch (error) {

      console.error(
        'Error submitting contact message:',
        error
      );

      this.errorMessage =
        'Unable to send your message at the moment. Please try again.';

    } finally {

      // =====================================================
      // ALWAYS STOP LOADING
      // =====================================================

      this.submitting = false;

      this.cdr.detectChanges();
    }
  }

  // =========================================================
  // EMAIL VALIDATION
  // =========================================================

  isValidEmail(email: string): boolean {

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailPattern.test(email);
  }

  // =========================================================
  // CLEAR MESSAGES
  // =========================================================

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  // =========================================================
  // RESET FORM
  // =========================================================

  resetForm(): void {

    this.form = {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: ''
    };
  }

  // =========================================================
  // CLEAR FORM BUTTON
  // =========================================================

  clearForm(): void {

    if (this.submitting) {
      return;
    }

    this.resetForm();
    this.clearMessages();

    this.cdr.detectChanges();
  }
}

