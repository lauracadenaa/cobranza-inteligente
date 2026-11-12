
import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  Output,
  EventEmitter,
  SimpleChanges
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ManagedCase } from '../../../../models/dashboard.models';

import {
  CaseService,
  BackendCase
} from '../../../../service/case.service';

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
    fechaHasta: ''
  };

  filtrosAplicados = {
    ...this.filtros,
    riesgos: [] as ManagedCase['riesgo'][]
  };

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
    private changeDetectorRef: ChangeDetectorRef
  ) {}

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

    this.caseService.obtenerTodosLosCasos().subscribe({

      next: (respuesta: BackendCase[]) => {

        this.casosOriginales = respuesta.map(caso =>
          this.adaptarCaso(caso)
        );

        this.cargando = false;
        this.paginaActual = 1;

        this.aplicarBusquedaYFiltros();

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

  const asesor =
    caso.escalatedAdvisorName ||
    (caso.assignedTo != null
      ? `Asesor #${caso.assignedTo}`
      : 'Sin asignar');

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

    tiempoLimite: 'Sin información',

    // Asignación
    asesor,

    // Información del caso
    estado: caso.status || '',
    segmento,
    fechaCreacion: caso.createdAt || ''

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
      riesgos: [...this.filtrosAplicados.riesgos]
    };

    this.mostrarModalFiltros = true;

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
      riesgos: [...this.filtros.riesgos]
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
      fechaHasta: ''

    };

    this.filtrosAplicados = {
      ...this.filtros,
      riesgos: []
    };

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

      return coincideBusqueda &&
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

    }

    this.filtros = {
      ...this.filtrosAplicados,
      riesgos: [...this.filtrosAplicados.riesgos]
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

    this.mostrarModalAsignacion = true;

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

    console.log('Datos de asignación:', {
      caso: this.casoSeleccionado,
      colaDestino: this.asignacion.colaDestino,
      criterio: this.asignacion.criterio,
      motivo: this.asignacion.motivo,
      comentario: this.asignacion.comentario
    });

    // La conexión con el backend y la revisión
    // de la asignación se implementarán posteriormente.

  }

  // =========================================
  // ABRIR CASO COMPLETO
  // =========================================

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

  obtenerClaseTiempoLimite(tiempoLimite: string): string {

    const normalizado = tiempoLimite.trim().toLowerCase();

    const valor = Number.parseFloat(normalizado);

    if (!Number.isFinite(valor)) {

      return 'deadline-neutral';

    }

    if (normalizado.includes('min')) {

      return valor <= 30
        ? 'deadline-urgent'
        : 'deadline-warning';

    }

    if (
      normalizado.includes('hora') ||
      normalizado.includes('h')
    ) {

      return valor <= 2
        ? 'deadline-urgent'
        : 'deadline-warning';

    }

    if (
      normalizado.includes('día') ||
      normalizado.includes('dia')
    ) {

      return 'deadline-safe';

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
