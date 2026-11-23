import { Component, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, timer, switchMap, takeWhile, last } from 'rxjs';

import {
  ReportesAuditoriaService,
  TipoReporte,
  FormatoReporte
} from '../../../service/reportes-auditoria.service';

interface TarjetaReporte {
  tipo: TipoReporte;
  titulo: string;
  descripcion: string;
  icono: string;   // clase de Bootstrap Icons
  tono: string;    // color del cuadrito del ícono
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.css'
})
export class ReportesComponent implements OnDestroy {
  private readonly servicio = inject(ReportesAuditoriaService);
  private readonly cdr = inject(ChangeDetectorRef);

  // Los 7 reportes que existen en el backend
  readonly reportes: TarjetaReporte[] = [
    {
      tipo: 'AUDIT',
      titulo: 'Auditoria',
      descripcion: 'Trazabilidad completa de acciones, usuarios, fechas y cambios del sistema.',
      icono: 'bi-shield-check',
      tono: 'azul'
    },
    {
      tipo: 'RECOVERED_PORTFOLIO',
      titulo: 'Recuperación de cartera',
      descripcion: 'Consulta los valores recuperados, pagos confirmados y evolución de la recuperación durante el período seleccionado.',
      icono: 'bi-graph-up-arrow',
      tono: 'verde'
    },
    {
      tipo: 'UNRECOVERED_PORTFOLIO',
      titulo: 'Cartera pendiente de recuperación',
      descripcion: 'Analiza el saldo vencido pendiente según antigüedad de mora, nivel de riesgo, producto y segmento.',
      icono: 'bi-coin',
      tono: 'azul'
    },
    {
      tipo: 'PAYMENT_PROPENSITY',
      titulo: 'Propensión de Pago',
      descripcion: 'Consulta el score, la propensión estimada, el nivel de confianza y las recomendaciones generadas por el Motor IA.',
      icono: 'bi-fingerprint',
      tono: 'morado'
    },
    {
      tipo: 'ESCALATED_OVER_90',
      titulo: 'Casos con mora avanzada',
      descripcion: 'Consulta casos relacionados con obligaciones superiores a 90 días de mora y su estado actual de gestión.',
      icono: 'bi-calendar2-x',
      tono: 'naranja'
    },
    {
      tipo: 'CHANNEL_EFFECTIVENESS',
      titulo: 'Efectividad por Canal',
      descripcion: 'Compara contactos enviados, entregados, respondidos y convertidos por WhatsApp, SMS, email y voz.',
      icono: 'bi-chat-square',
      tono: 'turquesa'
    },
    {
      tipo: 'PAYMENT_RECONCILIATION',
      titulo: 'Conciliación de pagos',
      descripcion: 'Consulta pagos conciliados, pendientes y con diferencias, relacionados con sus obligaciones y transacciones.',
      icono: 'bi-bank',
      tono: 'turquesa'
    }
  ];

  // ===== Ventana "Generar reporte" =====
  reporteSeleccionado: TarjetaReporte | null = null;
  formato: FormatoReporte = 'EXCEL';
  desde = '';
  hasta = '';

  estado: 'formulario' | 'generando' | 'listo' | 'error' = 'formulario';
  mensajeError = '';
  private jobId = '';
  private nombreArchivo = '';
  private suscripcion?: Subscription;

  abrir(reporte: TarjetaReporte): void {
    const hoy = new Date();
    const haceUnMes = new Date();
    haceUnMes.setMonth(hoy.getMonth() - 1);

    this.reporteSeleccionado = reporte;
    this.formato = 'EXCEL';
    this.desde = this.aTextoFecha(haceUnMes);
    this.hasta = this.aTextoFecha(hoy);
    this.estado = 'formulario';
    this.mensajeError = '';
  }

  cerrar(): void {
    this.suscripcion?.unsubscribe();
    this.reporteSeleccionado = null;
  }

  get fechasValidas(): boolean {
    return !!this.desde && !!this.hasta && this.desde <= this.hasta;
  }

  generar(): void {
    if (!this.reporteSeleccionado || !this.fechasValidas) return;

    this.estado = 'generando';
    this.mensajeError = '';

    this.suscripcion?.unsubscribe();
    this.suscripcion = this.servicio
      .solicitarReporte(this.reporteSeleccionado.tipo, this.formato, this.desde, this.hasta)
      .pipe(
        // Pregunta cada 2 segundos hasta que deje de estar "en proceso"
        switchMap(aceptado =>
          timer(1000, 2000).pipe(
            switchMap(() => this.servicio.consultarEstado(aceptado.jobId)),
            takeWhile(e => e.status === 'PROCESSING', true),
            last()
          )
        )
      )
      .subscribe({
        next: resultado => {
          if (resultado.status === 'COMPLETED') {
            this.jobId = resultado.jobId;
            this.nombreArchivo = resultado.fileName || this.nombrePorDefecto();
            this.estado = 'listo';
            this.descargar();
          } else {
            this.estado = 'error';
            this.mensajeError = resultado.error || 'El reporte no se pudo generar.';
          }
          this.cdr.markForCheck();
        },
        error: err => {
          this.estado = 'error';
          this.mensajeError = err?.status === 503
            ? 'Hay muchos reportes en cola. Intenta de nuevo en unos minutos.'
            : 'No fue posible generar el reporte. Intenta nuevamente.';
          this.cdr.markForCheck();
        }
      });
  }

  descargar(): void {
    if (!this.jobId) return;

    this.servicio.descargarReporte(this.jobId).subscribe({
      next: archivo => {
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = this.nombreArchivo;
        enlace.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.estado = 'error';
        this.mensajeError = 'El reporte se generó, pero no se pudo descargar.';
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  private nombrePorDefecto(): string {
    const extension = this.formato === 'PDF' ? 'pdf' : 'xlsx';
    return `reporte-${this.reporteSeleccionado?.tipo.toLowerCase()}-${this.desde}_${this.hasta}.${extension}`;
  }

  private aTextoFecha(fecha: Date): string {
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${m}-${d}`;
  }
}
