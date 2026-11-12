
import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  HttpErrorResponse,
  HttpEventType
} from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import {
  CarteraService,
  BatchUploadResponse,
  BatchHistoryItem,
  BatchRowError
} from '../../../../service/cartera.service';

@Component({
  selector: 'app-integracion-cartera',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './integracion-cartera.component.html',
  styleUrl: './integracion-cartera.component.css'
})
export class IntegracionCarteraComponent implements OnInit, OnDestroy {

  constructor(
    private carteraService: CarteraService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  // =========================================
  // ESTADO GENERAL
  // =========================================

  cargandoHistorial = false;
  private recargaHistorialPendiente = false;
  cargandoArchivo = false;
  errorCarga = '';

  resultadoCarga: BatchUploadResponse | null = null;

  // =========================================
  // INDICADORES DE INTEGRACIÓN
  // =========================================

  kpis = [
    {
      titulo: 'Lotes procesados',
      valor: '—',
      variacion: '',
      descripcion: 'Total registrado',
      icono: 'lotes'
    },
    {
      titulo: 'Casos creados',
      valor: '—',
      variacion: '',
      descripcion: 'En la última carga',
      icono: 'casos'
    },
    {
      titulo: 'Registros rechazados',
      valor: '—',
      variacion: '',
      descripcion: 'Según historial',
      icono: 'rechazados'
    },
    {
      titulo: 'Última carga exitosa',
      valor: '—',
      variacion: '',
      descripcion: '',
      icono: 'fecha'
    }
  ];

  // =========================================
  // PASOS DE INTEGRACIÓN
  // =========================================

  pasoActual = 1;

  pasos = [
    { numero: 1, nombre: 'Archivo' },
    { numero: 2, nombre: 'Validar estructura' },
    { numero: 3, nombre: 'Revisar errores' },
    { numero: 4, nombre: 'Confirmar carga' },
    { numero: 5, nombre: 'Resultado' }
  ];

  // =========================================
  // ETAPAS INFORMATIVAS
  // =========================================

  etapasValidacion = [
    {
      numero: 1,
      nombre: 'Estructura del archivo',
      descripcion: 'Validando el formato del CSV'
    },
    {
      numero: 2,
      nombre: 'Campos obligatorios',
      descripcion: 'Comprobando los campos requeridos'
    },
    {
      numero: 3,
      nombre: 'Formatos de fecha',
      descripcion: 'Validando las fechas de los registros'
    },
    {
      numero: 4,
      nombre: 'Consistencia de saldos',
      descripcion: 'Revisando los valores de cartera'
    },
    {
      numero: 5,
      nombre: 'Registros duplicados',
      descripcion: 'Detectando registros repetidos'
    },
    {
      numero: 6,
      nombre: 'Catálogos permitidos',
      descripcion: 'Verificando los valores permitidos'
    }
  ];

  // =========================================
  // HISTORIAL DE LOTES
  // =========================================

  lotes: any[] = [];

  mostrarHistorialLotes = false;
  paginaActual = 0;
  tamanioPagina = 10;
  totalPaginas = 0;
  totalLotes = 0;
  busquedaLotes = '';
  estadoFiltroLotes = '';
  mostrarFiltrosLotes = false;

  loteMenuAbierto: number | null = null;
  loteMenuPosition: { top: number; left: number } | null = null;

  descargandoErrores = false;

  get lotesRecientes(): any[] {
    return this.lotes.slice(0, 5);
  }

  get cargaExitosa(): boolean {
    return this.resultadoCarga
      ? this.esEstadoExitoso(this.estadoResultado)
      : !!this.loteSeguimiento &&
        this.esEstadoExitoso(this.loteSeguimiento.status);
  }

  get hayResultadoCarga(): boolean {
    return !!this.resultadoCarga ||
      (!!this.loteSeguimiento &&
        this.esLoteFinalizado(this.loteSeguimiento));
  }

  get etapaActualValidacion(): number {
    if (!this.procesando) {
      return this.etapasValidacion.length + 1;
    }

    if (
      this.loteSeguimiento &&
      this.esLoteFinalizado(this.loteSeguimiento)
    ) {
      return this.etapasValidacion.length + 1;
    }

    if (!this.loteSeguimiento) {
      return this.envioArchivoCompleto ? 2 : 1;
    }

    const fase = this.normalizarTexto(
      `${this.loteSeguimiento.progressPhase || ''} ${
        this.loteSeguimiento.progressMessage || ''
      }`
    );

    const etapaPorFase = [
      /estructura|header|encabezado|schema/,
      /obligator|required|campo/,
      /fecha|date|formato/,
      /saldo|balance|consisten/,
      /duplic/,
      /catalog/
    ].findIndex(patron => patron.test(fase));

    if (etapaPorFase >= 0) {
      return etapaPorFase + 1;
    }

    if (/staging|reading|parsing|lectura/.test(fase)) {
      return 1;
    }

    if (/promot|persist|saving|guardando|completed|completado/.test(fase)) {
      return 6;
    }

    if (/validat|validation|validacion/.test(fase)) {
      return 2;
    }

    const porcentaje = this.loteSeguimiento.progressPercent;

    if (Number.isFinite(porcentaje)) {
      return Math.min(
        this.etapasValidacion.length,
        Math.floor(
          Math.max(0, porcentaje) / 100 *
          this.etapasValidacion.length
        ) + 1
      );
    }

    return 1;
  }

  estadoEtapaValidacion(numero: number): string {
    if (numero < this.etapaActualValidacion || !this.procesando) {
      return 'Completado';
    }

    return numero === this.etapaActualValidacion
      ? 'En proceso'
      : 'Pendiente';
  }

  get lotesRecientesFiltrados(): any[] {
    const termino = this.busquedaLotes.trim().toLocaleLowerCase('es-CO');

    return this.lotesRecientes.filter(lote => {
      const coincideBusqueda = !termino ||
        `${lote.archivo} ${lote.usuario}`
          .toLocaleLowerCase('es-CO')
          .includes(termino);

      const coincideEstado =
        !this.estadoFiltroLotes || lote.estado === this.estadoFiltroLotes;

      return coincideBusqueda && coincideEstado;
    });
  }

  // =========================================
  // SELECCIÓN DEL ARCHIVO
  // =========================================

  archivoSeleccionado: File | null = null;
  arrastrandoArchivo = false;
  layoutSeleccionado = 'Layout Cartera v3.2';
  tipoCarteraSeleccionado = 'Cartera administrativa';
  fechaCorte = '2024-05-25';

  errorArchivo = '';

  // =========================================
  // PROCESAMIENTO Y SEGUIMIENTO DEL LOTE
  // =========================================

  progreso = 0;
  progresoDisponible = false;
  envioArchivoCompleto = false;
  procesando = false;

  loteSeguimiento: BatchHistoryItem | null = null;

  errorSeguimiento = '';
  tiempoTranscurrido = '00:00:00';

  private cargaInicio = 0;
  private cargaVersion = 0;

  private idsLotesPrevios = new Set<number>();

  private temporizadorSeguimiento: ReturnType<typeof setTimeout> | null = null;
  private temporizadorTiempo: ReturnType<typeof setInterval> | null = null;

  private suscripcionSeguimiento: Subscription | null = null;
  private suscripcionCarga: Subscription | null = null;

  mostrarModalCancelar = false;
  mostrarResumenCancelacion = false;

  // =========================================
  // RESUMEN DE CANCELACIÓN
  // =========================================

  resumenCancelacion = {
    nombreArchivo: '',
    porcentajeAlcanzado: 0,
    registrosProcesados: 0,
    registrosPendientes: 0,
    fechaHora: '',
    estado: 'Carga no iniciada'
  };

  // =========================================
  // RESUMEN DE VALIDACIÓN
  // =========================================

  resumenValidacion = {
    registrosLeidos: 0,
    registrosValidos: 0,
    registrosObservaciones: 0,
    registrosRechazados: 0
  };

  // =========================================
  // ERRORES DEVUELTOS POR EL BACKEND
  // =========================================

  erroresDemostracion: {
    fila: number;
    campo: string;
    valor: string;
    error: string;
    codigo?: string;
  }[] = [];

  // =========================================
  // RESULTADOS DE PROMOCIÓN
  // =========================================

  cargasConfirmacion = [
    {
      nombre: 'Clientes procesados',
      cantidadFinal: 0,
      cantidad: 0,
      progreso: 0,
      unidad: 'clientes'
    },
    {
      nombre: 'Obligaciones procesadas',
      cantidadFinal: 0,
      cantidad: 0,
      progreso: 0,
      unidad: 'obligaciones'
    },
    {
      nombre: 'Puntuaciones generadas',
      cantidadFinal: 0,
      cantidad: 0,
      progreso: 0,
      unidad: 'puntuaciones'
    },
    {
      nombre: 'Casos creados',
      cantidadFinal: 0,
      cantidad: 0,
      progreso: 0,
      unidad: 'casos'
    },
    {
      nombre: 'Registros rechazados',
      cantidadFinal: 0,
      cantidad: 0,
      progreso: 0,
      unidad: 'registros'
    }
  ];

  // =========================================
  // RESULTADO DEL LOTE
  // =========================================

  mensajeResultado = '';
  estadoResultado = '';

  // =========================================
  // INICIALIZACIÓN
  // =========================================

  ngOnInit(): void {
    this.cargarHistorial();
  }

  // =========================================
  // CONSULTAR HISTORIAL
  // =========================================

  cargarHistorial(): void {

    if (this.cargandoHistorial) {
      this.recargaHistorialPendiente = true;
      return;
    }

    this.cargandoHistorial = true;

    this.carteraService.getBatches(
      this.paginaActual,
      this.tamanioPagina
    ).subscribe({
      next: respuesta => {

        this.lotes = respuesta.content.map(
          lote => this.mapearLote(lote)
        );

        this.totalPaginas = respuesta.totalPages;
        this.totalLotes = respuesta.totalElements;

        this.actualizarKpis(respuesta.content);

        this.cargandoHistorial = false;

        if (this.recargaHistorialPendiente) {
          this.recargaHistorialPendiente = false;
          this.cargarHistorial();
        }
      },

      error: error => {

        console.error(
          'Error consultando historial de lotes:',
          error
        );

        this.lotes = [];
        this.cargandoHistorial = false;

        if (this.recargaHistorialPendiente) {
          this.recargaHistorialPendiente = false;
          this.cargarHistorial();
        }
      }
    });
  }

  // =========================================
  // MAPEAR LOTE PARA LA TABLA
  // =========================================

  private mapearLote(lote: BatchHistoryItem): any {

    return {
      id: lote.batchNumber || `LOT-${lote.id}`,
      batchId: lote.id,

      archivo: lote.fileName || 'Archivo no disponible',

      usuario:
        lote.uploadedByName ||
        lote.uploadedByUsername ||
        'No disponible',

      fecha: this.formatearFecha(
        lote.uploadedAt || lote.createdAt
      ),

      leidos: lote.totalRecords ?? 0,
      validos: lote.successfulRecords ?? 0,
      rechazados: lote.failedRecords ?? 0,
      casos: lote.casesCreated ?? '—',

      estado: this.formatearEstadoLote(lote.status || 'Sin estado'),

      mensaje: lote.errorMessage || '',
      porcentaje: lote.progressPercent ?? 0
    };
  }

  actualizarBusquedaLotes(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.busquedaLotes = event.target.value;
    }
  }

  actualizarFiltroEstadoLotes(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.estadoFiltroLotes = event.target.value;
    }
  }

  // =========================================
  // MENÚ DE ACCIONES DEL LOTE
  // =========================================

  alternarMenuLote(batchId: number, event: MouseEvent): void {
    event.stopPropagation();

    if (this.loteMenuAbierto === batchId) {
      this.cerrarMenuLote();
      return;
    }

    const boton = event.currentTarget;

    if (!(boton instanceof HTMLElement)) {
      return;
    }

    const rect = boton.getBoundingClientRect();
    const anchoMenu = 226;
    const altoMenu = 152;
    const margen = 8;
    const espacioAbajo = window.innerHeight - rect.bottom;

    const top = espacioAbajo >= altoMenu + margen
      ? rect.bottom + margen
      : Math.max(margen, rect.top - altoMenu - margen);

    const left = Math.max(
      margen,
      Math.min(
        rect.right - anchoMenu,
        window.innerWidth - anchoMenu - margen
      )
    );

    this.loteMenuPosition = { top, left };
    this.loteMenuAbierto = batchId;
  }

  @HostListener('document:click')
  cerrarMenuLote(): void {
    this.loteMenuAbierto = null;
    this.loteMenuPosition = null;
  }

  @HostListener('document:keydown.escape')
  cerrarMenuLoteConEscape(): void {
    this.loteMenuAbierto = null;
    this.loteMenuPosition = null;
  }

  // =========================================
  // DESCARGAR REPORTE CSV DE ERRORES
  // GET /integration/batches/{id}/error-report
  // =========================================

  descargarErroresLote(
    lote: { batchId: number; archivo: string }
  ): void {

    this.cerrarMenuLote();

    if (!lote || !Number.isFinite(Number(lote.batchId))) {
      window.alert('No se encontró el identificador del lote.');
      return;
    }

    if (this.descargandoErrores) {
      return;
    }

    this.descargandoErrores = true;

    this.carteraService
      .downloadBatchErrorReport(Number(lote.batchId))
      .subscribe({

        next: archivo => {

          this.descargandoErrores = false;

          if (!(archivo instanceof Blob) || archivo.size === 0) {
            window.alert(
              'El servidor no devolvió un reporte de errores para este lote.'
            );
            return;
          }

          const url = window.URL.createObjectURL(archivo);
          const enlace = document.createElement('a');

          const nombreBase = (lote.archivo || 'lote')
            .replace(/\.csv$/i, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_');

          enlace.href = url;
          enlace.download = `${nombreBase}_errores.csv`;

          document.body.appendChild(enlace);
          enlace.click();
          document.body.removeChild(enlace);

          window.setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, 1000);
        },

        error: (error: HttpErrorResponse) => {

          this.descargandoErrores = false;

          console.error(
            'Error descargando reporte de errores del lote:',
            error
          );

          if (error.status === 404) {
            window.alert(
              'No se encontró un reporte de errores para este lote.'
            );
            return;
          }

          if (error.status === 204) {
            window.alert(
              'Este lote no tiene registros rechazados ni errores.'
            );
            return;
          }

          if (error.status === 401 || error.status === 403) {
            window.alert(
              'No tienes autorización para descargar el reporte de este lote.'
            );
            return;
          }

          window.alert(
            'No fue posible descargar el reporte de errores. Inténtalo nuevamente.'
          );
        }
      });
  }

  // =========================================
  // FORMATEAR NÚMEROS
  // =========================================

  formatearNumero(valor: number | string | null | undefined): string {
    return typeof valor === 'number' && Number.isFinite(valor)
      ? valor.toLocaleString('es-CO')
      : typeof valor === 'string'
        ? valor
        : '—';
  }

  private formatearEstadoLote(estado: string): string {
    const valor = estado.toUpperCase().replace(/[\s_-]+/g, '');

    if ([
      'SUCCESS',
      'SUCCESSFUL',
      'COMPLETED',
      'PROCESSED',
      'PROCESADO',
      'EXITOSO',
      'EXITOSA'
    ].includes(valor)) {
      return 'Exitoso';
    }

    if ([
      'PARTIALSUCCESS',
      'COMPLETEDWITHERRORS',
      'WITHERRORS',
      'CONERRORES'
    ].includes(valor)) {
      return 'Con errores';
    }

    if ([
      'FAILED',
      'FAILURE',
      'REJECTED',
      'RECHAZADO',
      'RECHAZADA',
      'ERROR'
    ].includes(valor)) {
      return 'Rechazado';
    }

    return estado;
  }

  // =========================================
  // ACTUALIZAR KPI CON HISTORIAL REAL
  // =========================================

  private actualizarKpis(lotes: BatchHistoryItem[]): void {
    const loteMasReciente = this.obtenerLoteMasReciente(lotes);

    const ultimaCargaExitosa = this.obtenerLoteMasReciente(
      lotes.filter(lote => this.esEstadoExitoso(lote.status))
    );

    const resultadoCarga = this.resultadoCarga;

    const resultadoCargaDelLote = resultadoCarga &&
      resultadoCarga.batchId === loteMasReciente?.id
      ? resultadoCarga
      : null;

    this.kpis[0].valor = this.totalLotes.toLocaleString('es-CO');

    const casosCreados = loteMasReciente?.casesCreated ??
      resultadoCargaDelLote?.casesCreated;

    const registrosRechazados = loteMasReciente?.failedRecords ??
      resultadoCargaDelLote?.failedRecords;

    this.kpis[1].valor = typeof casosCreados === 'number'
      ? casosCreados.toLocaleString('es-CO')
      : '—';

    this.kpis[1].descripcion = 'En la última carga';

    this.kpis[2].valor = typeof registrosRechazados === 'number'
      ? registrosRechazados.toLocaleString('es-CO')
      : '—';

    this.kpis[2].descripcion = 'En la última carga';

    const fechaUltimaCarga = ultimaCargaExitosa
      ? this.formatearFechaUltimaCarga(
          ultimaCargaExitosa.processedAt ||
          ultimaCargaExitosa.uploadedAt
        )
      : null;

    this.kpis[3].valor = fechaUltimaCarga?.fecha ?? '—';
    this.kpis[3].variacion = fechaUltimaCarga?.hora ?? '';
    this.kpis[3].descripcion = fechaUltimaCarga?.periodo ?? '';
  }

  private obtenerLoteMasReciente(
    lotes: BatchHistoryItem[]
  ): BatchHistoryItem | undefined {

    return lotes.reduce<BatchHistoryItem | undefined>((masReciente, lote) => {
      if (!masReciente) {
        return lote;
      }

      const fechaLote = Date.parse(
        lote.processedAt || lote.uploadedAt || lote.createdAt || ''
      );

      const fechaMasReciente = Date.parse(
        masReciente.processedAt ||
        masReciente.uploadedAt ||
        masReciente.createdAt ||
        ''
      );

      return Number.isFinite(fechaLote) &&
        (!Number.isFinite(fechaMasReciente) ||
          fechaLote > fechaMasReciente)
        ? lote
        : masReciente;
    }, undefined);
  }

  private formatearFechaUltimaCarga(
    fecha: string | null
  ): { fecha: string; hora: string; periodo: string } | null {

    if (!fecha) {
      return null;
    }

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
      console.error('Fecha de última carga inválida:', fecha);
      return null;
    }

    const dia = String(valor.getDate()).padStart(2, '0');
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const anio = valor.getFullYear();

    const horas = valor.getHours();
    const hora12 = horas % 12 || 12;
    const minutos = String(valor.getMinutes()).padStart(2, '0');

    return {
      fecha: `${dia}/${mes}/${anio}`,
      hora: `${hora12}:${minutos}`,
      periodo: horas >= 12 ? 'pm' : 'am'
    };
  }

  // =========================================
  // IDENTIFICAR ESTADOS
  // =========================================

  private esEstadoExitoso(estado: string): boolean {
    const valor = (estado || '').toUpperCase().replace(/[\s_-]+/g, '');

    return [
      'SUCCESS',
      'SUCCESSFUL',
      'COMPLETED',
      'PROCESSED',
      'PROCESADO',
      'EXITOSO',
      'EXITOSA'
    ].includes(valor);
  }

  private tieneFechaProcesamiento(fecha: string | null): boolean {
    return !!fecha && Number.isFinite(Date.parse(fecha));
  }

  private esLoteFinalizado(lote: BatchHistoryItem): boolean {
    return this.esEstadoFinalizado(lote.status || '') ||
      this.tieneFechaProcesamiento(lote.processedAt) ||
      (
        Number.isFinite(lote.progressPercent) &&
        lote.progressPercent >= 100
      );
  }

  private esEstadoFinalizado(estado: string): boolean {
    const valor = (estado || '').toUpperCase().replace(/[\s_-]+/g, '');

    return [
      'SUCCESS',
      'SUCCESSFUL',
      'COMPLETED',
      'COMPLETEDWITHERRORS',
      'PROCESSED',
      'PROCESADO',
      'EXITOSO',
      'EXITOSA',
      'PARTIALSUCCESS',
      'WITHERRORS',
      'FAILED',
      'FAILURE',
      'REJECTED',
      'RECHAZADO',
      'RECHAZADA',
      'ERROR',
      'CANCELLED',
      'CANCELED'
    ].includes(valor);
  }

  private normalizarTexto(valor: string): string {
    return valor
      .toLocaleLowerCase('es-CO')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // =========================================
  // INICIAR SEGUIMIENTO DEL LOTE
  // =========================================

  private iniciarSeguimientoLote(version: number): void {

    this.idsLotesPrevios = new Set(
      this.lotes
        .map(lote => Number(lote.batchId))
        .filter(id => Number.isFinite(id))
    );

    this.loteSeguimiento = null;
    this.errorSeguimiento = '';

    this.cargaInicio = Date.now();

    this.actualizarTiempoTranscurrido();

    this.temporizadorTiempo = setInterval(
      () => this.actualizarTiempoTranscurrido(),
      1000
    );

    this.consultarProgresoLote(version);
  }

  // =========================================
  // BUSCAR EL LOTE NUEVO EN EL HISTORIAL
  // =========================================

  private consultarProgresoLote(version: number): void {

    if (version !== this.cargaVersion || !this.cargandoArchivo) {
      return;
    }

    this.suscripcionSeguimiento = this.carteraService
      .getBatches(0, this.tamanioPagina)
      .subscribe({

        next: respuesta => {

          if (version !== this.cargaVersion || !this.cargandoArchivo) {
            return;
          }

          if (!Array.isArray(respuesta?.content)) {
            console.error(
              'El historial de lotes devolvió una respuesta sin la lista content:',
              respuesta
            );

            this.errorSeguimiento =
              'El servidor respondió con un formato de historial inesperado. Se volverá a intentar.';

            this.programarConsultaProgreso(version, 5000);
            return;
          }

          this.errorSeguimiento = '';

          const nombreArchivo = this.archivoSeleccionado?.name
            .trim()
            .toLocaleLowerCase('es-CO');

          const lotesNuevos = respuesta.content
            .filter(item => {
              const fechaCarga = Date.parse(
                item.uploadedAt || item.createdAt || ''
              );

              const loteNuevo = !this.idsLotesPrevios.has(item.id);

              const fechaValida =
                !Number.isFinite(fechaCarga) ||
                fechaCarga >= this.cargaInicio - 10000;

              return loteNuevo && fechaValida;
            })
            .sort((primero, segundo) =>
              Date.parse(
                segundo.uploadedAt || segundo.createdAt || ''
              ) -
              Date.parse(
                primero.uploadedAt || primero.createdAt || ''
              )
            );

          const loteCoincidente = lotesNuevos.find(item =>
            (item.fileName || '')
              .trim()
              .toLocaleLowerCase('es-CO') === nombreArchivo
          );

          const lote = loteCoincidente ||
            (lotesNuevos.length === 1 ? lotesNuevos[0] : null);

          if (lote) {
            this.loteSeguimiento = lote;
            this.envioArchivoCompleto = true;
            this.actualizarProgresoDesdeHistorial(lote);

            if (!this.esLoteFinalizado(lote)) {
              this.programarConsultaProgreso(version);
            }

            return;
          }

          this.programarConsultaProgreso(version);
        },

        error: error => {

          if (version !== this.cargaVersion || !this.cargandoArchivo) {
            return;
          }

          console.error(
            'Error consultando historial de lotes:',
            error
          );

          this.errorSeguimiento =
            'El lote aún no aparece en el historial. Se volverá a intentar.';

          this.programarConsultaProgreso(version, 5000);
        }
      });
  }

  private actualizarProgresoDesdeHistorial(lote: BatchHistoryItem): void {

    if (Number.isFinite(lote.progressPercent)) {
      this.progresoDisponible = true;

      this.progreso = Math.max(
        0,
        Math.min(100, Math.round(lote.progressPercent))
      );
    }

    this.resumenValidacion = {
      registrosLeidos: lote.totalRecords ?? 0,
      registrosValidos: lote.successfulRecords ?? 0,
      registrosObservaciones: 0,
      registrosRechazados: lote.failedRecords ?? 0
    };

    this.errorSeguimiento = '';
  }

  // =========================================
  // PROGRAMAR SIGUIENTE CONSULTA
  // =========================================

  private programarConsultaProgreso(
    version: number,
    demora = 2000
  ): void {

    if (this.temporizadorSeguimiento) {
      clearTimeout(this.temporizadorSeguimiento);
    }

    this.temporizadorSeguimiento = setTimeout(() => {
      this.consultarProgresoLote(version);
    }, demora);
  }

  // =========================================
  // TIEMPO TRANSCURRIDO
  // =========================================

  private actualizarTiempoTranscurrido(): void {

    if (!this.cargaInicio) {
      this.tiempoTranscurrido = '00:00:00';
      return;
    }

    const segundos = Math.floor(
      (Date.now() - this.cargaInicio) / 1000
    );

    const horas = String(
      Math.floor(segundos / 3600)
    ).padStart(2, '0');

    const minutos = String(
      Math.floor((segundos % 3600) / 60)
    ).padStart(2, '0');

    const restoSegundos = String(
      segundos % 60
    ).padStart(2, '0');

    this.tiempoTranscurrido =
      `${horas}:${minutos}:${restoSegundos}`;
  }

  // =========================================
  // DETENER SEGUIMIENTO
  // =========================================

  private detenerSeguimientoLote(): void {

    if (this.temporizadorSeguimiento) {
      clearTimeout(this.temporizadorSeguimiento);
      this.temporizadorSeguimiento = null;
    }

    if (this.temporizadorTiempo) {
      clearInterval(this.temporizadorTiempo);
      this.temporizadorTiempo = null;
    }

    this.suscripcionSeguimiento?.unsubscribe();
    this.suscripcionSeguimiento = null;
  }

  // =========================================
  // PAGINACIÓN
  // =========================================

  cambiarPagina(pagina: number): void {

    if (
      pagina < 0 ||
      pagina >= this.totalPaginas ||
      pagina === this.paginaActual
    ) {
      return;
    }

    this.paginaActual = pagina;
    this.cargarHistorial();
  }

  paginaAnterior(): void {
    this.cambiarPagina(this.paginaActual - 1);
  }

  paginaSiguiente(): void {
    this.cambiarPagina(this.paginaActual + 1);
  }

  // =========================================
  // SELECCIONAR ARCHIVO
  // =========================================

  seleccionarArchivo(event: Event): void {

    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];

    this.validarArchivo(archivo, input);
  }

  arrastrarArchivo(event: DragEvent): void {
    event.preventDefault();
    this.arrastrandoArchivo = true;
  }

  salirArrastreArchivo(event: DragEvent): void {
    event.preventDefault();
    this.arrastrandoArchivo = false;
  }

  soltarArchivo(event: DragEvent): void {
    event.preventDefault();
    this.arrastrandoArchivo = false;

    this.validarArchivo(event.dataTransfer?.files[0]);
  }

  private validarArchivo(
    archivo: File | undefined,
    input?: HTMLInputElement
  ): void {

    this.errorArchivo = '';
    this.errorCarga = '';

    if (!archivo) {
      return;
    }

    if (!archivo.name.toLowerCase().endsWith('.csv')) {

      this.errorArchivo = 'El archivo debe tener formato CSV.';

      if (input) {
        input.value = '';
      }

      this.archivoSeleccionado = null;
      return;
    }

    if (archivo.size === 0) {

      this.errorArchivo = 'El archivo CSV está vacío.';

      if (input) {
        input.value = '';
      }

      this.archivoSeleccionado = null;
      return;
    }

    this.reiniciarProcesos();

    this.resultadoCarga = null;
    this.archivoSeleccionado = archivo;
    this.mostrarHistorialLotes = false;
    this.pasoActual = 1;
  }

  // =========================================
  // ELIMINAR ARCHIVO SELECCIONADO
  // =========================================

  quitarArchivo(input: HTMLInputElement): void {

    this.reiniciarProcesos();

    this.archivoSeleccionado = null;
    this.errorArchivo = '';
    this.errorCarga = '';

    input.value = '';

    this.pasoActual = 1;
  }

  // =========================================
  // CONTINUAR A VALIDACIÓN
  // =========================================

  continuarValidacion(): void {

    if (!this.archivoSeleccionado || this.cargandoArchivo) {
      return;
    }

    this.mostrarResumenCancelacion = false;
    this.pasoActual = 2;

    this.iniciarCargaVisual();
  }

  // =========================================
  // MÉTODO CONSERVADO PARA EL HTML
  // =========================================

  iniciarProcesamientoVisual(): void {
    this.continuarValidacion();
  }

  // =========================================
  // INICIAR CARGA CSV
  // =========================================

  iniciarCargaVisual(): void {

    if (!this.archivoSeleccionado || this.cargandoArchivo) {
      return;
    }

    this.errorCarga = '';
    this.resultadoCarga = null;
    this.estadoResultado = '';
    this.mensajeResultado = '';

    this.erroresDemostracion = [];

    this.progreso = 0;
    this.progresoDisponible = false;
    this.envioArchivoCompleto = false;

    this.procesando = true;
    this.cargandoArchivo = true;

    const version = ++this.cargaVersion;

    this.iniciarSeguimientoLote(version);

    this.cargasConfirmacion.forEach(carga => {
      carga.cantidad = 0;
      carga.cantidadFinal = 0;
      carga.progreso = 0;
    });

    this.suscripcionCarga = this.carteraService.uploadCsv(
      this.archivoSeleccionado
    ).subscribe({

      next: evento => {

        if (version !== this.cargaVersion) {
          return;
        }

        if (evento.type === HttpEventType.UploadProgress) {

          if (!this.loteSeguimiento && evento.total && evento.total > 0) {

            this.progresoDisponible = true;

            this.progreso = Math.min(
              100,
              Math.round(evento.loaded / evento.total * 100)
            );

            this.envioArchivoCompleto =
              evento.loaded >= evento.total;

            if (this.envioArchivoCompleto && !this.loteSeguimiento) {
              this.progreso = 0;
              this.progresoDisponible = false;
            }
          }

          return;
        }

        if (evento.type !== HttpEventType.Response) {
          return;
        }

        const respuesta = evento.body;

        this.suscripcionCarga = null;

        if (!respuesta) {

          if (this.hayResultadoCarga) {
            return;
          }

          this.detenerSeguimientoLote();

          this.errorCarga =
            'El servidor no devolvió el resultado del procesamiento.';

          this.estadoResultado = 'ERROR';
          this.mensajeResultado = this.errorCarga;

          this.procesando = false;
          this.cargandoArchivo = false;

          this.pasoActual = Math.max(this.pasoActual, 3);

          this.mostrarHistorialLotes = true;
          this.cargarHistorial();
          this.changeDetectorRef.detectChanges();

          return;
        }

        this.detenerSeguimientoLote();

        console.log('Carga de cartera completada:', {
          lote: respuesta.batchNumber,
          estado: respuesta.status,
          registrosProcesados: respuesta.totalRecords,
          registrosValidos: respuesta.validRecords,
          registrosRechazados: respuesta.failedRecords,
          clientesActualizados: respuesta.clientsUpserted,
          obligacionesActualizadas: respuesta.obligationsUpserted,
          puntuacionesGeneradas: respuesta.scoresGenerated,
          casosCreados: respuesta.casesCreated
        });

        this.procesarRespuesta(respuesta);

        this.progreso = 100;
        this.progresoDisponible = true;
        this.envioArchivoCompleto = true;

        this.procesando = false;
        this.cargandoArchivo = false;

        this.pasoActual = Math.max(this.pasoActual, 3);

        this.mostrarHistorialLotes = true;
        this.cargarHistorial();
        this.changeDetectorRef.detectChanges();
      },

      // =========================================
      // MANEJO COMPLETO DEL ERROR HTTP
      // =========================================

      error: (error: HttpErrorResponse) => {

        if (version !== this.cargaVersion) {
          return;
        }

        this.suscripcionCarga = null;

        // Mostrar información real recibida del backend.
        this.mostrarDetalleErrorCarga(error);

        if (this.hayResultadoCarga) {

          this.procesando = false;
          this.cargandoArchivo = false;

          this.pasoActual = Math.max(
            this.pasoActual,
            3
          );

          this.detenerSeguimientoLote();
          this.mostrarHistorialLotes = true;
          this.cargarHistorial();

          console.error(
            'Respuesta de carga diferida falló tras finalizar lote:',
            error
          );

          return;
        }

        this.detenerSeguimientoLote();

        const respuesta = error.error as
          BatchUploadResponse | null;

        if (
          respuesta &&
          typeof respuesta === 'object' &&
          !(respuesta instanceof Blob)
        ) {

          this.procesarRespuesta(respuesta);

          this.mostrarHistorialLotes = true;

          this.errorCarga =
            respuesta.message ||
            this.obtenerMensajeError(error);

          this.mensajeResultado = this.errorCarga;

        } else {

          this.errorCarga = this.obtenerMensajeError(error);

          this.estadoResultado = 'ERROR';
          this.mensajeResultado = this.errorCarga;
        }

        this.cargandoArchivo = false;
        this.procesando = false;

        this.pasoActual = 3;

        this.mostrarHistorialLotes = true;
        this.cargarHistorial();

        console.error('Error en la carga CSV:', error);

        this.changeDetectorRef.detectChanges();
      },

      complete: () => {

        if (
          version !== this.cargaVersion ||
          !this.cargandoArchivo ||
          this.hayResultadoCarga
        ) {
          return;
        }

        this.detenerSeguimientoLote();

        this.errorCarga =
          'El servidor cerró la solicitud sin devolver el resultado del procesamiento.';

        this.estadoResultado = 'ERROR';
        this.mensajeResultado = this.errorCarga;

        this.cargandoArchivo = false;
        this.procesando = false;

        this.pasoActual = 3;

        this.mostrarHistorialLotes = true;
        this.cargarHistorial();

        this.changeDetectorRef.detectChanges();
      }
    });
  }

  // =========================================
  // MOSTRAR DETALLE DEL ERROR DEL BACKEND
  // =========================================

  private mostrarDetalleErrorCarga(
    error: HttpErrorResponse
  ): void {

    console.group('========== ERROR DE CARGA CSV ==========');

    console.log('Código HTTP:', error.status);
    console.log('Mensaje HTTP:', error.message);
    console.log('URL:', error.url);
    console.log('Cuerpo del error:', error.error);

    if (error.error instanceof Blob) {

      error.error.text().then(texto => {

        console.log('RESPUESTA DEL BACKEND:', texto);

        try {
          console.log(
            'JSON DEL BACKEND:',
            JSON.parse(texto)
          );
        } catch {
          console.log(
            'La respuesta del backend no contiene JSON válido.'
          );
        }

        console.groupEnd();
      });

      return;
    }

    if (typeof error.error === 'string') {

      console.log('RESPUESTA DEL BACKEND:', error.error);

      try {
        console.log(
          'JSON DEL BACKEND:',
          JSON.parse(error.error)
        );
      } catch {
        console.log('La respuesta es texto plano.');
      }

      console.groupEnd();

      return;
    }

    console.log('JSON DEL BACKEND:', error.error);

    if (error.error && typeof error.error === 'object') {

      console.log(
        'Mensaje del servidor:',
        error.error.message
      );

      console.log(
        'Errores:',
        error.error.errors
      );

      console.log(
        'Detalles:',
        error.error.details
      );

      console.log(
        'Registros rechazados:',
        error.error.rowErrors
      );
    }

    console.groupEnd();
  }

  // =========================================
  // PROCESAR RESPUESTA FINAL DEL BACKEND
  // =========================================

  private procesarRespuesta(
    respuesta: BatchUploadResponse
  ): void {

    this.resultadoCarga = respuesta;

    this.estadoResultado = respuesta.status || 'SIN ESTADO';

    this.mensajeResultado =
      respuesta.message || 'El backend finalizó el procesamiento.';

    this.resumenValidacion = {
      registrosLeidos: respuesta.totalRecords ?? 0,
      registrosValidos: respuesta.validRecords ?? 0,
      registrosObservaciones: 0,
      registrosRechazados: respuesta.failedRecords ?? 0
    };

    this.erroresDemostracion = (
      respuesta.rowErrors || []
    ).map((error: BatchRowError) => ({
      fila: error.rowNumber,
      campo: error.field,
      valor: error.value,
      error: error.message,
      codigo: error.errorCode
    }));

    this.cargasConfirmacion = [
      {
        nombre: 'Clientes procesados',
        cantidadFinal: respuesta.clientsUpserted ?? 0,
        cantidad: respuesta.clientsUpserted ?? 0,
        progreso: 100,
        unidad: 'clientes'
      },
      {
        nombre: 'Obligaciones procesadas',
        cantidadFinal: respuesta.obligationsUpserted ?? 0,
        cantidad: respuesta.obligationsUpserted ?? 0,
        progreso: 100,
        unidad: 'obligaciones'
      },
      {
        nombre: 'Puntuaciones generadas',
        cantidadFinal: respuesta.scoresGenerated ?? 0,
        cantidad: respuesta.scoresGenerated ?? 0,
        progreso: 100,
        unidad: 'puntuaciones'
      },
      {
        nombre: 'Casos creados',
        cantidadFinal: respuesta.casesCreated ?? 0,
        cantidad: respuesta.casesCreated ?? 0,
        progreso: 100,
        unidad: 'casos'
      },
      {
        nombre: 'Registros rechazados',
        cantidadFinal: respuesta.failedRecords ?? 0,
        cantidad: respuesta.failedRecords ?? 0,
        progreso: 100,
        unidad: 'registros'
      }
    ];
  }

  // =========================================
  // MENSAJE DE ERROR HTTP
  // =========================================

  private obtenerMensajeError(error: HttpErrorResponse): string {

    if (error.status === 0) {
      return 'No fue posible conectar con el servidor. Verifica que el backend esté disponible.';
    }

    if (error.status === 400) {
      return 'El archivo CSV es inválido o está vacío.';
    }

    if (error.status === 422) {
      return 'El backend encontró errores de validación y aplicó rollback. No se confirmó la carga.';
    }

    if (error.status === 500) {
      return 'Ocurrió un error interno durante el procesamiento del lote.';
    }

    return error.message ||
      'Ocurrió un error al procesar el archivo.';
  }

  // =========================================
  // CANCELACIÓN
  // =========================================

  cancelarCarga(): void {
    this.confirmarCancelacion();
  }

  abrirModalCancelar(): void {

    if (
      this.mostrarResumenCancelacion ||
      this.pasoActual !== 2 ||
      !this.cargandoArchivo
    ) {
      return;
    }

    this.mostrarModalCancelar = true;
  }

  cerrarModalCancelar(): void {
    this.mostrarModalCancelar = false;
  }

  confirmarCancelacion(): void {

    if (!this.cargandoArchivo) {
      return;
    }

    this.mostrarModalCancelar = false;

    this.resumenCancelacion = {
      nombreArchivo:
        this.archivoSeleccionado?.name || 'Archivo no disponible',

      porcentajeAlcanzado: this.progreso,

      registrosProcesados:
        this.loteSeguimiento?.progressCurrent ?? 0,

      registrosPendientes: Math.max(
        0,
        (this.loteSeguimiento?.progressTotal ?? 0) -
        (this.loteSeguimiento?.progressCurrent ?? 0)
      ),

      fechaHora: new Date().toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short'
      }),

      estado: 'Seguimiento detenido; el lote podría continuar en el servidor'
    };

    this.cargaVersion += 1;

    this.suscripcionCarga?.unsubscribe();
    this.suscripcionCarga = null;

    this.detenerSeguimientoLote();

    this.cargandoArchivo = false;
    this.procesando = false;

    this.mostrarResumenCancelacion = true;
    this.mostrarHistorialLotes = true;

    this.cargarHistorial();
  }

  // =========================================
  // MÉTODOS DE COMPATIBILIDAD CON EL HTML
  // =========================================

  private detenerIntervalo(): void {
    this.procesando = false;
  }

  private reiniciarProcesos(): void {

    this.cargaVersion += 1;

    this.detenerSeguimientoLote();

    this.suscripcionCarga?.unsubscribe();
    this.suscripcionCarga = null;

    this.detenerIntervalo();

    this.progreso = 0;
    this.progresoDisponible = false;
    this.envioArchivoCompleto = false;

    this.loteSeguimiento = null;
    this.errorSeguimiento = '';

    this.cargaInicio = 0;
    this.tiempoTranscurrido = '00:00:00';

    this.mostrarModalCancelar = false;
    this.mostrarResumenCancelacion = false;

    this.resumenCancelacion = {
      nombreArchivo: '',
      porcentajeAlcanzado: 0,
      registrosProcesados: 0,
      registrosPendientes: 0,
      fechaHora: '',
      estado: 'Carga no iniciada'
    };
  }

  // =========================================
  // VOLVER AL PASO DE ARCHIVO
  // =========================================

  volverAlArchivo(): void {

    if (this.cargandoArchivo) {
      return;
    }

    this.reiniciarProcesos();

    this.archivoSeleccionado = null;
    this.errorCarga = '';
    this.resultadoCarga = null;

    this.pasoActual = 1;
  }

  // =========================================
  // FORMATEAR FECHA
  // =========================================

  private formatearFecha(fecha: string | null): string {

    if (!fecha) {
      return '—';
    }

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
      return fecha;
    }

    return valor.toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  // =========================================
  // FORMATEAR TAMAÑO DEL ARCHIVO
  // =========================================

  formatearTamano(bytes: number): string {

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // =========================================
  // FINALIZAR
  // =========================================

  finalizarCarga(): void {

    if (this.cargandoArchivo) {
      return;
    }

    this.reiniciarProcesos();

    this.archivoSeleccionado = null;
    this.errorArchivo = '';
    this.errorCarga = '';

    this.resultadoCarga = null;

    this.resumenValidacion = {
      registrosLeidos: 0,
      registrosValidos: 0,
      registrosObservaciones: 0,
      registrosRechazados: 0
    };

    this.erroresDemostracion = [];

    this.pasoActual = 1;
  }

  subirOtroArchivo(): void {
    this.finalizarCarga();
  }

  // =========================================
  // RESULTADOS
  // =========================================

  verResultadosTemporalmente(): void {

    if (this.pasoActual === 4 && this.hayResultadoCarga) {
      this.pasoActual = 5;
    }
  }

  continuarAConfirmacion(): void {

    if (this.pasoActual === 3 && this.hayResultadoCarga) {
      this.pasoActual = 4;
    }
  }

  // =========================================
  // DESTRUIR COMPONENTE
  // =========================================

  ngOnDestroy(): void {

    this.cargaVersion += 1;

    this.detenerSeguimientoLote();

    this.suscripcionCarga?.unsubscribe();
    this.suscripcionCarga = null;
  }
}
