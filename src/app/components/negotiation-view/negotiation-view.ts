import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PurchaseService } from '../../services/purchase.service';
import { Request } from '../../service/request';

@Component({
  selector: 'app-negotiation-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './negotiation-view.html',
  styleUrls: ['./negotiation-view.css']
})
export class NegotiationViewComponent implements OnInit {
  negotiation: any = null;
  isLoading = false;
  errorMessage = '';
  negotiationId: number = 0;
  allEvents: any[] = [];
  allVendors: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private purchaseService: PurchaseService,
    private requestService: Request
  ) {}

  ngOnInit(): void {
    this.loadAuxiliaryData(); // Load vendors and events first
    this.route.params.subscribe(params => {
      this.negotiationId = +params['id'];
      this.loadNegotiationDetails();
    });
  }

  loadAuxiliaryData(): void {
    // Load vendors and events for display
    this.requestService.getAllVendors().subscribe({
      next: (vendors) => {
        this.allVendors = vendors;
      },
      error: (error) => console.error('Error loading vendors:', error)
    });

    this.requestService.getAllEvents().subscribe({
      next: (events) => {
        // Normalize event field names to ensure consistent structure
        this.allEvents = events.map(event => ({
          gCrossNumber: event.gcrossNumber || event.gCrossNumber || event.GCROSS_NUMBER || event.gcross_number || 0,
          eventname: event.eventname || event.EVENTNAME || '',
          GCROSS_NUMBER: event.GCROSS_NUMBER,
          gcross_number: event.gcross_number,
          gcrossNumber: event.gcrossNumber,
          EVENTNAME: event.EVENTNAME
        }));
      },
      error: (error) => console.error('Error loading events:', error)
    });
  }

  loadNegotiationDetails(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.purchaseService.getNegotiationDetails(this.negotiationId).subscribe({
      next: (data) => {
        // Normalize field names - backend sends gcrossNumber (lowercase) instead of gCrossNumber
        this.negotiation = {
          ...data,
          gCrossNumber: (data as any).gCrossNumber || (data as any).gcrossNumber || (data as any).GCROSS_NUMBER || 0
        };
        
        // Map comments field from different possible backend field names
        this.negotiation.comments = (data as any).negotiation_comments || 
                                  (data as any).negotiationComments || 
                                  (data as any).NEGOTIATION_COMMENTS ||
                                  (data as any).comments || 
                                  '';
        
        // Load approval/rejection dates from localStorage since backend doesn't support them
        this.loadApprovalDataFromLocalStorage();
        
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading negotiation:', err);
        this.errorMessage = 'Failed to load negotiation details';
        this.isLoading = false;
      }
    });
  }

  loadApprovalDataFromLocalStorage(): void {
    if (!this.negotiation) return;
    
    // Load approval/rejection dates from localStorage since backend doesn't support them
    const approvalDate = localStorage.getItem(`approval_date_${this.negotiationId}`);
    const rejectionDate = localStorage.getItem(`rejection_date_${this.negotiationId}`);
    const rejectionReason = localStorage.getItem(`rejection_reason_${this.negotiationId}`);
    
    console.log('Loading from localStorage for negotiation', this.negotiationId);
    console.log('Found approval date:', approvalDate);
    console.log('Found rejection date:', rejectionDate);
    
    if (approvalDate) {
      this.negotiation.approvalDate = approvalDate;
    }
    if (rejectionDate) {
      this.negotiation.rejectionDate = rejectionDate;
    }
    if (rejectionReason) {
      this.negotiation.rejectionReason = rejectionReason;
    }
  }

  calculateSavings(): number {
    if (!this.negotiation?.initialquoteamount || !this.negotiation?.finalquoteamount) return 0;
    return this.negotiation.initialquoteamount - this.negotiation.finalquoteamount;
  }

  calculateSavingsPercentage(): number {
    if (!this.negotiation?.initialquoteamount || !this.negotiation?.finalquoteamount) return 0;
    return (this.calculateSavings() / this.negotiation.initialquoteamount) * 100;
  }

  // New methods to handle loss scenarios
  isSavings(): boolean {
    return this.calculateSavings() > 0;
  }

  isLoss(): boolean {
    return this.calculateSavings() < 0;
  }

  isNoChange(): boolean {
    return this.calculateSavings() === 0;
  }

  getAbsoluteSavings(): number {
    return Math.abs(this.calculateSavings());
  }

  getAbsoluteSavingsPercentage(): number {
    return Math.abs(this.calculateSavingsPercentage());
  }

  backToList(): void {
    this.router.navigate(['/negotiate']);
  }

  editNegotiation(): void {
    this.router.navigate(['/negotiate/edit', this.negotiationId]);
  }

  getStatusClass(status: string): string {
    const lower = status?.toLowerCase() || '';
    if (lower === 'approved') return 'status-approved';
    if (lower === 'pending') return 'status-pending';
    if (lower === 'rejected') return 'status-rejected';
    return 'status-default';
  }

  // Helper methods for display
  getEventName(gCrossNumber: number | undefined): string {
    if (gCrossNumber === undefined || gCrossNumber === 0) return 'N/A';
    
    const event = this.allEvents.find(e => {
      const eventGCrossNumber = e.gcrossNumber || e.gCrossNumber || e.GCROSS_NUMBER || e.gcross_number;
      return eventGCrossNumber === gCrossNumber;
    });
    
    if (event) {
      const eventName = event.eventname || event.EVENTNAME;
      return eventName ? `${gCrossNumber} - ${eventName}` : `${gCrossNumber}`;
    }
    
    return `${gCrossNumber}`;
  }

  getVendorName(vendorId: number | undefined): string {
    if (vendorId === undefined) return 'N/A';
    const vendor = this.allVendors.find(v => v.vendorId === vendorId);
    return vendor ? vendor.vendorname : `Vendor ${vendorId}`;
  }

  getVendorEmail(vendorId: number | undefined): string {
    if (vendorId === undefined) return 'N/A';
    const vendor = this.allVendors.find(v => v.vendorId === vendorId);
    // TODO: When backend is updated with vendor email fields, this will return actual email
    // Currently returns 'N/A' as placeholder
    return vendor?.email || vendor?.vendoremail || 'N/A';
  }

  getPRStatus(): string {
    if (!this.negotiation?.purchaseRequest) return 'N/A';
    
    // If negotiation is approved, PR status should be approved regardless of backend status
    if (this.negotiation.negotiationstatus?.toLowerCase() === 'approved') {
      return 'APPROVED';
    }
    
    // If negotiation is rejected, PR status should be rejected
    if (this.negotiation.negotiationstatus?.toLowerCase() === 'rejected') {
      return 'REJECTED';
    }
    
    // For other statuses (PENDING, etc.), return the original PR status from backend
    return this.negotiation.purchaseRequest.prstatus || this.negotiation.purchaseRequest.prStatus || 'PENDING';
  }

  getPRStatusClass(): string {
    const status = this.getPRStatus().toLowerCase();
    if (status === 'approved') return 'status-approved';
    if (status === 'rejected') return 'status-rejected';
    if (status === 'pending') return 'status-pending';
    return 'status-default';
  }

  getApprovalDate(): string {
    if (!this.negotiation) return 'Not specified';
    
    // Check multiple possible field names for approval date
    const approvalDate = this.negotiation.approvalDate || 
                        this.negotiation.approvaldate || 
                        (this.negotiation as any).approval_date ||
                        (this.negotiation as any).dateOfApproval;
    
    console.log('Getting approval date:', {
      approvalDate: this.negotiation.approvalDate,
      approvaldate: this.negotiation.approvaldate,
      approval_date: (this.negotiation as any).approval_date,
      dateOfApproval: (this.negotiation as any).dateOfApproval,
      selected: approvalDate
    });
    
    return approvalDate || 'Not specified';
  }

  getRejectionDate(): string {
    if (!this.negotiation) return 'Not specified';
    
    // Check multiple possible field names for rejection date
    const rejectionDate = this.negotiation.rejectionDate || 
                         this.negotiation.rejectiondate || 
                         (this.negotiation as any).rejection_date ||
                         (this.negotiation as any).dateOfRejection;
    
    return rejectionDate || 'Not specified';
  }

  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  getCommentsText(): string {
    if (!this.negotiation) return '';
    
    // Check multiple possible field names for comments
    return this.negotiation.comments || 
           (this.negotiation as any).negotiation_comments ||
           (this.negotiation as any).negotiationComments ||
           (this.negotiation as any).NEGOTIATION_COMMENTS ||
           (this.negotiation as any).description ||
           (this.negotiation as any).negotiationDescription ||
           (this.negotiation as any).negotiation_description ||
           '';
  }
}