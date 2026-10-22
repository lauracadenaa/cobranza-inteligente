import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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

// Máximo dinámico según los datos recibidos del backend
get maxAgingValue(): number {

  let datosActuales: AgingData[] = [];

  if (this.vistaActual === 'antiguedad') {
    datosActuales = this.agingData;
  } else if (this.vistaActual === 'segmento') {
    datosActuales = this.segmentData;
  } else {
    datosActuales = this.riskData;
  }

  const maximo = Math.max(
    ...datosActuales.map(dato => dato.valor),
    0
  );

  return Math.max(
    Math.ceil(maximo / 4000000) * 4000000,
    4000000
  );

}

  // ==================================================
  // CONSTRUCTOR
  // ==================================================

  constructor(
    private dashboardService: DashboardService,
    private changeDetectorRef: ChangeDetectorRef
  ) { }


  // ==================================================
  // INICIALIZACIÓN
  // ==================================================

 ngOnInit(): void {

  // CARTERA POR ANTIGÜEDAD
  this.dashboardService.getAgingData().subscribe(data => {

    this.agingData = data;

    console.log('Cartera por antigüedad:', data);

    this.changeDetectorRef.markForCheck();

  });

  // CARTERA POR SEGMENTO
  this.dashboardService.getSegmentData().subscribe(data => {

    this.segmentData = data;

    console.log('Cartera por segmento:', data);

    this.changeDetectorRef.markForCheck();

  });

  // CARTERA POR RIESGO
  this.dashboardService.getRiskData().subscribe(data => {

    this.riskData = data;

    console.log('Cartera por riesgo:', data);

    this.changeDetectorRef.markForCheck();

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

  // ==================================================
// FORMATO DE VALORES EN MILLONES
// ==================================================

getFormattedValue(valor: number): string {

  return '$' + (valor / 1000000).toLocaleString('es-CO', {
    maximumFractionDigits: 1
  }) + 'M';

}

// ==================================================
// ETIQUETAS DINÁMICAS DEL EJE VERTICAL
// ==================================================

getAxisLabel(posicion: number): string {

  const valor = this.maxAgingValue * posicion / 4;

  return this.getFormattedValue(valor);

}

}
