import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';

import { DashboardService } from '../../service/dashboard.service';
import { AgingData } from '../../models/dashboard.models';

type VistaGrafico = 'antiguedad' | 'segmento' | 'riesgo';
type MetricaGrafico = 'saldo' | 'obligaciones' | 'asociados';

import { IconoComponent } from '../../shared/icono/icono.component';

@Component({
  selector: 'app-aging-chart',
  standalone: true,
  imports: [
    CommonModule,
    IconoComponent
  ],
  templateUrl: './aging-chart.component.html',
  styleUrl: './aging-chart.component.css'
})
export class AgingChartComponent implements OnInit {

  // ==================================================
  // DATOS QUE LLEGAN DEL BACKEND
  // ==================================================

  agingData: AgingData[] = [];
  segmentData: AgingData[] = [];
  riskData: AgingData[] = [];

  // ==================================================
  // OPCIONES ELEGIDAS EN PANTALLA
  // ==================================================

  // Pestaña: antigüedad, segmento o riesgo
  vistaActual: VistaGrafico = 'antiguedad';

  // Qué se mide: plata (saldo) o cantidad de obligaciones
  metricaActual: MetricaGrafico = 'saldo';

  // Menú desplegable del selector
  asesorMenuAbierto = false;

  // Posición del mouse dentro de la barra señalada (para que la tarjeta lo siga)
  tooltipX = 0;
  tooltipY = 0;

  moverTooltip(evento: MouseEvent, contenedor: HTMLElement): void {
    const caja = contenedor.getBoundingClientRect();
    this.tooltipX = evento.clientX - caja.left;
    this.tooltipY = evento.clientY - caja.top;
  }

  // Colores por nivel de riesgo
  private readonly coloresRiesgo: Record<string, string> = {
    'Bajo': '#22C55E',
    'Medio': '#EAB308',
    'Alto': '#F97316',
    'Crítico': '#EF4444'
  };

  constructor(
    private dashboardService: DashboardService,
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {

    this.cargar();

    this.dashboardService.recargar$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargar());

  }

  private cargar(): void {

    this.dashboardService.getAgingData().subscribe(data => {
      this.agingData = data;
      this.changeDetectorRef.markForCheck();
    });

    this.dashboardService.getSegmentData().subscribe(data => {
      this.segmentData = data;
      this.changeDetectorRef.markForCheck();
    });

    this.dashboardService.getRiskData().subscribe(data => {
      this.riskData = data;
      this.changeDetectorRef.markForCheck();
    });

  }

  // ==================================================
  // DATOS DE LA PESTAÑA ACTIVA
  // ==================================================

  get segmentDataFiltrada(): AgingData[] {
    return this.segmentData.filter(dato =>
      dato.rangoMora
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toLowerCase() !== 'juridica'
    );
  }

  get datosActuales(): AgingData[] {
    if (this.vistaActual === 'segmento') {
      return this.segmentDataFiltrada;
    }
    if (this.vistaActual === 'riesgo') {
      return this.riskData;
    }
    return this.agingData;
  }

  // ==================================================
  // ESCALA DEL GRÁFICO
  // El tope se redondea a un número "bonito"
  // (ej. 120M, 40M, 2.000) para que el eje se lea fácil.
  // ==================================================

  get maxAgingValue(): number {

    const maximo = Math.max(
      ...this.datosActuales.map(dato => this.medir(dato)),
      0
    );

    if (maximo <= 0) {
      return this.metricaActual === 'saldo' ? 4000000 : 4;
    }

    const pasoCrudo = maximo / 4;
    const magnitud = Math.pow(10, Math.floor(Math.log10(pasoCrudo)));
    const pasoBonito = [1, 2, 2.5, 3, 5, 10]
      .map(factor => factor * magnitud)
      .find(paso => paso >= pasoCrudo) ?? 10 * magnitud;

    return pasoBonito * 4;
  }

  // ==================================================
  // ACCIONES
  // ==================================================

  cambiarVista(vista: VistaGrafico): void {
    this.vistaActual = vista;
  }

  cambiarMetrica(metrica: MetricaGrafico): void {
    this.metricaActual = metrica;
    this.asesorMenuAbierto = false;
  }

  toggleAsesorMenu(): void {
    this.asesorMenuAbierto = !this.asesorMenuAbierto;
  }

  // ==================================================
  // AYUDAS PARA DIBUJAR
  // ==================================================

  getBarHeight(dato: AgingData): number {
    return (this.medir(dato) / this.maxAgingValue) * 100;
  }

  getColorBarra(dato: AgingData): string {
    if (this.vistaActual === 'antiguedad') {
      return '#2563EB';
    }
    return this.coloresRiesgo[dato.rangoMora] ?? '#2563EB';
  }

  getValorEtiqueta(dato: AgingData): string {
    return this.metricaActual === 'saldo'
      ? this.getFormattedValue(dato.valor)
      : this.medir(dato).toLocaleString('es-CO');
  }

  getAxisLabel(posicion: number): string {
    const valor = this.maxAgingValue * posicion / 4;

    if (valor === 0) {
      return this.metricaActual === 'saldo' ? '$0' : '0';
    }

    return this.metricaActual === 'saldo'
      ? this.getFormattedValue(valor)
      : valor.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  }

  // Formato en millones: $52,4M
  getFormattedValue(valor: number): string {
    return '$' + (valor / 1000000).toLocaleString('es-CO', {
      maximumFractionDigits: 1
    }) + 'M';
  }

  // Texto del botón según lo que se esté midiendo
  get nombreMetrica(): string {
    const nombres: Record<MetricaGrafico, string> = {
      saldo: 'Saldo vencido',
      obligaciones: 'Obligaciones',
      asociados: 'Asociados'
    };
    return nombres[this.metricaActual];
  }

  private medir(dato: AgingData): number {
    if (this.metricaActual === 'saldo') return dato.valor;
    if (this.metricaActual === 'asociados') return dato.asociados ?? 0;
    return dato.obligaciones;
  }

}
