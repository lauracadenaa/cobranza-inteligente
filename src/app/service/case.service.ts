
import { Injectable } from '@angular/core';

import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import {
  Observable,
  of
} from 'rxjs';

import {
  tap,
  concatMap,
  finalize,
  map,
  shareReplay,
  switchMap,
  timeout,
  toArray
} from 'rxjs/operators';
import { from } from 'rxjs';

import { API_CONFIG } from '../core/config/api.config';

// ==========================================
// RESPUESTA DEL BACKEND
// ==========================================

export interface BackendCase {
  id: number;
  caseNumber: string;

  client?: {
    id?: number;
    documentNumber?: string | null;
    fullName?: string | null;
    segment?: string | null;
    riskLevel?: string | null;
  } | null;

  obligation?: {
    id?: number;
    obligationNumber?: string | null;
    currentBalance?: number | null;
    totalBalance?: number | null;
    daysPastDue?: number | null;
    effectiveDaysPastDue?: number | null;
    segment?: string | null;
  } | null;

  assignedTo?: number | null;
  advisorId?: number | null;
  escalatedToAdvisorId?: number | null;
  contactAttempts?: number | null;
  escalatedAdvisorName?: string | null;

  // Ruta asignada por el backend
  queueCode?: string | null;
  queueName?: string | null;
  routeSkill?: string | null;
  routeProduct?: string | null;
  routeRegion?: string | null;

  // Desborde a gestión humana (la IA pasó el caso a una persona)
  escalationReason?: string | null;
  humanOverflowReasons?: string | null;
  aiEscalationCount?: number | null;

  // Carga de archivo que creó el caso (si vino de una)
  batchId?: number | null;

  status?: string;
  priority?: string;

  createdAt?: string | null;
  updatedAt?: string | null;
  resolvedAt?: string | null;
}

// ==========================================
// NOTA DE UN CASO (GET/POST /management/cases/{id}/notes)
// ==========================================

export interface NotaBackend {
  id: number;
  noteType?: 'INTERNAL' | 'CUSTOMER_VISIBLE';
  source?: 'AI' | 'HUMAN';
  content: string;
  createdBy?: number | null;
  createdAt?: string | null;
}

// Asesor (GET /admin/advisors/workload)
export interface AsesorCarga {
  advisorId: number;
  code?: string;
  fullName: string;
  active: boolean;
  activeCases: number;
  effectiveMaxCases?: number;
  atCapacity?: boolean;
  status?: string;
}

// Acuerdo / promesa de pago de un caso
export interface AcuerdoCaso {
  id: number;
  agreementType?: string;
  status?: string;
  promiseDate?: string | null;
  totalAmount?: number | null;
  createdAt?: string | null;
}

// ==========================================
// PAGINACIÓN DEL BACKEND
// ==========================================

export interface BackendPage<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// ==========================================
// SERVICIO
// ==========================================

@Injectable({
  providedIn: 'root'
})
export class CaseService {

  private readonly endpoint =
    `${API_CONFIG.baseUrl}/management/cases`;

  private casosCache: BackendCase[] | null = null;
  private casosEnCarga$: Observable<BackendCase[]> | null = null;

  constructor(private http: HttpClient) {}

  // ========================================
  // CONSULTAR UNA PÁGINA
  // ========================================

  private obtenerPagina(
    pagina: number,
    tamanio: number = 20
  ): Observable<BackendPage<BackendCase>> {

    const params = new HttpParams()
      .set('page', pagina)
      .set('size', tamanio);

    return this.http.get<BackendPage<BackendCase> | BackendCase[]>(
      this.endpoint,
      { params }
    ).pipe(
      timeout({ first: 15000 }),
      map(response => {
        if (Array.isArray(response)) {
          return {
            content: response,
            totalPages: 1,
            totalElements: response.length,
            number: pagina,
            size: tamanio,
            first: pagina === 0,
            last: true,
            empty: response.length === 0
          };
        }

        if (!response || !Array.isArray(response.content)) {
          throw new Error(
            'La respuesta de /management/cases no contiene una lista content válida.'
          );
        }

        return {
          ...response,
          totalPages: Number.isFinite(response.totalPages)
            ? response.totalPages
            : 1,
          totalElements: Number.isFinite(response.totalElements)
            ? response.totalElements
            : response.content.length
        };
      })
    );
  }

  // ========================================
  // CONSULTAR TODOS LOS CASOS
  // ========================================

  obtenerTodosLosCasos(): Observable<BackendCase[]> {
    if (this.casosCache) {
      return of(this.casosCache);
    }

    if (!this.casosEnCarga$) {
      this.casosEnCarga$ = this.obtenerPagina(0).pipe(

        switchMap(primeraPagina => {

          const totalPaginas = primeraPagina.totalPages;

          if (totalPaginas <= 1) {
            return of(primeraPagina.content);
          }

          const numerosPaginas = Array.from(
            { length: totalPaginas - 1 },
            (_, indice) => indice + 1
          );

          return from(numerosPaginas).pipe(
            concatMap(numeroPagina => this.obtenerPagina(numeroPagina)),
            toArray(),
            map(paginasRestantes => [
              ...primeraPagina.content,
              ...paginasRestantes.flatMap(pagina => pagina.content)
            ])
          );
        }),

        tap(casos => {
          this.casosCache = casos;
        }),
        finalize(() => {
          this.casosEnCarga$ = null;
        }),

        shareReplay({ bufferSize: 1, refCount: false })
      );
    }

    return this.casosEnCarga$;
  }

  invalidarCache(): void {
    this.casosCache = null;
  }

  // ========================================
  // CONSULTAR DETALLE
  // ========================================

  obtenerDetalleCaso(id: number): Observable<BackendCase> {

    return this.http.get<BackendCase>(
      `${this.endpoint}/${id}`
    );
  }

  // ========================================
  // CONSULTAR NOTAS
  // ========================================

  obtenerNotasCaso(id: number): Observable<NotaBackend[]> {

    return this.http.get<NotaBackend[]>(
      `${this.endpoint}/${id}/notes`
    );
  }

  // ========================================
  // CONSULTAR DESBORDE
  // ========================================

  // ========================================
  // NOTAS
  // ========================================

  crearNota(id: number, contenido: string): Observable<NotaBackend> {
    const params = new HttpParams()
      .set('content', contenido)
      .set('noteType', 'INTERNAL')
      .set('source', 'HUMAN');
    return this.http.post<NotaBackend>(`${this.endpoint}/${id}/notes`, null, { params });
  }

  // ========================================
  // CAMBIAR ESTADO (PUT /management/cases/{id}?status=)
  // ========================================

  cambiarEstado(id: number, estado: string): Observable<BackendCase> {
    const params = new HttpParams().set('status', estado);
    return this.http.put<BackendCase>(`${this.endpoint}/${id}`, null, { params })
      .pipe(tap(() => this.invalidarCache()));
  }

  // ========================================
  // CERRAR CASO (POST /management/cases/{id}/resolve)
  // ========================================

  cerrarCaso(id: number, tipoCierre: string, detalle: string): Observable<BackendCase> {
    let params = new HttpParams().set('resolutionType', tipoCierre);
    if (detalle.trim()) params = params.set('details', detalle.trim());
    return this.http.post<BackendCase>(`${this.endpoint}/${id}/resolve`, null, { params })
      .pipe(tap(() => this.invalidarCache()));
  }

  // ========================================
  // ESCALAR CASO (POST /management/cases/{id}/escalate)
  // ========================================

  escalarCaso(id: number, motivo: string): Observable<BackendCase> {
    const params = new HttpParams().set('reason', motivo);
    return this.http.post<BackendCase>(`${this.endpoint}/${id}/escalate`, null, { params })
      .pipe(tap(() => this.invalidarCache()));
  }

  // ========================================
  // REGISTRAR INTENTO DE CONTACTO
  // (queda en la bitácora del caso)
  // ========================================

  registrarIntento(id: number, canal: string, resultado: string): Observable<unknown> {
    const params = new HttpParams().set('channel', canal).set('result', resultado);
    return this.http.post(`${this.endpoint}/${id}/contact-attempt`, null, { params })
      .pipe(tap(() => this.invalidarCache()));
  }

  // ========================================
  // ASESORES Y REASIGNACIÓN (solo admin / supervisor)
  // ========================================

  obtenerAsesores(): Observable<AsesorCarga[]> {
    return this.http.get<AsesorCarga[]>(`${API_CONFIG.baseUrl}/admin/advisors/workload`);
  }

  reasignarCaso(id: number, asesorId: number): Observable<unknown> {
    const params = new HttpParams().set('advisorId', String(asesorId));
    return this.http.post(`${API_CONFIG.baseUrl}/admin/advisors/cases/${id}/reassign`, null, { params })
      .pipe(tap(() => this.invalidarCache()));
  }

  // ========================================
  // PROMESAS DE PAGO
  // ========================================

  crearPromesa(id: number, datos: { obligationId?: number; promiseDate: string; notes?: string }): Observable<AcuerdoCaso> {
    return this.http.post<AcuerdoCaso>(
      `${API_CONFIG.baseUrl}/collection/agreements/from-case/${id}`,
      { agreementType: 'PTP', ...datos }
    ).pipe(tap(() => this.invalidarCache()));
  }

  obtenerAcuerdosCaso(id: number): Observable<AcuerdoCaso[]> {
    return this.http.get<AcuerdoCaso[]>(`${API_CONFIG.baseUrl}/collection/agreements/case/${id}`);
  }

  obtenerEstadoDesborde(id: number): Observable<any> {

    return this.http.get(
      `${this.endpoint}/${id}/overflow-status`
    );
  }

}
