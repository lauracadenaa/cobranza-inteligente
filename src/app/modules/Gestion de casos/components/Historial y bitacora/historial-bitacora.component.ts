
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface EventoBitacora {
  id: number;
  fecha: string;
  fechaOrden: string;
  tipo: string;
  titulo: string;
  responsable: string;
  resultado: string;
  descripcion: string;
  canal: string;
  observacion: string;
}

@Component({
  selector: 'app-historial-bitacora',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historial-bitacora.component.html',
  styleUrl: './historial-bitacora.component.css'
})
export class HistorialBitacoraComponent {

  eventos: EventoBitacora[] = [
    {
      id: 1,
      fecha: 'Hoy · 09:15 a. m.',
      fechaOrden: '2026-11-10T09:15:00',
      tipo: 'Llamada',
      titulo: 'Llamada realizada',
      responsable: 'Ana Martínez',
      resultado: 'Contacto efectivo',
      descripcion: 'Se estableció comunicación con el asociado.',
      canal: 'Telefónico',
      observacion: 'El asociado manifestó interés en revisar alternativas de pago.'
    },
    {
      id: 2,
      fecha: 'Ayer · 06:22 p. m.',
      fechaOrden: '2026-11-09T18:22:00',
      tipo: 'WhatsApp',
      titulo: 'WhatsApp enviado',
      responsable: 'Ana Martínez',
      resultado: 'Sin respuesta',
      descripcion: 'Se envió un mensaje de seguimiento al asociado.',
      canal: 'WhatsApp',
      observacion: 'No se recibió respuesta al mensaje enviado.'
    },
    {
      id: 3,
      fecha: 'Ayer · 11:10 a. m.',
      fechaOrden: '2026-11-09T11:10:00',
      tipo: 'SMS',
      titulo: 'SMS enviado',
      responsable: 'Ana Martínez',
      resultado: 'Sin respuesta',
      descripcion: 'Se envió una notificación de pago pendiente.',
      canal: 'SMS',
      observacion: 'Mensaje enviado correctamente.'
    },
    {
      id: 4,
      fecha: '08/11/2026 · 03:30 p. m.',
      fechaOrden: '2026-11-08T15:30:00',
      tipo: 'Estado',
      titulo: 'Cambio de estado del caso',
      responsable: 'Sistema',
      resultado: 'En gestión',
      descripcion: 'El caso pasó al estado de gestión activa.',
      canal: 'Sistema',
      observacion: 'Cambio realizado automáticamente por las reglas de asignación.'
    },
    {
      id: 5,
      fecha: '07/11/2026 · 10:00 a. m.',
      fechaOrden: '2026-11-07T10:00:00',
      tipo: 'Asignación',
      titulo: 'Caso asignado',
      responsable: 'Sistema',
      resultado: 'Asignación exitosa',
      descripcion: 'El caso fue asignado al asesor responsable.',
      canal: 'Sistema',
      observacion: 'Asignación inicial del caso.'
    }
  ];

  eventoSeleccionadoId = 1;

  get eventosOrdenados(): EventoBitacora[] {
    return [...this.eventos].sort(
      (a, b) =>
        new Date(b.fechaOrden).getTime() -
        new Date(a.fechaOrden).getTime()
    );
  }

  get eventoSeleccionado(): EventoBitacora | undefined {
    return this.eventosOrdenados.find(
      evento => evento.id === this.eventoSeleccionadoId
    );
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

  seleccionarEvento(evento: EventoBitacora): void {
    this.eventoSeleccionadoId = evento.id;
  }
}
