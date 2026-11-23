import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  CargaAsesorBackend,
  CargasAdminService,
  CasoEnColaBackend
} from '../../../service/cargas-admin.service';

// ==================================================
// DISTRIBUCIÓN DE CARGAS
// Conectado al backend:
//   - Indicadores y capacidad general: GET /admin/advisors/workload
//   - Cola temporal: GET /admin/advisors/overflow-queue
//   - "Redistribuir casos ahora": POST /admin/advisors/rebalance
// Vista previa (el backend todavía no guarda estas reglas):
//   - Método de asignación, umbral de saturación y redistribución automática
// ==================================================

type Metodo = 'menor-ocupacion' | 'rotativo' | 'especialidad';

interface Kpi {
  titulo: string;
  valor: number | string;
  detalle: string;
  icono: string;
  tono: string;
}

@Component({
  selector: 'app-distribucion-cargas',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './distribucion-cargas.component.html',
  styleUrls: ['../admin-comun.css', './distribucion-cargas.component.css']
})
export class DistribucionCargasComponent implements OnInit, OnDestroy {

  private servicio = inject(CargasAdminService);
  private router = inject(Router);

  // Esta versión de Angular no redibuja sola cuando llega una respuesta del backend
  private cdr = inject(ChangeDetectorRef);

  kpis: Kpi[] = this.armarKpis(null, []);

  readonly metodos: { valor: Metodo; texto: string; ayuda: string }[] = [
    {
      valor: 'menor-ocupacion',
      texto: 'Menor ocupación',
      ayuda: 'Asigna cada caso al agente elegible con el menor porcentaje de ocupación'
    },
    {
      valor: 'rotativo',
      texto: 'Turno rotativo',
      ayuda: 'Reparte los casos por turnos entre los agentes elegibles, uno a uno'
    },
    {
      valor: 'especialidad',
      texto: 'Por especialidad',
      ayuda: 'Prioriza agentes con la cola habilitada que requiere el caso'
    }
  ];

  readonly estadosOcupacion = [
    { nombre: 'Disponible', rango: 'Menos del 70 %', color: '#10B981', ancho: 70 },
    { nombre: 'Carga media', rango: '70–84 %', color: '#F59E0B', ancho: 82 },
    { nombre: 'Próximo a capacidad', rango: '85–99 %', color: '#F97316', ancho: 100 },
    { nombre: 'Sin capacidad', rango: '100 % o más', color: '#EF4444', ancho: 100 }
  ];

  // Valores del formulario (vista previa)
  metodo: Metodo = 'menor-ocupacion';
  umbralSaturacion = 85;
  capacidadForm: number | null = null;   // arranca con la capacidad que tiene el servidor
  capacidadEditada = false;
  redistribuir = true;

  // Datos del backend
  capacidadGeneral: number | null = null;
  cola: CasoEnColaBackend[] = [];
  totalCola = 0;
  cargando = true;
  errorCarga = '';
  redistribuyendo = false;
  confirmarRedistribucion = false;

  mensaje = '';
  private temporizador?: ReturnType<typeof setTimeout>;

  get ayudaMetodo(): string {
    return this.metodos.find(m => m.valor === this.metodo)?.ayuda ?? '';
  }

  get capacidadValida(): boolean {
    const c = this.capacidadForm;
    return c === null || (Number.isInteger(c) && c >= 1);
  }

  get umbralValido(): boolean {
    return Number.isFinite(this.umbralSaturacion) && this.umbralSaturacion >= 1 && this.umbralSaturacion <= 100;
  }

  // ==================================================
  // CARGAR
  // ==================================================

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = '';

    forkJoin({
      cargas: this.servicio.listarCargas(),
      // Si la cola falla, igual se muestran los indicadores
      cola: this.servicio.colaTemporal().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ cargas, cola }) => {
        const filas = cargas ?? [];
        const humanos = filas.filter(f => !f.agenteTemporal);
        const temporal = filas.find(f => f.agenteTemporal) ?? null;

        this.capacidadGeneral = this.calcularCapacidadGeneral(humanos);
        // Solo se llena con el dato del servidor si la persona no la ha cambiado
        if (!this.capacidadEditada) this.capacidadForm = this.capacidadGeneral;
        this.cola = cola?.items ?? [];
        this.totalCola = cola?.total ?? temporal?.activeCases ?? 0;
        this.kpis = this.armarKpis(temporal, humanos);

        this.cargando = false;
        this.refrescarVista();
      },
      error: (error: HttpErrorResponse) => {
        this.cargando = false;
        this.errorCarga = this.textoError(error, 'No se pudo cargar la distribución de cargas.');
        this.refrescarVista();
      }
    });
  }

  private armarKpis(temporal: CargaAsesorBackend | null, humanos: CargaAsesorBackend[]): Kpi[] {
    const sinDatos = !humanos.length && !temporal;
    const activos = humanos.filter(h => (h.status ?? (h.active ? 'ACTIVE' : 'INACTIVE')) === 'ACTIVE');
    const conCapacidad = activos.filter(h => !h.atCapacity);
    const casos = humanos.reduce((s, h) => s + (h.activeCases ?? 0), 0);
    const enCola = this.totalCola || temporal?.activeCases || 0;
    const valor = (n: number) => (sinDatos ? '—' : n);

    return [
      { titulo: 'Agentes activos', valor: valor(activos.length), detalle: 'Disponibles para operar', icono: 'bi-people', tono: 'verde' },
      { titulo: 'Con capacidad', valor: valor(conCapacidad.length), detalle: 'Disponibles para recibir casos', icono: 'bi-check-circle', tono: 'azul' },
      { titulo: 'Casos asignados', valor: valor(casos), detalle: 'Casos activos', icono: 'bi-stack', tono: 'naranja' },
      { titulo: 'En cola temporal', valor: valor(enCola), detalle: 'Esperando agente con cupo', icono: 'bi-clock', tono: 'morado' }
    ];
  }

  // Es la capacidad de los agentes que no tienen una propia
  private calcularCapacidadGeneral(filas: CargaAsesorBackend[]): number | null {
    const sinPropia = filas.find(f => f.quotaConfigured && !(f.maxCases && f.maxCases > 0));
    return sinPropia ? sinPropia.effectiveMaxCases : null;
  }

  // ==================================================
  // COLA TEMPORAL
  // ==================================================

  tiempoEnCola(fecha: string | null): string {
    if (!fecha) return '—';
    const minutos = Math.floor((Date.now() - new Date(fecha).getTime()) / 60_000);
    if (isNaN(minutos) || minutos < 1) return 'Menos de 1 min';
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `${horas} h ${minutos % 60} min`;
    const dias = Math.floor(horas / 24);
    return `${dias} día${dias === 1 ? '' : 's'} ${horas % 24} h`;
  }

  fechaCorta(fecha: string | null): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return '—';
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
  }

  verCaso(caso: CasoEnColaBackend): void {
    void this.router.navigate(['/gestion-casos'], {
      state: { casoAAbrir: caso.caseNumber ?? caso.caseId }
    });
  }

  // ==================================================
  // REDISTRIBUIR CASOS
  // ==================================================

  pedirRedistribucion(): void {
    this.confirmarRedistribucion = true;
  }

  cancelarRedistribucion(): void {
    if (!this.redistribuyendo) this.confirmarRedistribucion = false;
  }

  redistribuirAhora(): void {
    this.redistribuyendo = true;

    this.servicio.redistribuir().subscribe({
      next: r => {
        this.redistribuyendo = false;
        this.confirmarRedistribucion = false;

        if (r.warning) {
          this.mostrarMensaje(r.warning);
        } else if (!r.totalMoves && !r.assignedFromAgenteTemporal && !r.returnedToAgenteTemporal) {
          this.mostrarMensaje('La carga ya estaba equilibrada: no hubo que mover casos.');
        } else {
          this.mostrarMensaje(
            `Listo: se movieron ${r.totalMoves} casos. ` +
            `${r.assignedFromAgenteTemporal} salieron de la cola temporal y quedan ${r.pendingInAgenteTemporal} en espera.`
          );
        }
        this.cargar();
      },
      error: (error: HttpErrorResponse) => {
        this.redistribuyendo = false;
        this.confirmarRedistribucion = false;
        this.mostrarMensaje(this.textoError(error, 'No se pudieron redistribuir los casos.'));
      }
    });
  }

  // ==================================================
  // UTILIDADES
  // ==================================================

  private textoError(error: HttpErrorResponse, porDefecto: string): string {
    if (error.status === 0) return 'No hay conexión con el servidor.';
    if (error.status === 401) return 'Tu sesión terminó. Vuelve a iniciar sesión.';
    if (error.status === 403) return 'No tienes permiso para ver o hacer esto (se necesita rol Administrador o Supervisor).';
    const cuerpo = error.error;
    if (cuerpo?.message && error.status < 500) return cuerpo.message;
    return porDefecto;
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje = texto;
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.mensaje = '';
      this.refrescarVista();
    }, 5000);
    this.refrescarVista();
  }

  private refrescarVista(): void {
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
  }
}
