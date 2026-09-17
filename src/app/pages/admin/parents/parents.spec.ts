import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Parents } from './parents';

describe('Parents', () => {
  let component: Parents;
  let fixture: ComponentFixture<Parents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Parents],
    }).compileComponents();

    fixture = TestBed.createComponent(Parents);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
