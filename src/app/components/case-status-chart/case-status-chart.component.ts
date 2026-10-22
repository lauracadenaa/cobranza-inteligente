
import { Component } from '@angular/core';

@Component({
  selector: 'app-case-status-chart',
  standalone: true,
  imports: [],
  templateUrl: './case-status-chart.component.html',
  styleUrl: './case-status-chart.component.css'
})

export class CaseStatusChartComponent {

  // ==================================================
  // DATOS DE CASOS POR ESTADO
  // ==================================================

  caseStatusData = [
    { estado: 'Nuevo', cantidad: 98 },
    { estado: 'En gestión', cantidad: 542 },
    { estado: 'Ilocalizado / sin respuesta', cantidad: 210 },
    { estado: 'Promesas de pago', cantidad: 168 },
    { estado: 'Prejurídico', cantidad: 115 },
    { estado: 'Cerrado', cantidad: 54 }
  ];

  // ==================================================
  // VARIABLES DEL TOOLTIP
  // ==================================================

  mostrarTooltip = false;

  estadoTooltip = '';

  porcentajeTooltip = '';

  // ==================================================
  // MOSTRAR INFORMACIÓN AL PASAR EL CURSOR
  // ==================================================

  mostrarInfo(estado: string, porcentaje: string): void {

    this.estadoTooltip = estado;

    this.porcentajeTooltip = porcentaje;

    this.mostrarTooltip = true;

  }

  // ==================================================
  // OCULTAR INFORMACIÓN AL RETIRAR EL CURSOR
  // ==================================================

  ocultarInfo(): void {

    this.mostrarTooltip = false;

  }

}
