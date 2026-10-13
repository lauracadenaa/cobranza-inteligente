import { Component, OnInit } from '@angular/core';
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
    private dashboardService: DashboardService
  ) { }


  // ==================================================
  // INICIALIZACIÓN
  // ==================================================

  ngOnInit(): void {

    this.dashboardService.getKPIs().subscribe(data => {

      this.kpis = data;

    });

  }

}