
import {
  ChangeDetectorRef,
  Component,
  Input,
  Output,
  EventEmitter,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ManagedCase } from '../../models/dashboard.models';
import { DashboardService } from '../../service/dashboard.service';

import { Subject, of } from 'rxjs';

import {
  switchMap,
  catchError,
  finalize,
  takeUntil
} from 'rxjs/operators';

import { IconoComponent } from '../../shared/icono/icono.component';

@Component({
  selector: 'app-search-case',
  standalone: true,
  imports: [IconoComponent, 
    CommonModule,
    FormsModule
  ],
  templateUrl: './search-case.component.html',
  styleUrl: './search-case.component.css'
})

export class SearchCaseComponent implements OnDestroy {

  // ==================================================
  // CONSTRUCTOR Y CONTROL DE SUSCRIPCIONES
  // ==================================================

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private dashboardService: DashboardService,
    private changeDetectorRef: ChangeDetectorRef
  ) {

    this.searchSubject.pipe(

      switchMap(texto => {

        if (texto.length < 3) {
          this.isLoading = false;
          return of([]);
        }

        this.isLoading = true;
        this.searchError = false;

        return this.dashboardService.searchManagedCases(texto).pipe(
          catchError(error => {

            console.error('Error buscando casos:', error);

            this.searchError = true;

            return of([]);

          }),

          finalize(() => {
            this.isLoading = false;
            this.changeDetectorRef.markForCheck();
          })

        );

      }),

      takeUntil(this.destroy$)

    ).subscribe(resultados => {

      this.filteredCases = resultados;
      this.changeDetectorRef.markForCheck();

    });

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSubject.complete();
  }

  // ==================================================
  // RECIBIR Y ENVIAR INFORMACIÓN
  // ==================================================

  @Input() isOpen = false;

  @Input() cases: ManagedCase[] = [];

  @Output() closed = new EventEmitter<void>();

  // Envía el caso elegido (o nada, si solo se quiere ir a Gestión de casos)
  @Output() goToCases = new EventEmitter<ManagedCase | null>();

  // ==================================================
  // CONTROL DE BÚSQUEDA
  // ==================================================

  isSearching = false;
  isLoading = false;
  searchText = '';

  // ==================================================
  // CONTROL DE ERROR
  // ==================================================

  searchError = false;

  // ==================================================
  // RESULTADOS
  // ==================================================

  filteredCases: ManagedCase[] = [];

  // ==================================================
  // CONTROL DEL MODAL DE RESUMEN
  // ==================================================

  showCaseSummary = false;

  selectedCase: ManagedCase | null = null;

  openCaseSummary(caso: ManagedCase): void {
    this.selectedCase = caso;
    this.showCaseSummary = true;
  }

  closeCaseSummary(): void {
    this.showCaseSummary = false;
    this.selectedCase = null;
  }

  showAssociatedCases(caso: ManagedCase): void {

    this.searchText = caso.documento || caso.asociado;

    this.closeCaseSummary();

    this.onSearch();
  }

  // ==================================================
  // CONVERTIR ESTADO A TEXTO VISIBLE
  // ==================================================

  getEstadoLabel(estado?: string): string {

    const normalized = (estado ?? '')
      .replace(/[_-]/g, ' ')
      .trim()
      .toLowerCase();

    const labels: Record<string, string> = {
      nuevo: 'Nuevo',
      'en gestion': 'En Gestión',
      'promesa pago': 'Promesa activa',
      'promesa de pago': 'Promesa activa',
      cerrado: 'Cerrado'
    };

    return labels[normalized] ?? (estado || 'Sin estado');
  }

  // ==================================================
  // CLASE CSS SEGÚN EL ESTADO
  // ==================================================

  getEstadoClass(estado?: string): string {

    const normalized = (estado ?? '')
      .replace(/[_-]/g, ' ')
      .trim()
      .toLowerCase();

    if (normalized.includes('promesa')) return 'status-promise';
    if (normalized === 'en gestion') return 'status-in-progress';
    if (normalized === 'nuevo') return 'status-new';
    if (normalized === 'cerrado') return 'status-closed';

    return 'status-default';
  }

  // ==================================================
  // CLASE CSS SEGÚN EL RIESGO
  // ==================================================

  getRiesgoClass(riesgo: ManagedCase['riesgo']): string {

    return `risk-${riesgo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()}`;
  }

  // ==================================================
  // FORMATEAR SALDO
  // ==================================================

  formatBalance(balance?: number): string {

    if (balance === undefined || !Number.isFinite(balance)) {
      return 'Sin información';
    }

    return `$${Math.round(balance).toLocaleString('es-CO')}`;
  }

  // ==================================================
  // FORMATEAR FECHA
  // ==================================================

  formatDate(date?: string): string {

    if (!date) {
      return 'Sin información';
    }

    const [year, month, day] = date.slice(0, 10).split('-');

    return year && month && day
      ? `${day}/${month}/${year}`
      : date;
  }

  // ==================================================
  // INICIAR BÚSQUEDA EN EL BACKEND
  // ==================================================

  onSearch(): void {

    const texto = this.searchText.trim();

    this.searchError = false;

    if (texto.length < 3) {

      this.isSearching = false;
      this.isLoading = false;
      this.filteredCases = [];

      this.searchSubject.next('');

      return;
    }

    this.isSearching = true;
    this.isLoading = true;
    this.filteredCases = [];

    this.searchSubject.next(texto);

  }

  // ==================================================
  // REINTENTAR BÚSQUEDA
  // ==================================================

  retrySearch(): void {

    this.searchError = false;

    // Permitir repetir incluso la misma búsqueda.
    this.searchSubject.next('');

    this.onSearch();

  }

  // ==================================================
  // DESCRIPCIÓN CUANDO NO HAY RESULTADOS
  // ==================================================

  getSearchDescription(): string {

    const texto = this.searchText.trim();

    if (/^CAS[-\s]?\d/i.test(texto)) {

      return 'Verifica el número ingresado o busca por asociado, documento u obligación.';
    }

    if (/^\d+$/.test(texto)) {

      return 'Verifica el número ingresado o busca por asociado, documento u obligación.';
    }

    return 'Verifica el nombre ingresado o busca por número de caso, documento u obligación.';

  }

  // ==================================================
  // CERRAR MODAL DE BÚSQUEDA
  // ==================================================

  close(): void {

    this.isSearching = false;
    this.isLoading = false;

    this.searchText = '';

    this.filteredCases = [];

    this.searchError = false;

    this.showCaseSummary = false;

    this.selectedCase = null;

    this.searchSubject.next('');

    this.closed.emit();

  }

  // ==================================================
  // LIMPIAR BÚSQUEDA
  // ==================================================

  clearSearch(): void {

    this.searchText = '';

    this.isSearching = false;
    this.isLoading = false;

    this.filteredCases = [];

    this.searchError = false;

    this.searchSubject.next('');

  }

  // ==================================================
  // IR A GESTIÓN DE CASOS
  // ==================================================

  goToCaseManagement(caso: ManagedCase | null = null): void {

    this.goToCases.emit(caso);

  }

}
