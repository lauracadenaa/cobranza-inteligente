import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardService } from '../../service/dashboard.service';
import { AgingData } from '../../models/dashboard.models';

@Component({
  selector: 'app-aging-chart',
  standalone: true,

  imports: [
    CommonModule
  ],

  templateUrl: './aging-chart.component.html',
  styleUrl: './aging-chart.component.css'
})
export class AgingChartComponent implements OnInit {

  // ==================================================
  // DATOS DE LA CARTERA POR ANTIGÜEDAD
  // ==================================================

  agingData: AgingData[] = [];

  // ==================================================
// DATOS DE LA CARTERA POR RIESGO
// ==================================================

riskData: AgingData[] = [];

  // ==================================================
// DATOS DE LA CARTERA POR SEGMENTO
// ==================================================

segmentData: AgingData[] = [];


  // ==================================================
  // OPCIÓN ACTIVA DEL DIAGRAMA
  // ==================================================

  vistaActual: 'antiguedad' | 'segmento' | 'riesgo' = 'antiguedad';


  // ==================================================
  // MENÚ DE ASESOR
  // ==================================================

  asesorMenuAbierto = false;


  // ==================================================
  // VALOR MÁXIMO DEL GRÁFICO
  // ==================================================

  maxAgingValue = 120000000;


  // ==================================================
  // CONSTRUCTOR
  // ==================================================

  constructor(
    private dashboardService: DashboardService
  ) { }


  // ==================================================
  // INICIALIZACIÓN
  // ==================================================

 ngOnInit(): void {

  this.dashboardService.getAgingData().subscribe(data => {

    this.agingData = data;

  });

  this.dashboardService.getSegmentData().subscribe(data => {

    this.segmentData = data;

  });

  this.dashboardService.getRiskData().subscribe(data => {

    this.riskData = data;

  });

}

  // ==================================================
  // CAMBIAR VISTA DEL DIAGRAMA
  // ==================================================

  cambiarVista(
    vista: 'antiguedad' | 'segmento' | 'riesgo'
  ): void {

    this.vistaActual = vista;

  }


  // ==================================================
  // ABRIR / CERRAR MENÚ DE ASESOR
  // ==================================================

  toggleAsesorMenu(): void {

    this.asesorMenuAbierto = !this.asesorMenuAbierto;

  }


  // ==================================================
  // ALTURA DE CADA BARRA
  // ==================================================

  getBarHeight(valor: number): number {

    return (valor / this.maxAgingValue) * 100;

  }

}