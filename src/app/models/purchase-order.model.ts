export interface PurchaseOrder {
  po_id: number;
  eventid: number;
  vendorid: number;
  negotiationid: number;
  prid: number;
  orderdate: Date | string;
  orderamountINR: number;
  orderamountdollar: number;
  po_status: Status1;
  statusChangeReason?: string;
  rejectedDateTime?: string;
}

// ✅ FIXED: Only APPROVED and REJECTED
export enum Status1 {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}