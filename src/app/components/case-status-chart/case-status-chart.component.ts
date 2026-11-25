
import { ChangeDetectorRef, Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { DashboardService } from '../../service/dashboard.service';

interface CaseStatusItem {
  estado: string;
  status: string;
  cantidad: number;
  porcentaje: number;
  color: string;
  clase: string;
}

@Component({
  selector: 'app-case-status-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './case-status-chart.component.html',
  styleUrl: './case-status-chart.component.css'
})
export class CaseStatusChartComponent implements OnInit {

  // ==================================================
  // DATOS DEL GRÁFICO
  // ==================================================

  caseStatusData: CaseStatusItem[] = [
    {
      estado: 'Nuevo',
      status: 'NUEVO',
      cantidad: 0,
      porcentaje: 0,
      color: '#2563EB',
      clase: 'nuevo'
    },
    {
      estado: 'En gestión',
      status: 'EN_GESTION',
      cantidad: 0,
      porcentaje: 0,
      color: '#8B5CF6',
      clase: 'gestion'
    },
    {
      estado: 'Ilocalizado / sin respuesta',
      status: 'ILOCALIZADO',
      cantidad: 0,
      porcentaje: 0,
      color: '#F6B91A',
      clase: 'ilocalizado'
    },
    {
      estado: 'Promesas de pago',
      status: 'PROMESA_PAGO',
      cantidad: 0,
      porcentaje: 0,
      color: '#06B6D4',
      clase: 'promesa'
    },
    {
      estado: 'Prejurídico',
      status: 'PREJURIDICO',
      cantidad: 0,
      porcentaje: 0,
      color: '#EF4444',
      clase: 'prejuridico'
    },
    {
      estado: 'Cerrado',
      status: 'CERRADO',
      cantidad: 0,
      porcentaje: 0,
      color: '#B6B7B7',
      clase: 'cerrado'
    }
  ];

  // ==================================================
  // ESTADOS
  // ==================================================

  cargando = true;
  errorCarga = false;

  mostrarTooltip = false;
  estadoTooltip = '';
  porcentajeTooltip = '';
  cantidadTooltip = '';

  // ==================================================
  // CONFIGURACIÓN DE LA DONA
  // ==================================================

  readonly radio = 94;
  readonly circunferencia = 2 * Math.PI * 94;

  // Grosor del anillo
  readonly grosor = 18;

  constructor(
    private dashboardService: DashboardService,
    private changeDetectorRef: ChangeDetectorRef,
    private router: Router
  ) {}

  // ==================================================
  // INICIALIZACIÓN
  // ==================================================

  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.cargarCasosPorEstado();

    this.dashboardService.recargar$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarCasosPorEstado());
  }

  // ==================================================
  // NAVEGACIÓN A GESTIÓN DE CASOS
  // ==================================================

  irAGestionCasos(): void {
    this.router.navigate(['/gestion-casos']);
  }

  // ==================================================
  // CONSULTAR BACKEND
  // ==================================================

  cargarCasosPorEstado(): void {

    this.cargando = true;
    this.errorCarga = false;

    this.dashboardService.getCasesByStatus().subscribe({

      next: response => {

        if (!Array.isArray(response)) {
          console.error('La respuesta no es un arreglo:', response);
          this.errorCarga = true;
          this.cargando = false;
          this.changeDetectorRef.markForCheck();
          return;
        }

        const estadosActualizados = this.caseStatusData.map(estado => {
          const datoBackend = response.find(item =>
            this.coincideEstado(item.status, estado.status) ||
            this.coincideEstado(item.label, estado.status)
          );

          if (!datoBackend) {
            return { ...estado, cantidad: 0, porcentaje: 0 };
          }

          const cantidad = Number(datoBackend.count);
          const porcentaje = datoBackend.percentage == null
            ? 0
            : Number(datoBackend.percentage);

          if (!Number.isFinite(cantidad) || cantidad < 0 ||
              !Number.isFinite(porcentaje) || porcentaje < 0) {
            return null;
          }

          return {
            ...estado,
            cantidad,
            porcentaje: datoBackend.percentage == null
              ? null
              : porcentaje
          };
        });

        if (estadosActualizados.some(estado => estado === null)) {
          console.error(
            'La distribución de casos contiene conteos inválidos:',
            response
          );
          this.errorCarga = true;
          this.cargando = false;
          this.changeDetectorRef.markForCheck();
          return;
        }

        const conteosInvalidos = response.some(item =>
          !Number.isFinite(Number(item.count)) || Number(item.count) < 0
        );

        const casosSinEstadoReconocido = response
          .filter(item => !this.caseStatusData.some(estado =>
            this.coincideEstado(item.status, estado.status) ||
            this.coincideEstado(item.label, estado.status)
          ))
          .reduce((total, item) => total + Number(item.count), 0);

        if (conteosInvalidos || casosSinEstadoReconocido > 0) {
          console.error(
            'El backend devolvió conteos inválidos o estados no reconocidos:',
            response
          );
          this.errorCarga = true;
          this.cargando = false;
          this.changeDetectorRef.markForCheck();
          return;
        }

        const totalCasos = estadosActualizados.reduce(
          (total, estado) => total + (estado?.cantidad ?? 0),
          0
        );

        const estadosConDatos = estadosActualizados.filter(
          (estado): estado is NonNullable<typeof estado> => estado !== null
        );

        this.caseStatusData = estadosConDatos.map(estado => {
          return {
            ...estado,
            porcentaje: estado.porcentaje ??
              (totalCasos > 0 ? estado.cantidad / totalCasos * 100 : 0)
          };
        });

        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },

      error: error => {
        console.error('ERROR CONSULTANDO CASOS POR ESTADO:', error);
        this.errorCarga = true;
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      }

    });

  }

  // ==================================================
  // COMPARAR ESTADOS DEL BACKEND
  // ==================================================

  private coincideEstado(
    valorBackend: string | null | undefined,
    estadoEsperado: string
  ): boolean {

    const normalizado = this.normalizarEstado(valorBackend);

    const equivalencias: Record<string, string[]> = {
      NUEVO: ['NUEVO', 'NEW'],

      EN_GESTION: [
        'EN GESTION',
        'EN PROCESO',
        'IN PROGRESS',
        'IN PROGRESS CASE',
        'IN_PROGRESS',
        'INPROGRESS',
        'OPEN',
        'ABIERTO',
        'ACTIVE'
      ],

      ILOCALIZADO: [
        'ILOCALIZADO',
        'NO LOCALIZADO',
        'UNLOCATED',
        'UNREACHABLE',
        'NO RESPONSE',
        'NO RESPUESTA'
      ],

      PROMESA_PAGO: [
        'PROMESA PAGO',
        'PROMESA DE PAGO',
        'PAYMENT PROMISE',
        'PROMISE TO PAY'
      ],

      PREJURIDICO: [
        'PREJURIDICO',
        'PRELEGAL',
        'PRE LEGAL',
        'PRE JUDICIAL'
      ],

      CERRADO: [
        'CERRADO',
        'CLOSED',
        'RESOLVED',
        'RESUELTO'
      ]
    };

    return (equivalencias[estadoEsperado] || [estadoEsperado])
      .some(alias => this.normalizarEstado(alias) === normalizado);
  }

  private normalizarEstado(valor: string | null | undefined): string {

    return (valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  // ==================================================
  // TOTAL DE CASOS
  // ==================================================

  get totalCasos(): number {

    return this.caseStatusData.reduce(
      (total, item) => total + item.cantidad,
      0
    );

  }

  // ==================================================
  // FORMATO DE CANTIDADES
  // ==================================================

  formatearCantidad(valor: number): string {

    return valor.toLocaleString('es-CO');

  }

  // ==================================================
  // FORMATO DE PORCENTAJES
  // ==================================================

  formatearPorcentaje(valor: number): string {

    return `${valor.toFixed(2)}%`;

  }

  // ==================================================
  // PEDAZOS DE LA DONA
  // Solo se dibujan los estados con casos, y entre
  // un pedazo y otro queda una pequeña separación
  // (como en Figma).
  // ==================================================

  get segmentosDona(): {
    item: CaseStatusItem;
    dashArray: string;
    dashOffset: number;
    puntaRedonda: boolean;
  }[] {

    const total = this.totalCasos;
    const conCasos = this.caseStatusData.filter(item => item.cantidad > 0);

    if (total <= 0 || conCasos.length === 0) {
      return [];
    }

    // Un solo estado: anillo completo, sin separaciones
    if (conCasos.length === 1) {
      return [{
        item: conCasos[0],
        dashArray: `${this.circunferencia} 0`,
        dashOffset: 0,
        puntaRedonda: false
      }];
    }

    // La punta redonda "crece" medio grosor a cada lado,
    // así que el hueco debe ser mayor que el grosor.
    const hueco = this.grosor + 6;

    let recorrido = 0;

    return conCasos.map(item => {

      const largoTotal = this.circunferencia * item.cantidad / total;
      const largoVisible = Math.max(largoTotal - hueco, 0.01);

      const segmento = {
        item,
        dashArray: `${largoVisible} ${this.circunferencia}`,
        dashOffset: -(recorrido + hueco / 2),
        puntaRedonda: true
      };

      recorrido += largoTotal;
      return segmento;
    });
  }

  // ==================================================
  // LONGITUD DE CADA SEGMENTO
  // ==================================================

  obtenerDashArray(porcentaje: number): string {

    const longitud = this.circunferencia * porcentaje / 100;

    return `${longitud} ${this.circunferencia}`;

  }

  // ==================================================
  // POSICIÓN DE CADA SEGMENTO
  // ==================================================

  obtenerDashOffset(indice: number): number {

    const porcentajeAnterior = this.caseStatusData
      .slice(0, indice)
      .reduce(
        (total, item) => total + item.porcentaje,
        0
      );

    return -(this.circunferencia * porcentajeAnterior / 100);

  }

  // ==================================================
  // TOOLTIP
  // ==================================================

  // Posición del mouse dentro de la dona (para que la tarjeta lo siga)
  tooltipX = 0;
  tooltipY = 0;
  tooltipALaIzquierda = false;

  moverTooltip(evento: MouseEvent, contenedor: HTMLElement): void {
    const caja = contenedor.getBoundingClientRect();
    this.tooltipX = evento.clientX - caja.left;
    this.tooltipY = evento.clientY - caja.top;
    // En la mitad derecha la tarjeta sale a la izquierda, para que no se corte
    this.tooltipALaIzquierda = this.tooltipX > caja.width / 2;
  }

  mostrarInfo(
    estado: string,
    cantidad: number,
    porcentaje: number
  ): void {

    this.estadoTooltip = estado;
    this.cantidadTooltip = this.formatearCantidad(cantidad);

    this.porcentajeTooltip =
      this.formatearPorcentaje(porcentaje);

    this.mostrarTooltip = true;

  }

  // Mantiene el mismo pedazo de la dona entre redibujos.
  // Sin esto Angular lo borraba y lo volvía a crear al pasar el mouse,
  // y por eso el cuadrito se quedaba pegado.
  seguirSegmento(_indice: number, segmento: { item: CaseStatusItem }): string {
    return segmento.item.estado;
  }

  ocultarInfo(): void {

    this.mostrarTooltip = false;

  }

}
