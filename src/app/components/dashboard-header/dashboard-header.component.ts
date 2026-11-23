
import { ChangeDetectorRef, Component, OnDestroy, OnInit, Input, Output, EventEmitter, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { DashboardService, UsuarioActual } from '../../service/dashboard.service';
import { CaseService } from '../../service/case.service';
import { DashboardHeader, ManagedCase } from '../../models/dashboard.models';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,

  imports: [
    CommonModule
  ],

  templateUrl: './dashboard-header.component.html',
  styleUrl: './dashboard-header.component.css'
})

export class DashboardHeaderComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  // Usuario que inició sesión (sale del backend)
  usuario: UsuarioActual | null = null;

  // Refresca el texto "Actualizado hace X minutos"
  private reloj?: ReturnType<typeof setInterval>;

  @Input() tituloPersonalizado = '';
  @Input() descripcionPersonalizada = '';
  @Input() casoGestion: ManagedCase | null = null;

  // Mostrar actualizar solo cuando el dashboard principal lo habilite
  @Input() mostrarBotonActualizar = false;

  // Avisar al componente padre que se solicitó actualizar
  @Output() actualizar = new EventEmitter<void>();

  header!: DashboardHeader;

  isModalIAOpen = false;
  menuUsuarioAbierto = false;

  // Ventana "¿Cerrar sesión?" (diseño Figma)
  modalCerrarSesionAbierto = false;

  constructor(
    private dashboardService: DashboardService,
    private caseService: CaseService
  ) { }

  ngOnInit(): void {

    this.dashboardService.getDashboardHeader().subscribe(data => {
      this.header = data;
    });

    this.dashboardService.obtenerUsuarioActual().subscribe(usuario => {
      this.usuario = usuario;
      this.changeDetectorRef.markForCheck();
    });

    if (this.mostrarBotonActualizar) {
      this.reloj = setInterval(() => this.changeDetectorRef.markForCheck(), 30000);
    }

  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
  }

  get actualizando(): boolean {
    return this.dashboardService.actualizando;
  }

  get textoActualizacion(): string {
    const fecha = this.dashboardService.ultimaActualizacion;
    if (!fecha) {
      return 'Cargando información...';
    }

    const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000);
    if (minutos < 1) return 'Actualizado hace un momento';
    if (minutos === 1) return 'Actualizado hace 1 minuto';
    if (minutos < 60) return `Actualizado hace ${minutos} minutos`;

    const horas = Math.floor(minutos / 60);
    return `Actualizado hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  }

  // Solicitar actualización del dashboard
  solicitarActualizacion(): void {
    if (this.actualizando) return;
    this.dashboardService.actualizarDatos();
    this.actualizar.emit();
  }

  formatearEstadoCaso(estado: string | undefined): string {
    if (!estado) {
      return 'Sin estado';
    }

    const nombres: Record<string, string> = {
      EN_GESTION: 'En gestión',
      PROMESA_PAGO: 'Promesa de pago',
      PREJURIDICO: 'Prejurídico',
      CERRADO: 'Cerrado',
      ILOCALIZADO: 'Ilocalizado',
      JURIDICO: 'Jurídico'
    };

    const clave = estado.trim().toUpperCase();
    if (nombres[clave]) {
      return nombres[clave];
    }

    // Otro estado: primera letra en mayúscula
    const texto = estado.toLowerCase().replace(/_/g, ' ');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  // Misma regla de origen que en los filtros
  textoOrigen(origen: string | undefined): string {
    const textos: Record<string, string> = {
      desbordeIA: 'Desborde IA',
      reglaAutomatica: 'Regla o política automática',
      integracionCore: 'Integración CORE',
      integracionCartera: 'Integración de cartera'
    };
    return textos[origen ?? ''] ?? 'Sin información';
  }

  abrirModalIA(): void {
    this.isModalIAOpen = true;
  }

  cerrarModalIA(): void {
    this.isModalIAOpen = false;
  }

  // Apaga o enciende el Motor IA (por ahora solo en pantalla)
  confirmarCambioIA(): void {
    const activar = !this.header?.motorIAActivo;
    this.dashboardService.cambiarEstadoMotorIA(activar).subscribe(() => {
      this.header = { ...this.header, motorIAActivo: activar };
      this.isModalIAOpen = false;
    });
  }

  alternarMenuUsuario(event: MouseEvent): void {
    event.stopPropagation();
    this.menuUsuarioAbierto = !this.menuUsuarioAbierto;
  }

  // Primero se pregunta: la sesión solo se cierra si confirma en la ventana
  pedirCerrarSesion(): void {
    this.menuUsuarioAbierto = false;
    this.modalCerrarSesionAbierto = true;
  }

  cancelarCerrarSesion(): void {
    this.modalCerrarSesionAbierto = false;
  }

  cerrarSesion(): void {
    this.modalCerrarSesionAbierto = false;
    this.menuUsuarioAbierto = false;
    this.caseService.invalidarCache();
    this.dashboardService.limpiarCache();
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    void this.router.navigateByUrl('/login');
  }

  @HostListener('document:click', ['$event'])
  cerrarMenuAlHacerClickFuera(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.menuUsuarioAbierto = false;
    }
  }

  @HostListener('document:keydown.escape')
  cerrarMenuConEscape(): void {
    this.menuUsuarioAbierto = false;
    this.isModalIAOpen = false;
    this.modalCerrarSesionAbierto = false;
  }

}
