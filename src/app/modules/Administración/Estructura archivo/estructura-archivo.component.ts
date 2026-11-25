import { Component } from '@angular/core';

import { descargarPlantillaCarga } from '../../../shared/plantilla-carga';

// ==================================================
// MODELOS
// ==================================================

interface PasoArchivo {
  numero: number;
  titulo: string;
  fila: string;
  descripcion: string;
}

interface CampoArchivo {
  posicion: string;
  nombre: string;
  tipo: string;
  obligatorio: boolean;
  descripcion: string;
}

// ==================================================
// ESTRUCTURA DEL ARCHIVO DE CARGA (solo lectura)
// Información fija: NO se consulta el backend.
// ==================================================

import { IconoComponent } from '../../../shared/icono/icono.component';

@Component({
  selector: 'app-estructura-archivo',
  standalone: true,
  imports: [IconoComponent],
  templateUrl: './estructura-archivo.component.html',
  styleUrl: './estructura-archivo.component.css'
})
export class EstructuraArchivoComponent {

  readonly pasos: PasoArchivo[] = [
    {
      numero: 1,
      titulo: 'Encabezado del lote',
      fila: 'Fila 1',
      descripcion: 'Incluye la fecha, el consecutivo, la cantidad de registros y el identificador del lote.'
    },
    {
      numero: 2,
      titulo: 'Valores del encabezado',
      fila: 'Fila 2',
      descripcion: 'Contiene los valores correspondientes al encabezado del lote.'
    },
    {
      numero: 3,
      titulo: 'Nombres de los campos',
      fila: 'Fila 3',
      descripcion: 'Define los nombres de las columnas de detalle.'
    },
    {
      numero: 4,
      titulo: 'Registros',
      fila: 'Desde la fila 4',
      descripcion: 'Incluye la información de los clientes y sus obligaciones.'
    }
  ];

  readonly campos: CampoArchivo[] = [
    { posicion: '001–020', nombre: 'document_type', tipo: 'Alfanumérico', obligatorio: true, descripcion: 'Tipo de documento (CC, NIT, CE)' },
    { posicion: '021–050', nombre: 'document_number', tipo: 'Alfanumérico', obligatorio: true, descripcion: 'Número de documento del cliente' },
    { posicion: '051–150', nombre: 'client_name', tipo: 'Alfanumérico', obligatorio: true, descripcion: 'Nombre completo del cliente' },
    { posicion: '151–200', nombre: 'obligation_id', tipo: 'Alfanumérico', obligatorio: true, descripcion: 'Número de obligación único' },
    { posicion: '201–220', nombre: 'obligation_amount', tipo: 'Decimal', obligatorio: true, descripcion: 'Valor total de la obligación' },
    { posicion: '221–230', nombre: 'due_date', tipo: 'Fecha', obligatorio: true, descripcion: 'Fecha de vencimiento (YYYY-MM-DD)' },
    { posicion: '231–234', nombre: 'days_past_due', tipo: 'Entero', obligatorio: true, descripcion: 'Días de mora al momento del cargue' },
    { posicion: '235–237', nombre: 'currency', tipo: 'Alfanumérico', obligatorio: false, descripcion: 'Moneda (default: COP)' },
    { posicion: '238–260', nombre: 'mobile', tipo: 'Alfanumérico', obligatorio: false, descripcion: 'Celular para contacto por WhatsApp/SMS' },
    { posicion: '261–340', nombre: 'email', tipo: 'Email', obligatorio: false, descripcion: 'Correo para notificaciones email' },
    { posicion: '341–350', nombre: 'affiliation_date', tipo: 'Fecha', obligatorio: false, descripcion: 'Fecha de vinculación del cliente (YYYY-MM-DD)' }
  ];

  // ==================================================
  // DESCARGAR PLANTILLA
  // Se arma el CSV aquí mismo, en el navegador.
  // ==================================================

  descargarPlantilla(): void {
    descargarPlantillaCarga();
  }

}
