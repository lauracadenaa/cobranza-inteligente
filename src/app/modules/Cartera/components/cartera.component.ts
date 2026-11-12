
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SidebarComponent } from '../../../components/sidedar/sidebar.component';
import { DashboardHeaderComponent } from '../../../components/dashboard-header/dashboard-header.component';

import { CarteraTabsComponent } from './cartera-tabs/cartera-tabs.component';
import { IntegracionCarteraComponent } from './integracion-cartera/integracion-cartera.component';
import { SegmentoCarteraComponent } from './Segmentos-cartera/segmento-cartera.component';
import { AnalisisCarteraComponent } from './Analisis-cartera/analisis-cartera.component';

@Component({
  selector: 'app-cartera',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    DashboardHeaderComponent,
    CarteraTabsComponent,
    IntegracionCarteraComponent,
    SegmentoCarteraComponent,
    AnalisisCarteraComponent
  ],
  templateUrl: './cartera.component.html',
  styleUrl: './cartera.component.css'
})
export class CarteraComponent {

  pestanaActiva: string = 'Integración de cartera';

  seleccionarPestana(nombre: string): void {
    this.pestanaActiva = nombre;
  }

  tipoConsultaActiva: string = 'Asociados';

  seleccionarTipoConsulta(tipo: string): void {
    this.tipoConsultaActiva = tipo;
  }

}
