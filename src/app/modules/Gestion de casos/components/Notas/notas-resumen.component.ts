
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


interface NotaCaso {
  id: number;
  nombre: string;
  fecha: string;
  hora: string;
  rol: string;
  gestion: string;
  notaInterna: string;
  archivo?: string;
  archivoUrl?: string;
}

@Component({
  selector: 'app-notas-resumen',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './notas-resumen.component.html',
  styleUrl: './notas-resumen.component.css'
})
export class NotasResumenComponent implements OnChanges, OnInit {

  ngOnInit(): void {
    this.actualizarAutores();
  }

  @Input() notas: NotaCaso[] = [];

  // Mientras el caso guarda la nota en el backend
  @Input() guardando = false;
  @Input() error = '';

  // El caso abierto es quien guarda en el backend
  @Output() guardar = new EventEmitter<{ categoria: string; texto: string }>();
  @Output() aclarar = new EventEmitter<{ nota: NotaCaso; texto: string }>();

  // =========================================
  // CATEGORÍAS
  // =========================================

  categorias: string[] = [
    'Seguimiento',
    'Gestión',
    'Obligación',
    'Compromiso de pago',
    'Supervisor',
    'Otra'
  ];

  categoriaSeleccionada = '';

  // =========================================
  // FILTROS
  // =========================================

  busquedaNota = '';

  categoriaFiltro = 'Todas';

  autorFiltro = 'Todos';

  // Periodo (como en Figma: "Últimos 30 días")
  periodoFiltro = '30';

  readonly opcionesPeriodo = [
    { valor: '7', texto: 'Últimos 7 días' },
    { valor: '30', texto: 'Últimos 30 días' },
    { valor: '90', texto: 'Últimos 90 días' },
    { valor: 'todas', texto: 'Todas las fechas' }
  ];

  autores: string[] = [];

  // =========================================
  // ACTUALIZAR AUTORES
  // =========================================

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['notas']) {
      this.actualizarAutores();
    }

  }

  actualizarAutores(): void {

    this.autores = [
      ...new Set(
        this.notas.map(nota => nota.nombre)
      )
    ];

  }

  // =========================================
  // NOTAS FILTRADAS
  // =========================================

  get notasFiltradas(): NotaCaso[] {

    const busqueda = this.busquedaNota
      .trim()
      .toLowerCase();

    return this.notas.filter(nota => {

      // BÚSQUEDA POR TEXTO
      const coincideBusqueda =
        !busqueda ||
        (nota.nombre || '').toLowerCase().includes(busqueda) ||
        (nota.gestion || '').toLowerCase().includes(busqueda) ||
        (nota.notaInterna || '').toLowerCase().includes(busqueda) ||
        (nota.rol || '').toLowerCase().includes(busqueda);

      // FILTRO POR CATEGORÍA
      const coincideCategoria =
        this.categoriaFiltro === 'Todas' ||
        nota.gestion === this.categoriaFiltro;

      // FILTRO POR AUTOR
      const coincideAutor =
        this.autorFiltro === 'Todos' ||
        nota.nombre === this.autorFiltro;

      // FILTRO POR PERIODO
      const coincideFecha = this.dentroDelPeriodo(nota.fecha);

      return (
        coincideBusqueda &&
        coincideCategoria &&
        coincideAutor &&
        coincideFecha
      );

    });

  }

  private dentroDelPeriodo(fecha: string): boolean {
    if (this.periodoFiltro === 'todas') return true;
    const dia = this.convertirFecha(fecha);
    if (!dia) return true;
    const limite = new Date();
    limite.setHours(0, 0, 0, 0);
    limite.setDate(limite.getDate() - Number(this.periodoFiltro));
    return new Date(dia + 'T00:00:00') >= limite;
  }

  // =========================================
  // AYUDAS PARA DIBUJAR (como en Figma)
  // =========================================

  iniciales(nombre: string): string {
    return (nombre || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p.charAt(0).toUpperCase())
      .join('');
  }

  // Avatar morado para el sistema / IA, azul para personas
  esSistema(nota: NotaCaso): boolean {
    return /sistema|motor/i.test(`${nota.rol} ${nota.nombre}`);
  }

  // Color de la etiqueta de categoría
  claseCategoria(categoria: string): string {
    const valor = (categoria || '').toLowerCase();
    if (valor.includes('seguimiento')) return 'cat-azul';
    if (valor.includes('supervis')) return 'cat-naranja';
    if (valor.includes('obligaci') || valor.includes('compromiso')) return 'cat-morado';
    if (valor.includes('novedad')) return 'cat-naranja';
    return 'cat-suave';
  }

  // =========================================
  // CONVERTIR FECHA A YYYY-MM-DD
  // =========================================

  convertirFecha(fecha: string): string {

    if (!fecha) {
      return '';
    }

    // Formato dd/MM/yyyy
    const partes = fecha.split('/');

    if (partes.length === 3) {

      const [dia, mes, anio] = partes;

      return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

    }

    // Formato ISO: yyyy-MM-dd o yyyy-MM-ddTHH:mm:ss
    return fecha.substring(0, 10);

  }

  // =========================================
  // FORMULARIO AGREGAR NOTA
  // =========================================

  nuevaNota = '';

  guardarNota(): void {

    const contenido = this.nuevaNota.trim();

    if (
      !this.categoriaSeleccionada ||
      !contenido ||
      contenido.length > 500
    ) {
      return;
    }

    // Se envía al backend (lo hace el caso abierto) y se limpia el formulario
    this.guardar.emit({ categoria: this.categoriaSeleccionada, texto: contenido });

    this.categoriaSeleccionada = '';
    this.nuevaNota = '';

  }

  // =========================================
  // VER DETALLE DE UNA NOTA
  // =========================================

  notaSeleccionada: NotaCaso | null = null;

  mostrarDetalle = false;

  verDetalle(nota: NotaCaso): void {

    this.notaSeleccionada = nota;

    this.mostrarDetalle = true;

  }

  cerrarDetalle(): void {

    this.mostrarDetalle = false;

    this.notaSeleccionada = null;

  }

  // =========================================
  // AGREGAR ACLARACIÓN
  // =========================================

  mostrarAclaracion = false;

  aclaracion = '';

  abrirAclaracion(nota: NotaCaso): void {

    this.notaSeleccionada = nota;

    this.aclaracion = '';

    this.mostrarAclaracion = true;

  }

  cerrarAclaracion(): void {

    this.mostrarAclaracion = false;

    this.aclaracion = '';

    this.notaSeleccionada = null;

  }

  guardarAclaracion(): void {

    if (
      !this.aclaracion.trim() ||
      !this.notaSeleccionada
    ) {
      return;
    }

    this.aclarar.emit({ nota: this.notaSeleccionada, texto: this.aclaracion.trim() });

    this.cerrarAclaracion();

  }

  // =========================================
  // ABRIR ARCHIVO ADJUNTO
  // =========================================

  abrirArchivo(nota: NotaCaso): void {

    if (!nota.archivoUrl) {
      return;
    }

    window.open(
      nota.archivoUrl,
      '_blank',
      'noopener,noreferrer'
    );

  }

}
