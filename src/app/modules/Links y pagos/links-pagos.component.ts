import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { SidebarComponent } from '../../components/sidedar/sidebar.component';
import { DashboardHeaderComponent } from '../../components/dashboard-header/dashboard-header.component';
import { PagosService, LinkBackend, PagoBackend } from '../../service/pagos.service';
import { CarteraService, ObligacionCartera } from '../../service/cartera.service';

// ==================================================
// MODELO DE CADA FILA (sirve para links y para pagos)
// ==================================================

export interface Registro {
  id: number;                 // id del link en el backend (el pago usa el mismo)
  codigo: string;             // LNK-00012 o PAG-00012
  asociado: string;
  documento: string;
  obligacion: string;
  obligacionId: number | null;
  valor: number;
  canal: string;              // WHATSAPP, SMS, EMAIL...
  estado: string;             // texto para mostrar: Pagado, En proceso, Vencido...
  estadoBackend: string;      // GENERATED, SENT, OPENED, USED, EXPIRED, CANCELLED
  pagado: boolean;
  fecha: string | null;       // fecha de la última actualización (ISO)
  creado: string | null;      // fecha de creación / envío (ISO)
  expira: string | null;
  url: string | null;
  transaccion: string | null; // id del pago en la pasarela
  diasMora: number | null;
  riesgo: string | null;
  score: number | null;
}

interface Kpi {
  titulo: string;
  valor: string;
  variacion: string | null;   // null = no hay con qué comparar
  icono: 'money' | 'send' | 'check' | 'chart';
}

interface CanalResumen {
  nombre: string;
  porcentaje: number;
  pagados: number;
  enviados: number;
}

// Nombres para mostrar de los canales del backend
const NOMBRES_CANAL: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  EMAIL: 'Email',
  VOICE: 'Voz',
  VOZ: 'Voz'
};

// Estados en los que un link todavía se puede pagar (y por eso cancelar)
const ESTADOS_ACTIVOS = ['GENERATED', 'SENT', 'OPENED'];

const DIA_MS = 24 * 60 * 60 * 1000;

// ==================================================
// PANTALLA LINKS Y PAGOS
// Conectada al backend:
//   GET  /v1/payments/links        → pestaña "Links de pago"
//   GET  /payments                 → pestaña "Pagos" (los que quedaron pagados)
//   POST /v1/payments/generate-link → "Crear link de pago"
//   POST /payments/{id}/cancel     → "Cancelar link"
// ==================================================

@Component({
  selector: 'app-links-pagos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent,
    DashboardHeaderComponent
  ],
  templateUrl: './links-pagos.component.html',
  styleUrl: './links-pagos.component.css'
})
export class LinksPagosComponent implements OnInit, OnDestroy {

  private router = inject(Router);
  private pagosService = inject(PagosService);
  private carteraService = inject(CarteraService);

  // Esta versión de Angular no redibuja sola cuando llega una respuesta del backend
  private cdr = inject(ChangeDetectorRef);

  // Pestaña seleccionada
  pestanaActiva: 'links' | 'pagos' = 'pagos';

  // Datos del backend
  links: Registro[] = [];
  pagos: Registro[] = [];

  // Estados de carga
  cargando = true;
  errorCarga = '';
  private ultimaCarga: Date | null = null;

  // Buscador y filtros
  busqueda = '';
  mostrarFiltros = false;
  filtroEstado = 'Todos';

  // Indicadores, gráfico y canales (se calculan al cargar)
  kpis: Kpi[] = [];
  canales: CanalResumen[] = [];
  grafico = { lineaLinks: '', areaLinks: '', lineaPagos: '', areaPagos: '', maximo: 0, etiquetasX: [] as string[] };

  // Mensaje corto abajo a la derecha
  mensaje = '';
  private temporizadorMensaje?: ReturnType<typeof setTimeout>;
  private relojActualizado?: ReturnType<typeof setInterval>;

  // ==================================================
  // CARGAR DATOS
  // ==================================================

  ngOnInit(): void {
    this.cargar();
    // Mantiene al día el texto "Actualizado hace X min"
    this.relojActualizado = setInterval(() => this.refrescarVista(), 60_000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizadorMensaje);
    clearInterval(this.relojActualizado);
  }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = '';

    forkJoin({
      links: this.pagosService.listarLinks(),
      pagos: this.pagosService.listarPagos()
    }).subscribe({
      next: ({ links, pagos }) => {
        this.armarDatos(links ?? [], pagos?.content ?? []);
        this.cargando = false;
        this.ultimaCarga = new Date();
        this.refrescarVista();
      },
      error: (error: HttpErrorResponse) => {
        this.errorCarga = this.textoError(error, 'No se pudieron cargar los links y pagos.');
        this.cargando = false;
        this.refrescarVista();
      }
    });
  }

  refrescar(): void {
    if (!this.cargando) {
      this.cargar();
    }
  }

  get textoActualizado(): string {
    if (this.cargando) return 'Actualizando...';
    if (!this.ultimaCarga) return '';
    const minutos = Math.floor((Date.now() - this.ultimaCarga.getTime()) / 60_000);
    if (minutos < 1) return 'Actualizado hace un momento';
    return `Actualizado hace ${minutos} min`;
  }

  // Une las dos respuestas del backend y calcula todo lo de la pantalla
  private armarDatos(links: LinkBackend[], filasPagos: PagoBackend[]): void {

    // Información extra de cada link que solo viene en /payments
    const extra = new Map<number, PagoBackend>();
    filasPagos.forEach(p => extra.set(p.paymentLinkId, p));

    this.links = links
      .map(l => this.convertirLink(l, extra.get(l.id)))
      .sort((a, b) => this.tiempo(b.creado) - this.tiempo(a.creado));

    // Un pago es un link que quedó pagado
    const transacciones = new Map(this.links.map(l => [l.id, l.transaccion]));
    this.pagos = filasPagos
      .filter(p => p.paymentCompleted || p.paymentStatus === 'USED')
      .map(p => this.convertirPago(p, transacciones.get(p.paymentLinkId) ?? null))
      .sort((a, b) => this.tiempo(b.fecha) - this.tiempo(a.fecha));

    // Si el panel estaba abierto, se vuelve a apuntar a la fila nueva
    if (this.registroSeleccionado) {
      const lista = this.pestanaActiva === 'pagos' ? this.pagos : this.links;
      this.registroSeleccionado = lista.find(r => r.id === this.registroSeleccionado!.id) ?? null;
    }

    this.calcularKpis();
    this.calcularCanales();
    this.calcularGrafico();
  }

  private convertirLink(l: LinkBackend, extra?: PagoBackend): Registro {
    const pagado = l.status === 'USED' || l.transactionStatus === 'Pagado' || !!extra?.paymentCompleted;
    return {
      id: l.id,
      codigo: this.codigo('LNK', l.id),
      asociado: l.clientName || 'Sin nombre',
      documento: this.documento(l.documentType, l.documentNumber),
      obligacion: l.obligationNumber || '—',
      obligacionId: l.obligationId ?? null,
      valor: Number(l.amount ?? 0),
      canal: (l.channel || '').toUpperCase(),
      estado: this.textoEstadoLink(l, pagado),
      estadoBackend: l.status,
      pagado,
      fecha: extra?.updatedAt ?? l.createdAt ?? null,
      creado: l.createdAt ?? null,
      expira: l.expiresAt ?? null,
      url: l.generatedUrl || null,
      transaccion: l.zolevPaymentId || null,
      diasMora: l.daysPastDue ?? null,
      riesgo: extra?.riskLevel ?? null,
      score: extra?.score ?? null
    };
  }

  private convertirPago(p: PagoBackend, transaccion: string | null): Registro {
    return {
      id: p.paymentLinkId,
      codigo: this.codigo('PAG', p.paymentLinkId),
      asociado: p.clientName || 'Sin nombre',
      documento: p.clientDocument ? `CC ${this.miles(p.clientDocument)}` : '',
      obligacion: p.obligationNumber || '—',
      obligacionId: p.obligationId ?? null,
      valor: Number(p.amountCollected ?? p.amount ?? 0),
      canal: (p.originChannel || '').toUpperCase(),
      estado: 'Pagado',
      estadoBackend: p.paymentStatus || 'USED',
      pagado: true,
      fecha: p.updatedAt ?? p.createdAt ?? null,
      creado: p.createdAt ?? null,
      expira: null,
      url: p.generatedUrl || null,
      transaccion,
      diasMora: null,
      riesgo: p.riskLevel ?? null,
      score: p.score ?? null
    };
  }

  private textoEstadoLink(l: LinkBackend, pagado: boolean): string {
    if (pagado) return 'Pagado';
    if (l.status === 'CANCELLED') return 'Cancelado';
    if (l.status === 'EXPIRED' || l.transactionStatus === 'Vencido') return 'Vencido';
    if (l.status === 'OPENED') return 'Abierto';
    return 'Pendiente';
  }

  // ==================================================
  // INDICADORES (últimos 30 días contra los 30 anteriores)
  // ==================================================

  private calcularKpis(): void {
    const ahora = Date.now();
    const enRango = (fecha: string | null, desdeDias: number, hastaDias: number) => {
      const t = this.tiempo(fecha);
      return t > ahora - desdeDias * DIA_MS && t <= ahora - hastaDias * DIA_MS;
    };

    const pagosActual = this.pagos.filter(p => enRango(p.fecha, 30, 0));
    const pagosAnterior = this.pagos.filter(p => enRango(p.fecha, 60, 30));
    const linksActual = this.links.filter(l => enRango(l.creado, 30, 0));
    const linksAnterior = this.links.filter(l => enRango(l.creado, 60, 30));

    const recaudoActual = pagosActual.reduce((s, p) => s + p.valor, 0);
    const recaudoAnterior = pagosAnterior.reduce((s, p) => s + p.valor, 0);

    const conversionActual = linksActual.length ? (pagosActual.length / linksActual.length) * 100 : 0;
    const conversionAnterior = linksAnterior.length ? (pagosAnterior.length / linksAnterior.length) * 100 : 0;

    this.kpis = [
      {
        titulo: 'Recaudo últimos 30 días',
        valor: this.formatearValor(recaudoActual),
        variacion: this.variacion(recaudoActual, recaudoAnterior),
        icono: 'money'
      },
      {
        titulo: 'Links enviados',
        valor: linksActual.length.toLocaleString('es-CO'),
        variacion: this.variacion(linksActual.length, linksAnterior.length),
        icono: 'send'
      },
      {
        titulo: 'Pagos realizados',
        valor: pagosActual.length.toLocaleString('es-CO'),
        variacion: this.variacion(pagosActual.length, pagosAnterior.length),
        icono: 'check'
      },
      {
        titulo: 'Conversión de links',
        valor: this.porcentaje(conversionActual),
        // En la conversión se muestra la diferencia en puntos
        variacion: linksAnterior.length
          ? `${conversionActual - conversionAnterior >= 0 ? '+' : ''}${this.porcentaje(conversionActual - conversionAnterior)}`
          : null,
        icono: 'chart'
      }
    ];
  }

  // "+12.4%" comparando con el periodo anterior; null si antes no hubo nada
  private variacion(actual: number, anterior: number): string | null {
    if (!anterior) return null;
    const cambio = ((actual - anterior) / anterior) * 100;
    return `${cambio >= 0 ? '+' : ''}${this.porcentaje(cambio)}`;
  }

  private porcentaje(valor: number): string {
    return valor.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%';
  }

  // ==================================================
  // EFECTIVIDAD POR CANAL (todos los links)
  // ==================================================

  private calcularCanales(): void {
    const grupos = new Map<string, { enviados: number; pagados: number }>();
    for (const l of this.links) {
      const canal = l.canal || 'OTRO';
      const g = grupos.get(canal) ?? { enviados: 0, pagados: 0 };
      g.enviados++;
      if (l.pagado) g.pagados++;
      grupos.set(canal, g);
    }

    this.canales = [...grupos.entries()]
      .map(([canal, g]) => ({
        nombre: this.nombreCanal(canal),
        enviados: g.enviados,
        pagados: g.pagados,
        porcentaje: Math.round((g.pagados / g.enviados) * 1000) / 10
      }))
      .sort((a, b) => b.enviados - a.enviados);
  }

  // ==================================================
  // GRÁFICO DE LOS ÚLTIMOS 30 DÍAS
  // ==================================================

  private calcularGrafico(): void {
    const dias = 30;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicio = hoy.getTime() - (dias - 1) * DIA_MS;

    const linksPorDia = new Array(dias).fill(0);
    const pagosPorDia = new Array(dias).fill(0);

    const indice = (fecha: string | null) => {
      const d = new Date(this.tiempo(fecha));
      d.setHours(0, 0, 0, 0);
      return Math.round((d.getTime() - inicio) / DIA_MS);
    };

    this.links.forEach(l => {
      const i = indice(l.creado);
      if (i >= 0 && i < dias) linksPorDia[i]++;
    });
    this.pagos.forEach(p => {
      const i = indice(p.fecha);
      if (i >= 0 && i < dias) pagosPorDia[i]++;
    });

    const maximoReal = Math.max(...linksPorDia, ...pagosPorDia);
    // El eje sube de 4 en 4 para que las 5 marcas sean números enteros
    const maximo = Math.max(4, Math.ceil(maximoReal / 4) * 4);

    // El área del gráfico mide 500 x 138 (igual que el diseño)
    const puntos = (valores: number[]) => valores.map((v, i) => {
      const x = (i / (dias - 1)) * 500;
      const y = 138 - (v / maximo) * 128;
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    const linea = (valores: number[]) => 'M' + puntos(valores).join(' L');
    const area = (valores: number[]) => linea(valores) + ' L500 138 L0 138 Z';

    const etiqueta = (i: number) => {
      const d = new Date(inicio + i * DIA_MS);
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${String(d.getDate()).padStart(2, '0')} ${meses[d.getMonth()]}`;
    };

    this.grafico = {
      lineaLinks: linea(linksPorDia),
      areaLinks: area(linksPorDia),
      lineaPagos: linea(pagosPorDia),
      areaPagos: area(pagosPorDia),
      maximo,
      etiquetasX: [0, 7, 14, 21, 29].map(etiqueta)
    };
  }

  // Marcas del eje Y (de arriba hacia abajo)
  get etiquetasY(): number[] {
    const m = this.grafico.maximo;
    return [m, (m * 3) / 4, m / 2, m / 4, 0];
  }

  // ==================================================
  // ESTADO DE LA PASARELA
  // ==================================================

  get ultimaTransaccion(): string {
    const ultimo = this.pagos[0];
    if (!ultimo?.fecha) return 'Sin pagos registrados';
    const minutos = Math.floor((Date.now() - this.tiempo(ultimo.fecha)) / 60_000);
    if (minutos < 1) return 'Hace un momento';
    if (minutos < 60) return `Hace ${minutos} minuto${minutos === 1 ? '' : 's'}`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} hora${horas === 1 ? '' : 's'}`;
    const dias = Math.floor(horas / 24);
    return `Hace ${dias} día${dias === 1 ? '' : 's'}`;
  }

  get linksActivos(): number {
    return this.links.filter(l => ESTADOS_ACTIVOS.includes(l.estadoBackend) && !l.pagado).length;
  }

  // ==================================================
  // TABLA: BÚSQUEDA, FILTRO Y PAGINACIÓN
  // ==================================================

  get estadosDisponibles(): string[] {
    const lista = this.pestanaActiva === 'pagos' ? this.pagos : this.links;
    return [...new Set(lista.map(r => r.estado))];
  }

  get registrosFiltrados(): Registro[] {
    const registros = this.pestanaActiva === 'pagos' ? this.pagos : this.links;
    const texto = this.busqueda.trim().toLowerCase();

    return registros.filter(r => {
      const contenido = [r.codigo, r.asociado, r.documento, r.obligacion].join(' ').toLowerCase();
      return (!texto || contenido.includes(texto)) &&
        (this.filtroEstado === 'Todos' || r.estado === this.filtroEstado);
    });
  }

  readonly filasPorPagina = 5;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.registrosFiltrados.length / this.filasPorPagina));
  }

  // Botones de página: 1 2 3 … 15 (con "…" cuando hay muchas)
  get paginas(): (number | null)[] {
    const total = this.totalPaginas;
    const actual = Math.min(this.paginaActual, total);
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const lista: (number | null)[] = [1];
    const desde = Math.max(2, actual - 1);
    const hasta = Math.min(total - 1, actual + 1);
    if (desde > 2) lista.push(null);
    for (let p = desde; p <= hasta; p++) lista.push(p);
    if (hasta < total - 1) lista.push(null);
    lista.push(total);
    return lista;
  }

  get registrosPagina(): Registro[] {
    const pagina = Math.min(this.paginaActual, this.totalPaginas);
    const inicio = (pagina - 1) * this.filasPorPagina;
    return this.registrosFiltrados.slice(inicio, inicio + this.filasPorPagina);
  }

  get textoMostrando(): string {
    const total = this.registrosFiltrados.length;
    const tipo = this.pestanaActiva === 'pagos' ? 'pagos' : 'links';
    if (total === 0) {
      return `Mostrando 0 ${tipo}`;
    }
    const pagina = Math.min(this.paginaActual, this.totalPaginas);
    const desde = (pagina - 1) * this.filasPorPagina + 1;
    const hasta = Math.min(desde + this.filasPorPagina - 1, total);
    return `Mostrando ${desde} a ${hasta} de ${total.toLocaleString('es-CO')} ${tipo}`;
  }

  irAPagina(pagina: number | null): void {
    if (pagina !== null && pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  cambiarPestana(pestana: 'links' | 'pagos'): void {
    this.pestanaActiva = pestana;
    this.paginaActual = 1;
    this.registroSeleccionado = null;
    this.busqueda = '';
    this.filtroEstado = 'Todos';
  }

  // ==================================================
  // PANEL DE DETALLE
  // ==================================================

  registroSeleccionado: Registro | null = null;

  abrirDetalle(registro: Registro): void {
    this.registroSeleccionado = registro;
  }

  cerrarDetalle(): void {
    this.registroSeleccionado = null;
  }

  // El pago y el link son el mismo registro en el backend (mismo id)
  linkRelacionado(pago: Registro): Registro | null {
    return this.links.find(l => l.id === pago.id) ?? null;
  }

  pagoRelacionado(link: Registro): Registro | null {
    return this.pagos.find(p => p.id === link.id) ?? null;
  }

  puedeCancelar(link: Registro): boolean {
    return ESTADOS_ACTIVOS.includes(link.estadoBackend) && !link.pagado;
  }

  verLink(pago: Registro): void {
    const link = this.linkRelacionado(pago);
    this.cambiarPestana('links');
    this.registroSeleccionado = link;
  }

  verPago(link: Registro): void {
    const pago = this.pagoRelacionado(link);
    this.cambiarPestana('pagos');
    this.registroSeleccionado = pago;
  }

  irAlCaso(): void {
    void this.router.navigateByUrl('/gestion-casos');
  }

  verObligacion(): void {
    void this.router.navigateByUrl('/cartera');
  }

  copiarUrl(url: string | null): void {
    if (!url) return;
    navigator.clipboard?.writeText(url)
      .then(() => this.mostrarMensaje('Link copiado.'))
      .catch(() => this.mostrarMensaje('No se pudo copiar el link.'));
  }

  // ----- Cancelar link -----

  linkACancelar: Registro | null = null;
  cancelando = false;

  pedirCancelar(link: Registro): void {
    this.linkACancelar = link;
  }

  cerrarCancelar(): void {
    if (!this.cancelando) this.linkACancelar = null;
  }

  confirmarCancelar(): void {
    const link = this.linkACancelar;
    if (!link) return;

    this.cancelando = true;
    this.pagosService.cancelarLink(link.id).subscribe({
      next: () => {
        this.cancelando = false;
        this.linkACancelar = null;
        this.mostrarMensaje(`${link.codigo} fue cancelado.`);
        this.cargar();
      },
      error: (error: HttpErrorResponse) => {
        this.cancelando = false;
        this.linkACancelar = null;
        this.mostrarMensaje(this.textoError(error, 'No se pudo cancelar el link.'));
      }
    });
  }

  // ==================================================
  // CREAR LINK DE PAGO
  // ==================================================

  mostrarModalCrear = false;
  obligaciones: ObligacionCartera[] = [];
  cargandoObligaciones = false;
  creando = false;
  errorCrear = '';
  linkCreado: Registro | null = null;

  readonly canalesEnvio = [
    { valor: 'WHATSAPP', texto: 'WhatsApp' },
    { valor: 'SMS', texto: 'SMS' },
    { valor: 'EMAIL', texto: 'Correo electrónico' }
  ];

  readonly vigencias = [24, 48, 72];

  nuevoLink = this.formularioVacio();

  private formularioVacio() {
    return { obligacion: '', valor: null as number | null, canal: 'WHATSAPP', vigencia: 24 };
  }

  abrirModalCrear(): void {
    this.nuevoLink = this.formularioVacio();
    this.errorCrear = '';
    this.linkCreado = null;
    this.mostrarModalCrear = true;

    // Las obligaciones se piden una sola vez
    if (!this.obligaciones.length && !this.cargandoObligaciones) {
      this.cargandoObligaciones = true;
      this.carteraService.getObligations(0, 1000).subscribe({
        next: respuesta => {
          this.obligaciones = (respuesta?.content ?? [])
            .filter(o => o.status !== 'PAID');
          this.cargandoObligaciones = false;
          this.refrescarVista();
        },
        error: (error: HttpErrorResponse) => {
          this.cargandoObligaciones = false;
          this.errorCrear = this.textoError(error, 'No se pudieron cargar las obligaciones.');
          this.refrescarVista();
        }
      });
    }
  }

  cerrarModalCrear(): void {
    if (this.creando) return;
    this.mostrarModalCrear = false;
  }

  get obligacionElegida(): ObligacionCartera | null {
    const numero = this.nuevoLink.obligacion.trim().toLowerCase();
    return this.obligaciones.find(o => o.obligationNumber.toLowerCase() === numero) ?? null;
  }

  // Al elegir la obligación se propone como valor el saldo total
  alCambiarObligacion(): void {
    const o = this.obligacionElegida;
    if (o) {
      this.nuevoLink.valor = Math.round(o.totalBalance ?? o.currentBalance ?? 0);
    }
  }

  // Nombre del asociado de la obligación elegida (si ya tiene algún link)
  get asociadoElegido(): string {
    const o = this.obligacionElegida;
    if (!o) return '';
    return this.links.find(l => l.obligacionId === o.id)?.asociado ?? '';
  }

  crearLink(): void {
    const obligacion = this.obligacionElegida;
    const valor = Number(this.nuevoLink.valor);

    if (!obligacion) {
      this.errorCrear = 'Elige una obligación de la lista.';
      return;
    }
    if (!valor || valor <= 0) {
      this.errorCrear = 'Ingresa un valor mayor a cero.';
      return;
    }

    this.errorCrear = '';
    this.creando = true;

    this.carteraService.generatePaymentLink({
      clientId: obligacion.clientId,
      obligationId: obligacion.id,
      paymentAgreementId: null,
      amount: valor,
      currency: obligacion.currency || 'COP',
      channel: this.nuevoLink.canal,
      expiresInHours: Number(this.nuevoLink.vigencia)
    }).subscribe({
      next: respuesta => {
        this.creando = false;
        this.linkCreado = this.convertirLink(respuesta);
        this.cargar();
      },
      error: (error: HttpErrorResponse) => {
        this.creando = false;
        this.errorCrear = this.textoError(error, 'No se pudo generar el link de pago.');
        this.refrescarVista();
      }
    });
  }

  // ==================================================
  // FORMATOS
  // ==================================================

  obtenerClaseEstado(estado: string): string {
    switch (estado) {
      case 'Pagado':
        return 'estado-exitoso';
      case 'Pendiente':
      case 'Abierto':
        return 'estado-pendiente';
      case 'Vencido':
      case 'Cancelado':
        return 'estado-fallido';
      default:
        return '';
    }
  }

  // "$1.250.000" (sin espacio después del signo, como en Figma)
  formatearValor(valor: number | null | undefined): string {
    return '$' + Number(valor ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }

  nombreCanal(canal: string | null | undefined): string {
    if (!canal) return '—';
    return NOMBRES_CANAL[canal.toUpperCase()] ?? canal;
  }

  // "15/09/2026 14:30" para la tabla
  fechaCorta(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
  }

  // "15 sept 2026, 2:30 p. m." para el panel
  formatearFecha(iso: string | null): string {
    if (!iso) return '—';
    const fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return '—';
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
    const h = fecha.getHours();
    const sufijo = h < 12 ? 'a. m.' : 'p. m.';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const min = String(fecha.getMinutes()).padStart(2, '0');
    return `${fecha.getDate()} ${meses[fecha.getMonth()]} ${fecha.getFullYear()}, ${h12}:${min} ${sufijo}`;
  }

  textoRiesgo(riesgo: string | null): string {
    const nombres: Record<string, string> = {
      LOW: 'Bajo', MEDIUM: 'Medio', HIGH: 'Alto', CRITICAL: 'Crítico'
    };
    if (!riesgo) return '—';
    return nombres[riesgo.toUpperCase()] ?? riesgo;
  }

  private codigo(prefijo: string, id: number): string {
    return `${prefijo}-${String(id).padStart(5, '0')}`;
  }

  private documento(tipo: string | null | undefined, numero: string | null | undefined): string {
    if (!numero) return '';
    return `${tipo || 'CC'} ${this.miles(numero)}`;
  }

  // "79456123" → "79.456.123"
  private miles(numero: string): string {
    return /^\d+$/.test(numero) ? Number(numero).toLocaleString('es-CO') : numero;
  }

  private tiempo(iso: string | null | undefined): number {
    const t = iso ? new Date(iso).getTime() : 0;
    return isNaN(t) ? 0 : t;
  }

  private textoError(error: HttpErrorResponse, porDefecto: string): string {
    if (error.status === 0) return 'No hay conexión con el servidor.';
    if (error.status === 401) return 'Tu sesión terminó. Vuelve a iniciar sesión.';
    if (error.status === 403) return 'No tienes permiso para ver o hacer esto.';
    const cuerpo = error.error;
    if (cuerpo?.message && error.status < 500) return cuerpo.message;
    if (cuerpo?.detail && error.status < 500) return cuerpo.detail;
    return porDefecto;
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje = texto;
    clearTimeout(this.temporizadorMensaje);
    this.temporizadorMensaje = setTimeout(() => {
      this.mensaje = '';
      this.refrescarVista();
    }, 3500);
    this.refrescarVista();
  }

  private refrescarVista(): void {
    this.cdr.markForCheck();
  }

}
