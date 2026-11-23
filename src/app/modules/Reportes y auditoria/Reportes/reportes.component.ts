import { Component, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild, inject } from '@angular/core';
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
  formato: FormatoReporte | null = null;
  desde = '';
  hasta = '';

  estado: 'formulario' | 'generando' | 'listo' | 'error' = 'formulario';
  mensajeError = '';
  private jobId = '';
  private nombreArchivo = '';
  private suscripcion?: Subscription;

  abrir(reporte: TarjetaReporte): void {
    this.reporteSeleccionado = reporte;
    // Como en Figma: empieza vacío y el botón se habilita al elegir fechas y formato
    this.formato = null;
    this.desde = '';
    this.hasta = '';
    this.estado = 'formulario';
    this.mensajeError = '';
  }

  cerrar(): void {
    this.suscripcion?.unsubscribe();
    this.reporteSeleccionado = null;
    this.calendarioAbierto = false;
  }

  // ==================================================
  // CALENDARIO DE RANGO (diseño Figma)
  // Primer clic = Desde, segundo clic = Hasta.
  // ==================================================

  readonly diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  calendarioAbierto = false;
  hoyTexto = '';
  mesesCalendario: { clave: string; titulo: string; dias: ({ fecha: string; numero: number } | null)[] }[] = [];

  @ViewChild('calendario') private calendarioRef?: ElementRef<HTMLElement>;

  alternarCalendario(): void {
    this.calendarioAbierto = !this.calendarioAbierto;
    if (!this.calendarioAbierto) return;

    this.hoyTexto = this.aTextoFecha(new Date());
    this.mesesCalendario = this.construirMeses(13);

    // Lleva la vista al mes de la fecha "Desde" (o al mes actual)
    setTimeout(() => {
      const clave = (this.desde || this.hoyTexto).substring(0, 7);
      const caja = this.calendarioRef?.nativeElement;
      const mes = caja?.querySelector<HTMLElement>(`[data-mes="${clave}"]`);
      if (caja && mes) caja.scrollTop = mes.offsetTop;
    });
  }

  elegirDia(fecha: string): void {
    if (fecha > this.hoyTexto) return;

    // Empieza un rango nuevo
    if (!this.desde || this.hasta) {
      this.desde = fecha;
      this.hasta = '';
      return;
    }

    // Segundo clic: si es anterior, se invierten
    if (fecha < this.desde) {
      this.hasta = this.desde;
      this.desde = fecha;
    } else {
      this.hasta = fecha;
    }
    this.calendarioAbierto = false;
  }

  enRango(fecha: string): boolean {
    return !!this.desde && !!this.hasta && fecha > this.desde && fecha < this.hasta;
  }

  textoFecha(fecha: string): string {
    if (!fecha) return 'DD/MM/AAAA';
    const [a, m, d] = fecha.split('-');
    return `${d}/${m}/${a}`;
  }

  private construirMeses(cantidad: number) {
    const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
      'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const hoy = new Date();
    const meses = [];

    for (let i = cantidad - 1; i >= 0; i--) {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const totalDias = new Date(primero.getFullYear(), primero.getMonth() + 1, 0).getDate();
      const huecos = (primero.getDay() + 6) % 7; // la semana empieza en lunes

      const dias: ({ fecha: string; numero: number } | null)[] = Array(huecos).fill(null);
      for (let d = 1; d <= totalDias; d++) {
        dias.push({ fecha: this.aTextoFecha(new Date(primero.getFullYear(), primero.getMonth(), d)), numero: d });
      }

      meses.push({
        clave: this.aTextoFecha(primero).substring(0, 7),
        titulo: `${nombres[primero.getMonth()]} ${primero.getFullYear()}`,
        dias
      });
    }
    return meses;
  }

  get fechasValidas(): boolean {
    return !!this.desde && !!this.hasta && this.desde <= this.hasta;
  }

  generar(): void {
    if (!this.reporteSeleccionado || !this.fechasValidas || !this.formato) return;

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
