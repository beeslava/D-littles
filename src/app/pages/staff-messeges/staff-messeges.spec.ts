import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StaffMesseges } from './staff-messeges';

describe('StaffMesseges', () => {
  let component: StaffMesseges;
  let fixture: ComponentFixture<StaffMesseges>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffMesseges],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffMesseges);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
