import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { API_CONFIG } from '../core/config/api.config';

// ==================================================
// REPORTES
// ==================================================

export type TipoReporte =
  | 'AUDIT'
  | 'RECOVERED_PORTFOLIO'
  | 'UNRECOVERED_PORTFOLIO'
  | 'PAYMENT_PROPENSITY'
  | 'ESCALATED_OVER_90'
  | 'CHANNEL_EFFECTIVENESS'
  | 'PAYMENT_RECONCILIATION';

export type FormatoReporte = 'EXCEL' | 'PDF';

export interface EstadoReporte {
  jobId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  type: TipoReporte;
  format: FormatoReporte;
  fileName?: string | null;
  downloadUrl?: string | null;
  error?: string | null;
}

// ==================================================
// BITÁCORA DE AUDITORÍA
// ==================================================

export interface RegistroAuditoria {
  id: number;
  userId: number | null;
  action: string;
  description: string | null;
  timestamp: string;
}

export interface PaginaAuditoria {
  registros: RegistroAuditoria[];
  total: number;
  paginas: number;
}

export interface FiltrosAuditoria {
  texto?: string;
  accion?: string;
  usuarioId?: number | null;
  desde?: string | null; // ISO fecha-hora
  hasta?: string | null;
  pagina: number;
  tamano: number;
}

@Injectable({ providedIn: 'root' })
export class ReportesAuditoriaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = API_CONFIG.baseUrl;

  // Pide al backend que empiece a generar el reporte (responde enseguida)
  solicitarReporte(
    tipo: TipoReporte,
    formato: FormatoReporte,
    desde: string,
    hasta: string
  ): Observable<EstadoReporte> {
    return this.http.post<EstadoReporte>(`${this.baseUrl}/v1/reports`, {
      type: tipo,
      format: formato,
      from: desde,
      to: hasta
    });
  }

  // Pregunta si el reporte ya está listo
  consultarEstado(jobId: string): Observable<EstadoReporte> {
    return this.http.get<EstadoReporte>(
      `${this.baseUrl}/v1/reports/${encodeURIComponent(jobId)}/status`
    );
  }

  // Descarga el archivo terminado
  descargarReporte(jobId: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/v1/reports/${encodeURIComponent(jobId)}/download`,
      { responseType: 'blob' }
    );
  }

  // Bitácora con filtros y paginación
  obtenerBitacora(filtros: FiltrosAuditoria): Observable<PaginaAuditoria> {
    let params = new HttpParams()
      .set('page', filtros.pagina)
      .set('size', filtros.tamano)
      .set('sort', 'timestamp,desc');

    if (filtros.texto?.trim()) params = params.set('q', filtros.texto.trim());
    if (filtros.accion?.trim()) params = params.set('action', filtros.accion.trim());
    if (filtros.usuarioId != null) params = params.set('userId', filtros.usuarioId);
    if (filtros.desde) params = params.set('startDate', filtros.desde);
    if (filtros.hasta) params = params.set('endDate', filtros.hasta);

    return this.http.get<any>(`${this.baseUrl}/audit/log`, { params }).pipe(
      map(respuesta => {
        // Spring puede mandar la paginación suelta o dentro de "page"
        const info = respuesta?.page ?? respuesta ?? {};
        return {
          registros: respuesta?.content ?? [],
          total: Number(info.totalElements ?? 0),
          paginas: Number(info.totalPages ?? 0)
        };
      })
    );
  }
}
