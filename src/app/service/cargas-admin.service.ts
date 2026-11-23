import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../core/config/api.config';

// ==================================================
// LO QUE DEVUELVE EL BACKEND (/admin/advisors)
// ==================================================

// Estado operativo de un asesor (gestor)
export type EstadoAsesorBackend = 'ACTIVE' | 'INACTIVE' | 'UNAVAILABLE';

// Carga de un asesor. La primera fila es el "Agente Temporal" (la cola de espera).
export interface CargaAsesorBackend {
  advisorId: number;
  code?: string | null;
  fullName: string;
  active: boolean;
  activeCases: number;                 // casos abiertos o en gestión
  totalAssignedHistoric?: number;
  status: EstadoAsesorBackend | null;
  maxCases: number | null;             // cupo propio (null = usa el general)
  effectiveMaxCases: number;           // cupo que se le aplica
  atCapacity: boolean;                 // ya llegó a su cupo
  quotaConfigured: boolean;            // false = no hay cupo en el sistema (sin tope)
  agenteTemporal?: boolean;            // true = fila del Agente Temporal
}

export interface CasoEnColaBackend {
  caseId: number;
  caseNumber: string | null;
  enqueuedAt: string | null;
}

export interface ColaTemporalBackend {
  items: CasoEnColaBackend[];
  total: number;
}

export interface ResultadoRebalanceoBackend {
  totalMoves: number;
  assignedFromAgenteTemporal: number;
  returnedToAgenteTemporal: number;
  pendingInAgenteTemporal: number;
  quotaConfigured: boolean;
  appliedMaxCases: number | null;
  warning?: string | null;
}

// ==================================================
// SERVICIO: DISTRIBUCIÓN DE CARGAS Y CAPACIDAD POR AGENTE
// ==================================================

@Injectable({ providedIn: 'root' })
export class CargasAdminService {

  private http = inject(HttpClient);
  private url = `${API_CONFIG.baseUrl}/admin/advisors`;

  // Carga y configuración de todos los asesores
  listarCargas(): Observable<CargaAsesorBackend[]> {
    return this.http.get<CargaAsesorBackend[]>(`${this.url}/workload`);
  }

  // Casos que esperan un asesor con cupo
  colaTemporal(limite = 50): Observable<ColaTemporalBackend> {
    const params = new HttpParams().set('limit', limite);
    return this.http.get<ColaTemporalBackend>(`${this.url}/overflow-queue`, { params });
  }

  // Cambia el estado y/o el cupo de un asesor.
  // maxCases = 0 hace que vuelva a usar la capacidad general.
  // Ojo: después de guardar, el backend redistribuye los casos automáticamente.
  configurarAsesor(id: number, datos: { status: EstadoAsesorBackend; maxCases: number }): Observable<CargaAsesorBackend> {
    return this.http.patch<CargaAsesorBackend>(`${this.url}/${id}/config`, datos);
  }

  // Recalcula la distribución de casos entre los asesores según los cupos
  redistribuir(): Observable<ResultadoRebalanceoBackend> {
    return this.http.post<ResultadoRebalanceoBackend>(`${this.url}/rebalance`, {});
  }

}
