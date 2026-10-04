import { Injectable } from '@angular/core';

import {
  get,
  ref,
  query,
  orderByChild,
  equalTo
} from 'firebase/database';

import {
  SchoolUser
} from './Auth/school-auth.service';

import {
  database
} from './firebase.config';


// =========================================================
// STUDENT
// =========================================================

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


// =========================================================
// SCHOOL CLASS
// =========================================================

export interface SchoolClass {

  id: string;

  classCode?: string;

  className?: string;

  section?: string;

  classTeacherName?: string;

  academicYear?: string;

  status?: string;

}


// =========================================================
// RESULT
// =========================================================

export interface Result {

  id: string;

  studentId?: string;

  studentRecordId?: string;

  studentUid?: string;

  parentId?: string;

  classId?: string;

  subjectId?: string;

  subjectName?: string;

  sessionId?: string;

  sessionName?: string;

  termId?: string;

  termName?: string;

  ca1?: number;

  ca2?: number;

  exam?: number;

  total?: number;

  grade?: string;

  remark?: string;

  status?: string;

  teacherId?: string;

  teacherName?: string;

  studentName?: string;

  updatedAt?: number | string;

}


// =========================================================
// STUDENT SERVICE
// =========================================================

@Injectable({
  providedIn: 'root'
})
export class StudentService {

  constructor() {}


  // =========================================================
  // NORMALIZE ID
  // =========================================================

  private normalizeId(
    value: unknown
  ): string {

    return String(value ?? '')
      .trim()
      .toUpperCase();

  }


  // =========================================================
  // FIND CURRENT STUDENT
  // =========================================================

  async getStudent(
    currentUser: SchoolUser
  ): Promise<Student | null> {

    if (!currentUser || !currentUser.uid) {
      return null;
    }

    const studentsRef =
      ref(
        database,
        'students'
      );

    const studentQuery =
      query(
        studentsRef,
        orderByChild('uid'),
        equalTo(currentUser.uid)
      );

    const snapshot =
      await get(studentQuery);

    if (!snapshot.exists()) {
      return null;
    }

    const studentsData =
      snapshot.val();

    const keys =
      Object.keys(studentsData);

    if (!keys.length) {
      return null;
    }

    const key =
      keys[0];

    const data =
      studentsData[key];

    return {
      id: key,
      ...data
    };

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

    const classRef =
      ref(
        database,
        `classes/${classId}`
      );

    const snapshot =
      await get(classRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: classId,
      ...snapshot.val()
    };

  }


  // =========================================================
  // GET PUBLISHED RESULTS FOR A STUDENT
  // =========================================================
  //
  // IMPORTANT:
  //
  // This method now queries ONLY by the real school
  // student ID.
  //
  // Example:
  //
  // DL-S-000015
  //
  // We DO NOT query using the Firebase student record key.
  //
  // =========================================================

  async getPublishedResultsForStudent(
    studentId: string
  ): Promise<Result[]> {

    const schoolStudentId =
      this.normalizeId(studentId);

    if (!schoolStudentId) {
      return [];
    }

    console.log(
      '================================================'
    );

    console.log(
      'Loading published results for student:',
      schoolStudentId
    );

    console.log(
      '================================================'
    );


    const resultsRef =
      ref(
        database,
        'results'
      );

    const resultsQuery =
      query(
        resultsRef,
        orderByChild('studentId'),
        equalTo(schoolStudentId)
      );


    try {

      const snapshot =
        await get(resultsQuery);


      if (!snapshot.exists()) {

        console.log(
          'No results found for student:',
          schoolStudentId
        );

        return [];

      }


      const resultsData =
        snapshot.val();

      const results: Result[] = [];


      for (
        const key of Object.keys(resultsData)
      ) {

        const data =
          resultsData[key];

        if (!data) {
          continue;
        }


        const result: Result = {

          id: key,

          ...data

        };


        const storedStudentId =
          this.normalizeId(
            result.studentId
          );


        const published =
          String(
            result.status ?? ''
          )
            .trim()
            .toLowerCase() === 'published';


        if (
          storedStudentId === schoolStudentId &&
          published
        ) {

          results.push(result);

        }

      }


      // =====================================================
      // SORT BY TOTAL
      // =====================================================

      results.sort(
        (a, b) =>
          Number(b.total || 0) -
          Number(a.total || 0)
      );


      console.log(
        'Published results found:',
        results
      );

      console.log(
        'Published result count:',
        results.length
      );


      return results;

    } catch (error) {

      console.error(
        'Error loading published results for student:',
        schoolStudentId,
        error
      );

      return [];

    }

  }


  // =========================================================
  // GET STUDENT RESULTS
  // =========================================================

  async getStudentResults(
    studentId: string
  ): Promise<Result[]> {

    return this.getPublishedResultsForStudent(
      studentId
    );

  }


  // =========================================================
  // GET CHILDREN FOR PARENT
  // =========================================================

  async getChildrenForParent(
    currentUser: SchoolUser
  ): Promise<Student[]> {

    if (!currentUser || !currentUser.uid) {
      return [];
    }

    const parentUid =
      currentUser.uid;

    console.log(
      'Loading children for parent Firebase UID:',
      parentUid
    );


    const studentsRef =
      ref(
        database,
        'students'
      );


    const studentsQuery =
      query(
        studentsRef,
        orderByChild('parentId'),
        equalTo(parentUid)
      );


    const snapshot =
      await get(studentsQuery);


    if (!snapshot.exists()) {

      console.log(
        'No children found for parent:',
        parentUid
      );

      return [];

    }


    const studentsData =
      snapshot.val();

    const students: Student[] = [];


    for (
      const key of Object.keys(studentsData)
    ) {

      const data =
        studentsData[key];

      if (!data) {
        continue;
      }


      students.push({

        id: key,

        ...data

      });

    }


    const activeChildren =
      students.filter(
        student =>
          !student.status ||
          String(student.status)
            .trim()
            .toLowerCase() === 'active'
      );


    console.log(
      'Children found for parent:',
      activeChildren
    );


    return activeChildren;

  }


  // =========================================================
  // GET CHILDREN RESULTS FOR PARENT
  // =========================================================
  //
  // IMPORTANT:
  //
  // Parent result loading is now based on parentId.
  //
  // The parent queries:
  //
  // /results
  //   orderByChild("parentId")
  //   equalTo(parentFirebaseUid)
  //
  // Then Angular filters the results for each child.
  //
  // =========================================================

  async getChildrenResults(
    currentUser: SchoolUser
  ): Promise<Result[]> {

    if (!currentUser || !currentUser.uid) {
      return [];
    }

    const parentUid =
      currentUser.uid;


    console.log(
      '================================================'
    );

    console.log(
      'Loading children results for parent:',
      parentUid
    );

    console.log(
      '================================================'
    );


    // =======================================================
    // GET CHILDREN
    // =======================================================

    const children =
      await this.getChildrenForParent(
        currentUser
      );


    if (!children.length) {

      console.log(
        'No children available for parent:',
        parentUid
      );

      return [];

    }


    // =======================================================
    // QUERY RESULTS USING PARENT UID
    // =======================================================

    console.log(
      'Querying results by parentId:',
      parentUid
    );


    const resultsRef =
      ref(
        database,
        'results'
      );


    const resultsQuery =
      query(
        resultsRef,
        orderByChild('parentId'),
        equalTo(parentUid)
      );


    try {

      const snapshot =
        await get(resultsQuery);


      if (!snapshot.exists()) {

        console.log(
          'No results found for parent:',
          parentUid
        );

        return [];

      }


      const resultsData =
        snapshot.val();

      const parentResults: Result[] = [];


      // =====================================================
      // BUILD CHILD STUDENT ID SET
      // =====================================================

      const childStudentIds =
        new Set(
          children
            .map(
              child =>
                this.normalizeId(
                  child.studentId
                )
            )
            .filter(
              id => !!id
            )
        );


      console.log(
        'Parent child student IDs:',
        Array.from(childStudentIds)
      );


      // =====================================================
      // PROCESS RESULTS
      // =====================================================

      for (
        const key of Object.keys(resultsData)
      ) {

        const data =
          resultsData[key];

        if (!data) {
          continue;
        }


        const result: Result = {

          id: key,

          ...data

        };


        const resultStudentId =
          this.normalizeId(
            result.studentId
          );


        const published =
          String(
            result.status ?? ''
          )
            .trim()
            .toLowerCase() === 'published';


        const belongsToChild =
          childStudentIds.has(
            resultStudentId
          );


        if (
          published &&
          belongsToChild
        ) {

          parentResults.push({

            ...result,

            parentId:
              result.parentId ||
              parentUid

          });

        }

      }


      // =====================================================
      // REMOVE DUPLICATES
      // =====================================================

      const uniqueResults =
        parentResults.filter(
          (result, index, array) =>
            index ===
            array.findIndex(
              item =>
                item.id === result.id
            )
        );


      // =====================================================
      // SORT
      // =====================================================

      uniqueResults.sort(
        (a, b) => {

          const studentCompare =
            this.normalizeId(
              a.studentId
            ).localeCompare(
              this.normalizeId(
                b.studentId
              )
            );


          if (
            studentCompare !== 0
          ) {

            return studentCompare;

          }


          return (
            Number(b.total || 0) -
            Number(a.total || 0)
          );

        }
      );


      console.log(
        '================================================'
      );

      console.log(
        'FINAL PARENT RESULTS:',
        uniqueResults
      );

      console.log(
        'FINAL PARENT RESULT COUNT:',
        uniqueResults.length
      );

      console.log(
        '================================================'
      );


      return uniqueResults;

    } catch (error) {

      console.error(
        'Error loading parent results:',
        error
      );

      return [];

    }

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
      await this.getStudent(
        currentUser
      );


    if (!student) {

      return {

        student: null,

        studentClass: null,

        results: []

      };

    }


    let studentClass:
      SchoolClass | null = null;


    if (
      student.classId &&
      student.classId.trim()
    ) {

      studentClass =
        await this.getStudentClass(
          student.classId
        );

    }


    if (
      !studentClass &&
      (
        student.class ||
        student.className
      )
    ) {

      const className =
        student.className ||
        student.class ||
        '';


      studentClass = {

        id:
          student.classId ||
          className,

        className

      };

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

