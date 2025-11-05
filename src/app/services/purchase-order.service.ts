import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PurchaseOrder, Status1 } from '../models/purchase-order.model';

@Injectable({
  providedIn: 'root'
})
export class PurchaseOrderService {
  private readonly baseUrl = 'http://localhost:8080/purchase-orders';

  constructor(private readonly http: HttpClient) { }

  getAllPurchaseOrders(): Observable<PurchaseOrder[]> {
    return this.http.get<PurchaseOrder[]>(this.baseUrl);
  }

  getPurchaseOrderById(poId: number): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(`${this.baseUrl}/${poId}`);
  }

 updatePurchaseOrderStatus(poId: number, newStatus: Status1, reason: string): Observable<PurchaseOrder> {
    const requestBody = {
      newStatus: newStatus,
      reason: reason
    };
    return this.http.patch<PurchaseOrder>(`${this.baseUrl}/${poId}/status`, requestBody);
  }

  getPurchaseOrdersByYear(year: number): Observable<PurchaseOrder[]> {
    const params = new HttpParams().set('year', year.toString());
    return this.http.get<PurchaseOrder[]>(`${this.baseUrl}/by-year`, { params });
  }

}