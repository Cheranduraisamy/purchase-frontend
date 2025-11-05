import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { PurchaseOrder, Status1 } from '../../models/purchase-order.model';
import { Request, purchaserequests, Vendor, Event } from '../../service/request';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ConfirmationModal {
  show: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onConfirm?: () => void;
  showActions?: boolean;
  showReasonInput?: boolean;
  reasonInput?: string;
  isReasonInvalid?: boolean;
}

@Component({
  selector: 'app-purchaseorder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchaseorder.html',
  styleUrl: './purchaseorder.css'
})
export class Purchaseorder implements OnInit {
  purchaseOrders: PurchaseOrder[] = [];
  filteredPurchaseOrders: PurchaseOrder[] = [];

  loading: boolean = false;

  selectedFilterStatus: Status1 | 'All' = 'All';
  selectedFilterYear: number | 'All' = new Date().getFullYear();
  vendorSearchTerm: string = '';

  // Vendor and Event data
  allVendors: Vendor[] = [];
  allEvents: Event[] = [];

  Status1 = Status1;

  filterStatusOptions = ['All',  Status1.APPROVED, Status1.REJECTED];

  currentPage: number = 1;
  itemsPerPage: number = 5;
  totalPages: number = 0;
  pages: number[] = [];

  modal: ConfirmationModal = {
    show: false,
    title: '',
    message: '',
    type: 'info',
    showActions: false,
    showReasonInput: false,
    reasonInput: '',
    isReasonInvalid: false
  };

  public Math = Math;

  selectedPOForDetails: PurchaseOrder | null = null;
  showDetailsPanel: boolean = false;

  filterMessage: string = '';
  totalPoCount: number = 0;
  approvedPoCount: number = 0;
  rejectedPoCount: number = 0;


  constructor(
    private readonly purchaseOrderService: PurchaseOrderService,
    private router: Router,
    private requestService: Request
  ) { }

  ngOnInit(): void {
    console.log('Purchase Order component initialized!');
    this.loadVendorsAndEvents();
    this.loadAllPurchaseOrders();
  }

  private loadVendorsAndEvents(): void {
    // Load all vendors
    this.requestService.getAllVendors().subscribe({
      next: (vendors: Vendor[]) => {
        this.allVendors = vendors;
        console.log('Vendors loaded:', vendors);
      },
      error: (error: any) => console.error('Error loading vendors:', error)
    });

    // Load all events
    this.requestService.getAllEvents().subscribe({
      next: (events: Event[]) => {
        this.allEvents = events;
        console.log('Events loaded:', events);
      },
      error: (error: any) => console.error('Error loading events:', error)
    });
  }

  goBack(): void {
    console.log('Navigating back to dashboard...');
    this.router.navigate(['/dashboard']);
  }

  testAlert(): void {
    alert('Purchase Order component is working! 🎉');
    console.log('Test alert clicked - component is functional');
  }

  get paginatedPurchaseOrders(): PurchaseOrder[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredPurchaseOrders.slice(startIndex, endIndex);
  }

  private calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredPurchaseOrders.length / this.itemsPerPage);
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);

    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    } else if (this.totalPages === 0) {
      this.currentPage = 0;
    } else if (this.currentPage === 0 && this.totalPages > 0) {
      this.currentPage = 1;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  showConfirmation(
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    onConfirm?: () => void,
    showReasonInput: boolean = false
  ): void {
    this.modal = {
      show: true,
      title,
      message,
      type,
      onConfirm,
      showActions: !!onConfirm,
      showReasonInput: showReasonInput,
      reasonInput: '',
      isReasonInvalid: false
    };
  }

  closeModal(): void {
    this.modal.show = false;
    this.modal.reasonInput = '';
    this.modal.isReasonInvalid = false;
  }

  confirmAction(): void {
    if (this.modal.showReasonInput && (!this.modal.reasonInput || this.modal.reasonInput.trim() === '')) {
      this.modal.isReasonInvalid = true;
      return;
    }

    this.modal.isReasonInvalid = false;
    if (this.modal.onConfirm) {
      this.modal.onConfirm();
    }
    this.closeModal();
  }

  loadAllPurchaseOrders(): void {
    this.loading = true;

    this.purchaseOrderService.getAllPurchaseOrders().subscribe({
      next: (data) => {
        this.purchaseOrders = data;
        this.calculatePoCounts(); 
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.showConfirmation(
          'Error',
          'Failed to load purchase orders. Please check your network connection and try again.',
          'error'
        );
        console.error('Error loading purchase orders:', error);
      }
    });
  }
  private calculatePoCounts(): void {
    this.totalPoCount = this.purchaseOrders.length;
    this.approvedPoCount = this.purchaseOrders.filter(po => po.po_status === Status1.APPROVED).length;
    this.rejectedPoCount = this.purchaseOrders.filter(po => po.po_status === Status1.REJECTED).length;
  }

  applyFilters(): void {
    let tempFilteredOrders = [...this.purchaseOrders];
    const searchTermLower = this.vendorSearchTerm.toLowerCase().trim();

    if (this.selectedFilterStatus !== 'All') {
      tempFilteredOrders = tempFilteredOrders.filter(po => po.po_status === this.selectedFilterStatus);
    }

    if (searchTermLower) {
        tempFilteredOrders = tempFilteredOrders.filter(po => {
            const vendor = this.allVendors.find((v: Vendor) => v.vendorId === po.vendorid);
            if (vendor) {
                return vendor.vendorId.toString().includes(searchTermLower) ||
                       vendor.vendorname.toLowerCase().includes(searchTermLower);
            }
            return false;
        });
    }

    if (this.selectedFilterYear !== 'All') {
      tempFilteredOrders = tempFilteredOrders.filter(po => {
        const orderDate = new Date(po.orderdate);
        return orderDate.getFullYear() === this.selectedFilterYear;
      });
    }

    tempFilteredOrders.sort((a, b) => {
      const dateA = new Date(a.orderdate).getTime();
      const dateB = new Date(b.orderdate).getTime();
      return dateB - dateA;
    });

    this.filteredPurchaseOrders = tempFilteredOrders;
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  onVendorSearchChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.selectedFilterStatus = 'All';
    this.vendorSearchTerm = '';
    this.selectedFilterYear = new Date().getFullYear();
    this.applyFilters();
  }

  changeStatusToRejected(poId: number): void {
    this.updateStatus(poId, Status1.REJECTED);
  }

  updateStatus(poId: number, newStatus: Status1): void {
    const currentPO = this.filteredPurchaseOrders.find(po => po.po_id === poId);

    if (currentPO && currentPO.po_status === newStatus) {
      this.showConfirmation(
        'Information',
        `Purchase Order #${poId} is already ${newStatus}. No change needed.`,
        'info'
      );
      return;
    }

    this.showConfirmation(
      'Confirm Rejection',
      `Are you sure you want to reject this  Order #${poId}?`,
      'warning',
      () => {
        const reason = this.modal.reasonInput || '';
        this.purchaseOrderService.updatePurchaseOrderStatus(poId, newStatus, reason).subscribe({
          next: (updatedPO) => {
            const mainIndex = this.purchaseOrders.findIndex(po => po.po_id === poId);
            if (mainIndex !== -1) {
                this.purchaseOrders[mainIndex] = updatedPO;
            }

            const filteredIndex = this.filteredPurchaseOrders.findIndex(po => po.po_id === poId);
            if (filteredIndex !== -1) {
              this.filteredPurchaseOrders[filteredIndex] = updatedPO;
            }
            if (this.selectedPOForDetails?.po_id === poId) {
              this.selectedPOForDetails = updatedPO;
            }

            this.calculatePoCounts(); 
            this.showConfirmation(
              'Success',
              `Purchase Order #${poId} status successfully updated to ${newStatus}.`,
              'success'
            );

            this.applyFilters(); 
          },
          error: (error) => {
            this.showConfirmation(
              'Error',
              `Failed to update status for PO #${poId}. ${error.error?.error || 'Please try again later.'}`,
              'error'
            );
            console.error('Error updating status:', error);
          }
        });
      },
      true
    );
  }


  downloadReport(po: PurchaseOrder): void {
    try {
      const doc = new jsPDF();
      doc.setFillColor(0, 71, 171);
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('FORD MOTOR COMPANY', 105, 20, { align: 'center' });

      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Purchase Order Details Report', 105, 30, { align: 'center' });


      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      let yOffset = 55;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Purchase Order Summary - PO #${po.po_id}`, 14, yOffset);
      yOffset += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');


      doc.text(`This report provides a comprehensive overview of Purchase Order #${po.po_id}, issued on ${this.formatDate(po.orderdate)}.`, 14, yOffset);
      yOffset += 7;
      doc.text(`The current status of this order is ${po.po_status}.`, 14, yOffset);
      yOffset += 7;
      if (po.statusChangeReason) {
        doc.text(`Reason for Rejection: ${po.statusChangeReason}`, 14, yOffset);
        yOffset += 7;
      }
      if (po.po_status === Status1.REJECTED && po.rejectedDateTime) {
        doc.text(`Rejected On: ${this.formatDateTime(po.rejectedDateTime)}`, 14, yOffset);
        yOffset += 7;
      }
      yOffset += 8;

      doc.setFont('helvetica', 'bold');
      doc.text('Financial Overview', 14, yOffset);
      yOffset += 7;
      doc.setFont('helvetica', 'normal');


      const formattedAmountINR = this.formatCurrencyValue(po.orderamountINR, 'en-IN', 'Rs. ');
      const formattedAmountUSD = this.formatCurrencyValue(po.orderamountdollar, 'en-US', '$');

      const transactionDetails = [
        ['Order Date:', this.formatDate(po.orderdate)],
        ['Current Status:', po.po_status],
        ['Total Amount (INR):', formattedAmountINR],
        ['Total Amount (USD):', formattedAmountUSD]
      ];

      autoTable(doc, {
        startY: yOffset,
        head: [],
        body: transactionDetails,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2, font: 'helvetica', fontStyle: 'normal' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { cellWidth: 150 }
        }
      });
      yOffset = (doc as any).lastAutoTable.finalY + 10;


      doc.setFont('helvetica', 'bold');
      doc.text('Associated References', 14, yOffset);
      yOffset += 7;
      doc.setFont('helvetica', 'normal');

      const referenceDetails = [
        ['Event ID:', po.eventid?.toString() || 'N/A'],
        ['Vendor ID:', po.vendorid?.toString() || 'N/A'],
        ['Negotiation ID:', po.negotiationid?.toString() || 'N/A'],
        ['Purchase Request ID (PRID):', po.prid?.toString() || 'N/A']
      ];

      autoTable(doc, {
        startY: yOffset,
        head: [],
        body: referenceDetails,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2, font: 'helvetica', fontStyle: 'normal' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 60 },
          1: { cellWidth: 130 }
        }
      });
      yOffset = (doc as any).lastAutoTable.finalY + 15;


      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('This document serves as an official record of the stated Purchase Order.', 14, yOffset);
      yOffset += 5;
      doc.text('For any discrepancies or further details, please contact the Ford Motor Company Purchase Team.', 14, yOffset);


      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
          105,
          285,
          { align: 'center' }
        );
        doc.text('Ford Motor Company - Confidential Document', 105, 290, { align: 'center' });
      }


      doc.save(`Ford_PO_${po.po_id}_${new Date().getTime()}.pdf`);

      this.showConfirmation(
        'Success',
        `PDF report for Purchase Order #${po.po_id} has been downloaded successfully.`,
        'success'
      );
    } catch (error) {
      console.error('PDF generation error:', error);
      this.showConfirmation(
        'Error',
        'Failed to generate PDF report. Please ensure your browser allows downloads and try again.',
        'error'
      );
    }
  }
  sendEmailToOwner(po: PurchaseOrder): void {
    const subject = `Ford Motor Company - Purchase Order Details for PO #${po.po_id}`;
    const formattedAmountINR = this.formatCurrencyValue(po.orderamountINR, 'en-IN', '₹');
    const formattedAmountUSD = this.formatCurrencyValue(po.orderamountdollar, 'en-US', '$');

    const body = `Dear Team,

This email serves as an automated notification from the Ford Motor Company Purchase Management System regarding Purchase Order #${po.po_id}.

Below are the key details for your review:

Purchase Order ID: #${po.po_id}
Order Date: ${this.formatDate(po.orderdate)}
Current Status: ${po.po_status}
${po.statusChangeReason ? `Reason for Rejection: ${po.statusChangeReason}\n` : ''}
${po.po_status === Status1.REJECTED && po.rejectedDateTime ? `Rejected On: ${this.formatDateTime(po.rejectedDateTime)}\n` : ''}

Financial Overview:
- Total Amount (INR): ${formattedAmountINR}
- Total Amount (USD): ${formattedAmountUSD}

Associated References:
- Event ID: ${po.eventid || 'N/A'}
- Vendor ID: ${po.vendorid || 'N/A'}
- Negotiation ID: ${po.negotiationid || 'N/A'}
- Purchase Request ID (PRID): ${po.prid || 'N/A'}

Please review these details. For any further inquiries or actions, kindly refer to the Purchase Management System.

Best regards,
The Ford Motor Company Purchase Team`;


    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;


    window.location.href = mailtoLink;

    this.showConfirmation(
      'Email Prepared',
      `Your email client has been opened with details for Purchase Order #${po.po_id}. Please review and send.`,
      'info'
    );
  }


  getStatusClass(status: Status1): string {
    switch (status) {
      case Status1.APPROVED:
        return 'approved';
      case Status1.REJECTED:
        return 'rejected';
      default:
        return 'secondary';
    }
  }


  public formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'N/A';
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  }

  public formatDateTime(dateTime: Date | string | undefined): string {
    if (!dateTime) return 'N/A';
    const dateObj = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
    if (isNaN(dateObj.getTime())) return 'N/A';
    return dateObj.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  public formatCurrencyValue(amount: number | string | undefined | null, locale: string, currencySymbol: string): string {
    let cleanedAmount: number | undefined | null;
    if (typeof amount === 'string') {
        const numericString = amount.replace(/[^0-9.-]/g, '');
        cleanedAmount = Number(numericString);
    } else {
        cleanedAmount = amount;
    }

    if (cleanedAmount === undefined || cleanedAmount === null || isNaN(cleanedAmount) || !isFinite(cleanedAmount)) {
      return 'N/A';
    }

    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return `${currencySymbol}${formatter.format(cleanedAmount)}`;
    } catch (e) {
      console.error('Error formatting currency:', e, 'Raw Amount:', amount, 'Cleaned Amount:', cleanedAmount, 'Locale:', locale, 'Symbol:', currencySymbol);
      return 'Formatting Error';
    }
  }


  refresh(): void {
    this.selectedFilterStatus = 'All';
    this.vendorSearchTerm = '';
    this.selectedFilterYear = new Date().getFullYear();
    this.loadAllPurchaseOrders();
  }

  onRowClick(po: PurchaseOrder): void {
    this.selectedPOForDetails = po;
    this.showDetailsPanel = true;
  }

  closeDetailsPanel(): void {
    this.selectedPOForDetails = null;
    this.showDetailsPanel = false;
  }

  // Helper methods to get vendor and event names for display
  getVendorName(vendorId: number): string {
    const vendor = this.allVendors.find(v => v.vendorId === vendorId);
    return vendor ? `${vendorId} - ${vendor.vendorname}` : `${vendorId}`;
  }

  getEventName(eventId: number): string {
    const event = this.allEvents.find(e => e.eventId === eventId);
    return event ? `${eventId} - ${event.eventname}` : `${eventId}`;
  }

  // Navigation methods for sidebar
  navigateToDashboard(): void {
    console.log('Navigating to Dashboard...');
    this.router.navigate(['/dashboard']);
  }

  navigateToNegotiation(): void {
    console.log('Navigating to Negotiation page...');
    this.router.navigate(['/negotiate']);
  }
}
