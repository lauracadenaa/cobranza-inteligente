import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import {
  MetricCard,
  ManagedCase,
  DashboardHeader,
  AgingData
} from '../models/dashboard.models';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  constructor() { }

  // ==================================================
  // DATOS DE PRUEBA PARA EL HEADER DEL DASHBOARD
  // ==================================================

  getDashboardHeader(): Observable<DashboardHeader> {

    const header: DashboardHeader = {

      titulo: 'Dashboard',

      descripcion:
        'Vista general del estado de cartera y gestión de cobranza',

      ultimaActualizacion:
        'Actualizado hace 8 min',

      motorIAActivo: true,

      nombreUsuario: 'Jou Dou',

      rolUsuario: 'Administrador'

    };

    return of(header);
  }

// ==================================================
// DATOS DE PRUEBA PARA LA CARTERA POR ANTIGÜEDAD
// ==================================================

getAgingData(): Observable<AgingData[]> {

  const agingData: AgingData[] = [

    {
      rangoMora: '0 - 30 días',
      valor: 45000000
    },

    {
      rangoMora: '31 - 60 días',
      valor: 62000000
    },

    {
      rangoMora: '61 - 90 días',
      valor: 78000000
    },

    {
      rangoMora: '91 - 180 días',
      valor: 95000000
    },

    {
      rangoMora: '> 180 días',
      valor: 46000000
    }

  ];

  return of(agingData);
}

// ==================================================
// DATOS DE PRUEBA PARA LA CARTERA POR SEGMENTO
// ==================================================

getSegmentData(): Observable<AgingData[]> {

  const segmentData: AgingData[] = [

    {
      rangoMora: 'Preventiva',
      valor: 72000000
    },

    {
      rangoMora: 'Administrativa',
      valor: 48000000
    },

    {
      rangoMora: 'Prejurídica',
      valor: 30000000
    },

    {
      rangoMora: 'Jurídica',
      valor: 20000000
    }

  ];

  return of(segmentData);
}

// ==================================================
// DATOS DE PRUEBA PARA LA CARTERA POR RIESGO
// ==================================================

getRiskData(): Observable<AgingData[]> {

  const riskData: AgingData[] = [

    {
      rangoMora: 'Bajo',
      valor: 85000000
    },

    {
      rangoMora: 'Medio',
      valor: 45000000
    },

    {
      rangoMora: 'Alto',
      valor: 25000000
    },

    {
      rangoMora: 'Crítico',
      valor: 10000000
    }

  ];

  return of(riskData);
}

  // ==================================================
  // DATOS DE PRUEBA PARA LAS TARJETAS SUPERIORES
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
  // DATOS DE PRUEBA PARA LA TABLA DE CASOS
  // ==================================================

  getManagedCases(): Observable<ManagedCase[]> {

    const cases: ManagedCase[] = [

      {
        id: 'CAS-2024-12987',
        asociado: 'Carlos A. Muñoz',
        obligacion: 'OBL-738291',
        riesgo: 'Medio',
        diasMora: 92,
        tiempoLimite: '2h 1',
        asesor: 'Luis R.'
      },

      {
        id: 'CAS-2024-12988',
        asociado: 'Carlos A. Muñoz',
        obligacion: 'OBL-738291',
        riesgo: 'Medio',
        diasMora: 92,
        tiempoLimite: '2h 1',
        asesor: 'Luis R.'
      },

      {
        id: 'CAS-2024-12989',
        asociado: 'Carlos A. Muñoz',
        obligacion: 'OBL-738291',
        riesgo: 'Medio',
        diasMora: 92,
        tiempoLimite: '2h 1',
        asesor: 'Luis R.'
      },

      {
        id: 'CAS-2024-12990',
        asociado: 'Carlos A. Muñoz',
        obligacion: 'OBL-738291',
        riesgo: 'Medio',
        diasMora: 92,
        tiempoLimite: '2h 1',
        asesor: 'Luis R.'
      }

    ];

    return of(cases);
  }

}

