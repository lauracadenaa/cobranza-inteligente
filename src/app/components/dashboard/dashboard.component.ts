import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CaseStatusChartComponent } from '../case-status-chart/case-status-chart.component';


// ==================================================
// COMPONENTES DEL DASHBOARD
// ==================================================

import { SidebarComponent } from '../sidedar/sidebar.component';
import { DashboardHeaderComponent } from '../dashboard-header/dashboard-header.component';
import { KpiCardsComponent } from '../kpi-cards/kpi-cards.component';
import { AgingChartComponent } from '../aging-chart/aging-chart.component';
import { SearchCaseComponent } from '../search-case/search-case.component';


// ==================================================
// SERVICIO Y MODELOS
// ==================================================

import { DashboardService } from '../../service/dashboard.service';
import { ManagedCase } from '../../models/dashboard.models';


// ==================================================
// COMPONENTE DASHBOARD
// ==================================================

@Component({
  selector: 'app-dashboard',

  standalone: true,

  imports: [
    CommonModule,

    // Componentes del Dashboard
    SidebarComponent,
    DashboardHeaderComponent,
    KpiCardsComponent,
    AgingChartComponent,
    CaseStatusChartComponent,
    SearchCaseComponent,
  ],

  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})


export class DashboardComponent implements OnInit {


  // ==================================================
  // CONTROL DEL MODAL BUSCAR CASO
  // ==================================================

  isSearchCaseOpen = false;


  // ==================================================
  // ABRIR MODAL BUSCAR CASO
  // ==================================================

  openSearchCase(): void {

    console.log('BOTÓN BUSCAR CASO FUNCIONA');

    this.isSearchCaseOpen = true;

  }


  // ==================================================
  // CERRAR MODAL BUSCAR CASO
  // ==================================================

  closeSearchCase(): void {

    this.isSearchCaseOpen = false;

  }


  // ==================================================
  // DATOS DE LOS CASOS
  // ==================================================

  cases: ManagedCase[] = [];


  // ==================================================
  // CONSTRUCTOR
  // ==================================================

  constructor(
    private dashboardService: DashboardService
  ) {}


  // ==================================================
  // INICIALIZACIÓN
  // ==================================================

  ngOnInit(): void {

    this.dashboardService.getManagedCases().subscribe(data => {

      this.cases = data;

    });

  }

}
