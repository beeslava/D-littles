import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ParentFees } from './parent-fees';

describe('ParentFees', () => {
  let component: ParentFees;
  let fixture: ComponentFixture<ParentFees>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentFees],
    }).compileComponents();

    fixture = TestBed.createComponent(ParentFees);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
