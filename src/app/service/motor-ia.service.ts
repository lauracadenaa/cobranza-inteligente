import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../core/config/api.config';

// ==================================================
// MODELO DE SCORING ACTIVO (como lo entrega el backend)
// Los pesos vienen en decimales: 0.35 = 35 %
// ==================================================

export interface ModeloScoring {
  id?: number;
  modelVersion: string;
  description?: string | null;
  weightPaymentHistory: number;
  weightDaysPastDue: number;
  weightDefaultFrequency: number;
  weightSeniority: number;
  isActive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

// ==================================================
// UMBRAL DE RIESGO (CRITICO, ALTO, MEDIO, BAJO)
// ==================================================

export interface UmbralBackend {
  id?: number | null;
  modelVersion?: string;
  riskLevel: string;
  minScore: number;
  maxScore: number;
}

export type PesosModelo = Pick<
  ModeloScoring,
  'weightPaymentHistory' | 'weightDaysPastDue' | 'weightDefaultFrequency' | 'weightSeniority'
>;

@Injectable({ providedIn: 'root' })
export class MotorIaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_CONFIG.baseUrl}/scoring/config/models`;

  obtenerModeloActivo(): Observable<ModeloScoring> {
    return this.http.get<ModeloScoring>(`${this.baseUrl}/active`);
  }

  obtenerUmbrales(version: string): Observable<UmbralBackend[]> {
    return this.http.get<UmbralBackend[]>(
      `${this.baseUrl}/${encodeURIComponent(version)}/thresholds`
    );
  }

  guardarPesos(pesos: PesosModelo): Observable<ModeloScoring> {
    return this.http.put<ModeloScoring>(`${this.baseUrl}/active/weights`, pesos);
  }

  guardarUmbrales(version: string, umbrales: UmbralBackend[]): Observable<UmbralBackend[]> {
    return this.http.put<UmbralBackend[]>(
      `${this.baseUrl}/${encodeURIComponent(version)}/thresholds`,
      umbrales
    );
  }
}
