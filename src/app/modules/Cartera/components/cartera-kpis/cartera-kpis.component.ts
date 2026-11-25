import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Kpi {
  titulo: string;
  valor: string;
  porcentaje: string;
  periodo: string;
  imagen: string;   // nombre del ícono Lucide (en código)
  color?: string;
  alt: string;
}

import { IconoComponent } from '../../../../shared/icono/icono.component';

@Component({
  selector: 'app-cartera-kpis',
  standalone: true,
  imports: [CommonModule, IconoComponent],
  templateUrl: './cartera-kpis.component.html',
  styleUrl: './cartera-kpis.component.css'
})
export class CarteraKpisComponent {

  @Input() vista:
    'resumen' | 'asociados' | 'obligaciones' | 'segmentos' = 'resumen';

  // =========================================
  // DATOS RECIBIDOS DE SEGMENTOS
  // =========================================

  @Input() datosSegmentos: {
    segmentosActivos: string;
    segmentoMayorSaldo: string;
    segmentoMayorMora: string;
    asociadosSegmentados: string;
    tasaRecuperacion: string;
    // Línea pequeña debajo de cada valor (cajita + texto), en el mismo orden
    detalles?: { porcentaje: string; periodo: string }[];
  } = {
    segmentosActivos: '—',
    segmentoMayorSaldo: '—',
    segmentoMayorMora: '—',
    asociadosSegmentados: '—',
    tasaRecuperacion: '—'
  };

  // =========================================
  // KPI RESUMEN
  // =========================================

  kpisResumen: Kpi[] = [
    {
      titulo: 'Cartera total',
      valor: '$326.1 M',
      porcentaje: '+8.6%',
      periodo: 'vs mes anterior',
      imagen: 'wallet',
      color: '#3B82F6',
      alt: 'Cartera total'
    },
    {
      titulo: 'Asociados',
      valor: '8.672',
      porcentaje: '+8.6%',
      periodo: 'vs mes anterior',
      imagen: 'users',
      color: '#10989B',
      alt: 'Asociados'
    },
    {
      titulo: 'Nombre de cartera',
      valor: '$226.8 M',
      porcentaje: '+8.6%',
      periodo: 'vs mes anterior',
      imagen: 'layers',
      color: '#3B82F6',
      alt: 'Nombre de cartera'
    },
    {
      titulo: 'Obligaciones',
      valor: '12.531',
      porcentaje: '+8.6%',
      periodo: 'vs mes anterior',
      imagen: 'file-text',
      color: '#10B981',
      alt: 'Obligaciones'
    },
    {
      titulo: 'Días promedio de mora',
      valor: '76',
      porcentaje: '+3 días',
      periodo: 'vs mes anterior',
      imagen: 'clock',
      color: '#F59E0B',
      alt: 'Días promedio de mora'
    }
  ];

  // =========================================
  // KPI ASOCIADOS
  // =========================================

  kpisAsociados: Kpi[] = [
    {
      titulo: 'Total de asociados',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'users',
      color: '#10989B',
      alt: 'Total de asociados'
    },
    {
      titulo: 'Asociados en mora',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'clock',
      color: '#F59E0B',
      alt: 'Asociados en mora'
    },
    {
      titulo: 'Riesgo alto o crítico',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'wallet',
      color: '#3B82F6',
      alt: 'Riesgo alto o crítico'
    },
    {
      titulo: 'Asociados contactables',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'users',
      color: '#10989B',
      alt: 'Asociados contactables'
    },
    {
      titulo: 'Asociados ilocalizados',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'layers',
      color: '#3B82F6',
      alt: 'Asociados ilocalizados'
    }
  ];

  // =========================================
  // KPI OBLIGACIONES
  // =========================================

  kpisObligaciones: Kpi[] = [
    {
      titulo: 'Obligaciones activas',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'file-text',
      color: '#10B981',
      alt: 'Obligaciones activas'
    },
    {
      titulo: 'Saldo vencido',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'wallet',
      color: '#3B82F6',
      alt: 'Saldo vencido'
    },
    {
      titulo: 'Riesgo alto o crítico',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'clock',
      color: '#F59E0B',
      alt: 'Riesgo alto o crítico'
    },
    {
      titulo: 'Días promedio de mora',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'clock',
      color: '#F59E0B',
      alt: 'Días promedio de mora'
    },
    {
      titulo: 'Pagos asociados',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'users',
      color: '#10989B',
      alt: 'Pagos asociados'
    }
  ];

  // =========================================
  // KPI SEGMENTOS
  // =========================================

  kpisSegmentos: Kpi[] = [
    {
      titulo: 'Segmentos activos',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'layers',
      color: '#3B82F6',
      alt: 'Segmentos activos'
    },
    {
      titulo: 'Segmento con mayor saldo',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'trending-up',
      color: '#059669',
      alt: 'Segmento con mayor saldo'
    },
    {
      titulo: 'Segmento con mayor mora',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'triangle-alert',
      color: '#DC2626',
      alt: 'Segmento con mayor mora'
    },
    {
      titulo: 'Asociados segmentados',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'users',
      color: '#10989B',
      alt: 'Asociados segmentados'
    },
    {
      titulo: 'Tasa de recuperación',
      valor: '—',
      porcentaje: '',
      periodo: '',
      imagen: 'percent',
      color: '#15803D',
      alt: 'Tasa de recuperación'
    }
  ];

  // =========================================
  // KPI SEGÚN LA VISTA ACTIVA
  // =========================================

  get kpisActuales(): Kpi[] {

    if (this.vista === 'asociados') {
      return this.kpisAsociados;
    }

    if (this.vista === 'obligaciones') {
      return this.kpisObligaciones;
    }

    if (this.vista === 'segmentos') {

      const valores = [
        this.datosSegmentos.segmentosActivos,
        this.datosSegmentos.segmentoMayorSaldo,
        this.datosSegmentos.segmentoMayorMora,
        this.datosSegmentos.asociadosSegmentados,
        this.datosSegmentos.tasaRecuperacion
      ];

      const detalles = this.datosSegmentos.detalles ?? [];

      return this.kpisSegmentos.map((kpi, indice) => ({
        ...kpi,
        valor: valores[indice],
        porcentaje: detalles[indice]?.porcentaje ?? '',
        periodo: detalles[indice]?.periodo ?? ''
      }));

    }

    return this.kpisResumen;
  }

}