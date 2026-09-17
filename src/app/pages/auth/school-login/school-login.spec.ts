import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SchoolLogin } from './school-login';

describe('SchoolLogin', () => {
  let component: SchoolLogin;
  let fixture: ComponentFixture<SchoolLogin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolLogin],
    }).compileComponents();

    fixture = TestBed.createComponent(SchoolLogin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
