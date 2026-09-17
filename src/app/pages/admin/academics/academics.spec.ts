import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Academics } from './academics';

describe('Academics', () => {
  let component: Academics;
  let fixture: ComponentFixture<Academics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Academics],
    }).compileComponents();

    fixture = TestBed.createComponent(Academics);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
