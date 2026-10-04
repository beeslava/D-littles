import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StaffClasses } from './staff-classes';

describe('StaffClasses', () => {
  let component: StaffClasses;
  let fixture: ComponentFixture<StaffClasses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffClasses],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffClasses);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
