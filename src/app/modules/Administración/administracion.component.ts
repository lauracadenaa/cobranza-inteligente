import { Component } from '@angular/core';

import { SidebarComponent } from '../../components/sidedar/sidebar.component';
import { DashboardHeaderComponent } from '../../components/dashboard-header/dashboard-header.component';

import { UsuariosAdminComponent } from './Usuarios/usuarios-admin.component';
import { EstructuraArchivoComponent } from './Estructura archivo/estructura-archivo.component';
import { DistribucionCargasComponent } from './Distribucion cargas/distribucion-cargas.component';
import { CapacidadAgenteComponent } from './Capacidad agente/capacidad-agente.component';
import { TiemposAtencionComponent } from './Tiempos atencion/tiempos-atencion.component';

export type SeccionAdmin = 'usuarios' | 'distribucion' | 'capacidad' | 'tiempos' | 'estructura';

// ==================================================
// PANTALLA DE ADMINISTRACIÓN
// Conectadas al backend: Usuarios, Distribución de cargas y Capacidad por agente.
// Tiempos de atención usa datos de ejemplo (el backend no tiene algo equivalente).
// Estructura del archivo no necesita backend.
// ==================================================

@Component({
  selector: 'app-administracion',
  standalone: true,
  imports: [
    SidebarComponent,
    DashboardHeaderComponent,
    UsuariosAdminComponent,
    EstructuraArchivoComponent,
    DistribucionCargasComponent,
    CapacidadAgenteComponent,
    TiemposAtencionComponent
  ],
  templateUrl: './administracion.component.html',
  styleUrl: './administracion.component.css'
})
export class AdministracionComponent {

  // Pestaña que se está viendo
  seccionActiva: SeccionAdmin = 'usuarios';

  cambiarSeccion(seccion: SeccionAdmin): void {
    this.seccionActiva = seccion;
  }

}
