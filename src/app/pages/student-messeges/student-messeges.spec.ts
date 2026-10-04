import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StudentMesseges } from './student-messeges';

describe('StudentMesseges', () => {
  let component: StudentMesseges;
  let fixture: ComponentFixture<StudentMesseges>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentMesseges],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentMesseges);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
