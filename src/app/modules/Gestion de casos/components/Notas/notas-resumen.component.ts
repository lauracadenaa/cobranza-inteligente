
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
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
export class NotasResumenComponent implements OnChanges {

  @Input() notas: NotaCaso[] = [];

  // =========================================
  // CATEGORÍAS
  // =========================================

  categorias: string[] = [
    'Seguimiento',
    'Contacto con el cliente',
    'Compromiso de pago',
    'Novedad',
    'Otra'
  ];

  categoriaSeleccionada = '';

  // =========================================
  // FILTROS
  // =========================================

  busquedaNota = '';

  categoriaFiltro = 'Todas';

  autorFiltro = 'Todos';

  fechaFiltro = '';

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

      // FILTRO POR FECHA
      const coincideFecha =
        !this.fechaFiltro ||
        this.convertirFecha(nota.fecha) === this.fechaFiltro;

      return (
        coincideBusqueda &&
        coincideCategoria &&
        coincideAutor &&
        coincideFecha
      );

    });

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

    const ahora = new Date();

    const fecha = ahora.toLocaleDateString('es-CO');

    const hora = ahora.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const nuevaNotaCaso: NotaCaso = {

      id: Date.now(),

      nombre: 'Nueva nota',

      fecha: fecha,

      hora: hora,

      rol: 'Agente',

      gestion: this.categoriaSeleccionada,

      notaInterna: contenido

    };

    // Agregar al listado
    this.notas = [
      ...this.notas,
      nuevaNotaCaso
    ];

    // Actualizar autores
    this.actualizarAutores();

    // Limpiar formulario
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

    this.notaSeleccionada.notaInterna +=
      '\nAclaración: ' + this.aclaracion.trim();

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
