// src/app/services/purchase.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Negotiation, InitiateNegotiationRequest, StatusUpdateRequest, NegotiationResponse } from '../models/negotiation.model';
import { PurchaseRequest } from '../models/pr.model';

@Injectable({
  providedIn: 'root'
})
export class PurchaseService {
  private apiUrl = 'http://localhost:8080'; // Backend URL

  constructor(private http: HttpClient) { }

  // ==================== PURCHASE REQUEST ENDPOINTS ====================

  /**
   * Get Purchase Request details by ID
   */
  getPrDetails(prId: number): Observable<PurchaseRequest> {
    return this.http.get<PurchaseRequest>(`${this.apiUrl}/purchaserequests/getpurchaserequestbyid/${prId}`);
  }

  /**
   * Update Purchase Request status
   */
  updatePrStatus(prId: number, newStatus: string): Observable<any> {
    console.log('PurchaseService.updatePrStatus called with:', { prId, newStatus });
    
    const requestBody = { 
      prstatus: newStatus
    };
    
    console.log('Updating PR status with body:', requestBody);
    
    // Try the update pattern similar to negotiations
    const updateUrl = `${this.apiUrl}/purchaserequests/${prId}/update`;
    console.log('Trying endpoint:', updateUrl);
    
    return this.http.put(updateUrl, requestBody);
  }

  /**
   * Alternative method to update PR status with different endpoints
   */
  updatePrStatusWithFallback(prId: number, newStatus: string): Observable<any> {
    console.log('Trying fallback PR status update methods...');
    
    const requestBody = { prstatus: newStatus };
    
    // List of endpoints to try in order
    const endpointsToTry = [
      `${this.apiUrl}/purchaserequests/${prId}/update`,
      `${this.apiUrl}/purchaserequests/updatestatus/${prId}`,
      `${this.apiUrl}/purchaserequests/${prId}`,
      `${this.apiUrl}/purchaserequests/${prId}/status`
    ];
    
    // Try the first endpoint
    return this.http.put(endpointsToTry[0], requestBody);
  }

  /**
   * Alternative method to update PR status - try different approaches
   */
  updatePrStatusAlternative(prId: number, newStatus: string): Observable<any> {
    // Try different possible backend endpoints and formats
    const approaches = [
      // Approach 1: Current format
      () => {
        const requestBody = { newStatus };
        return this.http.put(`${this.apiUrl}/purchaserequests/${prId}/status`, requestBody);
      },
      // Approach 2: Different field name
      () => {
        const requestBody = { status: newStatus };
        return this.http.put(`${this.apiUrl}/purchaserequests/${prId}/status`, requestBody);
      },
      // Approach 3: Query parameter
      () => {
        return this.http.put(`${this.apiUrl}/purchaserequests/${prId}/status?status=${newStatus}`, {});
      },
      // Approach 4: Different endpoint
      () => {
        const requestBody = { newStatus };
        return this.http.put(`${this.apiUrl}/purchaserequests/${prId}`, requestBody);
      }
    ];

    // Try the first approach (current one)
    return approaches[0]();
  }

  // ==================== NEGOTIATION ENDPOINTS ====================

  /**
   * ✅ Get all negotiations
   * Matches: GET /negotiations/dashboard-list
   */
  getAllNegotiations(): Observable<Negotiation[]> {
    return this.http.get<Negotiation[]>(`${this.apiUrl}/negotiations/dashboard-list`);
  }

  /**
   * ✅ Get negotiations for dashboard with filters
   * Matches: GET /negotiations/dashboard-list with query parameters
   */
  getNegotiationDashboardList(
    searchTerm?: string,
    year?: number,
    fromDate?: string,
    toDate?: string,
    status?: string
  ): Observable<Negotiation[]> {
    let params = new HttpParams();
    
    if (searchTerm) params = params.set('searchTerm', searchTerm);
    if (year) params = params.set('year', year.toString());
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);
    // Note: Backend doesn't seem to support status filter yet
    
    return this.http.get<Negotiation[]>(`${this.apiUrl}/negotiations/dashboard-list`, { params });
  }

  /**
   * ✅ Initiate a new negotiation
   * Matches: POST /negotiations
   */
  initiateNegotiation(request: InitiateNegotiationRequest): Observable<Negotiation> {
    return this.http.post<Negotiation>(`${this.apiUrl}/negotiations`, request);
  }

  /**
   * ✅ Get negotiation by Purchase Request ID
   * Matches: GET /negotiations?prId={prId}
   */
  getNegotiationForPr(prId: number): Observable<Negotiation> {
    const params = new HttpParams().set('prId', prId.toString());
    return this.http.get<Negotiation>(`${this.apiUrl}/negotiations`, { params });
  }

  /**
   * ✅ Get negotiation details by ID
   * Matches: GET /negotiations/{negotiationId}
   */
  getNegotiationDetails(negotiationId: number): Observable<Negotiation> {
    return this.http.get<Negotiation>(`${this.apiUrl}/negotiations/${negotiationId}`);
  }

  /**
   * ✅ Update negotiation status
   * Matches: PUT /negotiations/{negotiationId}/status
   */

  
  //updateNegotiationStatus(negotiationId: number, newStatus: string): Observable<Negotiation> {
    //const requestBody: StatusUpdateRequest = { newStatus };
    //return this.http.put<Negotiation>(`${this.apiUrl}/negotiations/${negotiationId}/status`, requestBody);
  
  //}







  updateNegotiationStatus(negotiation: NegotiationResponse, newStatus: string): Observable<NegotiationResponse> {
    // Construct the single request body object that matches the backend DTO
    const requestBody = {
      negotiation: negotiation, // This property name must match the DTO's field name
      newStatus: newStatus      // This property name must match the DTO's field name
    };
    // Send PUT request to /negotiations/status with this single requestBody object
    return this.http.put<NegotiationResponse>(`${this.apiUrl}/negotiations/status`, requestBody);
  }
 















  /**
   * ✅ Filter negotiations by date range
   * Matches: GET /negotiations/by-date
   */
  filterNegotiationsByDateRange(fromDate: string, toDate: string): Observable<Negotiation[]> {
    const params = new HttpParams()
      .set('fromDate', fromDate)
      .set('toDate', toDate);
    
    return this.http.get<Negotiation[]>(`${this.apiUrl}/negotiations/by-date`, { params });
  }

  /**
   * ✅ Filter negotiations by year
   * Matches: GET /negotiations/by-year/{year}
   */
  filterNegotiationsByYear(year: number): Observable<Negotiation[]> {
    return this.http.get<Negotiation[]>(`${this.apiUrl}/negotiations/by-year/${year}`);
  }

  /**
   * ✅ Generic update negotiation
   * Matches: PUT /negotiations/{negotiationId}/update
   */
  updateNegotiation(negotiationId: number, updatedData: Partial<Negotiation>): Observable<Negotiation> {
    return this.http.put<Negotiation>(`${this.apiUrl}/negotiations/${negotiationId}/update`, updatedData);
  }

  // ==================== PURCHASE ORDER ENDPOINTS ====================

  /**
   * Generate Purchase Order
   */
  generatePO(poDetails: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/pos`, poDetails);
  }
}