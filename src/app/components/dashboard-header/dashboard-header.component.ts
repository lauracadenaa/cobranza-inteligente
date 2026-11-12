
import { Component, OnInit, Input, Output, EventEmitter, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { DashboardService } from '../../service/dashboard.service';
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

export class DashboardHeaderComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

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

  constructor(
    private dashboardService: DashboardService,
    private caseService: CaseService
  ) { }

  ngOnInit(): void {

    this.dashboardService.getDashboardHeader().subscribe(data => {
      this.header = data;
    });

  }

  // Solicitar actualización del dashboard
  solicitarActualizacion(): void {
    this.actualizar.emit();
  }

  formatearEstadoCaso(estado: string | undefined): string {
    if (!estado) {
      return 'Sin estado';
    }

    return estado.toLowerCase().replace(/_/g, ' ');
  }

  abrirModalIA(): void {
    this.isModalIAOpen = true;
  }

  cerrarModalIA(): void {
    this.isModalIAOpen = false;
  }

  alternarMenuUsuario(event: MouseEvent): void {
    event.stopPropagation();
    this.menuUsuarioAbierto = !this.menuUsuarioAbierto;
  }

  cerrarSesion(): void {
    this.menuUsuarioAbierto = false;
    this.caseService.invalidarCache();
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
  }

}
