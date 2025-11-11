import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../../services/purchase.service';
import { Request } from '../../service/request';
import { Event } from '../../service/request';

@Component({
  selector: 'app-negotiation-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './negotiation-edit.html',
  styleUrls: ['./negotiation-edit.css']
})
export class NegotiationEditComponent implements OnInit {
  negotiation: any = {
    negotiationid: 0,
    negotiationstatus: '',
    finalquoteamount: null,
    negotiationDate: '',
    comments: '',
    initialquoteamount: 0,
    approvalDate: '',
    rejectionDate: '',
    rejectionReason: '',
    status_updation_date: '' // New backend field for status update date
  };
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';
  negotiationId: number = 0;
  statusOptions = ['PENDING', 'APPROVED', 'REJECTED'];
  allEvents: Event[] = [];
  eventName = '';
  vendorName = '';
  showConfirmDialog = false;
  confirmationStatus = ''; // Store the status that needs confirmation
  pendingSaveData: any = null;
  previousStatus = ''; // Track previous status to detect changes
  isFormFrozen = false; // Track if form is frozen after save
  saveAttempted = false; // Track if user has attempted to save

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private purchaseService: PurchaseService,
    private requestService: Request
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.negotiationId = +params['id'];
      this.loadNegotiationDetails();
      
      // Check if this negotiation was previously saved and should remain frozen
      this.checkIfNegotiationShouldBeFrozen();
    });
    
    // Load all events for G Cross Number display
    this.requestService.getAllEvents().subscribe({
      next: (events: Event[]) => {
        // Normalize event field names to ensure consistent structure
        this.allEvents = events.map(event => ({
          gCrossNumber: event.gcrossNumber || event.gCrossNumber || event.GCROSS_NUMBER || event.gcross_number || 0,
          eventname: event.eventname || event.EVENTNAME || '',
          GCROSS_NUMBER: event.GCROSS_NUMBER,
          gcross_number: event.gcross_number,
          gcrossNumber: event.gcrossNumber,
          EVENTNAME: event.EVENTNAME
        }));
        
        // Update event name after events are loaded
        this.updateEventName();
      },
      error: (error: any) => console.error('Error loading events in negotiation-edit:', error)
    });
    
    // Ensure comments field is always initialized
    if (!this.negotiation.comments) {
      this.negotiation.comments = '';
    }
  }

  loadNegotiationDetails(): void {
    this.isLoading = true;
    this.errorMessage = '';
    console.log('Loading negotiation details for ID:', this.negotiationId);
    
    this.purchaseService.getNegotiationDetails(this.negotiationId).subscribe({
      next: (data: any) => {
        this.negotiation = data;
        
        // Always ensure comments field is properly initialized
        this.negotiation.comments = data.negotiation_comments || 
                                  data.negotiationComments || 
                                  data.NEGOTIATION_COMMENTS ||
                                  data.comments || 
                                  '';

        // Handle status_updation_date from backend (try different field names)
        this.negotiation.status_updation_date = data.status_updation_date || 
                                              data.status_update_date ||
                                              data.statusUpdationDate ||
                                              data.statusUpdateDate ||
                                              '';
        
        if (this.negotiation.status_updation_date) {
          // Sync with frontend date fields for display
          const status = this.negotiation.negotiationstatus?.toLowerCase();
          if (status === 'approved' && !this.negotiation.approvalDate) {
            this.negotiation.approvalDate = this.negotiation.status_updation_date;
          } else if (status === 'rejected' && !this.negotiation.rejectionDate) {
            this.negotiation.rejectionDate = this.negotiation.status_updation_date;
          }
        }
        
        this.isLoading = false;
        
        // Store initial status to track changes
        this.previousStatus = this.negotiation.negotiationstatus || '';
        
        console.log('Loaded negotiation:', data);
        console.log('Final quote amount:', data.finalquoteamount);
        console.log('Negotiation status:', data.negotiationstatus);
        console.log('PR ID from negotiation:', data.prId || data.purchaseRequest?.prId || 'Not found');
        console.log('Status updation date from backend:', {
          status_updation_date: data.status_updation_date,
          status_update_date: data.status_update_date,
          statusUpdationDate: data.statusUpdationDate,
          statusUpdateDate: data.statusUpdateDate,
          final_value: this.negotiation.status_updation_date
        });
        console.log('Comments field after initialization:', this.negotiation.comments);
        console.log('Raw comments from backend:', {
          comments: data.comments,
          negotiation_comments: data.negotiation_comments,
          negotiationComments: data.negotiationComments,
          NEGOTIATION_COMMENTS: data.NEGOTIATION_COMMENTS
        });
        console.log('All negotiation properties:', Object.keys(data));
        
        // Load additional details
        this.loadEventAndVendorNames();
        
        // Check if this negotiation should be frozen based on its status
        this.checkNegotiationStatusForFreezing();
      },
      error: (err) => {
        console.error('Error loading negotiation:', err);
        this.errorMessage = 'Failed to load negotiation details';
        this.isLoading = false;
      }
    });
  }

  loadEventAndVendorNames(): void {
    // Check if vendor name is already available in the response
    if (this.negotiation.vendorName) {
      this.vendorName = this.negotiation.vendorName;
    } else {
      // Fallback to a formatted vendor name
      this.vendorName = `Vendor ${this.negotiation.vendorid || this.negotiation.vendorId}`;
    }

    // For event name, it will be set by updateEventName() after events are loaded
    // This ensures events are available when getEventName() is called
    // If events are already loaded, update the event name now
    if (this.allEvents.length > 0) {
      this.updateEventName();
    }
    
    // TODO: Replace with actual API calls when available
    // this.loadEventDetails(gCrossNumber);
    // this.loadVendorDetails(vendorId);
  }

  showConfirmationIfNeeded(): boolean {
    const status = this.negotiation?.negotiationstatus?.toUpperCase();
    
    // Check if status is APPROVED or REJECTED - both need confirmation
    if (status === 'APPROVED' || status === 'REJECTED') {
      // Store the status for the confirmation dialog
      this.confirmationStatus = status;
      // Show custom confirmation dialog
      this.showConfirmDialog = true;
      return false; // Don't proceed yet, wait for user confirmation
    }
    // If not approved or rejected status, no confirmation needed
    return true;
  }

  confirmApproval(): void {
    this.showConfirmDialog = false;
    // Proceed with the actual save
    this.proceedWithSave();
  }

  cancelApproval(): void {
    this.showConfirmDialog = false;
    this.pendingSaveData = null;
  }

  updateNegotiation(): void {
    if (!this.negotiation) return;
    
    // Set flag to indicate save was attempted
    this.saveAttempted = true;
    
    // Show confirmation dialog if status is APPROVED or REJECTED
    if (!this.showConfirmationIfNeeded()) {
      return; // User cancelled or dialog shown, don't proceed yet
    }
    
    // If no confirmation needed, proceed directly
    this.proceedWithSave();
  }

  proceedWithSave(): void {
    if (!this.negotiation) return;
    
    // Don't automatically set dates - preserve user's manual input
    // Only ensure status_updation_date is set if it's completely empty
    if (!this.negotiation.status_updation_date && this.negotiation.negotiationstatus) {
      const currentDate = new Date().toISOString().split('T')[0];
      this.negotiation.status_updation_date = currentDate;
      console.log('Set initial status_updation_date:', currentDate);
    }
    
    console.log('Saving with preserved dates - no automatic refresh');
    
    // Store approval/rejection dates in localStorage since backend doesn't support them yet
    if (this.negotiation.approvalDate) {
      localStorage.setItem(`approval_date_${this.negotiationId}`, this.negotiation.approvalDate);
      console.log('Stored approval date in localStorage:', this.negotiation.approvalDate, 'for negotiation', this.negotiationId);
    }
    if (this.negotiation.rejectionDate) {
      localStorage.setItem(`rejection_date_${this.negotiationId}`, this.negotiation.rejectionDate);
      localStorage.setItem(`rejection_reason_${this.negotiationId}`, this.negotiation.rejectionReason || '');
      console.log('Stored rejection date in localStorage:', this.negotiation.rejectionDate, 'for negotiation', this.negotiationId);
    }
    
    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    const updateData: any = {
      negotiationstatus: this.negotiation.negotiationstatus,
      finalquoteamount: this.negotiation.finalquoteamount,
      negotiationDate: this.negotiation.negotiationDate,
      comments: this.negotiation.comments,
      negotiation_comments: this.negotiation.comments, // Alternative field name
      negotiationComments: this.negotiation.comments, // Alternative field name
      NEGOTIATION_COMMENTS: this.negotiation.comments, // Alternative field name
      status_updation_date: this.negotiation.status_updation_date, // Backend field
      status_update_date: this.negotiation.status_updation_date, // Alternative backend field name
      statusUpdationDate: this.negotiation.status_updation_date, // CamelCase version
      statusUpdateDate: this.negotiation.status_updation_date, // Alternative CamelCase
      approvalDate: this.negotiation.approvalDate,
      rejectionDate: this.negotiation.rejectionDate,
      rejectionReason: this.negotiation.rejectionReason
    };
    
    console.log('Sending comments to backend:', {
      comments: this.negotiation.comments,
      length: this.negotiation.comments?.length || 0
    });
    console.log('Sending status dates to backend:', {
      status_updation_date: this.negotiation.status_updation_date,
      status_update_date: this.negotiation.status_updation_date,
      negotiationstatus: this.negotiation.negotiationstatus
    });
    
    this.purchaseService.updateNegotiation(this.negotiationId, updateData).subscribe({
      next: (updated) => {
        // Don't overwrite the entire negotiation object - preserve user's inputs
        // Only update specific fields that might have changed from backend
        const preservedApprovalDate = this.negotiation.approvalDate;
        const preservedRejectionDate = this.negotiation.rejectionDate;
        const preservedRejectionReason = this.negotiation.rejectionReason;
        const preservedComments = this.negotiation.comments; // Preserve comments
        
        // Update with backend response
        this.negotiation = updated;
        
        // Restore preserved fields if they exist
        if (preservedApprovalDate) {
          this.negotiation.approvalDate = preservedApprovalDate;
        }
        if (preservedRejectionDate) {
          this.negotiation.rejectionDate = preservedRejectionDate;
        }
        if (preservedRejectionReason) {
          this.negotiation.rejectionReason = preservedRejectionReason;
        }
        
        // Preserve comments - check if backend returned comments, otherwise use preserved value
        const updatedAny = updated as any;
        this.negotiation.comments = updatedAny.comments || 
                                   updatedAny.negotiation_comments || 
                                   updatedAny.negotiationComments || 
                                   updatedAny.NEGOTIATION_COMMENTS || 
                                   preservedComments || 
                                   this.negotiation.comments || 
                                   '';
        
        // Handle status_updation_date from backend response
        this.negotiation.status_updation_date = updatedAny.status_updation_date || 
                                              updatedAny.status_update_date ||
                                              updatedAny.statusUpdationDate ||
                                              updatedAny.statusUpdateDate ||
                                              this.negotiation.status_updation_date;
        
        console.log('Preserved dates after save:', {
          approvalDate: this.negotiation.approvalDate,
          rejectionDate: this.negotiation.rejectionDate,
          status_updation_date: this.negotiation.status_updation_date,
          comments: this.negotiation.comments,
          commentsLength: this.negotiation.comments?.length || 0
        });
        
        // Create success message based on negotiation status
        let statusMessage = 'Negotiation updated successfully!';
        const status = this.negotiation.negotiationstatus?.toLowerCase();
        
        if (this.negotiation.negotiationstatus === 'APPROVED') {
          statusMessage += ' Purchase Request status updated to APPROVED and Purchase Order created.';
        } else if (this.negotiation.negotiationstatus === 'REJECTED') {
          statusMessage += ' Purchase Request status updated to REJECTED.';
        } else if (this.negotiation.negotiationstatus === 'PENDING') {
          statusMessage += ' You can continue editing this negotiation.';
        }
        this.successMessage = statusMessage;
        
        this.isSaving = false;
        this.saveAttempted = false; // Reset save attempt flag after successful save
        
        // Only freeze the form for final statuses (APPROVED or REJECTED)
        if (status === 'approved' || status === 'rejected') {
          this.isFormFrozen = true; // Freeze the form for final statuses
          // Mark this negotiation as saved in localStorage for persistent freezing
          this.markNegotiationAsSaved();
          console.log('Form frozen - negotiation has final status:', this.negotiation.negotiationstatus);
        } else {
          this.isFormFrozen = false; // Keep form editable for PENDING status
          console.log('Form remains editable - negotiation status is:', this.negotiation.negotiationstatus);
        }
        
        // ✅ Backend now automatically updates PR status when negotiation status changes
        // No need for separate PR status update calls - the backend handles it automatically
        console.log('✅ PR status automatically updated by backend during negotiation save');
        
        console.log('Form is now frozen - all fields disabled and marked as permanently saved');
        // Stay on the edit page after successful save
      },
      error: (err) => {
        console.error('Error updating negotiation:', err);
        this.errorMessage = err.error?.message || 'Failed to update negotiation';
        this.isSaving = false;
      }
    });
  }

  calculateSavings(): number {
    if (!this.negotiation?.initialquoteamount || !this.negotiation?.finalquoteamount) return 0;
    return this.negotiation.initialquoteamount - this.negotiation.finalquoteamount;
  }

  calculateSavingsPercentage(): number {
    if (!this.negotiation?.initialquoteamount || !this.negotiation?.finalquoteamount) return 0;
    return (this.calculateSavings() / this.negotiation.initialquoteamount) * 100;
  }

  setStatusDates(): void {
    const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const status = this.negotiation.negotiationstatus?.toLowerCase();
    
    // Only set dates if they are completely empty - preserve existing dates
    if (status === 'approved') {
      if (!this.negotiation.approvalDate) {
        this.negotiation.approvalDate = currentDate;
      }
      if (!this.negotiation.status_updation_date) {
        this.negotiation.status_updation_date = currentDate;
      }
      // Clear rejection fields when approved
      this.negotiation.rejectionDate = '';
      this.negotiation.rejectionReason = '';
    } else if (status === 'rejected') {
      if (!this.negotiation.rejectionDate) {
        this.negotiation.rejectionDate = currentDate;
      }
      if (!this.negotiation.status_updation_date) {
        this.negotiation.status_updation_date = currentDate;
      }
      // Clear approval field when rejected
      this.negotiation.approvalDate = '';
    } else if (status === 'pending') {
      if (!this.negotiation.status_updation_date) {
        this.negotiation.status_updation_date = currentDate;
      }
    }
  }

  onStatusChange(): void {
    // Don't automatically set dates here - this gets called during form initialization
    // Only log the change for debugging
    console.log('Status change detected:', this.negotiation.negotiationstatus);
  }

  isFormValid(): boolean {
    if (!this.negotiation) return false;
    
    // Check required fields
    if (!this.negotiation.negotiationstatus || !this.negotiation.finalquoteamount) {
      return false;
    }
    
    // Check comments validation (use internal method for actual validation)
    if (this.isCommentsActuallyInvalid()) {
      return false;
    }
    
    // Check status-specific required fields
    const status = this.negotiation.negotiationstatus?.toLowerCase();
    
    if (status === 'approved') {
      return !!this.negotiation.approvalDate;
    } else if (status === 'rejected') {
      return !!(this.negotiation.rejectionDate && this.negotiation.rejectionReason?.trim());
    }
    
    return true;
  }

  // Comments handling methods
  getCommentsLength(): number {
    // Ensure comments is always a string
    if (!this.negotiation?.comments) {
      this.negotiation = this.negotiation || {};
      this.negotiation.comments = '';
    }
    return this.negotiation.comments.length || 0;
  }

  isCommentsInvalid(): boolean {
    // Only show validation errors after user has attempted to save
    if (!this.saveAttempted) return false;
    return this.isCommentsEmpty() || this.isCommentsMaxLength();
  }

  // Internal validation method for form validation (always checks)
  isCommentsActuallyInvalid(): boolean {
    return this.isCommentsEmpty() || this.isCommentsMaxLength();
  }

  isCommentsEmpty(): boolean {
    return !this.negotiation?.comments || this.negotiation.comments.trim().length === 0;
  }

  isCommentsMaxLength(): boolean {
    const commentsLength = this.getCommentsLength();
    return commentsLength > 1000;
  }

  onCommentsChange(): void {
    // Clear the save attempted flag when user starts typing
    if (this.saveAttempted && this.negotiation?.comments?.trim()) {
      this.saveAttempted = false;
    }
    
    // Ensure comments field is initialized
    if (!this.negotiation) {
      this.negotiation = {};
    }
    if (this.negotiation.comments === undefined || this.negotiation.comments === null) {
      this.negotiation.comments = '';
    }
    
    // Trim whitespace and validate comments
    if (this.negotiation.comments) {
      // Remove any potential script tags or dangerous content for security
      this.negotiation.comments = this.negotiation.comments.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    
    // Log comments change for debugging
    console.log('Comments updated:', this.negotiation?.comments?.length || 0, 'characters');
    console.log('Current comments value:', this.negotiation?.comments);
  }

  updatePrStatusBasedOnNegotiation(): void {
    console.log('=== PR STATUS UPDATE INFO ===');
    console.log('✅ Backend now handles PR status updates automatically');
    console.log('✅ When negotiation status = APPROVED -> PR status = APPROVED + Purchase Order created');
    console.log('✅ When negotiation status = REJECTED -> PR status = REJECTED');
    console.log('✅ No frontend API calls needed - backend does it during negotiation save');
    console.log('=== END PR STATUS UPDATE INFO ===');
    
    // This method is kept for reference but no longer performs API calls
    // The backend automatically updates PR status in the updateNegotiation method
  }

  /**
   * Check if this negotiation should be permanently frozen
   * A negotiation should be frozen only if:
   * 1. It has been saved before AND
   * 2. It has a final status (APPROVED or REJECTED)
   */
  checkIfNegotiationShouldBeFrozen(): void {
    // This initial check will be updated after loading negotiation details
    // The actual freezing decision will be made in checkNegotiationStatusForFreezing()
    console.log('Initial form state check - will be updated after loading negotiation details');
  }

  /**
   * Mark a negotiation as permanently saved/frozen
   */
  markNegotiationAsSaved(): void {
    const savedNegotiationsKey = 'savedNegotiations';
    let savedNegotiations: number[] = [];
    
    try {
      const existing = localStorage.getItem(savedNegotiationsKey);
      if (existing) {
        savedNegotiations = JSON.parse(existing);
      }
    } catch (e) {
      console.warn('Error parsing existing saved negotiations:', e);
    }
    
    // Add this negotiation to the saved list if not already present
    if (!savedNegotiations.includes(this.negotiationId)) {
      savedNegotiations.push(this.negotiationId);
      localStorage.setItem(savedNegotiationsKey, JSON.stringify(savedNegotiations));
      console.log('🔒 Marked negotiation', this.negotiationId, 'as permanently saved');
    }
  }

  /**
   * Check if the loaded negotiation should be frozen based on its status
   */
  checkNegotiationStatusForFreezing(): void {
    // If negotiation has APPROVED or REJECTED status, it should be frozen
    const finalStatuses = ['APPROVED', 'REJECTED'];
    const currentStatus = this.negotiation?.negotiationstatus?.toUpperCase();
    
    if (this.negotiation?.negotiationstatus && finalStatuses.includes(currentStatus)) {
      console.log('🔒 Negotiation has final status:', this.negotiation.negotiationstatus, '- freezing form');
      this.isFormFrozen = true;
      this.markNegotiationAsSaved();
    } else {
      console.log('� Negotiation status is:', this.negotiation.negotiationstatus, '- keeping form editable');
      this.isFormFrozen = false;
      // If status is not final but was previously saved, remove it from localStorage
      this.removeNegotiationFromSaved();
    }
  }

  /**
   * Remove a negotiation from the saved list in localStorage
   */
  removeNegotiationFromSaved(): void {
    const savedNegotiationsKey = 'savedNegotiations';
    try {
      const existing = localStorage.getItem(savedNegotiationsKey);
      if (existing) {
        let savedNegotiations: number[] = JSON.parse(existing);
        const index = savedNegotiations.indexOf(this.negotiationId);
        if (index > -1) {
          savedNegotiations.splice(index, 1);
          localStorage.setItem(savedNegotiationsKey, JSON.stringify(savedNegotiations));
          console.log('📝 Removed negotiation', this.negotiationId, 'from saved list - status no longer final');
        }
      }
    } catch (e) {
      console.warn('Error removing negotiation from saved list:', e);
    }
  }

  updateEventName(): void {
    if (this.negotiation && this.allEvents.length > 0) {
      // Normalize the gCrossNumber field from backend data
      const normalizedNego = {
        ...this.negotiation,
        gCrossNumber: this.negotiation.gCrossNumber || this.negotiation.gcrossNumber || this.negotiation.GCROSS_NUMBER || 0
      };
      this.negotiation = normalizedNego;
      
      const gCrossNumber = this.negotiation.gCrossNumber;
      this.eventName = this.getEventName(gCrossNumber);
    }
  }

  getEventName(gCrossNumber: number | undefined): string {
    if (!gCrossNumber || gCrossNumber === 0) return 'N/A';
    
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

  cancel(): void {
    this.router.navigate(['/negotiate']);
  }
}