import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubAdmins } from './sub-admins';

describe('SubAdmins', () => {
  let component: SubAdmins;
  let fixture: ComponentFixture<SubAdmins>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubAdmins],
    }).compileComponents();

    fixture = TestBed.createComponent(SubAdmins);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
