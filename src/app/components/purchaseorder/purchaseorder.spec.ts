import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Purchaseorder } from './purchaseorder';

describe('Purchaseorder', () => {
  let component: Purchaseorder;
  let fixture: ComponentFixture<Purchaseorder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Purchaseorder]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Purchaseorder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
