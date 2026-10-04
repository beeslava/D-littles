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

import { SchoolAuthService } from '../../core/Auth/school-auth.service';
import { database } from '../../core/firebase.config';

interface ParentChild {
id: string;
studentId: string;
firstName: string;
lastName: string;
fullName: string;
className: string;
classId?: string;
parentId?: string;
uid?: string;
status?: string;
}

interface ReportResult {
id: string;
studentId: string;
studentName: string;
studentRecordId?: string;
studentUid?: string;
parentId?: string;
classId?: string;
className?: string;
subjectId?: string;
subjectName: string;
teacherId?: string;
teacherName?: string;
sessionId?: string;
sessionName?: string;
termId?: string;
termName?: string;
ca1: number;
ca2: number;
exam: number;
total: number;
grade: string;
remark: string;
status: string;
createdAt?: number;
updatedAt?: number;
}

interface SubjectSummary {
subjectName: string;
ca1: number;
ca2: number;
exam: number;
total: number;
grade: string;
remark: string;
}

@Component({
selector: 'app-parent-report-card',
standalone: true,
imports: [CommonModule, FormsModule],
templateUrl: './parent-reportcard.html',
styleUrls: ['./parent-reportcard.css']
})
export class ParentReportCard implements OnInit {

parentUid = '';
parentName = '';

children: ParentChild[] = [];
selectedChildId = '';
selectedChild: ParentChild | null = null;

results: ReportResult[] = [];
filteredResults: ReportResult[] = [];
subjects: SubjectSummary[] = [];

sessionName = '';
termName = '';
className = '';
reportDate = new Date();

totalSubjects = 0;
totalScore = 0;
averageScore = 0;
highestScore = 0;
lowestScore = 0;

loading = false;
loadingChildren = false;
loadingReport = false;
exporting = false;

errorMessage = '';
successMessage = '';

constructor(
private authService: SchoolAuthService,
private cdr: ChangeDetectorRef
) {}

async ngOnInit(): Promise<void> {
console.log(
'Parent Report Card initialized'
);


await this.loadParent();

if (this.parentUid) {
  await this.loadChildren();
}


}

// =========================================================
// LOAD PARENT
// =========================================================

async loadParent(): Promise<void> {


try {

  this.loading = true;

  const user =
    this.authService.getUser();

  if (!user) {

    this.errorMessage =
      'Unable to identify the parent account.';

    return;
  }

  this.parentUid =
    user.uid;

  console.log(
    'Parent Report Card Firebase UID:',
    this.parentUid
  );

  const userSnapshot =
    await get(
      ref(
        database,
        `users/${this.parentUid}`
      )
    );

  if (userSnapshot.exists()) {

    const userData =
      userSnapshot.val();

    this.parentName =
      userData.fullName ||
      userData.name ||
      '';
  }

} catch (error) {

  console.error(
    'Error loading parent:',
    error
  );

  this.errorMessage =
    'Unable to load parent information.';

} finally {

  this.loading = false;

  this.cdr.detectChanges();
}


}

// =========================================================
// LOAD CHILDREN
// =========================================================

async loadChildren(): Promise<void> {

try {

  this.loadingChildren = true;
  this.errorMessage = '';

  console.log(
    'Loading children for parent:',
    this.parentUid
  );

  if (!this.parentUid) {

    this.errorMessage =
      'Parent account could not be identified.';

    return;
  }

  const studentsQuery =
    query(
      ref(
        database,
        'students'
      ),
      orderByChild('parentId'),
      equalTo(this.parentUid)
    );

  const studentsSnapshot =
    await get(
      studentsQuery
    );

  const loadedChildren:
    ParentChild[] = [];

  if (studentsSnapshot.exists()) {

    const studentsData =
      studentsSnapshot.val();

    Object.entries(
      studentsData
    ).forEach(
      ([id, value]: [string, any]) => {

        const firstName =
          value.firstName || '';

        const lastName =
          value.lastName || '';

        const fullName =
          value.fullName ||
          `${firstName} ${lastName}`.trim();

        loadedChildren.push({

          id,

          studentId:
            value.studentId ||
            id,

          firstName,

          lastName,

          fullName,

          className:
            value.className ||
            value.class ||
            '',

          classId:
            value.classId ||
            '',

          parentId:
            value.parentId ||
            '',

          uid:
            value.uid ||
            '',

          status:
            value.status ||
            'active'
        });

      }
    );
  }

  loadedChildren.sort(
    (a, b) =>
      a.fullName.localeCompare(
        b.fullName
      )
  );

  this.children =
    loadedChildren;

  console.log(
    'Parent children loaded:',
    this.children
  );

  if (
    this.children.length > 0
  ) {

    this.selectedChildId =
      this.children[0].studentId;

    await this.selectChild();

  } else {

    console.log(
      'No children found for parent:',
      this.parentUid
    );

    this.selectedChild = null;

    this.results = [];

    this.filteredResults = [];

    this.subjects = [];
  }

} catch (error) {

  console.error(
    'Error loading children:',
    error
  );

  this.errorMessage =
    'Unable to load your children.';

} finally {

  this.loadingChildren = false;

  this.cdr.detectChanges();
}


}

// =========================================================
// SELECT CHILD
// =========================================================

async selectChild(): Promise<void> {


this.clearMessages();

this.selectedChild =
  this.children.find(
    child =>
      child.studentId ===
      this.selectedChildId
  ) || null;

if (!this.selectedChild) {

  this.results = [];

  this.filteredResults = [];

  this.subjects = [];

  return;
}

console.log(
  'Selected child:',
  this.selectedChild
);

await this.loadReportCard();


}

// =========================================================
// LOAD REPORT CARD
// =========================================================

async loadReportCard(): Promise<void> {

if (!this.selectedChild) {
  return;
}

try {

  this.loadingReport = true;

  this.errorMessage = '';

  this.results = [];

  this.filteredResults = [];

  this.subjects = [];

  console.log(
    'Loading report card for:',
    this.selectedChild.studentId
  );

  const resultsQuery =
    query(
      ref(
        database,
        'results'
      ),
      orderByChild('parentId'),
      equalTo(this.parentUid)
    );

  const resultsSnapshot =
    await get(
      resultsQuery
    );

  if (!resultsSnapshot.exists()) {

    console.log(
      'No results found for parent:',
      this.parentUid
    );

    this.sessionName = '';

    this.termName = '';

    this.className =
      this.selectedChild.className ||
      '';

    this.calculateSummary();

    return;
  }

  const resultsData =
    resultsSnapshot.val();

  const loadedResults:
    ReportResult[] = [];

  Object.entries(
    resultsData
  ).forEach(
    ([id, value]: [string, any]) => {

      if (
        value.status !==
        'published'
      ) {
        return;
      }

      const matchesStudentId =
        value.studentId ===
        this.selectedChild!.studentId;

      const matchesRecordId =
        value.studentRecordId ===
        this.selectedChild!.id;

      const matchesUid =
        !!value.studentUid &&
        value.studentUid ===
        this.selectedChild!.uid;

      if (
        !matchesStudentId &&
        !matchesRecordId &&
        !matchesUid
      ) {
        return;
      }

      loadedResults.push({

        id,

        studentId:
          value.studentId ||
          this.selectedChild!.studentId,

        studentName:
          value.studentName ||
          this.selectedChild!.fullName,

        studentRecordId:
          value.studentRecordId ||
          this.selectedChild!.id,

        studentUid:
          value.studentUid ||
          this.selectedChild!.uid,

        parentId:
          value.parentId ||
          this.parentUid,

        classId:
          value.classId ||
          this.selectedChild!.classId ||
          '',

        className:
          value.className ||
          this.selectedChild!.className ||
          '',

        subjectId:
          value.subjectId ||
          '',

        subjectName:
          value.subjectName ||
          'Unknown Subject',

        teacherId:
          value.teacherId ||
          '',

        teacherName:
          value.teacherName ||
          '',

        sessionId:
          value.sessionId ||
          '',

        sessionName:
          value.sessionName ||
          '',

        termId:
          value.termId ||
          '',

        termName:
          value.termName ||
          '',

        ca1:
          this.toNumber(
            value.ca1
          ),

        ca2:
          this.toNumber(
            value.ca2
          ),

        exam:
          this.toNumber(
            value.exam
          ),

        total:
          this.toNumber(
            value.total
          ),

        grade:
          value.grade ||
          '',

        remark:
          value.remark ||
          '',

        status:
          value.status,

        createdAt:
          value.createdAt,

        updatedAt:
          value.updatedAt
      });

    }
  );

  loadedResults.sort(
    (a, b) =>
      a.subjectName.localeCompare(
        b.subjectName
      )
  );

  this.results =
    loadedResults;

  this.filteredResults = [
    ...loadedResults
  ];

  console.log(
    'Published report card results:',
    this.results
  );

  if (
    this.results.length > 0
  ) {

    const first =
      this.results[0];

    this.sessionName =
      first.sessionName ||
      '';

    this.termName =
      first.termName ||
      '';

    this.className =
      first.className ||
      this.selectedChild.className ||
      '';

  } else {

    this.sessionName = '';

    this.termName = '';

    this.className =
      this.selectedChild.className ||
      '';
  }

  this.buildSubjectSummary();

  this.calculateSummary();

} catch (error) {

  console.error(
    'Error loading report card:',
    error
  );

  this.errorMessage =
    'Unable to load the report card.';

} finally {

  this.loadingReport = false;

  this.cdr.detectChanges();
}


}

// =========================================================
// BUILD SUBJECT SUMMARY
// =========================================================

buildSubjectSummary(): void {


this.subjects =
  this.filteredResults.map(
    result => ({

      subjectName:
        result.subjectName,

      ca1:
        result.ca1,

      ca2:
        result.ca2,

      exam:
        result.exam,

      total:
        result.total,

      grade:
        result.grade,

      remark:
        result.remark

    })
  );


}

// =========================================================
// CALCULATE SUMMARY
// =========================================================

calculateSummary(): void {

this.totalSubjects =
  this.filteredResults.length;

this.totalScore =
  this.filteredResults.reduce(
    (sum, result) =>
      sum +
      this.toNumber(
        result.total
      ),
    0
  );

this.averageScore =
  this.totalSubjects > 0
    ? this.totalScore /
      this.totalSubjects
    : 0;

if (
  this.filteredResults.length > 0
) {

  const scores =
    this.filteredResults.map(
      result =>
        this.toNumber(
          result.total
        )
    );

  this.highestScore =
    Math.max(...scores);

  this.lowestScore =
    Math.min(...scores);

} else {

  this.highestScore = 0;

  this.lowestScore = 0;
}


}

// =========================================================
// CONVERT TO NUMBER
// =========================================================

toNumber(
value: any
): number {


const number =
  Number(value);

return isNaN(number)
  ? 0
  : number;


}

// =========================================================
// FORMAT NUMBER
// =========================================================

formatNumber(
value: number,
decimals = 2
): string {

return this
  .toNumber(value)
  .toFixed(decimals);


}

// =========================================================
// GRADE CLASS
// =========================================================

getGradeClass(
grade: string
): string {

switch (
  String(grade || '')
    .toUpperCase()
    .trim()
) {

  case 'A':
    return 'grade-a';

  case 'B':
    return 'grade-b';

  case 'C':
    return 'grade-c';

  case 'D':
    return 'grade-d';

  case 'E':
    return 'grade-e';

  case 'F':
    return 'grade-f';

  default:
    return '';
}


}

// =========================================================
// PERFORMANCE REMARK
// =========================================================

getPerformanceRemark(): string {


if (
  this.averageScore >= 70
) {

  return 'Excellent Performance';
}

if (
  this.averageScore >= 60
) {

  return 'Very Good Performance';
}

if (
  this.averageScore >= 50
) {

  return 'Good Performance';
}

if (
  this.averageScore >= 40
) {

  return 'Fair Performance';
}

return 'Needs Improvement';


}

// =========================================================
// PRINT REPORT CARD
// =========================================================

printReportCard(): void {


if (
  !this.selectedChild ||
  this.filteredResults.length === 0
) {

  this.errorMessage =
    'There are no published results to print.';

  return;
}

this.clearMessages();

console.log(
  'Printing report card for:',
  this.selectedChild.fullName
);

window.print();


}

// =========================================================
// EXPORT TO EXCEL
// =========================================================

async exportToExcel(): Promise<void> {


if (
  !this.selectedChild ||
  this.filteredResults.length === 0
) {

  this.errorMessage =
    'There are no published results to export.';

  return;
}

try {

  this.exporting = true;

  this.clearMessages();

  const XLSX =
    await import('xlsx');

  const workbook =
    XLSX.utils.book_new();

  const rows: any[][] = [

    [
      'D LITTLE PRIVATE SCHOOL'
    ],

    [
      'STUDENT REPORT CARD'
    ],

    [],

    [
      'Student Name',
      this.selectedChild.fullName
    ],

    [
      'Student ID',
      this.selectedChild.studentId
    ],

    [
      'Class',
      this.className
    ],

    [
      'Session',
      this.sessionName
    ],

    [
      'Term',
      this.termName
    ],

    [
      'Parent / Guardian',
      this.parentName
    ],

    [
      'Report Date',
      this.formatDate(
        this.reportDate
      )
    ],

    [],

    [
      'S/N',
      'SUBJECT',
      'CA1',
      'CA2',
      'EXAM',
      'TOTAL',
      'GRADE',
      'REMARK'
    ]
  ];

  this.filteredResults.forEach(
    (result, index) => {

      rows.push([

        index + 1,

        result.subjectName,

        result.ca1,

        result.ca2,

        result.exam,

        result.total,

        result.grade,

        result.remark

      ]);

    }
  );

  rows.push([]);

  rows.push([
    '',
    'SUMMARY'
  ]);

  rows.push([
    '',
    'Total Subjects',
    this.totalSubjects
  ]);

  rows.push([
    '',
    'Total Score',
    this.totalScore
  ]);

  rows.push([
    '',
    'Average Score',
    Number(
      this.averageScore.toFixed(2)
    )
  ]);

  rows.push([
    '',
    'Highest Score',
    this.highestScore
  ]);

  rows.push([
    '',
    'Lowest Score',
    this.lowestScore
  ]);

  rows.push([
    '',
    'Overall Performance',
    this.getPerformanceRemark()
  ]);

  const worksheet =
    XLSX.utils.aoa_to_sheet(
      rows
    );

  worksheet['!cols'] = [

    { wch: 7 },

    { wch: 30 },

    { wch: 12 },

    { wch: 12 },

    { wch: 12 },

    { wch: 12 },

    { wch: 12 },

    { wch: 30 }

  ];

  worksheet['!merges'] = [

    {
      s: {
        r: 0,
        c: 0
      },

      e: {
        r: 0,
        c: 7
      }
    },

    {
      s: {
        r: 1,
        c: 0
      },

      e: {
        r: 1,
        c: 7
      }
    }

  ];

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Report Card'
  );

  const safeName =
    this.selectedChild.fullName
      .replace(
        /[^a-zA-Z0-9]/g,
        '_'
      );

  const safeStudentId =
    this.selectedChild.studentId
      .replace(
        /[^a-zA-Z0-9-]/g,
        '_'
      );

  const filename =
    `D-Little_Report_Card_${safeName}_${safeStudentId}.xlsx`;

  XLSX.writeFile(
    workbook,
    filename
  );

  this.successMessage =
    'Report card exported successfully.';

} catch (error) {

  console.error(
    'Excel export error:',
    error
  );

  this.errorMessage =
    'Unable to export the report card to Excel.';

} finally {

  this.exporting = false;

  this.cdr.detectChanges();
}


}

// =========================================================
// FORMAT DATE
// =========================================================

formatDate(
date: Date
): string {


return date.toLocaleDateString(
  'en-NG',
  {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }
);


}

// =========================================================
// CLEAR MESSAGES
// =========================================================

clearMessages(): void {

this.errorMessage = '';

this.successMessage = '';


}

// =========================================================
// TRACK RESULT
// =========================================================

trackByResultId(
index: number,
result: ReportResult
): string {


return result.id;


}

// =========================================================
// TRACK CHILD
// =========================================================

trackByChildId(
index: number,
child: ParentChild
): string {


return child.id;


}

}
