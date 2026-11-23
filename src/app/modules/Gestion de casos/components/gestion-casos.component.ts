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

  // Caso que pidieron abrir al navegar hacia acá (por ejemplo, desde el inicio)
  casoAAbrir: string | null =
    typeof history !== 'undefined' ? history.state?.casoAAbrir ?? null : null;

  actualizarCasoEnDetalle(caso: ManagedCase | null): void {
    this.casoEnDetalle = caso;
    // Ya se abrió: al volver a la cola no se debe abrir otra vez
    this.casoAAbrir = null;
    this.subirAlInicio();
  }

  cerrarDetalle(): void {
    this.casoEnDetalle = null;
    this.subirAlInicio();
  }

  // Abrir o cerrar un caso cambia toda la vista: se muestra desde arriba
  private subirAlInicio(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0 });
    }
  }
}