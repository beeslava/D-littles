import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Admissions } from './admissions';

describe('Admissions', () => {
  let component: Admissions;
  let fixture: ComponentFixture<Admissions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Admissions],
    }).compileComponents();

    fixture = TestBed.createComponent(Admissions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
