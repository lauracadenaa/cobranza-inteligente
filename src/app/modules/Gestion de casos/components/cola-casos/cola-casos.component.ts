
import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  Output,
  EventEmitter,
  HostListener,
  SimpleChanges
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ManagedCase } from '../../../../models/dashboard.models';

import {
  CaseService,
  BackendCase,
  AsesorCarga
} from '../../../../service/case.service';
import { ContextoCasos, DashboardService } from '../../../../service/dashboard.service';
import { CarteraService, ScoreSummary } from '../../../../service/cartera.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

// ==================================================
// ORIGEN DEL CASO (misma regla que Inicio > Casos en gestión)
// - Escalado por regla fija (intentos, riesgo, saldo, jurídico) → Regla automática
// - Escalado por otra razón de la IA → Desborde IA
// - Sin escalar y creado por carga de archivo → Integración de cartera
// - Sin escalar y sin carga de archivo → Integración CORE
// ==================================================

const MOTIVOS_POR_REGLA = ['MAX_CONTACT_ATTEMPTS', 'HIGH_RISK_SCORE', 'HIGH_BALANCE', 'LEGAL_REQUIRED'];

function calcularOrigenCaso(caso: BackendCase): string {
  const motivo = (caso.escalationReason ?? '').toUpperCase();

  if (motivo) {
    return MOTIVOS_POR_REGLA.includes(motivo) ? 'reglaAutomatica' : 'desbordeIA';
  }

  if (Number(caso.aiEscalationCount ?? 0) > 0) {
    return 'desbordeIA';
  }

  return caso.batchId !== null && caso.batchId !== undefined
    ? 'integracionCartera'
    : 'integracionCore';
}

// "Hace 32 min", "Ayer 4:20 p. m.", "15/09/2026"
export function tiempoRelativo(fecha: string): string {
  const valor = fecha ? new Date(fecha) : null;
  if (!valor || Number.isNaN(valor.getTime())) return '—';

  const minutos = Math.floor((Date.now() - valor.getTime()) / 60000);
  const hora = valor.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

  if (minutos < 1) return 'Hace un momento';
  if (minutos < 60) return `Hace ${minutos} min`;

  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (mismoDia(valor, hoy)) return `Hoy ${hora}`;
  if (mismoDia(valor, ayer)) return `Ayer ${hora}`;
  return valor.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

@Component({
  selector: 'app-cola-casos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './cola-casos.component.html',
  styleUrl: './cola-casos.component.css'
})
export class ColaCasosComponent implements OnInit, OnChanges {

  @Input() casos: ManagedCase[] = [];
  @Input() detalleAbierto = false;

  // Número de caso que se pidió abrir desde otra pantalla (por ejemplo, el inicio)
  @Input() casoAAbrir: string | null = null;
  @Output() casoDetalleChange = new EventEmitter<ManagedCase | null>();

  casosOriginales: ManagedCase[] = [];
  casosFiltrados: ManagedCase[] = [];

  cargando = true;
  errorCarga = '';

  busqueda = '';
  mostrarModalFiltros = false;

  // =========================================
  // SELECCIÓN Y RESUMEN RÁPIDO
  // =========================================

  casoSeleccionado: ManagedCase | null = null;

  
  // =========================================
  // VISTA COMPLETA DEL CASO
  // =========================================

  mostrarCasoCompleto = false;

  // =========================================
  // MODAL DE ASIGNACIÓN / REASIGNACIÓN
  // =========================================

  mostrarModalAsignacion = false;

  asignacion = {
    colaDestino: 'CASOS_CRITICOS',
    criterio: 'AUTOMATICA',
    motivo: 'BALANCEO_CARGA',
    comentario: ''
  };

  errorAsignacion = '';
motivoDesborde = 'Desborde IA';

  // Paso de la ventana: primero el formulario, luego la revisión
  pasoAsignacion: 'formulario' | 'revision' = 'formulario';

  // Mensaje corto al confirmar (abajo a la derecha)
  mensajeAsignacion = '';
  private temporizadorAsignacion: ReturnType<typeof setTimeout> | null = null;

  // Nombres para mostrar en la revisión
  private readonly nombresCola: Record<string, string> = {
    CASOS_CRITICOS: 'Casos críticos',
    GENERAL: 'General',
    PREVENTIVA: 'Preventiva',
    ADMINISTRATIVA: 'Administrativa',
    PREJURIDICA: 'Prejurídica'
  };

  private readonly nombresMotivo: Record<string, string> = {
    BALANCEO_CARGA: 'Balanceo de carga',
    CAMBIO_SEGMENTO: 'Cambio de segmento',
    ESPECIALIZACION: 'Especialización del asesor',
    ESCALAMIENTO: 'Escalamiento',
    OTRO: 'Otro'
  };

  nombreCola(valor: string): string {
    return this.nombresCola[valor] ?? valor;
  }

  nombreMotivo(valor: string): string {
    return this.nombresMotivo[valor] ?? valor;
  }

  // =========================================
  // FILTROS
  // =========================================

  filtros = {
    riesgos: [] as ManagedCase['riesgo'][],
    asesor: '',
    diasMoraDesde: null as number | null,
    diasMoraHasta: null as number | null,
    segmento: '',
    estado: '',
    fechaExacta: '',
    fechaDesde: '',
    fechaHasta: '',
    origenes: [] as string[]
  };

  filtrosAplicados = {
    ...this.filtros,
    riesgos: [] as ManagedCase['riesgo'][],
    origenes: [] as string[]
  };

  // Mismas opciones de origen que en Inicio > Casos en gestión
  readonly opcionesOrigen = [
    { clave: 'desbordeIA', texto: 'Desborde IA' },
    { clave: 'reglaAutomatica', texto: 'Regla o política automática' },
    { clave: 'integracionCore', texto: 'Integración CORE' },
    { clave: 'integracionCartera', texto: 'Integración de cartera' }
  ];

  alternarOrigen(clave: string): void {
    const lista = this.filtros.origenes;
    this.filtros.origenes = lista.includes(clave)
      ? lista.filter(o => o !== clave)
      : [...lista, clave];
  }

  // =========================================
  // PAGINACIÓN
  // =========================================

  paginaActual = 1;
  elementosPorPagina = 7;

  // =========================================
  // CONSTRUCTOR
  // =========================================

  constructor(
    private caseService: CaseService,
    private changeDetectorRef: ChangeDetectorRef,
    private dashboardService: DashboardService,
    private carteraService: CarteraService
  ) {}

  // =========================================
  // CONTEXTO IA DEL RESUMEN RÁPIDO (scoring real del cliente)
  // =========================================

  scoringResumenRapido: ScoreSummary | null = null;
  cargandoScoringRapido = false;
  private scoringPorCliente = new Map<number, ScoreSummary | null>();

  private cargarScoringRapido(caso: ManagedCase | null): void {
    this.scoringResumenRapido = null;
    const clienteId = caso?.clientId;
    if (clienteId == null) return;

    if (this.scoringPorCliente.has(clienteId)) {
      this.scoringResumenRapido = this.scoringPorCliente.get(clienteId) ?? null;
      return;
    }

    this.cargandoScoringRapido = true;
    this.carteraService.getScoreSummary(clienteId).subscribe({
      next: resumen => {
        this.scoringPorCliente.set(clienteId, resumen);
        if (this.casoSeleccionado?.clientId === clienteId) this.scoringResumenRapido = resumen;
        this.cargandoScoringRapido = false;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.scoringPorCliente.set(clienteId, null);
        this.cargandoScoringRapido = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  textoProbabilidad(probabilidad: number | null | undefined): string {
    if (probabilidad == null) return '—';
    if (probabilidad >= 0.6) return 'Alta';
    if (probabilidad >= 0.3) return 'Media';
    return 'Baja';
  }

  // Nombres de asesores y tiempos límite (SLA); misma lógica del Inicio
  private contexto: ContextoCasos | null = null;

  // =========================================
  // INICIALIZACIÓN
  // =========================================

  ngOnInit(): void {

    this.cargarCasosBackend();

  }

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['detalleAbierto']) {
      this.mostrarCasoCompleto = this.detalleAbierto;
    }

    if (changes['casos'] && this.casos.length > 0) {

      this.casosOriginales = [...this.casos];

      this.paginaActual = 1;

      this.aplicarBusquedaYFiltros();

    }

  }

  // =========================================
  // CONSULTAR BACKEND
  // =========================================

  cargarCasosBackend(): void {

    this.cargando = true;
    this.errorCarga = '';

    forkJoin({
      respuesta: this.caseService.obtenerTodosLosCasos(),
      contexto: this.dashboardService.obtenerContextoCasos().pipe(catchError(() => of(null)))
    }).subscribe({

      next: ({ respuesta, contexto }) => {

        this.contexto = contexto;

        this.casosOriginales = respuesta.map(caso =>
          this.adaptarCaso(caso)
        );

        this.cargando = false;
        this.paginaActual = 1;

        this.aplicarBusquedaYFiltros();

        this.abrirCasoPedido();

        this.changeDetectorRef.detectChanges();

      },

      error: (error) => {

        console.error('Error consultando casos:', error);

        this.cargando = false;

        this.errorCarga =
          'No fue posible cargar los casos. Intenta nuevamente.';

        this.casosOriginales = [];
        this.casosFiltrados = [];

        this.changeDetectorRef.detectChanges();

      }

    });

  }

  // =========================================
  // ADAPTAR RESPUESTA DEL BACKEND
  // =========================================

  
adaptarCaso(caso: BackendCase): ManagedCase {

  const riesgoBackend =
    caso.client?.riskLevel?.toUpperCase() ?? '';

  const mapaRiesgos: Record<string, ManagedCase['riesgo']> = {

    BAJO: 'Bajo',
    MEDIO: 'Medio',
    ALTO: 'Alto',
    CRITICO: 'Crítico',
    CRÍTICO: 'Crítico'

  };

  const riesgo =
    mapaRiesgos[riesgoBackend] ?? 'Sin información';

  const asesor = this.contexto
    ? this.dashboardService.nombreAsesor(caso, this.contexto)
    : caso.escalatedAdvisorName ||
      (caso.assignedTo != null ? `Asesor #${caso.assignedTo}` : 'Sin asignar');

  const segmento =
    caso.client?.segment ||
    caso.obligation?.segment ||
    '';

  return {

    // Identificación del caso
    id: caso.caseNumber,
    backendId: caso.id,

    // Identificación real del cliente
    clientId: caso.client?.id,

    // Persona asociada
    asociado:
      caso.client?.fullName || 'Sin información',

    documento:
      caso.client?.documentNumber || '',

   // Obligación
obligacion:
  caso.obligation?.obligationNumber || 'Sin información',

// Identificador interno de la obligación
obligationId:
  caso.obligation?.id,

saldoVencido:
  caso.obligation?.currentBalance ??
  caso.obligation?.totalBalance ??
  undefined,

    // Riesgo
    riesgo,

    diasMora:
      caso.obligation?.effectiveDaysPastDue ??
      caso.obligation?.daysPastDue ??
      0,

    // Fecha de creación + días máximos para contactar según el segmento
    tiempoLimite: this.contexto
      ? this.dashboardService.calcularTiempoLimite(
          caso,
          segmento || this.dashboardService.mapSegment(caso.obligation?.daysPastDue),
          this.contexto.diasSla
        )
      : 'Sin información',

    // Asignación
    asesor,

    // Información del caso
    estado: caso.status || '',
    segmento,
    fechaCreacion: caso.createdAt || '',

    // De dónde salió el caso (misma regla que en el Inicio)
    origen: calcularOrigenCaso(caso),

    // Ruta del caso (cola, skill, producto y región que asignó el backend)
    colaActual: caso.queueName || caso.queueCode || '',
    skillRuta: caso.routeSkill || '',
    productoRuta: caso.routeProduct || '',
    regionRuta: caso.routeRegion || '',

    // Última gestión: última actualización del caso + intentos de contacto
    fechaActualizacion: caso.updatedAt || caso.createdAt || '',
    ultimaGestion: tiempoRelativo(caso.updatedAt || ''),
    ultimaGestionDetalle: Number(caso.contactAttempts ?? 0) > 0
      ? `${caso.contactAttempts} ${Number(caso.contactAttempts) === 1 ? 'intento' : 'intentos'} de contacto`
      : 'Sin intentos de contacto'

  };

}

  // =========================================
  // RECARGAR CASOS
  // =========================================

  recargarCasos(): void {

    this.caseService.invalidarCache();

    this.cargarCasosBackend();

  }

  // =========================================
  // MODAL DE FILTROS
  // =========================================

  abrirFiltros(): void {

    this.filtros = {
      ...this.filtrosAplicados,
      riesgos: [...this.filtrosAplicados.riesgos],
      origenes: [...this.filtrosAplicados.origenes]
    };

    // Como en el Inicio: el botón abre y cierra la ventana
    this.mostrarModalFiltros = !this.mostrarModalFiltros;

  }

  cerrarFiltros(): void {

    this.mostrarModalFiltros = false;

  }

  alternarRiesgo(riesgo: ManagedCase['riesgo']): void {

    const indice = this.filtros.riesgos.indexOf(riesgo);

    if (indice >= 0) {

      this.filtros.riesgos.splice(indice, 1);

    } else {

      this.filtros.riesgos.push(riesgo);

    }

  }

  aplicarFiltros(): void {

    this.filtrosAplicados = {
      ...this.filtros,
      riesgos: [...this.filtros.riesgos],
      origenes: [...this.filtros.origenes]
    };

    this.mostrarModalFiltros = false;

    this.paginaActual = 1;

    this.aplicarBusquedaYFiltros();

  }

  limpiarFiltros(): void {

    this.filtros = {

      riesgos: [],
      asesor: '',
      diasMoraDesde: null,
      diasMoraHasta: null,
      segmento: '',
      estado: '',
      fechaExacta: '',
      fechaDesde: '',
      fechaHasta: '',
      origenes: []

    };

    this.filtrosAplicados = {
      ...this.filtros,
      riesgos: [],
      origenes: []
    };

    this.mostrarModalFiltros = false;

    this.paginaActual = 1;

    this.aplicarBusquedaYFiltros();

  }

  // =========================================
  // BÚSQUEDA Y FILTRADO
  // =========================================

  buscarCasos(): void {

    this.paginaActual = 1;

    this.aplicarBusquedaYFiltros();

  }

  aplicarBusquedaYFiltros(): void {

    const texto = this.normalizarTexto(this.busqueda);

    this.casosFiltrados = this.casosOriginales.filter(caso => {

      const coincideBusqueda =
        !texto ||
        this.normalizarTexto(caso.id).includes(texto) ||
        this.normalizarTexto(caso.asociado).includes(texto) ||
        this.normalizarTexto(caso.documento ?? '').includes(texto) ||
        this.normalizarTexto(caso.obligacion).includes(texto);

      const f = this.filtrosAplicados;

      const coincideRiesgo =
        f.riesgos.length === 0 ||
        f.riesgos.includes(caso.riesgo);

      const coincideAsesor =
        !f.asesor ||
        this.normalizarTexto(caso.asesor).includes(
          this.normalizarTexto(f.asesor)
        );

      const coincideMoraDesde =
        f.diasMoraDesde === null ||
        caso.diasMora >= f.diasMoraDesde;

      const coincideMoraHasta =
        f.diasMoraHasta === null ||
        caso.diasMora <= f.diasMoraHasta;

      const coincideSegmento =
        !f.segmento ||
        this.normalizarTexto(caso.segmento ?? '') ===
        this.normalizarTexto(f.segmento);

      const coincideEstado =
        !f.estado ||
        this.normalizarTexto(caso.estado ?? '') ===
        this.normalizarTexto(f.estado);

      const fecha =
        caso.fechaCreacion?.substring(0, 10) ?? '';

      const coincideFechaExacta =
        !f.fechaExacta || fecha === f.fechaExacta;

      const coincideFechaDesde =
        !f.fechaDesde || (!!fecha && fecha >= f.fechaDesde);

      const coincideFechaHasta =
        !f.fechaHasta || (!!fecha && fecha <= f.fechaHasta);

      const coincideOrigen =
        f.origenes.length === 0 ||
        f.origenes.includes(caso.origen ?? '');

      return coincideBusqueda &&
        coincideOrigen &&
        coincideRiesgo &&
        coincideAsesor &&
        coincideMoraDesde &&
        coincideMoraHasta &&
        coincideSegmento &&
        coincideEstado &&
        coincideFechaExacta &&
        coincideFechaDesde &&
        coincideFechaHasta;

    });

  }

  normalizarTexto(valor: string): string {

    return (valor ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  }

  // =========================================
  // QUITAR FILTROS ACTIVOS
  // =========================================

  quitarFiltro(clave: string): void {

    switch (clave) {

      case 'riesgos':
        this.filtrosAplicados.riesgos = [];
        break;

      case 'asesor':
        this.filtrosAplicados.asesor = '';
        break;

      case 'diasMoraDesde':
        this.filtrosAplicados.diasMoraDesde = null;
        break;

      case 'diasMoraHasta':
        this.filtrosAplicados.diasMoraHasta = null;
        break;

      case 'segmento':
        this.filtrosAplicados.segmento = '';
        break;

      case 'estado':
        this.filtrosAplicados.estado = '';
        break;

      case 'fechaExacta':
        this.filtrosAplicados.fechaExacta = '';
        break;

      case 'fechaDesde':
        this.filtrosAplicados.fechaDesde = '';
        break;

      case 'fechaHasta':
        this.filtrosAplicados.fechaHasta = '';
        break;

      default:
        if (clave.startsWith('origen:')) {
          const origen = clave.replace('origen:', '');
          this.filtrosAplicados.origenes =
            this.filtrosAplicados.origenes.filter(o => o !== origen);
        }
        break;

    }

    this.filtros = {
      ...this.filtrosAplicados,
      riesgos: [...this.filtrosAplicados.riesgos],
      origenes: [...this.filtrosAplicados.origenes]
    };

    this.paginaActual = 1;

    this.aplicarBusquedaYFiltros();

  }

  // =========================================
  // FILTROS VISIBLES
  // =========================================

  get filtrosVisibles(): { clave: string; texto: string }[] {

    const f = this.filtrosAplicados;

    const visibles: { clave: string; texto: string }[] = [];

    if (f.riesgos.length) {

      visibles.push({
        clave: 'riesgos',
        texto: `Riesgo: ${f.riesgos.join(', ')}`
      });

    }

    if (f.asesor) {

      visibles.push({
        clave: 'asesor',
        texto: `Asesor: ${f.asesor}`
      });

    }

    if (f.diasMoraDesde !== null) {

      visibles.push({
        clave: 'diasMoraDesde',
        texto: `Mora desde: ${f.diasMoraDesde} días`
      });

    }

    if (f.diasMoraHasta !== null) {

      visibles.push({
        clave: 'diasMoraHasta',
        texto: `Mora hasta: ${f.diasMoraHasta} días`
      });

    }

    if (f.segmento) {

      visibles.push({
        clave: 'segmento',
        texto: `Segmento: ${f.segmento}`
      });

    }

    if (f.estado) {

      visibles.push({
        clave: 'estado',
        texto: `Estado: ${f.estado}`
      });

    }

    if (f.fechaExacta) {

      visibles.push({
        clave: 'fechaExacta',
        texto: `Fecha: ${f.fechaExacta}`
      });

    }

    if (f.fechaDesde) {

      visibles.push({
        clave: 'fechaDesde',
        texto: `Desde: ${f.fechaDesde}`
      });

    }

    if (f.fechaHasta) {

      visibles.push({
        clave: 'fechaHasta',
        texto: `Hasta: ${f.fechaHasta}`
      });

    }

    f.origenes.forEach(origen => {
      const texto = this.opcionesOrigen.find(o => o.clave === origen)?.texto ?? origen;
      visibles.push({ clave: `origen:${origen}`, texto: `Origen: ${texto}` });
    });

    return visibles;

  }

  get cantidadFiltrosActivos(): number {

    return this.filtrosVisibles.length;

  }

  // =========================================
  // PAGINACIÓN
  // =========================================

  get casosPaginados(): ManagedCase[] {

    const inicio =
      (this.paginaActual - 1) * this.elementosPorPagina;

    return this.casosFiltrados.slice(
      inicio,
      inicio + this.elementosPorPagina
    );

  }

  get totalPaginas(): number {

    return Math.ceil(
      this.casosFiltrados.length / this.elementosPorPagina
    );

  }

  get registroInicial(): number {

    return this.casosFiltrados.length === 0
      ? 0
      : (this.paginaActual - 1) * this.elementosPorPagina + 1;

  }

  get registroFinal(): number {

    return Math.min(
      this.paginaActual * this.elementosPorPagina,
      this.casosFiltrados.length
    );

  }

  cambiarPagina(pagina: number): void {

    if (pagina >= 1 && pagina <= this.totalPaginas) {

      this.paginaActual = pagina;

    }

  }

  get paginas(): Array<number | '...'> {

    const total = this.totalPaginas;

    if (total <= 5) {

      return Array.from(
        { length: total },
        (_, indice) => indice + 1
      );

    }

    if (this.paginaActual <= 3) {

      return [1, 2, 3, '...', total];

    }

    if (this.paginaActual >= total - 2) {

      return [1, '...', total - 2, total - 1, total];

    }

    return [
      1,
      '...',
      this.paginaActual - 1,
      this.paginaActual,
      this.paginaActual + 1,
      '...',
      total
    ];

  }

  // =========================================
  // SELECCIÓN DE CASO
  // =========================================

  seleccionarCaso(caso: ManagedCase): void {

    if (this.casoSeleccionado?.id === caso.id) {

      this.casoSeleccionado = null;

    } else {

      this.casoSeleccionado = caso;
      this.cargarScoringRapido(caso);

    }

  }

  estaSeleccionado(caso: ManagedCase): boolean {

    return this.casoSeleccionado?.id === caso.id;

  }

  // =========================================
  // ASIGNAR / REASIGNAR CASO
  // =========================================

  abrirModalAsignacion(): void {

    if (!this.casoSeleccionado) {

      return;

    }

    this.asignacion = {
      colaDestino: 'CASOS_CRITICOS',
      criterio: 'AUTOMATICA',
      motivo: 'BALANCEO_CARGA',
      comentario: ''
    };

    this.errorAsignacion = '';

    this.pasoAsignacion = 'formulario';

    this.mostrarModalAsignacion = true;

    this.cargarAsesores();

  }

  // =========================================
  // ASESORES REALES (GET /admin/advisors/workload)
  // =========================================

  asesoresDisponibles: AsesorCarga[] = [];
  cargandoAsesores = false;
  asesorElegidoId: number | null = null;
  guardandoAsignacion = false;

  private cargarAsesores(): void {
    this.asesorElegidoId = null;
    this.cargandoAsesores = true;

    this.caseService.obtenerAsesores().subscribe({
      next: lista => {
        this.asesoresDisponibles = (lista ?? []).filter(a => a.advisorId != null);
        this.cargandoAsesores = false;
        this.changeDetectorRef.markForCheck();
      },
      error: error => {
        this.asesoresDisponibles = [];
        this.cargandoAsesores = false;
        this.errorAsignacion = error?.status === 403
          ? 'Solo un administrador o supervisor puede reasignar casos.'
          : 'No fue posible consultar los asesores.';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  // Automática: el asesor activo con cupo y menos casos
  get asesorAutomatico(): AsesorCarga | null {
    return [...this.asesoresDisponibles]
      .filter(a => a.active && !a.atCapacity)
      .sort((a, b) => a.activeCases - b.activeCases)[0] ?? null;
  }

  get asesorDestino(): AsesorCarga | null {
    return this.asignacion.criterio === 'MANUAL'
      ? this.asesoresDisponibles.find(a => a.advisorId === this.asesorElegidoId) ?? null
      : this.asesorAutomatico;
  }

  cerrarModalAsignacion(): void {

    this.mostrarModalAsignacion = false;

    this.errorAsignacion = '';

  }

  revisarAsignacion(): void {

    if (!this.asignacion.colaDestino) {

      this.errorAsignacion = 'Selecciona una cola de destino.';

      return;

    }

    if (!this.asignacion.criterio) {

      this.errorAsignacion = 'Selecciona un criterio de asignación.';

      return;

    }

    if (!this.asignacion.motivo) {

      this.errorAsignacion = 'Selecciona un motivo de reasignación.';

      return;

    }

    if (!this.casoSeleccionado) {

      this.errorAsignacion = 'No hay un caso seleccionado.';

      return;

    }

    if (!this.asesorDestino) {

      this.errorAsignacion = this.asignacion.criterio === 'MANUAL'
        ? 'Selecciona un asesor.'
        : 'No hay asesores activos con cupo disponible.';

      return;

    }

    this.errorAsignacion = '';
    this.pasoAsignacion = 'revision';

  }

  // =========================================
  // MENÚ DE LOS TRES PUNTOS (⋮)
  // =========================================

  menuAccionesId: string | null = null;

  alternarMenuAcciones(caso: ManagedCase): void {
    this.menuAccionesId = this.menuAccionesId === caso.id ? null : caso.id;
  }

  // Cierra el menú si se hace clic en cualquier otra parte
  @HostListener('document:click')
  cerrarMenuAcciones(): void {
    this.menuAccionesId = null;
  }

  accionAsignar(caso: ManagedCase): void {
    this.menuAccionesId = null;
    this.casoSeleccionado = caso;
    this.abrirModalAsignacion();
  }

  accionCopiarId(caso: ManagedCase): void {
    this.menuAccionesId = null;
    navigator.clipboard?.writeText(caso.id)
      .then(() => this.mostrarAvisoAsignacion('ID del caso copiado.'))
      .catch(() => this.mostrarAvisoAsignacion('No fue posible copiar el ID.'));
  }

  // "Ver historial" y "Enviar link de pago" se hacen desde el caso completo
  accionAbrirCaso(caso: ManagedCase): void {
    this.menuAccionesId = null;
    this.casoSeleccionado = caso;
    this.abrirCasoCompleto();
  }

  private mostrarAvisoAsignacion(texto: string): void {
    this.mensajeAsignacion = texto;
    if (this.temporizadorAsignacion) {
      clearTimeout(this.temporizadorAsignacion);
    }
    this.temporizadorAsignacion = setTimeout(() => {
      this.mensajeAsignacion = '';
      this.changeDetectorRef.markForCheck();
    }, 3000);
    this.changeDetectorRef.markForCheck();
  }

  volverAFormularioAsignacion(): void {
    this.pasoAsignacion = 'formulario';
  }

  // Reasigna en el backend y deja una nota con el motivo y el comentario
  confirmarAsignacion(): void {

    const caso = this.casoSeleccionado;
    const asesor = this.asesorDestino;

    if (!caso?.backendId || !asesor || this.guardandoAsignacion) {
      return;
    }

    this.guardandoAsignacion = true;
    this.errorAsignacion = '';

    this.caseService.reasignarCaso(caso.backendId, asesor.advisorId).subscribe({
      next: () => {
        // Nota en el caso con lo que el backend no guarda (cola, motivo, comentario)
        const nota = [
          `Caso reasignado a ${asesor.fullName}.`,
          `Cola destino: ${this.nombreCola(this.asignacion.colaDestino)}.`,
          `Criterio: ${this.asignacion.criterio === 'AUTOMATICA' ? 'Automática' : 'Manual'}.`,
          `Motivo: ${this.nombreMotivo(this.asignacion.motivo)}.`,
          this.asignacion.comentario.trim() ? `Comentario: ${this.asignacion.comentario.trim()}` : ''
        ].filter(Boolean).join(' ');

        this.caseService.crearNota(caso.backendId!, nota).subscribe({ error: () => undefined });

        this.guardandoAsignacion = false;
        this.mostrarModalAsignacion = false;
        this.pasoAsignacion = 'formulario';
        this.mostrarAvisoAsignacion(`Caso reasignado a ${asesor.fullName}.`);
        this.recargarCasos();
      },
      error: error => {
        this.guardandoAsignacion = false;
        this.errorAsignacion = error?.status === 403
          ? 'No tienes permiso para reasignar casos.'
          : error?.error?.message || 'No fue posible reasignar el caso.';
        this.pasoAsignacion = 'formulario';
        this.changeDetectorRef.markForCheck();
      }
    });

  }

  // =========================================
  // ABRIR CASO COMPLETO
  // =========================================

  // Si llegamos con un caso pedido, se abre directamente su detalle
  private abrirCasoPedido(): void {

    if (!this.casoAAbrir) {
      return;
    }

    const caso = this.casosOriginales.find(c => c.id === this.casoAAbrir);

    if (caso) {
      this.casoSeleccionado = caso;
      this.casoDetalleChange.emit(caso);
    } else {
      // No está en la cola: al menos se deja buscado para que el usuario lo vea
      this.busqueda = this.casoAAbrir;
      this.aplicarBusquedaYFiltros();
    }

  }

  abrirCasoCompleto(): void {

    if (!this.casoSeleccionado) {
      return;
    }

    this.mostrarCasoCompleto = true;
    this.casoDetalleChange.emit(this.casoSeleccionado);

  }

  // =========================================
  // REGRESAR A GESTIÓN DE CASOS
  // =========================================

  cerrarCasoCompleto(): void {

    this.mostrarCasoCompleto = false;
    this.casoDetalleChange.emit(null);

  }

  // =========================================
  // UTILIDADES
  // =========================================

  obtenerIniciales(nombre: string): string {

    return nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(parte => parte[0]?.toUpperCase() ?? '')
      .join('');

  }

  // Color de la barrita del tiempo límite
  obtenerClaseTiempoLimite(tiempoLimite: string): string {

    const texto = (tiempoLimite || '').trim().toLowerCase();
    const valor = Number.parseFloat(texto);

    if (texto.startsWith('vencido')) return 'deadline-urgent';
    if (!Number.isFinite(valor)) return 'deadline-neutral';
    if (texto.includes(' h ')) return 'deadline-urgent';
    if (texto.includes('día') || texto.includes('dia')) {
      return valor <= 2 ? 'deadline-warning' : 'deadline-safe';
    }
    return 'deadline-neutral';
  }

  obtenerEstadoLabel(estado: string): string {

    const etiquetas: Record<string, string> = {

      NUEVO: 'Nuevo',
      EN_GESTION: 'En gestión',
      ILOCALIZADO: 'Ilocalizado',
      PROMESA_PAGO: 'Promesa de pago',
      PREJURIDICO: 'Prejurídico',
      CERRADO: 'Cerrado'

    };

    return etiquetas[estado] ?? estado;

  }

  formatearMoneda(valor: number): string {

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(valor);

  }

}
