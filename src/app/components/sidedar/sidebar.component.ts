
import { Component, inject, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, Subject, takeUntil } from 'rxjs';
import { CaseService } from '../../service/case.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  imports: [CommonModule],
})
export class SidebarComponent implements OnDestroy {

  private router = inject(Router);
  private caseService = inject(CaseService);
  private destruir$ = new Subject<void>();

  // ==============================================
  // ESTADO DEL SIDEBAR
  // ==============================================

  sidebarContraido = false;

  alternarSidebar(): void {
    this.sidebarContraido = !this.sidebarContraido;
  }

  // ==============================================
  // OPCIÓN DEL MENÚ SELECCIONADA
  // ==============================================

  opcionSeleccionada = 'Inicio';

  constructor() {

    this.actualizarOpcionSeleccionada();

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destruir$)
      )
      .subscribe(() => {
        this.actualizarOpcionSeleccionada();
      });

  }

  // ==============================================
  // DESTRUIR SUSCRIPCIÓN
  // ==============================================

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  // ==============================================
  // ACTUALIZAR OPCIÓN SEGÚN LA RUTA
  // ==============================================

  actualizarOpcionSeleccionada(): void {

    const ruta = this.router.url;

    if (ruta.startsWith('/cartera')) {

      this.opcionSeleccionada = 'Cartera';

    } else if (ruta.startsWith('/gestion-casos')) {

      this.opcionSeleccionada = 'Gestión de casos';

    } else if (ruta.startsWith('/dashboard')) {

      this.opcionSeleccionada = 'Inicio';

    }

  }

  // ==============================================
  // CAMBIAR OPCIÓN Y NAVEGAR
  // ==============================================

  seleccionarOpcion(opcion: string): void {

    this.opcionSeleccionada = opcion;

    switch (opcion) {

      case 'Inicio':
        void this.router.navigateByUrl('/dashboard');
        break;

      case 'Cartera':
        void this.router.navigateByUrl('/cartera');
        break;

      case 'Gestión de casos':
        void this.router.navigateByUrl('/gestion-casos');
        break;

      default:
        break;

    }

  }

  // ==============================================
  // MODAL CERRAR SESIÓN
  // ==============================================

  mostrarModalCerrarSesion = false;

  cerrarSesion(): void {
    this.mostrarModalCerrarSesion = true;
  }

  cancelarCerrarSesion(): void {
    this.mostrarModalCerrarSesion = false;
  }

  confirmarCerrarSesion(): void {

    this.caseService.invalidarCache();
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');

    void this.router.navigateByUrl('/login');

  }

}
