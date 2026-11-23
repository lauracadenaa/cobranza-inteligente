
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin, Subject } from 'rxjs';
import { map, catchError, switchMap, shareReplay, tap, finalize } from 'rxjs/operators';

import {
  MetricCard,
  ManagedCase,
  DashboardHeader,
  AgingData
} from '../models/dashboard.models';

import { API_CONFIG } from '../core/config/api.config';

// ==================================================
// RESPUESTA DE CASOS
// ==================================================

interface CasesPageResponse {
  content: BackendCase[];
  totalPages?: number;
  page?: { totalPages?: number };
}

// ==================================================
// RESPUESTAS DE USUARIO Y SLA
// ==================================================

interface UsuarioMe {
  userId: number;
  username: string;
  role: string | null;
}

interface UsuarioBackend {
  id: number;
  username: string;
  fullName?: string | null;
}

interface SlaBackend {
  segment: string;
  maxDaysToContact: number;
}

// Datos del usuario que inició sesión (para el encabezado)
export interface UsuarioActual {
  id: number;
  nombre: string;
  rol: string;
  rolCodigo: string;
  iniciales: string;
}

// Datos extra para armar cada fila de casos
export interface ContextoCasos {
  // Usuarios del sistema (id de usuario → nombre)
  asesores: Map<number, string>;
  // Asesores de cobranza (id de asesor → nombre)
  asesoresPorId: Map<number, string>;
  diasSla: Record<string, number>;
}

// Casos por página al pedirlos todos (el backend manda 20 si no se dice nada)
const TAMANO_PAGINA = 500;

// Tiempo máximo para el primer contacto, por segmento (valores iniciales del backend).
// Se usan si el usuario no tiene permiso para leer /admin/sla.
const SLA_POR_DEFECTO: Record<string, number> = {
  PREVENTIVA: 30,
  ADMINISTRATIVA: 15,
  PREJUDICIAL: 10,
  JURIDICA: 5
};

// Motivos de escalamiento que salen de reglas fijas (no de una conversación con la IA)
const MOTIVOS_POR_REGLA = [
  'MAX_CONTACT_ATTEMPTS',
  'HIGH_RISK_SCORE',
  'HIGH_BALANCE',
  'LEGAL_REQUIRED'
];

const NOMBRES_ROL: Record<string, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  AGENT: 'Agente',
  AUDITOR: 'Auditor'
};

interface BackendCase {
  id: number;
  caseNumber?: string;
  status?: string;
  createdAt?: string;
  assignedTo?: string | number | null;
  advisorId?: number | null;
  escalatedToAdvisorId?: number | null;
  batchId?: number | null;
  aiEscalationCount?: number | null;
  escalationReason?: string | null;
  escalatedAdvisorName?: string | null;

  client?: {
    fullName?: string;
    documentNumber?: string;
    riskLevel?: string;
    segment?: string | null;
  };

  obligation?: {
    obligationNumber?: string;
    daysPastDue?: number;
    totalBalance?: number;
  };
}

// ==================================================
// RESPUESTA DE /admin/dashboard
// ==================================================

interface AdminDashboardResponse {

  kpis: {
    totalPortfolioValue: number;
    totalObligations: number;
    activeObligations: number;
    clientsInDefault: number;
    totalClients: number;
    openCases: number;
    inProgressCases: number;
    escalatedCases: number;
    resolvedCases: number;
    totalCases: number;
    activeAdvisors: number;
    activePaymentAgreements: number;
    batchesThisMonth: number;
    totalRecordsThisMonth: number;
    criticalClientsCount: number;
  };

  agingAnalysis: {
    bucket: string;
    daysFrom: number;
    daysTo: number;
    obligationCount: number;
    totalAmount: number;
    percentageOfPortfolio: number;
  }[];

}

// ==================================================
// RESPUESTA DE /analytics/recovery
// ==================================================

interface RecoveryResponse {

  totalCollected: number;

  // Fracción: 0.25 = 25 %
  recoveryRate?: number | null;

  byChannel: Record<string, number>;

  byRiskLevel: Record<string, number>;

  topClients: {
    clientId: number;
    clientName: string;
    amountRecovered: number;
    paymentCount: number;
  }[];

}

@Injectable({
  providedIn: 'root'
})

export class DashboardService {

  constructor(private http: HttpClient) { }

  // ==================================================
  // ESTADO DEL MOTOR IA
  // ==================================================

  private motorIAActivo = true;

  // ==================================================
  // MEMORIA (CACHÉ) Y ACTUALIZACIÓN
  // ==================================================

  // Avisa a los gráficos y tablas que deben volver a cargar
  readonly recargar$ = new Subject<void>();

  // Hora de la última carga de casos y si se está actualizando
  ultimaActualizacion: Date | null = null;
  actualizando = false;

  private cacheCasos?: { token: string | null; datos$: Observable<BackendCase[]> };
  private cacheContexto?: { token: string | null; datos$: Observable<ContextoCasos> };
  private cacheUsuario?: { token: string | null; datos$: Observable<UsuarioActual | null> };
  private nombresUsuarios$?: Observable<Map<number, string>>;
  private nombresToken: string | null = null;

  // ==================================================
  // DATOS DEL HEADER
  // ==================================================

  getDashboardHeader(): Observable<DashboardHeader> {

    const header: DashboardHeader = {
      titulo: 'Dashboard',
      descripcion:
        'Vista general del estado de cartera y gestión de cobranza',
      ultimaActualizacion: 'Actualizado hace 8 min',
      motorIAActivo: this.motorIAActivo,
      nombreUsuario: 'Jou Dou',
      rolUsuario: 'Administrador'
    };

    return of(header);
  }

  // ==================================================
  // DESACTIVAR MOTOR IA
  // ==================================================

  desactivarMotorIA(): Observable<boolean> {
    return this.cambiarEstadoMotorIA(false);
  }

  // Solo guarda el estado en memoria del navegador (no toca el backend).
  // Se mantiene al cambiar de pantalla, pero se reinicia al recargar.
  cambiarEstadoMotorIA(activo: boolean): Observable<boolean> {

    this.motorIAActivo = activo;

    return of(true);
  }

  // ==================================================
  // CARTERA POR ANTIGÜEDAD
  // ==================================================

  getAgingData(): Observable<AgingData[]> {

    return this.obtenerTodosLosCasos().pipe(

      map(casos => {

        const rangos: AgingData[] = [
          { rangoMora: '0 - 30 días', valor: 0, obligaciones: 0, asociados: 0 },
          { rangoMora: '31 - 60 días', valor: 0, obligaciones: 0, asociados: 0 },
          { rangoMora: '61 - 90 días', valor: 0, obligaciones: 0, asociados: 0 },
          { rangoMora: '91 - 180 días', valor: 0, obligaciones: 0, asociados: 0 },
          { rangoMora: '> 180 días', valor: 0, obligaciones: 0, asociados: 0 }
        ];

        const asociadosVistos = new Map<AgingData, Set<string>>();

        casos.forEach(caso => {

          const dias = Number(caso.obligation?.daysPastDue ?? 0);
          const saldo = Number(caso.obligation?.totalBalance ?? 0);

          if (!Number.isFinite(dias) || !Number.isFinite(saldo)) {
            return;
          }

          let indiceRango: number;

          if (dias <= 30) {
            indiceRango = 0;
          } else if (dias <= 60) {
            indiceRango = 1;
          } else if (dias <= 90) {
            indiceRango = 2;
          } else if (dias <= 180) {
            indiceRango = 3;
          } else {
            indiceRango = 4;
          }

          rangos[indiceRango].valor += saldo;
          rangos[indiceRango].obligaciones += 1;
          this.sumarAsociado(rangos[indiceRango], caso, asociadosVistos);

        });

        return rangos;

      })

    );
  }

  // ==================================================
  // CARTERA POR SEGMENTO
  // ==================================================

  getSegmentData(): Observable<AgingData[]> {

    return this.obtenerTodosLosCasos().pipe(

      map(casos => {

        const segmentos: AgingData[] = [
          { rangoMora: 'Preventiva', valor: 0, obligaciones: 0, asociados: 0 },
          { rangoMora: 'Administrativa', valor: 0, obligaciones: 0, asociados: 0 },
          { rangoMora: 'Prejudicial', valor: 0, obligaciones: 0, asociados: 0 },
          { rangoMora: 'Jurídica', valor: 0, obligaciones: 0, asociados: 0 }
        ];

        const asociadosVistos = new Map<AgingData, Set<string>>();

        casos.forEach(caso => {

          const diasMora = Number(caso.obligation?.daysPastDue);
          const saldo = Number(caso.obligation?.totalBalance ?? 0);

          if (
            !Number.isFinite(diasMora) ||
            !Number.isFinite(saldo) ||
            diasMora < 0
          ) {
            return;
          }

          let nombreSegmento: string;

          if (diasMora === 0) {
            nombreSegmento = 'Preventiva';
          } else if (diasMora <= 30) {
            nombreSegmento = 'Administrativa';
          } else if (diasMora <= 90) {
            nombreSegmento = 'Prejudicial';
          } else {
            nombreSegmento = 'Jurídica';
          }

          const segmento = segmentos.find(
            item => item.rangoMora === nombreSegmento
          );

          if (segmento) {
            segmento.valor += saldo;
            segmento.obligaciones += 1;
            this.sumarAsociado(segmento, caso, asociadosVistos);
          }

        });

        return segmentos;

      })

    );
  }

  // ==================================================
  // CARTERA POR RIESGO
  // ==================================================

  getRiskData(): Observable<AgingData[]> {

    return this.obtenerTodosLosCasos().pipe(

      map(casos => {

        const riesgos: AgingData[] = [
          { rangoMora: 'Bajo', valor: 0, obligaciones: 0, asociados: 0 },
          { rangoMora: 'Medio', valor: 0, obligaciones: 0, asociados: 0 },
          { rangoMora: 'Alto', valor: 0, obligaciones: 0, asociados: 0 },
          { rangoMora: 'Crítico', valor: 0, obligaciones: 0, asociados: 0 }
        ];

        const normalizar = (valor?: string): string => {

          return (valor ?? '')
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();

        };

        const asociadosVistos = new Map<AgingData, Set<string>>();

        casos.forEach(caso => {

          const riesgo = normalizar(caso.client?.riskLevel);
          const saldo = Number(caso.obligation?.totalBalance ?? 0);

          const encontrado = riesgos.find(item =>
            normalizar(item.rangoMora) === riesgo
          );

          if (encontrado && Number.isFinite(saldo)) {

            encontrado.valor += saldo;
            encontrado.obligaciones += 1;
            this.sumarAsociado(encontrado, caso, asociadosVistos);

          }

        });

        return riesgos;

      })

    );
  }

  // Cuenta cada asociado (cliente) una sola vez por barra,
  // aunque tenga varias obligaciones en ese grupo.
  private sumarAsociado(
    grupo: AgingData,
    caso: BackendCase,
    vistos: Map<AgingData, Set<string>>
  ): void {
    const clave = caso.client?.documentNumber || caso.client?.fullName || `caso-${caso.id}`;
    const lista = vistos.get(grupo) ?? new Set<string>();
    if (!lista.has(clave)) {
      lista.add(clave);
      grupo.asociados += 1;
    }
    vistos.set(grupo, lista);
  }

  // ==================================================
  // TARJETAS KPI - CONEXIÓN CON BACKEND
  // ==================================================

  getKPIs(): Observable<MetricCard[]> {

    const dashboardUrl =
      `${API_CONFIG.baseUrl}/admin/dashboard`;

    const recoveryUrl =
      `${API_CONFIG.baseUrl}/analytics/recovery`;

    // Período: desde el día 1 del mes actual hasta hoy.

    const fechaActual = new Date();

    const fechaDesde =
      `${fechaActual.getFullYear()}-${String(
        fechaActual.getMonth() + 1
      ).padStart(2, '0')}-01T00:00:00`;

    const textoPeriodo = 'Desde el 1 de ' + fechaActual.toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric'
    });

    const fechaHasta =
      `${fechaActual.getFullYear()}-${String(
        fechaActual.getMonth() + 1
      ).padStart(2, '0')}-${String(
        fechaActual.getDate()
      ).padStart(2, '0')}T23:59:59`;

    const params = new HttpParams()
      .set('from', fechaDesde)
      .set('to', fechaHasta);

    // Formato de moneda colombiana.

    const formatoMoneda = (valor: number): string => {

      return '$' + new Intl.NumberFormat('es-CO', {
        maximumFractionDigits: 0
      }).format(valor);

    };

    return forkJoin({

      dashboard: this.http.get<AdminDashboardResponse>(
        dashboardUrl
      ),

      recovery: this.http.get<RecoveryResponse>(
        recoveryUrl,
        { params }
      ).pipe(

        catchError(error => {

          console.error(
            'ERROR AL CONSULTAR EL RECAUDO:',
            error
          );

          return of({
            totalCollected: 0,
            byChannel: {},
            byRiskLevel: {},
            topClients: []
          } as RecoveryResponse);

        })

      )

    }).pipe(

      map(({ dashboard, recovery }) => {

        const datosKpi = dashboard.kpis;

        // ------------------------------------------
        // 1. CARTERA TOTAL EN MORA
        // ------------------------------------------

        const carteraEnMora = (
          dashboard.agingAnalysis ?? []
        ).filter(rango => {
          const bucket = rango.bucket
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLocaleLowerCase('es-CO');

          return !['sin mora', 'no mora', 'al dia', 'current']
            .includes(bucket);
        })
          .reduce(
            (total, rango) => {
              const monto = Number(rango.totalAmount ?? 0);
              return total + (Number.isFinite(monto) ? monto : 0);
            },
            0
          );

        // ------------------------------------------
        // 2. CASOS ACTIVOS
        // ------------------------------------------

        const casosActivos =
          Number(datosKpi.openCases ?? 0) +
          Number(datosKpi.inProgressCases ?? 0);

        // ------------------------------------------
        // 3. CLIENTES CRÍTICOS
        // ------------------------------------------

        const clientesCriticos =
          Number(datosKpi.criticalClientsCount ?? 0);

        // ------------------------------------------
        // 4. RECAUDO DEL PERÍODO
        // ------------------------------------------

        const recaudo =
          Number(recovery.totalCollected ?? 0);

        // ------------------------------------------
        // 5. TASA DE RECUPERACIÓN
        // ------------------------------------------

        // El backend la manda como fracción (0.25 = 25 %).
        // Si no viene, se muestra "No disponible".

        const tasaRecuperacion = Number(recovery.recoveryRate);
        const hayTasa =
          recovery.recoveryRate !== null &&
          recovery.recoveryRate !== undefined &&
          Number.isFinite(tasaRecuperacion);

        const kpis: MetricCard[] = [

          {
            title: 'Cartera total en mora',
            value: formatoMoneda(carteraEnMora),
            periodText: 'Saldo total en mora',
            status: 'info'
          },

          {
            title: 'Casos activos',
            value: new Intl.NumberFormat('es-CO').format(
              casosActivos
            ),
            periodText: 'Casos abiertos y en gestión',
            status: 'info'
          },

          {
            title: 'Clientes críticos',
            value: new Intl.NumberFormat('es-CO').format(
              clientesCriticos
            ),
            periodText: 'Clientes con riesgo crítico',
            status: 'warning'
          },

          {
            title: 'Recaudo del período',
            value: formatoMoneda(recaudo),
            periodText: textoPeriodo,
            status: 'success'
          },

          {
            title: 'Tasa de recuperación',
            value: hayTasa
              ? new Intl.NumberFormat('es-CO', {
                  style: 'percent',
                  maximumFractionDigits: 1
                }).format(tasaRecuperacion)
              : 'No disponible',
            periodText: hayTasa
              ? 'Recaudo sobre cartera activa'
              : 'Sin datos del período',
            status: 'info'
          }

        ];

        return kpis;

      })

    );

  }

  // ==================================================
  // CONSULTAR CASOS
  // ==================================================

  getManagedCases(): Observable<ManagedCase[]> {

    return forkJoin({
      casos: this.obtenerTodosLosCasos(),
      contexto: this.obtenerContextoCasos()
    }).pipe(
      map(({ casos, contexto }) =>
        casos.map(caso => this.convertirCaso(caso, contexto))
      )
    );
  }

// ==================================================
// DISTRIBUCIÓN DE CASOS POR ESTADO
// ==================================================

getCasesByStatus(): Observable<CaseStatusResponse[]> {

  const url =
    `${API_CONFIG.baseUrl}/admin/dashboard/cases/status`;

  return this.http.get<CaseStatusResponse[]>(url).pipe(

    map(response => response ?? [])

  );

}

  // ==================================================
  // BUSCAR CASOS EN EL BACKEND
  // ==================================================

  searchManagedCases(searchText: string): Observable<ManagedCase[]> {

    const url = `${API_CONFIG.baseUrl}/management/cases/search`;

    const params = new HttpParams()
      .set('q', searchText.trim());

    return forkJoin({
      respuesta: this.http.get<CasesPageResponse>(url, { params }),
      contexto: this.obtenerContextoCasos()
    }).pipe(
      map(({ respuesta, contexto }) =>
        (respuesta.content ?? []).map(caso => this.convertirCaso(caso, contexto))
      )
    );
  }

  // ==================================================
  // TODOS LOS CASOS (todas las páginas)
  // Se guardan en memoria para que los gráficos y la tabla
  // no le pidan lo mismo al backend varias veces.
  // ==================================================

  private obtenerTodosLosCasos(): Observable<BackendCase[]> {

    const token = this.tokenActual();

    if (!this.cacheCasos || this.cacheCasos.token !== token) {

      const url = `${API_CONFIG.baseUrl}/management/cases`;

      const pedirPagina = (pagina: number) =>
        this.http.get<CasesPageResponse>(url, {
          params: new HttpParams()
            .set('page', String(pagina))
            .set('size', String(TAMANO_PAGINA))
            .set('sort', 'id,asc')
        });

      const datos$ = pedirPagina(0).pipe(

        switchMap(primera => {

          const totalPaginas = Number(
            primera.totalPages ?? primera.page?.totalPages ?? 1
          );

          const resto: Observable<CasesPageResponse>[] = [];
          for (let pagina = 1; pagina < totalPaginas; pagina++) {
            resto.push(pedirPagina(pagina));
          }

          return resto.length === 0
            ? of([primera])
            : forkJoin(resto).pipe(map(paginas => [primera, ...paginas]));
        }),

        map(paginas => paginas.flatMap(pagina => pagina.content ?? [])),

        tap(() => (this.ultimaActualizacion = new Date())),

        finalize(() => (this.actualizando = false)),

        // Si falla, se borra para volver a intentar la próxima vez
        shareReplay({ bufferSize: 1, refCount: false })
      );

      this.cacheCasos = { token, datos$ };
    }

    return this.cacheCasos.datos$;
  }

  // ==================================================
  // USUARIO QUE INICIÓ SESIÓN
  // ==================================================

  obtenerUsuarioActual(): Observable<UsuarioActual | null> {

    const token = this.tokenActual();

    if (!this.cacheUsuario || this.cacheUsuario.token !== token) {

      const datos$ = this.http
        .get<UsuarioMe>(`${API_CONFIG.baseUrl}/auth/me`)
        .pipe(

          switchMap(me => {
            const rolCodigo = (me.role ?? '').toUpperCase().replace(/^ROLE_/, '');

            // El nombre completo solo lo da la lista de usuarios (solo administradores)
            const nombres$ = rolCodigo === 'ADMIN'
              ? this.obtenerNombresUsuarios()
              : of(new Map<number, string>());

            return nombres$.pipe(
              map(nombres => {
                const nombre = nombres.get(me.userId) || me.username;
                return {
                  id: me.userId,
                  nombre,
                  rol: NOMBRES_ROL[rolCodigo] ?? (rolCodigo || 'Usuario'),
                  rolCodigo,
                  iniciales: this.sacarIniciales(nombre)
                };
              })
            );
          }),

          catchError(error => {
            console.error('ERROR CONSULTANDO EL USUARIO ACTUAL:', error);
            return of(null);
          }),

          shareReplay({ bufferSize: 1, refCount: false })
        );

      this.cacheUsuario = { token, datos$ };
    }

    return this.cacheUsuario.datos$;
  }

  // ==================================================
  // NOMBRES DE ASESORES Y TIEMPOS LÍMITE (SLA)
  // ==================================================

  obtenerContextoCasos(): Observable<ContextoCasos> {

    const token = this.tokenActual();

    if (!this.cacheContexto || this.cacheContexto.token !== token) {

      const datos$ = this.obtenerUsuarioActual().pipe(

        switchMap(usuario => {
          const rol = usuario?.rolCodigo ?? '';

          // Solo se piden si el rol tiene permiso, para no generar errores 403
          const asesores$ = rol === 'ADMIN'
            ? this.obtenerNombresUsuarios()
            : of(new Map<number, string>());

          const sla$ = ['ADMIN', 'SUPERVISOR', 'AUDITOR'].includes(rol)
            ? this.http.get<SlaBackend[]>(`${API_CONFIG.baseUrl}/admin/sla`).pipe(
                map(lista => {
                  const dias = { ...SLA_POR_DEFECTO };
                  (lista ?? []).forEach(sla => {
                    if (Number.isFinite(Number(sla.maxDaysToContact))) {
                      dias[this.normalizarClave(sla.segment)] = Number(sla.maxDaysToContact);
                    }
                  });
                  return dias;
                }),
                catchError(() => of({ ...SLA_POR_DEFECTO }))
              )
            : of({ ...SLA_POR_DEFECTO });

          // Lista de asesores de cobranza (solo admin y supervisor)
          const asesoresPorId$ = ['ADMIN', 'SUPERVISOR'].includes(rol)
            ? this.http.get<{ advisorId: number; fullName: string }[]>(`${API_CONFIG.baseUrl}/admin/advisors/workload`).pipe(
                map(lista => new Map((lista ?? []).map(a => [Number(a.advisorId), a.fullName] as [number, string]))),
                catchError(() => of(new Map<number, string>()))
              )
            : of(new Map<number, string>());

          return forkJoin({ asesores: asesores$, asesoresPorId: asesoresPorId$, diasSla: sla$ });
        }),

        shareReplay({ bufferSize: 1, refCount: false })
      );

      this.cacheContexto = { token, datos$ };
    }

    return this.cacheContexto.datos$;
  }

  private obtenerNombresUsuarios(): Observable<Map<number, string>> {

    const token = this.tokenActual();

    if (!this.nombresUsuarios$ || this.nombresToken !== token) {
      this.nombresToken = token;
      this.nombresUsuarios$ = this.http
        .get<UsuarioBackend[]>(`${API_CONFIG.baseUrl}/admin/users`, {
          params: new HttpParams().set('includeInactive', 'true')
        })
        .pipe(
          map(lista => new Map(
            (lista ?? []).map(u => [Number(u.id), u.fullName?.trim() || u.username] as [number, string])
          )),
          catchError(() => of(new Map<number, string>())),
          shareReplay({ bufferSize: 1, refCount: false })
        );
    }

    return this.nombresUsuarios$;
  }

  // ==================================================
  // CONVERTIR UN CASO DEL BACKEND A UNA FILA DE LA TABLA
  // ==================================================

  private convertirCaso(caso: BackendCase, contexto: ContextoCasos): ManagedCase {

    const segmento = this.mapSegment(caso.obligation?.daysPastDue);

    return {
      id: caso.caseNumber || String(caso.id),
      asociado: caso.client?.fullName || 'Sin información',
      documento: caso.client?.documentNumber,
      obligacion: caso.obligation?.obligationNumber || 'Sin información',
      saldoVencido: Number(caso.obligation?.totalBalance ?? 0),
      riesgo: this.mapRisk(caso.client?.riskLevel),
      diasMora: caso.obligation?.daysPastDue ?? 0,
      asesor: this.nombreAsesor(caso, contexto),
      estado: caso.status || 'Sin estado',
      segmento,
      fechaCreacion: caso.createdAt || '',
      origen: this.calcularOrigen(caso),
      tiempoLimite: this.calcularTiempoLimite(caso, segmento, contexto.diasSla)
    };
  }

  // Nombre del asesor: primero el asesor de cobranza, luego el usuario asignado
  nombreAsesor(
    caso: { assignedTo?: string | number | null; advisorId?: number | null; escalatedToAdvisorId?: number | null; escalatedAdvisorName?: string | null },
    contexto: ContextoCasos
  ): string {

    const idAsesor = caso.advisorId ?? caso.escalatedToAdvisorId;
    if (idAsesor !== null && idAsesor !== undefined) {
      const nombre = contexto.asesoresPorId.get(Number(idAsesor));
      if (nombre) return nombre;
    }

    const idUsuario = caso.assignedTo;
    if (idUsuario !== null && idUsuario !== undefined && idUsuario !== '') {
      const nombre = contexto.asesores.get(Number(idUsuario));
      if (nombre) return nombre;
    }

    if (caso.escalatedAdvisorName?.trim()) {
      return caso.escalatedAdvisorName.trim();
    }

    const id = idAsesor ?? idUsuario;
    return id !== null && id !== undefined && id !== ''
      ? `Asesor #${id}`
      : 'Sin asignar';
  }

  // De dónde salió el caso:
  // - Escalado por una regla fija (intentos, riesgo, saldo, jurídico) → Regla automática
  // - Escalado por otra razón de la IA → Desborde IA
  // - Sin escalar y creado por una carga de archivo → Integración de cartera
  // - Sin escalar y sin carga de archivo → Integración CORE
  calcularOrigen(caso: { escalationReason?: string | null; aiEscalationCount?: number | null; batchId?: number | null }): string {

    const motivo = (caso.escalationReason ?? '').toUpperCase();

    if (motivo) {
      return MOTIVOS_POR_REGLA.includes(motivo) ? 'reglaAutomatica' : 'desbordeIA';
    }

    if (Number(caso.aiEscalationCount ?? 0) > 0) {
      return 'desbordeIA';
    }

    return caso.batchId !== null && caso.batchId !== undefined
      ? 'integracionCartera'
      : 'integracionCore';
  }

  // Tiempo límite = fecha de creación + días máximos para contactar (según el segmento)
  calcularTiempoLimite(
    caso: { status?: string | null; createdAt?: string | null },
    segmento: string,
    diasSla: Record<string, number>
  ): string {

    const estado = (caso.status ?? '').toUpperCase();
    if (estado.includes('CERRADO') || estado.includes('RESUEL') || estado.includes('CLOSED')) {
      return 'Cerrado';
    }

    const dias = diasSla[this.normalizarClave(segmento)];
    const creado = caso.createdAt ? new Date(caso.createdAt) : null;

    if (dias === undefined || !creado || Number.isNaN(creado.getTime())) {
      return 'Sin información';
    }

    const UN_DIA = 24 * 60 * 60 * 1000;
    const restante = creado.getTime() + dias * UN_DIA - Date.now();

    if (restante < 0) {
      const diasVencido = Math.floor(-restante / UN_DIA);
      return diasVencido === 0
        ? 'Vencido hoy'
        : `Vencido hace ${diasVencido} ${diasVencido === 1 ? 'día' : 'días'}`;
    }

    const diasFaltan = Math.floor(restante / UN_DIA);
    if (diasFaltan === 0) {
      const horas = Math.max(1, Math.floor(restante / (60 * 60 * 1000)));
      return `${horas} h restantes`;
    }

    return `${diasFaltan} ${diasFaltan === 1 ? 'día' : 'días'} restantes`;
  }

  // ==================================================
  // ACTUALIZAR TODO EL DASHBOARD
  // ==================================================

  actualizarDatos(): void {
    this.limpiarCache();
    this.actualizando = true;
    this.recargar$.next();
  }

  limpiarCache(): void {
    this.cacheCasos = undefined;
    this.cacheContexto = undefined;
    this.cacheUsuario = undefined;
    this.nombresUsuarios$ = undefined;
  }

  // ==================================================
  // AYUDAS
  // ==================================================

  private tokenActual(): string | null {
    return typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('token')
      : null;
  }

  private normalizarClave(texto: string): string {
    return (texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private sacarIniciales(nombre: string): string {
    const partes = nombre.trim().split(/[\s._-]+/).filter(Boolean);
    return partes.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('') || '?';
  }

  // ==================================================
  // CALCULAR SEGMENTO SEGÚN DÍAS DE MORA
  // ==================================================

  mapSegment(daysPastDue?: number | null): string {

    const dias = Number(daysPastDue);

    if (!Number.isFinite(dias) || dias < 0) {
      return 'Sin segmento';
    }

    if (dias === 0) {
      return 'Preventiva';
    }

    if (dias <= 30) {
      return 'Administrativa';
    }

    if (dias <= 90) {
      return 'Prejudicial';
    }

    return 'Jurídica';
  }

  // ==================================================
  // CONVERTIR NIVEL DE RIESGO
  // ==================================================

  private mapRisk(risk?: string): ManagedCase['riesgo'] {

    const riesgo = (risk ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    switch (riesgo) {

      case 'BAJO':
        return 'Bajo';

      case 'MEDIO':
        return 'Medio';

      case 'ALTO':
        return 'Alto';

      case 'CRITICO':
        return 'Crítico';

      default:
        return 'Medio';

    }
  }

}

// ==================================================
// RESPUESTA DE DISTRIBUCIÓN DE CASOS POR ESTADO
// ==================================================

export interface CaseStatusResponse {
  status: string;
  label: string;
  count: number;
  percentage: number;
}