import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminFees } from './admin-fees';

describe('AdminFees', () => {
  let component: AdminFees;
  let fixture: ComponentFixture<AdminFees>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminFees],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminFees);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
