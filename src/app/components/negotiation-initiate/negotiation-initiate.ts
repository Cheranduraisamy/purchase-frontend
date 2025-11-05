// src/app/components/negotiation-initiate/negotiation-initiate.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../../services/purchase.service';
import { Request, Vendor, Event } from '../../service/request';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-negotiation-initiate',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './negotiation-initiate.html',
  styleUrls: ['./negotiation-initiate.css']
})
export class NegotiationInitiateComponent implements OnInit, OnDestroy {
  prId: number = 0;
  purchaseRequest: any = null;
  
  // Vendor and Event data
  allVendors: Vendor[] = [];
  allEvents: Event[] = [];
  vendorName: string = '';
  eventName: string = '';
  
  // Form fields
  negotiationData: any = {
    prId: 0,
    eventId: 0,
    vendorId: 0,
    initialQuoteAmount: 0,
    negotiationDate: ''
  };

  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private purchaseService: PurchaseService,
    private requestService: Request
  ) {}

  ngOnInit(): void {
    // Get PR ID from route parameter
    this.route.params.subscribe(params => {
      this.prId = +params['prId'];
      this.negotiationData.prId = this.prId;
      this.loadDataFromSession();
    });

    // Set today's date as default
    this.negotiationData.negotiationDate = this.formatDateForInput(new Date());
  }

  loadDataFromSession(): void {
    this.isLoading = true;
    
    try {
      // Get data from sessionStorage (passed from purchase request page)
      const storedPR = sessionStorage.getItem('selectedPR');
      const storedVendors = sessionStorage.getItem('allVendors');
      const storedEvents = sessionStorage.getItem('allEvents');
      
      if (storedPR && storedVendors && storedEvents) {
        // Use data from sessionStorage
        this.purchaseRequest = JSON.parse(storedPR);
        this.allVendors = JSON.parse(storedVendors);
        this.allEvents = JSON.parse(storedEvents);
        
        // Pre-fill form with PR data
        this.negotiationData.eventId = this.purchaseRequest.eventId || 0;
        this.negotiationData.vendorId = this.purchaseRequest.vendorId || 0;
        this.negotiationData.initialQuoteAmount = this.purchaseRequest.allocatedamount || 0;
        
        // Find and set vendor/event names
        this.updateVendorEventNames();
        this.isLoading = false;
        
        console.log('Loaded data from session:', {
          pr: this.purchaseRequest,
          vendors: this.allVendors,
          events: this.allEvents
        });
      } else {
        // Fallback: Load from API if sessionStorage is empty
        console.log('SessionStorage empty, loading from API...');
        this.errorMessage = 'Loading data from server...';
        this.loadDataFromAPI();
      }
    } catch (error) {
      console.error('Error loading from sessionStorage:', error);
      this.loadDataFromAPI();
    }
  }

  loadDataFromAPI(): void {
    // Fallback method to load data from API
    forkJoin({
      prDetails: this.purchaseService.getPrDetails(this.prId),
      vendors: this.requestService.getAllVendors(),
      events: this.requestService.getAllEvents()
    }).subscribe({
      next: ({ prDetails, vendors, events }) => {
        this.purchaseRequest = prDetails;
        this.allVendors = vendors;
        this.allEvents = events;
        
        // Pre-fill form with PR data
        this.negotiationData.eventId = prDetails.eventId || 0;
        this.negotiationData.vendorId = prDetails.vendorId || 0;
        this.negotiationData.initialQuoteAmount = prDetails.allocatedamount || 0;
        
        // Find and set vendor/event names
        this.updateVendorEventNames();
        this.errorMessage = ''; // Clear any error message
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading data from API:', err);
        this.errorMessage = 'Failed to load data';
        this.isLoading = false;
      }
    });
  }

  updateVendorEventNames(): void {
    // Find vendor name
    const vendor = this.allVendors.find(v => v.vendorId === this.purchaseRequest.vendorId);
    this.vendorName = vendor ? vendor.vendorname : 'Unknown Vendor';
    
    // Find event name
    const event = this.allEvents.find(e => e.eventId === this.purchaseRequest.eventId);
    this.eventName = event ? event.eventname : 'Unknown Event';
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  initiateNegotiation(): void {
    // Validate form
    if (!this.negotiationData.eventId || !this.negotiationData.vendorId || !this.negotiationData.initialQuoteAmount) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.purchaseService.initiateNegotiation(this.negotiationData).subscribe({
      next: (createdNegotiation: any) => {
        console.log('Negotiation created successfully:', createdNegotiation);
        
        // Update PR status to "IN_NEGOTIATION" after successful negotiation creation
        console.log('Attempting to update PR status for PR ID:', this.prId);
        console.log('Current PR data before update:', this.purchaseRequest);
        this.requestService.updatePurchaseStatus(this.prId, 'IN_NEGOTIATION').subscribe({
          next: (updatedPR: any) => {
            console.log('✅ PR status updated successfully. Updated PR:', updatedPR);
            console.log('New status should be:', updatedPR.prstatus || updatedPR.prStatus || 'Status field not found');
            this.successMessage = 'Negotiation initiated successfully! PR status updated to "In Negotiation".';
            this.isSaving = false;
            
            // Navigate back to dashboard - ngOnInit will refresh the data
            setTimeout(() => {
              this.router.navigate(['/dashboard']);
            }, 1500);
          },
          error: (statusErr: any) => {
            console.error('❌ Error updating PR status:', statusErr);
            console.error('Status update failed for PR ID:', this.prId);
            console.error('Error details:', statusErr.error);
            // Still show success for negotiation, but warn about status update
            this.successMessage = 'Negotiation initiated successfully, but failed to update PR status. Please manually update PR status if needed.';
            this.isSaving = false;
            
            setTimeout(() => {
              this.router.navigate(['/dashboard']);
            }, 1500);
          }
        });
      },
      error: (err: any) => {
        console.error('Error initiating negotiation:', err);
        this.errorMessage = err.error?.message || 'Failed to initiate negotiation';
        this.isSaving = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/negotiate']);
  }

  ngOnDestroy(): void {
    // Clean up sessionStorage when component is destroyed
    sessionStorage.removeItem('selectedPR');
    sessionStorage.removeItem('allVendors');
    sessionStorage.removeItem('allEvents');
  }
}