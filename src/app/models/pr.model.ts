// src/app/models/pr.model.ts
export interface PurchaseRequest {
  prid: number;
  prId?: number; // Alternative property name for compatibility
  eventid: number;
  eventId?: number; // Alternative property name for compatibility
  vendorid: number;
  vendorId?: number; // Alternative property name for compatibility
  requestDate: string;
  allocatedAmount: number;
  allocatedamount?: number; // Alternative property name for compatibility
  prStatus: string;
  prstatus?: string; // Alternative property name for compatibility
  requestLocalDate?: string;
  // Add other PR fields if needed for display or logic
  // e.g., vendorDetails: { vendorName: string }, courseDetails: { courseName: string }
}