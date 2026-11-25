import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

// ==================================================
// TIEMPOS DE ATENCIÓN
// Solo diseño: los valores son de ejemplo y NO se guardan en el backend.
// ==================================================

type Unidad = 'minutos' | 'horas' | 'dias';

interface Tiempo {
  valor: number;
  unidad: Unidad;
}

interface TiempoPrioridad {
  prioridad: string;
  color: string;
  sinAsignar: Tiempo;
  primeraGestion: Tiempo;
  advertencia: number;
}

const MINUTOS: Record<Unidad, number> = { minutos: 1, horas: 60, dias: 1440 };

const VALORES_INICIALES: TiempoPrioridad[] = [
  { prioridad: 'Baja', color: '#10B981', sinAsignar: { valor: 4, unidad: 'horas' }, primeraGestion: { valor: 8, unidad: 'horas' }, advertencia: 75 },
  { prioridad: 'Media', color: '#F59E0B', sinAsignar: { valor: 4, unidad: 'horas' }, primeraGestion: { valor: 8, unidad: 'horas' }, advertencia: 75 },
  { prioridad: 'Alta', color: '#F97316', sinAsignar: { valor: 1, unidad: 'horas' }, primeraGestion: { valor: 4, unidad: 'horas' }, advertencia: 75 },
  { prioridad: 'Crítica', color: '#991B1B', sinAsignar: { valor: 15, unidad: 'minutos' }, primeraGestion: { valor: 1, unidad: 'horas' }, advertencia: 50 }
];

import { IconoComponent } from '../../../shared/icono/icono.component';

@Component({
  selector: 'app-tiempos-atencion',
  standalone: true,
  imports: [IconoComponent, FormsModule],
  templateUrl: './tiempos-atencion.component.html',
  styleUrls: ['../admin-comun.css', './tiempos-atencion.component.css']
})
export class TiemposAtencionComponent implements OnDestroy {

  readonly unidades: { valor: Unidad; texto: string }[] = [
    { valor: 'minutos', texto: 'minutos' },
    { valor: 'horas', texto: 'horas' },
    { valor: 'dias', texto: 'días' }
  ];

  readonly estados = [
    { titulo: 'Dentro del tiempo', texto: 'El tiempo transcurrido aún no alcanza el umbral de advertencia', icono: 'check', tono: 'verde' },
    { titulo: 'Próximo a vencer', texto: 'Desde el umbral hasta el tiempo máximo', icono: 'clock', tono: 'amarillo' },
    { titulo: 'Vencido', texto: 'Al superar el tiempo máximo', icono: 'circle-alert', tono: 'rojo' }
  ];

  tiempos: TiempoPrioridad[] = this.copiar(VALORES_INICIALES);
  private guardado = JSON.stringify(VALORES_INICIALES);

  mensaje = '';
  private temporizador?: ReturnType<typeof setTimeout>;

  // ===== Validaciones =====

  valorValido(tiempo: Tiempo): boolean {
    return Number.isFinite(tiempo.valor) && tiempo.valor >= 0;
  }

  // La primera gestión debe ser mayor o igual al tiempo sin asignar
  ordenValido(fila: TiempoPrioridad): boolean {
    return this.enMinutos(fila.primeraGestion) >= this.enMinutos(fila.sinAsignar);
  }

  advertenciaValida(fila: TiempoPrioridad): boolean {
    return Number.isInteger(fila.advertencia) && fila.advertencia >= 1 && fila.advertencia <= 99;
  }

  filaValida(fila: TiempoPrioridad): boolean {
    return this.valorValido(fila.sinAsignar) &&
      this.valorValido(fila.primeraGestion) &&
      this.ordenValido(fila) &&
      this.advertenciaValida(fila);
  }

  get todoValido(): boolean {
    return this.tiempos.every(f => this.filaValida(f));
  }

  get hayCambios(): boolean {
    return JSON.stringify(this.tiempos) !== this.guardado;
  }

  // ===== Acciones =====

  descartar(): void {
    this.tiempos = JSON.parse(this.guardado);
  }

  guardar(): void {
    if (!this.todoValido || !this.hayCambios) return;
    this.guardado = JSON.stringify(this.tiempos);
    this.mostrarMensaje('Vista previa: los tiempos todavía no se guardan en el sistema.');
  }

  private enMinutos(tiempo: Tiempo): number {
    return (Number(tiempo.valor) || 0) * MINUTOS[tiempo.unidad];
  }

  private copiar(lista: TiempoPrioridad[]): TiempoPrioridad[] {
    return JSON.parse(JSON.stringify(lista));
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje = texto;
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => (this.mensaje = ''), 3500);
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
  }
}
