import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';

// ==================================================
// SELECTOR DE PERIODO (como en Figma)
// Botón azul "Últimos 12 meses" que abre un menú con
// opciones rápidas y un calendario para elegir un rango.
// ==================================================

export type TipoPeriodo = '30d' | '3m' | '6m' | '12m' | 'personalizado';

export interface PeriodoSeleccionado {
  tipo: TipoPeriodo;
  desde: Date;
  hasta: Date;
  etiqueta: string;
}

interface DiaCalendario {
  fecha: Date | null;
  numero: number;
  futuro: boolean;
}

interface MesCalendario {
  titulo: string;
  dias: DiaCalendario[];
}

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

@Component({
  selector: 'app-selector-periodo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './selector-periodo.component.html',
  styleUrl: './selector-periodo.component.css'
})
export class SelectorPeriodoComponent implements OnInit, AfterViewChecked {

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Input() tipoInicial: TipoPeriodo = '12m';

  // Cuántos meses hacia atrás muestra el calendario
  @Input() mesesCalendario = 12;

  @Output() cambio = new EventEmitter<PeriodoSeleccionado>();

  @ViewChild('listaMeses') listaMeses?: ElementRef<HTMLElement>;

  readonly opciones: { tipo: TipoPeriodo; texto: string }[] = [
    { tipo: '30d', texto: 'Últimos 30 días' },
    { tipo: '3m', texto: 'Últimos 3 meses' },
    { tipo: '6m', texto: 'Últimos 6 meses' },
    { tipo: '12m', texto: 'Últimos 12 meses' },
    { tipo: 'personalizado', texto: 'Personalizado' }
  ];

  abierto = false;

  // Lo que ya está aplicado (lo que dice el botón)
  aplicado!: PeriodoSeleccionado;

  // Lo marcado dentro del menú mientras está abierto
  tipoMarcado: TipoPeriodo = '12m';
  desdeTemporal: Date | null = null;
  hastaTemporal: Date | null = null;

  meses: MesCalendario[] = [];

  private bajarCalendario = false;

  ngOnInit(): void {
    this.aplicado = this.construirPeriodo(this.tipoInicial);
    this.tipoMarcado = this.tipoInicial;
    this.meses = this.armarMeses();
  }

  ngAfterViewChecked(): void {
    // Al abrir el calendario se muestra el mes actual (abajo del todo)
    if (this.bajarCalendario && this.listaMeses) {
      const lista = this.listaMeses.nativeElement;
      lista.scrollTop = lista.scrollHeight;
      this.bajarCalendario = false;
    }
  }

  // ===== Abrir / cerrar =====

  alternar(): void {
    if (this.abierto) {
      this.cerrar();
      return;
    }

    this.abierto = true;
    this.tipoMarcado = this.aplicado.tipo;
    this.desdeTemporal = this.aplicado.tipo === 'personalizado' ? this.aplicado.desde : null;
    this.hastaTemporal = this.aplicado.tipo === 'personalizado' ? this.aplicado.hasta : null;
    this.bajarCalendario = this.tipoMarcado === 'personalizado';
  }

  cerrar(): void {
    this.abierto = false;
  }

  @HostListener('document:click', ['$event'])
  clicAfuera(evento: MouseEvent): void {
    if (this.abierto && !this.elementRef.nativeElement.contains(evento.target as Node)) {
      this.cerrar();
    }
  }

  @HostListener('document:keydown.escape')
  conEscape(): void {
    this.cerrar();
  }

  // ===== Elegir una opción =====

  elegir(tipo: TipoPeriodo): void {
    this.tipoMarcado = tipo;

    if (tipo === 'personalizado') {
      this.desdeTemporal = null;
      this.hastaTemporal = null;
      this.bajarCalendario = true;
      return;
    }

    this.aplicar(this.construirPeriodo(tipo));
  }

  // Primer clic: "Desde". Segundo clic: "Hasta" (y se aplica).
  elegirDia(dia: DiaCalendario): void {
    if (!dia.fecha || dia.futuro) return;

    if (!this.desdeTemporal || this.hastaTemporal) {
      this.desdeTemporal = dia.fecha;
      this.hastaTemporal = null;
      return;
    }

    if (dia.fecha < this.desdeTemporal) {
      this.hastaTemporal = this.desdeTemporal;
      this.desdeTemporal = dia.fecha;
    } else {
      this.hastaTemporal = dia.fecha;
    }

    this.aplicar({
      tipo: 'personalizado',
      desde: this.desdeTemporal,
      hasta: this.finDelDia(this.hastaTemporal),
      etiqueta: `${this.formatoCorto(this.desdeTemporal)} - ${this.formatoCorto(this.hastaTemporal)}`
    });
  }

  private aplicar(periodo: PeriodoSeleccionado): void {
    this.aplicado = periodo;
    this.cambio.emit(periodo);
    this.cerrar();
  }

  // ===== Ayudas para la vista =====

  textoFecha(fecha: Date | null): string {
    return fecha ? this.formatoCorto(fecha) : '';
  }

  esExtremo(dia: DiaCalendario): boolean {
    if (!dia.fecha) return false;
    const t = dia.fecha.getTime();
    return t === this.desdeTemporal?.getTime() || t === this.hastaTemporal?.getTime();
  }

  enRango(dia: DiaCalendario): boolean {
    if (!dia.fecha || !this.desdeTemporal || !this.hastaTemporal) return false;
    return dia.fecha > this.desdeTemporal && dia.fecha < this.hastaTemporal;
  }

  esHoy(dia: DiaCalendario): boolean {
    if (!dia.fecha) return false;
    const hoy = this.inicioDelDia(new Date());
    return dia.fecha.getTime() === hoy.getTime();
  }

  // ===== Cálculos de fechas =====

  private construirPeriodo(tipo: TipoPeriodo): PeriodoSeleccionado {
    const hasta = this.finDelDia(new Date());
    const desde = this.inicioDelDia(new Date());

    switch (tipo) {
      case '30d': desde.setDate(desde.getDate() - 29); break;
      case '3m': desde.setMonth(desde.getMonth() - 3); break;
      case '6m': desde.setMonth(desde.getMonth() - 6); break;
      default: desde.setMonth(desde.getMonth() - 12); break;
    }

    const etiqueta = this.opciones.find(o => o.tipo === tipo)?.texto ?? 'Últimos 12 meses';
    return { tipo, desde, hasta, etiqueta };
  }

  private armarMeses(): MesCalendario[] {
    const hoy = this.inicioDelDia(new Date());
    const meses: MesCalendario[] = [];

    for (let atras = this.mesesCalendario - 1; atras >= 0; atras--) {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth() - atras, 1);
      const totalDias = new Date(primero.getFullYear(), primero.getMonth() + 1, 0).getDate();

      // La semana empieza el lunes
      const huecos = (primero.getDay() + 6) % 7;
      const dias: DiaCalendario[] = Array.from({ length: huecos }, () => ({ fecha: null, numero: 0, futuro: false }));

      for (let d = 1; d <= totalDias; d++) {
        const fecha = new Date(primero.getFullYear(), primero.getMonth(), d);
        dias.push({ fecha, numero: d, futuro: fecha > hoy });
      }

      meses.push({
        titulo: `${NOMBRES_MES[primero.getMonth()]} ${primero.getFullYear()}`,
        dias
      });
    }

    return meses;
  }

  private formatoCorto(fecha: Date): string {
    const dd = String(fecha.getDate()).padStart(2, '0');
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${fecha.getFullYear()}`;
  }

  private inicioDelDia(fecha: Date): Date {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  }

  private finDelDia(fecha: Date): Date {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59);
  }
}
