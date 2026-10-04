import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ParentResults } from './parent-results';

describe('ParentResults', () => {
  let component: ParentResults;
  let fixture: ComponentFixture<ParentResults>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentResults],
    }).compileComponents();

    fixture = TestBed.createComponent(ParentResults);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
