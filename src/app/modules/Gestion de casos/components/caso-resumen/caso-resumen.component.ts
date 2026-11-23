
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectorRef,
  HostListener
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
  PaymentLinkDetailDTO,
  DecisionIACaso
} from '../../../../service/cartera.service';

import { CasosKpisComponent } from '../casos-kpis/casos-kpis.component';
import { AcuerdoCaso, AsesorCarga, CaseService, NotaBackend } from '../../../../service/case.service';
import { DashboardService, UsuarioActual } from '../../../../service/dashboard.service';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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

// Nota como la muestra la pestaña Notas
export interface NotaVista {
  id: number;
  nombre: string;
  rol: string;
  fecha: string;
  hora: string;
  gestion: string;
  notaInterna: string;
}

// Evento como lo muestra la pestaña Historial y bitácora
export interface EventoBitacoraVista {
  id: string;
  fecha: string;
  fechaOrden: string | number;
  tipo: string;
  titulo: string;
  responsable: string;
  resultado: string;
  descripcion: string;
  canal: string;
  observacion: string;
  origen: 'Sistema' | 'Motor IA' | 'Agente';
}

// Las notas se guardan como "[Categoría] texto"
function separarCategoria(contenido: string): { categoria: string; texto: string } {
  const coincide = /^\[([^\]]{1,40})\]\s*/.exec(contenido || '');
  return coincide
    ? { categoria: coincide[1], texto: contenido.slice(coincide[0].length) }
    : { categoria: '', texto: contenido || '' };
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

  // Avisa a Gestión de casos que el caso cambió (para recargar la cola)
  @Output() casoActualizado = new EventEmitter<ManagedCase | null>();

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

  notasCaso: NotaVista[] = [];

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
    private cdr: ChangeDetectorRef,
    private caseService: CaseService,
    private dashboardService: DashboardService
  ) {}

  // =========================================
  // DETECTAR CAMBIOS EN EL CASO
  // =========================================

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['caso']) {

      this.cargarInformacionCliente();

      this.cargarScoringIA();

      this.cargarHistorialContactos();

      this.cargarNotasYBitacora();

      this.cargarUsuarios();

      this.cargarDesborde();

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
          this.linkEnviado = false;
          this.estadoPago = '';

          // El backend no guarda el concepto: queda como nota en el caso
          this.registrarNotaLink(
            `Link de pago generado por ${this.formatearMoneda(respuesta?.amount ?? this.valorPago)}. ` +
            `Concepto: ${this.conceptosPago.find(c => c.value === this.conceptoPago)?.label ?? this.conceptoPago}. ` +
            `Vigencia: ${this.vigenciaPago} horas. Canal: ${this.formatearCanal(this.canalPago)}.`
          );

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
  // ENVIAR EL LINK AL ASOCIADO
  // El backend solo genera el link; el envío se hace abriendo
  // WhatsApp, SMS o correo con el mensaje listo, y se registra
  // el intento de contacto en el caso.
  // =========================================

  linkEnviado = false;
  estadoPago = '';
  consultandoEstadoPago = false;

  get mensajeLinkPago(): string {
    const nombre = (this.clienteDetalle?.fullName || this.caso?.asociado || '').split(' ')[0];
    const valor = this.formatearMoneda(this.linkPagoGenerado?.amount ?? this.valorPago);
    return `Hola ${nombre}, te compartimos el enlace para pagar tu obligación ${this.caso?.obligacion ?? ''} ` +
      `por ${valor}: ${this.linkPagoGenerado?.generatedUrl ?? ''}`;
  }

  enviarLinkPago(): void {
    const url = this.linkPagoGenerado?.generatedUrl;
    const destino = this.destinatarioPago.trim();
    if (!url || !destino) {
      this.errorLinkPago = 'Falta el enlace o el destinatario.';
      return;
    }

    const texto = encodeURIComponent(this.mensajeLinkPago);
    const numero = destino.replace(/\D/g, '');

    if (this.canalPago === 'WHATSAPP') {
      window.open(`https://wa.me/${numero.length === 10 ? '57' + numero : numero}?text=${texto}`, '_blank', 'noopener');
    } else if (this.canalPago === 'SMS') {
      window.location.href = `sms:${numero}?body=${texto}`;
    } else {
      window.location.href = `mailto:${destino}?subject=${encodeURIComponent('Enlace de pago')}&body=${texto}`;
    }

    this.linkEnviado = true;

    const id = this.caso?.backendId;
    if (id != null) {
      this.caseService.registrarIntento(id, this.canalPago, 'SENT').subscribe({ error: () => undefined });
    }
    this.registrarNotaLink(`Link de pago enviado por ${this.formatearCanal(this.canalPago)} a ${destino}.`);
  }

  // "Ver detalle": consulta el estado del pago en la pasarela
  consultarEstadoPago(): void {
    const pagoId = this.linkPagoGenerado?.zolevPaymentId;
    if (!pagoId) {
      this.estadoPago = this.linkPagoGenerado?.transactionStatus || this.linkPagoGenerado?.status || 'Sin información';
      return;
    }
    this.consultandoEstadoPago = true;
    this.carteraService.getEstadoPago(pagoId).subscribe({
      next: respuesta => {
        this.estadoPago = respuesta?.nombreEstado || 'Sin información';
        this.consultandoEstadoPago = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.estadoPago = 'No fue posible consultar el estado.';
        this.consultandoEstadoPago = false;
        this.cdr.markForCheck();
      }
    });
  }

  private registrarNotaLink(texto: string): void {
    const id = this.caso?.backendId;
    if (id == null) return;
    this.caseService.crearNota(id, `[Link de pago] ${texto}`).subscribe({
      next: () => this.recargarNotas(),
      error: () => undefined
    });
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

    this.linkEnviado = false;

    this.estadoPago = '';

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
      this.eventosBitacora = this.armarBitacora();

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

  // =========================================
  // USUARIOS (para poner nombre a quien escribió cada nota)
  // =========================================

  private usuarioActual: UsuarioActual | null = null;
  private nombresUsuarios = new Map<number, string>();

  private cargarUsuarios(): void {
    this.dashboardService.obtenerUsuarioActual().subscribe(usuario => {
      this.usuarioActual = usuario;
      this.recalcularVistas();
    });
    this.dashboardService.obtenerContextoCasos().pipe(catchError(() => of(null))).subscribe(contexto => {
      if (contexto) this.nombresUsuarios = contexto.asesores;
      this.recalcularVistas();
    });
  }

  private nombreUsuario(id: number | null | undefined): string {
    if (id == null) return 'Sistema';
    if (this.usuarioActual?.id === id) return this.usuarioActual.nombre;
    return this.nombresUsuarios.get(Number(id)) || `Usuario #${id}`;
  }

  // =========================================
  // NOTAS, DECISIONES IA Y ACUERDOS DEL CASO (para Notas y Bitácora)
  // =========================================

  private notasBackend: NotaBackend[] = [];
  private decisionesIA: DecisionIACaso[] = [];
  private acuerdos: AcuerdoCaso[] = [];

  eventosBitacora: EventoBitacoraVista[] = [];
  guardandoNota = false;
  errorNota = '';

  private cargarNotasYBitacora(): void {
    const id = this.caso?.backendId;
    this.notasBackend = [];
    this.decisionesIA = [];
    this.acuerdos = [];
    this.recalcularVistas();
    if (id == null) return;

    forkJoin({
      notas: this.caseService.obtenerNotasCaso(id).pipe(catchError(() => of([] as NotaBackend[]))),
      decisiones: this.carteraService.getDecisionesIAporCaso(id, 0, 50).pipe(
        map(r => r?.content ?? []),
        catchError(() => of([] as DecisionIACaso[]))
      ),
      acuerdos: this.caseService.obtenerAcuerdosCaso(id).pipe(catchError(() => of([] as AcuerdoCaso[])))
    }).subscribe(({ notas, decisiones, acuerdos }) => {
      this.notasBackend = notas ?? [];
      this.decisionesIA = decisiones ?? [];
      this.acuerdos = acuerdos ?? [];
      this.recalcularVistas();
    });
  }

  private recargarNotas(): void {
    const id = this.caso?.backendId;
    if (id == null) return;
    this.caseService.obtenerNotasCaso(id).pipe(catchError(() => of(this.notasBackend))).subscribe(notas => {
      this.notasBackend = notas ?? [];
      this.recalcularVistas();
    });
  }

  // Convierte lo del backend en lo que muestran las pestañas Notas y Bitácora
  private recalcularVistas(): void {
    this.notasCaso = [...this.notasBackend]
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
      .map(nota => {
        const { categoria, texto } = separarCategoria(nota.content);
        const esIA = nota.source === 'AI';
        const fecha = new Date(nota.createdAt || '');
        return {
          id: nota.id,
          nombre: esIA ? 'Motor IA' : this.nombreUsuario(nota.createdBy),
          rol: esIA ? 'Sistema' : (nota.createdBy == null ? 'Sistema' : 'Agente'),
          fecha: Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          hora: Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
          gestion: categoria || (esIA ? 'Gestión' : 'Seguimiento'),
          notaInterna: texto
        };
      });

    this.eventosBitacora = this.armarBitacora();
    this.cdr.markForCheck();
  }

  private armarBitacora(): EventoBitacoraVista[] {
    const eventos: EventoBitacoraVista[] = [];
    const fechaTexto = (valor: string | number | null | undefined) => {
      const f = new Date(valor ?? '');
      return Number.isNaN(f.getTime())
        ? '—'
        : f.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    };

    // Creación del caso
    if (this.caso?.fechaCreacion) {
      const desdeCarga = this.caso.origen === 'integracionCartera';
      eventos.push({
        id: 'creado',
        fechaOrden: this.caso.fechaCreacion,
        fecha: fechaTexto(this.caso.fechaCreacion),
        tipo: 'Caso',
        titulo: desdeCarga ? 'Caso creado desde carga de cartera' : 'Caso creado',
        responsable: 'Sistema',
        resultado: 'Nuevo',
        descripcion: `Obligación ${this.caso.obligacion}`,
        canal: 'Sistema',
        observacion: '',
        origen: 'Sistema'
      });
    }

    // Decisiones del Motor IA
    this.decisionesIA.forEach(d => eventos.push({
      id: `ia-${d.id}`,
      fechaOrden: d.createdAt,
      fecha: fechaTexto(d.createdAt),
      tipo: 'Motor IA',
      titulo: d.humanOverflow ? 'Caso desbordado a gestión humana' : `Contacto por ${this.formatearCanal(d.channelSelected || 'canal')}`,
      responsable: 'Motor IA',
      resultado: d.humanOverflow ? 'Escalado' : (d.apiStatus || d.engineStatus || 'Procesado'),
      descripcion: `Score: ${d.score ?? '—'} · Riesgo ${d.riskSegment || '—'}`,
      canal: this.formatearCanal(d.channelSelected || 'Sistema'),
      observacion: d.fallbackUsed ? 'Se usó la regla de respaldo (fallback).' : '',
      origen: 'Motor IA'
    }));

    // Notas (incluye las que deja el backend al registrar intentos, cambios y reasignaciones)
    this.notasBackend.forEach(n => {
      const { categoria, texto } = separarCategoria(n.content);
      const esIA = n.source === 'AI';
      eventos.push({
        id: `nota-${n.id}`,
        fechaOrden: n.createdAt || '',
        fecha: fechaTexto(n.createdAt),
        tipo: 'Nota',
        titulo: categoria ? `Nota: ${categoria}` : 'Nota agregada',
        responsable: esIA ? 'Motor IA' : this.nombreUsuario(n.createdBy),
        resultado: 'Registrada',
        descripcion: texto,
        canal: 'Interno',
        observacion: '',
        origen: esIA ? 'Motor IA' : (n.createdBy == null ? 'Sistema' : 'Agente')
      });
    });

    // Intentos de contacto y mensajes
    this.historialContactos.forEach(c => eventos.push({
      id: `contacto-${c.id}`,
      fechaOrden: c.fechaOrden,
      fecha: c.fecha,
      tipo: c.canal,
      titulo: c.descripcion,
      responsable: 'Agente',
      resultado: c.estado,
      descripcion: c.descripcion,
      canal: c.canal,
      observacion: '',
      origen: 'Agente'
    }));

    // Acuerdos y promesas de pago
    this.acuerdos.forEach(a => eventos.push({
      id: `acuerdo-${a.id}`,
      fechaOrden: a.createdAt || '',
      fecha: fechaTexto(a.createdAt),
      tipo: 'Acuerdo',
      titulo: a.agreementType === 'PTP' ? 'Promesa de pago creada' : 'Acuerdo de pago creado',
      responsable: 'Agente',
      resultado: a.status || 'Registrado',
      descripcion: a.promiseDate ? `Fecha prometida: ${new Date(a.promiseDate).toLocaleDateString('es-CO')}` : '',
      canal: 'Interno',
      observacion: '',
      origen: 'Agente'
    }));

    return eventos;
  }

  // Guardar nota desde la pestaña Notas
  guardarNotaCaso(evento: { categoria: string; texto: string }): void {
    const id = this.caso?.backendId;
    if (id == null || this.guardandoNota) return;
    this.guardandoNota = true;
    this.errorNota = '';
    this.caseService.crearNota(id, `[${evento.categoria}] ${evento.texto}`).subscribe({
      next: () => {
        this.guardandoNota = false;
        this.recargarNotas();
      },
      error: error => {
        this.guardandoNota = false;
        this.errorNota = error?.status === 403
          ? 'Tu rol no tiene permiso para agregar notas.'
          : 'No fue posible guardar la nota.';
        this.cdr.markForCheck();
      }
    });
  }

  // Aclaración = nota nueva que hace referencia a la original
  guardarAclaracionCaso(evento: { nota: NotaVista; texto: string }): void {
    this.guardarNotaCaso({
      categoria: 'Aclaración',
      texto: `Sobre la nota de ${evento.nota.nombre} (${evento.nota.fecha} ${evento.nota.hora}): ${evento.texto}`
    });
  }

  // =========================================
  // MOTIVO DE DESBORDE (GET /management/cases/{id}/overflow-status)
  // =========================================

  desborde: {
    triggered: boolean;
    condition1Mora: boolean;
    condition2Intentos: boolean;
    condition3AcuerdoIncumplido: boolean;
    condition4SinAutorizacion: boolean;
    reasonDetail: string;
  } | null = null;

  private cargarDesborde(): void {
    this.desborde = null;
    const id = this.caso?.backendId;
    if (id == null) return;
    this.caseService.obtenerEstadoDesborde(id).pipe(catchError(() => of(null))).subscribe(resultado => {
      this.desborde = resultado;
      this.cdr.markForCheck();
    });
  }

  // Condiciones que se cumplen, en palabras
  get condicionesDesborde(): string[] {
    const d = this.desborde;
    if (!d) return [];
    return [
      d.condition1Mora ? 'Mora avanzada' : '',
      d.condition2Intentos ? 'Intentos de contacto agotados' : '',
      d.condition3AcuerdoIncumplido ? 'Acuerdo incumplido' : '',
      d.condition4SinAutorizacion ? 'Sin autorización de contacto digital' : ''
    ].filter(Boolean);
  }

  // =========================================
  // CONTACTO PREFERIDO
  // El canal con más contactos efectivos; si no hay historial,
  // el canal que recomienda el Motor IA.
  // =========================================

  // =========================================
  // PROPENSIÓN DE PAGO Y MOTIVO DE PRIORIDAD (tarjeta "Contexto IA del caso")
  // =========================================

  // Alta / Media / Baja según la probabilidad de recaudo del motor IA
  get propensionTexto(): string {
    const p = this.probabilidadRecaudoIA;
    if (p === null) return 'No disponible';
    const texto = p >= 60 ? 'Alta' : p >= 30 ? 'Media' : 'Baja';
    return `${texto} (${Math.round(p)}%)`;
  }

  get propensionClase(): string {
    const p = this.probabilidadRecaudoIA;
    if (p === null) return 'nd';
    return p >= 60 ? 'alta' : p >= 30 ? 'media' : 'baja';
  }

  // Ej.: "Riesgo crítico y mora avanzada"
  get motivoPrioridad(): string {
    const riesgo = (this.nivelRiesgoIA || this.caso?.riesgo || '').toString().trim();
    const dias = this.caso?.diasMora ?? 0;
    const partes: string[] = [];
    if (riesgo && riesgo !== 'Sin información') {
      partes.push('Riesgo ' + riesgo.toLowerCase().replace('critico', 'crítico'));
    }
    if (dias > 90) partes.push('mora avanzada');
    else if (dias > 30) partes.push('mora media');
    return partes.length ? partes.join(' y ') : 'No disponible';
  }

  get contactoPreferido(): string {
    const efectivos = new Map<string, number>();
    this.historialContactos
      .filter(c => c.claseEstado === 'contacto-efectivo')
      .forEach(c => efectivos.set(c.canal, (efectivos.get(c.canal) ?? 0) + 1));

    const mejor = [...efectivos.entries()].sort((a, b) => b[1] - a[1])[0];
    if (mejor) return mejor[0];

    return this.canalRecomendadoIA ? `${this.formatearCanal(this.canalRecomendadoIA)} (sugerido IA)` : 'No definido';
  }

  // =========================================
  // CONFIANZA DE LA RECOMENDACIÓN (solo si el modelo la reporta)
  // =========================================

  get confianzaRecomendacion(): number | null {
    const resultado = this.scoringResumen?.calculationDetail?.result as unknown as Record<string, unknown> | undefined;
    const valor = Number(resultado?.['confidence_score']);
    if (!Number.isFinite(valor) || resultado?.['confidence_score'] == null) return null;
    return valor <= 1 ? Math.round(valor * 100) : Math.round(valor);
  }

  // =========================================
  // HISTÓRICO DE EFECTIVIDAD (con los contactos reales del cliente)
  // =========================================

  efectividadCanal(canal: 'WHATSAPP' | 'SMS' | 'LLAMADA'): string {
    const coincide = (texto: string) => {
      const t = (texto || '').toUpperCase();
      if (canal === 'LLAMADA') return t.includes('LLAMADA') || t.includes('CALL') || t.includes('TELEF');
      return t.includes(canal);
    };
    const delCanal = this.historialContactos.filter(c => coincide(c.canal));
    if (delCanal.length === 0) return 'Sin datos';
    const efectivos = delCanal.filter(c => c.claseEstado === 'contacto-efectivo').length;
    return `${Math.round(efectivos / delCanal.length * 100)}%`;
  }

  // =========================================
  // TIPIFICACIÓN RÁPIDA
  // Se guarda como intento de contacto + nota en la bitácora
  // =========================================

  tipificacion = { resultado: '', proximaAccion: '', comentario: '' };
  guardandoTipificacion = false;

  private readonly textosResultado: Record<string, string> = {
    'contacto-efectivo': 'Contacto efectivo',
    'sin-respuesta': 'Sin respuesta',
    'no-contactado': 'No contactado',
    'numero-equivocado': 'Número equivocado',
    'tercero-contactado': 'Contacto con tercero',
    'promesa-pago': 'Promesa de pago',
    'rechaza-pago': 'Rechaza realizar el pago'
  };

  private readonly textosProximaAccion: Record<string, string> = {
    'nueva-llamada': 'Programar nueva llamada',
    'enviar-whatsapp': 'Enviar WhatsApp',
    'enviar-sms': 'Enviar SMS',
    'enviar-email': 'Enviar email',
    'crear-promesa': 'Crear promesa de pago',
    'seguimiento': 'Realizar seguimiento',
    'escalar-caso': 'Escalar caso',
    'sin-accion': 'Sin acción adicional'
  };

  // Resultado del formulario → resultado que entiende el backend
  private readonly resultadoBackend: Record<string, string> = {
    'contacto-efectivo': 'RESPONDED',
    'tercero-contactado': 'RESPONDED',
    'promesa-pago': 'RESPONDED',
    'sin-respuesta': 'FAILED',
    'no-contactado': 'FAILED',
    'numero-equivocado': 'FAILED',
    'rechaza-pago': 'REJECTED'
  };

  guardarGestion(): void {
    const id = this.caso?.backendId;
    const t = this.tipificacion;
    if (id == null || !t.resultado || !t.proximaAccion || this.guardandoTipificacion) {
      if (!t.resultado || !t.proximaAccion) {
        this.mostrarAvisoAcciones('Selecciona el resultado de contacto y la próxima acción.');
      }
      return;
    }

    this.guardandoTipificacion = true;
    const nota = [
      `Resultado: ${this.textosResultado[t.resultado]}.`,
      `Próxima acción: ${this.textosProximaAccion[t.proximaAccion]}.`,
      t.comentario.trim() ? `Comentario: ${t.comentario.trim()}` : ''
    ].filter(Boolean).join(' ');

    forkJoin([
      this.caseService.registrarIntento(id, 'GESTION_MANUAL', this.resultadoBackend[t.resultado] ?? 'SENT'),
      this.caseService.crearNota(id, `[Gestión] ${nota}`)
    ]).subscribe({
      next: () => {
        this.guardandoTipificacion = false;
        this.tipificacion = { resultado: '', proximaAccion: '', comentario: '' };
        this.mostrarAvisoAcciones('Gestión guardada.');
        this.recargarNotas();
        this.cargarHistorialContactos();
      },
      error: error => {
        this.guardandoTipificacion = false;
        this.mostrarAvisoAcciones(error?.status === 403
          ? 'Tu rol no tiene permiso para registrar gestiones.'
          : 'No fue posible guardar la gestión.');
      }
    });
  }

  // =========================================
  // ACCIONES RÁPIDAS DE CONTACTO
  // Abren la app del equipo (teléfono, WhatsApp, correo, SMS)
  // y dejan registrado el intento en el caso.
  // =========================================

  private registrarContacto(canal: string): void {
    const id = this.caso?.backendId;
    if (id == null) return;
    this.caseService.registrarIntento(id, canal, 'SENT').subscribe({
      next: () => {
        this.mostrarAvisoAcciones(`Intento de contacto por ${this.formatearCanal(canal)} registrado en el caso.`);
        this.recargarNotas();
      },
      error: () => this.mostrarAvisoAcciones('Se abrió el contacto, pero no se pudo registrar el intento.')
    });
  }

  private soloDigitos(valor: string | null | undefined): string {
    return (valor || '').replace(/\D/g, '');
  }

  // =========================================
  // VENTANAS DE ACCIONES (asignar, cerrar)
  // =========================================

  ventanaAccion: '' | 'asignar' | 'cerrar' = '';
  guardandoAccion = false;
  errorAccion = '';

  tipoCierre = '';
  detalleCierre = '';
  asesoresCaso: AsesorCarga[] = [];
  asesorCasoId: number | null = null;

  readonly tiposCierre = [
    { valor: 'PAYMENT_COMPLETE', texto: 'Pago total' },
    { valor: 'PAYMENT_AGREEMENT', texto: 'Acuerdo de pago' },
    { valor: 'DISPUTE_RESOLVED', texto: 'Disputa resuelta' },
    { valor: 'UNABLE_TO_COLLECT', texto: 'No se pudo recaudar' },
    { valor: 'WRITE_OFF', texto: 'Castigo de cartera' },
    { valor: 'ILOCALIZADO', texto: 'Ilocalizado' },
    { valor: 'JURIDICO', texto: 'Pasa a jurídico' }
  ];

  abrirVentanaAccion(tipo: 'asignar' | 'cerrar'): void {
    this.cerrarAcciones();
    this.errorAccion = '';
    this.ventanaAccion = tipo;
    this.tipoCierre = '';
    this.detalleCierre = '';
    this.asesorCasoId = null;

    if (tipo === 'asignar') {
      this.asesoresCaso = [];
      this.caseService.obtenerAsesores().subscribe({
        next: lista => {
          this.asesoresCaso = lista ?? [];
          this.cdr.markForCheck();
        },
        error: error => {
          this.errorAccion = error?.status === 403
            ? 'Solo un administrador o supervisor puede asignar asesores.'
            : 'No fue posible consultar los asesores.';
          this.cdr.markForCheck();
        }
      });
    }
  }

  cerrarVentanaAccion(): void {
    if (this.guardandoAccion) return;
    this.ventanaAccion = '';
  }

  confirmarVentanaAccion(): void {
    const id = this.caso?.backendId;
    if (id == null || this.guardandoAccion) return;

    let peticion$: Observable<unknown> | null = null;
    let exito = '';

    switch (this.ventanaAccion) {
      case 'asignar':
        if (this.asesorCasoId == null) { this.errorAccion = 'Elige un asesor.'; return; }
        peticion$ = this.caseService.reasignarCaso(id, this.asesorCasoId);
        exito = `Caso asignado a ${this.asesoresCaso.find(a => a.advisorId === this.asesorCasoId)?.fullName ?? 'el asesor'}.`;
        break;
      case 'cerrar':
        if (!this.tipoCierre) { this.errorAccion = 'Elige cómo se cierra el caso.'; return; }
        peticion$ = this.caseService.cerrarCaso(id, this.tipoCierre, this.detalleCierre);
        exito = 'Caso cerrado.';
        break;
    }

    if (!peticion$) return;

    this.guardandoAccion = true;
    this.errorAccion = '';

    peticion$.subscribe({
      next: () => {
        this.guardandoAccion = false;
        this.ventanaAccion = '';
        this.mostrarAvisoAcciones(exito);
        this.cargarNotasYBitacora();
        this.casoActualizado.emit(null);
      },
      error: error => {
        this.guardandoAccion = false;
        this.errorAccion = error?.status === 403
          ? 'Tu rol no tiene permiso para hacer esta acción.'
          : error?.error?.message || 'No fue posible completar la acción.';
        this.cdr.markForCheck();
      }
    });
  }

  // =========================================
  // MENÚ "ACCIONES" (como en Figma)
  // =========================================

  submenuEstadoAbierto = false;

  avisoAcciones = '';
  private temporizadorAviso?: ReturnType<typeof setTimeout>;

  readonly estadosCaso = [
    { valor: 'EN_GESTION', texto: 'En Gestión' },
    { valor: 'ILOCALIZADO', texto: 'Ilocalizado / Sin respuesta' },
    { valor: 'PROMESA_PAGO', texto: 'Promesa Pago' },
    { valor: 'PREJURIDICO', texto: 'Prejurídico' }
  ];

  abrirAcciones(): void {
    this.mostrarAcciones = !this.mostrarAcciones;
    this.submenuEstadoAbierto = false;
  }

  cerrarAcciones(): void {
    this.mostrarAcciones = false;
    this.submenuEstadoAbierto = false;
  }

  @HostListener('document:click')
  cerrarAccionesAlHacerClicAfuera(): void {
    if (this.mostrarAcciones) {
      this.cerrarAcciones();
    }
  }

  @HostListener('document:keydown.escape')
  cerrarAccionesConEscape(): void {
    this.cerrarAcciones();
  }

  esEstadoActual(valor: string): boolean {
    return (this.caso?.estado ?? '').toUpperCase() === valor;
  }

  // PUT /management/cases/{id}?status=
  cambiarEstadoCaso(estado: { valor: string; texto: string }): void {
    this.cerrarAcciones();
    const id = this.caso?.backendId;
    if (id == null || this.esEstadoActual(estado.valor)) return;

    this.caseService.cambiarEstado(id, estado.valor).subscribe({
      next: () => {
        const actualizado = this.caso ? { ...this.caso, estado: estado.valor } : null;
        this.mostrarAvisoAcciones(`Estado cambiado a "${estado.texto}".`);
        // El encabezado y el caso se refrescan con el estado nuevo
        this.casoActualizado.emit(actualizado);
      },
      error: error => this.mostrarAvisoAcciones(error?.status === 403
        ? 'Tu rol no tiene permiso para cambiar el estado.'
        : error?.error?.message || 'No fue posible cambiar el estado.')
    });
  }

  accionAsignarAsesor(): void {
    this.abrirVentanaAccion('asignar');
  }

  accionEnviarLink(): void {
    this.cerrarAcciones();
    this.generarLink();
  }

  // Lleva a la pestaña Notas y pone el cursor en el campo de la nota
  accionAgregarNota(): void {
    this.cerrarAcciones();
    this.cambiarSeccion('notas');
    setTimeout(() => document.getElementById('nuevaNota')?.focus(), 50);
  }

  accionCerrarCaso(): void {
    this.abrirVentanaAccion('cerrar');
  }

  private mostrarAvisoAcciones(texto: string): void {
    this.cdr.markForCheck();
    this.avisoAcciones = texto;
    clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => {
      this.avisoAcciones = '';
      this.cdr.markForCheck();
    }, 3500);
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
    const numero = this.soloDigitos(this.clienteDetalle?.mobile || this.clienteDetalle?.phone);
    if (!numero) { this.mostrarAvisoAcciones('El cliente no tiene celular registrado.'); return; }
    window.open(`https://wa.me/${numero.length === 10 ? '57' + numero : numero}`, '_blank', 'noopener');
    this.registrarContacto('WHATSAPP');
  }

  llamarAsociado(): void {
    const numero = this.soloDigitos(this.clienteDetalle?.mobile || this.clienteDetalle?.phone);
    if (!numero) { this.mostrarAvisoAcciones('El cliente no tiene teléfono registrado.'); return; }
    window.location.href = `tel:${numero}`;
    this.registrarContacto('LLAMADA');
  }

  enviarEmail(): void {
    const correo = this.clienteDetalle?.email;
    if (!correo) { this.mostrarAvisoAcciones('El cliente no tiene correo registrado.'); return; }
    window.location.href = `mailto:${correo}`;
    this.registrarContacto('EMAIL');
  }

  enviarSMS(): void {
    const numero = this.soloDigitos(this.clienteDetalle?.mobile || this.clienteDetalle?.phone);
    if (!numero) { this.mostrarAvisoAcciones('El cliente no tiene celular registrado.'); return; }
    window.location.href = `sms:${numero}`;
    this.registrarContacto('SMS');
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
