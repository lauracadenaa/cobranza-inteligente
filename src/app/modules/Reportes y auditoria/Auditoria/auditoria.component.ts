import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime } from 'rxjs';

import {
  ReportesAuditoriaService,
  RegistroAuditoria
} from '../../../service/reportes-auditoria.service';
import {
  PeriodoSeleccionado,
  SelectorPeriodoComponent
} from '../../../components/selector-periodo/selector-periodo.component';


@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectorPeriodoComponent],
  templateUrl: './auditoria.component.html',
  styleUrl: './auditoria.component.css'
})
export class AuditoriaComponent implements OnInit, OnDestroy {
  private readonly servicio = inject(ReportesAuditoriaService);
  private readonly cdr = inject(ChangeDetectorRef);

  registros: RegistroAuditoria[] = [];
  total = 0;
  paginas = 0;
  pagina = 0;
  readonly tamano = 20;

  cargando = false;
  error = '';

  // Buscador (busca en el backend después de dejar de escribir)
  busqueda = '';
  private readonly busqueda$ = new Subject<string>();

  // Filtros (como Inicio > Casos en gestión):
  // lo marcado en la ventana y lo ya aplicado
  mostrarFiltros = false;
  filtroAccion = '';
  filtroUsuario = '';
  borradorAccion = '';
  borradorUsuario = '';

  // Acciones más comunes del backend, con nombre en español
  readonly opcionesAccion: { valor: string; texto: string }[] = [
    { valor: 'LOGIN_SUCCESS', texto: 'Inicio de sesión exitoso' },
    { valor: 'LOGIN_FAILED', texto: 'Inicio de sesión fallido' },
    { valor: 'SESSION_CLOSED', texto: 'Sesión cerrada' },
    { valor: 'PASSWORD_CHANGED', texto: 'Contraseña cambiada' },
    { valor: 'PASSWORD_RESET', texto: 'Contraseña restablecida' },
    { valor: 'USER_CREATED', texto: 'Usuario creado' },
    { valor: 'USER_UPDATED', texto: 'Usuario actualizado' },
    { valor: 'USER_ROLE_CHANGED', texto: 'Rol de usuario cambiado' },
    { valor: 'USER_DEACTIVATED', texto: 'Usuario desactivado' },
    { valor: 'BATCH_CREADO', texto: 'Carga de cartera creada' },
    { valor: 'CASE_STAGE_TRANSITION', texto: 'Cambio de etapa del caso' },
    { valor: 'CONTACT_ATTEMPT_RECORDED', texto: 'Intento de contacto registrado' },
    { valor: 'PAYMENT_LINK_CREATED', texto: 'Link de pago creado' },
    { valor: 'PTP_REGISTERED', texto: 'Promesa de pago registrada' },
    { valor: 'PAYMENT_AGREEMENT_CREATED', texto: 'Acuerdo de pago creado' },
    { valor: 'INSTALLMENT_PAID', texto: 'Cuota pagada' },
    { valor: 'SCORE_CALCULATED', texto: 'Score calculado' },
    { valor: 'SCORING_CONFIG_UPDATED', texto: 'Configuración de scoring actualizada' },
    { valor: 'SLA_UPDATED', texto: 'Tiempos de atención (SLA) actualizados' },
    { valor: 'TEMPLATE_UPDATED', texto: 'Plantilla actualizada' },
    { valor: 'CONSENT_GRANTED', texto: 'Consentimiento otorgado' },
    { valor: 'CONSENT_REVOKED', texto: 'Consentimiento revocado' }
  ];

  textoAccion(valor: string): string {
    return this.opcionesAccion.find(o => o.valor === valor)?.texto ?? valor;
  }

  // Periodo (mismo botón de Análisis de cartera); por defecto últimos 12 meses
  periodoSeleccionado: PeriodoSeleccionado | null = null;

  private suscripciones = new Subscription();
  private peticion?: Subscription;

  ngOnInit(): void {
    this.suscripciones.add(
      this.busqueda$.pipe(debounceTime(400)).subscribe(() => this.irAPagina(0))
    );
    this.cargar();
  }

  ngOnDestroy(): void {
    this.suscripciones.unsubscribe();
    this.peticion?.unsubscribe();
  }

  // ==================================================
  // CARGA
  // ==================================================

  cargar(): void {
    const { desde, hasta } = this.rangoFechas();
    const usuario = this.filtroUsuario.trim();

    this.cargando = true;
    this.error = '';

    this.peticion?.unsubscribe();
    this.peticion = this.servicio.obtenerBitacora({
      texto: this.busqueda,
      accion: this.filtroAccion,
      usuarioId: usuario && /^\d+$/.test(usuario) ? Number(usuario) : null,
      desde,
      hasta,
      pagina: this.pagina,
      tamano: this.tamano
    }).subscribe({
      next: resultado => {
        this.registros = resultado.registros;
        this.total = resultado.total;
        this.paginas = resultado.paginas;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.registros = [];
        this.total = 0;
        this.paginas = 0;
        this.cargando = false;
        this.error = 'No fue posible cargar la bitácora de auditoría.';
        this.cdr.markForCheck();
      }
    });
  }

  private rangoFechas(): { desde: string | null; hasta: string | null } {
    if (this.periodoSeleccionado) {
      return {
        desde: this.aIsoLocal(this.periodoSeleccionado.desde),
        hasta: this.periodoSeleccionado.tipo === 'personalizado'
          ? this.aIsoLocal(this.periodoSeleccionado.hasta)
          : null
      };
    }

    const desde = new Date();
    desde.setFullYear(desde.getFullYear() - 1);
    desde.setHours(0, 0, 0, 0);
    return { desde: this.aIsoLocal(desde), hasta: null };
  }

  cambiarPeriodo(periodo: PeriodoSeleccionado): void {
    this.periodoSeleccionado = periodo;
    this.irAPagina(0);
  }

  // Fecha en formato 2026-11-19T00:00:00 (hora local, como la espera el backend)
  private aIsoLocal(fecha: Date): string {
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
      `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
  }

  // ==================================================
  // INTERACCIONES
  // ==================================================

  alEscribir(): void {
    this.busqueda$.next(this.busqueda);
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
    this.irAPagina(0);
  }

  alternarFiltros(evento: MouseEvent): void {
    evento.stopPropagation();
    if (!this.mostrarFiltros) {
      this.borradorAccion = this.filtroAccion;
      this.borradorUsuario = this.filtroUsuario;
    }
    this.mostrarFiltros = !this.mostrarFiltros;
  }

  cerrarFiltros(): void {
    this.mostrarFiltros = false;
  }

  aplicarFiltros(): void {
    this.filtroAccion = this.borradorAccion;
    this.filtroUsuario = this.borradorUsuario.trim();
    this.mostrarFiltros = false;
    this.irAPagina(0);
  }

  limpiarFiltros(): void {
    this.filtroAccion = '';
    this.filtroUsuario = '';
    this.borradorAccion = '';
    this.borradorUsuario = '';
    this.mostrarFiltros = false;
    this.irAPagina(0);
  }

  quitarFiltro(clave: 'accion' | 'usuario'): void {
    if (clave === 'accion') this.filtroAccion = '';
    else this.filtroUsuario = '';
    this.irAPagina(0);
  }

  // Etiquetas debajo del título (como en Inicio)
  get filtrosVisibles(): { clave: 'accion' | 'usuario'; texto: string }[] {
    const visibles: { clave: 'accion' | 'usuario'; texto: string }[] = [];
    if (this.filtroAccion) visibles.push({ clave: 'accion', texto: `Acción: ${this.textoAccion(this.filtroAccion)}` });
    if (this.filtroUsuario) visibles.push({ clave: 'usuario', texto: `Usuario: ${this.filtroUsuario}` });
    return visibles;
  }

  get filtrosActivos(): number {
    return this.filtrosVisibles.length;
  }

  irAPagina(numero: number): void {
    if (numero < 0 || (this.paginas > 0 && numero >= this.paginas)) return;
    this.pagina = numero;
    this.cargar();
  }

  // Botones de páginas: 1 2 3 … última
  get botonesPagina(): (number | null)[] {
    const total = this.paginas;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);

    const actual = this.pagina;
    const lista: (number | null)[] = [0];
    const inicio = Math.max(1, actual - 1);
    const fin = Math.min(total - 2, actual + 1);
    if (inicio > 1) lista.push(null);
    for (let i = inicio; i <= fin; i++) lista.push(i);
    if (fin < total - 2) lista.push(null);
    lista.push(total - 1);
    return lista;
  }

  get desdeRegistro(): number {
    return this.total === 0 ? 0 : this.pagina * this.tamano + 1;
  }

  get hastaRegistro(): number {
    return Math.min(this.total, (this.pagina + 1) * this.tamano);
  }

  @HostListener('document:click', ['$event'])
  cerrarMenus(evento: MouseEvent): void {
    const objetivo = evento.target as HTMLElement;
    if (!objetivo.closest('.filtros-modal, .managed-filter')) {
      this.mostrarFiltros = false;
    }
  }
}
