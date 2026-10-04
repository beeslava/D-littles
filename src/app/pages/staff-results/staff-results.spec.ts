import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StaffResults } from './staff-results';

describe('StaffResults', () => {
  let component: StaffResults;
  let fixture: ComponentFixture<StaffResults>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffResults],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffResults);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
