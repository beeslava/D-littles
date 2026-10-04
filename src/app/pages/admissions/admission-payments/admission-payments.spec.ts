import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdmissionPayments } from './admission-payments';

describe('AdmissionPayments', () => {
  let component: AdmissionPayments;
  let fixture: ComponentFixture<AdmissionPayments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdmissionPayments],
    }).compileComponents();

    fixture = TestBed.createComponent(AdmissionPayments);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
