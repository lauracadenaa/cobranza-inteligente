import { ChangeDetectorRef, Component, HostListener, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  EstrategiasService,
  PlantillaBackend,
  ReglaSegmentoBackend
} from '../../service/estrategias.service';

import { SidebarComponent } from '../../components/sidedar/sidebar.component';
import { DashboardHeaderComponent } from '../../components/dashboard-header/dashboard-header.component';

export type SeccionEstrategias = 'estrategias' | 'segmentacion' | 'contacto' | 'plantillas';

// Nombres para mostrar de los segmentos del backend
const NOMBRES_SEGMENTO: Record<string, string> = {
  PREVENTIVA: 'Preventiva',
  ADMINISTRATIVA: 'Administrativa',
  PREJUDICIAL: 'Prejurídica',
  JURIDICA: 'Jurídica'
};

const NOMBRES_CANAL: Record<string, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
  VOICE: 'Voz · guion',
  VOZ: 'Voz · guion'
};

const NOMBRES_PRIORIDAD: Record<string, string> = {
  LOW: 'Prioridad baja', BAJA: 'Prioridad baja',
  MEDIUM: 'Prioridad media', MEDIA: 'Prioridad media',
  HIGH: 'Prioridad alta', ALTA: 'Prioridad alta',
  CRITICAL: 'Prioridad crítica', CRITICA: 'Prioridad crítica'
};

export interface FilaSegmento {
  codigo: string;
  nombre: string;
  objeto: string;
  criterios: string[];
  registros: string[];
  estrategias: string;
  actualizacion: string;
  estado: string;
}

export interface FilaPlantilla {
  id: number;
  nombre: string;
  canal: string;
  segmento: string;
  estado: string;
  fecha: string;
  original: PlantillaBackend;
}

// ==================================================
// PANTALLA DE ESTRATEGIAS
// Conectado al backend:
//   - Segmentación: reglas de segmentación y conteos reales de la cartera
//   - Plantillas: listar, crear y editar (/strategy/templates)
// Con datos de ejemplo (el backend no tiene estas partes):
//   - Estrategias y Contacto y orquestación
// ==================================================

import { IconoComponent } from '../../shared/icono/icono.component';

@Component({
  selector: 'app-estrategias',
  standalone: true,
  imports: [FormsModule, IconoComponent, SidebarComponent, DashboardHeaderComponent],
  templateUrl: './estrategias.component.html',
  styleUrl: './estrategias.component.css'
})
export class EstrategiasComponent implements OnDestroy {

  private servicio = inject(EstrategiasService);
  private router = inject(Router);

  // Esta versión de Angular no redibuja sola cuando llega una respuesta del backend
  private cdr = inject(ChangeDetectorRef);

  // Pestaña que se está viendo
  // Como se pidió: sin la pestaña "Estrategias"; se abre en "Segmentación"
  seccionActiva: SeccionEstrategias = 'segmentacion';

  constructor() {
    this.cargarSegmentos();
  }

  // Texto bajo el título: el mismo en las 3 pestañas (así está en Figma)
  get descripcion(): string {
    return 'Configura cómo se segmenta la cartera y cómo se ejecutan las acciones de contacto';
  }

  cambiarSeccion(seccion: SeccionEstrategias): void {
    this.seccionActiva = seccion;
    this.estrategiaSeleccionada = null;
    // Cada pestaña conectada pide sus datos la primera vez que se abre
    if (seccion === 'segmentacion' && !this.segmentosCargados) this.cargarSegmentos();
    if (seccion === 'plantillas' && !this.plantillasCargadas) this.cargarPlantillas();
  }

  // ==================================================
  // PESTAÑA: ESTRATEGIAS
  // ==================================================

  estrategias = [
    {
      nombre: 'Cobranza preventiva de consumo', segmento: 'Preventiva', canales: ['SMS · Email'], politica: 'Intensidad baja',
      vigencia: ['01/11/26 –', '31/12/26'], estado: 'Activa', accion: 'Ver detalle',
      // Datos del panel "Detalle de la estrategia"
      descripcion: 'Recordatorio anticipado para obligaciones de consumo próximas a vencer.',
      estadoDetalle: 'Publicada', vigenciaCompleta: '01/11/2026 al 31/12/2026',
      secuencia: 'Secuencia preventiva · SMS → Email',
      plantillas: 'Recordatorio preventivo SMS · Aviso de vencimiento'
    },
    {
      nombre: 'Gestión administrativa de tarjeta', segmento: 'Administrativa', canales: ['WhatsApp', 'Email · Voz'], politica: 'Intensidad media',
      vigencia: ['01/11/26 –', '31/01/27'], estado: 'Activa', accion: 'Ver detalle',
      descripcion: 'Gestión de obligaciones de tarjeta con mora temprana mediante canales digitales y voz.',
      estadoDetalle: 'Publicada', vigenciaCompleta: '01/11/2026 al 31/01/2027',
      secuencia: 'Secuencia administrativa · WhatsApp → Email → Voz',
      plantillas: 'Contacto administrativo · Guion de seguimiento'
    },
    {
      nombre: 'Gestión prejurídica', segmento: 'Prejurídica', canales: ['Email · Voz'], politica: 'Intensidad alta',
      vigencia: ['Sin iniciar'], estado: 'Borrador', accion: 'Editar borrador',
      descripcion: 'Gestión de obligaciones en mora avanzada, con seguimiento especializado.',
      estadoDetalle: 'Borrador', vigenciaCompleta: 'Sin iniciar',
      secuencia: 'Secuencia prejurídica · Email → Voz',
      plantillas: 'Aviso prejurídico · Guion de seguimiento'
    }
  ];

  // ----- Panel "Detalle de la estrategia" -----

  estrategiaSeleccionada: (typeof this.estrategias)[number] | null = null;

  abrirEstrategia(e: (typeof this.estrategias)[number]): void {
    this.estrategiaSeleccionada = e;
  }

  cerrarEstrategia(): void {
    this.estrategiaSeleccionada = null;
  }

  verAuditoria(): void {
    void this.router.navigateByUrl('/reportes-auditoria');
  }

  // Filtros
  busqueda = '';
  filtroSegmento = '';
  filtroEstado = '';
  filtroVigencia = '';

  get estrategiasFiltradas() {
    const texto = this.busqueda.trim().toLowerCase();
    return this.estrategias.filter(e =>
      (!texto || e.nombre.toLowerCase().includes(texto)) &&
      (!this.filtroSegmento || e.segmento === this.filtroSegmento) &&
      (!this.filtroEstado || e.estado === this.filtroEstado) &&
      (!this.filtroVigencia ||
        (this.filtroVigencia === 'Vigente' ? e.estado === 'Activa' : e.estado !== 'Activa'))
    );
  }

  // ==================================================
  // PESTAÑA: SEGMENTACIÓN
  // ==================================================

  segmentos: FilaSegmento[] = [];
  cargandoSegmentos = false;
  errorSegmentos = '';
  private segmentosCargados = false;

  cargarSegmentos(): void {
    this.cargandoSegmentos = true;
    this.errorSegmentos = '';

    forkJoin({
      reglas: this.servicio.listarReglasSegmento(),
      // Si los conteos fallan, igual se muestran las reglas
      cartera: this.servicio.carteraPorSegmento().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ reglas, cartera }) => {
        const activas = (reglas ?? [])
          .filter(r => r.active !== false)
          .sort((a, b) => (a.minDays ?? 0) - (b.minDays ?? 0));

        // Obligaciones por segmento (el backend las manda con nombre amigable)
        const obligaciones = new Map<string, number>();
        (cartera ?? []).forEach(c => obligaciones.set(this.normalizar(c.segment), c.obligationCount));

        this.segmentos = activas.map(r => this.convertirSegmento(r, obligaciones.get(this.normalizar(r.segment))));
        this.cargandoSegmentos = false;
        this.segmentosCargados = true;
        this.refrescarVista();

        this.contarAsociados(activas);
      },
      error: (error: HttpErrorResponse) => {
        this.cargandoSegmentos = false;
        this.errorSegmentos = this.textoError(error, 'No se pudieron cargar los segmentos.');
        this.refrescarVista();
      }
    });
  }

  // El número de asociados se pide aparte, uno por segmento
  private contarAsociados(reglas: ReglaSegmentoBackend[]): void {
    const pedidos = reglas.map(r =>
      this.servicio.contarAsociados(r.segment).pipe(
        map(p => ({ segmento: r.segment, total: p?.totalElements ?? null as number | null })),
        catchError(() => of({ segmento: r.segment, total: null as number | null }))
      )
    );
    if (!pedidos.length) return;

    forkJoin(pedidos).subscribe(resultados => {
      resultados.forEach(({ segmento, total }) => {
        const fila = this.segmentos.find(f => f.codigo === segmento);
        if (fila && total !== null) {
          fila.registros = [`${total.toLocaleString('es-CO')} asociados`, fila.registros[fila.registros.length - 1]];
        }
      });
      this.refrescarVista();
    });
  }

  private convertirSegmento(r: ReglaSegmentoBackend, obligaciones?: number): FilaSegmento {
    const nombre = this.nombreSegmento(r.segment);
    const cantidadEstrategias = this.estrategias.filter(e => e.segmento === nombre).length;

    const criterios = [this.textoMora(r.minDays, r.maxDays)];
    const prioridad = r.casePriority ? NOMBRES_PRIORIDAD[r.casePriority.toUpperCase()] : null;
    if (prioridad) criterios.push(prioridad);

    return {
      codigo: r.segment,
      nombre: r.label?.trim() || nombre,
      objeto: 'Obligación',
      criterios,
      registros: obligaciones !== undefined
        ? [`${obligaciones.toLocaleString('es-CO')} obligaciones`]
        : ['Sin datos de cartera'],
      estrategias: cantidadEstrategias === 1 ? '1 estrategia' : `${cantidadEstrategias} estrategias`,
      actualizacion: this.fechaCorta(r.updatedAt ?? null),
      estado: r.active === false ? 'Inactivo' : 'Activo'
    };
  }

  private textoMora(min: number, max: number | null): string {
    if (max === null || max === undefined) return `Mora ≥ ${min} días`;
    if (min === max) return `Mora ${min} días`;
    if (min <= 0) return `Mora ≤ ${max} días`;
    return `Mora ${min}–${max} días`;
  }

  // ==================================================
  // PESTAÑA: CONTACTO Y ORQUESTACIÓN
  // ==================================================

  politicas = [
    { nombre: 'Intensidad baja', sms: '1 / semana', email: '1 / semana', whatsapp: '1 / semana', voz: '1 / semana', horario: 'Ventana operativa', estado: 'Activa' },
    { nombre: 'Intensidad media', sms: '2 / semana', email: '2 / semana', whatsapp: '2 / semana', voz: '1 / semana', horario: 'Ventana operativa', estado: 'Activa' },
    { nombre: 'Intensidad alta', sms: '3 / semana', email: '3 / semana', whatsapp: '3 / semana', voz: '2 / semana', horario: 'Ventana operativa', estado: 'Activa' }
  ];

  secuencias = [
    { nombre: 'Secuencia administrativa', estrategia: 'Gestión administrativa de tarjeta', orden: 'WhatsApp → Email → Voz', condicion: 'Avanzar cuando no exista respuesta', espera: '24 horas', estado: 'Activa' },
    { nombre: 'Secuencia preventiva', estrategia: 'Cobranza preventiva de consumo', orden: 'SMS → Email', condicion: 'Sin respuesta del asociado', espera: '48 horas', estado: 'Activa' }
  ];

  condiciones = [
    { condicion: 'Saldo superior al umbral', operador: 'Mayor que', valor: '$ 10.000.000', cola: 'Gestión especializada', prioridad: 'Alta', estado: 'Activa' },
    { condicion: 'Riesgo alto o crítico', operador: 'Es uno de', valor: 'Alto · Crítico', cola: 'Gestión prioritaria', prioridad: 'Alta', estado: 'Activa' },
    { condicion: 'Intentos digitales fallidos', operador: 'Mayor o igual', valor: '3', cola: 'Seguimiento humano', prioridad: 'Media', estado: 'Activa' },
    { condicion: 'Datos insuficientes', operador: 'Es igual a', valor: 'Sí', cola: 'Validación de datos', prioridad: 'Media', estado: 'Activa' },
    { condicion: 'Solicitud explícita del asociado', operador: 'Es igual a', valor: 'Sí', cola: 'Atención al asociado', prioridad: 'Alta', estado: 'Activa' }
  ];

  // ==================================================
  // PESTAÑA: PLANTILLAS
  // ==================================================

  plantillas: FilaPlantilla[] = [];
  cargandoPlantillas = false;
  errorPlantillas = '';
  private plantillasCargadas = false;

  cargarPlantillas(): void {
    this.cargandoPlantillas = true;
    this.errorPlantillas = '';

    this.servicio.listarPlantillas().subscribe({
      next: lista => {
        this.plantillas = (lista ?? [])
          .map(p => this.convertirPlantilla(p))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.cargandoPlantillas = false;
        this.plantillasCargadas = true;
        this.refrescarVista();
      },
      error: (error: HttpErrorResponse) => {
        this.cargandoPlantillas = false;
        this.errorPlantillas = this.textoError(error, 'No se pudieron cargar las plantillas.');
        this.refrescarVista();
      }
    });
  }

  private convertirPlantilla(p: PlantillaBackend): FilaPlantilla {
    return {
      id: p.id,
      nombre: p.nombre,
      canal: this.nombreCanal(p.canal),
      segmento: p.segmento ? this.nombreSegmento(p.segmento) : 'Todos',
      estado: p.activa ? 'Activa' : 'Inactiva',
      fecha: this.fechaCorta(p.updatedAt ?? p.createdAt ?? null),
      original: p
    };
  }

  // Filtros
  filtroCanal = '';
  filtroEstadoPlantilla = '';
  filtroSegmentoPlantilla = '';
  filtroFecha = '';

  // Listas sin repetidos para llenar los filtros
  get canalesPlantilla(): string[] { return [...new Set(this.plantillas.map(p => p.canal))]; }
  get estadosPlantilla(): string[] { return [...new Set(this.plantillas.map(p => p.estado))]; }
  get segmentosPlantilla(): string[] { return [...new Set(this.plantillas.map(p => p.segmento))]; }
  get fechasPlantilla(): string[] { return [...new Set(this.plantillas.map(p => p.fecha))]; }

  get plantillasFiltradas(): FilaPlantilla[] {
    return this.plantillas.filter(p =>
      (!this.filtroCanal || p.canal === this.filtroCanal) &&
      (!this.filtroEstadoPlantilla || p.estado === this.filtroEstadoPlantilla) &&
      (!this.filtroSegmentoPlantilla || p.segmento === this.filtroSegmentoPlantilla) &&
      (!this.filtroFecha || p.fecha === this.filtroFecha)
    );
  }

  // ==================================================
  // FILTROS (igual que Inicio > Casos en gestión)
  // Cada campo del panel guarda su valor en la propiedad del mismo nombre.
  // ==================================================

  filtroAbierto: 'estrategias' | 'plantillas' | null = null;
  borradorFiltros: Record<string, string> = {};

  camposFiltro(tipo: 'estrategias' | 'plantillas'): { clave: string; etiqueta: string; todos: string; opciones: string[] }[] {
    if (tipo === 'estrategias') {
      return [
        { clave: 'filtroSegmento', etiqueta: 'Segmento', todos: 'Todos los segmentos', opciones: ['Preventiva', 'Administrativa', 'Prejurídica'] },
        { clave: 'filtroEstado', etiqueta: 'Estado', todos: 'Todos los estados', opciones: ['Activa', 'Borrador'] },
        { clave: 'filtroVigencia', etiqueta: 'Vigencia', todos: 'Todas', opciones: ['Vigente', 'Sin iniciar'] }
      ];
    }
    return [
      { clave: 'filtroCanal', etiqueta: 'Canal', todos: 'Todos los canales', opciones: this.canalesPlantilla },
      { clave: 'filtroEstadoPlantilla', etiqueta: 'Estado', todos: 'Todos los estados', opciones: this.estadosPlantilla },
      { clave: 'filtroSegmentoPlantilla', etiqueta: 'Segmento', todos: 'Todos los segmentos', opciones: this.segmentosPlantilla },
      { clave: 'filtroFecha', etiqueta: 'Fecha de actualización', todos: 'Todas las fechas', opciones: this.fechasPlantilla }
    ];
  }

  private valorFiltro(clave: string): string {
    return String((this as unknown as Record<string, string>)[clave] ?? '');
  }

  private ponerFiltro(clave: string, valor: string): void {
    (this as unknown as Record<string, string>)[clave] = valor;
  }

  alternarFiltros(tipo: 'estrategias' | 'plantillas', evento: MouseEvent): void {
    evento.stopPropagation();
    if (this.filtroAbierto === tipo) {
      this.filtroAbierto = null;
      return;
    }
    this.borradorFiltros = {};
    this.camposFiltro(tipo).forEach(c => this.borradorFiltros[c.clave] = this.valorFiltro(c.clave));
    this.filtroAbierto = tipo;
  }

  aplicarFiltros(tipo: 'estrategias' | 'plantillas'): void {
    this.camposFiltro(tipo).forEach(c => this.ponerFiltro(c.clave, this.borradorFiltros[c.clave] ?? ''));
    this.filtroAbierto = null;
  }

  limpiarFiltros(tipo: 'estrategias' | 'plantillas'): void {
    this.camposFiltro(tipo).forEach(c => this.ponerFiltro(c.clave, ''));
    this.borradorFiltros = {};
    this.filtroAbierto = null;
  }

  chipsFiltro(tipo: 'estrategias' | 'plantillas'): { clave: string; texto: string }[] {
    return this.camposFiltro(tipo)
      .filter(c => this.valorFiltro(c.clave))
      .map(c => ({ clave: c.clave, texto: `${c.etiqueta}: ${this.valorFiltro(c.clave)}` }));
  }

  quitarFiltro(clave: string): void {
    this.ponerFiltro(clave, '');
  }

  @HostListener('document:click', ['$event'])
  cerrarFiltrosAfuera(evento: MouseEvent): void {
    const objetivo = evento.target as HTMLElement | null;
    if (this.filtroAbierto && !objetivo?.closest('.filtros-modal, .managed-filter')) {
      this.filtroAbierto = null;
    }
  }

  // ----- Ventana: ver / editar plantilla -----

  readonly camposEditables: { clave: keyof PlantillaBackend; texto: string; largo: boolean }[] = [
    { clave: 'asunto', texto: 'Asunto', largo: false },
    { clave: 'saludo', texto: 'Saludo', largo: true },
    { clave: 'mensajePrincipal', texto: 'Mensaje principal', largo: true },
    { clave: 'textoAntesBoton', texto: 'Texto antes del botón', largo: true },
    { clave: 'textoBoton', texto: 'Texto del botón', largo: false },
    { clave: 'despedida', texto: 'Despedida', largo: true },
    { clave: 'footer', texto: 'Pie de página', largo: true },
    { clave: 'avisoLegal', texto: 'Aviso legal', largo: true },
    { clave: 'plantillaSms', texto: 'Texto para SMS', largo: true }
  ];

  plantillaEnEdicion: FilaPlantilla | null = null;
  formularioPlantilla: Record<string, string> = {};
  activaPlantilla = true;
  guardandoPlantilla = false;
  errorFormularioPlantilla = '';

  abrirPlantilla(fila: FilaPlantilla): void {
    this.plantillaEnEdicion = fila;
    this.formularioPlantilla = {};
    this.camposEditables.forEach(c => {
      this.formularioPlantilla[c.clave] = (fila.original[c.clave] as string | null | undefined) ?? '';
    });
    this.activaPlantilla = fila.original.activa;
    this.errorFormularioPlantilla = '';
  }

  cerrarPlantilla(): void {
    if (!this.guardandoPlantilla) this.plantillaEnEdicion = null;
  }

  guardarPlantilla(): void {
    const fila = this.plantillaEnEdicion;
    if (!fila) return;

    // Solo se mandan los campos que cambiaron
    const cambios: Record<string, string | boolean> = {};
    this.camposEditables.forEach(c => {
      const antes = (fila.original[c.clave] as string | null | undefined) ?? '';
      const ahora = this.formularioPlantilla[c.clave] ?? '';
      if (ahora !== antes) cambios[c.clave] = ahora;
    });
    if (this.activaPlantilla !== fila.original.activa) cambios['activa'] = this.activaPlantilla;

    if (!Object.keys(cambios).length) {
      this.plantillaEnEdicion = null;
      return;
    }

    this.guardandoPlantilla = true;
    this.errorFormularioPlantilla = '';

    this.servicio.editarPlantilla(fila.id, cambios).subscribe({
      next: actualizada => {
        const nueva = this.convertirPlantilla(actualizada);
        this.plantillas = this.plantillas.map(p => (p.id === fila.id ? nueva : p));
        this.guardandoPlantilla = false;
        this.plantillaEnEdicion = null;
        this.mostrarAviso('Plantilla actualizada.');
      },
      error: (error: HttpErrorResponse) => {
        this.guardandoPlantilla = false;
        this.errorFormularioPlantilla = this.textoError(error, 'No se pudo guardar la plantilla.');
        this.refrescarVista();
      }
    });
  }

  // ----- Ventana: crear plantilla -----

  readonly canalesNuevaPlantilla = [
    { valor: 'EMAIL', texto: 'Email' },
    { valor: 'SMS', texto: 'SMS' },
    { valor: 'WHATSAPP', texto: 'WhatsApp' }
  ];

  readonly segmentosNuevaPlantilla = Object.entries(NOMBRES_SEGMENTO).map(([valor, texto]) => ({ valor, texto }));

  creandoPlantilla = false;
  guardandoNueva = false;
  errorNuevaPlantilla = '';
  nuevaPlantilla = this.nuevaPlantillaVacia();

  private nuevaPlantillaVacia() {
    return { nombre: '', canal: 'EMAIL', segmento: '', asunto: '', contenido: '', activa: true };
  }

  // Texto de ejemplo dentro del campo "Contenido"
  get ejemploContenido(): string {
    return this.nuevaPlantilla.canal === 'EMAIL'
      ? '<p>Estimado/a {{nombre_cliente}}, ...</p>'
      : 'Hola {{nombre_cliente}}, tu obligación {{numero_obligacion}} ...';
  }

  abrirCrearPlantilla(): void {
    this.nuevaPlantilla = this.nuevaPlantillaVacia();
    this.errorNuevaPlantilla = '';
    this.creandoPlantilla = true;
  }

  cerrarCrearPlantilla(): void {
    if (!this.guardandoNueva) this.creandoPlantilla = false;
  }

  guardarNuevaPlantilla(): void {
    const d = this.nuevaPlantilla;
    const nombre = d.nombre.trim();
    const contenido = d.contenido.trim();

    if (!nombre || !contenido) {
      this.errorNuevaPlantilla = 'El nombre y el contenido son obligatorios.';
      return;
    }
    if (nombre.length > 100) {
      this.errorNuevaPlantilla = 'El nombre no puede tener más de 100 caracteres.';
      return;
    }
    if (this.plantillas.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
      this.errorNuevaPlantilla = 'Ya existe una plantilla con ese nombre.';
      return;
    }

    this.guardandoNueva = true;
    this.errorNuevaPlantilla = '';

    this.servicio.crearPlantilla({
      nombre,
      canal: d.canal,
      segmento: d.segmento || null,
      contenido,
      activa: d.activa,
      asunto: d.canal === 'EMAIL' ? (d.asunto.trim() || null) : null,
      // En SMS y WhatsApp el contenido es el texto del mensaje
      plantillaSms: d.canal === 'EMAIL' ? null : contenido
    }).subscribe({
      next: creada => {
        this.plantillas = [...this.plantillas, this.convertirPlantilla(creada)]
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.guardandoNueva = false;
        this.creandoPlantilla = false;
        this.mostrarAviso('Plantilla creada.');
      },
      error: (error: HttpErrorResponse) => {
        this.guardandoNueva = false;
        this.errorNuevaPlantilla = this.textoError(error, 'No se pudo crear la plantilla.');
        this.refrescarVista();
      }
    });
  }

  // ==================================================
  // AYUDAS
  // ==================================================

  // Ícono que acompaña cada segmento en la tabla (como en Figma)
  iconoSegmento(codigo: string): string {
    const c = this.normalizar(codigo);
    if (c === 'PREJUDICIAL') return 'briefcase-business';
    if (c === 'JURIDICA') return 'landmark';
    return 'users';
  }

  nombreSegmento(codigo: string): string {
    return NOMBRES_SEGMENTO[this.normalizar(codigo)] ?? codigo;
  }

  nombreCanal(codigo: string): string {
    return NOMBRES_CANAL[(codigo || '').toUpperCase()] ?? codigo;
  }

  // "Jurídica" → "JURIDICA" (sin tildes y en mayúsculas) para poder comparar
  private normalizar(texto: string): string {
    return (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  }

  // "18/11/26"
  private fechaCorta(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
  }

  private textoError(error: HttpErrorResponse, porDefecto: string): string {
    if (error.status === 0) return 'No hay conexión con el servidor.';
    if (error.status === 401) return 'Tu sesión terminó. Vuelve a iniciar sesión.';
    if (error.status === 403) return 'No tienes permiso para ver o hacer esto (se necesita rol Administrador o Supervisor).';
    if (error.status === 400) return 'El backend rechazó los datos. Revisa los campos obligatorios.';
    const cuerpo = error.error;
    if (cuerpo?.message && error.status < 500) return cuerpo.message;
    return porDefecto;
  }

  private refrescarVista(): void {
    this.cdr.markForCheck();
  }

  // ==================================================
  // BOTONES QUE TODAVÍA NO TIENEN PANTALLA
  // ==================================================

  aviso = '';
  private temporizador?: ReturnType<typeof setTimeout>;

  proximamente(accion: string): void {
    this.mostrarAviso(`"${accion}" estará disponible pronto.`);
  }

  private mostrarAviso(texto: string): void {
    this.aviso = texto;
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.aviso = '';
      this.refrescarVista();
    }, 3000);
    this.refrescarVista();
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
  }

}
