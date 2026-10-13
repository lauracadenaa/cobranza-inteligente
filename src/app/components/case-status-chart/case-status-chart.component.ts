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
    {
      estado: 'Nuevo',
      cantidad: 25
    },
    {
      estado: 'En gestión',
      cantidad: 35
    },
    {
      estado: 'Ilocalizado / sin respuesta',
      cantidad: 15
    },
    {
      estado: 'Promesas de pago',
      cantidad: 20
    },
    {
      estado: 'Prejurídico',
      cantidad: 10
    },
    {
      estado: 'Cerrado',
      cantidad: 30
    }
  ];

}