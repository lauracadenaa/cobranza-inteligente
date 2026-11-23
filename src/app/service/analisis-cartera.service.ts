import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';

import { API_CONFIG } from '../core/config/api.config';
import {
  CarteraService,
  ClienteSegmento,
  ObligacionCartera,
  TipoRiesgo
} from './cartera.service';

// ==================================================
// DATOS PARA "ANÁLISIS DE CARTERA"
// Obligaciones reales + nombre y riesgo de cada cliente
// + recaudo por periodo.
// ==================================================

export interface ClienteResumen {
  nombre: string;
  riesgo: 'Bajo' | 'Medio' | 'Alto' | 'Crítico';
}

export interface DatosAnalisis {
  obligaciones: ObligacionCartera[];
  clientes: Map<number, ClienteResumen>;
}

const NOMBRES_RIESGO: Record<TipoRiesgo, ClienteResumen['riesgo']> = {
  BAJO: 'Bajo',
  MEDIO: 'Medio',
  ALTO: 'Alto',
  CRITICO: 'Crítico'
};

const TAMANO_PAGINA = 100;

@Injectable({ providedIn: 'root' })
export class AnalisisCarteraService {

  private readonly http = inject(HttpClient);
  private readonly carteraService = inject(CarteraService);

  // Se guarda en memoria para no pedir todo cada vez que se cambia de pestaña
  private cache?: { token: string | null; datos$: Observable<DatosAnalisis> };

  obtenerDatos(): Observable<DatosAnalisis> {

    const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null;

    if (!this.cache || this.cache.token !== token) {
      const datos$ = forkJoin({
        obligaciones: this.todasLasObligaciones(),
        clientes: this.todosLosClientes()
      }).pipe(shareReplay({ bufferSize: 1, refCount: false }));

      this.cache = { token, datos$ };
    }

    return this.cache.datos$;
  }

  // Dinero recaudado entre dos fechas (GET /analytics/recovery).
  // Si el rol no tiene permiso o falla, devuelve null.
  recaudo(desde: Date, hasta: Date): Observable<number | null> {

    const params = new HttpParams()
      .set('from', this.fechaIso(desde))
      .set('to', this.fechaIso(hasta));

    return this.http
      .get<{ totalCollected?: number }>(`${API_CONFIG.baseUrl}/analytics/recovery`, { params })
      .pipe(
        map(respuesta => Number(respuesta?.totalCollected ?? 0)),
        catchError(() => of(null))
      );
  }

  // ===== Ayudas =====

  private todasLasObligaciones(): Observable<ObligacionCartera[]> {
    return this.carteraService.getObligations(0, TAMANO_PAGINA).pipe(
      switchMap(primera => {
        const resto = Array.from({ length: Math.max((primera.totalPages ?? 1) - 1, 0) }, (_, i) =>
          this.carteraService.getObligations(i + 1, TAMANO_PAGINA)
        );
        return resto.length === 0
          ? of(primera.content ?? [])
          : forkJoin(resto).pipe(map(paginas => [
              ...(primera.content ?? []),
              ...paginas.flatMap(p => p.content ?? [])
            ]));
      })
    );
  }

  private todosLosClientes(): Observable<Map<number, ClienteResumen>> {

    const niveles: TipoRiesgo[] = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'];

    return forkJoin(niveles.map(nivel => this.clientesDeNivel(nivel).pipe(
      map(lista => lista.map(cliente => [cliente, NOMBRES_RIESGO[nivel]] as const)),
      catchError(() => of([] as (readonly [ClienteSegmento, ClienteResumen['riesgo']])[]))
    ))).pipe(
      map(grupos => {
        const mapa = new Map<number, ClienteResumen>();
        grupos.flat().forEach(([cliente, riesgo]) => {
          mapa.set(Number(cliente.id), { nombre: cliente.fullName || 'Sin nombre', riesgo });
        });
        return mapa;
      })
    );
  }

  private clientesDeNivel(nivel: TipoRiesgo): Observable<ClienteSegmento[]> {
    return this.carteraService.getClientsByRiskLevel(nivel, 0, TAMANO_PAGINA).pipe(
      switchMap(primera => {
        const resto = Array.from({ length: Math.max((primera.totalPages ?? 1) - 1, 0) }, (_, i) =>
          this.carteraService.getClientsByRiskLevel(nivel, i + 1, TAMANO_PAGINA)
        );
        return resto.length === 0
          ? of(primera.content ?? [])
          : forkJoin(resto).pipe(map(paginas => [
              ...(primera.content ?? []),
              ...paginas.flatMap(p => p.content ?? [])
            ]));
      })
    );
  }

  private fechaIso(fecha: Date): string {
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
      `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
  }
}
