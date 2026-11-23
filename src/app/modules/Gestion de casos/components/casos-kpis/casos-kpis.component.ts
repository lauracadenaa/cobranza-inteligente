import { ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CaseService, BackendCase } from '../../../../service/case.service';
import { ManagedCase } from '../../../../models/dashboard.models';

interface KpiCaso {
  titulo: string;
  valor: string;
  alt: string;
  imagen?: string;
  icono?: string;
  color?: string;
  etiqueta?: string;
  tono?: 'azul' | 'rojo' | 'morado' | 'naranja' | 'verde';
  descripcion?: string;
}

import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ContextoCasos, DashboardService } from '../../../../service/dashboard.service';

@Component({
  selector: 'app-casos-kpis',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './casos-kpis.component.html',
  styleUrl: './casos-kpis.component.css'
})
export class CasosKpisComponent implements OnInit, OnChanges {

  @Input() caso: ManagedCase | null = null;

  // Score del motor IA (lo manda el detalle del caso); se muestra bajo "Riesgo"
  @Input() score: number | null = null;
  cargando = true;
  errorCarga = '';

  // Tarjetas de la vista general (como en Figma).
  // "etiqueta" es la cajita de color y "descripcion" el texto
  // que va al lado. "icono" usa Bootstrap Icons.
  kpis: KpiCaso[] = [
    {
      titulo: 'Casos activos',
      valor: '—',
      icono: 'bi-briefcase',
      color: '#2563EB',
      etiqueta: 'En gestión',
      tono: 'azul',
      descripcion: 'actualmente',
      alt: 'Casos activos'
    },
    {
      titulo: 'Sin asignar',
      valor: '—',
      icono: 'bi-person-plus',
      color: '#F59E0B',
      etiqueta: '',
      tono: 'azul',
      descripcion: 'de la carga',
      alt: 'Casos sin asignar'
    },
    {
      titulo: 'Casos críticos',
      valor: '—',
      icono: 'bi-exclamation-circle',
      color: '#EF4444',
      etiqueta: 'Prioridad',
      tono: 'rojo',
      descripcion: '',
      alt: 'Casos críticos'
    },
    {
      titulo: 'Desbordes IA',
      valor: '—',
      icono: 'bi-diagram-3',
      color: '#8B5CF6',
      etiqueta: 'Requiere gestión humana',
      tono: 'morado',
      descripcion: '',
      alt: 'Desbordes de la IA'
    },
    {
      titulo: 'Tiempo límite vencido',
      valor: '—',
      icono: 'bi-clock',
      color: '#10B981',
      etiqueta: 'Requiere atención',
      tono: 'azul',
      descripcion: '',
      alt: 'Casos con tiempo límite vencido'
    }
  ];

  private kpisGenerales = this.kpis.map(kpi => ({ ...kpi }));

  constructor(
    private caseService: CaseService,
    private changeDetectorRef: ChangeDetectorRef,
    private dashboardService: DashboardService
  ) {}

  // Días máximos de contacto por segmento (SLA), para "Tiempo límite vencido"
  private contexto: ContextoCasos | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['score'] && !changes['caso'] && this.caso) {
      this.actualizarVistaKpis();
    }

    if (changes['caso']) {
      this.actualizarVistaKpis();
    }
  }

  ngOnInit(): void {
    forkJoin({
      casos: this.caseService.obtenerTodosLosCasos(),
      contexto: this.dashboardService.obtenerContextoCasos().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ casos, contexto }) => {
        this.contexto = contexto;
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
    const estado = (caso: BackendCase) =>
      (caso.status || '').trim().toUpperCase();

    const normalizar = (texto?: string | null) =>
      (texto || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toUpperCase();

    // Estados finales: el caso ya no está en gestión
    const estadosCerrados = ['CERRADO', 'ILOCALIZADO', 'JURIDICO'];

    const activos = casos.filter(caso => !estadosCerrados.includes(estado(caso)));

    // Sin asignar: no tiene usuario ni asesor de cobranza
    const sinAsignar = activos.filter(caso =>
      caso.assignedTo == null && caso.advisorId == null && caso.escalatedToAdvisorId == null
    );

    const criticos = activos.filter(caso =>
      normalizar(caso.client?.riskLevel) === 'CRITICO'
    );

    // La IA lo pasó a una persona
    const desbordes = activos.filter(caso =>
      !!caso.escalationReason ||
      !!(caso.humanOverflowReasons && caso.humanOverflowReasons.trim())
    );

    const formato = (n: number) => n.toLocaleString('es-CO');

    // Vencido = ya pasó la fecha de creación + días máximos del segmento
    const vencidos = this.contexto
      ? activos.filter(caso => {
          const segmento = caso.client?.segment || caso.obligation?.segment ||
            this.dashboardService.mapSegment(caso.obligation?.daysPastDue);
          return this.dashboardService
            .calcularTiempoLimite(caso, segmento, this.contexto!.diasSla)
            .startsWith('Vencido');
        })
      : [];

    const porcentajeSinAsignar = activos.length > 0
      ? Math.round(sinAsignar.length / activos.length * 100) + '%'
      : '';

    this.kpisGenerales = this.kpisGenerales.map(kpi => {
      switch (kpi.titulo) {
        case 'Casos activos':
          return { ...kpi, valor: formato(activos.length) };
        case 'Sin asignar':
          return { ...kpi, valor: formato(sinAsignar.length), etiqueta: porcentajeSinAsignar };
        case 'Casos críticos':
          return { ...kpi, valor: formato(criticos.length) };
        case 'Desbordes IA':
          return { ...kpi, valor: formato(desbordes.length) };
        case 'Tiempo límite vencido':
          return { ...kpi, valor: this.contexto ? formato(vencidos.length) : '—' };
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

    const caso = this.caso;

    // Etiqueta de la mora (como en Figma: "Mora alta")
    const mora = caso.diasMora > 90
      ? { etiqueta: 'Mora alta', tono: 'rojo' as const }
      : caso.diasMora > 30
        ? { etiqueta: 'Mora media', tono: 'naranja' as const }
        : { etiqueta: 'Mora baja', tono: 'verde' as const };

    // Tiempo de gestión: vencido o a tiempo
    const vencido = (caso.tiempoLimite || '').toLowerCase().startsWith('vencido');

    this.kpis = [
      {
        titulo: 'Días de mora',
        valor: caso.diasMora.toLocaleString('es-CO'),
        icono: 'bi-calendar-x',
        color: '#DC2626',
        alt: 'Días de mora',
        etiqueta: mora.etiqueta,
        tono: mora.tono
      },
      {
        titulo: 'Saldo total en mora',
        valor: caso.saldoVencido == null
          ? 'Sin información'
          : '$' + Math.round(caso.saldoVencido).toLocaleString('es-CO'),
        icono: 'bi-cash',
        color: '#15803D',
        alt: 'Saldo total en mora'
      },
      {
        titulo: 'Riesgo',
        valor: caso.riesgo,
        icono: 'bi-shield-check',
        color: '#F59E0B',
        alt: 'Riesgo del caso',
        etiqueta: this.score !== null ? 'Score' : undefined,
        tono: 'azul',
        descripcion: this.score !== null ? `${this.score}/1000` : undefined
      },
      {
        titulo: 'Tiempo de gestión',
        valor: caso.tiempoLimite || 'Sin información',
        icono: 'bi-clock',
        color: '#7C3AED',
        alt: 'Tiempo de gestión',
        etiqueta: caso.tiempoLimite ? (vencido ? 'Vencido' : 'En plazo') : undefined,
        tono: vencido ? 'rojo' : 'azul'
      },
      {
        titulo: 'Última gestión',
        valor: caso.ultimaGestion || 'Sin información',
        icono: 'bi-telephone-outbound',
        color: '#2563EB',
        alt: 'Última gestión',
        etiqueta: caso.ultimaGestionDetalle || undefined,
        tono: 'azul'
      }
    ];
  }

}