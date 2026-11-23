import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SidebarComponent } from '../../../components/sidedar/sidebar.component';
import { DashboardHeaderComponent } from '../../../components/dashboard-header/dashboard-header.component';

import { CarteraTabsComponent } from './cartera-tabs/cartera-tabs.component';
import { IntegracionCarteraComponent } from './integracion-cartera/integracion-cartera.component';
import { SegmentoCarteraComponent } from './Segmentos-cartera/segmento-cartera.component';
import { AnalisisCarteraComponent } from './Analisis-cartera/analisis-cartera.component';

import { CarteraService } from '../../../service/cartera.service';
import { PeriodoSeleccionado, SelectorPeriodoComponent } from '../../../components/selector-periodo/selector-periodo.component';

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
    AnalisisCarteraComponent,
    SelectorPeriodoComponent
  ],
  templateUrl: './cartera.component.html',
  styleUrl: './cartera.component.css'
})
export class CarteraComponent {

  private carteraService = inject(CarteraService);
  private cdr = inject(ChangeDetectorRef);

  pestanaActiva: string = 'Integración de cartera';

  // Periodo elegido en Análisis de cartera (null = últimos 12 meses)
  periodoAnalisis: PeriodoSeleccionado | null = null;

  seleccionarPestana(nombre: string): void {
    this.pestanaActiva = nombre;
  }

  tipoConsultaActiva: string = 'Asociados';

  seleccionarTipoConsulta(tipo: string): void {
    this.tipoConsultaActiva = tipo;
  }

  // ==================================================
  // SINCRONIZAR CON CORE
  // Primero se pide confirmación; luego se llama al backend.
  // ==================================================

  confirmarSincronizacionAbierta = false;
  sincronizando = false;
  mensajeSincronizacion = '';
  errorSincronizacion = false;

  pedirSincronizacion(): void {
    this.mensajeSincronizacion = '';
    this.confirmarSincronizacionAbierta = true;
  }

  cancelarSincronizacion(): void {
    this.confirmarSincronizacionAbierta = false;
  }

  sincronizarCore(): void {

    this.confirmarSincronizacionAbierta = false;
    this.sincronizando = true;

    this.carteraService.sincronizarCore().subscribe({
      next: respuesta => {
        this.sincronizando = false;
        this.errorSincronizacion = false;
        this.mensajeSincronizacion =
          respuesta?.message || 'La sincronización con CORE se inició correctamente.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.sincronizando = false;
        this.errorSincronizacion = true;
        this.mensajeSincronizacion =
          error?.error?.message || 'No fue posible iniciar la sincronización con CORE.';
        this.cdr.markForCheck();
      }
    });
  }

}
