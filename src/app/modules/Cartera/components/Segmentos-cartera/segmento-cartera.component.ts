import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  Observable,
  forkJoin,
  of
} from 'rxjs';

import {
  finalize,
  map,
  switchMap
} from 'rxjs/operators';

import { CarteraKpisComponent } from '../cartera-kpis/cartera-kpis.component';

import {
  CarteraService,
  TipoSegmento,
  TipoRiesgo,
  ClienteSegmento,
  ObligacionCartera
} from '../../../../service/cartera.service';

// ==================================================
// INTERFAZ DE SEGMENTO
// ==================================================

interface Segmento {
  nombre: string;
  tipoBackend: TipoSegmento;
  asociados: number;
  obligaciones: number | null;
  saldoTotal: string;
  saldoTotalValor: number;
  saldoVencido: string;
  moraPromedio: number | null;
  riesgo: string;
  recuperacion: string;
  color: string;
}

// ==================================================
// COMPONENTE
// ==================================================

import { IconoComponent } from '../../../../shared/icono/icono.component';

@Component({
  selector: 'app-segmento-cartera',
  standalone: true,
  imports: [IconoComponent, 
    CommonModule,
    CarteraKpisComponent
  ],
  templateUrl: './segmento-cartera.component.html',
  styleUrl: './segmento-cartera.component.css'
})
export class SegmentoCarteraComponent implements OnInit {

  // ==================================================
  // ESTADOS
  // ==================================================

  cargando = false;
  cargandoRiesgos = false;
  cargandoObligaciones = false;

  errorCargaSegmentos = '';
  errorCargaRiesgos = '';
  errorCargaObligaciones = '';

  segmentoSeleccionado: string | null = null;

  // ==================================================
  // NIVELES DE RIESGO
  // ==================================================

  private readonly nivelesRiesgo: TipoRiesgo[] = [
    'BAJO',
    'MEDIO',
    'ALTO',
    'CRITICO'
  ];

  // ==================================================
  // SEGMENTOS
  // ==================================================

  segmentos: Segmento[] = [
    {
      nombre: 'Preventiva',
      tipoBackend: 'PREVENTIVA',
      asociados: 0,
      obligaciones: null,
      saldoTotal: '—',
      saldoTotalValor: 0,
      saldoVencido: '—',
      moraPromedio: null,
      riesgo: '—',
      recuperacion: '—',
      color: '#08739B'
    },
    {
      nombre: 'Administrativa',
      tipoBackend: 'ADMINISTRATIVA',
      asociados: 0,
      obligaciones: null,
      saldoTotal: '—',
      saldoTotalValor: 0,
      saldoVencido: '—',
      moraPromedio: null,
      riesgo: '—',
      recuperacion: '—',
      color: '#16C66A'
    },
    {
      nombre: 'Prejurídica',
      tipoBackend: 'PREJUDICIAL',
      asociados: 0,
      obligaciones: null,
      saldoTotal: '—',
      saldoTotalValor: 0,
      saldoVencido: '—',
      moraPromedio: null,
      riesgo: '—',
      recuperacion: '—',
      color: '#873CF5'
    }
  ];

  constructor(
    private carteraService: CarteraService,
    private cdr: ChangeDetectorRef
  ) {}

  // ==================================================
  // INICIALIZAR COMPONENTE
  // ==================================================

  ngOnInit(): void {
    this.cargarSegmentos();
    this.cargarRiesgosPredominantes();
    this.cargarObligacionesPorSegmento();
  }

  // ==================================================
  // CONSULTAR ASOCIADOS DE CADA SEGMENTO
  // ==================================================

  cargarSegmentos(): void {

    this.cargando = true;
    this.errorCargaSegmentos = '';

    this.cdr.markForCheck();

    let solicitudesPendientes = this.segmentos.length;

    this.segmentos.forEach(segmento => {

      this.carteraService.getClientsBySegment(
        segmento.tipoBackend,
        0,
        1
      )
      .pipe(
        finalize(() => {

          solicitudesPendientes--;

          if (solicitudesPendientes === 0) {
            this.cargando = false;
          }

          this.cdr.markForCheck();

        })
      )
      .subscribe({

        next: (respuesta) => {

          this.segmentos = this.segmentos.map(item => {

            if (item.tipoBackend === segmento.tipoBackend) {
              return {
                ...item,
                asociados: respuesta.totalElements
              };
            }

            return item;

          });

          console.log(
            `Segmento ${segmento.nombre}:`,
            respuesta.totalElements,
            'asociados'
          );

          this.cdr.markForCheck();

        },

        error: (error) => {

          console.error(
            `Error consultando el segmento ${segmento.nombre}:`,
            error
          );

          this.errorCargaSegmentos =
            'No fue posible consultar todos los segmentos.';

          this.cdr.markForCheck();

        }

      });

    });

  }

  // ==================================================
  // CONSULTAR TODOS LOS CLIENTES DE UN NIVEL DE RIESGO
  // ==================================================

  private consultarClientesPorRiesgo(
    riesgo: TipoRiesgo
  ): Observable<ClienteSegmento[]> {

    const tamanoPagina = 100;

    return this.carteraService.getClientsByRiskLevel(
      riesgo,
      0,
      tamanoPagina
    ).pipe(

      switchMap(primeraPagina => {

        const paginasRestantes = Array.from(
          {
            length: Math.max(primeraPagina.totalPages - 1, 0)
          },
          (_, indice) => indice + 1
        );

        if (paginasRestantes.length === 0) {
          return of(primeraPagina.content);
        }

        const solicitudes = paginasRestantes.map(pagina =>

          this.carteraService.getClientsByRiskLevel(
            riesgo,
            pagina,
            tamanoPagina
          )

        );

        return forkJoin(solicitudes).pipe(

          map(respuestas => {

            const clientesRestantes = respuestas.flatMap(
              respuesta => respuesta.content
            );

            return [
              ...primeraPagina.content,
              ...clientesRestantes
            ];

          })

        );

      })

    );

  }

  // ==================================================
  // CALCULAR RIESGO PREDOMINANTE POR SEGMENTO
  // ==================================================

  cargarRiesgosPredominantes(): void {

    this.cargandoRiesgos = true;
    this.errorCargaRiesgos = '';

    this.cdr.markForCheck();

    const solicitudes = this.nivelesRiesgo.map(riesgo =>
      this.consultarClientesPorRiesgo(riesgo)
    );

    forkJoin(solicitudes)
      .pipe(
        finalize(() => {

          this.cargandoRiesgos = false;

          this.cdr.markForCheck();

        })
      )
      .subscribe({

        next: (resultados) => {

          const todosLosClientes = resultados.flat();

          console.log(
            'Total de clientes consultados por riesgo:',
            todosLosClientes.length
          );

          this.segmentos = this.segmentos.map(segmento => {

            const clientesDelSegmento = todosLosClientes.filter(
              cliente => cliente.segment === segmento.tipoBackend
            );

            const conteo: Record<TipoRiesgo, number> = {
              BAJO: 0,
              MEDIO: 0,
              ALTO: 0,
              CRITICO: 0
            };

            clientesDelSegmento.forEach(cliente => {

              const riesgo = cliente.riskLevel as TipoRiesgo;

              if (Object.prototype.hasOwnProperty.call(conteo, riesgo)) {
                conteo[riesgo]++;
              }

            });

            const mayorCantidad = Math.max(
              ...Object.values(conteo)
            );

            if (clientesDelSegmento.length === 0 || mayorCantidad === 0) {
              return {
                ...segmento,
                riesgo: '—'
              };
            }

            const riesgosConMayorCantidad = Object.entries(conteo)
              .filter(([_, cantidad]) => cantidad === mayorCantidad)
              .map(([riesgo]) => riesgo as TipoRiesgo);

            if (riesgosConMayorCantidad.length > 1) {
              return {
                ...segmento,
                riesgo: 'Empate'
              };
            }

            const riesgoPredominante = riesgosConMayorCantidad[0];

            const nombresRiesgo: Record<TipoRiesgo, string> = {
              BAJO: 'Bajo',
              MEDIO: 'Medio',
              ALTO: 'Alto',
              CRITICO: 'Crítico'
            };

            console.log(
              `Riesgo de ${segmento.nombre}:`,
              conteo,
              'Predominante:',
              riesgoPredominante
            );

            return {
              ...segmento,
              riesgo: nombresRiesgo[riesgoPredominante]
            };

          });

          this.cdr.markForCheck();

        },

        error: (error) => {

          console.error(
            'Error consultando los niveles de riesgo:',
            error
          );

          this.errorCargaRiesgos =
            'No fue posible calcular el riesgo predominante.';

          this.cdr.markForCheck();

        }

      });

  }

  // ==================================================
  // CONSULTAR TODAS LAS PÁGINAS DE OBLIGACIONES
  // ==================================================

  private consultarTodasLasObligaciones():
    Observable<ObligacionCartera[]> {

    const tamanoPagina = 100;

    return this.carteraService.getObligations(
      0,
      tamanoPagina
    ).pipe(

      switchMap(primeraPagina => {

        const paginasRestantes = Array.from(
          {
            length: Math.max(primeraPagina.totalPages - 1, 0)
          },
          (_, indice) => indice + 1
        );

        if (paginasRestantes.length === 0) {
          return of(primeraPagina.content);
        }

        const solicitudes = paginasRestantes.map(pagina =>

          this.carteraService.getObligations(
            pagina,
            tamanoPagina
          )

        );

        return forkJoin(solicitudes).pipe(

          map(respuestas => {

            const obligacionesRestantes = respuestas.flatMap(
              respuesta => respuesta.content
            );

            return [
              ...primeraPagina.content,
              ...obligacionesRestantes
            ];

          })

        );

      })

    );

  }

  // ==================================================
  // FORMATEAR VALORES EN PESOS COLOMBIANOS
  // ==================================================

  // Como en Figma: en millones ($98,0M). Si es menos de un
  // millón, se muestra el valor completo sin decimales.
  private formatearMoneda(valor: number): string {

    if (Math.abs(valor) >= 1000000) {
      return '$' + (valor / 1000000).toLocaleString('es-CO', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }) + 'M';
    }

    return '$' + Math.round(valor).toLocaleString('es-CO');

  }

  // ==================================================
  // PORCENTAJE DE ASOCIADOS DE CADA SEGMENTO
  // (define el largo de cada barra de colores)
  // ==================================================

  porcentajeSegmento(segmento: Segmento): number {

    const total = this.segmentos.reduce(
      (suma, item) => suma + item.asociados,
      0
    );

    return total > 0 ? segmento.asociados / total * 100 : 0;

  }

  // ==================================================
  // CALCULAR OBLIGACIONES, SALDOS Y MORA POR SEGMENTO
  // ==================================================

  cargarObligacionesPorSegmento(): void {

    this.cargandoObligaciones = true;
    this.errorCargaObligaciones = '';

    this.cdr.markForCheck();

    this.consultarTodasLasObligaciones()
      .pipe(
        finalize(() => {

          this.cargandoObligaciones = false;

          this.cdr.markForCheck();

        })
      )
      .subscribe({

        next: (obligaciones) => {

          console.log(
            'Total de obligaciones recibidas:',
            obligaciones.length
          );

          this.segmentos = this.segmentos.map(segmento => {

            // Obligaciones del segmento actual.

            const obligacionesDelSegmento = obligaciones.filter(
              obligacion =>
                obligacion.segment === segmento.tipoBackend
            );

            // Obligaciones vencidas.

            const obligacionesVencidas = obligacionesDelSegmento.filter(
              obligacion =>
                obligacion.status?.toUpperCase() === 'PAST_DUE'
            );

            // Saldo total.

            const saldoTotal = obligacionesDelSegmento.reduce(
              (total, obligacion) =>
                total + Number(obligacion.totalBalance || 0),
              0
            );

            // Saldo vencido.

            const saldoVencido = obligacionesVencidas.reduce(
              (total, obligacion) =>
                total + Number(obligacion.totalBalance || 0),
              0
            );

            // Promedio de días de mora.

            const sumaDiasMora = obligacionesVencidas.reduce(
              (total, obligacion) =>
                total + Number(obligacion.daysPastDue || 0),
              0
            );

            const moraPromedio =
              obligacionesVencidas.length > 0
                ? sumaDiasMora / obligacionesVencidas.length
                : 0;

            console.log(
              `Obligaciones de ${segmento.nombre}:`,
              {
                obligaciones: obligacionesDelSegmento.length,
                vencidas: obligacionesVencidas.length,
                saldoTotal,
                saldoVencido,
                moraPromedio
              }
            );

            return {
              ...segmento,
              obligaciones: obligacionesDelSegmento.length,
              saldoTotal: this.formatearMoneda(saldoTotal),
              saldoTotalValor: saldoTotal,
              saldoVencido: this.formatearMoneda(saldoVencido),
              // Como en Figma: días enteros (sin decimales)
              moraPromedio: Math.round(moraPromedio)
            };

          });

          this.cdr.markForCheck();

        },

        error: (error) => {

          console.error(
            'Error consultando las obligaciones:',
            error
          );

          this.errorCargaObligaciones =
            'No fue posible consultar las obligaciones de la cartera.';

          this.cdr.markForCheck();

        }

      });

  }

  // ==================================================
  // DATOS PARA LOS KPI DE SEGMENTOS
  // ==================================================

  get datosKpisSegmentos() {

    const segmentosActivos = this.segmentos.filter(
      segmento => segmento.asociados > 0
    ).length;

    const asociadosSegmentados = this.segmentos.reduce(
      (total, segmento) => total + segmento.asociados,
      0
    );

    const segmentosConObligaciones = this.segmentos.filter(
      segmento => segmento.obligaciones !== null
    );

    const segmentoMayorSaldo = [...segmentosConObligaciones]
      .sort(
        (a, b) => b.saldoTotalValor - a.saldoTotalValor
      )[0];

    const segmentosConMora = segmentosConObligaciones.filter(
      segmento =>
        segmento.moraPromedio !== null &&
        segmento.moraPromedio > 0
    );

    const segmentoMayorMora = [...segmentosConMora]
      .sort(
        (a, b) => (b.moraPromedio ?? 0) - (a.moraPromedio ?? 0)
      )[0];

    return {
      segmentosActivos: String(segmentosActivos),

      segmentoMayorSaldo: segmentoMayorSaldo
        ? segmentoMayorSaldo.nombre
        : '—',

      segmentoMayorMora: segmentoMayorMora
        ? segmentoMayorMora.nombre
        : '—',

      asociadosSegmentados: asociadosSegmentados.toLocaleString('es-CO'),

      tasaRecuperacion: '—',

      // Línea pequeña debajo de cada tarjeta (como en Figma)
      detalles: [
        {
          porcentaje: this.segmentos.length > 0
            ? Math.round(segmentosActivos / this.segmentos.length * 100) + '%'
            : '',
          periodo: 'cobertura'
        },
        {
          porcentaje: segmentoMayorSaldo?.saldoTotalValor
            ? this.formatearMoneda(segmentoMayorSaldo.saldoTotalValor)
            : '',
          periodo: 'de saldo total'
        },
        {
          porcentaje: segmentoMayorMora?.moraPromedio
            ? Math.round(segmentoMayorMora.moraPromedio) + ' días'
            : '',
          periodo: 'promedio'
        },
        { porcentaje: '', periodo: '' },
        { porcentaje: '', periodo: '' }
      ]
    };

  }

  // ==================================================
  // VER OBLIGACIONES
  // ==================================================

  verObligaciones(segmento: Segmento): void {

    this.segmentoSeleccionado = segmento.nombre;

    this.cdr.markForCheck();

  }

}