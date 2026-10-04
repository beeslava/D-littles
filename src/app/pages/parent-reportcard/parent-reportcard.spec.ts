import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ParentReportcard } from './parent-reportcard';

describe('ParentReportcard', () => {
  let component: ParentReportcard;
  let fixture: ComponentFixture<ParentReportcard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentReportcard],
    }).compileComponents();

    fixture = TestBed.createComponent(ParentReportcard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
