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
  update
} from 'firebase/database';

import { database } from '../../../core/firebase.config';

import { AdminAuthService } from '../../../core/Auth/admin-auth.service';


// =========================================================
// MESSAGE INTERFACE
// =========================================================

export interface AdminMessage {

  id: string;

  senderId: string;
  senderName: string;
  senderRole: string;

  recipientId?: string;
  recipientName?: string;
  recipientRole?: string;

  subject: string;
  body: string;

  type: 'individual' | 'group';

  priority: 'normal' | 'important' | 'urgent';

  status: 'sent' | 'read' | 'unread';

  createdAt: number;
  readAt?: number;

  groupId?: string;
  groupName?: string;

  // =======================================================
  // REPLY INFORMATION
  // =======================================================

  replyToId?: string;
  replyToSubject?: string;
}


// =========================================================
// RECIPIENT INTERFACE
// =========================================================

export interface MessageRecipient {

  id: string;

  name: string;

  email?: string;

  role: string;
}


// =========================================================
// COMPONENT
// =========================================================

@Component({

  selector: 'app-admin-messages',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],

  templateUrl: './admin-messages.html',

  styleUrls: ['./admin-messages.css']

})


export class AdminMessages implements OnInit {


  // =======================================================
  // CURRENT ADMIN
  // =======================================================

  currentUser: any = null;


  // =======================================================
  // DATA
  // =======================================================

  messages: AdminMessage[] = [];

  recipients: MessageRecipient[] = [];


  // =======================================================
  // UI STATE
  // =======================================================

  loading = false;

  sending = false;

  deleting = false;

  showCompose = false;

  showViewModal = false;

  selectedMessage: AdminMessage | null = null;


  // =======================================================
  // REPLY STATE
  // =======================================================

  replyingToMessage: AdminMessage | null = null;


  // =======================================================
  // FILTERS
  // =======================================================

  searchTerm = '';

  recipientFilter = 'all';

  statusFilter = 'all';


  // =======================================================
  // NEW MESSAGE
  // =======================================================

  newMessage = {

    recipientId: '',

    recipientName: '',

    recipientRole: '',

    subject: '',

    body: '',

    type: 'individual' as
      'individual' | 'group',

    groupAudience: 'all' as
      'all' | 'student' | 'parent' | 'staff',

    priority: 'normal' as
      'normal' | 'important' | 'urgent'

  };


  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor(

    private readonly adminAuthService: AdminAuthService,

    private readonly cdr: ChangeDetectorRef

  ) {}


  // =======================================================
  // INIT
  // =======================================================

  async ngOnInit(): Promise<void> {

    try {

      // -----------------------------------------------------
      // GET CURRENT ADMIN
      // -----------------------------------------------------

      this.currentUser =
        this.adminAuthService.getUser();


      if (!this.currentUser) {

        console.error(
          'No authenticated admin found.'
        );

        return;

      }


      console.log(
        'Admin Firebase UID:',
        this.currentUser.uid
      );


      // -----------------------------------------------------
      // LOAD DATA
      // -----------------------------------------------------

      await this.loadMessages();

      await this.loadRecipients();


      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Error initializing admin messages:',
        error
      );

      this.currentUser = null;

    }

  }


  // =======================================================
  // LOAD MESSAGES
  // =======================================================

  async loadMessages(): Promise<void> {

    this.loading = true;

    try {

      const snapshot =
        await get(
          ref(
            database,
            'messages'
          )
        );


      this.messages = [];


      if (!snapshot.exists()) {

        return;

      }


      const data =
        snapshot.val();


      const adminUid =
        this.currentUser?.uid || '';


      Object.entries(data).forEach(
        ([id, value]: [string, any]) => {

          if (!value) {

            return;

          }


          // -------------------------------------------------
          // ADMIN MESSAGE VISIBILITY
          // -------------------------------------------------

          const isAdminSender =
            value.senderRole === 'admin' ||
            value.senderId === adminUid;


          const isAdminRecipient =
            value.recipientRole === 'admin' ||
            value.recipientId === adminUid;


          if (
            !isAdminSender &&
            !isAdminRecipient
          ) {

            return;

          }


          // -------------------------------------------------
          // NORMALIZE MESSAGE
          // -------------------------------------------------

          const message: AdminMessage = {

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
              value.recipientId || '',

            recipientName:
              value.recipientName ||
              'Administrator',

            recipientRole:
              value.recipientRole ||
              '',

            subject:
              value.subject ||
              '',

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

            createdAt:
              Number(value.createdAt) ||
              Date.now(),

            readAt:
              value.readAt
                ? Number(value.readAt)
                : undefined,

            groupId:
              value.groupId || '',

            groupName:
              value.groupName || '',

            replyToId:
              value.replyToId || '',

            replyToSubject:
              value.replyToSubject || ''

          };


          this.messages.push(
            message
          );

        }
      );


      // -----------------------------------------------------
      // NEWEST FIRST
      // -----------------------------------------------------

      this.messages.sort(
        (a, b) =>
          b.createdAt - a.createdAt
      );


    } catch (error) {

      console.error(
        'Error loading admin messages:',
        error
      );

    } finally {

      this.loading = false;

    }

  }


  // =======================================================
  // LOAD RECIPIENTS
  // =======================================================

  async loadRecipients(): Promise<void> {

    this.recipients = [];


    try {

      // =====================================================
      // STUDENTS
      // =====================================================

      const studentsSnapshot =
        await get(
          ref(
            database,
            'students'
          )
        );


      if (
        studentsSnapshot.exists()
      ) {

        const data =
          studentsSnapshot.val();


        Object.entries(data).forEach(
          ([id, value]: [string, any]) => {

            if (
              value?.status ===
              'inactive'
            ) {

              return;

            }


            const fullName =
              value.fullName ||
              `${value.firstName || ''} ${
                value.lastName || ''
              }`.trim();


            // Firebase UID first.
            const studentUid =
              value.uid ||
              value.firebaseUid ||
              id;


            this.recipients.push({

              id:
                studentUid,

              name:
                fullName ||
                'Student',

              email:
                value.email ||
                '',

              role:
                'student'

            });

          }
        );

      }


      // =====================================================
      // STAFF
      // =====================================================

      const staffSnapshot =
        await get(
          ref(
            database,
            'staff'
          )
        );


      if (
        staffSnapshot.exists()
      ) {

        const data =
          staffSnapshot.val();


        Object.entries(data).forEach(
          ([id, value]: [string, any]) => {

            if (
              value?.status ===
              'inactive'
            ) {

              return;

            }


            const fullName =
              value.fullName ||
              `${value.firstName || ''} ${
                value.lastName || ''
              }`.trim();


            const staffUid =
              value.uid ||
              value.firebaseUid ||
              id;


            this.recipients.push({

              id:
                staffUid,

              name:
                fullName ||
                'Staff',

              email:
                value.email ||
                '',

              role:
                'staff'

            });

          }
        );

      }


      // =====================================================
      // PARENTS
      // =====================================================

      const parentsSnapshot =
        await get(
          ref(
            database,
            'parents'
          )
        );


      if (
        parentsSnapshot.exists()
      ) {

        const data =
          parentsSnapshot.val();


        Object.entries(data).forEach(
          ([id, value]: [string, any]) => {

            if (
              value?.status ===
              'inactive'
            ) {

              return;

            }


            /*
             * IMPORTANT
             *
             * Parent messaging uses the Firebase Auth UID.
             *
             * Do NOT use:
             *
             *   value.parentId
             *
             * because parentId is the school ID/code.
             */

            const parentUid =
              value.uid ||
              value.firebaseUid ||
              '';


            if (!parentUid) {

              console.warn(
                'Skipping parent without Firebase UID:',
                id,
                value
              );

              return;

            }


            const parentName =
              value.fullName ||
              `${value.firstName || ''} ${
                value.lastName || ''
              }`.trim() ||
              'Parent';


            this.recipients.push({

              id:
                parentUid,

              name:
                parentName,

              email:
                value.email ||
                '',

              role:
                'parent'

            });

          }
        );

      }


      // =====================================================
      // REMOVE DUPLICATES
      // =====================================================

      const uniqueRecipients =
        new Map<
          string,
          MessageRecipient
        >();


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


      // =====================================================
      // SORT
      // =====================================================

      this.recipients.sort(
        (a, b) =>
          a.name.localeCompare(
            b.name
          )
      );


      console.log(
        'Message recipients loaded:',
        this.recipients
      );


    } catch (error) {

      console.error(
        'Error loading message recipients:',
        error
      );

    }

  }


  // =======================================================
  // OPEN COMPOSE
  // =======================================================

  openCompose(): void {

    this.replyingToMessage =
      null;

    this.resetMessage();

    this.showCompose =
      true;

    this.showViewModal =
      false;

    this.selectedMessage =
      null;

    this.cdr.detectChanges();

  }


  // =======================================================
  // CLOSE COMPOSE
  // =======================================================

  closeCompose(): void {

    if (this.sending) {

      return;

    }


    this.showCompose =
      false;

    this.replyingToMessage =
      null;

    this.resetMessage();

  }


  // =======================================================
  // SELECT MESSAGE TYPE
  // =======================================================

  selectMessageType(): void {

    if (
      this.newMessage.type ===
      'individual'
    ) {

      this.newMessage.groupAudience =
        'all';

      return;

    }


    this.newMessage.recipientId =
      '';

    this.newMessage.recipientName =
      '';

    this.newMessage.recipientRole =
      '';

  }


  // =======================================================
  // SELECT RECIPIENT
  // =======================================================

  selectRecipient(
    recipientId: string
  ): void {

    const recipient =
      this.recipients.find(
        r =>
          r.id ===
          recipientId
      );


    if (!recipient) {

      this.newMessage.recipientName =
        '';

      this.newMessage.recipientRole =
        '';

      return;

    }


    this.newMessage.recipientId =
      recipient.id;

    this.newMessage.recipientName =
      recipient.name;

    this.newMessage.recipientRole =
      recipient.role;

  }


  // =======================================================
  // GET GROUP RECIPIENTS
  // =======================================================

  getGroupRecipients():
    MessageRecipient[] {

    if (
      this.newMessage.groupAudience ===
      'all'
    ) {

      return [
        ...this.recipients
      ];

    }


    return this.recipients.filter(
      recipient =>
        recipient.role ===
        this.newMessage.groupAudience
    );

  }


  // =======================================================
  // GET GROUP NAME
  // =======================================================

  getGroupName(): string {

    switch (
      this.newMessage.groupAudience
    ) {

      case 'student':

        return 'All Students';


      case 'parent':

        return 'All Parents';


      case 'staff':

        return 'All Staff';


      default:

        return 'Everyone';

    }

  }


  // =======================================================
  // SEND MESSAGE
  // =======================================================

  async sendMessage(): Promise<void> {

    if (this.sending) {

      return;

    }


    // =====================================================
    // ADMIN AUTHENTICATION
    // =====================================================

    const admin =
      this.adminAuthService.getUser();


    if (!admin) {

      alert(
        'Your admin session has expired. Please log in again.'
      );

      return;

    }


    // =====================================================
    // VALIDATION
    // =====================================================

    if (
      !this.newMessage.subject.trim()
    ) {

      alert(
        'Please enter a subject.'
      );

      return;

    }


    if (
      !this.newMessage.body.trim()
    ) {

      alert(
        'Please enter a message.'
      );

      return;

    }


    if (
      this.newMessage.type ===
        'individual' &&
      !this.newMessage.recipientId
    ) {

      alert(
        'Please select a recipient.'
      );

      return;

    }


    // =====================================================
    // DETERMINE TARGET RECIPIENTS
    // =====================================================

    let targetRecipients:
      MessageRecipient[] = [];


    // -----------------------------------------------------
    // GROUP MESSAGE
    // -----------------------------------------------------

    if (
      this.newMessage.type ===
      'group'
    ) {

      targetRecipients =
        this.getGroupRecipients();


      if (
        targetRecipients.length ===
        0
      ) {

        alert(
          'There are no active recipients in this group.'
        );

        return;

      }

    }


    // -----------------------------------------------------
    // REPLY
    // -----------------------------------------------------

    else if (
      this.replyingToMessage
    ) {

      if (
        !this.replyingToMessage.senderId
      ) {

        alert(
          'Unable to reply because the original sender ID is missing.'
        );

        return;

      }


      targetRecipients = [

        {

          id:
            this.replyingToMessage.senderId,

          name:
            this.replyingToMessage.senderName ||
            'User',

          role:
            this.replyingToMessage.senderRole ||
            'user'

        }

      ];

    }


    // -----------------------------------------------------
    // NORMAL INDIVIDUAL MESSAGE
    // -----------------------------------------------------

    else {

      const recipient =
        this.recipients.find(
          r =>
            r.id ===
            this.newMessage.recipientId
        );


      if (!recipient) {

        alert(
          'The selected recipient could not be found.'
        );

        return;

      }


      targetRecipients = [
        recipient
      ];

    }


    // =====================================================
    // GROUP CONFIRMATION
    // =====================================================

    if (
      this.newMessage.type ===
      'group'
    ) {

      const groupName =
        this.getGroupName();


      const confirmed =
        confirm(
          `Send this message to ${groupName} (${
            targetRecipients.length
          } member${
            targetRecipients.length === 1
              ? ''
              : 's'
          })?`
        );


      if (!confirmed) {

        return;

      }

    }


    this.sending =
      true;


    try {

      // ===================================================
      // ADMIN NAME
      // ===================================================

      const adminName =
        admin.displayName ||
        admin.email ||
        'Administrator';


      // ===================================================
      // DATABASE UPDATES
      // ===================================================

      const updates: {
        [path: string]: any
      } = {};


      // ===================================================
      // GROUP INFORMATION
      // ===================================================

      let groupId:
        string | null = null;


      let groupName:
        string | null = null;


      if (
        this.newMessage.type ===
        'group'
      ) {

        groupId =
          push(
            ref(
              database,
              'messageGroups'
            )
          ).key;


        if (!groupId) {

          throw new Error(
            'Unable to create group message ID.'
          );

        }


        groupName =
          this.getGroupName();

      }


      const createdAt =
        Date.now();


      // ===================================================
      // CREATE MESSAGE FOR EACH RECIPIENT
      // ===================================================

      targetRecipients.forEach(
        recipient => {

          const messageRef =
            push(
              ref(
                database,
                'messages'
              )
            );


          const messageId =
            messageRef.key;


          if (!messageId) {

            return;

          }


          // ------------------------------------------------
          // MESSAGE
          // ------------------------------------------------

          const message:
            AdminMessage = {

            id:
              messageId,

            senderId:
              admin.uid,

            senderName:
              adminName,

            senderRole:
              'admin',

            recipientId:
              recipient.id,

            recipientName:
              recipient.name,

            recipientRole:
              recipient.role,

            subject:
              this.newMessage.subject.trim(),

            body:
              this.newMessage.body.trim(),

            type:
              this.newMessage.type,

            priority:
              this.newMessage.priority,

            status:
              'unread',

            createdAt

          };


          // ------------------------------------------------
          // REPLY INFORMATION
          // ------------------------------------------------

          if (
            this.replyingToMessage
          ) {

            message.replyToId =
              this.replyingToMessage.id;

            message.replyToSubject =
              this.replyingToMessage.subject;

          }


          // ------------------------------------------------
          // GROUP INFORMATION
          // ------------------------------------------------

          if (
            this.newMessage.type ===
              'group' &&
            groupId
          ) {

            message.groupId =
              groupId;

            message.groupName =
              groupName ||
              'Everyone';

          }


          // ------------------------------------------------
          // MAIN MESSAGE
          // ------------------------------------------------

          updates[
            `messages/${messageId}`
          ] = message;


          // =================================================
          // PARENT PRIVATE MESSAGE
          // =================================================
          //
          // Parent Messages reads:
          //
          // parentMessages/{Firebase Auth UID}/{messageId}
          //
          // So Admin -> Parent must be written there too.
          //
          // =================================================

          if (
            recipient.role ===
              'parent' &&
            recipient.id
          ) {

            updates[
              `parentMessages/${recipient.id}/${messageId}`
            ] = message;


            console.log(
              'Parent message mirror:',
              `parentMessages/${recipient.id}/${messageId}`
            );

          }

        }
      );


      // =====================================================
      // SAFETY CHECK
      // =====================================================

      if (
        Object.keys(updates).length ===
        0
      ) {

        throw new Error(
          'No messages were created.'
        );

      }


      console.log(
        'Admin message updates:',
        updates
      );


      // =====================================================
      // SAVE
      // =====================================================

      await update(
        ref(database),
        updates
      );


      // =====================================================
      // RELOAD
      // =====================================================

      await this.loadMessages();


      // =====================================================
      // SUCCESS
      // =====================================================

      if (
        this.replyingToMessage
      ) {

        alert(
          `Reply sent successfully to ${
            this.replyingToMessage.senderName
          }.`
        );

      }

      else if (
        this.newMessage.type ===
        'group'
      ) {

        alert(
          `${this.getGroupName()} message sent successfully to ${
            targetRecipients.length
          } member${
            targetRecipients.length === 1
              ? ''
              : 's'
          }.`
        );

      }

      else {

        alert(
          'Message sent successfully.'
        );

      }


      // =====================================================
      // CLOSE COMPOSE
      // =====================================================

      this.closeCompose();

      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Error sending admin message:',
        error
      );


      alert(
        'Unable to send message. Please try again.'
      );


    } finally {

      this.sending =
        false;

    }

  }


  // =======================================================
  // VIEW MESSAGE
  // =======================================================

  async viewMessage(
    message: AdminMessage
  ): Promise<void> {

    this.selectedMessage =
      message;

    this.showViewModal =
      true;


    // -----------------------------------------------------
    // MARK INCOMING MESSAGE AS READ
    // -----------------------------------------------------

    const adminUid =
      this.currentUser?.uid || '';


    const isIncoming =
      message.recipientId ===
        adminUid ||
      message.recipientRole ===
        'admin';


    if (
      isIncoming &&
      message.status ===
        'unread'
    ) {

      const readAt =
        Date.now();


      try {

        await update(
          ref(
            database,
            `messages/${message.id}`
          ),
          {

            status:
              'read',

            readAt

          }
        );


        message.status =
          'read';

        message.readAt =
          readAt;


      } catch (error) {

        console.error(
          'Error marking admin message as read:',
          error
        );

      }

    }


    this.cdr.detectChanges();

  }


  // =======================================================
  // CAN REPLY
  // =======================================================

  canReply(
    message: AdminMessage
  ): boolean {

    return (

      !!message &&

      message.senderRole !==
      'admin' &&

      !!message.senderId

    );

  }


  // =======================================================
  // REPLY TO MESSAGE
  // =======================================================

  replyToMessage(
    message: AdminMessage
  ): void {

    // -----------------------------------------------------
    // DON'T REPLY TO OWN MESSAGE
    // -----------------------------------------------------

    if (
      message.senderRole ===
      'admin'
    ) {

      alert(
        'This message was sent by you. You cannot reply to your own message.'
      );

      return;

    }


    // -----------------------------------------------------
    // CHECK SENDER
    // -----------------------------------------------------

    if (
      !message.senderId
    ) {

      alert(
        'Unable to reply because the sender information is missing.'
      );

      return;

    }


    // -----------------------------------------------------
    // CLOSE VIEW
    // -----------------------------------------------------

    this.showViewModal =
      false;


    // -----------------------------------------------------
    // STORE ORIGINAL
    // -----------------------------------------------------

    this.replyingToMessage =
      message;


    // -----------------------------------------------------
    // CREATE REPLY SUBJECT
    // -----------------------------------------------------

    const replySubject =
      message.subject

        ? (

            /^re:/i.test(
              message.subject
            )

              ? message.subject

              : `Re: ${message.subject}`

          )

        : 'Re:';


    // -----------------------------------------------------
    // PREPARE MESSAGE
    // -----------------------------------------------------

    this.newMessage = {

      recipientId:
        message.senderId,

      recipientName:
        message.senderName ||
        'User',

      recipientRole:
        message.senderRole ||
        '',

      subject:
        replySubject,

      body:
        '',

      type:
        'individual',

      groupAudience:
        'all',

      priority:
        message.priority ||
        'normal'

    };


    // -----------------------------------------------------
    // OPEN COMPOSE
    // -----------------------------------------------------

    this.showCompose =
      true;


    this.cdr.detectChanges();

  }


  // =======================================================
  // CLOSE VIEW
  // =======================================================

  closeView(): void {

    this.showViewModal =
      false;

    this.selectedMessage =
      null;

  }


  // =======================================================
  // DELETE MESSAGE
  // =======================================================

  async deleteMessage(
    message: AdminMessage
  ): Promise<void> {

    if (this.deleting) {

      return;

    }


    // -----------------------------------------------------
    // CONFIRM
    // -----------------------------------------------------

    const confirmed =
      confirm(

        `Delete this message ${
          message.senderRole ===
          'admin'

            ? `to ${
                message.recipientName ||
                'this recipient'
              }`

            : `from ${
                message.senderName ||
                'this sender'
              }`

        }?`

      );


    if (!confirmed) {

      return;

    }


    this.deleting =
      true;


    try {

      // ===================================================
      // DELETE MAIN MESSAGE
      // ===================================================

      const updates: {
        [path: string]: any
      } = {

        [`messages/${message.id}`]:
          null

      };


      // ===================================================
      // DELETE PARENT COPY
      // ===================================================

      if (
        message.recipientRole ===
          'parent' &&
        message.recipientId
      ) {

        updates[
          `parentMessages/${message.recipientId}/${message.id}`
        ] = null;

      }


      // ===================================================
      // DELETE
      // ===================================================

      await update(
        ref(database),
        updates
      );


      // ===================================================
      // UPDATE LOCAL DATA
      // ===================================================

      this.messages =
        this.messages.filter(
          m =>
            m.id !==
            message.id
        );


      if (
        this.selectedMessage?.id ===
        message.id
      ) {

        this.closeView();

      }


      this.cdr.detectChanges();


    } catch (error) {

      console.error(
        'Error deleting admin message:',
        error
      );


      alert(
        'Unable to delete message.'
      );


    } finally {

      this.deleting =
        false;

    }

  }


  // =======================================================
  // FILTERED MESSAGES
  // =======================================================

  get filteredMessages():
    AdminMessage[] {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    return this.messages.filter(
      message => {

        const matchesSearch =

          !search ||

          message.subject
            .toLowerCase()
            .includes(search) ||

          message.body
            .toLowerCase()
            .includes(search) ||

          (
            message.senderName ||
            ''
          )
            .toLowerCase()
            .includes(search) ||

          (
            message.senderRole ||
            ''
          )
            .toLowerCase()
            .includes(search) ||

          (
            message.recipientName ||
            ''
          )
            .toLowerCase()
            .includes(search) ||

          (
            message.recipientRole ||
            ''
          )
            .toLowerCase()
            .includes(search) ||

          (
            message.groupName ||
            ''
          )
            .toLowerCase()
            .includes(search);


        const matchesRecipient =
          this.recipientFilter ===
            'all' ||

          message.recipientRole ===
            this.recipientFilter;


        const matchesStatus =
          this.statusFilter ===
            'all' ||

          message.status ===
            this.statusFilter;


        return (

          matchesSearch &&

          matchesRecipient &&

          matchesStatus

        );

      }

    );

  }


  // =======================================================
  // RESET MESSAGE
  // =======================================================

  resetMessage(): void {

    this.newMessage = {

      recipientId: '',

      recipientName: '',

      recipientRole: '',

      subject: '',

      body: '',

      type:
        'individual',

      groupAudience:
        'all',

      priority:
        'normal'

    };

  }


  // =======================================================
  // FORMAT DATE
  // =======================================================

  formatDate(
    timestamp: number
  ): string {

    if (!timestamp) {

      return '';

    }


    return new Date(
      timestamp
    ).toLocaleString();

  }

}