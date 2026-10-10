import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Changepassward } from './changepassward';

describe('Changepassward', () => {
  let component: Changepassward;
  let fixture: ComponentFixture<Changepassward>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Changepassward],
    }).compileComponents();

    fixture = TestBed.createComponent(Changepassward);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
