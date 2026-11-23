
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SidebarComponent } from '../../components/sidedar/sidebar.component';
import { DashboardHeaderComponent } from '../../components/dashboard-header/dashboard-header.component';

import { ReportesComponent } from './Reportes/reportes.component';
import { AuditoriaComponent } from './Auditoria/auditoria.component';

@Component({
  selector: 'app-reportesyauditoria',
  standalone: true,

  imports: [
    CommonModule,
    SidebarComponent,
    DashboardHeaderComponent,
    ReportesComponent,
    AuditoriaComponent
  ],

  templateUrl: './reportesyauditoria.component.html',
  styleUrl: './reportesyauditoria.component.css'
})
export class ReportesYaAuditoriaComponent {

  seccionActiva: 'reportes' | 'auditoria' = 'reportes';

  cambiarSeccion(seccion: 'reportes' | 'auditoria'): void {
    this.seccionActiva = seccion;
  }

}
