
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CaseStatusChartComponent } from '../case-status-chart/case-status-chart.component';
import { SidebarComponent } from '../sidedar/sidebar.component';
import { DashboardHeaderComponent } from '../dashboard-header/dashboard-header.component';
import { KpiCardsComponent } from '../kpi-cards/kpi-cards.component';
import { AgingChartComponent } from '../aging-chart/aging-chart.component';
import { SearchCaseComponent } from '../search-case/search-case.component';

import { DashboardService } from '../../service/dashboard.service';
import { ManagedCase } from '../../models/dashboard.models';


import { IconoComponent } from '../../shared/icono/icono.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent,
    DashboardHeaderComponent,
    KpiCardsComponent,
    AgingChartComponent,
    CaseStatusChartComponent,
    SearchCaseComponent,
    IconoComponent
  ],

  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})


export class DashboardComponent implements OnInit {

  // ==================================================
  // CONTROL DEL MODAL DE FILTROS
  // ==================================================

  mostrarModalFiltros = false;
  filtrosActivo = false;


  // ==================================================
  // VALORES SELECCIONADOS EN EL MODAL
  // ==================================================

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

    origenes: {
      desbordeIA: false,
      reglaAutomatica: false,
      integracionCore: false,
      integracionCartera: false
    }

  };

  filtrosAplicados = {
    riesgos: [] as ManagedCase['riesgo'][],
    asesor: '',
    diasMoraDesde: null as number | null,
    diasMoraHasta: null as number | null,
    segmento: '',
    estado: '',
    fechaExacta: '',
    fechaDesde: '',
    fechaHasta: '',
    origenes: {
      desbordeIA: false,
      reglaAutomatica: false,
      integracionCore: false,
      integracionCartera: false
    }
  };


  // ==================================================
  // ABRIR Y CERRAR MODAL
  // ==================================================

  abrirFiltros(): void {
    this.mostrarModalFiltros = !this.mostrarModalFiltros;
  }

  cerrarFiltros(): void {
    this.mostrarModalFiltros = false;
  }


  // ==================================================
  // NORMALIZAR TEXTOS PARA COMPARAR
  // ==================================================

  private normalizarTexto(
    valor: string | number | null | undefined
  ): string {

    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_-]/g, ' ')
      .trim()
      .toLowerCase();

  }


  // ==================================================
  // SELECCIONAR O DESELECCIONAR RIESGO
  // ==================================================

  alternarRiesgo(
    riesgo: ManagedCase['riesgo'],
    seleccionado: boolean
  ): void {

    if (seleccionado) {

      if (!this.filtros.riesgos.includes(riesgo)) {
        this.filtros.riesgos.push(riesgo);
      }

    } else {

      this.filtros.riesgos = this.filtros.riesgos.filter(
        valor => valor !== riesgo
      );

    }

  }


  // ==================================================
  // CASOS FILTRADOS
  // ==================================================

  // Texto escrito en el buscador de la tabla
  textoBusqueda = '';

  buscarEnTabla(texto: string): void {
    this.textoBusqueda = texto;
    this.paginaActual = 1;
  }

  // Iniciales del asesor para el circulito de la tabla
  inicialesAsesor(asesor: string | undefined): string {
    const texto = (asesor ?? '').trim();
    if (!texto || texto === 'Sin asignar') {
      return '—';
    }
    return texto
      .split(/\s+/)
      .slice(0, 2)
      .map(parte => parte.charAt(0).toUpperCase())
      .join('');
  }

  get casosFiltrados(): ManagedCase[] {

    return this.cases.filter(caso => {

      // FILTRO POR RIESGO
      const coincideRiesgo =
        this.filtrosAplicados.riesgos.length === 0 ||
        this.filtrosAplicados.riesgos.includes(caso.riesgo);


      // FILTRO POR ASESOR
      const coincideAsesor =
        this.filtrosAplicados.asesor.trim() === '' ||
        this.normalizarTexto(caso.asesor).includes(
          this.normalizarTexto(this.filtrosAplicados.asesor)
        );


      // FILTRO POR DÍAS DE MORA DESDE
      const coincideMoraDesde =
        this.filtrosAplicados.diasMoraDesde === null ||
        caso.diasMora >= this.filtrosAplicados.diasMoraDesde;


      // FILTRO POR DÍAS DE MORA HASTA
      const coincideMoraHasta =
        this.filtrosAplicados.diasMoraHasta === null ||
        caso.diasMora <= this.filtrosAplicados.diasMoraHasta;


      // FILTRO POR SEGMENTO
      const coincideSegmento =
        this.filtrosAplicados.segmento === '' ||
        this.normalizarTexto(caso.segmento) ===
        this.normalizarTexto(this.filtrosAplicados.segmento);


      // FILTRO POR ESTADO
      const coincideEstado =
        this.filtrosAplicados.estado === '' ||
        this.normalizarTexto(caso.estado) ===
        this.normalizarTexto(this.filtrosAplicados.estado);


      // OBTENER FECHA DEL CASO
      const fechaCaso = caso.fechaCreacion
        ? caso.fechaCreacion.substring(0, 10)
        : '';


      // FILTRO POR FECHA EXACTA
      const coincideFechaExacta =
        this.filtrosAplicados.fechaExacta === '' ||
        fechaCaso === this.filtrosAplicados.fechaExacta;


      // FILTRO POR FECHA DESDE
      const coincideFechaDesde =
        this.filtrosAplicados.fechaDesde === '' ||
        (
          fechaCaso !== '' &&
          fechaCaso >= this.filtrosAplicados.fechaDesde
        );


      // FILTRO POR FECHA HASTA
      const coincideFechaHasta =
        this.filtrosAplicados.fechaHasta === '' ||
        (
          fechaCaso !== '' &&
          fechaCaso <= this.filtrosAplicados.fechaHasta
        );


      // BUSCADOR: caso, asociado, documento u obligación
      const texto = this.normalizarTexto(this.textoBusqueda);
      const coincideBusqueda =
        texto === '' ||
        [caso.id, caso.asociado, caso.documento, caso.obligacion]
          .some(valor => this.normalizarTexto(valor).includes(texto));


      // FILTRO POR ORIGEN (si no se marca ninguno, pasan todos)
      const origenesMarcados = Object.entries(this.filtrosAplicados.origenes)
        .filter(([, marcado]) => marcado)
        .map(([clave]) => clave);
      const coincideOrigen =
        origenesMarcados.length === 0 ||
        origenesMarcados.includes(caso.origen ?? '');


      // RESULTADO FINAL
      return (
        coincideBusqueda &&
        coincideOrigen &&
        coincideRiesgo &&
        coincideAsesor &&
        coincideMoraDesde &&
        coincideMoraHasta &&
        coincideSegmento &&
        coincideEstado &&
        coincideFechaExacta &&
        coincideFechaDesde &&
        coincideFechaHasta
      );

    });

  }


  // ==================================================
  // APLICAR FILTROS
  // ==================================================

  aplicarFiltros(): void {

    this.filtrosAplicados = {
      ...this.filtros,
      riesgos: [...this.filtros.riesgos],
      origenes: { ...this.filtros.origenes }
    };
    this.filtrosActivo = this.cantidadFiltrosActivos > 0;

    this.paginaActual = 1;

    this.cerrarFiltros();

  }


  // ==================================================
  // FILTROS VISIBLES DEBAJO DEL TÍTULO
  // ==================================================

  get filtrosVisibles(): { clave: string; texto: string }[] {

    const visibles: { clave: string; texto: string }[] = [];


    // RIESGOS
    this.filtrosAplicados.riesgos.forEach(riesgo => {

      visibles.push({
        clave: `riesgo:${riesgo}`,
        texto: `Riesgo: ${riesgo}`
      });

    });


    // ASESOR
    if (this.filtrosAplicados.asesor.trim() !== '') {

      visibles.push({
        clave: 'asesor',
        texto: `Asesor: ${this.filtrosAplicados.asesor}`
      });

    }


    // DÍAS DE MORA
    if (
      this.filtrosAplicados.diasMoraDesde !== null ||
      this.filtrosAplicados.diasMoraHasta !== null
    ) {

      visibles.push({
        clave: 'mora',
        texto: `Días de mora: ${this.filtrosAplicados.diasMoraDesde ?? 0} - ${this.filtrosAplicados.diasMoraHasta ?? 'Sin límite'}`
      });

    }


    // SEGMENTO
    if (this.filtrosAplicados.segmento !== '') {

      visibles.push({
        clave: 'segmento',
        texto: `Segmento: ${this.filtrosAplicados.segmento}`
      });

    }


    // ESTADO
    if (this.filtrosAplicados.estado !== '') {

      visibles.push({
        clave: 'estado',
        texto: `Estado: ${this.filtrosAplicados.estado}`
      });

    }


    // FECHA EXACTA
    if (this.filtrosAplicados.fechaExacta !== '') {

      visibles.push({
        clave: 'fechaExacta',
        texto: `Fecha: ${this.filtrosAplicados.fechaExacta}`
      });

    }


    // RANGO DE FECHAS
    if (
      this.filtrosAplicados.fechaDesde !== '' ||
      this.filtrosAplicados.fechaHasta !== ''
    ) {

      visibles.push({
        clave: 'rangoFechas',
        texto: `Rango: ${this.filtrosAplicados.fechaDesde || 'Sin inicio'} - ${this.filtrosAplicados.fechaHasta || 'Sin fin'}`
      });

    }


    // ORÍGENES
    const origenes = [
      { clave: 'desbordeIA', texto: 'Desborde IA' },
      { clave: 'reglaAutomatica', texto: 'Regla o política automática' },
      { clave: 'integracionCore', texto: 'Integración CORE' },
      { clave: 'integracionCartera', texto: 'Integración de cartera' }
    ];

    origenes.forEach(origen => {

      if (
        this.filtrosAplicados.origenes[
          origen.clave as keyof typeof this.filtrosAplicados.origenes
        ]
      ) {

        visibles.push({
          clave: `origen:${origen.clave}`,
          texto: `Origen: ${origen.texto}`
        });

      }

    });

    return visibles;

  }

  // ==================================================
  // ELIMINAR FILTRO INDIVIDUAL
  // ==================================================

  quitarFiltro(clave: string): void {

    if (clave.startsWith('riesgo:')) {

      const riesgo = clave.replace('riesgo:', '') as ManagedCase['riesgo'];

      this.filtrosAplicados.riesgos = this.filtrosAplicados.riesgos.filter(
        valor => valor !== riesgo
      );

    } else if (clave === 'asesor') {

      this.filtrosAplicados.asesor = '';

    } else if (clave === 'mora') {

      this.filtrosAplicados.diasMoraDesde = null;
      this.filtrosAplicados.diasMoraHasta = null;

    } else if (clave === 'segmento') {

      this.filtrosAplicados.segmento = '';

    } else if (clave === 'estado') {

      this.filtrosAplicados.estado = '';

    } else if (clave === 'fechaExacta') {

      this.filtrosAplicados.fechaExacta = '';

    } else if (clave === 'rangoFechas') {

      this.filtrosAplicados.fechaDesde = '';
      this.filtrosAplicados.fechaHasta = '';

    } else if (clave.startsWith('origen:')) {

      const origen = clave.replace('origen:', '') as keyof typeof this.filtrosAplicados.origenes;

      this.filtrosAplicados.origenes[origen] = false;

    }

    this.filtros = {
      ...this.filtrosAplicados,
      riesgos: [...this.filtrosAplicados.riesgos],
      origenes: { ...this.filtrosAplicados.origenes }
    };
    this.filtrosActivo = this.cantidadFiltrosActivos > 0;

    this.paginaActual = 1;

  }


  // ==================================================
  // CANTIDAD DE FILTROS ACTIVOS
  // ==================================================

  get cantidadFiltrosActivos(): number {

    let cantidad = 0;

    cantidad += this.filtrosAplicados.riesgos.length;

    if (this.filtrosAplicados.asesor.trim() !== '') cantidad++;

    if (
      this.filtrosAplicados.diasMoraDesde !== null ||
      this.filtrosAplicados.diasMoraHasta !== null
    ) cantidad++;

    if (this.filtrosAplicados.segmento !== '') cantidad++;

    if (this.filtrosAplicados.estado !== '') cantidad++;

    if (this.filtrosAplicados.fechaExacta !== '') cantidad++;

    if (
      this.filtrosAplicados.fechaDesde !== '' ||
      this.filtrosAplicados.fechaHasta !== ''
    ) cantidad++;

    if (
      this.filtrosAplicados.origenes.desbordeIA ||
      this.filtrosAplicados.origenes.reglaAutomatica ||
      this.filtrosAplicados.origenes.integracionCore ||
      this.filtrosAplicados.origenes.integracionCartera
    ) cantidad++;

    return cantidad;

  }


  // ==================================================
  // LIMPIAR FILTROS
  // ==================================================

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

      origenes: {
        desbordeIA: false,
        reglaAutomatica: false,
        integracionCore: false,
        integracionCartera: false
      }

    };

    this.filtrosAplicados = {
      ...this.filtros,
      riesgos: [...this.filtros.riesgos],
      origenes: { ...this.filtros.origenes }
    };

    this.filtrosActivo = false;

    this.paginaActual = 1;

  }


  // ==================================================
  // MODAL BUSCAR CASO
  // ==================================================

  isSearchCaseOpen = false;

  openSearchCase(): void {

    this.isSearchCaseOpen = true;

  }

  closeSearchCase(): void {

    this.isSearchCaseOpen = false;

  }

  // Desde el buscador: abre el caso elegido o va a Gestión de casos
  goToManagedCases(caso: ManagedCase | null = null): void {
    this.closeSearchCase();

    if (caso) {
      this.abrirCaso(caso);
    } else {
      void this.router.navigateByUrl('/gestion-casos');
    }
  }

  // ==================================================
  // ACCIONES RÁPIDAS
  // ==================================================

  private readonly router = inject(Router);

  // Abre el detalle del caso en Gestión de casos
  abrirCaso(caso: ManagedCase): void {
    void this.router.navigate(['/gestion-casos'], {
      state: { casoAAbrir: caso.id }
    });
  }

  // Cargar archivo: la carga batch está en Cartera > Integración de cartera
  irACargarArchivo(): void {
    void this.router.navigateByUrl('/cartera');
  }

  irACrearLink(): void {
    void this.router.navigateByUrl('/links-pagos');
  }

  irAGenerarReporte(): void {
    void this.router.navigateByUrl('/reportes-auditoria');
  }


  // ==================================================
  // DATOS DE LOS CASOS
  // ==================================================

  cases: ManagedCase[] = [];


  // ==================================================
  // PAGINACIÓN DE CASOS
  // ==================================================

  paginaActual = 1;

  casosPorPagina = 5;


  // TOTAL DE PÁGINAS
  get totalPaginas(): number {

    return Math.ceil(
      this.casosFiltrados.length / this.casosPorPagina
    );

  }


  // CASOS DE LA PÁGINA ACTUAL
  get casosPaginados(): ManagedCase[] {

    const inicio =
      (this.paginaActual - 1) * this.casosPorPagina;

    const fin = inicio + this.casosPorPagina;

    return this.casosFiltrados.slice(inicio, fin);

  }


  // NÚMEROS DE PÁGINA
  // Como en Figma: "1 2 3 … 15" (null = puntos suspensivos)
  get paginas(): (number | null)[] {

    const total = this.totalPaginas;

    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const actual = Math.min(Math.max(this.paginaActual, 1), total);

    // Al inicio: 1 2 3 … total
    if (actual <= 3) {
      return [1, 2, 3, null, total];
    }

    // Al final: 1 … total-2 total-1 total
    if (actual >= total - 2) {
      return [1, null, total - 2, total - 1, total];
    }

    // En medio: 1 … actual … total
    return [1, null, actual, null, total];

  }


  // PRIMER REGISTRO MOSTRADO
  get registroInicial(): number {

    return this.casosFiltrados.length === 0
      ? 0
      : (this.paginaActual - 1) * this.casosPorPagina + 1;

  }


  // ÚLTIMO REGISTRO MOSTRADO
  get registroFinal(): number {

    return Math.min(
      this.paginaActual * this.casosPorPagina,
      this.casosFiltrados.length
    );

  }


  // CAMBIAR DE PÁGINA
  cambiarPagina(pagina: number): void {

    if (
      pagina < 1 ||
      pagina > this.totalPaginas
    ) {
      return;
    }

    this.paginaActual = pagina;

  }


  // SIGUIENTE
  paginaSiguiente(): void {

    this.cambiarPagina(this.paginaActual + 1);

  }


  // ANTERIOR
  paginaAnterior(): void {

    this.cambiarPagina(this.paginaActual - 1);

  }


  // ==================================================
  // CONSTRUCTOR
  // ==================================================

  constructor(
    private dashboardService: DashboardService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}


  // ==================================================
  // INICIALIZACIÓN
  // ==================================================

  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {

    this.cargarCasos();

    // Botón "Actualizar" del encabezado
    this.dashboardService.recargar$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarCasos());

  }

  private cargarCasos(): void {

    this.dashboardService.getManagedCases().subscribe({

      next: (data) => {
        this.cases = data;
        this.paginaActual = 1;
        this.changeDetectorRef.markForCheck();
      },

      error: (error) => {
        console.error('ERROR AL CONSULTAR LOS CASOS:', error);
        this.changeDetectorRef.markForCheck();
      }

    });

  }

}