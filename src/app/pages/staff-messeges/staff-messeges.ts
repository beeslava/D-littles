import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  get,
  push,
  ref,
  remove,
  update,
  query,
  orderByChild,
  equalTo
} from 'firebase/database';

import { database } from '../../core/firebase.config';

import {
  SchoolAuthService,
  SchoolUser
} from '../../core/Auth/school-auth.service';


// =========================================================
// MESSAGE TYPES
// =========================================================

type MessageStatus =
  | 'unread'
  | 'read'
  | 'sent';

type MessageType =
  | 'individual'
  | 'group';

type MessagePriority =
  | 'normal'
  | 'important'
  | 'urgent';

type MessageFolder =
  | 'inbox'
  | 'sent';


// =========================================================
// MESSAGE RECORD
// =========================================================

interface MessageRecord {

  id: string;

  senderId: string;
  senderName: string;
  senderRole: string;

  recipientId: string;
  recipientName: string;
  recipientRole: string;

  subject: string;

  /**
   * New unified message field.
   * Admin Messages and Staff Messages
   * now use "body".
   */
  body: string;

  type: MessageType;

  priority: MessagePriority;

  status: MessageStatus;

  groupId?: string;

  groupName?: string;

  parentMessageId?: string;

  createdAt: number;
}


// =========================================================
// MESSAGE FORM
// =========================================================

interface MessageForm {

  recipientId: string;

  recipientName: string;

  recipientRole: string;

  subject: string;

  body: string;
}


// =========================================================
// COMPONENT
// =========================================================

@Component({

  selector: 'app-staff-messages',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],

  templateUrl: './staff-messeges.html',

  styleUrl: './staff-messeges.css'

})
export class StaffMessages implements OnInit {


  // =======================================================
  // CURRENT USER
  // =======================================================

  currentUser: SchoolUser | null = null;

  staffId = '';

  staffName = '';

  staffEmail = '';


  // =======================================================
  // MESSAGES
  // =======================================================

  messages: MessageRecord[] = [];

  inboxMessages: MessageRecord[] = [];

  sentMessages: MessageRecord[] = [];


  // =======================================================
  // CURRENT VIEW
  // =======================================================

  activeFolder: MessageFolder = 'inbox';

  selectedMessage: MessageRecord | null = null;

  showMessage = false;

  showCompose = false;


  // =======================================================
  // SEARCH
  // =======================================================

  searchTerm = '';


  // =======================================================
  // COMPOSE
  // =======================================================

  messageForm: MessageForm =
    this.createEmptyForm();

  sending = false;


  // =======================================================
  // LOADING
  // =======================================================

  loading = false;

  deleting = false;


  // =======================================================
  // ALERTS
  // =======================================================

  errorMessage = '';

  successMessage = '';


  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor(
    private authService: SchoolAuthService,
    private cdr: ChangeDetectorRef
  ) {}


  // =======================================================
  // INIT
  // =======================================================

  async ngOnInit(): Promise<void> {

    this.loading = true;

    this.clearMessages();

    try {

      await this.authService.waitForAuthReady();

      const firebaseUser =
        this.authService.getCurrentUser();


      if (!firebaseUser) {

        this.errorMessage =
          'Unable to identify your staff account. Please login again.';

        return;
      }


      const user =
        this.authService.getUserData();


      if (!user) {

        this.errorMessage =
          'Unable to load your staff profile. Please login again.';

        return;
      }


      this.currentUser = user;


      if (user.role !== 'staff') {

        this.errorMessage =
          'You are not authorized to access staff messages.';

        return;
      }


      this.staffId =
        user.staffId || '';


      this.staffName =
        user.fullName || 'Staff';


      this.staffEmail =
        user.email || '';


      if (!this.staffId) {

        this.errorMessage =
          'Your staff ID could not be found. Please contact the administrator.';

        return;
      }


      await this.loadMessages();

    } catch (error) {

      console.error(
        'Staff messages initialization error:',
        error
      );

      this.errorMessage =
        'Unable to load staff messages. Please try again.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // LOAD MESSAGES
  // =======================================================

  async loadMessages(): Promise<void> {

    if (!this.staffId) {

      this.messages = [];

      this.inboxMessages = [];

      this.sentMessages = [];

      return;
    }


    try {

      // =====================================================
      // INBOX
      // =====================================================

      const inboxQuery =
        query(

          ref(
            database,
            'messages'
          ),

          orderByChild(
            'recipientId'
          ),

          equalTo(
            this.staffId
          )

        );


      // =====================================================
      // SENT
      // =====================================================

      const sentQuery =
        query(

          ref(
            database,
            'messages'
          ),

          orderByChild(
            'senderId'
          ),

          equalTo(
            this.staffId
          )

        );


      const [
        inboxSnapshot,
        sentSnapshot
      ] = await Promise.all([

        get(inboxQuery),

        get(sentQuery)

      ]);


      // =====================================================
      // PREVENT DUPLICATES
      // =====================================================

      const messageMap =
        new Map<string, MessageRecord>();


      // =====================================================
      // PROCESS INBOX
      // =====================================================

      if (inboxSnapshot.exists()) {

        const data =
          inboxSnapshot.val();


        Object.keys(data).forEach(id => {

          const record =
            data[id];


          messageMap.set(

            id,

            this.convertMessageRecord(
              id,
              record
            )

          );

        });

      }


      // =====================================================
      // PROCESS SENT
      // =====================================================

      if (sentSnapshot.exists()) {

        const data =
          sentSnapshot.val();


        Object.keys(data).forEach(id => {

          const record =
            data[id];


          messageMap.set(

            id,

            this.convertMessageRecord(
              id,
              record
            )

          );

        });

      }


      // =====================================================
      // ALL
      // =====================================================

      this.messages =
        Array.from(
          messageMap.values()
        )
        .sort(
          (a, b) =>
            b.createdAt -
            a.createdAt
        );


      // =====================================================
      // INBOX
      // =====================================================

      this.inboxMessages =
        this.messages
          .filter(
            message =>
              message.recipientId ===
              this.staffId
          )
          .sort(
            (a, b) =>
              b.createdAt -
              a.createdAt
          );


      // =====================================================
      // SENT
      // =====================================================

      this.sentMessages =
        this.messages
          .filter(
            message =>
              message.senderId ===
              this.staffId
          )
          .sort(
            (a, b) =>
              b.createdAt -
              a.createdAt
          );

    } catch (error) {

      console.error(
        'Load staff messages error:',
        error
      );

      throw error;

    }

  }


  // =======================================================
  // CONVERT FIREBASE RECORD
  // =======================================================

  private convertMessageRecord(
    id: string,
    record: any
  ): MessageRecord {

    return {

      id,

      senderId:
        record.senderId || '',

      senderName:
        record.senderName || '',

      senderRole:
        record.senderRole || '',

      recipientId:
        record.recipientId || '',

      recipientName:
        record.recipientName || '',

      recipientRole:
        record.recipientRole || '',

      subject:
        record.subject || '',

      body:
        record.body ||
        record.message ||
        '',

      type:
        record.type === 'group'
          ? 'group'
          : 'individual',

      priority:
        record.priority === 'urgent'
          ? 'urgent'
          : record.priority === 'important'
            ? 'important'
            : 'normal',

      status:
        record.status === 'read'
          ? 'read'
          : record.status === 'sent'
            ? 'sent'
            : 'unread',

      groupId:
        record.groupId ||
        '',

      groupName:
        record.groupName ||
        '',

      parentMessageId:
        record.parentMessageId ||
        '',

      createdAt:
        Number(record.createdAt) ||
        0

    };

  }


  // =======================================================
  // DISPLAYED MESSAGES
  // =======================================================

  get displayedMessages(): MessageRecord[] {

    const source =
      this.activeFolder === 'inbox'
        ? this.inboxMessages
        : this.sentMessages;


    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    if (!search) {

      return source;

    }


    return source.filter(message =>

      message.subject
        .toLowerCase()
        .includes(search)

      ||

      message.body
        .toLowerCase()
        .includes(search)

      ||

      message.senderName
        .toLowerCase()
        .includes(search)

      ||

      message.recipientName
        .toLowerCase()
        .includes(search)

    );

  }


  // =======================================================
  // SWITCH FOLDER
  // =======================================================

  setFolder(
    folder: MessageFolder
  ): void {

    this.activeFolder =
      folder;

    this.selectedMessage =
      null;

    this.showMessage =
      false;

    this.showCompose =
      false;

    this.clearMessages();

  }


  // =======================================================
  // UNREAD COUNT
  // =======================================================

  getUnreadCount(): number {

    return this.inboxMessages.filter(

      message =>
        message.status === 'unread'

    ).length;

  }


  // =======================================================
  // OPEN MESSAGE
  // =======================================================

  async openMessage(
    message: MessageRecord
  ): Promise<void> {

    this.selectedMessage =
      message;

    this.showMessage =
      true;

    this.showCompose =
      false;

    this.clearMessages();


    if (

      message.recipientId ===
      this.staffId

      &&

      message.status ===
      'unread'

    ) {

      try {

        await update(

          ref(
            database,
            `messages/${message.id}`
          ),

          {

            status:
              'read'

          }

        );


        message.status =
          'read';


        const messageIndex =
          this.messages.findIndex(

            item =>
              item.id ===
              message.id

          );


        if (messageIndex !== -1) {

          this.messages[
            messageIndex
          ].status =
            'read';

        }


        const inboxIndex =
          this.inboxMessages.findIndex(

            item =>
              item.id ===
              message.id

          );


        if (inboxIndex !== -1) {

          this.inboxMessages[
            inboxIndex
          ].status =
            'read';

        }

      } catch (error) {

        console.error(
          'Mark message as read error:',
          error
        );

      }

    }


    this.cdr.detectChanges();

  }


  // =======================================================
  // CLOSE MESSAGE
  // =======================================================

  closeMessage(): void {

    this.selectedMessage =
      null;

    this.showMessage =
      false;

    this.clearMessages();

  }


  // =======================================================
  // COMPOSE
  // =======================================================

  composeMessage(): void {

    this.messageForm =
      this.createEmptyForm();

    this.selectedMessage =
      null;

    this.showMessage =
      false;

    this.showCompose =
      true;

    this.clearMessages();

  }


  // =======================================================
  // CLOSE COMPOSE
  // =======================================================

  closeCompose(): void {

    this.showCompose =
      false;

    this.messageForm =
      this.createEmptyForm();

    this.clearMessages();

  }


  // =======================================================
  // REPLY
  // =======================================================

  replyToMessage(
    message: MessageRecord
  ): void {

    this.messageForm = {

      recipientId:
        message.senderId,

      recipientName:
        message.senderName,

      recipientRole:
        message.senderRole,

      subject:
        message.subject
          ? `Re: ${message.subject}`
          : 'Re:',

      body:
        ''

    };


    this.selectedMessage =
      message;

    this.showMessage =
      false;

    this.showCompose =
      true;

    this.clearMessages();

  }


  // =======================================================
  // SEND MESSAGE
  // =======================================================

  async sendMessage(): Promise<void> {

    this.clearMessages();


    const recipientId =
      this.messageForm.recipientId
        .trim();

    const subject =
      this.messageForm.subject
        .trim();

    const body =
      this.messageForm.body
        .trim();


    // =====================================================
    // VALIDATION
    // =====================================================

    if (!recipientId) {

      this.errorMessage =
        'Please enter the recipient ID.';

      return;

    }


    if (!subject) {

      this.errorMessage =
        'Please enter a message subject.';

      return;

    }


    if (!body) {

      this.errorMessage =
        'Please enter your message.';

      return;

    }


    if (
      recipientId ===
      this.staffId
    ) {

      this.errorMessage =
        'You cannot send a message to yourself.';

      return;

    }


    if (this.sending) {

      return;

    }


    this.sending =
      true;


    try {

      // ===================================================
      // CURRENT TIME
      // ===================================================

      const now =
        Date.now();


      // ===================================================
      // NEW MESSAGE KEY
      // ===================================================

      const newMessageRef =
        push(
          ref(
            database,
            'messages'
          )
        );


      // ===================================================
      // MESSAGE DATA
      // ===================================================

      const messageData = {

        senderId:
          this.staffId,

        senderName:
          this.staffName,

        senderRole:
          'staff',

        recipientId,

        recipientName:
          this.messageForm
            .recipientName
            .trim(),

        recipientRole:
          this.messageForm
            .recipientRole
            .trim() ||
          'staff',

        subject,

        body,

        type:
          'individual' as const,

        priority:
          'normal' as const,

        status:
          'unread' as const,

        parentMessageId:
          this.selectedMessage?.id ||
          '',

        createdAt:
          now

      };


      // ===================================================
      // WRITE
      // ===================================================

      await update(

        newMessageRef,

        messageData

      );


      // ===================================================
      // RELOAD
      // ===================================================

      await this.loadMessages();


      // ===================================================
      // CLOSE COMPOSE
      // ===================================================

      this.showCompose =
        false;

      this.selectedMessage =
        null;


      this.messageForm =
        this.createEmptyForm();


      this.activeFolder =
        'sent';


      this.successMessage =
        'Message sent successfully.';

    } catch (error) {

      console.error(
        'Send staff message error:',
        error
      );

      this.errorMessage =
        'Unable to send the message. Please try again.';

    } finally {

      this.sending =
        false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // DELETE MESSAGE
  // =======================================================

  async deleteMessage(
    message: MessageRecord
  ): Promise<void> {

    const confirmed =
      window.confirm(

        `Delete this message${
          message.subject
            ? ` "${message.subject}"`
            : ''
        }?`

      );


    if (!confirmed) {

      return;

    }


    this.deleting =
      true;

    this.clearMessages();


    try {

      await remove(

        ref(
          database,
          `messages/${message.id}`
        )

      );


      this.messages =
        this.messages.filter(

          item =>
            item.id !==
            message.id

        );


      this.inboxMessages =
        this.inboxMessages.filter(

          item =>
            item.id !==
            message.id

        );


      this.sentMessages =
        this.sentMessages.filter(

          item =>
            item.id !==
            message.id

        );


      if (

        this.selectedMessage?.id ===
        message.id

      ) {

        this.selectedMessage =
          null;

        this.showMessage =
          false;

      }


      this.successMessage =
        'Message deleted successfully.';

    } catch (error) {

      console.error(
        'Delete message error:',
        error
      );

      this.errorMessage =
        'Unable to delete the message. Please try again.';

    } finally {

      this.deleting =
        false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // REFRESH
  // =======================================================

  async refresh(): Promise<void> {

    this.loading =
      true;

    this.clearMessages();


    try {

      await this.loadMessages();


      this.successMessage =
        'Messages refreshed successfully.';

    } catch (error) {

      console.error(
        'Refresh messages error:',
        error
      );

      this.errorMessage =
        'Unable to refresh messages.';

    } finally {

      this.loading =
        false;

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // MARK ALL AS READ
  // =======================================================

  async markAllAsRead(): Promise<void> {

    const unreadMessages =
      this.inboxMessages.filter(

        message =>
          message.status ===
          'unread'

      );


    if (!unreadMessages.length) {

      this.successMessage =
        'There are no unread messages.';

      return;

    }


    try {

      for (
        const message of
        unreadMessages
      ) {

        await update(

          ref(
            database,
            `messages/${message.id}`
          ),

          {

            status:
              'read'

          }

        );

      }


      await this.loadMessages();


      this.successMessage =
        'All messages marked as read.';

    } catch (error) {

      console.error(
        'Mark all messages as read error:',
        error
      );

      this.errorMessage =
        'Unable to mark all messages as read.';

    } finally {

      this.cdr.detectChanges();

    }

  }


  // =======================================================
  // EMPTY FORM
  // =======================================================

  private createEmptyForm(): MessageForm {

    return {

      recipientId:
        '',

      recipientName:
        '',

      recipientRole:
        'student',

      subject:
        '',

      body:
        ''

    };

  }


  // =======================================================
  // CLEAR MESSAGES
  // =======================================================

  clearMessages(): void {

    this.errorMessage =
      '';

    this.successMessage =
      '';

  }


  // =======================================================
  // FORMAT DATE
  // =======================================================

  formatMessageDate(
    timestamp: number
  ): string {

    if (!timestamp) {

      return '';

    }


    return new Date(timestamp)
      .toLocaleString(
        undefined,
        {

          year:
            'numeric',

          month:
            'short',

          day:
            'numeric',

          hour:
            '2-digit',

          minute:
            '2-digit'

        }

      );

  }


  // =======================================================
  // MESSAGE PREVIEW
  // =======================================================

  getMessagePreview(
    message: MessageRecord
  ): string {

    const text =
      message.body
        .replace(/\s+/g, ' ')
        .trim();


    if (
      text.length <= 90
    ) {

      return text;

    }


    return `${text.substring(0, 90)}...`;

  }


  // =======================================================
  // LOGOUT
  // =======================================================

  logout(): void {

    this.authService.logout();

  }

}