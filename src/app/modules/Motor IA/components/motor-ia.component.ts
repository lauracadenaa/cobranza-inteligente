import { Component, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SidebarComponent } from '../../../components/sidedar/sidebar.component';
import { DashboardHeaderComponent } from '../../../components/dashboard-header/dashboard-header.component';

// ==================================================
// MOTOR IA Y SCORING
// Solo diseño (igual que en Figma). NO está conectado al backend:
// los datos son de ejemplo y los cambios solo viven en esta pantalla.
// (El servicio motor-ia.service.ts sigue existiendo para conectarlo después.)
// ==================================================

// Una fila de "Pesos de Variables de Scoring"
interface VariableScoring {
  id: number;
  nombre: string;
  peso: number; // en porcentaje (0 a 100)
  nueva?: boolean; // agregada ahora: se le puede escribir el nombre
}

// Una fila de "Umbrales de Riesgo"
interface UmbralRiesgo {
  nombre: string;
  minimo: number;
  maximo: number;
  color: string;
}

// Lo que guarda cada versión del modelo
interface ConfiguracionModelo {
  variables: VariableScoring[];
  umbrales: UmbralRiesgo[];
}

// Una fila de "Histórico de versiones"
interface VersionModelo {
  version: string;
  fecha: Date;
  creador: string;
  iniciales: string;
  activo: boolean;
  configuracion: ConfiguracionModelo;
}

// Datos de ejemplo (los mismos del Figma)
const VARIABLES_EJEMPLO: VariableScoring[] = [
  { id: 1, nombre: 'Historial de pago', peso: 35 },
  { id: 2, nombre: 'Días de mora', peso: 30 },
  { id: 3, nombre: 'Frecuencia de incumplimiento', peso: 20 },
  { id: 4, nombre: 'Antigüedad del cliente', peso: 15 }
];

const UMBRALES_EJEMPLO: UmbralRiesgo[] = [
  { nombre: 'Crítico', minimo: 0, maximo: 300, color: '#991B1B' },
  { nombre: 'Alto', minimo: 301, maximo: 500, color: '#F97316' },
  { nombre: 'Medio', minimo: 501, maximo: 700, color: '#F59E0B' },
  { nombre: 'Bajo', minimo: 701, maximo: 1000, color: '#10B981' }
];

import { IconoComponent } from '../../../shared/icono/icono.component';

@Component({
  selector: 'app-motor-ia',
  standalone: true,
  imports: [IconoComponent, 
    CommonModule,
    FormsModule,
    SidebarComponent,
    DashboardHeaderComponent
  ],
  templateUrl: './motor-ia.component.html',
  styleUrl: './motor-ia.component.css'
})
export class MotorIaComponent implements OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  nombreModelo = 'LightGBM';

  versiones: VersionModelo[] = [
    this.crearVersion('v2.4.1', new Date(2026, 8, 15, 14, 32), true),
    this.crearVersion('v2.4.0', new Date(2026, 8, 15, 10, 5), false),
    this.crearVersion('v2.3.9', new Date(2026, 8, 15, 8, 40), false)
  ];

  // Lo que se está editando en pantalla (copia de la versión activa)
  variables: VariableScoring[] = [];
  umbrales: UmbralRiesgo[] = [];

  readonly campos: ('minimo' | 'maximo')[] = ['minimo', 'maximo'];

  private siguienteId = 100;

  porId(_: number, variable: VariableScoring): number {
    return variable.id;
  }

  // Ventanas de confirmación
  mostrarConfirmacion = false;
  versionARestaurar: VersionModelo | null = null;

  aviso: { texto: string; tipo: 'exito' | 'error' | 'info' } | null = null;
  private temporizadorAviso?: ReturnType<typeof setTimeout>;

  constructor() {
    this.cargarEnPantalla(this.versionActiva);
  }

  // ==================================================
  // ESTADO DE LA PANTALLA
  // ==================================================

  get versionActiva(): VersionModelo {
    return this.versiones.find(v => v.activo) ?? this.versiones[0];
  }

  get hayCambios(): boolean {
    return this.foto(this.variables, this.umbrales) !==
      this.foto(this.versionActiva.configuracion.variables, this.versionActiva.configuracion.umbrales);
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

  get nombresValidos(): boolean {
    return this.variables.every(v => v.nombre.trim().length > 0);
  }

  get puedeGuardar(): boolean {
    return this.hayCambios && this.pesosCalibrados && this.umbralesValidos && this.nombresValidos;
  }

  get motivoNoGuardar(): string {
    if (!this.hayCambios) return 'No hay cambios para guardar';
    if (!this.pesosCalibrados) return 'Los pesos deben sumar 100 %';
    if (!this.umbralesValidos) return 'El score mínimo no puede ser mayor que el máximo';
    if (!this.nombresValidos) return 'Todas las variables deben tener nombre';
    return '';
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
    this.variables = this.variables.filter(v => v !== variable);
  }

  agregarVariable(): void {
    this.variables = [...this.variables, { id: this.siguienteId++, nombre: '', peso: 0, nueva: true }];
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
  // GUARDAR: crea una versión nueva y la deja activa
  // ==================================================

  pedirConfirmacion(): void {
    if (this.puedeGuardar) this.mostrarConfirmacion = true;
  }

  cancelarGuardado(): void {
    this.mostrarConfirmacion = false;
  }

  get siguienteVersion(): string {
    const [mayor, menor, parche] = this.versiones[0].version.replace('v', '').split('.').map(Number);
    return `v${mayor}.${menor}.${parche + 1}`;
  }

  confirmarGuardado(): void {
    const nueva: VersionModelo = {
      version: this.siguienteVersion,
      fecha: new Date(),
      creador: 'Tú',
      iniciales: 'TÚ',
      activo: true,
      configuracion: this.copiar({ variables: this.variables, umbrales: this.umbrales })
    };

    this.versiones.forEach(v => (v.activo = false));
    this.versiones = [nueva, ...this.versiones];
    this.cargarEnPantalla(nueva);
    this.mostrarConfirmacion = false;
    this.mostrarAviso(`Se creó la versión ${nueva.version} (vista previa, no se envía al servidor).`, 'exito');
  }

  // ==================================================
  // ROLLBACK: volver a una versión anterior
  // ==================================================

  pedirRollback(version: VersionModelo): void {
    this.versionARestaurar = version;
  }

  cancelarRollback(): void {
    this.versionARestaurar = null;
  }

  confirmarRollback(): void {
    const version = this.versionARestaurar;
    if (!version) return;

    this.versiones.forEach(v => (v.activo = v === version));
    this.cargarEnPantalla(version);
    this.versionARestaurar = null;
    this.mostrarAviso(`La versión ${version.version} quedó activa (vista previa).`, 'info');
  }

  // ==================================================
  // UTILIDADES
  // ==================================================

  private crearVersion(version: string, fecha: Date, activo: boolean): VersionModelo {
    return {
      version,
      fecha,
      creador: 'LuisR.',
      iniciales: 'AZ',
      activo,
      configuracion: this.copiar({ variables: VARIABLES_EJEMPLO, umbrales: UMBRALES_EJEMPLO })
    };
  }

  private cargarEnPantalla(version: VersionModelo): void {
    const copia = this.copiar(version.configuracion);
    this.variables = copia.variables;
    this.umbrales = copia.umbrales;
  }

  private copiar(c: ConfiguracionModelo): ConfiguracionModelo {
    return {
      variables: c.variables.map(({ id, nombre, peso }) => ({ id, nombre: nombre.trim(), peso })),
      umbrales: c.umbrales.map(u => ({ ...u }))
    };
  }

  private foto(variables: VariableScoring[], umbrales: UmbralRiesgo[]): string {
    return JSON.stringify({
      v: variables.map(({ id, nombre, peso }) => ({ id, nombre: nombre.trim(), peso })),
      u: umbrales
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

  ngOnDestroy(): void {
    clearTimeout(this.temporizadorAviso);
  }
}
