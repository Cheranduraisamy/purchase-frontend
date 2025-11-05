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
        this.allEvents = events;
      },
      error: (error) => console.error('Error loading events:', error)
    });
  }

  loadNegotiationDetails(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.purchaseService.getNegotiationDetails(this.negotiationId).subscribe({
      next: (data) => {
        this.negotiation = data;
        
        // Debug: Log all available fields to help identify the correct comments field
        console.log('Negotiation data received:', data);
        console.log('Available fields:', Object.keys(data));
        
        // Map comments field from different possible backend field names
        this.negotiation.comments = (data as any).negotiation_comments || 
                                  (data as any).negotiationComments || 
                                  (data as any).NEGOTIATION_COMMENTS ||
                                  (data as any).comments || 
                                  '';
        
        console.log('Mapped comments:', this.negotiation.comments);
        
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
  getEventName(eventId: number | undefined): string {
    if (eventId === undefined) return 'N/A';
    const event = this.allEvents.find(e => e.eventId === eventId);
    return event ? event.eventname : `Event ${eventId}`;
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

  getVendorPhone(vendorId: number | undefined): string {
    if (vendorId === undefined) return 'N/A';
    const vendor = this.allVendors.find(v => v.vendorId === vendorId);
    // TODO: When backend is updated with vendor phone fields, this will return actual phone
    // Currently returns 'N/A' as placeholder
    return vendor?.phone || vendor?.vendorphone || 'N/A';
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