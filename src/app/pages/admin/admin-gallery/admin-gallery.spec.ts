import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminGallery } from './admin-gallery';

describe('AdminGallery', () => {
  let component: AdminGallery;
  let fixture: ComponentFixture<AdminGallery>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminGallery],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminGallery);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
