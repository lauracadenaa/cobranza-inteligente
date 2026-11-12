import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SidebarComponent } from '../../../components/sidedar/sidebar.component';
import { DashboardHeaderComponent } from '../../../components/dashboard-header/dashboard-header.component';

import { CasosKpisComponent } from './casos-kpis/casos-kpis.component';
import { ColaCasosComponent } from './cola-casos/cola-casos.component';
import { CasoResumenComponent } from './caso-resumen/caso-resumen.component';
import { ManagedCase } from '../../../models/dashboard.models';

@Component({
  selector: 'app-gestion-casos',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    DashboardHeaderComponent,
    CasosKpisComponent,
    ColaCasosComponent,
    CasoResumenComponent
  ],
  templateUrl: './gestion-casos.component.html',
  styleUrl: './gestion-casos.component.css'
})
export class GestionCasosComponent {
  casoEnDetalle: ManagedCase | null = null;

  actualizarCasoEnDetalle(caso: ManagedCase | null): void {
    this.casoEnDetalle = caso;
  }

  cerrarDetalle(): void {
    this.casoEnDetalle = null;
  }
}