
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import {
  MetricCard,
  ManagedCase,
  DashboardHeader,
  AgingData
} from '../models/dashboard.models';

import { API_CONFIG } from '../core/config/api.config';

// ==================================================
// RESPUESTA DE CASOS
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

// ==================================================
// RESPUESTA DE /admin/dashboard
// ==================================================

interface AdminDashboardResponse {

  kpis: {
    totalPortfolioValue: number;
    totalObligations: number;
    activeObligations: number;
    clientsInDefault: number;
    totalClients: number;
    openCases: number;
    inProgressCases: number;
    escalatedCases: number;
    resolvedCases: number;
    totalCases: number;
    activeAdvisors: number;
    activePaymentAgreements: number;
    batchesThisMonth: number;
    totalRecordsThisMonth: number;
    criticalClientsCount: number;
  };

  agingAnalysis: {
    bucket: string;
    daysFrom: number;
    daysTo: number;
    obligationCount: number;
    totalAmount: number;
    percentageOfPortfolio: number;
  }[];

}

// ==================================================
// RESPUESTA DE /analytics/recovery
// ==================================================

interface RecoveryResponse {

  totalCollected: number;

  byChannel: Record<string, number>;

  byRiskLevel: Record<string, number>;

  topClients: {
    clientId: number;
    clientName: string;
    amountRecovered: number;
    paymentCount: number;
  }[];

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
  // TARJETAS KPI - CONEXIÓN CON BACKEND
  // ==================================================

  getKPIs(): Observable<MetricCard[]> {

    const dashboardUrl =
      `${API_CONFIG.baseUrl}/admin/dashboard`;

    const recoveryUrl =
      `${API_CONFIG.baseUrl}/analytics/recovery`;

    // Período: 1 de octubre hasta el día actual.

    const fechaActual = new Date();

    const fechaDesde = '2026-10-01T00:00:00';

    const fechaHasta =
      `${fechaActual.getFullYear()}-${String(
        fechaActual.getMonth() + 1
      ).padStart(2, '0')}-${String(
        fechaActual.getDate()
      ).padStart(2, '0')}T23:59:59`;

    const params = new HttpParams()
      .set('from', fechaDesde)
      .set('to', fechaHasta);

    // Formato de moneda colombiana.

    const formatoMoneda = (valor: number): string => {

      return '$' + new Intl.NumberFormat('es-CO', {
        maximumFractionDigits: 0
      }).format(valor);

    };

    return forkJoin({

      dashboard: this.http.get<AdminDashboardResponse>(
        dashboardUrl
      ),

      recovery: this.http.get<RecoveryResponse>(
        recoveryUrl,
        { params }
      ).pipe(

        catchError(error => {

          console.error(
            'ERROR AL CONSULTAR EL RECAUDO:',
            error
          );

          return of({
            totalCollected: 0,
            byChannel: {},
            byRiskLevel: {},
            topClients: []
          } as RecoveryResponse);

        })

      )

    }).pipe(

      map(({ dashboard, recovery }) => {

        const datosKpi = dashboard.kpis;

        // ------------------------------------------
        // 1. CARTERA TOTAL EN MORA
        // ------------------------------------------

        const carteraEnMora = (
          dashboard.agingAnalysis ?? []
        ).filter(rango => {
          const bucket = rango.bucket
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLocaleLowerCase('es-CO');

          return !['sin mora', 'no mora', 'al dia', 'current']
            .includes(bucket);
        })
          .reduce(
            (total, rango) => {
              const monto = Number(rango.totalAmount ?? 0);
              return total + (Number.isFinite(monto) ? monto : 0);
            },
            0
          );

        // ------------------------------------------
        // 2. CASOS ACTIVOS
        // ------------------------------------------

        const casosActivos =
          Number(datosKpi.openCases ?? 0) +
          Number(datosKpi.inProgressCases ?? 0);

        // ------------------------------------------
        // 3. CLIENTES CRÍTICOS
        // ------------------------------------------

        const clientesCriticos =
          Number(datosKpi.criticalClientsCount ?? 0);

        // ------------------------------------------
        // 4. RECAUDO DEL PERÍODO
        // ------------------------------------------

        const recaudo =
          Number(recovery.totalCollected ?? 0);

        // ------------------------------------------
        // 5. TASA DE RECUPERACIÓN
        // ------------------------------------------

        // El endpoint de recuperación no devuelve
        // una tasa. No inventamos un porcentaje.

        const kpis: MetricCard[] = [

          {
            title: 'Cartera total en mora',
            value: formatoMoneda(carteraEnMora),
            periodText: 'Saldo total en mora',
            status: 'info'
          },

          {
            title: 'Casos activos',
            value: new Intl.NumberFormat('es-CO').format(
              casosActivos
            ),
            periodText: 'Casos abiertos y en gestión',
            status: 'info'
          },

          {
            title: 'Clientes críticos',
            value: new Intl.NumberFormat('es-CO').format(
              clientesCriticos
            ),
            periodText: 'Clientes con riesgo crítico',
            status: 'warning'
          },

          {
            title: 'Recaudo del período',
            value: formatoMoneda(recaudo),
            periodText: 'Desde el 1 de octubre de 2026',
            status: 'success'
          },

          {
            title: 'Tasa de recuperación',
            value: 'No disponible',
            periodText: 'Pendiente de indicador del backend',
            status: 'info'
          }

        ];

        console.log(
          'KPIs RECIBIDOS DEL BACKEND:',
          kpis
        );

        return kpis;

      })

    );

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
// DISTRIBUCIÓN DE CASOS POR ESTADO
// ==================================================

getCasesByStatus(): Observable<CaseStatusResponse[]> {

  const url =
    `${API_CONFIG.baseUrl}/admin/dashboard/cases/status`;

  return this.http.get<CaseStatusResponse[]>(url).pipe(

    map(response => response ?? [])

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

// ==================================================
// RESPUESTA DE DISTRIBUCIÓN DE CASOS POR ESTADO
// ==================================================

export interface CaseStatusResponse {
  status: string;
  label: string;
  count: number;
  percentage: number;
}