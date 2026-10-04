import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StaffStudents } from './staff-students';

describe('StaffStudents', () => {
  let component: StaffStudents;
  let fixture: ComponentFixture<StaffStudents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffStudents],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffStudents);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
