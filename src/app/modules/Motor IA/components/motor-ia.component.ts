import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { SidebarComponent } from '../../../components/sidedar/sidebar.component';
import { DashboardHeaderComponent } from '../../../components/dashboard-header/dashboard-header.component';
import {
  MotorIaService,
  ModeloScoring,
  PesosModelo,
  UmbralBackend
} from '../../../service/motor-ia.service';

// Una fila de "Pesos de Variables de Scoring"
interface VariableScoring {
  clave: keyof PesosModelo;
  nombre: string;
  peso: number; // en porcentaje (0 a 100)
}

// Una fila de "Umbrales de Riesgo"
interface UmbralRiesgo {
  nivel: string; // CRITICO, ALTO, MEDIO, BAJO
  nombre: string;
  minimo: number;
  maximo: number;
  color: string;
}

// Una fila de "Histórico de versiones"
interface VersionModelo {
  version: string;
  fecha: string | null;
  creador: string;
  activo: boolean;
}

// Nombres y colores de cada nivel de riesgo
const NIVELES: Record<string, { nombre: string; color: string; orden: number }> = {
  CRITICO: { nombre: 'Crítico', color: '#991B1B', orden: 0 },
  ALTO: { nombre: 'Alto', color: '#F97316', orden: 1 },
  MEDIO: { nombre: 'Medio', color: '#F59E0B', orden: 2 },
  BAJO: { nombre: 'Bajo', color: '#10B981', orden: 3 }
};

// Las 4 variables que maneja el backend
const VARIABLES: { clave: keyof PesosModelo; nombre: string }[] = [
  { clave: 'weightPaymentHistory', nombre: 'Historial de pago' },
  { clave: 'weightDaysPastDue', nombre: 'Días de mora' },
  { clave: 'weightDefaultFrequency', nombre: 'Frecuencia de incumplimiento' },
  { clave: 'weightSeniority', nombre: 'Antigüedad del cliente' }
];

@Component({
  selector: 'app-motor-ia',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent,
    DashboardHeaderComponent
  ],
  templateUrl: './motor-ia.component.html',
  styleUrl: './motor-ia.component.css'
})
export class MotorIaComponent implements OnInit {
  private readonly motorIaService = inject(MotorIaService);
  private readonly cdr = inject(ChangeDetectorRef);

  nombreModelo = 'LightGBM';
  modelo: ModeloScoring | null = null;

  variables: VariableScoring[] = [];
  umbrales: UmbralRiesgo[] = [];
  versiones: VersionModelo[] = [];

  cargando = true;
  errorCarga = '';

  // Copia de lo que vino del backend, para saber si hay cambios
  private copiaOriginal = '';

  mostrarConfirmacion = false;
  guardando = false;
  aviso: { texto: string; tipo: 'exito' | 'error' | 'info' } | null = null;
  private temporizadorAviso?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.cargarConfiguracion();
  }

  // ==================================================
  // CARGA DE DATOS REALES
  // ==================================================

  cargarConfiguracion(): void {
    this.cargando = true;
    this.errorCarga = '';

    this.motorIaService.obtenerModeloActivo().subscribe({
      next: modelo => {
        this.modelo = modelo;
        this.variables = VARIABLES.map(v => ({
          ...v,
          peso: Math.round((Number(modelo[v.clave]) || 0) * 100)
        }));
        this.versiones = [{
          version: modelo.modelVersion,
          fecha: modelo.updatedAt || modelo.createdAt || null,
          creador: 'Sistema',
          activo: true
        }];

        this.motorIaService.obtenerUmbrales(modelo.modelVersion).subscribe({
          next: umbrales => {
            this.umbrales = this.convertirUmbrales(umbrales);
            this.terminarCarga();
          },
          error: () => {
            this.umbrales = [];
            this.errorCarga = 'No fue posible cargar los umbrales de riesgo.';
            this.terminarCarga();
          }
        });
      },
      error: () => {
        this.errorCarga = 'No fue posible cargar la configuración del modelo.';
        this.terminarCarga();
      }
    });
  }

  private terminarCarga(): void {
    this.cargando = false;
    this.copiaOriginal = this.fotoActual();
    this.cdr.markForCheck();
  }

  private convertirUmbrales(lista: UmbralBackend[]): UmbralRiesgo[] {
    return lista
      .map(u => {
        const nivel = (u.riskLevel || '').toUpperCase();
        const info = NIVELES[nivel] ?? { nombre: u.riskLevel, color: '#94A3B8', orden: 9 };
        return {
          nivel,
          nombre: info.nombre,
          minimo: u.minScore,
          maximo: u.maxScore,
          color: info.color,
          orden: info.orden
        };
      })
      .sort((a, b) => a.orden - b.orden)
      .map(({ orden, ...u }) => u);
  }

  private fotoActual(): string {
    return JSON.stringify({ v: this.variables, u: this.umbrales });
  }

  // ==================================================
  // ESTADO DE LA PANTALLA
  // ==================================================

  get hayCambios(): boolean {
    return !this.cargando && this.fotoActual() !== this.copiaOriginal;
  }

  get totalPesos(): number {
    return this.variables.reduce((suma, v) => suma + (Number(v.peso) || 0), 0);
  }

  get pesosCalibrados(): boolean {
    return this.totalPesos === 100;
  }

  get umbralesValidos(): boolean {
    return this.umbrales.every(u => u.minimo <= u.maximo);
  }

  get puedeGuardar(): boolean {
    return this.hayCambios && this.pesosCalibrados && this.umbralesValidos && !this.guardando;
  }

  // ==================================================
  // PESOS
  // ==================================================

  ajustarPeso(variable: VariableScoring, valor: number | string): void {
    let numero = Math.round(Number(valor));
    if (!Number.isFinite(numero)) numero = 0;
    variable.peso = Math.min(100, Math.max(0, numero));
  }

  quitarVariable(variable: VariableScoring): void {
    // El backend siempre usa estas 4 variables: "quitar" deja su peso en 0
    variable.peso = 0;
    this.mostrarAviso(`"${variable.nombre}" quedó en 0 %. El modelo siempre usa estas 4 variables.`, 'info');
  }

  agregarVariable(): void {
    this.mostrarAviso('Por ahora el modelo solo admite estas 4 variables.', 'info');
  }

  // ==================================================
  // UMBRALES
  // ==================================================

  cambiarUmbral(umbral: UmbralRiesgo, campo: 'minimo' | 'maximo', cambio: number): void {
    this.fijarUmbral(umbral, campo, umbral[campo] + cambio);
  }

  fijarUmbral(umbral: UmbralRiesgo, campo: 'minimo' | 'maximo', valor: number | string): void {
    let numero = Math.round(Number(valor));
    if (!Number.isFinite(numero)) numero = 0;
    umbral[campo] = Math.min(1000, Math.max(0, numero));
  }

  // ==================================================
  // GUARDAR (con confirmación antes de tocar el backend)
  // ==================================================

  pedirConfirmacion(): void {
    if (this.puedeGuardar) {
      this.mostrarConfirmacion = true;
    }
  }

  cancelarGuardado(): void {
    this.mostrarConfirmacion = false;
  }

  confirmarGuardado(): void {
    if (!this.modelo || !this.puedeGuardar) return;

    this.guardando = true;
    const version = this.modelo.modelVersion;

    const pesos = Object.fromEntries(
      this.variables.map(v => [v.clave, v.peso / 100])
    ) as unknown as PesosModelo;

    const umbrales: UmbralBackend[] = this.umbrales.map(u => ({
      riskLevel: u.nivel,
      minScore: u.minimo,
      maxScore: u.maximo
    }));

    forkJoin([
      this.motorIaService.guardarPesos(pesos),
      this.motorIaService.guardarUmbrales(version, umbrales)
    ]).subscribe({
      next: ([modelo]) => {
        this.modelo = modelo;
        this.guardando = false;
        this.mostrarConfirmacion = false;
        this.copiaOriginal = this.fotoActual();
        this.mostrarAviso('Cambios guardados correctamente.', 'exito');
      },
      error: () => {
        this.guardando = false;
        this.mostrarConfirmacion = false;
        this.mostrarAviso('No fue posible guardar los cambios. Intenta nuevamente.', 'error');
      }
    });
  }

  private mostrarAviso(texto: string, tipo: 'exito' | 'error' | 'info'): void {
    this.aviso = { texto, tipo };
    clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => {
      this.aviso = null;
      this.cdr.markForCheck();
    }, 4000);
    this.cdr.markForCheck();
  }
}
