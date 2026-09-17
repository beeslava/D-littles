import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeachingAssignment } from './teaching-assignment';

describe('TeachingAssignment', () => {
  let component: TeachingAssignment;
  let fixture: ComponentFixture<TeachingAssignment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeachingAssignment],
    }).compileComponents();

    fixture = TestBed.createComponent(TeachingAssignment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
