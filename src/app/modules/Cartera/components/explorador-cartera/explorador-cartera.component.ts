
import { Component, EventEmitter, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CarteraKpisComponent } from '../cartera-kpis/cartera-kpis.component';

// =============================================
// MODELO DE CASOS DE CARTERA
// =============================================

interface CasoCartera {
  id: string;
  asociado: string;
  obligacion: string;
  riesgo: string;
  diasMora: number;
  tiempoLimite: string;
  asesor: string;
  ultimaGestion: string;
  segmento?: string;
}

// =============================================
// MODELO DE OBLIGACIONES
// =============================================

interface ObligacionCartera {
  id: string;
  asociado: string;
  producto: string;
  saldoTotal: string;
  saldoVencido: string;
  diasMora: number;
  riesgo: string;
  casoRelacionado: string;
  estado?: string;
  cuotaMinima?: string;
  fechaVencimiento?: string;
  scorePtP?: string;
  capital?: string;
  interesMora?: string;
}

// =============================================
// MODELO DE RESUMEN DEL ASOCIADO
// =============================================

interface ResumenAsociado {
  asociado: string;
  segmento: string;
  cantidadObligaciones: number;
  saldoVencido: number;
  mayorMora: number;
  casos: CasoCartera[];
  obligaciones: ObligacionCartera[];
}

// =============================================
// MODELO DE FILTROS
// =============================================

interface FiltrosObligaciones {
  riesgos: string[];
  producto: string;
  asociado: string;
  diasMoraDesde: number | null;
  diasMoraHasta: number | null;
  saldoVencidoDesde: number | null;
  saldoVencidoHasta: number | null;
}

// =============================================
// COMPONENTE
// =============================================

import { IconoComponent } from '../../../../shared/icono/icono.component';

@Component({
  selector: 'app-explorador-cartera',
  standalone: true,
  imports: [IconoComponent, 
    CommonModule,
    FormsModule,
    CarteraKpisComponent
  ],
  templateUrl: './explorador-cartera.component.html',
  styleUrl: './explorador-cartera.component.css'
})
export class ExploradorCarteraComponent {

  @Output() tipoConsultaSeleccionado = new EventEmitter<string>();

  // =============================================
  // TIPO DE CONSULTA ACTIVA
  // =============================================

  tipoConsultaActiva: 'Asociados' | 'Obligaciones' = 'Asociados';

  // =============================================
  // DATOS DE PRUEBA - CASOS
  // =============================================

  casos: CasoCartera[] = [
    {
      id: 'CAS-001',
      asociado: 'María Fernanda López',
      obligacion: 'OBL-001',
      riesgo: 'Alto',
      diasMora: 95,
      tiempoLimite: '2 días',
      asesor: 'Carlos Ramírez',
      ultimaGestion: 'Llamada - 25/10/2026',
      segmento: 'Prejurídico'
    },
    {
      id: 'CAS-002',
      asociado: 'María Fernanda López',
      obligacion: 'OBL-002',
      riesgo: 'Medio',
      diasMora: 45,
      tiempoLimite: '5 días',
      asesor: 'Carlos Ramírez',
      ultimaGestion: 'WhatsApp - 24/10/2026',
      segmento: 'Administrativa'
    },
    {
      id: 'CAS-003',
      asociado: 'Andrés Felipe Gómez',
      obligacion: 'OBL-003',
      riesgo: 'Crítico',
      diasMora: 150,
      tiempoLimite: '1 día',
      asesor: 'Laura Méndez',
      ultimaGestion: 'Llamada - 26/10/2026',
      segmento: 'Prejurídico'
    },
    {
      id: 'CAS-004',
      asociado: 'Andrés Felipe Gómez',
      obligacion: 'OBL-004',
      riesgo: 'Alto',
      diasMora: 80,
      tiempoLimite: '3 días',
      asesor: 'Laura Méndez',
      ultimaGestion: 'Correo - 23/10/2026',
      segmento: 'Prejurídico'
    },
    {
      id: 'CAS-005',
      asociado: 'Carlos Alberto Torres',
      obligacion: 'OBL-005',
      riesgo: 'Bajo',
      diasMora: 12,
      tiempoLimite: '10 días',
      asesor: 'Ana Torres',
      ultimaGestion: 'Llamada - 26/10/2026',
      segmento: 'Preventiva'
    },
    {
      id: 'CAS-006',
      asociado: 'Diana Carolina Pérez',
      obligacion: 'OBL-006',
      riesgo: 'Medio',
      diasMora: 35,
      tiempoLimite: '6 días',
      asesor: 'Ana Torres',
      ultimaGestion: 'WhatsApp - 25/10/2026',
      segmento: 'Administrativa'
    }
  ];

  // =============================================
  // DATOS DE PRUEBA - OBLIGACIONES
  // =============================================

  obligaciones: ObligacionCartera[] = [
    {
      id: 'OBL-001',
      asociado: 'María Fernanda López',
      producto: 'Crédito de consumo',
      saldoTotal: '$8.500.000',
      saldoVencido: '$2.300.000',
      diasMora: 95,
      riesgo: 'Alto',
      casoRelacionado: 'CAS-001',
      estado: 'En gestión',
      cuotaMinima: '$450.000',
      fechaVencimiento: '15/10/2026',
      scorePtP: '78%',
      capital: '$2.000.000',
      interesMora: '$300.000'
    },
    {
      id: 'OBL-002',
      asociado: 'María Fernanda López',
      producto: 'Tarjeta de crédito',
      saldoTotal: '$4.200.000',
      saldoVencido: '$850.000',
      diasMora: 45,
      riesgo: 'Medio',
      casoRelacionado: 'CAS-002',
      estado: 'En gestión',
      cuotaMinima: '$180.000',
      fechaVencimiento: '20/10/2026',
      scorePtP: '65%',
      capital: '$750.000',
      interesMora: '$100.000'
    },
    {
      id: 'OBL-003',
      asociado: 'Andrés Felipe Gómez',
      producto: 'Crédito hipotecario',
      saldoTotal: '$45.000.000',
      saldoVencido: '$7.800.000',
      diasMora: 150,
      riesgo: 'Crítico',
      casoRelacionado: 'CAS-003',
      estado: 'Prejurídico',
      cuotaMinima: '$1.200.000',
      fechaVencimiento: '10/09/2026',
      scorePtP: '32%',
      capital: '$6.500.000',
      interesMora: '$1.300.000'
    },
    {
      id: 'OBL-004',
      asociado: 'Andrés Felipe Gómez',
      producto: 'Crédito de vehículo',
      saldoTotal: '$18.000.000',
      saldoVencido: '$3.500.000',
      diasMora: 80,
      riesgo: 'Alto',
      casoRelacionado: 'CAS-004',
      estado: 'En gestión',
      cuotaMinima: '$620.000',
      fechaVencimiento: '05/10/2026',
      scorePtP: '54%',
      capital: '$3.000.000',
      interesMora: '$500.000'
    },
    {
      id: 'OBL-005',
      asociado: 'Carlos Alberto Torres',
      producto: 'Crédito de consumo',
      saldoTotal: '$6.000.000',
      saldoVencido: '$250.000',
      diasMora: 12,
      riesgo: 'Bajo',
      casoRelacionado: 'CAS-005',
      estado: 'Preventiva',
      cuotaMinima: '$150.000',
      fechaVencimiento: '25/10/2026',
      scorePtP: '90%',
      capital: '$220.000',
      interesMora: '$30.000'
    },
    {
      id: 'OBL-006',
      asociado: 'Diana Carolina Pérez',
      producto: 'Tarjeta de crédito',
      saldoTotal: '$3.800.000',
      saldoVencido: '$620.000',
      diasMora: 35,
      riesgo: 'Medio',
      casoRelacionado: 'CAS-006',
      estado: 'En gestión',
      cuotaMinima: '$200.000',
      fechaVencimiento: '18/10/2026',
      scorePtP: '70%',
      capital: '$550.000',
      interesMora: '$70.000'
    }
  ];

  // =============================================
  // SELECCIÓN Y RESUMEN DEL ASOCIADO
  // =============================================

  casosSeleccionados: string[] = [];

  asociadosSeleccionados: string[] = [];
  busquedaAsociados = '';
  // Filtros de Asociados (igual que Inicio > Casos en gestión)
  readonly riesgosFiltro = ['Bajo', 'Medio', 'Alto', 'Crítico'];
  filtrosAsociados = { riesgos: [] as string[], segmento: '' };
  borradorAsociados = { riesgos: [] as string[], segmento: '' };
  mostrarFiltrosAsociados = false;
  paginaAsociados = 0;
  readonly tamanioPaginaAsociados = 7;

  asociadoSeleccionado: ResumenAsociado | null = null;

  get hayRegistros(): boolean {
    return this.casos.length > 0;
  }

  get todosSeleccionados(): boolean {
    return this.hayRegistros &&
      this.casos.every(caso =>
        this.casosSeleccionados.includes(caso.id)
      );
  }

  // =============================================
  // AGRUPAR CASOS POR ASOCIADO
  // =============================================

  get asociadosResumen(): ResumenAsociado[] {

    const agrupados = new Map<string, CasoCartera[]>();

    this.casos.forEach(caso => {
      const clave = this.normalizar(caso.asociado);

      if (!agrupados.has(clave)) {
        agrupados.set(clave, []);
      }

      agrupados.get(clave)!.push(caso);
    });

    return Array.from(agrupados.values()).map(casosAsociado => {

      const primerCaso = casosAsociado[0];
      const nombreAsociado = primerCaso.asociado;

      const obligacionesAsociado = this.obligaciones.filter(
        obligacion =>
          this.normalizar(obligacion.asociado) ===
          this.normalizar(nombreAsociado)
      );

      const idsObligaciones = obligacionesAsociado.length > 0
        ? [...new Set(obligacionesAsociado.map(o => o.id))]
        : [...new Set(casosAsociado.map(caso => caso.obligacion))];

      const saldoVencido = obligacionesAsociado.reduce(
        (total, obligacion) =>
          total + this.convertirSaldo(obligacion.saldoVencido),
        0
      );

      const todasLasMoras = [
        ...obligacionesAsociado.map(o => o.diasMora),
        ...casosAsociado.map(caso => caso.diasMora)
      ];

      return {
        asociado: nombreAsociado,
        segmento: primerCaso.segmento || '—',
        cantidadObligaciones: idsObligaciones.length,
        saldoVencido,
        mayorMora: todasLasMoras.length > 0
          ? Math.max(...todasLasMoras)
          : 0,
        casos: casosAsociado,
        obligaciones: obligacionesAsociado
      };
    });
  }

  get segmentosAsociados(): string[] {
    return [...new Set(this.asociadosResumen.map(asociado => asociado.segmento))]
      .filter(segmento => segmento !== '—')
      .sort((a, b) => a.localeCompare(b, 'es'));
  }

  get asociadosFiltrados(): ResumenAsociado[] {
    const termino = this.normalizar(this.busquedaAsociados);

    return this.asociadosResumen.filter(asociado => {
      const datosBusqueda = [
        asociado.asociado,
        ...asociado.casos.map(caso => caso.id),
        ...asociado.casos.map(caso => caso.obligacion),
        ...asociado.obligaciones.map(obligacion => obligacion.id)
      ].map(dato => this.normalizar(dato)).join(' ');

      const coincideBusqueda = !termino || datosBusqueda.includes(termino);
      const f = this.filtrosAsociados;
      const coincideSegmento = !f.segmento || asociado.segmento === f.segmento;
      const riesgo = this.normalizar(this.obtenerNivelRiesgo(asociado.casos));
      const coincideRiesgo = f.riesgos.length === 0 ||
        f.riesgos.some(r => this.normalizar(r) === riesgo);

      return coincideBusqueda && coincideSegmento && coincideRiesgo;
    });
  }

  get asociadosPagina(): ResumenAsociado[] {
    const inicio = this.inicioPaginaAsociados;
    return this.asociadosFiltrados.slice(
      inicio,
      inicio + this.tamanioPaginaAsociados
    );
  }

  get totalPaginasAsociados(): number {
    return Math.max(
      1,
      Math.ceil(this.asociadosFiltrados.length / this.tamanioPaginaAsociados)
    );
  }

  get inicioPaginaAsociados(): number {
    return this.paginaAsociados * this.tamanioPaginaAsociados;
  }

  get finPaginaAsociados(): number {
    return Math.min(
      this.inicioPaginaAsociados + this.tamanioPaginaAsociados,
      this.asociadosFiltrados.length
    );
  }

  get todosAsociadosPaginaSeleccionados(): boolean {
    return this.asociadosPagina.length > 0 &&
      this.asociadosPagina.every(asociado =>
        this.asociadoSeleccionadoEnTabla(asociado)
      );
  }

  get algunosAsociadosPaginaSeleccionados(): boolean {
    return this.asociadosPagina.some(asociado =>
      this.asociadoSeleccionadoEnTabla(asociado)
    ) && !this.todosAsociadosPaginaSeleccionados;
  }

  actualizarBusquedaAsociados(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.busquedaAsociados = event.target.value;
      this.paginaAsociados = 0;
    }
  }

  alternarFiltrosAsociados(evento: MouseEvent): void {
    evento.stopPropagation();
    if (!this.mostrarFiltrosAsociados) {
      this.borradorAsociados = { ...this.filtrosAsociados, riesgos: [...this.filtrosAsociados.riesgos] };
    }
    this.mostrarFiltrosAsociados = !this.mostrarFiltrosAsociados;
  }

  alternarRiesgoAsociados(riesgo: string): void {
    const lista = this.borradorAsociados.riesgos;
    this.borradorAsociados.riesgos = lista.includes(riesgo)
      ? lista.filter(r => r !== riesgo)
      : [...lista, riesgo];
  }

  aplicarFiltrosAsociados(): void {
    this.filtrosAsociados = { ...this.borradorAsociados, riesgos: [...this.borradorAsociados.riesgos] };
    this.mostrarFiltrosAsociados = false;
    this.paginaAsociados = 0;
  }

  limpiarFiltrosAsociados(): void {
    this.filtrosAsociados = { riesgos: [], segmento: '' };
    this.borradorAsociados = { riesgos: [], segmento: '' };
    this.mostrarFiltrosAsociados = false;
    this.paginaAsociados = 0;
  }

  get filtrosVisiblesAsociados(): { clave: 'riesgo' | 'segmento'; valor?: string; texto: string }[] {
    const f = this.filtrosAsociados;
    const visibles: { clave: 'riesgo' | 'segmento'; valor?: string; texto: string }[] =
      f.riesgos.map(r => ({ clave: 'riesgo' as const, valor: r, texto: `Riesgo: ${r}` }));
    if (f.segmento) visibles.push({ clave: 'segmento', texto: `Segmento: ${f.segmento}` });
    return visibles;
  }

  quitarFiltroAsociados(filtro: { clave: 'riesgo' | 'segmento'; valor?: string }): void {
    this.filtrosAsociados = filtro.clave === 'riesgo'
      ? { ...this.filtrosAsociados, riesgos: this.filtrosAsociados.riesgos.filter(r => r !== filtro.valor) }
      : { ...this.filtrosAsociados, segmento: '' };
    this.paginaAsociados = 0;
  }

  // Cierra el panel de filtros de Asociados al hacer clic afuera
  @HostListener('document:click', ['$event'])
  cerrarFiltrosAsociadosAfuera(evento: MouseEvent): void {
    const objetivo = evento.target as HTMLElement | null;
    if (this.mostrarFiltrosAsociados &&
        !objetivo?.closest('.filtros-modal-asociados, .obligaciones-filtro')) {
      this.mostrarFiltrosAsociados = false;
    }
  }

  cambiarPaginaAsociados(pagina: number): void {
    if (pagina >= 0 && pagina < this.totalPaginasAsociados) {
      this.paginaAsociados = pagina;
    }
  }

  asociadoSeleccionadoEnTabla(asociado: ResumenAsociado): boolean {
    return this.asociadosSeleccionados.includes(
      this.normalizar(asociado.asociado)
    );
  }

  cambiarSeleccionAsociado(asociado: ResumenAsociado, event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.seleccionarAsociado(asociado, event.target.checked);
    }
  }

  private seleccionarAsociado(
    asociado: ResumenAsociado,
    seleccionado: boolean
  ): void {
    const clave = this.normalizar(asociado.asociado);

    this.asociadosSeleccionados = seleccionado
      ? [...new Set([...this.asociadosSeleccionados, clave])]
      : this.asociadosSeleccionados.filter(item => item !== clave);
  }

  cambiarSeleccionAsociadosPagina(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.seleccionarAsociadosPagina(event.target.checked);
    }
  }

  private seleccionarAsociadosPagina(seleccionados: boolean): void {
    const clavesPagina = this.asociadosPagina.map(asociado =>
      this.normalizar(asociado.asociado)
    );

    this.asociadosSeleccionados = seleccionados
      ? [...new Set([...this.asociadosSeleccionados, ...clavesPagina])]
      : this.asociadosSeleccionados.filter(clave =>
          !clavesPagina.includes(clave)
        );
  }

  // =============================================
  // ABRIR RESUMEN DESDE ASOCIADOS
  // =============================================

  verDetalleAsociado(asociado: ResumenAsociado): void {
    this.asociadoSeleccionado = asociado;
    this.obligacionSeleccionadaDetalle = null;
  }

  // =============================================
  // ABRIR DETALLE DE OBLIGACIÓN
  // =============================================

  verDetalleDesdeObligacion(obligacion: ObligacionCartera): void {
    this.asociadoSeleccionado = null;
    this.obligacionSeleccionadaDetalle = obligacion;
  }

  obtenerAsesorAsignado(obligacion: ObligacionCartera): string {
    return this.casos.find(caso => caso.obligacion === obligacion.id)?.asesor || '—';
  }

  obtenerNivelRiesgo(casos: CasoCartera[]): string {
    const prioridad: Record<string, number> = {
      crítico: 4,
      critico: 4,
      alto: 3,
      medio: 2,
      bajo: 1
    };

    return casos.reduce((riesgoMayor, caso) =>
      (prioridad[caso.riesgo.toLowerCase()] || 0) >
      (prioridad[riesgoMayor.toLowerCase()] || 0)
        ? caso.riesgo
        : riesgoMayor,
    casos[0]?.riesgo || '—');
  }

  obtenerScorePromesa(obligaciones: ObligacionCartera[]): string {
    return obligaciones.find(obligacion => obligacion.scorePtP)?.scorePtP || '—';
  }

  // =============================================
  // CERRAR RESUMEN DEL ASOCIADO
  // =============================================

  cerrarDetalleAsociado(): void {
    this.asociadoSeleccionado = null;
  }

  // =============================================
  // CERRAR DETALLE DE OBLIGACIÓN
  // =============================================

  cerrarDetalleObligacion(): void {
    this.obligacionSeleccionadaDetalle = null;
  }

  // =============================================
  // SELECCIÓN DE CASOS
  // =============================================

  seleccionarTodos(checked: boolean): void {
    this.casosSeleccionados = checked
      ? this.casos.map(caso => caso.id)
      : [];
  }

  seleccionarCaso(id: string, checked: boolean): void {

    if (checked) {
      if (!this.casosSeleccionados.includes(id)) {
        this.casosSeleccionados = [
          ...this.casosSeleccionados,
          id
        ];
      }
    } else {
      this.casosSeleccionados = this.casosSeleccionados.filter(
        casoId => casoId !== id
      );
    }
  }

  estaSeleccionado(id: string): boolean {
    return this.casosSeleccionados.includes(id);
  }

  // =============================================
  // OBLIGACIONES Y FILTROS
  // =============================================

  obligacionesSeleccionadas: string[] = [];

  obligacionSeleccionadaDetalle: ObligacionCartera | null = null;

  busquedaObligaciones = '';

  mostrarFiltroObligaciones = false;

  filtrosObligaciones: FiltrosObligaciones =
    this.obtenerFiltrosVacios();

  filtrosAplicadosObligaciones: FiltrosObligaciones =
    this.obtenerFiltrosVacios();

  get hayObligaciones(): boolean {
    return this.obligacionesFiltradas.length > 0;
  }

  private obtenerFiltrosVacios(): FiltrosObligaciones {
    return {
      riesgos: [],
      producto: '',
      asociado: '',
      diasMoraDesde: null,
      diasMoraHasta: null,
      saldoVencidoDesde: null,
      saldoVencidoHasta: null
    };
  }

  // =============================================
  // FILTRAR OBLIGACIONES
  // =============================================

  get obligacionesFiltradas(): ObligacionCartera[] {

    const busqueda = this.busquedaObligaciones.trim().toLowerCase();
    const filtros = this.filtrosAplicadosObligaciones;

    return this.obligaciones.filter(obligacion => {

      const coincideBusqueda =
        !busqueda ||
        obligacion.id.toLowerCase().includes(busqueda) ||
        obligacion.asociado.toLowerCase().includes(busqueda) ||
        obligacion.producto.toLowerCase().includes(busqueda) ||
        obligacion.casoRelacionado.toLowerCase().includes(busqueda);

      const coincideRiesgo =
        filtros.riesgos.length === 0 ||
        filtros.riesgos.some(riesgo =>
          this.normalizar(obligacion.riesgo) === this.normalizar(riesgo)
        );

      const coincideProducto =
        !filtros.producto ||
        this.normalizar(obligacion.producto) ===
        this.normalizar(filtros.producto);

      const coincideAsociado =
        !filtros.asociado ||
        obligacion.asociado.toLowerCase().includes(
          filtros.asociado.trim().toLowerCase()
        );

      const coincideDiasMora =
        (filtros.diasMoraDesde === null ||
          obligacion.diasMora >= filtros.diasMoraDesde) &&
        (filtros.diasMoraHasta === null ||
          obligacion.diasMora <= filtros.diasMoraHasta);

      const saldoVencido =
        this.convertirSaldo(obligacion.saldoVencido);

      const coincideSaldo =
        (filtros.saldoVencidoDesde === null ||
          saldoVencido >= filtros.saldoVencidoDesde) &&
        (filtros.saldoVencidoHasta === null ||
          saldoVencido <= filtros.saldoVencidoHasta);

      return coincideBusqueda &&
        coincideRiesgo &&
        coincideProducto &&
        coincideAsociado &&
        coincideDiasMora &&
        coincideSaldo;
    });
  }

  // =============================================
  // CONVERTIR SALDOS A NÚMERO
  // =============================================

  private convertirSaldo(valor: string): number {
    const numero = Number(
      valor.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
    );

    return Number.isFinite(numero) ? numero : 0;
  }

  // =============================================
  // FORMATEAR SALDO
  // =============================================

  formatearSaldo(valor: number): string {
    return valor.toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    });
  }

  // =============================================
  // NORMALIZAR TEXTO
  // =============================================

  private normalizar(valor: string): string {
    return valor
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // =============================================
  // SELECCIÓN DE RIESGOS
  // =============================================

  alternarRiesgoObligacion(riesgo: string): void {

    const riesgos = this.filtrosObligaciones.riesgos;

    if (riesgos.includes(riesgo)) {
      this.filtrosObligaciones.riesgos =
        riesgos.filter(item => item !== riesgo);
    } else {
      this.filtrosObligaciones.riesgos = [...riesgos, riesgo];
    }
  }

  // =============================================
  // APLICAR FILTROS
  // =============================================

  aplicarFiltrosObligaciones(): void {

    this.filtrosAplicadosObligaciones = {
      ...this.filtrosObligaciones,
      riesgos: [...this.filtrosObligaciones.riesgos]
    };

    this.mostrarFiltroObligaciones = false;

    this.validarDetalleObligacion();
  }

  // =============================================
  // LIMPIAR FILTROS
  // =============================================

  limpiarFiltrosObligaciones(): void {

    this.filtrosObligaciones = this.obtenerFiltrosVacios();
    this.filtrosAplicadosObligaciones = this.obtenerFiltrosVacios();
    this.busquedaObligaciones = '';

    this.validarDetalleObligacion();
  }

  // =============================================
  // CONTADOR DE FILTROS ACTIVOS
  // =============================================

  get cantidadFiltrosActivosObligaciones(): number {

    const filtros = this.filtrosAplicadosObligaciones;

    return (
      filtros.riesgos.length +
      (filtros.producto ? 1 : 0) +
      (filtros.asociado ? 1 : 0) +
      (filtros.diasMoraDesde !== null ? 1 : 0) +
      (filtros.diasMoraHasta !== null ? 1 : 0) +
      (filtros.saldoVencidoDesde !== null ? 1 : 0) +
      (filtros.saldoVencidoHasta !== null ? 1 : 0)
    );
  }

  // =============================================
  // FILTROS ACTIVOS VISIBLES
  // =============================================

  get filtrosVisiblesObligaciones(): { clave: string; texto: string }[] {

    const filtros = this.filtrosAplicadosObligaciones;
    const visibles: { clave: string; texto: string }[] = [];

    filtros.riesgos.forEach(riesgo => {
      visibles.push({
        clave: `riesgo:${riesgo}`,
        texto: `Riesgo: ${riesgo}`
      });
    });

    if (filtros.producto) {
      visibles.push({
        clave: 'producto',
        texto: `Producto: ${filtros.producto}`
      });
    }

    if (filtros.asociado) {
      visibles.push({
        clave: 'asociado',
        texto: `Asociado: ${filtros.asociado}`
      });
    }

    if (filtros.diasMoraDesde !== null) {
      visibles.push({
        clave: 'diasMoraDesde',
        texto: `Mora desde: ${filtros.diasMoraDesde}`
      });
    }

    if (filtros.diasMoraHasta !== null) {
      visibles.push({
        clave: 'diasMoraHasta',
        texto: `Mora hasta: ${filtros.diasMoraHasta}`
      });
    }

    if (filtros.saldoVencidoDesde !== null) {
      visibles.push({
        clave: 'saldoVencidoDesde',
        texto: `Saldo desde: ${filtros.saldoVencidoDesde}`
      });
    }

    if (filtros.saldoVencidoHasta !== null) {
      visibles.push({
        clave: 'saldoVencidoHasta',
        texto: `Saldo hasta: ${filtros.saldoVencidoHasta}`
      });
    }

    return visibles;
  }

  // =============================================
  // QUITAR FILTRO ACTIVO
  // =============================================

  quitarFiltroObligacion(clave: string): void {

    const filtros = this.filtrosAplicadosObligaciones;

    if (clave.startsWith('riesgo:')) {
      const riesgo = clave.split(':')[1];
      filtros.riesgos = filtros.riesgos.filter(item => item !== riesgo);

    } else if (clave === 'producto') {
      filtros.producto = '';

    } else if (clave === 'asociado') {
      filtros.asociado = '';

    } else if (clave === 'diasMoraDesde') {
      filtros.diasMoraDesde = null;

    } else if (clave === 'diasMoraHasta') {
      filtros.diasMoraHasta = null;

    } else if (clave === 'saldoVencidoDesde') {
      filtros.saldoVencidoDesde = null;

    } else if (clave === 'saldoVencidoHasta') {
      filtros.saldoVencidoHasta = null;
    }

    this.filtrosAplicadosObligaciones = {
      ...filtros,
      riesgos: [...filtros.riesgos]
    };

    this.filtrosObligaciones = {
      ...this.filtrosAplicadosObligaciones,
      riesgos: [...this.filtrosAplicadosObligaciones.riesgos]
    };

    this.validarDetalleObligacion();
  }

  // =============================================
  // SELECCIÓN DE OBLIGACIONES
  // =============================================

  get todasObligacionesSeleccionadas(): boolean {

    return this.obligacionesFiltradas.length > 0 &&
      this.obligacionesFiltradas.every(obligacion =>
        this.obligacionesSeleccionadas.includes(obligacion.id)
      );
  }

  seleccionarTodasObligaciones(checked: boolean): void {

    const obligacionesVisibles = this.obligacionesFiltradas;
    const idsVisibles = obligacionesVisibles.map(
      obligacion => obligacion.id
    );

    if (checked) {

      this.obligacionesSeleccionadas = [
        ...new Set([
          ...this.obligacionesSeleccionadas,
          ...idsVisibles
        ])
      ];

      if (obligacionesVisibles.length > 0) {
        this.verDetalleDesdeObligacion(obligacionesVisibles[0]);
      }

    } else {

      this.obligacionesSeleccionadas =
        this.obligacionesSeleccionadas.filter(
          id => !idsVisibles.includes(id)
        );

      if (
        this.obligacionSeleccionadaDetalle &&
        idsVisibles.includes(this.obligacionSeleccionadaDetalle.id)
      ) {
        this.obligacionSeleccionadaDetalle = null;
      }
    }
  }

  seleccionarObligacion(id: string, checked: boolean): void {

    const obligacion = this.obligaciones.find(
      item => item.id === id
    );

    if (checked) {

      if (!this.obligacionesSeleccionadas.includes(id)) {
        this.obligacionesSeleccionadas = [
          ...this.obligacionesSeleccionadas,
          id
        ];
      }

      if (obligacion) {
        this.verDetalleDesdeObligacion(obligacion);
      }

    } else {

      this.obligacionesSeleccionadas =
        this.obligacionesSeleccionadas.filter(
          obligacionId => obligacionId !== id
        );

      if (this.obligacionSeleccionadaDetalle?.id === id) {
        this.obligacionSeleccionadaDetalle = null;
      }
    }
  }

  obligacionSeleccionada(id: string): boolean {
    return this.obligacionesSeleccionadas.includes(id);
  }

  // =============================================
  // VALIDAR DETALLE CON FILTROS
  // =============================================

  private validarDetalleObligacion(): void {

    if (!this.obligacionSeleccionadaDetalle) {
      return;
    }

    const sigueVisible = this.obligacionesFiltradas.some(
      obligacion =>
        obligacion.id === this.obligacionSeleccionadaDetalle?.id
    );

    if (!sigueVisible) {
      this.obligacionSeleccionadaDetalle = null;
    }
  }

  // =============================================
  // CAMBIAR ENTRE ASOCIADOS Y OBLIGACIONES
  // =============================================

  seleccionarTipoConsulta(
    tipo: 'Asociados' | 'Obligaciones'
  ): void {

    this.tipoConsultaActiva = tipo;

    this.casosSeleccionados = [];
    this.obligacionesSeleccionadas = [];

    this.cerrarDetalleAsociado();
    this.cerrarDetalleObligacion();

    this.busquedaObligaciones = '';
    this.limpiarFiltrosObligaciones();
    this.mostrarFiltroObligaciones = false;

    this.tipoConsultaSeleccionado.emit(tipo);
  }

  // =============================================
  // CLASES DE RIESGO
  // =============================================

  claseRiesgo(riesgo: string): string {
    return this.normalizar(riesgo);
  }
}
