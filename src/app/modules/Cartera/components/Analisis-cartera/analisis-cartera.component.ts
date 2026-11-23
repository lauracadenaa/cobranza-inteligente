import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, forkJoin, of } from 'rxjs';

import { PeriodoSeleccionado } from '../../../../components/selector-periodo/selector-periodo.component';
import { AnalisisCarteraService, DatosAnalisis } from '../../../../service/analisis-cartera.service';
import { ObligacionCartera } from '../../../../service/cartera.service';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Rangos de mora usados en Antigüedad y Concentración
const RANGOS_MORA = [
  { rango: '0 a 30 días', corto: '0–30 días', desde: 1, hasta: 30 },
  { rango: '31 a 60 días', corto: '31–60 días', desde: 31, hasta: 60 },
  { rango: '61 a 90 días', corto: '61–90 días', desde: 61, hasta: 90 },
  { rango: '91 a 180 días', corto: '91–180 días', desde: 91, hasta: 180 },
  { rango: 'Más de 180 días', corto: 'Más de 180 días', desde: 181, hasta: Infinity }
];

const NOMBRES_SEGMENTO: Record<string, string> = {
  PREVENTIVA: 'Preventiva',
  ADMINISTRATIVA: 'Administrativa',
  PREJUDICIAL: 'Prejurídica',
  JURIDICA: 'Jurídica'
};

interface PuntoEvolucion {
  etiqueta: string;
  inicio: Date;
  fin: Date;
}

@Component({
  selector: 'app-analisis-cartera',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analisis-cartera.component.html',
  styleUrl: './analisis-cartera.component.css'
})
export class AnalisisCarteraComponent implements OnInit, OnChanges, OnDestroy {

  private readonly analisisService = inject(AnalisisCarteraService);
  private readonly cdr = inject(ChangeDetectorRef);

  // Periodo elegido con el botón azul (arriba a la derecha)
  @Input() periodo: PeriodoSeleccionado | null = null;

  tituloPeriodo = '12 meses';

  cargando = true;
  errorCarga = false;

  private datos: DatosAnalisis | null = null;
  private suscripcionEvolucion?: Subscription;

  ngOnInit(): void {
    this.analisisService.obtenerDatos().subscribe({
      next: datos => {
        this.datos = datos;
        this.cargando = false;
        this.calcularCuadros();
        this.armarEvolucion();
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Error consultando datos de análisis de cartera:', error);
        this.cargando = false;
        this.errorCarga = true;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnChanges(): void {
    if (this.datos) {
      this.armarEvolucion();
    } else {
      this.tituloPeriodo = this.textoTitulo();
    }
  }

  ngOnDestroy(): void {
    this.suscripcionEvolucion?.unsubscribe();
  }

  // =========================================
  // EVOLUCIÓN DE LA CARTERA
  // - Cartera total: saldo de las obligaciones que ya existían en esa fecha.
  // - Saldo vencido: de esas, las que ya estaban vencidas y siguen en mora.
  // - Recuperación: lo recaudado en ese periodo (dato del backend).
  // El backend no guarda fotos históricas de la cartera, por eso
  // las dos primeras líneas se reconstruyen con las fechas de cada obligación.
  // =========================================

  meses: string[] = [];
  seriesEvolucion: { nombre: string; color: string; valores: number[] }[] = [];

  // Escala del gráfico (millones de pesos)
  private maximoEje = 400;
  private readonly altoGrafico = 160;
  private readonly margenArriba = 8;

  etiquetasEje = ['400M', '300M', '200M', '100M', '0'];

  get lineasGuia(): number[] {
    return [0, 1, 2, 3, 4].map(i =>
      this.margenArriba + i * (this.altoGrafico - 2 * this.margenArriba) / 4
    );
  }

  puntosSerie(valores: number[]): string {
    const alto = this.altoGrafico - 2 * this.margenArriba;
    const paso = 630 / Math.max(1, valores.length - 1);

    return valores
      .map((valor, i) => {
        const x = i * paso;
        const y = this.margenArriba + alto - (valor / this.maximoEje) * alto;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  private armarEvolucion(): void {

    this.tituloPeriodo = this.textoTitulo();

    const puntos = this.calcularPuntos();
    this.meses = puntos.map(p => p.etiqueta);

    const obligaciones = this.datos?.obligaciones ?? [];
    const millones = (valor: number) => valor / 1_000_000;

    const cartera = puntos.map(p => millones(this.sumar(obligaciones.filter(o => this.existiaEn(o, p.fin)))));
    const vencido = puntos.map(p => millones(this.sumar(obligaciones.filter(o =>
      this.existiaEn(o, p.fin) && (o.daysPastDue ?? 0) > 0 && this.vencidaEn(o, p.fin)
    ))));

    // Primero se dibuja sin recuperación y luego se completa con el backend
    this.pintarSeries(cartera, vencido, puntos.map(() => 0));

    this.suscripcionEvolucion?.unsubscribe();
    this.suscripcionEvolucion = (puntos.length
      ? forkJoin(puntos.map(p => this.analisisService.recaudo(p.inicio, p.fin)))
      : of([] as (number | null)[])
    ).subscribe(recaudos => {
      this.pintarSeries(cartera, vencido, recaudos.map(r => millones(r ?? 0)));
      this.cdr.markForCheck();
    });
  }

  private pintarSeries(cartera: number[], vencido: number[], recuperado: number[]): void {
    this.seriesEvolucion = [
      { nombre: 'Cartera total', color: '#2563EB', valores: cartera },
      { nombre: 'Saldo vencido', color: '#EF4444', valores: vencido },
      { nombre: 'Recuperación', color: '#10B981', valores: recuperado }
    ];

    // Escala "bonita" según el valor más alto
    const maximo = Math.max(...cartera, ...vencido, ...recuperado, 0);
    const paso = this.pasoBonito(maximo / 4);
    this.maximoEje = paso * 4;
    this.etiquetasEje = [4, 3, 2, 1, 0].map(i => i === 0 ? '0' : this.formatoEje(paso * i));
  }

  // Un punto por mes (periodos largos) o por semana (hasta ~45 días)
  private calcularPuntos(): PuntoEvolucion[] {

    const hasta = this.periodo?.hasta ?? new Date();
    const mesesFijos: Record<string, number> = { '3m': 3, '6m': 6, '12m': 12 };
    const cantidadMeses = mesesFijos[this.periodo?.tipo ?? '12m'];

    const desde = cantidadMeses
      ? new Date(hasta.getFullYear(), hasta.getMonth() - (cantidadMeses - 1), 1)
      : this.periodo!.desde;

    const dias = Math.max(1, Math.round((hasta.getTime() - desde.getTime()) / 86400000));
    const puntos: PuntoEvolucion[] = [];

    if (dias <= 45) {
      const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
      while (cursor <= hasta) {
        const fin = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6, 23, 59, 59);
        puntos.push({
          etiqueta: `${cursor.getDate()} ${MESES_CORTOS[cursor.getMonth()]}`,
          inicio: new Date(cursor),
          fin: fin > hasta ? hasta : fin
        });
        cursor.setDate(cursor.getDate() + 7);
      }
      if (puntos.length < 2) {
        puntos.push({ etiqueta: `${hasta.getDate()} ${MESES_CORTOS[hasta.getMonth()]}`, inicio: hasta, fin: hasta });
      }
      return puntos;
    }

    const hoy = new Date();
    const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
    const ultimo = new Date(hasta.getFullYear(), hasta.getMonth(), 1);

    while (cursor <= ultimo) {
      const inicio = new Date(cursor);
      const fin = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
      const anio = cursor.getFullYear() !== hoy.getFullYear() && dias > 365
        ? ` ${String(cursor.getFullYear()).slice(2)}`
        : '';
      puntos.push({
        etiqueta: MESES_CORTOS[cursor.getMonth()] + anio,
        inicio,
        fin: fin > hasta ? hasta : fin
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return puntos;
  }

  private textoTitulo(): string {
    switch (this.periodo?.tipo) {
      case '30d': return '30 días';
      case '3m': return '3 meses';
      case '6m': return '6 meses';
      case 'personalizado': return 'Personalizado';
      default: return '12 meses';
    }
  }

  // =========================================
  // ANTIGÜEDAD, CONCENTRACIÓN Y TOP SALDOS
  // (saldo vencido actual de las obligaciones en mora)
  // =========================================

  antiguedad: { rango: string; valor: number; porcentaje: string; monto: string }[] = [];

  riesgos = ['Bajo', 'Medio', 'Alto', 'Crítico'];

  concentracionRiesgoMora: { rango: string; valores: string[]; niveles: number[] }[] = [];

  coloresConcentracion = ['#E0EAFF', '#A9C3FA', '#4F7FEF', '#1E4FD0', '#1E2F6B'];

  topSaldos: { asociado: string; obligacion: string; producto: string; saldo: string; mora: number; riesgo: string }[] = [];

  private calcularCuadros(): void {

    const obligaciones = this.datos?.obligaciones ?? [];
    const clientes = this.datos?.clientes ?? new Map();
    const enMora = obligaciones.filter(o => (o.daysPastDue ?? 0) > 0);
    const totalVencido = this.sumar(enMora);

    // Antigüedad de mora
    const porRango = RANGOS_MORA.map(r =>
      enMora.filter(o => o.daysPastDue >= r.desde && o.daysPastDue <= r.hasta)
    );
    const montos = porRango.map(lista => this.sumar(lista));
    const mayor = Math.max(...montos, 0);

    this.antiguedad = RANGOS_MORA.map((r, i) => ({
      rango: r.rango,
      valor: mayor > 0 ? montos[i] / mayor * 100 : 0,
      porcentaje: (totalVencido > 0 ? montos[i] / totalVencido * 100 : 0)
        .toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%',
      monto: this.formatoMillones(montos[i])
    }));

    // Concentración: rango de mora x nivel de riesgo del cliente
    const matriz = porRango.map(lista =>
      this.riesgos.map(riesgo => this.sumar(lista.filter(o => clientes.get(Number(o.clientId))?.riesgo === riesgo)))
    );
    const maximoCelda = Math.max(...matriz.flat(), 0);

    this.concentracionRiesgoMora = RANGOS_MORA.map((r, i) => ({
      rango: r.corto,
      valores: matriz[i].map(v => this.formatoMillones(v, true)),
      niveles: matriz[i].map(v => maximoCelda > 0 && v > 0 ? Math.min(4, Math.ceil(v / maximoCelda * 4)) : 0)
    }));

    // Top 5 saldos vencidos
    this.topSaldos = [...enMora]
      .sort((a, b) => Number(b.totalBalance) - Number(a.totalBalance))
      .slice(0, 5)
      .map(o => {
        const cliente = clientes.get(Number(o.clientId));
        return {
          asociado: cliente?.nombre ?? `Cliente #${o.clientId}`,
          obligacion: o.obligationNumber || `#${o.id}`,
          producto: NOMBRES_SEGMENTO[(o.segment || '').toUpperCase()] ?? (o.segment || '—'),
          saldo: this.formatoMillones(Number(o.totalBalance)),
          mora: o.daysPastDue,
          riesgo: cliente?.riesgo ?? 'Sin información'
        };
      });
  }

  colorConcentracion(nivel: number): string {
    return this.coloresConcentracion[nivel] ?? this.coloresConcentracion[0];
  }

  colorTextoConcentracion(nivel: number): string {
    return nivel === 0 || nivel === 1 ? '#1E3A8A' : '#FFFFFF';
  }

  // =========================================
  // AYUDAS
  // =========================================

  private sumar(lista: ObligacionCartera[]): number {
    return lista.reduce((total, o) => total + (Number(o.totalBalance) || 0), 0);
  }

  private existiaEn(o: ObligacionCartera, fecha: Date): boolean {
    const creada = Date.parse(o.createdAt || '');
    return !Number.isFinite(creada) || creada <= fecha.getTime();
  }

  private vencidaEn(o: ObligacionCartera, fecha: Date): boolean {
    const vence = Date.parse(o.originalDueDate || '');
    return !Number.isFinite(vence) || vence <= fecha.getTime();
  }

  // $64,6M  (o "$4 M" para las celdas de la matriz)
  private formatoMillones(valor: number, conEspacio = false): string {
    const millones = valor / 1_000_000;
    const texto = millones.toLocaleString('es-CO', {
      maximumFractionDigits: conEspacio ? 0 : 1,
      minimumFractionDigits: conEspacio ? 0 : 1
    });
    return conEspacio ? `$${texto} M` : `$${texto}M`;
  }

  private formatoEje(millones: number): string {
    return `${millones.toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`;
  }

  private pasoBonito(crudo: number): number {
    if (crudo <= 0) return 100;
    const magnitud = Math.pow(10, Math.floor(Math.log10(crudo)));
    return [1, 2, 2.5, 5, 10].map(f => f * magnitud).find(p => p >= crudo) ?? 10 * magnitud;
  }
}
