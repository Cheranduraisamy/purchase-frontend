import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Purchaserequest } from './purchaserequest';

describe('Purchaserequest', () => {
  let component: Purchaserequest;
  let fixture: ComponentFixture<Purchaserequest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Purchaserequest]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Purchaserequest);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
