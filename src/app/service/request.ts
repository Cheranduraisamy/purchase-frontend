import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface purchaserequests {
   prId?: number;
   eventId: number;
   vendorId: number;
   allocatedamount: number;
   prstatus: string;
   requestLocalDate?: string;
}

export interface Vendor {
    vendorId: number;
    vendorname: string;
    email?: string;          // Optional - will be available when backend is updated
    vendoremail?: string;    // Alternative field name for compatibility
    phone?: string;          // Optional - will be available when backend is updated
    vendorphone?: string;    // Alternative field name for compatibility
}

export interface Event {
    eventId: number;
    eventname: string;
}

export interface EnrichedPurchaseRequest extends purchaserequests {
    eventName?: string; // Optional, will be added dynamically
    vendorName?: string; // Optional, will be added dynamically
}

@Injectable({
  providedIn: 'root'
})
export class Request {
  baseurl="http://localhost:8080/purchaserequests"; // This is the correct base URL for all related endpoints

  constructor(private http: HttpClient) { 
  }

  createdata(purchaserequest: purchaserequests):Observable<purchaserequests[]>{
    return this.http.post<purchaserequests[]>(`${this.baseurl}/createpurchasingrequest`, purchaserequest, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  getallPurchaseRequests(): Observable<purchaserequests[]> {
    return this.http.get<purchaserequests[]>(`${this.baseurl}/getall`);
  }

  updatePurchaseStatus(id: number, status: string): Observable<purchaserequests> {
    return this.http.put<purchaserequests>(`${this.baseurl}/updatepurchasestatus/${id}/${status}`, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // CORRECTED METHODS: Now using 'this.baseurl' for vendor and event endpoints
  getAllVendors(): Observable<Vendor[]> {
    return this.http.get<Vendor[]>(`${this.baseurl}/getallvendor`);
  }

  getAllEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.baseurl}/getallevent`);
  }

  // Methods for negotiation component integration
  getPrDetails(prId: number): Observable<purchaserequests> {
    return this.http.get<purchaserequests>(`http://localhost:8080/purchaserequests/getpurchaserequestbyid/${prId}`);
  }

  initiateNegotiation(request: any): Observable<any> {
    return this.http.post<any>(`http://localhost:8080/negotiations`, request);
  }
}