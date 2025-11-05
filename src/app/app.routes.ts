import { Routes } from '@angular/router';
import { Purchaserequest } from './components/purchaserequest/purchaserequest';
import { NegotiationComponent } from './components/negotiation/negotiation';
import { NegotiationInitiateComponent } from './components/negotiation-initiate/negotiation-initiate';
import { NegotiationEditComponent } from './components/negotiation-edit/negotiation-edit';
import { NegotiationViewComponent } from './components/negotiation-view/negotiation-view';
import { Purchaseorder } from './components/purchaseorder/purchaseorder';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Purchaserequest },
  { path: 'negotiate', component: NegotiationComponent },
  { path: 'negotiate/edit/:id', component: NegotiationEditComponent },
  { path: 'negotiate/view/:id', component: NegotiationViewComponent },
  { path: 'negotiate/:id', component: NegotiationComponent },
  { path: 'initiate-negotiation/:prId', component: NegotiationInitiateComponent },
  { path: 'purchase-orders', component: Purchaseorder },
  { path: '**', redirectTo: '/dashboard' } // Wildcard route for debugging
];
