
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
import { DashboardService } from '../../../../service/dashboard.service';

import { descargarPlantillaCarga } from '../../../../shared/plantilla-carga';

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
    private dashboardService: DashboardService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  // Nombre de quien está conectado (para las cargas rechazadas que no guarda el backend)
  private nombreUsuario = 'Tú';

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
      descripcion: '',
      icono: 'lotes'
    },
    {
      titulo: 'Casos creados',
      valor: '—',
      variacion: '',
      descripcion: '',
      icono: 'casos'
    },
    {
      titulo: 'Registros rechazados',
      valor: '—',
      variacion: '',
      descripcion: '',
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

  // Cargas rechazadas que solo existen en el frontend (el backend no creó el lote)
  get cargasLocales(): any[] {
    return this.carteraService.cargasRechazadasLocales;
  }

  private unirConLocales(lista: any[]): any[] {
    if (this.cargasLocales.length === 0) return lista;
    return [...this.cargasLocales, ...lista]
      .sort((a, b) => (b.marcaTiempo ?? 0) - (a.marcaTiempo ?? 0));
  }

  get lotesRecientes(): any[] {
    return this.unirConLocales(this.lotes).slice(0, 5);
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

  // =========================================
  // FILTROS DE LA TABLA (igual que Inicio > Casos en gestión)
  // =========================================

  readonly estadosLote = ['Exitoso', 'Con errores', 'Rechazado', 'Anulado', 'En proceso'];

  // Lo que se está marcando dentro de la ventana
  filtrosLotes = this.filtrosVacios();

  // Lo que ya se aplicó con "Aplicar filtros"
  filtrosLotesAplicados = this.filtrosVacios();

  // Todos los lotes (para filtrar más allá de los 5 recientes)
  todosLosLotes: any[] = [];

  private filtrosVacios() {
    return {
      estados: [] as string[],
      usuario: '',
      desde: '',
      hasta: '',
      rechazados: '' as '' | 'con' | 'sin'
    };
  }

  private copiarFiltros(f: ReturnType<IntegracionCarteraComponent['filtrosVacios']>) {
    return { ...f, estados: [...f.estados] };
  }

  // true cuando no hay espacio debajo y la ventana se abre hacia arriba
  filtrosHaciaArriba = false;

  abrirFiltrosLotes(event?: MouseEvent): void {
    if (!this.mostrarFiltrosLotes) {
      this.filtrosLotes = this.copiarFiltros(this.filtrosLotesAplicados);

      const boton = event?.currentTarget as HTMLElement | undefined;
      if (boton) {
        const abajo = boton.getBoundingClientRect().bottom + window.scrollY;
        const espacioDebajo = document.documentElement.scrollHeight - abajo;
        this.filtrosHaciaArriba = espacioDebajo < 480;
      }
    }
    this.mostrarFiltrosLotes = !this.mostrarFiltrosLotes;
  }

  alternarEstadoFiltro(estado: string): void {
    const lista = this.filtrosLotes.estados;
    this.filtrosLotes.estados = lista.includes(estado)
      ? lista.filter(e => e !== estado)
      : [...lista, estado];
  }

  limpiarFiltrosLotes(): void {
    this.filtrosLotes = this.filtrosVacios();
    this.filtrosLotesAplicados = this.filtrosVacios();
    this.mostrarFiltrosLotes = false;
  }

  aplicarFiltrosLotes(): void {
    this.filtrosLotesAplicados = this.copiarFiltros(this.filtrosLotes);
    this.mostrarFiltrosLotes = false;
  }

  quitarFiltroLote(clave: string): void {
    const f = this.filtrosLotesAplicados;
    if (clave.startsWith('estado:')) {
      f.estados = f.estados.filter(e => e !== clave.replace('estado:', ''));
    } else if (clave === 'usuario') {
      f.usuario = '';
    } else if (clave === 'fechas') {
      f.desde = '';
      f.hasta = '';
    } else if (clave === 'rechazados') {
      f.rechazados = '';
    }
    this.filtrosLotesAplicados = this.copiarFiltros(f);
  }

  get filtrosLotesVisibles(): { clave: string; texto: string }[] {
    const f = this.filtrosLotesAplicados;
    const visibles = f.estados.map(e => ({ clave: `estado:${e}`, texto: `Estado: ${e}` }));

    if (f.usuario.trim()) {
      visibles.push({ clave: 'usuario', texto: `Usuario: ${f.usuario.trim()}` });
    }
    if (f.desde || f.hasta) {
      visibles.push({ clave: 'fechas', texto: `Fecha: ${f.desde || 'Sin inicio'} - ${f.hasta || 'Sin fin'}` });
    }
    if (f.rechazados) {
      visibles.push({ clave: 'rechazados', texto: f.rechazados === 'con' ? 'Con rechazados' : 'Sin rechazados' });
    }
    return visibles;
  }

  get cantidadFiltrosLotes(): number {
    return this.filtrosLotesVisibles.length;
  }

  get lotesRecientesFiltrados(): any[] {
    const termino = this.busquedaLotes.trim().toLocaleLowerCase('es-CO');
    const f = this.filtrosLotesAplicados;
    const hayFiltro = !!termino || this.cantidadFiltrosLotes > 0;

    // Sin filtros: los 5 más recientes. Con filtros: busca en todas las cargas.
    const base = hayFiltro && this.todosLosLotes.length > 0 ? this.unirConLocales(this.todosLosLotes) : this.lotesRecientes;
    const usuario = f.usuario.trim().toLocaleLowerCase('es-CO');

    return base.filter(lote => {
      const coincideBusqueda = !termino ||
        `${lote.archivo} ${lote.usuario}`.toLocaleLowerCase('es-CO').includes(termino);

      const coincideEstado = f.estados.length === 0 || f.estados.includes(lote.estado) ||
        (f.estados.includes('En proceso') && !['Exitoso', 'Con errores', 'Rechazado', 'Anulado'].includes(lote.estado));

      const coincideUsuario = !usuario || String(lote.usuario).toLocaleLowerCase('es-CO').includes(usuario);

      const dia = lote.fechaIso ? String(lote.fechaIso).substring(0, 10) : '';
      const coincideDesde = !f.desde || (dia !== '' && dia >= f.desde);
      const coincideHasta = !f.hasta || (dia !== '' && dia <= f.hasta);

      const rechazados = Number(lote.rechazados) || 0;
      const coincideRechazados = !f.rechazados ||
        (f.rechazados === 'con' ? rechazados > 0 : rechazados === 0);

      return coincideBusqueda && coincideEstado && coincideUsuario &&
        coincideDesde && coincideHasta && coincideRechazados;
    });
  }

  // =========================================
  // SELECCIÓN DEL ARCHIVO
  // =========================================

  archivoSeleccionado: File | null = null;
  arrastrandoArchivo = false;

  // Descarga la plantilla CSV (se arma en el navegador)
  descargarPlantilla(): void {
    descargarPlantillaCarga();
  }

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

    this.dashboardService.obtenerUsuarioActual().subscribe({
      next: usuario => {
        if (usuario?.nombre) this.nombreUsuario = usuario.nombre;
      },
      error: () => undefined
    });
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

        // La tabla solo se muestra después de subir un archivo en esta visita
        this.mostrarHistorialLotes = this.subioArchivo && this.lotesRecientes.length > 0;

        this.cargarKpis();

        this.cargandoHistorial = false;
        this.changeDetectorRef.markForCheck();

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
        this.mostrarHistorialLotes = this.subioArchivo && this.lotesRecientes.length > 0;
        this.cargandoHistorial = false;
        this.changeDetectorRef.markForCheck();

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

      fechaIso: this.diaLocal(lote.uploadedAt || lote.createdAt),
      marcaTiempo: new Date(lote.uploadedAt || lote.createdAt || 0).getTime() || 0,

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

    // Como en Figma: el menú se abre a la izquierda del botón, a su misma altura
    const rect = boton.getBoundingClientRect();
    const centroX = rect.left + rect.width / 2;
    const centroY = rect.top + rect.height / 2;
    const anchoMenu = 242;
    const altoMenu = 152;
    const margen = 8;

    const top = Math.max(
      margen,
      Math.min(centroY - 26, window.innerHeight - altoMenu - margen)
    );

    const left = Math.max(margen, centroX - 20 - 16 - anchoMenu);

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

    // Carga rechazada que el backend no guardó: el CSV se arma con los errores recibidos
    if ((lote as any)?.local) {
      this.descargarErroresLocales(lote as any);
      return;
    }

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
  // CARGAS RECHAZADAS SIN LOTE EN EL BACKEND
  // =========================================

  private registrarRechazoLocal(
    nombreArchivo: string,
    respuesta: BatchUploadResponse | null,
    mensaje: string
  ): void {

    // Si el backend sí creó el lote, ya aparece en el historial real
    if (respuesta?.batchId != null) return;

    const ahora = new Date();
    const errores = respuesta?.rowErrors ?? [];
    const leidos = respuesta?.totalRecords ?? 0;

    this.carteraService.cargasRechazadasLocales = [
      {
        id: 'Sin lote',
        batchId: -ahora.getTime(),
        local: true,
        archivo: nombreArchivo || 'Archivo no disponible',
        usuario: this.nombreUsuario,
        fecha: this.formatearFecha(ahora.toISOString()),
        fechaIso: this.diaLocal(ahora.toISOString()),
        marcaTiempo: ahora.getTime(),
        leidos,
        validos: respuesta?.validRecords ?? 0,
        rechazados: respuesta?.failedRecords ?? (errores.length > 0 ? new Set(errores.map(e => e.rowNumber)).size : leidos),
        casos: 0,
        estado: 'Rechazado',
        mensaje: mensaje || respuesta?.message || 'El archivo fue rechazado.',
        porcentaje: 0,
        errores
      },
      ...this.carteraService.cargasRechazadasLocales
    ];
  }

  private descargarErroresLocales(lote: { archivo: string; mensaje: string; errores: BatchRowError[] }): void {

    const celda = (valor: unknown) => {
      const texto = valor === null || valor === undefined ? '' : String(valor);
      return /[",;\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    };

    const filas: string[] = [
      ['Fila', 'Campo', 'Valor recibido', 'Valor esperado', 'Error', 'Código'].join(',')
    ];

    if (lote.errores?.length) {
      lote.errores.forEach(error => filas.push([
        error.rowNumber || '',
        error.field,
        error.value,
        error.expectedValue,
        error.message,
        error.errorCode
      ].map(celda).join(',')));
    } else {
      // Error general del archivo (por ejemplo, columnas que no coinciden)
      filas.push(['', '', '', '', lote.mensaje, ''].map(celda).join(','));
    }

    const archivo = new Blob(['\uFEFF' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(archivo);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = `${(lote.archivo || 'carga').replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_')}_errores.csv`;

    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
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

    if (['CANCELLED', 'CANCELED', 'CANCELLING'].includes(valor)) {
      return 'Anulado';
    }

    return estado;
  }

  // =========================================
  // INDICADORES (KPI) CON TODAS LAS CARGAS
  // Mes actual comparado con el mes anterior.
  // Si nunca se ha subido un archivo, quedan vacíos (—).
  // =========================================

  private cargarKpis(): void {
    this.carteraService.getBatches(0, 500).subscribe({
      next: respuesta => {
        this.todosLosLotes = (respuesta?.content ?? []).map(lote => this.mapearLote(lote));
        this.actualizarKpis(respuesta?.content ?? []);
        this.changeDetectorRef.markForCheck();
      },
      error: error => console.error('Error consultando lotes para los indicadores:', error)
    });
  }

  // Los recuadros de KPI solo se muestran si ya se subió al menos un archivo
  hayCargas = false;

  // true después de subir un archivo en esta visita
  get subioArchivo(): boolean {
    return this.carteraService.archivoSubidoEnVisita;
  }

  private marcarArchivoSubido(): void {
    this.carteraService.archivoSubidoEnVisita = true;
  }

  private actualizarKpis(lotes: BatchHistoryItem[]): void {

    this.hayCargas = lotes.length > 0;

    if (lotes.length === 0) {
      this.kpis.forEach(kpi => {
        kpi.valor = '—';
        kpi.variacion = '';
        kpi.descripcion = '';
      });
      return;
    }

    const hoy = new Date();
    const esteMes = (f: Date) => f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
    const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const mesAnterior = (f: Date) => f.getFullYear() === anterior.getFullYear() && f.getMonth() === anterior.getMonth();

    const fechaDe = (lote: BatchHistoryItem) => new Date(lote.uploadedAt || lote.createdAt || '');

    const delMes = lotes.filter(l => esteMes(fechaDe(l)));
    const delAnterior = lotes.filter(l => mesAnterior(fechaDe(l)));

    const sumar = (lista: BatchHistoryItem[], campo: (l: BatchHistoryItem) => number | undefined) =>
      lista.reduce((total, l) => total + (Number(campo(l)) || 0), 0);

    const indicadores = [
      { actual: delMes.length, antes: delAnterior.length },
      { actual: sumar(delMes, l => l.casesCreated), antes: sumar(delAnterior, l => l.casesCreated) },
      { actual: sumar(delMes, l => l.failedRecords), antes: sumar(delAnterior, l => l.failedRecords) }
    ];

    indicadores.forEach((dato, i) => {
      this.kpis[i].valor = dato.actual.toLocaleString('es-CO');

      if (dato.antes > 0) {
        const cambio = (dato.actual - dato.antes) / dato.antes * 100;
        this.kpis[i].variacion = (cambio > 0 ? '+' : '') +
          cambio.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%';
        this.kpis[i].descripcion = 'vs mes anterior';
      } else {
        this.kpis[i].variacion = '';
        this.kpis[i].descripcion = 'Este mes';
      }
    });

    const ultimaCargaExitosa = this.obtenerLoteMasReciente(
      lotes.filter(lote => this.esEstadoExitoso(lote.status))
    );

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
      (lote.progressPhase || '').toUpperCase() === 'COMPLETED';
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

          const lotePorId = this.loteIdActual !== null
            ? respuesta.content.find(item => item.id === this.loteIdActual)
            : undefined;

          const lote = lotePorId || loteCoincidente ||
            (lotesNuevos.length === 1 ? lotesNuevos[0] : null);

          if (lote) {
            this.loteSeguimiento = lote;
            this.loteIdActual = lote.id;
            this.envioArchivoCompleto = true;
            this.actualizarProgresoDesdeHistorial(lote);

            if (!this.esLoteFinalizado(lote)) {
              // El paso que se ve depende de la fase que reporta el backend
              this.pasoActual = Math.max(this.pasoActual, this.pasoSegunFase(lote));
              this.programarConsultaProgreso(version);
            } else if (!this.suscripcionCarga) {
              // Carga en segundo plano: el resultado llega por el historial
              this.terminarCarga();
            }

            this.changeDetectorRef.markForCheck();
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

    if (!/\.(csv|txt)$/i.test(archivo.name)) {

      this.errorArchivo = 'El archivo debe tener formato CSV o TXT.';

      if (input) {
        input.value = '';
      }

      this.archivoSeleccionado = null;
      return;
    }

    if (archivo.size === 0) {

      this.errorArchivo = 'El archivo está vacío.';

      if (input) {
        input.value = '';
      }

      this.archivoSeleccionado = null;
      return;
    }

    this.reiniciarProcesos();

    this.resultadoCarga = null;
    this.archivoSeleccionado = archivo;
    this.pasoActual = 1;

    // Si se eligió desde "Subir correcciones", arranca de una vez
    if (this.correccionDe !== null) {
      this.continuarValidacion();
    }
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
    const nombreArchivo = this.archivoSeleccionado.name;

    this.iniciarSeguimientoLote(version);

    this.cargasConfirmacion.forEach(carga => {
      carga.cantidad = 0;
      carga.cantidadFinal = 0;
      carga.progreso = 0;
    });

    const envio$ = this.correccionDe !== null
      ? this.carteraService.reuploadCsv(this.correccionDe, this.archivoSeleccionado)
      : this.carteraService.uploadCsv(this.archivoSeleccionado);

    this.correccionDe = null;
    this.loteIdActual = null;
    this.cargaFallida = false;

    this.suscripcionCarga = envio$.subscribe({

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

          this.cargaFallida = true;
          this.pasoActual = 5;

          this.registrarRechazoLocal(nombreArchivo, null, this.errorCarga);
          this.marcarArchivoSubido();
          this.cargarHistorial();
          this.changeDetectorRef.detectChanges();

          return;
        }

        this.procesarRespuesta(respuesta);
        this.loteIdActual = respuesta.batchId ?? this.loteIdActual;
        this.envioArchivoCompleto = true;

        // Archivos grandes: el backend responde de una vez y sigue
        // procesando en segundo plano. Se sigue consultando el progreso.
        if (!this.esEstadoFinalizado(respuesta.status || '')) {
          this.pasoActual = Math.max(this.pasoActual, 3);
          this.changeDetectorRef.markForCheck();
          return;
        }

        this.terminarCarga();
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

          this.detenerSeguimientoLote();
          this.terminarCarga();

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

        this.cargaFallida = true;
        this.pasoActual = 5;

        this.registrarRechazoLocal(
          nombreArchivo,
          respuesta && typeof respuesta === 'object' && !(respuesta instanceof Blob) ? respuesta : null,
          this.errorCarga
        );
        this.marcarArchivoSubido();
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

        this.cargaFallida = true;
        this.pasoActual = 5;

        this.registrarRechazoLocal(nombreArchivo, null, this.errorCarga);
        this.marcarArchivoSubido();
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
      this.pasoActual < 2 ||
      this.pasoActual > 4 ||
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

      estado: this.loteIdActual !== null
        ? 'Cancelando en el servidor...'
        : 'Seguimiento detenido; el lote podría continuar en el servidor'
    };

    // Si ya se conoce el lote, se le pide al backend que lo cancele
    // (borra lo que alcanzó a crear)
    if (this.loteIdActual !== null) {
      this.carteraService.cancelBatch(this.loteIdActual).subscribe({
        next: () => {
          this.resumenCancelacion.estado = 'Cancelado';
          this.cargarHistorial();
          this.changeDetectorRef.markForCheck();
        },
        error: error => {
          console.error('Error cancelando el lote:', error);
          this.resumenCancelacion.estado = error?.status === 403
            ? 'Sin permiso para cancelar: el lote podría continuar en el servidor'
            : 'No se pudo cancelar en el servidor: revisa el historial';
          this.changeDetectorRef.markForCheck();
        }
      });
    }

    this.cargaVersion += 1;

    this.suscripcionCarga?.unsubscribe();
    this.suscripcionCarga = null;

    this.detenerSeguimientoLote();

    this.cargandoArchivo = false;
    this.procesando = false;

    this.mostrarResumenCancelacion = true;
    this.marcarArchivoSubido();

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

    clearTimeout(this.temporizadorPresentacion);
    this.loteIdActual = null;
    this.cargaFallida = false;

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

  // Día de la carga como AAAA-MM-DD (hora de Colombia), para los filtros
  private diaLocal(fecha: string | null): string {
    const valor = fecha ? new Date(fecha) : null;
    if (!valor || Number.isNaN(valor.getTime())) return '';
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${valor.getFullYear()}-${dos(valor.getMonth() + 1)}-${dos(valor.getDate())}`;
  }

  // Formato de la tabla: 15/09/2026 14:30
  private formatearFecha(fecha: string | null): string {

    if (!fecha) {
      return '—';
    }

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
      return fecha;
    }

    const dos = (n: number) => String(n).padStart(2, '0');

    return `${dos(valor.getDate())}/${dos(valor.getMonth() + 1)}/${valor.getFullYear()} ` +
      `${dos(valor.getHours())}:${dos(valor.getMinutes())}`;
  }

  // =========================================
  // FORMATEAR TAMAÑO DEL ARCHIVO
  // =========================================

  formatearTamano(bytes: number): string {

    const formato = (valor: number) =>
      valor.toLocaleString('es-CO', { maximumFractionDigits: 1 });

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${formato(bytes / 1024)} KB`;
    }

    return `${formato(bytes / (1024 * 1024))} MB`;
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
  // FASE DEL BACKEND → PASO QUE SE VE
  // STAGING / VALIDATION      → 2 Validar estructura
  // Validación terminada/QUEUED → 3 Revisar errores
  // PROMOTION / SCORING        → 4 Confirmar carga
  // =========================================

  private pasoSegunFase(lote: BatchHistoryItem): number {
    const fase = (lote.progressPhase || '').toUpperCase();
    const estado = (lote.status || '').toUpperCase();
    const mensaje = this.normalizarTexto(lote.progressMessage || '');

    if (fase === 'PROMOTION' || fase === 'SCORING') return 4;
    if (fase === 'QUEUED') return 3;
    if (fase === 'VALIDATION' && (estado === 'PROCESSING' || /completada|preparando/.test(mensaje))) return 3;
    return 2;
  }

  // =========================================
  // FIN DE LA CARGA
  // Si el backend terminó muy rápido, se muestran un momento
  // los pasos 3 y 4 (con los datos reales) antes del resultado.
  // =========================================

  private temporizadorPresentacion?: ReturnType<typeof setTimeout>;

  private terminarCarga(): void {

    this.marcarArchivoSubido();
    this.detenerSeguimientoLote();

    if (this.loteSeguimiento && !this.resultadoCarga) {
      this.actualizarProgresoDesdeHistorial(this.loteSeguimiento);
    }

    this.progreso = 100;
    this.progresoDisponible = true;
    this.procesando = false;
    this.cargandoArchivo = false;

    this.cargarHistorial();

    const avanzar = () => {
      if (this.pasoActual >= 5) return;
      this.pasoActual += 1;
      this.changeDetectorRef.markForCheck();
      if (this.pasoActual < 5) {
        this.temporizadorPresentacion = setTimeout(avanzar, 1200);
      }
    };

    this.pasoActual = Math.max(this.pasoActual, 2);
    clearTimeout(this.temporizadorPresentacion);
    this.temporizadorPresentacion = setTimeout(avanzar, 600);
    this.changeDetectorRef.markForCheck();
  }

  // =========================================
  // DATOS PARA LOS PASOS 4 Y 5
  // =========================================

  // Si la carga terminó con error total (no se pudo procesar)
  cargaFallida = false;

  // Lote que se está siguiendo (lo da el backend)
  loteIdActual: number | null = null;

  // Lote "padre" cuando se suben correcciones
  correccionDe: number | null = null;

  get registrosProcesados(): number {
    return this.resumenValidacion.registrosLeidos ||
      this.loteSeguimiento?.totalRecords ||
      this.loteSeguimiento?.progressTotal || 0;
  }

  get tasaExito(): string {
    const total = this.resumenValidacion.registrosLeidos;
    const tasa = total > 0 ? this.resumenValidacion.registrosValidos / total * 100 : 0;
    return tasa.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%';
  }

  // Filas del paso 4 (Confirmar carga)
  get filasConfirmacion(): { nombre: string; texto: string; avance: number; rechazo?: boolean }[] {

    const lote = this.loteSeguimiento;
    const fase = (lote?.progressPhase || '').toUpperCase();
    const pasoPromocion = fase === 'PROMOTION' ? Number(lote?.progressCurrent ?? 0) : 0;
    const terminoPromocion = fase === 'SCORING' || fase === 'COMPLETED' || !!this.resultadoCarga;

    const final = this.resultadoCarga;
    const validos = this.resumenValidacion.registrosValidos || lote?.successfulRecords || 0;

    const fila = (nombre: string, hecho: boolean, cantidad: number | undefined) => ({
      nombre,
      texto: hecho
        ? (cantidad !== undefined ? `${this.formatearNumero(cantidad)} de ${this.formatearNumero(cantidad)}` : 'Listo')
        : 'En proceso...',
      avance: hecho ? 100 : 35
    });

    const puntuacionTotal = fase === 'SCORING' ? Number(lote?.progressTotal ?? 0) : 0;
    const puntuacionActual = fase === 'SCORING' ? Number(lote?.progressCurrent ?? 0) : 0;
    const puntuacionLista = fase === 'COMPLETED' || !!final;

    const rechazados = this.resumenValidacion.registrosRechazados || lote?.failedRecords || 0;
    const totalRegistros = this.registrosProcesados || 1;

    return [
      fila('Clientes procesados', terminoPromocion || pasoPromocion >= 1, final?.clientsUpserted),
      fila('Obligaciones procesadas', terminoPromocion || pasoPromocion >= 2, final?.obligationsUpserted ?? (terminoPromocion ? validos : undefined)),
      {
        nombre: 'Puntuaciones generadas',
        texto: puntuacionLista
          ? `${this.formatearNumero(final?.scoresGenerated ?? puntuacionActual)} de ${this.formatearNumero(final?.scoresGenerated ?? puntuacionTotal)}`
          : puntuacionTotal > 0
            ? `${this.formatearNumero(puntuacionActual)} de ${this.formatearNumero(puntuacionTotal)}`
            : 'Pendiente',
        avance: puntuacionLista ? 100 : puntuacionTotal > 0 ? puntuacionActual / puntuacionTotal * 100 : 0
      },
      fila('Casos creados', terminoPromocion || pasoPromocion >= 4, final?.casesCreated ?? lote?.casesCreated),
      {
        nombre: 'Registros rechazados',
        texto: this.formatearNumero(rechazados),
        avance: Math.min(100, rechazados / totalRegistros * 100),
        rechazo: true
      }
    ];
  }

  get progresoGeneral(): number {
    if (this.pasoActual >= 5 || this.resultadoCarga) return 100;
    const lote = this.loteSeguimiento;
    const fase = (lote?.progressPhase || '').toUpperCase();
    if (fase === 'PROMOTION') return Math.round(Number(lote?.progressCurrent ?? 0) / 4 * 60);
    if (fase === 'SCORING') {
      const total = Number(lote?.progressTotal ?? 0);
      return 60 + Math.round(total > 0 ? Number(lote?.progressCurrent ?? 0) / total * 40 : 0);
    }
    return this.pasoActual === 4 ? 10 : 0;
  }

  // =========================================
  // BOTONES DEL RESULTADO
  // =========================================

  // Lote al que se le van a subir correcciones (mientras se elige el archivo)
  private correccionPendiente: number | null = null;

  // Abre el selector de archivo para subir las correcciones de este lote
  subirCorrecciones(input: HTMLInputElement): void {
    if (this.loteIdActual === null) return;
    this.correccionPendiente = this.loteIdActual;
    input.value = '';
    input.click();
  }

  // Desde el menú de la tabla
  subirCorreccionesLote(lote: { batchId: number; local?: boolean }, input: HTMLInputElement): void {
    this.cerrarMenuLote();
    if (this.cargandoArchivo) return;
    // Una carga rechazada sin lote se corrige subiendo el archivo de nuevo (carga normal)
    this.correccionPendiente = lote.local ? -1 : Number(lote.batchId);
    input.value = '';
    input.click();
  }

  // Se eligió el archivo corregido: se sube como lote "hijo"
  seleccionarCorreccion(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    const padre = this.correccionPendiente;
    this.correccionPendiente = null;

    if (!archivo || padre === null || this.cargandoArchivo) return;

    this.finalizarCarga();
    this.correccionDe = padre === -1 ? null : padre;
    this.validarArchivo(archivo, input);

    // Si el archivo no pasó la validación, no queda en modo corrección
    if (!this.archivoSeleccionado) {
      this.correccionDe = null;
    }
  }

  descargarErroresResultado(): void {
    if (this.loteIdActual === null) return;
    this.descargarErroresLote({
      batchId: this.loteIdActual,
      archivo: this.archivoSeleccionado?.name || 'lote'
    });
  }

  // =========================================
  // ELIMINAR DATOS DE UN LOTE (menú ⋮ de la tabla)
  // POST /integration/batches/{id}/cancel
  // El backend anula el lote y borra lo que esa carga creó.
  // =========================================

  loteAEliminar: { batchId: number; archivo: string; local?: boolean } | null = null;
  eliminandoLote = false;
  errorEliminar = '';
  mensajeEliminar = '';

  pedirEliminarLote(lote: { batchId: number; archivo: string; local?: boolean }): void {
    this.cerrarMenuLote();
    this.errorEliminar = '';
    this.loteAEliminar = lote;
  }

  cerrarEliminarLote(): void {
    if (this.eliminandoLote) return;
    this.loteAEliminar = null;
  }

  confirmarEliminarLote(): void {
    const lote = this.loteAEliminar;
    if (!lote || this.eliminandoLote) return;

    // Carga rechazada sin lote: no hay datos en el backend, solo se quita de la tabla
    if (lote.local) {
      this.carteraService.cargasRechazadasLocales =
        this.carteraService.cargasRechazadasLocales.filter(item => item.batchId !== lote.batchId);
      this.loteAEliminar = null;
      this.mostrarHistorialLotes = this.subioArchivo && this.lotesRecientes.length > 0;
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.eliminandoLote = true;
    this.errorEliminar = '';

    this.carteraService.cancelBatch(Number(lote.batchId)).subscribe({
      next: () => {
        this.eliminandoLote = false;
        this.loteAEliminar = null;
        this.cargarHistorial();
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.eliminandoLote = false;
        this.errorEliminar = error.status === 403
          ? 'No tienes permiso para eliminar lotes (solo administrador o supervisor).'
          : error.error?.message || 'No fue posible eliminar los datos del lote.';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  // =========================================
  // DESTRUIR COMPONENTE
  // =========================================

  ngOnDestroy(): void {

    clearTimeout(this.temporizadorPresentacion);
    this.cargaVersion += 1;

    this.detenerSeguimientoLote();

    this.suscripcionCarga?.unsubscribe();
    this.suscripcionCarga = null;
  }
}
