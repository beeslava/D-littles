import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import {
  NgIf,
  NgFor,
  DatePipe
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  RouterLink
} from '@angular/router';

import {
  get,
  push,
  ref,
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
// TYPES
// =========================================================

type MessageStatus =
  'unread' |
  'read' |
  'sent';

type MessageType =
  'individual' |
  'group';

type MessagePriority =
  'normal' |
  'important' |
  'urgent';

type MessageFolder =
  'inbox' |
  'sent';


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

  body: string;

  type: MessageType;

  priority: MessagePriority;

  status: MessageStatus;

  groupId?: string;

  groupName?: string;

  parentMessageId?: string;

  replyToId?: string;

  replyToSubject?: string;

  createdAt: number;

  readAt?: number;

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
// MESSAGE RECIPIENT
// =========================================================

interface MessageRecipient {

  id: string;

  name: string;

  role: string;

}


// =========================================================
// COMPONENT
// =========================================================

@Component({

  selector: 'app-parent-messages',

  standalone: true,

  imports: [
    NgIf,
    NgFor,
    DatePipe,
    FormsModule,
    RouterLink
  ],

  templateUrl: './parent-messages.html',

  styleUrl: './parent-messages.css'

})


export class ParentMessages implements OnInit {


  // =========================================================
  // CURRENT USER
  // =========================================================

  currentUser: SchoolUser | null = null;

  /**
   * IMPORTANT:
   *
   * parentId is the Firebase Authentication UID.
   *
   * Do NOT use currentUser.parentId here because parentId
   * can be a school/human-readable parent code.
   */
  parentId = '';

  parentName = 'Parent';


  // =========================================================
  // MESSAGES
  // =========================================================

  messages: MessageRecord[] = [];

  selectedMessage: MessageRecord | null = null;


  // =========================================================
  // FOLDERS
  // =========================================================

  activeFolder: MessageFolder = 'inbox';


  // =========================================================
  // SEARCH
  // =========================================================

  searchTerm = '';


  // =========================================================
  // RECIPIENTS
  // =========================================================

  recipients: MessageRecipient[] = [];


  // =========================================================
  // COMPOSE
  // =========================================================

  showCompose = false;

  sending = false;


  messageForm: MessageForm = {

    recipientId: '',

    recipientName: '',

    recipientRole: '',

    subject: '',

    body: ''

  };


  // =========================================================
  // LOADING / MESSAGES
  // =========================================================

  loading = true;

  errorMessage = '';

  successMessage = '';


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(

    private schoolAuth: SchoolAuthService,

    private cdr: ChangeDetectorRef

  ) {}


  // =========================================================
  // INIT
  // =========================================================

  async ngOnInit(): Promise<void> {

    try {

      await this.schoolAuth.waitForAuthReady();


      this.currentUser =
        this.schoolAuth.getUserData();


      if (!this.currentUser) {

        this.errorMessage =
          'Unable to load your account information.';

        return;

      }


      // -------------------------------------------------------
      // CHECK ROLE
      // -------------------------------------------------------

      if (
        this.currentUser.role !== 'parent'
      ) {

        this.errorMessage =
          'This page is only available to parents.';

        return;

      }


      // -------------------------------------------------------
      // GET FIREBASE AUTH UID
      // -------------------------------------------------------
      //
      // Messaging MUST use the Firebase Auth UID.
      //
      // -------------------------------------------------------

      this.parentId =
        this.currentUser.uid;


      this.parentName =
        this.currentUser.fullName ||
        this.currentUser.email ||
        'Parent';


      if (!this.parentId) {

        this.errorMessage =
          'Your parent Firebase account ID could not be found.';

        return;

      }


      console.log(
        'Parent Firebase UID used for messaging:',
        this.parentId
      );


      // -------------------------------------------------------
      // LOAD MESSAGES
      // -------------------------------------------------------

      await this.loadMessages();


      // -------------------------------------------------------
      // LOAD RECIPIENTS
      // -------------------------------------------------------

      await this.loadRecipients();


    } catch (error) {

      console.error(
        'Parent messages initialization error:',
        error
      );

      this.errorMessage =
        'Unable to load your messages. Please try again.';

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // LOAD MESSAGES
  // =========================================================
  //
  // Parent messages are stored at:
  //
  // parentMessages/{firebaseUid}/{messageId}
  //
  // =========================================================

  async loadMessages(): Promise<void> {

    try {

      this.messages = [];


      if (!this.parentId) {

        console.warn(
          'Cannot load parent messages: Firebase UID is missing.'
        );

        return;

      }


      console.log(
        'Loading parent messages for Firebase UID:',
        this.parentId
      );


      const snapshot =
        await get(
          ref(
            database,
            `parentMessages/${this.parentId}`
          )
        );


      if (!snapshot.exists()) {

        console.log(
          'No messages found at:',
          `parentMessages/${this.parentId}`
        );

        return;

      }


      const data =
        snapshot.val();


      Object.entries(data).forEach(
        ([id, value]: [string, any]) => {

          if (!value) {

            return;

          }


          const message: MessageRecord = {

            id,

            senderId:
              value.senderId || '',

            senderName:
              value.senderName ||
              'Unknown Sender',

            senderRole:
              value.senderRole ||
              '',

            recipientId:
              value.recipientId ||
              '',

            recipientName:
              value.recipientName ||
              'Unknown Recipient',

            recipientRole:
              value.recipientRole ||
              '',

            subject:
              value.subject ||
              '(No Subject)',

            body:
              value.body ||
              value.message ||
              '',

            type:
              value.type === 'group'
                ? 'group'
                : 'individual',

            priority:
              value.priority === 'urgent'
                ? 'urgent'
                : value.priority === 'important'
                  ? 'important'
                  : 'normal',

            status:
              value.status === 'read'
                ? 'read'
                : value.status === 'sent'
                  ? 'sent'
                  : 'unread',

            groupId:
              value.groupId ||
              '',

            groupName:
              value.groupName ||
              '',

            parentMessageId:
              value.parentMessageId ||
              '',

            replyToId:
              value.replyToId ||
              '',

            replyToSubject:
              value.replyToSubject ||
              '',

            createdAt:
              Number(value.createdAt) ||
              Date.now(),

            readAt:
              value.readAt
                ? Number(value.readAt)
                : undefined

          };


          // ---------------------------------------------------
          // VERIFY MESSAGE BELONGS TO THIS PARENT
          // ---------------------------------------------------

          const belongsToParent =
            message.senderId === this.parentId ||
            message.recipientId === this.parentId;


          if (!belongsToParent) {

            console.warn(
              'Skipping message that does not belong to parent:',
              message.id
            );

            return;

          }


          this.messages.push(message);

        }
      );


      // -------------------------------------------------------
      // SORT NEWEST FIRST
      // -------------------------------------------------------

      this.messages.sort(
        (a, b) =>
          b.createdAt - a.createdAt
      );


      console.log(
        'Parent messages loaded:',
        this.messages.length
      );


    } catch (error) {

      console.error(
        'Error loading parent messages:',
        error
      );

      throw error;

    }

  }


  // =========================================================
  // LOAD RECIPIENTS
  // =========================================================

  async loadRecipients(): Promise<void> {

    try {

      this.recipients = [];


      // =======================================================
      // STAFF
      // =======================================================

      try {

        const staffRef =
          ref(
            database,
            'staff'
          );


        const staffQuery =
          query(
            staffRef,
            orderByChild('status'),
            equalTo('active')
          );


        const staffSnapshot =
          await get(staffQuery);


        if (staffSnapshot.exists()) {

          const staffData =
            staffSnapshot.val();


          Object.entries(staffData).forEach(
            ([id, value]: [string, any]) => {

              if (!value) {

                return;

              }


              /*
               * IMPORTANT:
               *
               * If the staff record contains a Firebase UID,
               * use it.
               *
               * Otherwise fall back to the record ID.
               */

              const staffId =
                value.uid ||
                value.firebaseUid ||
                id;


              const staffName =
                value.fullName ||
                [
                  value.firstName,
                  value.middleName,
                  value.lastName
                ]
                  .filter(Boolean)
                  .join(' ') ||
                'Staff';


              this.recipients.push({

                id: staffId,

                name: staffName,

                role: 'staff'

              });

            }
          );

        }

      } catch (staffError) {

        console.error(
          'Unable to load staff recipients:',
          staffError
        );

      }


      // =======================================================
      // ADMIN
      // =======================================================

      try {

        const usersRef =
          ref(
            database,
            'users'
          );


        const adminQuery =
          query(
            usersRef,
            orderByChild('role'),
            equalTo('admin')
          );


        const usersSnapshot =
          await get(adminQuery);


        if (usersSnapshot.exists()) {

          const usersData =
            usersSnapshot.val();


          Object.entries(usersData).forEach(
            ([uid, value]: [string, any]) => {

              if (!value) {

                return;

              }


              this.recipients.push({

                id: uid,

                name:
                  value.fullName ||
                  value.email ||
                  'Administrator',

                role: 'admin'

              });

            }
          );

        }

      } catch (adminError) {

        console.error(
          'Unable to load admin recipients:',
          adminError
        );

      }


      // =======================================================
      // REMOVE DUPLICATES
      // =======================================================

      const uniqueRecipients =
        new Map<string, MessageRecipient>();


      this.recipients.forEach(
        recipient => {

          const key =
            `${recipient.role}:${recipient.id}`;


          if (
            !uniqueRecipients.has(key)
          ) {

            uniqueRecipients.set(
              key,
              recipient
            );

          }

        }
      );


      this.recipients =
        Array.from(
          uniqueRecipients.values()
        );


      // =======================================================
      // SORT
      // =======================================================

      this.recipients.sort(
        (a, b) =>
          a.name.localeCompare(b.name)
      );


      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Error loading parent message recipients:',
        error
      );

    }

  }


  // =========================================================
  // FOLDER
  // =========================================================

  setFolder(
    folder: MessageFolder
  ): void {

    this.activeFolder =
      folder;

    this.selectedMessage =
      null;

  }


  // =========================================================
  // FILTERED MESSAGES
  // =========================================================

  get filteredMessages(): MessageRecord[] {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    return this.messages.filter(
      message => {

        const isIncoming =
          message.recipientId ===
          this.parentId;


        const isOutgoing =
          message.senderId ===
          this.parentId;


        const matchesFolder =
          this.activeFolder === 'inbox'
            ? isIncoming
            : isOutgoing;


        if (!matchesFolder) {

          return false;

        }


        const matchesSearch =
          !search ||

          (message.subject || '')
            .toLowerCase()
            .includes(search) ||

          (message.body || '')
            .toLowerCase()
            .includes(search) ||

          (message.senderName || '')
            .toLowerCase()
            .includes(search) ||

          (message.senderRole || '')
            .toLowerCase()
            .includes(search) ||

          (message.recipientName || '')
            .toLowerCase()
            .includes(search) ||

          (message.recipientRole || '')
            .toLowerCase()
            .includes(search);


        return matchesSearch;

      }

    );

  }


  // =========================================================
  // UNREAD COUNT
  // =========================================================

  get unreadCount(): number {

    return this.messages.filter(
      message =>

        message.recipientId ===
        this.parentId &&

        message.status ===
        'unread'
    ).length;

  }


  // =========================================================
  // INBOX COUNT
  // =========================================================

  get inboxCount(): number {

    return this.messages.filter(
      message =>

        message.recipientId ===
        this.parentId
    ).length;

  }


  // =========================================================
  // SENT COUNT
  // =========================================================

  get sentCount(): number {

    return this.messages.filter(
      message =>

        message.senderId ===
        this.parentId
    ).length;

  }


  // =========================================================
  // OPEN MESSAGE
  // =========================================================

  async openMessage(
    message: MessageRecord
  ): Promise<void> {

    this.selectedMessage =
      message;


    // -------------------------------------------------------
    // MARK INCOMING MESSAGE AS READ
    // -------------------------------------------------------

    if (

      message.recipientId ===
      this.parentId &&

      message.status ===
      'unread'

    ) {

      try {

        const now =
          Date.now();


        const updates: {
          [path: string]: any
        } = {

          [`messages/${message.id}/status`]:
            'read',

          [`messages/${message.id}/readAt`]:
            now,

          [`parentMessages/${this.parentId}/${message.id}/status`]:
            'read',

          [`parentMessages/${this.parentId}/${message.id}/readAt`]:
            now

        };


        await update(
          ref(database),
          updates
        );


        message.status =
          'read';

        message.readAt =
          now;


      } catch (error) {

        console.error(
          'Error marking parent message as read:',
          error
        );

      }

    }


    this.cdr.detectChanges();

  }


  // =========================================================
  // MARK ALL READ
  // =========================================================

  async markAllAsRead(): Promise<void> {

    const unreadMessages =
      this.messages.filter(
        message =>

          message.recipientId ===
          this.parentId &&

          message.status ===
          'unread'
      );


    if (!unreadMessages.length) {

      return;

    }


    const now =
      Date.now();


    try {

      const updates: {
        [path: string]: any
      } = {};


      unreadMessages.forEach(
        message => {

          updates[
            `messages/${message.id}/status`
          ] = 'read';


          updates[
            `messages/${message.id}/readAt`
          ] = now;


          updates[
            `parentMessages/${this.parentId}/${message.id}/status`
          ] = 'read';


          updates[
            `parentMessages/${this.parentId}/${message.id}/readAt`
          ] = now;

        }
      );


      await update(
        ref(database),
        updates
      );


      unreadMessages.forEach(
        message => {

          message.status =
            'read';

          message.readAt =
            now;

        }
      );


      this.successMessage =
        'All messages have been marked as read.';


      setTimeout(() => {

        this.successMessage = '';

        this.cdr.detectChanges();

      }, 3000);


    } catch (error) {

      console.error(
        'Error marking messages as read:',
        error
      );


      this.errorMessage =
        'Unable to mark all messages as read.';

    }


    this.cdr.detectChanges();

  }


  // =========================================================
  // OPEN COMPOSE
  // =========================================================

  openCompose(): void {

    this.showCompose =
      true;

    this.selectedMessage =
      null;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.messageForm = {

      recipientId: '',

      recipientName: '',

      recipientRole: '',

      subject: '',

      body: ''

    };


    this.cdr.detectChanges();

  }


  // =========================================================
  // CLOSE COMPOSE
  // =========================================================

  closeCompose(): void {

    this.showCompose =
      false;

    this.sending =
      false;

  }


  // =========================================================
  // SELECT RECIPIENT
  // =========================================================

  selectRecipient(
    recipient: MessageRecipient
  ): void {

    this.messageForm.recipientId =
      recipient.id;

    this.messageForm.recipientName =
      recipient.name;

    this.messageForm.recipientRole =
      recipient.role;

  }


  // =========================================================
  // SEND MESSAGE
  // =========================================================

  async sendMessage(): Promise<void> {

    if (this.sending) {

      return;

    }


    this.errorMessage =
      '';

    this.successMessage =
      '';


    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (
      !this.messageForm.recipientId
    ) {

      this.errorMessage =
        'Please select a recipient.';

      return;

    }


    if (
      !this.messageForm.subject.trim()
    ) {

      this.errorMessage =
        'Please enter a subject.';

      return;

    }


    if (
      !this.messageForm.body.trim()
    ) {

      this.errorMessage =
        'Please enter your message.';

      return;

    }


    if (!this.parentId) {

      this.errorMessage =
        'Your parent Firebase account ID could not be found.';

      return;

    }


    this.sending =
      true;


    try {

      const now =
        Date.now();


      // -------------------------------------------------------
      // CREATE MESSAGE ID
      // -------------------------------------------------------

      const newMessageRef =
        push(
          ref(
            database,
            'messages'
          )
        );


      const messageId =
        newMessageRef.key;


      if (!messageId) {

        throw new Error(
          'Unable to create message ID.'
        );

      }


      // -------------------------------------------------------
      // MESSAGE DATA
      // -------------------------------------------------------

      const messageData = {

        id:
          messageId,

        senderId:
          this.parentId,

        senderName:
          this.parentName,

        senderRole:
          'parent',

        recipientId:
          this.messageForm.recipientId,

        recipientName:
          this.messageForm.recipientName,

        recipientRole:
          this.messageForm.recipientRole,

        subject:
          this.messageForm.subject.trim(),

        body:
          this.messageForm.body.trim(),

        type:
          'individual' as const,

        priority:
          'normal' as const,

        status:
          'unread' as const,

        createdAt:
          now

      };


      // -------------------------------------------------------
      // ATOMIC WRITE
      // -------------------------------------------------------
      //
      // messages/{messageId}
      //
      // parentMessages/{parentFirebaseUid}/{messageId}
      //
      // -------------------------------------------------------

      const updates: {
        [path: string]: any
      } = {

        [`messages/${messageId}`]:
          messageData,

        [`parentMessages/${this.parentId}/${messageId}`]:
          messageData

      };


      await update(
        ref(database),
        updates
      );


      console.log(
        'Parent message sent:',
        messageData
      );


      this.successMessage =
        'Message sent successfully.';


      this.showCompose =
        false;


      await this.loadMessages();


    } catch (error) {

      console.error(
        'Error sending parent message:',
        error
      );


      this.errorMessage =
        'Unable to send your message. Please try again.';

    } finally {

      this.sending =
        false;

      this.cdr.detectChanges();

    }

  }


  // =========================================================
  // REPLY
  // =========================================================

  replyToMessage(
    message: MessageRecord
  ): void {

    if (!message.senderId) {

      this.errorMessage =
        'This message cannot be replied to because the sender ID is missing.';

      return;

    }


    const recipientId =
      message.senderId;


    const recipientName =
      message.senderName ||
      'Sender';


    const recipientRole =
      message.senderRole ||
      '';


    const originalSubject =
      message.subject ||
      '(No Subject)';


    const replySubject =
      /^re:\s*/i.test(originalSubject)

        ? originalSubject

        : `Re: ${originalSubject}`;


    this.messageForm = {

      recipientId,

      recipientName,

      recipientRole,

      subject:
        replySubject,

      body: ''

    };


    this.selectedMessage =
      null;


    this.showCompose =
      true;


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.cdr.detectChanges();

  }


  // =========================================================
  // DELETE MESSAGE
  // =========================================================

  async deleteMessage(
    message: MessageRecord
  ): Promise<void> {

    const isIncoming =
      message.recipientId ===
      this.parentId;


    const confirmed =
      confirm(

        isIncoming

          ? `Delete this message from ${message.senderName || 'this sender'}?`

          : `Delete this sent message to ${message.recipientName || 'this recipient'}?`

      );


    if (!confirmed) {

      return;

    }


    try {

      const updates: {
        [path: string]: any
      } = {

        [`messages/${message.id}`]:
          null,

        [`parentMessages/${this.parentId}/${message.id}`]:
          null

      };


      await update(
        ref(database),
        updates
      );


      this.messages =
        this.messages.filter(
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

      }


      this.successMessage =
        'Message deleted successfully.';


      this.cdr.detectChanges();


      setTimeout(() => {

        this.successMessage =
          '';

        this.cdr.detectChanges();

      }, 3000);


    } catch (error) {

      console.error(
        'Error deleting parent message:',
        error
      );


      this.errorMessage =
        'Unable to delete this message.';

    }

  }


  // =========================================================
  // REFRESH
  // =========================================================

  async refreshMessages(): Promise<void> {

    this.loading =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    try {

      await this.loadMessages();

      await this.loadRecipients();


      this.successMessage =
        'Messages refreshed successfully.';


      setTimeout(() => {

        this.successMessage =
          '';

        this.cdr.detectChanges();

      }, 2500);


    } catch (error) {

      console.error(
        'Parent message refresh error:',
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


  // =========================================================
  // MESSAGE DIRECTION
  // =========================================================

  isIncoming(
    message: MessageRecord
  ): boolean {

    return (
      message.recipientId ===
      this.parentId
    );

  }


  // =========================================================
  // DISPLAY PERSON
  // =========================================================

  getDisplayPerson(
    message: MessageRecord
  ): string {

    return this.isIncoming(message)

      ? message.senderName

      : message.recipientName;

  }


  // =========================================================
  // DISPLAY ROLE
  // =========================================================

  getDisplayRole(
    message: MessageRecord
  ): string {

    return this.isIncoming(message)

      ? message.senderRole

      : message.recipientRole;

  }


  // =========================================================
  // LOGOUT
  // =========================================================

  async logout(): Promise<void> {

    try {

      await this.schoolAuth.logout();

      window.location.href =
        '/home';

    } catch (error) {

      console.error(
        'Parent logout error:',
        error
      );

    }

  }

}