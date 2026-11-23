
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface EventoBitacora {
  id: string | number;
  fecha: string;
  fechaOrden: string | number;
  tipo: string;
  titulo: string;
  responsable: string;
  resultado: string;
  descripcion: string;
  canal: string;
  observacion: string;
  // Quién generó el evento (para el resumen de la bitácora)
  origen: 'Sistema' | 'Motor IA' | 'Agente';
}

@Component({
  selector: 'app-historial-bitacora',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historial-bitacora.component.html',
  styleUrl: './historial-bitacora.component.css'
})
export class HistorialBitacoraComponent {

  // Eventos reales del caso (los arma el caso abierto con datos del backend)
  @Input() eventos: EventoBitacora[] = [];

  // Mientras se consultan los datos
  @Input() cargando = false;

  get eventosOrdenados(): EventoBitacora[] {
    return [...this.eventos].sort(
      (a, b) =>
        new Date(b.fechaOrden).getTime() -
        new Date(a.fechaOrden).getTime() || 0
    );
  }

  // Los eventos solo se ven (no se seleccionan):
  // el detalle muestra siempre el evento más reciente.
  get eventoSeleccionado(): EventoBitacora | undefined {
    return this.eventosOrdenados[0];
  }

  // Cuadritos del "Resumen de la bitácora" (como en Figma)
  get resumenPorOrigen(): { texto: string; valor: number; tono: string }[] {
    const contar = (origen: EventoBitacora['origen']) =>
      this.eventos.filter(e => e.origen === origen).length;

    return [
      { texto: 'Total eventos', valor: this.totalEventos, tono: 'verde' },
      { texto: 'Motor IA', valor: contar('Motor IA'), tono: 'morado' },
      { texto: 'Agente', valor: contar('Agente'), tono: 'azul' },
      { texto: 'Sistema', valor: contar('Sistema'), tono: 'gris' }
    ];
  }

  get totalEventos(): number {
    return this.eventos.length;
  }

  get contactosEfectivos(): number {
    return this.eventos.filter(
      evento => evento.resultado === 'Contacto efectivo'
    ).length;
  }

  get ultimaActividad(): string {
    return this.eventosOrdenados[0]?.fecha || 'Sin actividad';
  }
}
