import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Request, purchaserequests, Vendor, Event } from '../../service/request';
import { PurchaseService } from '../../services/purchase.service';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { Negotiation, NegotiationResponse } from '../../models/negotiation.model';
import { PurchaseRequest } from '../../models/pr.model';
import { catchError, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { of, Subject } from 'rxjs';

interface NegotiationItem {
  negotiationId: number;  // Updated to match API response
  purchaseRequest?: PurchaseRequest;
  gCrossNumber: number;        // Updated to match API response
  vendorId: number;       // Updated to match API response
  initialquoteamount: number;
  finalquoteamount?: number;
  negotiationDate: string;
  negotiationstatus: string;
}

@Component({
  selector: 'app-negotiation',
  imports: [CommonModule, FormsModule],
  templateUrl: './negotiation.html',
  styleUrl: './negotiation.css'
})
export class NegotiationComponent implements OnInit {
  // Make Math available in template
  Math = Math;
  
  // View mode: 'list', 'view', 'edit', or 'review' (original functionality)
  currentView: string = 'list';
  
  // Original functionality
  selectedPR: purchaserequests | null = null;
  activeTab: string = 'review';
  
  // For displaying enriched data
  eventName: string = '';
  vendorName: string = '';
  
  // For negotiation functionality
  proposedAmount: number = 0;
  negotiationNotes: string = '';
  isNegotiating: boolean = false;
  
  allVendors: Vendor[] = [];
  allEvents: Event[] = [];

  // List view properties
  negotiations: any[] = [];
  filteredNegotiations: any[] = [];
  displayedNegotiations: any[] = [];
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';
  searchTerm: string = '';
  selectedYear: number | null = null;
  selectedStatus: string | null = null;
  private searchTermChanged: Subject<string> = new Subject<string>();
  availableYears: number[] = [];

  // Pagination properties
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  totalPages: number = 0;

  // Sorting properties
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // View/Edit properties
  currentNegotiation: any = null;
  negotiationId: number = 0;
  editMode: boolean = false;
  statusOptions = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELED'];

  constructor(
    private router: Router, 
    private route: ActivatedRoute,
    private requestService: Request,
    private purchaseService: PurchaseService,
    private purchaseOrderService: PurchaseOrderService
  ) { 
    // Initialize available years for filtering
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
      this.availableYears.push(currentYear - i);
    }
    this.availableYears.sort((a, b) => b - a);
  }

  ngOnInit(): void {
    // Check route parameters to determine view
    this.route.params.subscribe(params => {
      if (params['id']) {
        const idParam = params['id'];
        const numericId = +idParam;
        
        // Validate that the ID is a valid number
        if (!isNaN(numericId) && numericId > 0) {
          this.negotiationId = numericId;
          this.currentView = this.route.snapshot.url.some(segment => segment.path === 'edit') ? 'edit' : 'view';
          this.loadNegotiationDetails();
        } else {
          // Invalid ID parameter, redirect to list view
          console.warn(`Invalid negotiation ID parameter: ${idParam}`);
          this.currentView = 'list';
          this.initializeListView();
        }
      } else {
        // Check if coming from PR selection (original functionality)
        const sessionPR = sessionStorage.getItem('selectedPR');
        if (sessionPR) {
          this.currentView = 'review';
          this.loadAuxiliaryData();
          this.loadSelectedPR();
        } else {
          this.currentView = 'list';
          this.initializeListView();
        }
      }
    });
  }

  loadAuxiliaryData(): void {
    // Load vendors and events for enriched display
    this.requestService.getAllVendors().subscribe({
      next: (vendors) => {
        this.allVendors = vendors;
        this.updateVendorName();
      },
      error: (error) => console.error('Error loading vendors:', error)
    });

    this.requestService.getAllEvents().subscribe({
      next: (events) => {
        console.log('Raw events from backend:', events);
        console.log('First event object keys:', Object.keys(events[0] || {}));
        console.log('First event raw object:', events[0]);
        
        // Normalize event field names to match backend - prioritize gcrossNumber (lowercase 'c')
        this.allEvents = events.map(event => ({
          gCrossNumber: event.gcrossNumber || event.gCrossNumber || event.GCROSS_NUMBER || event.gcross_number || 0,
          eventname: event.eventname || event.eventName || event.EVENTNAME || event.event_name || 'Unknown'
        }));
        console.log('Loaded Events:', this.allEvents);
        console.log('Events structure:', this.allEvents.map(e => ({ gCrossNumber: e.gCrossNumber, eventname: e.eventname })));
        this.updateEventName();
      },
      error: (error) => console.error('Error loading events:', error)
    });
  }

  loadSelectedPR(): void {
    // Get PR data from session storage
    const prData = sessionStorage.getItem('selectedPR');
    if (prData) {
      this.selectedPR = JSON.parse(prData);
      this.proposedAmount = this.selectedPR?.allocatedamount || 0;
      this.updateEventName();
      this.updateVendorName();
    }

    // Alternatively, get PR ID from route params
    const prId = this.route.snapshot.paramMap.get('id');
    if (prId && !this.selectedPR) {
      console.log('PR ID from route:', prId);
      // You could load PR data by ID from service here if needed
    }
  }

  updateEventName(): void {
    if (this.selectedPR && this.allEvents.length > 0) {
      const event = this.allEvents.find(e => {
        const eventGCrossNumber = e.gCrossNumber || e.GCROSS_NUMBER || e.gcross_number;
        return eventGCrossNumber === this.selectedPR!.gCrossNumber;
      });
      this.eventName = event ? (event.eventname || event.EVENTNAME || 'Unknown Event') : 'Unknown Event';
    }
  }

  updateVendorName(): void {
    if (this.selectedPR && this.allVendors.length > 0) {
      const vendor = this.allVendors.find(v => v.vendorId === this.selectedPR!.vendorId);
      this.vendorName = vendor ? vendor.vendorname : 'Unknown Vendor';
    }
  }

  startNegotiation(): void {
    this.isNegotiating = true;
    this.activeTab = 'negotiate';
  }

  cancelNegotiation(): void {
    this.isNegotiating = false;
    this.proposedAmount = this.selectedPR?.allocatedamount || 0;
    this.negotiationNotes = '';
    this.activeTab = 'review';
  }

  submitNegotiation(): void {
    if (!this.selectedPR) {
      alert('No purchase request selected');
      return;
    }

    if (this.proposedAmount <= 0) {
      alert('Please enter a valid proposed amount');
      return;
    }

    // Here you would typically call a negotiation service
    // For now, we'll update the PR status to IN_NEGOTIATION
    this.requestService.updatePurchaseStatus(this.selectedPR.prId!, 'IN_NEGOTIATION').subscribe({
      next: (updatedPR) => {
        console.log('PR updated to negotiation status:', updatedPR);
        alert(`Negotiation submitted successfully!\nProposed Amount: ₹${this.proposedAmount}\nNotes: ${this.negotiationNotes}`);
        this.isNegotiating = false;
        this.activeTab = 'review';
        // Update the selected PR status
        if (this.selectedPR) {
          this.selectedPR.prstatus = 'IN_NEGOTIATION';
        }
      },
      error: (error) => {
        console.error('Error updating PR status:', error);
        alert('Error submitting negotiation. Please try again.');
      }
    });
  }

  approvePR(): void {
    if (!this.selectedPR) {
      alert('No purchase request selected');
      return;
    }

    this.requestService.updatePurchaseStatus(this.selectedPR.prId!, 'APPROVED').subscribe({
      next: (updatedPR) => {
        console.log('PR approved:', updatedPR);
        alert('Purchase Request approved successfully!');
        if (this.selectedPR) {
          this.selectedPR.prstatus = 'APPROVED';
        }
      },
      error: (error) => {
        console.error('Error approving PR:', error);
        alert('Error approving Purchase Request. Please try again.');
      }
    });
  }

  rejectPR(): void {
    if (!this.selectedPR) {
      alert('No purchase request selected');
      return;
    }

    const reason = prompt('Please enter rejection reason:');
    if (reason === null) return; // User cancelled

    this.requestService.updatePurchaseStatus(this.selectedPR.prId!, 'REJECTED').subscribe({
      next: (updatedPR) => {
        console.log('PR rejected:', updatedPR);
        alert(`Purchase Request rejected successfully!\nReason: ${reason}`);
        if (this.selectedPR) {
          this.selectedPR.prstatus = 'REJECTED';
        }
      },
      error: (error) => {
        console.error('Error rejecting PR:', error);
        alert('Error rejecting Purchase Request. Please try again.');
      }
    });
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  getStatusClass(): string {
    if (!this.selectedPR) return '';
    
    switch (this.selectedPR.prstatus) {
      case 'PENDING': return 'status-pending';
      case 'IN_NEGOTIATION': return 'status-negotiation';
      case 'APPROVED': return 'status-approved';
      case 'REJECTED': return 'status-rejected';
      default: return '';
    }
  }

  // ===== LIST VIEW METHODS =====
  initializeListView(): void {
    this.setDefaultDateRange();
    this.loadAuxiliaryData(); // Load vendors and events for display
    
    // Initialize pagination state
    this.currentPage = 1;
    this.filteredNegotiations = [];
    this.displayedNegotiations = [];
    this.totalItems = 0;
    this.totalPages = 0;
    
    this.loadNegotiations();

    this.searchTermChanged.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.loadNegotiations();
    });
  }

  setDefaultDateRange(): void {
    // No date range needed - show all negotiations by default
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadNegotiations(): void {
    this.isLoading = true;
    this.errorMessage = '';

    console.log('Loading negotiations from API...');

    this.purchaseService.getNegotiationDashboardList(
      this.searchTerm || undefined,
      this.selectedYear ?? undefined,
      undefined,
      undefined,
      this.selectedStatus ?? undefined
    ).pipe(
      catchError(error => {
        console.error('Error loading negotiations:', error);
        
        if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else if (error.status === 0) {
          this.errorMessage = 'Cannot connect to server. Please check if backend is running.';
        } else {
          this.errorMessage = `Error ${error.status}: ${error.statusText || 'Failed to load'}`;
        }
        return of([]);
      }),
      finalize(() => this.isLoading = false)
    ).subscribe(data => {
      // Normalize field names - backend may send gcrossNumber (lowercase) instead of gCrossNumber
      this.negotiations = (data || []).map((nego: any) => ({
        ...nego,
        gCrossNumber: nego.gcrossNumber || nego.gCrossNumber || nego.GCROSS_NUMBER || 0
      }));
      console.log('Loaded negotiations:', this.negotiations);
      console.log('Negotiations count:', this.negotiations.length);
      
      // Set default sorting to newest to oldest (by date)
      this.sortColumn = 'date';
      this.sortDirection = 'desc'; // Changed from 'asc' to 'desc' for newest first
      
      this.applyFilters(); // This will call applySorting and updatePagination
      this.applySorting(); // Ensure sorting is applied
    });
  }

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.searchTermChanged.next(term);
    this.applyFilters();
  }

  onYearFilterChange(): void {
    this.applyFilters();
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.negotiations];

    // Search term filter (searches only negotiation ID)
    if (this.searchTerm) {
      const searchTerm = this.searchTerm.toLowerCase();
      filtered = filtered.filter(nego => 
        nego.negotiationid?.toString().toLowerCase().includes(searchTerm)
      );
    }

    // Year filter
    if (this.selectedYear) {
      filtered = filtered.filter(nego => {
        const negoDate = new Date(nego.negotiationDate);
        return negoDate.getFullYear() === this.selectedYear;
      });
    }

    // Status filter
    if (this.selectedStatus) {
      filtered = filtered.filter(nego => 
        nego.negotiationstatus === this.selectedStatus
      );
    }

    this.filteredNegotiations = filtered;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalItems = this.filteredNegotiations.length;
    this.totalPages = this.totalItems > 0 ? Math.ceil(this.totalItems / this.itemsPerPage) : 1;
    
    // Ensure current page is valid
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    // Calculate start and end indices
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    
    // Apply pagination to filtered results
    this.displayedNegotiations = this.filteredNegotiations.slice(startIndex, endIndex);
  }

  applySorting(): void {
    if (!this.sortColumn) return;

    this.filteredNegotiations.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (this.sortColumn) {
        case 'negotiationId':
          aValue = a.negotiationid;
          bValue = b.negotiationid;
          break;
        case 'prId':
          aValue = a.purchaseRequest?.prId || 0;
          bValue = b.purchaseRequest?.prId || 0;
          break;
        case 'gCrossNumber':
          aValue = a.gCrossNumber;
          bValue = b.gCrossNumber;
          break;
        case 'vendorId':
          aValue = a.vendorid;
          bValue = b.vendorid;
          break;
        case 'initialquoteamount':
          aValue = a.initialquoteamount || 0;
          bValue = b.initialquoteamount || 0;
          break;
        case 'finalquoteamount':
          aValue = a.finalquoteamount || 0;
          bValue = b.finalquoteamount || 0;
          break;
        case 'status':
          aValue = a.negotiationstatus || '';
          bValue = b.negotiationstatus || '';
          break;
        case 'date':
          aValue = new Date(a.negotiationDate);
          bValue = new Date(b.negotiationDate);
          // If dates are exactly the same, use negotiationid as tiebreaker (higher ID = newer)
          if (aValue.getTime() === bValue.getTime()) {
            return this.sortDirection === 'desc' ? 
              (b.negotiationid || 0) - (a.negotiationid || 0) : 
              (a.negotiationid || 0) - (b.negotiationid || 0);
          }
          break;
        default:
          return 0;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      let comparison = 0;
      if (aValue > bValue) {
        comparison = 1;
      } else if (aValue < bValue) {
        comparison = -1;
      }

      return this.sortDirection === 'desc' ? comparison * -1 : comparison;
    });
    this.updatePagination();
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      // Toggle direction if same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to ascending
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applySorting();
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) {
      return 'fas fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedYear = null;
    this.selectedStatus = null;
    this.setDefaultDateRange();
    this.applyFilters();
  }

  // Pagination methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    
    if (this.totalPages <= 0) {
      return pages;
    }
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  calculateSavings(initial: number | undefined, final: number | undefined): { amount: number, percentage: number } {
    const initialVal = initial || 0;
    const finalVal = final || 0;
    const amount = initialVal - finalVal;
    const percentage = (initialVal === 0) ? 0 : (amount / initialVal) * 100;
    return { amount, percentage };
  }

  viewNegotiationDetails(negotiationId: number): void {
    // Navigate to the view mode of the negotiation component
    this.router.navigate(['/negotiate/view', negotiationId]);
  }

  editNegotiation(negotiationId: number): void {
    // Navigate to the separate edit component
    this.router.navigate(['/negotiate/edit', negotiationId]);
  }

  sendMail(negotiation: any): void {
    // Construct email content with negotiation details
    const subject = `Negotiation Update - NEG-${negotiation.negotiationid}`;
    
    // Build additional status information
    let statusInfo = '';
    if (negotiation.negotiationstatus?.toLowerCase() === 'approved' && negotiation.approvalDate) {
      statusInfo = `\nDate of Approval: ${negotiation.approvalDate}`;
    } else if (negotiation.negotiationstatus?.toLowerCase() === 'rejected') {
      if (negotiation.rejectionDate) {
        statusInfo += `\nDate of Rejection: ${negotiation.rejectionDate}`;
      }
      if (negotiation.rejectionReason) {
        statusInfo += `\nReason for Rejection: ${negotiation.rejectionReason}`;
      }
    }

    const body = `Dear Team,

Please find the negotiation details below:

Negotiation ID: NEG-${negotiation.negotiationid}
Status: ${negotiation.negotiationstatus}${statusInfo}
Initial Quote Amount: ₹${negotiation.initialquoteamount?.toLocaleString('en-IN') || 'N/A'}
Final Quote Amount: ₹${negotiation.finalquoteamount?.toLocaleString('en-IN') || 'Pending'}
Negotiation Date: ${negotiation.negotiationDate}
G Cross Number: ${negotiation.gCrossNumber}
Vendor ID: ${negotiation.vendorid}

Best regards,
Purchase Management System`;

    // Create mailto URL
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open email client
    window.open(mailtoUrl, '_blank');
  }

  getNegotiationStatusClass(status: string): string {
    const lowerStatus = status?.toLowerCase() || '';
    switch (lowerStatus) {
      case 'successful':
      case 'completed':
      case 'approved':
        return 'status-successful';
      case 'finalized':
        return 'status-finalized';
      case 'pending':
        return 'status-inprogress';
      case 'canceled':
      case 'cancelled':
      case 'rejected':
        return 'status-canceled';
      case 'po generated':
        return 'status-pogenerated';
      default:
        return 'status-default';
    }
  }

  // ===== VIEW/EDIT METHODS =====
  loadNegotiationDetails(): void {
    // Validate negotiationId before making API call
    if (!this.negotiationId || isNaN(this.negotiationId) || this.negotiationId <= 0) {
      console.error('Invalid negotiationId:', this.negotiationId);
      this.errorMessage = 'Invalid negotiation ID';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.purchaseService.getNegotiationDetails(this.negotiationId).subscribe({
      next: (data) => {
        this.currentNegotiation = data;
        this.isLoading = false;
        console.log('Loaded negotiation:', data);
      },
      error: (err) => {
        console.error('Error loading negotiation:', err);
        this.errorMessage = 'Failed to load negotiation details';
        this.isLoading = false;
      }
    });
  }

  calculateNegotiationSavings(): number {
    if (!this.currentNegotiation?.initialquoteamount || !this.currentNegotiation?.finalquoteamount) return 0;
    return this.currentNegotiation.initialquoteamount - this.currentNegotiation.finalquoteamount;
  }

  calculateSavingsPercentage(): number {
    if (!this.currentNegotiation?.initialquoteamount || !this.currentNegotiation?.finalquoteamount) return 0;
    return (this.calculateNegotiationSavings() / this.currentNegotiation.initialquoteamount) * 100;
  }

  backToList(): void {
    this.currentView = 'list';
    this.router.navigate(['/negotiate']);
  }

  cancelEdit(): void {
    this.editMode = false;
    this.currentView = 'list';
    this.router.navigate(['/negotiate']);
  }

  switchView(view: string): void {
    this.currentView = view;
    if (view === 'list') {
      this.router.navigate(['/negotiate']);
    }
  }

  // Enhanced edit functionality
  updateNegotiation(): void {
    if (!this.currentNegotiation) return;
    
    // Validate negotiationId before making API call
    if (!this.negotiationId || isNaN(this.negotiationId) || this.negotiationId <= 0) {
      console.error('Invalid negotiationId for update:', this.negotiationId);
      this.errorMessage = 'Invalid negotiation ID';
      return;
    }
    
    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    const updateData = {
      negotiationstatus: this.currentNegotiation.negotiationstatus,
      finalquoteamount: this.currentNegotiation.finalquoteamount,
      negotiationDate: this.currentNegotiation.negotiationDate,
      comments: this.currentNegotiation.comments
    };
    
    this.purchaseService.updateNegotiation(this.negotiationId, updateData).subscribe({
      next: (updated) => {
        this.currentNegotiation = updated;
        this.successMessage = 'Negotiation updated successfully!';
        this.isSaving = false;
        setTimeout(() => {
          this.switchView('list');
        }, 2000);
      },
      error: (err) => {
        console.error('Error updating negotiation:', err);
        this.errorMessage = err.error?.message || 'Failed to update negotiation';
        this.isSaving = false;
      }
    });
  }

  updateStatusOnly(): void {
    if (!this.currentNegotiation?.negotiationstatus) return;
    
    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.purchaseService.updateNegotiationStatus(this.currentNegotiation, this.currentNegotiation.negotiationstatus).subscribe({
      next: (updated) => {
        this.currentNegotiation = updated;
        
        // If negotiation is approved, create a purchase order
        if (this.currentNegotiation.negotiationstatus === 'APPROVED') {
          this.createPurchaseOrder(updated);
        } else {
          this.successMessage = 'Status updated successfully!';
          this.isSaving = false;
        }
      },
      error: (err) => {
        console.error('Error updating status:', err);
        this.errorMessage = err.error?.message || 'Failed to update status';
        this.isSaving = false;
      }
    });
  }

  private createPurchaseOrder(negotiation: Negotiation): void {
    // Create purchase order data based on the approved negotiation
    const purchaseOrderData = {
      gCrossNumber: negotiation.gCrossNumber,
      vendorId: negotiation.vendorid,
      negotiationId: negotiation.negotiationid,
      prId: negotiation.purchaseRequest?.prId, // Get prId from the associated purchase request
      orderAmount: negotiation.finalquoteamount || negotiation.initialquoteamount
    };

    // Call the backend API to create the purchase order
    // Note: You'll need to add this method to your PurchaseOrderService
    // For now, we'll just show a success message
    this.successMessage = 'Status updated successfully! Purchase Order will be created automatically.';
    this.isSaving = false;
    
    console.log('Purchase Order would be created with data:', purchaseOrderData);
    
    // Optionally redirect to purchase orders page
    setTimeout(() => {
      if (confirm('Negotiation approved! Would you like to view the purchase orders?')) {
        this.router.navigate(['/purchase-orders']);
      }
    }, 2000);
  }

  isFormValid(): boolean {
    return !!(this.currentNegotiation?.negotiationstatus && 
           this.currentNegotiation?.finalquoteamount !== null &&
           this.currentNegotiation?.finalquoteamount !== undefined);
  }

  // Dashboard metric methods
  getPendingCount(): number {
    return this.negotiations.filter(n => n.negotiationstatus === 'PENDING' || n.negotiationstatus === 'UNDER_REVIEW').length;
  }

  getCompletedCount(): number {
    return this.negotiations.filter(n => n.negotiationstatus === 'APPROVED' || n.negotiationstatus === 'SUCCESSFUL').length;
  }

  getFailedCount(): number {
    return this.negotiations.filter(n => n.negotiationstatus === 'REJECTED' || n.negotiationstatus === 'FAILED' || n.negotiationstatus === 'CANCELED').length;
  }

  // Dashboard action methods
  refreshNegotiations(): void {
    console.log('Refreshing negotiations...');
    this.loadNegotiations();
  }

  exportNegotiations(): void {
    // TODO: Implement export functionality
    alert('Export functionality will be implemented');
  }

  bulkEditNegotiations(): void {
    // TODO: Implement bulk edit functionality
    const selectedCount = this.negotiations.filter(n => n.selected).length;
    if (selectedCount === 0) {
      alert('Please select negotiations to edit');
      return;
    }
    alert(`Bulk edit functionality will be implemented for ${selectedCount} selected negotiations`);
  }

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  navigateToPurchaseRequests(): void {
    this.router.navigate(['/dashboard']);
  }

  navigateToPurchaseOrders(): void {
    console.log('Navigating to Purchase Orders page...');
    this.router.navigate(['/purchase-orders']).then(
      (success) => {
        if (success) {
          console.log('Navigation to purchase orders successful');
        } else {
          console.log('Navigation to purchase orders failed');
        }
      }
    ).catch(err => {
      console.error('Navigation error:', err);
    });
  }

  // Helper methods for display
  getEventName(gCrossNumber: number | undefined | null): string {
    if (!gCrossNumber) {
      return 'No G Cross Number Assigned';
    }
    
    const event = this.allEvents.find(e => e.gCrossNumber === gCrossNumber);
    
    if (event) {
      const result = `${gCrossNumber} - ${event.eventname}`;
      return result;
    }
    
    return `${gCrossNumber} - Event Not Found`;
  }

  getVendorName(vendorId: number | undefined): string {
    if (vendorId === undefined) return 'N/A';
    const vendor = this.allVendors.find(v => v.vendorId === vendorId);
    return vendor ? vendor.vendorname : 'N/A';
  }


  allAvailableStatuses: string[] = [
    'PENDING',
    'APPROVED',
    'REJECTED'
  ];
}
