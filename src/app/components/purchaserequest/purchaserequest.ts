import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { Request } from '../../service/request';
import { purchaserequests } from '../../service/request';

import { Vendor, Event, EnrichedPurchaseRequest } from '../../service/request';
import { forkJoin, of, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-purchaserequest',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './purchaserequest.html',
  styleUrl: './purchaserequest.css'
})
export class Purchaserequest implements OnInit {

  constructor(private requestService: Request, private router: Router, private route: ActivatedRoute) { }
  
  // ===== FORM DATA PROPERTIES =====
  /** Template object for creating new Purchase Requests - bound to form inputs */
  purchaserequest: purchaserequests = {
    prId: 0,
    gCrossNumber: 0,
    vendorId: 0,
    allocatedamount: 0,
    prstatus: '',
    requestLocalDate: ''
  };

  // ===== MODAL STATE PROPERTIES =====
  /** Controls visibility of "Raise PR" modal */
  isModalOpen = false;
  /** Controls visibility of "Edit PR Status" modal */
  isEditModalOpen = false;
  /** Controls visibility of "View PR Details" modal */
  isViewModalOpen = false;

  // ===== DATA STORAGE PROPERTIES =====
  /** Raw Purchase Requests data from backend after normalization */
  purchaserequestsList: purchaserequests[] = []; 
  /** Enriched PRs with vendor names and event names for display */
  displayPurchaseRequests: EnrichedPurchaseRequest[] = [];
  /** Current page subset of filtered data - what users actually see in table */
  paginatedPurchaseRequests: EnrichedPurchaseRequest[] = [];
  /** Filtered results after applying search criteria */
  filteredPurchaseRequests: EnrichedPurchaseRequest[] = [];
  
  /** Master list of all vendors for dropdowns and name resolution */
  allVendors: Vendor[] = [];
  /** Master list of all events for dropdowns and name resolution */
  allEvents: Event[] = [];

  // ===== CURRENT OPERATION TRACKING =====
  /** Reference to PR currently being edited in status update modal */
  currentEditingPR: purchaserequests | null = null; 
  /** Selected status value in edit modal */
  selectedStatus = '';
  /** Reference to PR currently being viewed in details modal */
  currentViewingPR: purchaserequests | null = null; 
  
  // ===== FILTER AND SEARCH PROPERTIES =====
  /** Filter criteria object for all search fields */
  filters = {
    prId: '',
    gCrossNumberOrName: '',
    vendorIdOrName: '',
    status: ''
  };
  
  /** Dropdown options for status filter */
  statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'IN_NEGOTIATION', label: 'In Negotiation' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' }
  ];
  
  // ===== DASHBOARD METRICS PROPERTIES =====
  /** Count of PRs with PENDING status for dashboard display */
  pendingCount = 0;
  /** Count of PRs with IN_NEGOTIATION status for dashboard display */
  inNegotiationCount = 0;
  /** Count of PRs with APPROVED status for dashboard display */
  approvedCount = 0;
  /** Count of PRs with REJECTED status for dashboard display */
  rejectedCount = 0;

  // ===== PAGINATION PROPERTIES =====
  /** Current active page number (1-based indexing) */
  currentPage = 1;
  /** Number of items to display per page */
  itemsPerPage = 10;
  /** Total number of items after filtering */
  totalItems = 0;
  /** Total number of pages calculated from totalItems/itemsPerPage */
  totalPages = 0;

  // ===== COMPONENT LIFECYCLE METHODS =====
  
  /**
   * Angular lifecycle hook - called after component initialization
   * Orchestrates the initial data loading sequence:
   * 1. Load vendors and events data first (required for enrichment)
   * 2. Load purchase requests data after auxiliary data is ready
   * 3. Handle graceful degradation if auxiliary data loading fails
   */
  ngOnInit(): void {
    // Always refresh data when component initializes (this covers returning from other pages)
    this.loadAuxiliaryData().subscribe({
      next: () => {
        this.loadPurchaseRequests();
      },
      error: (error) => {
        console.error('Failed to load auxiliary data, proceeding with PRs:', error);
        this.loadPurchaseRequests();
      }
    });
  }

  // ===== DATA LOADING AND REFRESH METHODS =====
  
  /**
   * Manual data refresh method - can be called by user action or programmatically
   * Reloads purchase requests without reloading auxiliary data (vendors/events)
   * Used when we know auxiliary data hasn't changed but PR data might have
   */
  refreshData(): void {
    console.log('Manually refreshing Purchase Request data...');
    this.loadPurchaseRequests();
  }

  /**
   * Loads supporting reference data (vendors and events) required for PR enrichment
   * Uses forkJoin to load both datasets simultaneously for better performance
   * Handles field name normalization due to inconsistent backend field naming
   * 
   * @returns Observable that emits when both vendors and events are loaded
   * 
   * Data Flow:
   * 1. Make parallel API calls for vendors and events
   * 2. Normalize event field names (handles gcrossNumber vs gCrossNumber variations)
   * 3. Store normalized data in component properties
   * 4. Handle errors gracefully by setting empty arrays as fallbacks
   */
  loadAuxiliaryData(): Observable<any> {
    return forkJoin({
      vendors: this.requestService.getAllVendors(),
      events: this.requestService.getAllEvents()
    }).pipe(
      tap(({ vendors, events }) => {
        this.allVendors = vendors;
        console.log('Raw events from backend:', events);
        console.log('First event object keys:', Object.keys(events[0] || {}));
        console.log('First event raw object:', events[0]);
        
        // Normalize field names for events - backend uses gcrossNumber (lowercase 'c') and eventname
        // This handles various possible field name formats from the backend
        this.allEvents = events.map(event => ({
          gCrossNumber: event.gcrossNumber || event.gCrossNumber || event.GCROSS_NUMBER || event.gcross_number || 0,
          eventname: event.eventname || event.eventName || event.EVENTNAME || event.event_name || 'Unknown'
        }));
        console.log('Loaded Vendors:', this.allVendors);
        console.log('Loaded Events:', this.allEvents);
        console.log('Events structure:', this.allEvents.map(e => ({ gCrossNumber: e.gCrossNumber, eventname: e.eventname })));
      }),
      catchError(error => {
        console.error('Error loading vendors or events:', error);
        this.allVendors = [];
        this.allEvents = [];
        return of(null);
      })
    );
  }

  /**
   * Loads Purchase Request data from backend and processes it through the data pipeline
   * This is the main data loading method that triggers the entire processing chain
   * 
   * Data Processing Pipeline:
   * 1. Fetch raw PR data from backend API
   * 2. Normalize field names (handles gcrossNumber vs gCrossNumber inconsistencies)
   * 3. Enrich data with vendor names and event names
   * 4. Apply current filters
   * 5. Calculate status counts for dashboard metrics
   * 6. Update pagination
   * 
   * Error Handling:
   * - Resets all data arrays to empty state on failure
   * - Resets pagination counters
   * - Resets status counts
   */
  loadPurchaseRequests(): void {
    console.log('Loading purchase requests...');
    this.requestService.getallPurchaseRequests().subscribe({
      next: (data) => {
        console.log('Loaded PR data:', data);
        console.log('First PR object fields:', Object.keys(data[0] || {}));
        console.log('First PR object raw:', data[0]);
        console.log('PR gCrossNumbers:', data.map(pr => pr.gCrossNumber || pr.GCROSS_NUMBER || pr.gcross_number));
        
        // Normalize field names - backend may send gcrossNumber (lowercase) instead of gCrossNumber
        // This ensures consistent field naming regardless of backend variations
        this.purchaserequestsList = (data || []).map((pr: any) => ({
          ...pr,
          gCrossNumber: pr.gcrossNumber || pr.gCrossNumber || pr.GCROSS_NUMBER || 0
        }));
        
        // Process data through the enrichment and display pipeline
        this.displayPurchaseRequests = this.enrichPurchaseRequests(this.purchaserequestsList); // Use normalized data
        this.applyFilters();
        this.calculateStatusCounts();
        console.log('PR status counts after loading:', {
          pending: this.pendingCount,
          inNegotiation: this.inNegotiationCount,
          approved: this.approvedCount,
          rejected: this.rejectedCount
        });
      },
      error: (error) => {
        console.error('Error loading purchase requests:', error);
        // Reset all data structures on error to ensure clean state
        this.purchaserequestsList = [];
        this.displayPurchaseRequests = [];
        this.filteredPurchaseRequests = [];
        this.paginatedPurchaseRequests = [];
        this.totalItems = 0;
        this.totalPages = 0;
        this.resetCounts();
      }
    });
  }

  // ===== DATA ENRICHMENT AND PROCESSING METHODS =====
  
  /**
   * Enriches raw Purchase Request data with vendor names and event names for user-friendly display
   * Also applies consistent sorting to ensure predictable data order
   * 
   * @param prList - Array of raw purchase requests from backend
   * @returns Array of enriched purchase requests with additional display fields
   * 
   * Enrichment Process:
   * 1. For each PR, copy all original fields
   * 2. Look up vendor name by vendorId and add as 'vendorName' field
   * 3. Look up event name by gCrossNumber and add as 'eventName' field
   * 4. Sort results by date (newest first), then by PR ID (higher first)
   * 
   * Why Enrichment:
   * - Users see "ABC Corp" instead of vendor ID "123"
   * - Users see "Tech Conference 2025" instead of G-Cross number "456"
   * - Enables search by names instead of just IDs
   * - Provides consistent sorting for predictable display
   */
  enrichPurchaseRequests(prList: purchaserequests[]): EnrichedPurchaseRequest[] {
    const enrichedList = prList.map(pr => {
      const enrichedPr: EnrichedPurchaseRequest = { ...pr };

      // Add vendor name lookup for user-friendly display
      const vendor = this.allVendors.find(v => v.vendorId === pr.vendorId);
      if (vendor) {
        enrichedPr.vendorName = vendor.vendorname;
      }

      // Add event name lookup for user-friendly display
      const event = this.allEvents.find(e => e.gCrossNumber === pr.gCrossNumber);
      if (event) {
        enrichedPr.eventName = event.eventname;
      }
      return enrichedPr;
    });

    // Sort data consistently: newest dates first, then highest PR IDs first
    return enrichedList.sort((a, b) => {
      const dateA = a.requestLocalDate ? new Date(a.requestLocalDate).getTime() : 0;
      const dateB = b.requestLocalDate ? new Date(b.requestLocalDate).getTime() : 0;
      
      // Sort from newest to oldest (descending) - newest at top
      if (dateA !== dateB) {
        return dateB - dateA; // Newer dates first
      }
      
      // If dates and times are exactly equal, sort by PR ID descending (higher PR ID = newer)
      return (b.prId || 0) - (a.prId || 0);
    });
  }

  // ===== STATUS COUNTING AND METRICS METHODS =====
  
  /**
   * Calculates count of PRs in each status for dashboard metrics display
   * Uses the raw purchaserequestsList to ensure counts reflect actual data, not filtered results
   * 
   * Status Categories:
   * - PENDING: Newly created PRs awaiting review
   * - IN_NEGOTIATION: PRs currently in negotiation process
   * - APPROVED: PRs that have been approved for purchase
   * - REJECTED: PRs that have been rejected
   * 
   * Note: Uses raw data (purchaserequestsList) not filtered data to show true counts
   */
  calculateStatusCounts(): void {
    console.log('Calculating status counts from PR list:', this.purchaserequestsList.map(pr => ({
      prId: pr.prId,
      prstatus: pr.prstatus,
      allFields: Object.keys(pr)
    })));
    
    // Count PRs by status using filter operations
    this.pendingCount = this.purchaserequestsList.filter(pr => pr.prstatus === 'PENDING').length;
    this.inNegotiationCount = this.purchaserequestsList.filter(pr => pr.prstatus === 'IN_NEGOTIATION').length;
    this.approvedCount = this.purchaserequestsList.filter(pr => pr.prstatus === 'APPROVED').length;
    this.rejectedCount = this.purchaserequestsList.filter(pr => pr.prstatus === 'REJECTED').length;
    
    console.log('Status breakdown:', {
      pending: this.purchaserequestsList.filter(pr => pr.prstatus === 'PENDING').map(pr => pr.prId),
      inNegotiation: this.purchaserequestsList.filter(pr => pr.prstatus === 'IN_NEGOTIATION').map(pr => pr.prId),
      approved: this.purchaserequestsList.filter(pr => pr.prstatus === 'APPROVED').map(pr => pr.prId),
      rejected: this.purchaserequestsList.filter(pr => pr.prstatus === 'REJECTED').map(pr => pr.prId)
    });
  }

  /**
   * Resets all status counts to zero
   * Used when there's an error loading data or when initializing component
   * Ensures dashboard shows accurate counts (0) instead of stale data
   */
  resetCounts(): void {
    this.pendingCount = 0;
    this.inNegotiationCount = 0;
    this.approvedCount = 0;
    this.rejectedCount = 0;
  }

  // ===== PAGINATION METHODS =====
  
  /**
   * Updates the paginated data subset that gets displayed in the table
   * Calculates which slice of filtered data should be shown based on current page
   * 
   * @example
   * Page 1: items 0-9 (if itemsPerPage = 10)
   * Page 2: items 10-19
   * Page 3: items 20-29
   * 
   * Index Calculation:
   * - startIndex = (currentPage - 1) × itemsPerPage
   * - endIndex = startIndex + itemsPerPage
   * - slice(startIndex, endIndex) extracts the subset
   */
  updatePaginatedData(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedPurchaseRequests = this.filteredPurchaseRequests.slice(startIndex, endIndex);
  }

  // ===== FILTERING AND SEARCH METHODS =====
  
  /**
   * Applies all active filters to the enriched purchase requests data
   * Supports multiple filter types that can be combined:
   * 1. PR ID filter - exact match or partial match
   * 2. Event filter - by G-Cross number or event name
   * 3. Vendor filter - by vendor ID or vendor name  
   * 4. Status filter - exact status match
   * 
   * After filtering:
   * - Recalculates pagination parameters (totalItems, totalPages)
   * - Resets to page 1 to avoid showing empty pages
   * - Updates paginated display data
   */
  applyFilters(): void {
    let filtered = [...this.displayPurchaseRequests];

    // Filter by PR ID (partial match)
    if (this.filters.prId) {
      filtered = filtered.filter(pr => 
        pr.prId?.toString().includes(this.filters.prId)
      );
    }

    // Filter by G-Cross Number or Event Name (case-insensitive partial match)
    if (this.filters.gCrossNumberOrName) {
      const searchTerm = this.filters.gCrossNumberOrName.toLowerCase();
      filtered = filtered.filter(pr => 
        pr.gCrossNumber?.toString().includes(searchTerm) ||
        this.getEventName(pr.gCrossNumber).toLowerCase().includes(searchTerm)
      );
    }

    // Filter by Vendor ID or Vendor Name (case-insensitive partial match)
    if (this.filters.vendorIdOrName) {
      const searchTerm = this.filters.vendorIdOrName.toLowerCase();
      filtered = filtered.filter(pr => 
        pr.vendorId?.toString().includes(searchTerm) ||
        this.getVendorName(pr.vendorId).toLowerCase().includes(searchTerm)
      );
    }

    // Filter by Status (exact match)
    if (this.filters.status) {
      filtered = filtered.filter(pr => pr.prstatus === this.filters.status);
    }

    // Update filtered results and recalculate pagination
    this.filteredPurchaseRequests = filtered;
    this.totalItems = this.filteredPurchaseRequests.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    this.currentPage = 1; // Reset to first page when filters change
    this.updatePaginatedData();
  }

  /**
   * Event handler for filter input changes
   * Called whenever user types in search fields or changes filter dropdowns
   * Simply delegates to applyFilters() method
   */
  onFilterChange(): void {
    this.applyFilters();
  }

  /**
   * Clears all filter criteria and resets the display to show all data
   * Useful "Clear All" functionality for users
   * Automatically re-applies filters (which will now show all data)
   */
  clearFilters(): void {
    this.filters = {
      prId: '',
      gCrossNumberOrName: '',
      vendorIdOrName: '',
      status: ''
    };
    this.applyFilters();
  }

  // ===== PAGINATION NAVIGATION METHODS =====
  
  /**
   * Navigates to a specific page number
   * Validates page number is within valid range before navigation
   * 
   * @param page - Target page number (1-based)
   * 
   * Validation:
   * - Page must be >= 1
   * - Page must be <= totalPages
   * - Only navigates if validation passes
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedData();
    }
  }

  /**
   * Navigates to the next page
   * Only navigates if not already on the last page
   * Prevents navigation beyond available data
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedData();
    }
  }

  /**
   * Navigates to the previous page
   * Only navigates if not already on the first page
   * Prevents navigation to invalid page numbers
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedData();
    }
  }

  /**
   * Generates array of page numbers for pagination UI
   * Used by template to render page number buttons
   * 
   * @returns Array of page numbers [1, 2, 3, ..., totalPages]
   * 
   * @example
   * If totalPages = 5, returns [1, 2, 3, 4, 5]
   */
  getPageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  /**
   * Calculates the ending index for current page display
   * Handles edge case where last page might have fewer items than itemsPerPage
   * Used for "Showing X-Y of Z items" display text
   * 
   * @returns The ending index, never exceeding totalItems
   * 
   * @example
   * currentPage=3, itemsPerPage=10, totalItems=25
   * Returns: min(30, 25) = 25
   */
  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }

  // ===== UTILITY AND TESTING METHODS =====
  
  /**
   * Test method to verify Angular data binding is working correctly
   * Can be removed in production - used for development/debugging
   * Triggered by test button in UI to confirm component functionality
   */
  testButtonClick(): void {
    alert('TEST BUTTON CLICKED - Angular binding is working!');
  }

  // ===== MODAL MANAGEMENT METHODS =====
  
  /**
   * Opens the "Raise Purchase Request" modal for creating new PRs
   * Resets the form to ensure clean state for new entry
   * Sets modal visibility flag to trigger UI display
   */
  openRaisePRModal(): void {
    this.isModalOpen = true;
    this.resetForm();
  }

  /**
   * Closes the "Raise Purchase Request" modal
   * Resets the form to clear any user input
   * Hides modal from UI
   */
  closeModal(): void {
    this.isModalOpen = false;
    this.resetForm();
  }

  /**
   * Opens the "Edit Purchase Request Status" modal
   * Pre-populates modal with current PR data for editing
   * 
   * @param pr - The Purchase Request to edit
   * 
   * Process:
   * 1. Creates a copy of PR data to avoid direct mutation
   * 2. Sets current status in dropdown selection
   * 3. Shows edit modal
   */
  openEditModal(pr: purchaserequests): void {
    this.currentEditingPR = { ...pr }; // Create copy to avoid direct mutation
    this.selectedStatus = pr.prstatus || '';
    this.isEditModalOpen = true;
  }

  /**
   * Closes the "Edit Purchase Request Status" modal
   * Clears all edit-related state variables
   * Resets references to prevent memory leaks
   */
  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.currentEditingPR = null;
    this.selectedStatus = '';
  }

  /**
   * Updates the status of a Purchase Request
   * Called when user confirms status change in edit modal
   * 
   * Process:
   * 1. Validates that PR and new status are selected
   * 2. Calls backend API to update status
   * 3. Refreshes all data on success to reflect changes
   * 4. Closes edit modal and shows success message
   * 5. Handles errors with user-friendly error messages
   */
  updatePRStatus(): void {
    if (this.currentEditingPR && this.selectedStatus) {
      console.log('Updating PR ID:', this.currentEditingPR.prId, 'to status:', this.selectedStatus);
      this.requestService.updatePurchaseStatus(this.currentEditingPR.prId!, this.selectedStatus).subscribe({
        next: (updatedPR) => {
          console.log('PR status updated successfully:', updatedPR);
          this.loadPurchaseRequests(); // Refresh all data to reflect changes
          this.closeEditModal();
          alert('Purchase Request status updated successfully!');
        },
        error: (error) => {
          console.error('Error updating PR status:', error);
          console.error('Failed request details - ID:', this.currentEditingPR?.prId, 'Status:', this.selectedStatus);
          alert('Error updating Purchase Request status. Please try again.');
        }
      });
    }
  }

  /**
   * Opens the "View Purchase Request Details" modal for read-only display
   * Shows detailed information about selected PR
   * 
   * @param pr - The Purchase Request to view
   * 
   * Creates a copy to prevent accidental mutations during viewing
   */
  openViewModal(pr: purchaserequests): void {
    this.currentViewingPR = { ...pr }; // Create copy for safety
    this.isViewModalOpen = true;
  }

  /**
   * Closes the "View Purchase Request Details" modal
   * Clears view state and hides modal
   */
  closeViewModal(): void {
    this.isViewModalOpen = false;
    this.currentViewingPR = null;
  }

  // ===== DATA RESOLUTION AND LOOKUP METHODS =====
  
  /**
   * Resolves G-Cross number to user-friendly event name
   * Used throughout the component for displaying event information
   * 
   * @param gCrossNumber - The G-Cross number to look up
   * @returns Formatted string with number and event name, or appropriate fallback
   * 
   * Return Formats:
   * - "123 - Annual Tech Conference" (when event found)
   * - "123 - Event Not Found" (when number exists but event not in list)
   * - "No G Cross Number Assigned" (when number is null/undefined)
   */
  getEventName(gCrossNumber: number | null): string {
    if (!gCrossNumber) {
      return 'No G Cross Number Assigned';
    }
    
    const event = this.allEvents.find(e => e.gCrossNumber === gCrossNumber);
    
    if (event) {
      return `${gCrossNumber} - ${event.eventname}`;
    } else {
      return `${gCrossNumber} - Event Not Found`;
    }
  }

  /**
   * Resolves vendor ID to vendor name for user-friendly display
   * Used in tables, modals, and search functionality
   * 
   * @param vendorId - The vendor ID to look up
   * @returns Vendor name if found, 'N/A' if not found or undefined
   */
  getVendorName(vendorId: number | undefined): string {
    if (vendorId === undefined) return 'N/A';
    const vendor = this.allVendors.find(v => v.vendorId === vendorId);
    return vendor ? vendor.vendorname : 'N/A';
  }

  /**
   * Resolves vendor ID to vendor email for contact information display
   * Used in detailed views and contact-related functionality
   * 
   * @param vendorId - The vendor ID to look up
   * @returns Vendor email if found and available, 'N/A' otherwise
   */
  getVendorEmail(vendorId: number | undefined): string {
    if (vendorId === undefined) return 'N/A';
    const vendor = this.allVendors.find(v => v.vendorId === vendorId);
    return vendor && vendor.email ? vendor.email : 'N/A';
  }

  // ===== NAVIGATION METHODS =====
  
  /**
   * Navigates to negotiation page for a specific Purchase Request
   * Passes PR data and auxiliary data to negotiation component via sessionStorage
   * 
   * @param pr - The Purchase Request to initiate negotiation for
   * 
   * Data Transfer:
   * 1. Stores selected PR data in sessionStorage
   * 2. Stores vendor and event data for negotiation component use
   * 3. Navigates to initiate-negotiation route with PR ID
   * 
   * Why sessionStorage:
   * - Preserves data across route navigation
   * - Avoids complex parent-child component communication
   * - Allows negotiation component to access full context
   */
  navigateToNegotiate(pr: purchaserequests): void {
    // Store the selected PR and auxiliary data for the negotiation component
    sessionStorage.setItem('selectedPR', JSON.stringify(pr));
    sessionStorage.setItem('allVendors', JSON.stringify(this.allVendors));
    sessionStorage.setItem('allEvents', JSON.stringify(this.allEvents));
    
    this.router.navigate(['/initiate-negotiation', pr.prId]);
    console.log('Selected PR for negotiation:', pr);
    console.log('Passed vendors:', this.allVendors);
    console.log('Passed events:', this.allEvents);
  }

  /**
   * Navigates to general negotiation page (from sidebar navigation)
   * Used for general negotiation access without specific PR context
   */
  navigateToNegotiateFromSidebar(): void {
    console.log('Navigating to Negotiate page...');
    this.router.navigate(['/negotiate']);
  }

  /**
   * Navigates to Purchase Orders page
   * Includes success/error handling for navigation debugging
   * Used for workflow progression from PR to PO management
   */
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

  // ===== PURCHASE REQUEST CREATION METHODS =====
  
  /**
   * Creates a new Purchase Request based on form data
   * Handles the complete PR creation workflow including validation and data refresh
   * 
   * Process:
   * 1. Validates form data using validateRaisePRForm()
   * 2. Transforms form data to match backend API expectations
   * 3. Calls backend API to create PR
   * 4. Refreshes all data on success
   * 5. Resets UI state (pagination, filters, modal)
   * 6. Provides user feedback
   * 
   * Field Mapping:
   * - gCrossNumber → gcrossNumber (backend expects lowercase)
   * - Numbers are explicitly converted to prevent type issues
   */
  addPurchaseRequest(): void {
    console.log('=== DEBUG: PR Creation ===');
    console.log('Form gCrossNumber:', this.purchaserequest.gCrossNumber);
    console.log('Form gCrossNumber type:', typeof this.purchaserequest.gCrossNumber);
    
    if (this.validateRaisePRForm()) {
      // Prepare data for backend - handle field name mapping
      const newPR = {
        gcrossNumber: Number(this.purchaserequest.gCrossNumber),  // Changed to lowercase 'g'
        vendorId: Number(this.purchaserequest.vendorId),
        allocatedamount: Number(this.purchaserequest.allocatedamount)
      };
      
      console.log('=== DEBUG: Data being sent to backend ===');
      console.log('newPR object:', newPR);
      console.log('newPR.gcrossNumber:', newPR.gcrossNumber);
      console.log('JSON payload:', JSON.stringify(newPR));
      
      this.requestService.createdata(newPR as purchaserequests).subscribe({
        next: (data) => {
          console.log('=== DEBUG: Backend response ===');
          console.log('Response data:', data);
          // Reset UI state and refresh data
          this.currentPage = 1;           // Reset to first page to see new PR
          this.clearFilters();            // Clear filters to ensure new PR is visible
          this.loadPurchaseRequests();    // Refresh all data
          this.closeModal();              // Close creation modal
          alert('Purchase Request raised successfully!');
        },
        error: (error) => {
          console.error('Error creating purchase request:', error);
          alert('Error raising Purchase Request. Please try again.');
        }
      });
    }
  }

  /**
   * Resets the purchase request form to initial empty state
   * Used when opening modal for new PR or closing modal to clear data
   * Ensures clean state for new entries
   */
  resetForm(): void {
    this.purchaserequest = {
      prId: 0,
      gCrossNumber: 0,
      vendorId: 0,
      allocatedamount: 0,
      prstatus: '',
      requestLocalDate: ''
    };
  }

  /**
   * Validates the Purchase Request form before submission
   * Checks all required fields and ensures valid data types/ranges
   * 
   * @returns boolean - true if validation passes, false otherwise
   * 
   * Validation Rules:
   * 1. G-Cross Number: Must be selected, positive number, not NaN
   * 2. Vendor ID: Must be selected, positive number, not NaN  
   * 3. Allocated Amount: Must be entered, positive number, not NaN
   * 
   * User Feedback:
   * - Shows specific alert messages for each validation failure
   * - Prevents form submission until all validations pass
   */
  validateRaisePRForm(): boolean {
    const gCrossNumber = Number(this.purchaserequest.gCrossNumber);
    const vendorId = Number(this.purchaserequest.vendorId);
    const amount = Number(this.purchaserequest.allocatedamount);
    
    if (!this.purchaserequest.gCrossNumber || gCrossNumber <= 0 || isNaN(gCrossNumber)) {
      alert('Please select a valid G Cross Number - Event');
      return false;
    }
    if (!this.purchaserequest.vendorId || vendorId <= 0 || isNaN(vendorId)) {
      alert('Please select a valid Vendor');
      return false;
    }
    if (!this.purchaserequest.allocatedamount || amount <= 0 || isNaN(amount)) {
      alert('Please enter a valid Allocated Amount (must be a positive number)');
      return false;
    }
    
    return true;
  }
}