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
  
  purchaserequest: purchaserequests = {
    prId: 0,
    eventId: 0,
    vendorId: 0,
    allocatedamount: 0,
    prstatus: '',
    requestLocalDate: ''
  };

  isModalOpen = false;
  purchaserequestsList: purchaserequests[] = []; 

  displayPurchaseRequests: EnrichedPurchaseRequest[] = [];
  paginatedPurchaseRequests: EnrichedPurchaseRequest[] = [];
  filteredPurchaseRequests: EnrichedPurchaseRequest[] = [];
  
  allVendors: Vendor[] = [];
  allEvents: Event[] = [];

  isEditModalOpen = false;
  currentEditingPR: purchaserequests | null = null; 
  selectedStatus = '';
  
  isViewModalOpen = false;
  currentViewingPR: purchaserequests | null = null; 
  
  filters = {
    prId: '',
    eventIdOrName: '',
    vendorIdOrName: '',
    status: ''
  };
  
  statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'IN_NEGOTIATION', label: 'In Negotiation' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' }
  ];
  
  pendingCount = 0;
  inNegotiationCount = 0;
  approvedCount = 0;
  rejectedCount = 0;

  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;

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

  // Add manual refresh method
  refreshData(): void {
    console.log('Manually refreshing Purchase Request data...');
    this.loadPurchaseRequests();
  }

  loadAuxiliaryData(): Observable<any> {
    return forkJoin({
      vendors: this.requestService.getAllVendors(),
      events: this.requestService.getAllEvents()
    }).pipe(
      tap(({ vendors, events }) => {
        this.allVendors = vendors;
        this.allEvents = events;
        console.log('Loaded Vendors:', this.allVendors);
        console.log('Loaded Events:', this.allEvents);
      }),
      catchError(error => {
        console.error('Error loading vendors or events:', error);
        this.allVendors = [];
        this.allEvents = [];
        return of(null);
      })
    );
  }

  loadPurchaseRequests(): void {
    console.log('Loading purchase requests...');
    this.requestService.getallPurchaseRequests().subscribe({
      next: (data) => {
        console.log('Loaded PR data:', data);
        console.log('First PR object fields:', Object.keys(data[0] || {}));
        console.log('First PR object:', data[0]);
        
        this.purchaserequestsList = data;
        this.displayPurchaseRequests = this.enrichPurchaseRequests(data);
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

  enrichPurchaseRequests(prList: purchaserequests[]): EnrichedPurchaseRequest[] {
    const enrichedList = prList.map(pr => {
      const enrichedPr: EnrichedPurchaseRequest = { ...pr };

      const vendor = this.allVendors.find(v => v.vendorId === pr.vendorId);
      if (vendor) {
        enrichedPr.vendorName = vendor.vendorname;
      }

      const event = this.allEvents.find(e => e.eventId === pr.eventId);
      if (event) {
        enrichedPr.eventName = event.eventname;
      }
      return enrichedPr;
    });

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

  calculateStatusCounts(): void {
    console.log('Calculating status counts from PR list:', this.purchaserequestsList.map(pr => ({
      prId: pr.prId,
      prstatus: pr.prstatus,
      allFields: Object.keys(pr)
    })));
    
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

  resetCounts(): void {
    this.pendingCount = 0;
    this.inNegotiationCount = 0;
    this.approvedCount = 0;
    this.rejectedCount = 0;
  }

  updatePaginatedData(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedPurchaseRequests = this.filteredPurchaseRequests.slice(startIndex, endIndex);
  }

  applyFilters(): void {
    let filtered = [...this.displayPurchaseRequests];

    if (this.filters.prId) {
      filtered = filtered.filter(pr => 
        pr.prId?.toString().includes(this.filters.prId)
      );
    }

    if (this.filters.eventIdOrName) {
      const searchTerm = this.filters.eventIdOrName.toLowerCase();
      filtered = filtered.filter(pr => 
        pr.eventId?.toString().includes(searchTerm) ||
        this.getEventName(pr.eventId).toLowerCase().includes(searchTerm)
      );
    }

    if (this.filters.vendorIdOrName) {
      const searchTerm = this.filters.vendorIdOrName.toLowerCase();
      filtered = filtered.filter(pr => 
        pr.vendorId?.toString().includes(searchTerm) ||
        this.getVendorName(pr.vendorId).toLowerCase().includes(searchTerm)
      );
    }

    if (this.filters.status) {
      filtered = filtered.filter(pr => pr.prstatus === this.filters.status);
    }

    this.filteredPurchaseRequests = filtered;
    this.totalItems = this.filteredPurchaseRequests.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    this.currentPage = 1;
    this.updatePaginatedData();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.filters = {
      prId: '',
      eventIdOrName: '',
      vendorIdOrName: '',
      status: ''
    };
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedData();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedData();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedData();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }

  openRaisePRModal(): void {
    this.isModalOpen = true;
    this.resetForm();
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.resetForm();
  }

  openEditModal(pr: purchaserequests): void {
    this.currentEditingPR = { ...pr }; 
    this.selectedStatus = pr.prstatus || '';
    this.isEditModalOpen = true;
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.currentEditingPR = null;
    this.selectedStatus = '';
  }

  updatePRStatus(): void {
    if (this.currentEditingPR && this.selectedStatus) {
      console.log('Updating PR ID:', this.currentEditingPR.prId, 'to status:', this.selectedStatus);
      this.requestService.updatePurchaseStatus(this.currentEditingPR.prId!, this.selectedStatus).subscribe({
        next: (updatedPR) => {
          console.log('PR status updated successfully:', updatedPR);
          this.loadPurchaseRequests();
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

  openViewModal(pr: purchaserequests): void {
    this.currentViewingPR = { ...pr }; 
    this.isViewModalOpen = true;
  }

  closeViewModal(): void {
    this.isViewModalOpen = false;
    this.currentViewingPR = null;
  }

  getEventName(eventId: number | undefined): string {
    if (eventId === undefined) return 'N/A';
    const event = this.allEvents.find(e => e.eventId === eventId);
    return event ? event.eventname : 'N/A';
  }

  getVendorName(vendorId: number | undefined): string {
    if (vendorId === undefined) return 'N/A';
    const vendor = this.allVendors.find(v => v.vendorId === vendorId);
    return vendor ? vendor.vendorname : 'N/A';
  }

  getVendorEmail(vendorId: number | undefined): string {
    if (vendorId === undefined) return 'N/A';
    const vendor = this.allVendors.find(v => v.vendorId === vendorId);
    return vendor && vendor.email ? vendor.email : 'N/A';
  }

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

  navigateToNegotiateFromSidebar(): void {
    console.log('Navigating to Negotiate page...');
    this.router.navigate(['/negotiate']);
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

  addPurchaseRequest(): void {
    if (this.validateRaisePRForm()) {
      const newPR = {
        eventId: Number(this.purchaserequest.eventId),
        vendorId: Number(this.purchaserequest.vendorId),
        allocatedamount: Number(this.purchaserequest.allocatedamount)
      };
      
      this.requestService.createdata(newPR as purchaserequests).subscribe({
        next: (data) => {
          console.log('Purchase request created successfully:', data);
          this.currentPage = 1;
          this.clearFilters();
          this.loadPurchaseRequests();
          this.closeModal();
          alert('Purchase Request raised successfully!');
        },
        error: (error) => {
          console.error('Error creating purchase request:', error);
          console.error('Error details:', error.error);
          if (error.error && error.error.message) {
            alert(`Error: ${error.error.message}`);
          } else {
            alert('Error raising Purchase Request. Please try again.');
          }
        }
      });
    }
  }

  resetForm(): void {
    this.purchaserequest = {
      prId: 0,
      eventId: 0,
      vendorId: 0,
      allocatedamount: 0,
      prstatus: '',
      requestLocalDate: ''
    };
  }

  validateRaisePRForm(): boolean {
    const eventId = Number(this.purchaserequest.eventId);
    const vendorId = Number(this.purchaserequest.vendorId);
    const amount = Number(this.purchaserequest.allocatedamount);
    
    if (!eventId || eventId <= 0 || isNaN(eventId)) {
      alert('Please enter a valid Event ID (must be a positive number)');
      return false;
    }
    if (!vendorId || vendorId <= 0 || isNaN(vendorId)) {
      alert('Please enter a valid Vendor ID (must be a positive number)');
      return false;
    }
    if (!amount || amount <= 0 || isNaN(amount)) {
      alert('Please enter a valid Allocated Amount (must be a positive number)');
      return false;
    }
    
    return true;
  }
}