
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardService } from '../../service/dashboard.service';
import { MetricCard } from '../../models/dashboard.models';

@Component({
  selector: 'app-kpi-cards',
  standalone: true,

  imports: [
    CommonModule
  ],

  templateUrl: './kpi-cards.component.html',
  styleUrl: './kpi-cards.component.css'
})

export class KpiCardsComponent implements OnInit {

  // ==================================================
  // LISTA DE INDICADORES
  // ==================================================

  kpis: MetricCard[] = [];

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

    this.dashboardService.getKPIs().subscribe(data => {

      // Imágenes correspondientes a cada tarjeta
      const imagenes = [
        '/imagenes/Kpi-total-mora.png',
        '/imagenes/Kpi-casos-activos.png',
        '/imagenes/Kpi-casos-criticos.png',
        '/imagenes/Kpi-recaudo.png',
        '/imagenes/Kpi-tasa-recuperacion.png',
      ];

      // Recibimos los datos y asignamos las imágenes
      this.kpis = data.map((kpi, index) => ({
        ...kpi,
        image: imagenes[index] ?? ''
      }));

      this.changeDetectorRef.markForCheck();
    });

  }

}
