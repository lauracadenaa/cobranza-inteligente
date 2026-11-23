import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../core/config/api.config';
import { PaymentLinkDetailDTO } from './cartera.service';

// ==================================================
// LO QUE DEVUELVE EL BACKEND
// ==================================================

// Una fila de GET /payments (un link con su estado de cobro)
export interface PagoBackend {
  paymentLinkId: number;
  token?: string | null;
  generatedUrl?: string | null;

  clientId?: number | null;
  clientName?: string | null;
  clientDocument?: string | null;

  obligationId?: number | null;
  obligationNumber?: string | null;
  amount?: number | null;
  currency?: string | null;

  originChannel?: string | null;

  // GENERATED, SENT, OPENED, USED (pagado), EXPIRED, CANCELLED
  paymentStatus?: string | null;
  paymentLinkOpened?: boolean | null;
  paymentCompleted?: boolean | null;
  amountCollected?: number | null;

  // Contexto del motor de IA
  score?: number | null;
  riskLevel?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;
}

// Respuesta paginada de Spring
export interface PaginaBackend<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// Un link de GET /v1/payments/links (es el mismo formato que devuelve generar link)
export type LinkBackend = PaymentLinkDetailDTO;

// ==================================================
// SERVICIO DE LINKS Y PAGOS
// ==================================================

@Injectable({ providedIn: 'root' })
export class PagosService {

  private http = inject(HttpClient);
  private baseUrl = API_CONFIG.baseUrl;

  // Todos los links de pago generados (con cliente, obligación y estado)
  listarLinks(): Observable<LinkBackend[]> {
    return this.http.get<LinkBackend[]>(`${this.baseUrl}/v1/payments/links`);
  }

  // Links con su estado de cobro (el backend los ordena del más reciente al más antiguo).
  // Se pide una página grande y se pagina en pantalla.
  listarPagos(estado?: string, tamano = 200): Observable<PaginaBackend<PagoBackend>> {
    let params = new HttpParams()
      .set('page', 0)
      .set('size', tamano);
    if (estado) {
      params = params.set('status', estado);
    }
    return this.http.get<PaginaBackend<PagoBackend>>(`${this.baseUrl}/payments`, { params });
  }

  // Cancela un link que todavía no se ha pagado
  cancelarLink(id: number): Observable<{ status: string; message: string }> {
    return this.http.post<{ status: string; message: string }>(
      `${this.baseUrl}/payments/${id}/cancel`, {}
    );
  }

}
