import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import {
  CargaAsesorBackend,
  CargasAdminService,
  EstadoAsesorBackend
} from '../../../service/cargas-admin.service';

// ==================================================
// CAPACIDAD POR AGENTE
// Conectado al backend:
//   GET   /admin/advisors/workload      → lista de agentes con su carga
//   PATCH /admin/advisors/{id}/config   → cambiar estado y capacidad
// ==================================================

type EstadoOperativo = 'Activo' | 'No disponible' | 'Inactivo';

interface Agente {
  id: number;
  nombre: string;
  estado: EstadoOperativo;
  casosActivos: number;
  capacidadMaxima: number | null;   // null = sin tope
  personalizada: boolean;           // tiene una capacidad propia
  llena: boolean;                   // ya llegó a su capacidad
}

const A_PANTALLA: Record<EstadoAsesorBackend, EstadoOperativo> = {
  ACTIVE: 'Activo',
  UNAVAILABLE: 'No disponible',
  INACTIVE: 'Inactivo'
};

const A_BACKEND: Record<EstadoOperativo, EstadoAsesorBackend> = {
  'Activo': 'ACTIVE',
  'No disponible': 'UNAVAILABLE',
  'Inactivo': 'INACTIVE'
};

import { IconoComponent } from '../../../shared/icono/icono.component';

@Component({
  selector: 'app-capacidad-agente',
  standalone: true,
  imports: [IconoComponent, FormsModule],
  templateUrl: './capacidad-agente.component.html',
  styleUrls: ['../admin-comun.css', './capacidad-agente.component.css']
})
export class CapacidadAgenteComponent implements OnInit, OnDestroy {

  private servicio = inject(CargasAdminService);

  // Esta versión de Angular no redibuja sola cuando llega una respuesta del backend
  private cdr = inject(ChangeDetectorRef);

  readonly estados: EstadoOperativo[] = ['Activo', 'No disponible', 'Inactivo'];

  readonly descripcionEstados = [
    { nombre: 'Activo', texto: 'Puede acceder y recibir casos.' },
    { nombre: 'No disponible', texto: 'Conserva sus casos, pero no recibe nuevos.' },
    { nombre: 'Inactivo', texto: 'No recibe nuevos casos.' }
  ];

  agentes: Agente[] = [];

  // Capacidad que se aplica a quien no tiene una propia (la define el servidor)
  capacidadGeneral: number | null = null;

  cargando = true;
  errorCarga = '';

  // Buscador y filtro
  busqueda = '';
  mostrarFiltros = false;

  // Filtros (igual que Inicio > Casos en gestión)
  readonly opcionesOcupacion = ['Con espacio (menos de 80%)', 'Cerca del límite (80% a 99%)', 'Al límite (100%)', 'Sin tope'];
  filtros = { estados: [] as EstadoOperativo[], ocupacion: '' };
  borrador = { estados: [] as EstadoOperativo[], ocupacion: '' };

  alternarFiltros(evento: MouseEvent): void {
    evento.stopPropagation();
    if (!this.mostrarFiltros) {
      this.borrador = { ...this.filtros, estados: [...this.filtros.estados] };
    }
    this.mostrarFiltros = !this.mostrarFiltros;
  }

  alternarEstadoFiltro(estado: EstadoOperativo): void {
    const lista = this.borrador.estados;
    this.borrador.estados = lista.includes(estado) ? lista.filter(e => e !== estado) : [...lista, estado];
  }

  aplicarFiltros(): void {
    this.filtros = { ...this.borrador, estados: [...this.borrador.estados] };
    this.mostrarFiltros = false;
  }

  limpiarFiltros(): void {
    this.filtros = { estados: [], ocupacion: '' };
    this.borrador = { estados: [], ocupacion: '' };
    this.mostrarFiltros = false;
  }

  get chipsFiltro(): { clave: 'estado' | 'ocupacion'; valor?: EstadoOperativo; texto: string }[] {
    const chips: { clave: 'estado' | 'ocupacion'; valor?: EstadoOperativo; texto: string }[] =
      this.filtros.estados.map(e => ({ clave: 'estado' as const, valor: e, texto: `Estado: ${e}` }));
    if (this.filtros.ocupacion) chips.push({ clave: 'ocupacion', texto: `Ocupación: ${this.filtros.ocupacion}` });
    return chips;
  }

  quitarFiltro(chip: { clave: 'estado' | 'ocupacion'; valor?: EstadoOperativo }): void {
    this.filtros = chip.clave === 'estado'
      ? { ...this.filtros, estados: this.filtros.estados.filter(e => e !== chip.valor) }
      : { ...this.filtros, ocupacion: '' };
  }

  private cumpleOcupacion(agente: Agente): boolean {
    const o = this.filtros.ocupacion;
    if (!o) return true;
    const valor = this.ocupacion(agente);
    if (o === 'Sin tope') return valor === null;
    if (valor === null) return false;
    if (o.startsWith('Con espacio')) return valor < 80;
    if (o.startsWith('Cerca')) return valor >= 80 && valor < 100;
    return valor >= 100;
  }

  @HostListener('document:click', ['$event'])
  cerrarFiltrosAfuera(evento: MouseEvent): void {
    const objetivo = evento.target as HTMLElement | null;
    if (this.mostrarFiltros && !objetivo?.closest('.filtros-modal, .managed-filter')) {
      this.mostrarFiltros = false;
    }
  }

  // Ventana "Ver configuración"
  agenteEnEdicion: Agente | null = null;
  formulario = { estado: 'Activo' as EstadoOperativo, usarGeneral: true, capacidadMaxima: null as number | null };

  // Solo diseño (Figma): el backend no maneja colas ni especialidades por agente
  readonly colasDisenio = ['General', 'Casos críticos', 'Prejurídico'];
  readonly especialidadesDisenio = ['Riesgo alto', 'Producto'];
  guardando = false;
  errorFormulario = '';

  mensaje = '';
  private temporizador?: ReturnType<typeof setTimeout>;

  // ==================================================
  // CARGAR
  // ==================================================

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = '';

    this.servicio.listarCargas().subscribe({
      next: filas => {
        // La fila del "Agente Temporal" no es una persona: no se muestra aquí
        const humanos = (filas ?? []).filter(f => !f.agenteTemporal);
        this.capacidadGeneral = this.calcularCapacidadGeneral(humanos);
        this.agentes = humanos
          .map(f => this.convertir(f))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.cargando = false;
        this.refrescarVista();
      },
      error: (error: HttpErrorResponse) => {
        this.cargando = false;
        this.errorCarga = this.textoError(error, 'No se pudieron cargar los agentes.');
        this.refrescarVista();
      }
    });
  }

  // El backend no manda la capacidad general directamente:
  // es la que tienen los agentes que no tienen una propia
  private calcularCapacidadGeneral(filas: CargaAsesorBackend[]): number | null {
    const sinPropia = filas.find(f => f.quotaConfigured && !(f.maxCases && f.maxCases > 0));
    return sinPropia ? sinPropia.effectiveMaxCases : null;
  }

  private convertir(f: CargaAsesorBackend): Agente {
    const estado = f.status ? A_PANTALLA[f.status] : (f.active ? 'Activo' : 'Inactivo');
    return {
      id: f.advisorId,
      nombre: f.fullName || f.code || `Agente ${f.advisorId}`,
      estado,
      casosActivos: f.activeCases ?? 0,
      capacidadMaxima: f.quotaConfigured ? f.effectiveMaxCases : null,
      personalizada: !!f.maxCases && f.maxCases > 0,
      llena: f.atCapacity
    };
  }

  // ==================================================
  // TABLA
  // ==================================================

  get agentesFiltrados(): Agente[] {
    const texto = this.busqueda.trim().toLowerCase();
    return this.agentes.filter(a =>
      (!texto || a.nombre.toLowerCase().includes(texto)) &&
      (this.filtros.estados.length === 0 || this.filtros.estados.includes(a.estado)) &&
      this.cumpleOcupacion(a)
    );
  }

  ocupacion(agente: Agente): number | null {
    if (!agente.capacidadMaxima) return null;
    return Math.round((agente.casosActivos / agente.capacidadMaxima) * 1000) / 10;
  }

  disponibilidad(agente: Agente): string {
    if (agente.estado === 'Inactivo') return 'No recibe asignaciones';
    if (agente.estado === 'No disponible') return 'No recibe nuevos casos';
    if (agente.llena) return 'Capacidad alcanzada';
    return 'Puede recibir casos';
  }

  formatoPorcentaje(valor: number | null): string {
    if (valor === null) return '—';
    return valor.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' %';
  }

  // ==================================================
  // VENTANA DE CONFIGURACIÓN
  // ==================================================

  abrirConfiguracion(agente: Agente): void {
    this.agenteEnEdicion = agente;
    this.formulario = {
      estado: agente.estado,
      usarGeneral: !agente.personalizada,
      capacidadMaxima: agente.personalizada ? agente.capacidadMaxima : (this.capacidadGeneral ?? null)
    };
    this.errorFormulario = '';
  }

  cerrarConfiguracion(): void {
    if (!this.guardando) this.agenteEnEdicion = null;
  }

  get formularioValido(): boolean {
    if (this.formulario.usarGeneral) return true;
    const c = this.formulario.capacidadMaxima;
    return c !== null && Number.isInteger(c) && c >= 1;
  }

  guardarConfiguracion(): void {
    const agente = this.agenteEnEdicion;
    if (!agente || !this.formularioValido) return;

    this.guardando = true;
    this.errorFormulario = '';

    this.servicio.configurarAsesor(agente.id, {
      status: A_BACKEND[this.formulario.estado],
      // 0 = volver a la capacidad general
      maxCases: this.formulario.usarGeneral ? 0 : Number(this.formulario.capacidadMaxima)
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.agenteEnEdicion = null;
        this.mostrarMensaje(`Configuración de ${agente.nombre} guardada. Los casos se redistribuyeron.`);
        // Al guardar, el backend reparte casos: se recarga todo para ver la carga nueva
        this.cargar();
      },
      error: (error: HttpErrorResponse) => {
        this.guardando = false;
        this.errorFormulario = this.textoError(error, 'No se pudo guardar la configuración.');
        this.refrescarVista();
      }
    });
  }

  // ==================================================
  // UTILIDADES
  // ==================================================

  private textoError(error: HttpErrorResponse, porDefecto: string): string {
    if (error.status === 0) return 'No hay conexión con el servidor.';
    if (error.status === 401) return 'Tu sesión terminó. Vuelve a iniciar sesión.';
    if (error.status === 403) return 'No tienes permiso para ver o hacer esto (se necesita rol Administrador).';
    const cuerpo = error.error;
    if (cuerpo?.message && error.status < 500) return cuerpo.message;
    return porDefecto;
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje = texto;
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.mensaje = '';
      this.refrescarVista();
    }, 3500);
    this.refrescarVista();
  }

  private refrescarVista(): void {
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
  }
}
