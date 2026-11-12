
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
  escalatedAdvisorName?: string | null;

  status?: string;
  priority?: string;

  createdAt?: string | null;
  updatedAt?: string | null;
  resolvedAt?: string | null;
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

  obtenerNotasCaso(id: number): Observable<unknown[]> {

    return this.http.get<unknown[]>(
      `${this.endpoint}/${id}/notes`
    );
  }

  // ========================================
  // CONSULTAR DESBORDE
  // ========================================

  obtenerEstadoDesborde(id: number): Observable<any> {

    return this.http.get(
      `${this.endpoint}/${id}/overflow-status`
    );
  }

}
