
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';


import {
  MetricCard,
  ManagedCase,
  DashboardHeader,
  AgingData
} from '../models/dashboard.models';

import { API_CONFIG } from '../core/config/api.config';

// ==================================================
// RESPUESTA DEL BACKEND
// ==================================================

interface CasesPageResponse {
  content: BackendCase[];
}

interface BackendCase {
  id: number;
  caseNumber?: string;
  status?: string;
  createdAt?: string;
  assignedTo?: string | number | null;
  advisorId?: number | null;

  client?: {
    fullName?: string;
    documentNumber?: string;
    riskLevel?: string;
    segment?: string | null;
  };

  obligation?: {
    obligationNumber?: string;
    daysPastDue?: number;
    totalBalance?: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  constructor(private http: HttpClient) { }

  // ==================================================
  // ESTADO DEL MOTOR IA
  // ==================================================

  private motorIAActivo = true;

  // ==================================================
  // DATOS DEL HEADER
  // ==================================================

  getDashboardHeader(): Observable<DashboardHeader> {

    const header: DashboardHeader = {
      titulo: 'Dashboard',
      descripcion:
        'Vista general del estado de cartera y gestión de cobranza',
      ultimaActualizacion: 'Actualizado hace 8 min',
      motorIAActivo: this.motorIAActivo,
      nombreUsuario: 'Jou Dou',
      rolUsuario: 'Administrador'
    };

    return of(header);
  }

  // ==================================================
  // DESACTIVAR MOTOR IA
  // ==================================================

  desactivarMotorIA(): Observable<boolean> {

    this.motorIAActivo = false;

    return of(true);
  }

  
  // ==================================================
  // CARTERA POR ANTIGÜEDAD
  // ==================================================

  getAgingData(): Observable<AgingData[]> {

    const url = `${API_CONFIG.baseUrl}/management/cases`;

    return this.http.get<CasesPageResponse>(url).pipe(

      map(response => {

        const rangos: AgingData[] = [
          { rangoMora: '0 - 30 días', valor: 0, obligaciones: 0 },
          { rangoMora: '31 - 60 días', valor: 0, obligaciones: 0 },
          { rangoMora: '61 - 90 días', valor: 0, obligaciones: 0 },
          { rangoMora: '91 - 180 días', valor: 0, obligaciones: 0 },
          { rangoMora: '> 180 días', valor: 0, obligaciones: 0 }
        ];

        (response.content ?? []).forEach(caso => {

          const dias = Number(caso.obligation?.daysPastDue ?? 0);
          const saldo = Number(caso.obligation?.totalBalance ?? 0);

          if (!Number.isFinite(dias) || !Number.isFinite(saldo)) {
            return;
          }

          let indiceRango: number;

          if (dias <= 30) {
            indiceRango = 0;
          } else if (dias <= 60) {
            indiceRango = 1;
          } else if (dias <= 90) {
            indiceRango = 2;
          } else if (dias <= 180) {
            indiceRango = 3;
          } else {
            indiceRango = 4;
          }

          rangos[indiceRango].valor += saldo;
          rangos[indiceRango].obligaciones += 1;

        });

        return rangos;

      })

    );
  }

  // ==================================================
  // CARTERA POR SEGMENTO
  // ==================================================

  getSegmentData(): Observable<AgingData[]> {

    const url = `${API_CONFIG.baseUrl}/management/cases`;

    return this.http.get<CasesPageResponse>(url).pipe(

      map(response => {

        const segmentos: AgingData[] = [
          { rangoMora: 'Preventiva', valor: 0, obligaciones: 0 },
          { rangoMora: 'Administrativa', valor: 0, obligaciones: 0 },
          { rangoMora: 'Prejudicial', valor: 0, obligaciones: 0 },
          { rangoMora: 'Jurídica', valor: 0, obligaciones: 0 }
        ];

        (response.content ?? []).forEach(caso => {

          const diasMora = Number(caso.obligation?.daysPastDue);
          const saldo = Number(caso.obligation?.totalBalance ?? 0);

          // Evitar clasificar registros sin días de mora válidos.
          if (
            !Number.isFinite(diasMora) ||
            !Number.isFinite(saldo) ||
            diasMora < 0
          ) {
            return;
          }

          let nombreSegmento: string;

          if (diasMora === 0) {
            nombreSegmento = 'Preventiva';
          } else if (diasMora <= 30) {
            nombreSegmento = 'Administrativa';
          } else if (diasMora <= 90) {
            nombreSegmento = 'Prejudicial';
          } else {
            nombreSegmento = 'Jurídica';
          }

          const segmento = segmentos.find(
            item => item.rangoMora === nombreSegmento
          );

          if (segmento) {
            segmento.valor += saldo;
            segmento.obligaciones += 1;
          }

        });

        console.log(
          'RESULTADO FINAL DE CARTERA POR SEGMENTO:',
          segmentos
        );

        return segmentos;

      })

    );
  }

  // ==================================================
  // CARTERA POR RIESGO
  // ==================================================

  getRiskData(): Observable<AgingData[]> {

    const url = `${API_CONFIG.baseUrl}/management/cases`;

    return this.http.get<CasesPageResponse>(url).pipe(

      map(response => {

        const riesgos: AgingData[] = [
          { rangoMora: 'Bajo', valor: 0, obligaciones: 0 },
          { rangoMora: 'Medio', valor: 0, obligaciones: 0 },
          { rangoMora: 'Alto', valor: 0, obligaciones: 0 },
          { rangoMora: 'Crítico', valor: 0, obligaciones: 0 }
        ];

        const normalizar = (valor?: string): string => {

          return (valor ?? '')
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();

        };

        (response.content ?? []).forEach(caso => {

          const riesgo = normalizar(caso.client?.riskLevel);
          const saldo = Number(caso.obligation?.totalBalance ?? 0);

          const encontrado = riesgos.find(item =>
            normalizar(item.rangoMora) === riesgo
          );

          if (encontrado && Number.isFinite(saldo)) {

            encontrado.valor += saldo;
            encontrado.obligaciones += 1;

          }

        });

        return riesgos;

      })

    );
  }

  // ==================================================
  // TARJETAS KPI
  // ==================================================

  getKPIs(): Observable<MetricCard[]> {

    const kpis: MetricCard[] = [

      {
        title: 'Cartera total en mora',
        value: '$326.1M',
        changePercentage: 6.6,
        periodText: 'vs mes anterior',
        status: 'info'
      },

      {
        title: 'Casos activos',
        value: '1.247',
        changePercentage: 8.6,
        periodText: 'vs ayer',
        status: 'info'
      },

      {
        title: 'Casos críticos',
        value: '87',
        changePercentage: 12,
        periodText: 'vs ayer',
        status: 'warning'
      },

      {
        title: 'Recaudo del período',
        value: '$14.519.512 COP',
        changePercentage: 18,
        periodText: 'vs mes anterior',
        status: 'success'
      },

      {
        title: 'Tasa de recuperación',
        value: '4.3%',
        changePercentage: 8.6,
        periodText: 'vs mes anterior',
        status: 'info'
      }

    ];

    return of(kpis);
  }

  // ==================================================
  // CONSULTAR CASOS
  // ==================================================

  getManagedCases(): Observable<ManagedCase[]> {

    const url = `${API_CONFIG.baseUrl}/management/cases`;

    return this.http.get<CasesPageResponse>(url).pipe(

      map(response => (response.content ?? []).map(caso => ({

        id: caso.caseNumber || String(caso.id),

        asociado: caso.client?.fullName || 'Sin información',

        documento: caso.client?.documentNumber,

        obligacion:
          caso.obligation?.obligationNumber || 'Sin información',

        saldoVencido: Number(caso.obligation?.totalBalance ?? 0),

        riesgo: this.mapRisk(caso.client?.riskLevel),

        diasMora: caso.obligation?.daysPastDue ?? 0,

        asesor: String(
          caso.assignedTo ?? caso.advisorId ?? 'Sin asignar'
        ),

        estado: caso.status || 'Sin estado',

        segmento: this.mapSegment(caso.obligation?.daysPastDue),

        fechaCreacion: caso.createdAt || '',

        tiempoLimite: 'Sin información'

      })))

    );
  }

  // ==================================================
// BUSCAR CASOS EN EL BACKEND
// ==================================================

searchManagedCases(searchText: string): Observable<ManagedCase[]> {

  const url = `${API_CONFIG.baseUrl}/management/cases/search`;

  const params = new HttpParams()
    .set('q', searchText.trim());

  return this.http.get<CasesPageResponse>(url, { params }).pipe(

    map(response => (response.content ?? []).map(caso => ({

      id: caso.caseNumber || String(caso.id),

      asociado: caso.client?.fullName || 'Sin información',

      documento: caso.client?.documentNumber,

      obligacion:
        caso.obligation?.obligationNumber || 'Sin información',

      saldoVencido: Number(caso.obligation?.totalBalance ?? 0),

      riesgo: this.mapRisk(caso.client?.riskLevel),

      diasMora: caso.obligation?.daysPastDue ?? 0,

      asesor: String(
        caso.assignedTo ?? caso.advisorId ?? 'Sin asignar'
      ),

      estado: caso.status || 'Sin estado',

      segmento: this.mapSegment(caso.obligation?.daysPastDue),

      fechaCreacion: caso.createdAt || '',

      tiempoLimite: 'Sin información'

    })))

  );
}

  // ==================================================
  // CALCULAR SEGMENTO SEGÚN DÍAS DE MORA
  // ==================================================

  private mapSegment(daysPastDue?: number): string {

    const dias = Number(daysPastDue);

    if (!Number.isFinite(dias) || dias < 0) {
      return 'Sin segmento';
    }

    if (dias === 0) {
      return 'Preventiva';
    }

    if (dias <= 30) {
      return 'Administrativa';
    }

    if (dias <= 90) {
      return 'Prejudicial';
    }

    return 'Jurídica';
  }

  // ==================================================
  // CONVERTIR NIVEL DE RIESGO
  // ==================================================

  private mapRisk(risk?: string): ManagedCase['riesgo'] {

    const riesgo = (risk ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    switch (riesgo) {

      case 'BAJO':
        return 'Bajo';

      case 'MEDIO':
        return 'Medio';

      case 'ALTO':
        return 'Alto';

      case 'CRITICO':
        return 'Crítico';

      default:
        return 'Medio';

    }
  }

}
