import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ParentMessages } from './parent-messages';

describe('ParentMessages', () => {
  let component: ParentMessages;
  let fixture: ComponentFixture<ParentMessages>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentMessages],
    }).compileComponents();

    fixture = TestBed.createComponent(ParentMessages);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
