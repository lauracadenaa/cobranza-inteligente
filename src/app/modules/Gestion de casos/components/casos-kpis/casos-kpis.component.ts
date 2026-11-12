import { ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CaseService, BackendCase } from '../../../../service/case.service';
import { ManagedCase } from '../../../../models/dashboard.models';

@Component({
  selector: 'app-casos-kpis',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './casos-kpis.component.html',
  styleUrl: './casos-kpis.component.css'
})
export class CasosKpisComponent implements OnInit, OnChanges {

  @Input() caso: ManagedCase | null = null;
  cargando = true;
  errorCarga = '';

  kpis = [
    {
      titulo: 'Casos asignados',
      valor: '—',
      imagen: '/imagenes/Gestioncasos/Casos-asignados.png',
      alt: 'Casos asignados'
    },
    {
      titulo: 'Pendientes de gestión',
      valor: '—',
      imagen: '/imagenes/Gestioncasos/Pendientes-gestion.png',
      alt: 'Pendientes de gestión'
    },
    {
      titulo: 'Seguimientos hoy',
      valor: '—',
      imagen: '/imagenes/Gestioncasos/SeguimientosHoy.png',
      alt: 'Seguimientos hoy'
    },
    {
      titulo: 'Asociados',
      valor: '—',
      imagen: '/imagenes/Gestioncasos/Asociados.png',
      alt: 'Asociados'
    },
    {
      titulo: 'Promesas activas',
      valor: '—',
      imagen: '/imagenes/Gestioncasos/Promesas-activas.png',
      alt: 'Promesas activas'
    }
  ];

  private kpisGenerales = this.kpis.map(kpi => ({ ...kpi }));

  constructor(
    private caseService: CaseService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['caso']) {
      this.actualizarVistaKpis();
    }
  }

  ngOnInit(): void {
    this.caseService.obtenerTodosLosCasos().subscribe({
      next: casos => {
        this.actualizarKpis(casos);
        this.cargando = false;
        this.changeDetectorRef.detectChanges();
      },
      error: error => {
        console.error('Error cargando indicadores de casos:', error);
        this.errorCarga =
          'No fue posible cargar los indicadores de casos.';
        this.cargando = false;
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  private actualizarKpis(casos: BackendCase[]): void {
    const casosAsignados = casos.filter(caso => caso.assignedTo != null);
    const pendientes = casos.filter(caso =>
      (caso.status || '').trim().toUpperCase() === 'NUEVO'
    );
    const asociados = new Set(
      casos
        .map(caso =>
          caso.client?.id ??
          caso.client?.documentNumber ??
          caso.client?.fullName
        )
        .filter((identificador): identificador is string | number =>
          identificador !== null && identificador !== undefined &&
          identificador !== ''
        )
    );
    const promesasActivas = casos.filter(caso =>
      (caso.status || '').trim().toUpperCase() === 'PROMESA_PAGO'
    );

    this.kpisGenerales = this.kpisGenerales.map(kpi => {
      switch (kpi.titulo) {
        case 'Casos asignados':
          return { ...kpi, valor: casosAsignados.length.toLocaleString('es-CO') };
        case 'Pendientes de gestión':
          return { ...kpi, valor: pendientes.length.toLocaleString('es-CO') };
        case 'Seguimientos hoy':
          return { ...kpi, valor: '—' };
        case 'Asociados':
          return { ...kpi, valor: asociados.size.toLocaleString('es-CO') };
        case 'Promesas activas':
          return { ...kpi, valor: promesasActivas.length.toLocaleString('es-CO') };
        default:
          return kpi;
      }
    });
    this.actualizarVistaKpis();
  }

  private actualizarVistaKpis(): void {
    if (!this.caso) {
      this.kpis = this.kpisGenerales.map(kpi => ({ ...kpi }));
      return;
    }

    this.kpis = [
      {
        titulo: 'Días de mora',
        valor: this.caso.diasMora.toLocaleString('es-CO'),
        imagen: '/imagenes/Gestioncasos/Pendientes-gestion.png',
        alt: 'Días de mora'
      },
      {
        titulo: 'Saldo total en mora',
        valor: this.caso.saldoVencido == null
          ? 'Sin información'
          : new Intl.NumberFormat('es-CO', {
              style: 'currency',
              currency: 'COP',
              maximumFractionDigits: 0
            }).format(this.caso.saldoVencido),
        imagen: '/imagenes/Gestioncasos/Casos-asignados.png',
        alt: 'Saldo total en mora'
      },
      {
        titulo: 'Riesgo',
        valor: this.caso.riesgo,
        imagen: '/imagenes/Gestioncasos/Promesas-activas.png',
        alt: 'Riesgo del caso'
      },
      {
        titulo: 'Tiempo de gestión',
        valor: this.caso.tiempoLimite || 'Sin información',
        imagen: '/imagenes/Gestioncasos/SeguimientosHoy.png',
        alt: 'Tiempo de gestión'
      },
      {
        titulo: 'Última gestión',
        valor: 'Sin información',
        imagen: '/imagenes/Gestioncasos/Asociados.png',
        alt: 'Última gestión'
      }
    ];
  }

}