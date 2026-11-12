
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardService } from '../../../../service/dashboard.service';

interface GraficoDato {
  nombre: string;
  valor: number;
  obligaciones: number;
  porcentaje: number;
  color: string;
}

interface AntiguedadDato {
  rango: string;
  valor: number;
  obligaciones: number;
  porcentaje: number;
}

@Component({
  selector: 'app-cartera-graficos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cartera-graficos.component.html',
  styleUrl: './cartera-graficos.component.css'
})
export class CarteraGraficosComponent implements OnInit {

  constructor(private dashboardService: DashboardService) {}

  cargando = true;
  errorCarga = false;

  // ==========================================
  // DISTRIBUCIÓN POR SEGMENTO
  // ==========================================

  segmentos: GraficoDato[] = [];

  totalSegmentos = 0;
  totalObligacionesSegmentos = 0;

  gradienteSegmentos =
    'conic-gradient(#E2E8F0 0% 100%)';

  // ==========================================
  // CARTERA POR NIVEL DE RIESGO
  // ==========================================

  riesgos: GraficoDato[] = [];

  totalRiesgos = 0;
  totalObligacionesRiesgos = 0;

  gradienteRiesgos =
    'conic-gradient(#E2E8F0 0% 100%)';

  // ==========================================
  // ANTIGÜEDAD DE MORA
  // ==========================================

  antiguedades: AntiguedadDato[] = [];

  totalAntiguedad = 0;

  // ==========================================
  // INICIAR CONSULTAS
  // ==========================================

  ngOnInit(): void {
    this.cargarSegmentos();
    this.cargarRiesgos();
    this.cargarAntiguedad();
  }

  // ==========================================
  // CONSULTAR SEGMENTOS
  // ==========================================

  cargarSegmentos(): void {

    this.dashboardService.getSegmentData().subscribe({

      next: datos => {

        const preventiva = datos.find(d =>
          this.normalizar(d.rangoMora) === 'PREVENTIVA'
        );

        const administrativa = datos.find(d =>
          this.normalizar(d.rangoMora) === 'ADMINISTRATIVA'
        );

        const prejudicial = datos.find(d =>
          this.normalizar(d.rangoMora) === 'PREJUDICIAL'
        );

        const juridica = datos.find(d =>
          this.normalizar(d.rangoMora) === 'JURIDICA'
        );

        // ==========================================
        // SOLO TRES SEGMENTOS
        // ==========================================
        // Preventiva
        // Administrativa
        // Prejurídica
        //
        // El backend entrega Prejudicial y Jurídica
        // por separado. Ambos se agrupan en Prejurídica.

        this.segmentos = [

          {
            nombre: 'Preventiva',
            valor: Number(preventiva?.valor ?? 0),
            obligaciones: Number(preventiva?.obligaciones ?? 0),
            porcentaje: 0,
            color: '#0075FF'
          },

          {
            nombre: 'Administrativa',
            valor: Number(administrativa?.valor ?? 0),
            obligaciones: Number(administrativa?.obligaciones ?? 0),
            porcentaje: 0,
            color: '#22C55E'
          },

          {
            nombre: 'Prejurídica',
            valor:
              Number(prejudicial?.valor ?? 0) +
              Number(juridica?.valor ?? 0),
            obligaciones:
              Number(prejudicial?.obligaciones ?? 0) +
              Number(juridica?.obligaciones ?? 0),
            porcentaje: 0,
            color: '#F97316'
          }

        ];

        // ==========================================
        // CALCULAR TOTALES
        // ==========================================

        this.totalSegmentos = this.segmentos.reduce(
          (total, item) => total + item.valor,
          0
        );

        this.totalObligacionesSegmentos = this.segmentos.reduce(
          (total, item) => total + item.obligaciones,
          0
        );

        // ==========================================
        // CALCULAR PORCENTAJES
        // ==========================================

        this.segmentos.forEach(item => {

          item.porcentaje = this.calcularPorcentaje(
            item.valor,
            this.totalSegmentos
          );

        });

        // ==========================================
        // CREAR GRADIENTE
        // ==========================================

        this.gradienteSegmentos = this.crearGradiente(
          this.segmentos
        );

        // ==========================================
        // CONSOLA
        // ==========================================

        console.log(
          'CARTERA - TRES SEGMENTOS:',
          this.segmentos
        );

        console.log(
          'CARTERA - TOTAL SEGMENTOS:',
          this.totalSegmentos
        );

        console.log(
          'CARTERA - GRADIENTE SEGMENTOS:',
          this.gradienteSegmentos
        );

        this.finalizarCarga();

      },

      error: error => {

        console.error(
          'Error consultando segmentos:',
          error
        );

        this.errorCarga = true;
        this.finalizarCarga();

      }

    });

  }

  // ==========================================
  // CONSULTAR RIESGOS
  // ==========================================

  cargarRiesgos(): void {

    this.dashboardService.getRiskData().subscribe({

      next: datos => {

        const colores: Record<string, string> = {
          BAJO: '#18A999',
          MEDIO: '#EAB308',
          ALTO: '#F97316',
          CRITICO: '#DC3545'
        };

        this.riesgos = datos.map(item => {

          const nombre = item.rangoMora;

          return {
            nombre,
            valor: Number(item.valor ?? 0),
            obligaciones: Number(item.obligaciones ?? 0),
            porcentaje: 0,
            color:
              colores[this.normalizar(nombre)] ?? '#94A3B8'
          };

        });

        // ==========================================
        // TOTALES
        // ==========================================

        this.totalRiesgos = this.riesgos.reduce(
          (total, item) => total + item.valor,
          0
        );

        this.totalObligacionesRiesgos = this.riesgos.reduce(
          (total, item) => total + item.obligaciones,
          0
        );

        // ==========================================
        // PORCENTAJES
        // ==========================================

        this.riesgos.forEach(item => {

          item.porcentaje = this.calcularPorcentaje(
            item.valor,
            this.totalRiesgos
          );

        });

        // ==========================================
        // GRADIENTE
        // ==========================================

        this.gradienteRiesgos = this.crearGradiente(
          this.riesgos
        );

        // ==========================================
        // CONSOLA
        // ==========================================

        console.log(
          'CARTERA - RIESGOS:',
          this.riesgos
        );

        console.log(
          'CARTERA - TOTAL RIESGOS:',
          this.totalRiesgos
        );

        console.log(
          'CARTERA - GRADIENTE RIESGOS:',
          this.gradienteRiesgos
        );

        this.finalizarCarga();

      },

      error: error => {

        console.error(
          'Error consultando riesgos:',
          error
        );

        this.errorCarga = true;
        this.finalizarCarga();

      }

    });

  }

  // ==========================================
  // CONSULTAR ANTIGÜEDAD
  // ==========================================

  cargarAntiguedad(): void {

    this.dashboardService.getAgingData().subscribe({

      next: datos => {

        this.antiguedades = datos.map(item => ({
          rango: item.rangoMora,
          valor: Number(item.valor ?? 0),
          obligaciones: Number(item.obligaciones ?? 0),
          porcentaje: 0
        }));

        // ==========================================
        // TOTAL
        // ==========================================

        this.totalAntiguedad = this.antiguedades.reduce(
          (total, item) => total + item.valor,
          0
        );

        // ==========================================
        // PORCENTAJES
        // ==========================================

        this.antiguedades.forEach(item => {

          item.porcentaje = this.calcularPorcentaje(
            item.valor,
            this.totalAntiguedad
          );

        });

        // ==========================================
        // CONSOLA
        // ==========================================

        console.log(
          'CARTERA - ANTIGÜEDAD:',
          this.antiguedades
        );

        console.log(
          'CARTERA - TOTAL ANTIGÜEDAD:',
          this.totalAntiguedad
        );

        this.finalizarCarga();

      },

      error: error => {

        console.error(
          'Error consultando antigüedad:',
          error
        );

        this.errorCarga = true;
        this.finalizarCarga();

      }

    });

  }

  // ==========================================
  // CALCULAR PORCENTAJES
  // ==========================================

  private calcularPorcentaje(
    valor: number,
    total: number
  ): number {

    if (!total || total <= 0) {
      return 0;
    }

    return Number(
      ((valor / total) * 100).toFixed(1)
    );

  }

  // ==========================================
  // CREAR GRADIENTE DE DONA
  // ==========================================

  private crearGradiente(
    datos: GraficoDato[]
  ): string {

    const total = datos.reduce(
      (suma, item) => suma + item.valor,
      0
    );

    if (total <= 0) {
      return 'conic-gradient(#E2E8F0 0% 100%)';
    }

    let acumulado = 0;

    const porciones = datos
      .filter(item => item.valor > 0)
      .map(item => {

        const inicio = acumulado;

        acumulado += (item.valor / total) * 100;

        return `${item.color} ${inicio}% ${acumulado}%`;

      });

    return `conic-gradient(${porciones.join(', ')})`;

  }

  // ==========================================
  // FORMATEAR SALDOS
  // ==========================================

  formatearSaldo(valor: number): string {

    if (valor >= 1000000) {
      return `$${(valor / 1000000).toFixed(1)}M`;
    }

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(valor);

  }

  // ==========================================
  // NORMALIZAR TEXTOS
  // ==========================================

  private normalizar(valor: string): string {

    return (valor ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

  }

  // ==========================================
  // ESTADO DE CARGA
  // ==========================================

  private consultasTerminadas = 0;

  private finalizarCarga(): void {

    this.consultasTerminadas++;

    if (this.consultasTerminadas >= 3) {
      this.cargando = false;
    }

  }

}
