
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';

import { DashboardService } from '../../service/dashboard.service';
import { MetricCard } from '../../models/dashboard.models';
import { IconoComponent } from '../../shared/icono/icono.component';

@Component({
  selector: 'app-kpi-cards',
  standalone: true,

  imports: [
    CommonModule,
    IconoComponent
  ],

  templateUrl: './kpi-cards.component.html',
  styleUrl: './kpi-cards.component.css'
})

export class KpiCardsComponent implements OnInit {

  // ==================================================
  // LISTA DE INDICADORES
  // ==================================================

  kpis: (MetricCard & { iconColor?: string })[] = [];

  // ==================================================
  // CONSTRUCTOR
  // ==================================================

  constructor(
    private dashboardService: DashboardService,
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  // ==================================================
  // INICIALIZACIÓN
  // ==================================================

  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {

    this.cargar();

    this.dashboardService.recargar$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargar());

  }

  private cargar(): void {

    this.dashboardService.getKPIs().subscribe(data => {

      // Ícono (Lucide, en código) y color de cada tarjeta, como en el Figma
      const iconos = [
        { nombre: 'wallet', color: '#3B82F6' },
        { nombre: 'file-text', color: '#10989B' },
        { nombre: 'triangle-alert', color: '#F59E0B' },
        { nombre: 'trending-up', color: '#10B981' },
        { nombre: 'bot', color: '#8B5CF6' }
      ];

      this.kpis = data.map((kpi, index) => ({
        ...kpi,
        image: iconos[index]?.nombre ?? '',
        iconColor: iconos[index]?.color ?? '#64748B'
      }));

      this.changeDetectorRef.markForCheck();
    });

  }

}
