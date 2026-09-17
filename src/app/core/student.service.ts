import { Injectable } from '@angular/core';

import {
  get,
  ref
} from 'firebase/database';
import { SchoolUser } from './Auth/school-auth.service';
import { database } from './firebase.config';




export interface Student {
  id: string;
  studentId: string;
  uid?: string;

  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;

  gender?: string;
  dateOfBirth?: string;

  classId?: string;
  className?: string;
  class?: string;

  parentId?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;

  status?: string;
}


export interface SchoolClass {
  id: string;

  classCode?: string;
  className?: string;
  section?: string;
  classTeacherName?: string;
  academicYear?: string;

  status?: string;
}


export interface Result {
  id: string;

  studentId?: string;
  classId?: string;
  subjectId?: string;
  subjectName?: string;

  sessionId?: string;
  termId?: string;

  total?: number;
  grade?: string;
  remark?: string;

  status?: string;
}


@Injectable({
  providedIn: 'root'
})
export class StudentService {

  constructor() {}


  // =========================================================
  // FIND CURRENT STUDENT
  // =========================================================

  async getStudent(
    currentUser: SchoolUser
  ): Promise<Student | null> {

    if (!currentUser) {
      return null;
    }

    const studentsRef = ref(
      database,
      'students'
    );

    const snapshot = await get(studentsRef);

    if (!snapshot.exists()) {
      return null;
    }

    const studentsData = snapshot.val();

    for (const key of Object.keys(studentsData)) {

      const data = studentsData[key];

      const matchesStudentId =
        !!currentUser.studentId &&
        data.studentId === currentUser.studentId;

      const matchesUid =
        data.uid === currentUser.uid;

      const matchesId =
        key === currentUser.studentId;

      if (
        matchesStudentId ||
        matchesUid ||
        matchesId
      ) {

        return {
          id: key,
          ...data
        };
      }
    }

    return null;
  }


  // =========================================================
  // GET STUDENT CLASS
  // =========================================================

  async getStudentClass(
    classId: string
  ): Promise<SchoolClass | null> {

    if (!classId) {
      return null;
    }

    const classRef = ref(
      database,
      `classes/${classId}`
    );

    const snapshot = await get(classRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: classId,
      ...snapshot.val()
    };
  }


  // =========================================================
  // GET PUBLISHED RESULTS
  // =========================================================

  async getStudentResults(
    studentId: string
  ): Promise<Result[]> {

    if (!studentId) {
      return [];
    }

    const resultsRef = ref(
      database,
      'results'
    );

    const snapshot = await get(resultsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const resultsData = snapshot.val();

    const results: Result[] = [];

    for (
      const key of Object.keys(resultsData)
    ) {

      const data = resultsData[key];

      if (
        data.studentId === studentId &&
        data.status === 'published'
      ) {

        results.push({
          id: key,
          ...data
        });
      }
    }

    results.sort(
      (a, b) =>
        (b.total || 0) -
        (a.total || 0)
    );

    return results;
  }


  // =========================================================
  // GET COMPLETE STUDENT DASHBOARD DATA
  // =========================================================

  async getDashboardData(
    currentUser: SchoolUser
  ): Promise<{
    student: Student | null;
    studentClass: SchoolClass | null;
    results: Result[];
  }> {

    const student =
      await this.getStudent(currentUser);

    if (!student) {

      return {
        student: null,
        studentClass: null,
        results: []
      };
    }

    let studentClass:
      SchoolClass | null = null;

    if (student.classId) {

      studentClass =
        await this.getStudentClass(
          student.classId
        );
    }

    const results =
      await this.getStudentResults(
        student.studentId
      );

    return {
      student,
      studentClass,
      results
    };
  }
}