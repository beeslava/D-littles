import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StaffAttendance } from './staff-attendance';

describe('StaffAttendance', () => {
  let component: StaffAttendance;
  let fixture: ComponentFixture<StaffAttendance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffAttendance],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffAttendance);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
