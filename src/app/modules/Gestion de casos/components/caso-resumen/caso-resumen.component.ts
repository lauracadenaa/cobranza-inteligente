
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { ManagedCase } from '../../../../models/dashboard.models';

import {
  CarteraService,
  ClienteSegmento,
  ScoreSummary,
  ScoreFeatureImpact,
  PaymentLinkRequest,
  PaymentLinkDetailDTO
} from '../../../../service/cartera.service';

import { CasosKpisComponent } from '../casos-kpis/casos-kpis.component';

import {
  HistorialBitacoraComponent
} from '../Historial y bitacora/historial-bitacora.component';

import {
  NotasResumenComponent
} from '../Notas/notas-resumen.component';

type SeccionCaso = 'resumen' | 'historial' | 'notas';

interface IntentoContactoBackend {
  id: number;
  clientId: number;
  method: string;
  result: string;
  notes: string;
  attemptDate: string;
  recordedBy: number;
}

interface MensajeContactoBackend {
  id: number;
  clienteId: number;
  obligacionId: number;
  plantillaId: number;
  canal: string;
  destinatario: string;
  mensajeFinal: string;
  linkPago: string;
  estado: string;
  externalMessageId: string;
  errorDetalle: string;
  creadoEn: string;
  enviadoEn: string;
  entregadoEn: string;
}

interface HistorialContacto {
  id: string;
  canal: string;
  icono: string;
  fecha: string;
  fechaOrden: number;
  descripcion: string;
  estado: string;
  claseEstado: string;
}

@Component({
  selector: 'app-caso-resumen',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CasosKpisComponent,
    HistorialBitacoraComponent,
    NotasResumenComponent
  ],
  templateUrl: './caso-resumen.component.html',
  styleUrl: './caso-resumen.component.css'
})
export class CasoResumenComponent implements OnChanges, OnDestroy {

  @Input() caso: ManagedCase | null = null;

  @Output() cerrar = new EventEmitter<void>();

  // =========================================
  // INFORMACIÓN DEL CLIENTE
  // =========================================

  clienteDetalle: ClienteSegmento | null = null;

  cargandoCliente = false;

  errorCliente = '';

  private clienteSubscription?: Subscription;

  // =========================================
  // HISTORIAL DE CONTACTOS DEL CASO
  // =========================================

  historialContactos: HistorialContacto[] = [];

  cargandoHistorialContactos = false;

  errorHistorialContactos = '';

  private intentosContactoSubscription?: Subscription;

  private mensajesContactoSubscription?: Subscription;

  // =========================================
  // CONTEXTO IA - SCORING
  // =========================================

  scoringResumen: ScoreSummary | null = null;

  cargandoScoring = false;

  errorScoring = '';

  private scoringSubscription?: Subscription;

  // =========================================
  // NAVEGACIÓN
  // =========================================

  seccionActiva: SeccionCaso = 'resumen';

  mostrarAcciones = false;

  // =========================================
  // NOTAS DEL CASO
  // =========================================

  notasCaso: any[] = [];

  // =========================================
  // MODAL DE EXPLICACIÓN DEL SCORE
  // =========================================

  mostrarExplicacionScore = false;

  // =========================================
  // MODAL DEL GUION SUGERIDO
  // =========================================

  mostrarGuionCompleto = false;

  readonly guionSugerido: string =
    'Hola Carlos, soy Ana de BankVision. Te contacto para ayudarte a normalizar tu tarjeta de crédito Visa terminada en 771. ¿Podemos revisar opciones de pago que se ajusten a ti?';

  // =========================================
  // GENERACIÓN DE LINK DE PAGO
  // =========================================

  mostrarModalLinkPago = false;

  generandoLinkPago = false;

  errorLinkPago = '';

  linkPagoGenerado: PaymentLinkDetailDTO | null = null;

  copiandoLink = false;

  mensajeCopiado = '';

  conceptoPago = 'PAGO_TOTAL';

  valorPago: number | null = null;

  vigenciaPago = 24;

  canalPago = 'WHATSAPP';

  destinatarioPago = '';

  monedaPago = 'COP';

  private paymentLinkSubscription?: Subscription;

  readonly conceptosPago = [
    { value: 'PAGO_TOTAL', label: 'Pago total' },
    { value: 'ABONO', label: 'Abono a la obligación' },
    { value: 'CUOTA', label: 'Pago de cuota' },
    { value: 'OTRO', label: 'Otro concepto' }
  ];

  readonly vigenciasPago = [
    { value: 24, label: '24 horas' },
    { value: 48, label: '48 horas' },
    { value: 72, label: '72 horas' }
  ];

  readonly canalesPago = [
    { value: 'WHATSAPP', label: 'WhatsApp' },
    { value: 'SMS', label: 'SMS' },
    { value: 'EMAIL', label: 'Correo electrónico' }
  ];

  // =========================================
  // CONSTRUCTOR
  // =========================================

  constructor(
    private carteraService: CarteraService,
    private cdr: ChangeDetectorRef
  ) {}

  // =========================================
  // DETECTAR CAMBIOS EN EL CASO
  // =========================================

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['caso']) {

      this.cargarInformacionCliente();

      this.cargarScoringIA();

      this.cargarHistorialContactos();

    }

  }

  // =========================================
  // CONSULTAR CLIENTE
  // GET /portfolio/clients/{clientId}
  // =========================================

  cargarInformacionCliente(): void {

    this.clienteSubscription?.unsubscribe();

    this.clienteDetalle = null;
    this.errorCliente = '';
    this.cargandoCliente = false;

    const clientId = this.caso?.clientId;

    console.log(
      'ID del cliente seleccionado:',
      clientId
    );

    if (clientId == null) {

      this.errorCliente =
        'El caso no contiene un identificador de cliente válido.';

      this.cdr.markForCheck();

      return;
    }

    this.cargandoCliente = true;

    this.cdr.markForCheck();

    this.clienteSubscription = this.carteraService
      .getClientById(clientId)
      .subscribe({

        next: (cliente: ClienteSegmento) => {

          console.log(
            'Respuesta recibida del backend:',
            cliente
          );

          this.clienteDetalle = cliente;
          this.cargandoCliente = false;
          this.errorCliente = '';

          this.cdr.markForCheck();

        },

        error: (error) => {

          console.error(
            'Error consultando información del cliente:',
            error
          );

          this.clienteDetalle = null;
          this.cargandoCliente = false;

          this.errorCliente =
            'No fue posible consultar la información del cliente.';

          this.cdr.markForCheck();

        }

      });

  }

  // =========================================
  // CONSULTAR SCORING IA
  // GET /scoring/{clientId}/summary
  // =========================================

  cargarScoringIA(): void {

    this.scoringSubscription?.unsubscribe();

    this.scoringResumen = null;
    this.errorScoring = '';
    this.cargandoScoring = false;

    const clientId = this.caso?.clientId;

    console.log(
      'Consultando scoring IA para cliente:',
      clientId
    );

    if (clientId == null) {

      this.errorScoring =
        'No hay un identificador de cliente válido para consultar el scoring.';

      this.cdr.markForCheck();

      return;
    }

    this.cargandoScoring = true;

    this.cdr.markForCheck();

    this.scoringSubscription = this.carteraService
      .getScoreSummary(clientId)
      .subscribe({

        next: (respuesta: ScoreSummary) => {

          console.log(
            'Respuesta scoring IA:',
            respuesta
          );

          this.scoringResumen = respuesta;
          this.cargandoScoring = false;
          this.errorScoring = '';

          this.cdr.markForCheck();

        },

        error: (error) => {

          console.error(
            'Error consultando el scoring IA:',
            error
          );

          this.scoringResumen = null;
          this.cargandoScoring = false;

          this.errorScoring =
            'No fue posible consultar el scoring del cliente.';

          this.cdr.markForCheck();

        }

      });

  }

  // =========================================
  // DATOS REALES DEL SCORING
  // =========================================

  get scoreIA(): number | null {

    return this.scoringResumen?.creditScore ?? null;

  }

  get nivelRiesgoIA(): string {

    return this.scoringResumen
      ?.calculationDetail?.result?.risk_level || '';

  }

  get probabilidadRecaudoIA(): number | null {

    const probabilidad =
      this.scoringResumen?.collectionProbability;

    return probabilidad != null
      ? probabilidad * 100
      : null;

  }

  get segmentoRecomendadoIA(): string {

    return this.scoringResumen?.recommendedSegment || '';

  }

  get canalRecomendadoIA(): string {

    return this.scoringResumen
      ?.calculationDetail?.result?.recommended_channel || '';

  }

  get siguienteAccionIA(): string {

    return this.scoringResumen
      ?.calculationDetail?.result?.next_action || '';

  }

  get versionModeloIA(): string {

    return this.scoringResumen?.modelVersion || '';

  }

  get motorUtilizadoIA(): string {

    return this.scoringResumen?.engineUsed || '';

  }

  get origenCalculoIA(): string {

    return this.scoringResumen
      ?.calculationDetail?.result?.calculation_source || '';

  }

  get motivoFallbackIA(): string | null {

    return this.scoringResumen?.fallbackReason
      || this.scoringResumen
        ?.calculationDetail?.result?.fallbackReason
      || null;

  }

  get impactosScoreIA(): ScoreFeatureImpact[] {

    return this.scoringResumen
      ?.calculationDetail?.result?.feature_impacts || [];

  }

  // =========================================
  // FORMATEAR NOMBRES DE VARIABLES
  // =========================================

  obtenerNombreVariable(variable: string): string {

    const nombres: Record<string, string> = {
      DAYS_PAST_DUE: 'Días de mora',
      AMOUNT_DUE: 'Saldo pendiente',
      SENIORITY: 'Antigüedad del cliente',
      BROKEN_PROMISES: 'Promesas incumplidas',
      DEFAULT_FREQUENCY: 'Frecuencia de incumplimiento',
      CONTACTABILITY: 'Contactabilidad'
    };

    return nombres[variable] || variable;

  }

  // =========================================
  // FORMATEAR CANALES
  // =========================================

  formatearCanal(canal: string): string {

    const canales: Record<string, string> = {
      SMS: 'SMS',
      WHATSAPP: 'WhatsApp',
      EMAIL: 'Correo electrónico',
      CALL: 'Llamada',
      PHONE: 'Llamada'
    };

    return canales[canal] || canal;

  }

  // =========================================
  // FORMATEAR ACCIONES
  // =========================================

  formatearAccion(accion: string): string {

    const acciones: Record<string, string> = {
      CONTACTO_PREVENTIVO: 'Contacto preventivo',
      CONTACTO_ADMINISTRATIVO: 'Contacto administrativo',
      CONTACTO_PREJURIDICO: 'Contacto prejurídico',
      CALL: 'Llamar al asociado',
      SMS: 'Enviar SMS',
      WHATSAPP: 'Contactar por WhatsApp',
      EMAIL: 'Enviar correo electrónico'
    };

    return acciones[accion] || accion;

  }

  // =========================================
  // FORMATEAR FECHA DEL SCORING
  // =========================================

  formatearFechaScoring(
    fecha: string | undefined
  ): string {

    if (!fecha) {
      return 'No disponible';
    }

    const fechaValida = new Date(fecha);

    if (isNaN(fechaValida.getTime())) {
      return 'No disponible';
    }

    return fechaValida.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  }

  // =========================================
  // GENERAR LINK DE PAGO
  // =========================================

  generarLink(): void {

    this.limpiarEstadoLinkPago();

    const saldo = this.caso?.saldoVencido;

    this.valorPago =
      saldo != null && saldo > 0
        ? Number(saldo)
        : null;

    this.actualizarDestinatario();

    this.mostrarModalLinkPago = true;

    const clientId = this.caso?.clientId ?? this.clienteDetalle?.id;
    const obligationId = this.caso?.obligationId;

    if (clientId == null) {

      this.errorLinkPago =
        'No se encontró un identificador válido para el cliente.';

    } else if (obligationId == null) {

      this.errorLinkPago =
        'No se encontró el ID de la obligación. Verifica que el caso tenga obligationId antes de generar el enlace.';

    }

    this.cdr.markForCheck();

  }

  // =========================================
  // ACTUALIZAR DESTINATARIO SEGÚN CANAL
  // =========================================

  actualizarDestinatario(): void {

    if (this.canalPago === 'EMAIL') {

      this.destinatarioPago =
        this.clienteDetalle?.email ||
        this.caso?.correoElectronico ||
        '';

      return;
    }

    this.destinatarioPago =
      this.clienteDetalle?.mobile ||
      this.clienteDetalle?.phone ||
      this.caso?.celular ||
      '';

  }

  // =========================================
  // CAMBIAR CANAL DE ENVÍO
  // =========================================

  cambiarCanalPago(canal: string): void {

    this.canalPago = canal;

    this.actualizarDestinatario();

  }

  // =========================================
  // GENERAR ENLACE EN EL BACKEND
  // =========================================

  generarEnlacePago(): void {

    if (this.generandoLinkPago) {
      return;
    }

    this.errorLinkPago = '';
    this.mensajeCopiado = '';

    const clientId = this.caso?.clientId ?? this.clienteDetalle?.id;
    const obligationId = this.caso?.obligationId;

    if (clientId == null) {

      this.errorLinkPago =
        'No se puede generar el enlace porque falta el ID del cliente.';

      return;
    }

    if (obligationId == null) {

      this.errorLinkPago =
        'No se puede generar el enlace porque falta el ID de la obligación.';

      return;
    }

    if (
      this.valorPago == null ||
      !Number.isFinite(this.valorPago) ||
      this.valorPago <= 0
    ) {

      this.errorLinkPago =
        'Ingresa un valor de pago válido, mayor que cero.';

      return;
    }

    if (!this.conceptoPago) {

      this.errorLinkPago =
        'Selecciona el concepto del pago.';

      return;
    }

    if (!this.canalPago) {

      this.errorLinkPago =
        'Selecciona un canal de envío.';

      return;
    }

    if (!this.destinatarioPago.trim()) {

      this.errorLinkPago =
        'Ingresa el destinatario del enlace.';

      return;
    }

    if (!this.vigenciaPago || this.vigenciaPago <= 0) {

      this.errorLinkPago =
        'Selecciona una vigencia válida para el enlace.';

      return;
    }

    const solicitud: PaymentLinkRequest = {
      clientId,
      obligationId,
      paymentAgreementId: null,
      amount: Number(this.valorPago),
      currency: this.monedaPago,
      channel: this.canalPago,
      expiresInHours: Number(this.vigenciaPago)
    };

    console.log(
      'Solicitud para generar link de pago:',
      solicitud
    );

    this.generandoLinkPago = true;

    this.paymentLinkSubscription?.unsubscribe();

    this.paymentLinkSubscription = this.carteraService
      .generatePaymentLink(solicitud)
      .subscribe({

        next: (respuesta: PaymentLinkDetailDTO) => {

          console.log(
            'Link de pago generado:',
            respuesta
          );

          this.linkPagoGenerado = respuesta;
          this.generandoLinkPago = false;
          this.errorLinkPago = '';

          if (!respuesta?.generatedUrl) {

            this.errorLinkPago =
              'El backend respondió, pero no entregó la URL del enlace de pago.';

          }

          this.cdr.markForCheck();

        },

        error: (error) => {

          console.error(
            'Error generando el link de pago:',
            error
          );

          this.generandoLinkPago = false;

          this.errorLinkPago =
            error?.error?.message ||
            error?.error?.detail ||
            error?.message ||
            'No fue posible generar el enlace de pago. Intenta nuevamente.';

          this.cdr.markForCheck();

        }

      });

  }

  // =========================================
  // COPIAR LINK GENERADO
  // =========================================

  async copiarLinkPago(): Promise<void> {

    const url = this.linkPagoGenerado?.generatedUrl;

    if (!url) {
      return;
    }

    try {

      await navigator.clipboard.writeText(url);

      this.mensajeCopiado = 'Enlace copiado correctamente.';

    } catch (error) {

      console.error('No fue posible copiar el enlace:', error);

      this.mensajeCopiado =
        'No fue posible copiar automáticamente. Selecciona y copia el enlace.';

    }

    this.cdr.markForCheck();

  }

  // =========================================
  // CERRAR MODAL DE LINK DE PAGO
  // =========================================

  cerrarModalLinkPago(): void {

    if (this.generandoLinkPago) {
      return;
    }

    this.mostrarModalLinkPago = false;

    this.paymentLinkSubscription?.unsubscribe();

    this.limpiarEstadoLinkPago();

  }

  // =========================================
  // LIMPIAR ESTADO DEL MODAL
  // =========================================

  private limpiarEstadoLinkPago(): void {

    this.errorLinkPago = '';

    this.linkPagoGenerado = null;

    this.mensajeCopiado = '';

    this.generandoLinkPago = false;

    this.copiandoLink = false;

    this.conceptoPago = 'PAGO_TOTAL';

    this.vigenciaPago = 24;

    this.canalPago = 'WHATSAPP';

    this.destinatarioPago = '';

  }

  // =========================================
  // FORMATEAR VALORES MONETARIOS
  // =========================================

  formatearMoneda(valor: number | null | undefined): string {

    if (valor == null || !Number.isFinite(Number(valor))) {
      return 'No disponible';
    }

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: this.monedaPago,
      maximumFractionDigits: 0
    }).format(Number(valor));

  }

  // =========================================
  // CONSULTAR HISTORIAL DE CONTACTOS
  // =========================================

  cargarHistorialContactos(): void {

    this.intentosContactoSubscription?.unsubscribe();
    this.mensajesContactoSubscription?.unsubscribe();

    this.historialContactos = [];
    this.errorHistorialContactos = '';
    this.cargandoHistorialContactos = false;

    const clientId = this.caso?.clientId;

    if (clientId == null) {

      this.errorHistorialContactos =
        'No se encontró un identificador válido para consultar el historial.';

      this.cdr.markForCheck();

      return;
    }

    this.cargandoHistorialContactos = true;

    let intentos: HistorialContacto[] = [];
    let mensajes: HistorialContacto[] = [];

    let intentosFinalizados = false;
    let mensajesFinalizados = false;
    let huboError = false;

    const actualizarHistorial = (): void => {

      this.historialContactos = [...intentos, ...mensajes]
        .sort((a, b) => b.fechaOrden - a.fechaOrden);

      if (intentosFinalizados && mensajesFinalizados) {

        this.cargandoHistorialContactos = false;

        this.errorHistorialContactos = huboError
          ? 'No fue posible consultar alguno de los historiales.'
          : '';

      }

      this.cdr.markForCheck();

    };

    // Consultar intentos de contacto.
    this.intentosContactoSubscription = this.carteraService
      .getIntentosContactoCliente(Number(clientId))
      .subscribe({

        next: (respuesta: unknown) => {

          const registros = Array.isArray(respuesta)
            ? respuesta as IntentoContactoBackend[]
            : [];

          intentos = registros.map(registro =>
            this.mapearIntentoContacto(registro)
          );

          intentosFinalizados = true;

          actualizarHistorial();

        },

        error: (error) => {

          console.error(
            'Error consultando intentos de contacto:',
            error
          );

          huboError = true;
          intentosFinalizados = true;

          actualizarHistorial();

        }

      });

    // Consultar mensajes enviados.
    this.mensajesContactoSubscription = this.carteraService
      .getHistorialMensajesCliente(Number(clientId))
      .subscribe({

        next: (respuesta: unknown) => {

          const registros = Array.isArray(respuesta)
            ? respuesta as MensajeContactoBackend[]
            : [];

          mensajes = registros.map(registro =>
            this.mapearMensajeContacto(registro)
          );

          mensajesFinalizados = true;

          actualizarHistorial();

        },

        error: (error) => {

          console.error(
            'Error consultando historial de mensajes:',
            error
          );

          huboError = true;
          mensajesFinalizados = true;

          actualizarHistorial();

        }

      });

  }

  // =========================================
  // MAPEAR INTENTOS DE CONTACTO
  // =========================================

  private mapearIntentoContacto(
    registro: IntentoContactoBackend
  ): HistorialContacto {

    const canal = this.formatearCanal(
      registro.method || 'CONTACTO'
    );

    const resultado = registro.result || 'Sin resultado registrado';

    const estadoNormalizado = resultado.toUpperCase();

    const contactoEfectivo = [
      'EFECTIVO',
      'CONTACTADO',
      'EXITOSO',
      'CONTACTO_EXITOSO',
      'RESPONDIO',
      'RESPONDIDO'
    ].some(valor => estadoNormalizado.includes(valor));

    return {
      id: `intento-${registro.id}`,
      canal,
      icono: this.obtenerIconoHistorial(registro.method),
      fecha: this.formatearFechaHistorial(registro.attemptDate),
      fechaOrden: this.obtenerFechaOrden(registro.attemptDate),
      descripcion: registro.notes || `Intento de contacto por ${canal}`,
      estado: resultado,
      claseEstado: contactoEfectivo
        ? 'contacto-efectivo'
        : 'contacto-sin-respuesta'
    };

  }

  // =========================================
  // MAPEAR MENSAJES ENVIADOS
  // =========================================

  private mapearMensajeContacto(
    registro: MensajeContactoBackend
  ): HistorialContacto {

    const canal = this.formatearCanal(
      registro.canal || 'MENSAJE'
    );

    const estado = registro.estado || 'SIN ESTADO';

    const estadoNormalizado = estado.toUpperCase();

    let claseEstado = 'contacto-sin-respuesta';

    if (
      estadoNormalizado.includes('ENTREGADO') ||
      estadoNormalizado.includes('DELIVERED')
    ) {

      claseEstado = 'contacto-efectivo';

    } else if (
      estadoNormalizado.includes('PENDIENTE') ||
      estadoNormalizado.includes('ENVIADO')
    ) {

      claseEstado = 'contacto-pendiente';

    } else if (
      estadoNormalizado.includes('ERROR') ||
      estadoNormalizado.includes('FALLIDO') ||
      estadoNormalizado.includes('RECHAZADO')
    ) {

      claseEstado = 'contacto-error';

    }

    const fechaRegistro =
      registro.entregadoEn ||
      registro.enviadoEn ||
      registro.creadoEn;

    return {
      id: `mensaje-${registro.id}`,
      canal,
      icono: this.obtenerIconoHistorial(registro.canal),
      fecha: this.formatearFechaHistorial(fechaRegistro),
      fechaOrden: this.obtenerFechaOrden(fechaRegistro),
      descripcion:
        registro.mensajeFinal ||
        `Mensaje enviado por ${canal}`,
      estado,
      claseEstado
    };

  }

  // =========================================
  // OBTENER ICONO SEGÚN EL CANAL
  // =========================================

  obtenerIconoHistorial(canal: string): string {

    switch (canal?.toUpperCase()) {

      case 'CALL':
      case 'PHONE':
      case 'LLAMADA':
        return '/imagenes/Gestioncasos/Llamar.png';

      case 'WHATSAPP':
        return '/imagenes/Gestioncasos/WhatsApp-enviado.png';

      case 'SMS':
        return '/imagenes/Gestioncasos/Enviar-SMS.png';

      case 'EMAIL':
      case 'CORREO':
        return '/imagenes/Gestioncasos/Email-enviar.png';

      default:
        return '/imagenes/Gestioncasos/Llamar.png';

    }

  }

  // =========================================
  // FORMATEAR FECHA DEL HISTORIAL
  // =========================================

  formatearFechaHistorial(
    fecha: string | null | undefined
  ): string {

    if (!fecha) {
      return 'Fecha no disponible';
    }

    const fechaValida = new Date(fecha);

    if (isNaN(fechaValida.getTime())) {
      return 'Fecha no disponible';
    }

    return fechaValida.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  }

  // =========================================
  // OBTENER FECHA PARA ORDENAR
  // =========================================

  private obtenerFechaOrden(
    fecha: string | null | undefined
  ): number {

    if (!fecha) {
      return 0;
    }

    const fechaValida = new Date(fecha).getTime();

    return Number.isNaN(fechaValida) ? 0 : fechaValida;

  }

  // =========================================
  // DESTRUIR SUSCRIPCIONES
  // =========================================

  ngOnDestroy(): void {

    this.clienteSubscription?.unsubscribe();

    this.scoringSubscription?.unsubscribe();

    this.paymentLinkSubscription?.unsubscribe();

    this.intentosContactoSubscription?.unsubscribe();

    this.mensajesContactoSubscription?.unsubscribe();

  }

  // =========================================
  // NAVEGACIÓN DEL CASO
  // =========================================

  cambiarSeccion(seccion: SeccionCaso): void {

    this.seccionActiva = seccion;

  }

  regresarACola(): void {

    this.cerrar.emit();

  }

  abrirAcciones(): void {

    this.mostrarAcciones = true;

  }

  cerrarAcciones(): void {

    this.mostrarAcciones = false;

  }

  // =========================================
  // EXPLICACIÓN DEL SCORE
  // =========================================

  verExplicacionScore(): void {

    this.mostrarExplicacionScore = true;

  }

  cerrarExplicacionScore(): void {

    this.mostrarExplicacionScore = false;

  }

  // =========================================
  // GUION SUGERIDO
  // =========================================

  verGuionCompleto(): void {

    this.mostrarGuionCompleto = true;

  }

  cerrarGuionCompleto(): void {

    this.mostrarGuionCompleto = false;

  }

  // =========================================
  // ACCIONES RÁPIDAS
  // =========================================

  contactarWhatsApp(): void {

    console.log(
      'Contactar por WhatsApp:',
      this.clienteDetalle?.mobile
    );

  }

  llamarAsociado(): void {

    console.log(
      'Llamar al asociado:',
      this.clienteDetalle?.mobile
    );

  }

  enviarEmail(): void {

    console.log(
      'Enviar email:',
      this.clienteDetalle?.email
    );

  }

  crearPromesa(): void {

    console.log(
      'Crear promesa para el caso:',
      this.caso?.id
    );

  }

  enviarSMS(): void {

    console.log(
      'Enviar SMS:',
      this.clienteDetalle?.mobile
    );

  }

  escalarCaso(): void {

    console.log(
      'Escalar caso:',
      this.caso?.id
    );

  }

  // =========================================
  // FORMATEAR VIGENCIA DEL PAGO
  // =========================================

  formatearVigenciaPago(
    fecha: string | null | undefined
  ): string {

    if (!fecha) {
      return 'No disponible';
    }

    const fechaValida = new Date(fecha);

    if (isNaN(fechaValida.getTime())) {
      return 'No disponible';
    }

    return fechaValida.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  }

  // =========================================
  // FORMATEAR CANAL DE PAGO
  // =========================================

  formatearCanalPago(
    canal: string | null | undefined
  ): string {

    switch (canal?.toUpperCase()) {

      case 'WHATSAPP':
        return 'WhatsApp';

      case 'EMAIL':
        return 'Correo electrónico';

      case 'SMS':
        return 'SMS';

      default:
        return canal || 'No disponible';

    }

  }

}
