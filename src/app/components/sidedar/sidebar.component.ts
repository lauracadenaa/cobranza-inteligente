
import { Component, HostListener, inject, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, Subject, takeUntil } from 'rxjs';
import { CaseService } from '../../service/case.service';
import { IconoComponent } from '../../shared/icono/icono.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  imports: [CommonModule, IconoComponent],
})
export class SidebarComponent implements OnDestroy {

  private router = inject(Router);
  private caseService = inject(CaseService);
  private destruir$ = new Subject<void>();

  // ==============================================
  // ESTADO DEL SIDEBAR
  // ==============================================

  // En pantallas angostas el menú empieza contraído para dejar espacio al contenido
  private static readonly ANCHO_PANTALLA_ANGOSTA = 900;
  private pantallaAngosta = this.esPantallaAngosta();
  sidebarContraido = this.pantallaAngosta;

  alternarSidebar(): void {
    this.sidebarContraido = !this.sidebarContraido;
  }

  @HostListener('window:resize')
  alCambiarTamano(): void {
    const angosta = this.esPantallaAngosta();
    // Solo cambia cuando se cruza el límite, para respetar lo que el usuario eligió
    if (angosta !== this.pantallaAngosta) {
      this.pantallaAngosta = angosta;
      this.sidebarContraido = angosta;
    }
  }

  private esPantallaAngosta(): boolean {
    return typeof window !== 'undefined' &&
      window.innerWidth < SidebarComponent.ANCHO_PANTALLA_ANGOSTA;
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

    } else if (ruta.startsWith('/motor-ia')) {

      this.opcionSeleccionada = 'Motor IA y Scoring';

    } else if (ruta.startsWith('/estrategias')) {

      this.opcionSeleccionada = 'Estrategias';

    } else if (ruta.startsWith('/links-pagos')) {

      this.opcionSeleccionada = 'Pagos y recaudos';

    } else if (ruta.startsWith('/reportes-auditoria')) {

      this.opcionSeleccionada = 'Reportes y auditoría';

    } else if (ruta.startsWith('/administracion')) {

      this.opcionSeleccionada = 'Administración';

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

      case 'Motor IA y Scoring':
        void this.router.navigateByUrl('/motor-ia');
        break;

      case 'Estrategias':
        void this.router.navigateByUrl('/estrategias');
        break;

      case 'Pagos y recaudos':
        void this.router.navigateByUrl('/links-pagos');
        break;

      case 'Reportes y auditoría':
        void this.router.navigateByUrl('/reportes-auditoria');
        break;

      case 'Administración':
        void this.router.navigateByUrl('/administracion');
        break;

      default:
        break;

    }

  }
}