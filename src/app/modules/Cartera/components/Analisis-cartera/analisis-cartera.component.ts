
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-analisis-cartera',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analisis-cartera.component.html',
  styleUrl: './analisis-cartera.component.css'
})
export class AnalisisCarteraComponent {

  // =========================================
  // EVOLUCIÓN DE CARTERA - ÚLTIMOS 12 MESES
  // =========================================

  meses: string[] = [
    'Nov', 'Dic', 'Ene', 'Feb',
    'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct'
  ];

  puntosEvolucion = `
    0,100 57,91 114,96 171,78
    228,83 285,65 342,72 399,51
    456,57 513,38 570,44 630,25
  `.trim().replace(/\s+/g, ' ');

  // =========================================
  // ANTIGÜEDAD DE MORA
  // =========================================

  antiguedad = [
    { rango: '0 a 30 días', valor: 43, porcentaje: '19.8%', monto: '$64.6M' },
    { rango: '31 a 60 días', valor: 50, porcentaje: '21.9%', monto: '$71.4M' },
    { rango: '61 a 90 días', valor: 39, porcentaje: '18.7%', monto: '$61.0M' },
    { rango: '91 a 180 días', valor: 54, porcentaje: '22.6%', monto: '$73.8M' },
    { rango: 'Más de 180 días', valor: 36, porcentaje: '17.0%', monto: '$55.3M' }
  ];

  // =========================================
  // CONCENTRACIÓN POR RIESGO Y MORA
  // =========================================

  riesgos = ['Bajo', 'Medio', 'Alto', 'Crítico'];

  concentracionRiesgoMora = [
    { rango: '0–30 días', valores: ['$18 M', '$24 M', '$12 M', '$4 M'], niveles: [2, 2, 1, 0] },
    { rango: '31–60 días', valores: ['$10 M', '$31 M', '$28 M', '$9 M'], niveles: [1, 3, 3, 1] },
    { rango: '61–90 días', valores: ['$6 M', '$22 M', '$37 M', '$18 M'], niveles: [0, 2, 4, 2] },
    { rango: '91–180 días', valores: ['$3 M', '$14 M', '$42 M', '$31 M'], niveles: [0, 1, 4, 3] },
    { rango: 'Más de 180 días', valores: ['$1 M', '$7 M', '$26 M', '$38 M'], niveles: [0, 0, 3, 4] }
  ];

  // =========================================
  // COLORES DE LA MATRIZ DE CONCENTRACIÓN
  // =========================================

  coloresConcentracion = ['#DBEAFE', '#3B82F6', '#2563EB', '#1E3A5F', '#1E293B'];

  // =========================================
  // TOP SALDOS VENCIDOS
  // =========================================

  topSaldos = [
    {
      asociado: 'María Gómez',
      obligacion: 'OBL-44212',
      producto: 'Consumo',
      saldo: '$14.2M',
      mora: 122,
      riesgo: 'Crítico'
    },
    {
      asociado: 'Juan C. Rojas',
      obligacion: 'OBL-88125',
      producto: 'T. Crédito',
      saldo: '$9.8M',
      mora: 95,
      riesgo: 'Crítico'
    },
    {
      asociado: 'Luis A. Quiroz',
      obligacion: 'OBL-65124',
      producto: 'Consumo',
      saldo: '$7.6M',
      mora: 88,
      riesgo: 'Alto'
    },
    {
      asociado: 'Paula Fernández',
      obligacion: 'OBL-33129',
      producto: 'Vivienda',
      saldo: '$6.4M',
      mora: 76,
      riesgo: 'Alto'
    },
    {
      asociado: 'Diego Ramírez',
      obligacion: 'OBL-11520',
      producto: 'Comercial',
      saldo: '$5.9M',
      mora: 143,
      riesgo: 'Alto'
    }
  ];

  colorConcentracion(nivel: number): string {
    return this.coloresConcentracion[nivel] ?? this.coloresConcentracion[0];
  }

  colorTextoConcentracion(nivel: number): string {
    return nivel === 0 || nivel === 1 ? '#2563EB' : '#FFFFFF';
  }
}
