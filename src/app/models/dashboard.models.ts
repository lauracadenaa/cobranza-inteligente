// ==================================================
// 1. MODELO PARA LAS TARJETAS KPI
// ==================================================

export interface MetricCard {
  title: string;
  value: string;
  changePercentage?: number;
  periodText?: string;
  status?: 'success' | 'warning' | 'danger' | 'info';
  image?: string;
}

// ==================================================
// 2. MODELO PARA LOS DATOS DE LOS GRÁFICOS
// ==================================================

export interface ChartSeriesData {
  label: string;
  value: number;
}

// ==================================================
// 3. MODELO PARA LA DISTRIBUCIÓN DE CASOS POR ESTADO
// ==================================================

export interface StatusDistribution {
  statusName: string;
  count: number;
  percentage: number;
  color: string;
}

// ==================================================
// 4. MODELO PARA LOS CASOS GESTIONADOS
// ==================================================

export interface ManagedCase {

  // Identificación del caso
  id: string;
  backendId?: number;

  // Identificación del cliente en el backend
  clientId?: number;

  // INFORMACIÓN DE LA PERSONA ASOCIADA
  asociado: string;
  documento?: string;
  celular?: string;
  correoElectronico?: string;
  contactoPreferido?: string;

  // INFORMACIÓN DE LA OBLIGACIÓN
obligacion: string;
obligationId?: number;
saldoVencido?: number;

  // INFORMACIÓN DEL RIESGO
  riesgo: 'Bajo' | 'Medio' | 'Alto' | 'Crítico' | 'Sin información';
  diasMora: number;
  tiempoLimite: string;

  // INFORMACIÓN DE ASIGNACIÓN
  asesor: string;
  nombreAsesor?: string;

  // INFORMACIÓN DEL CASO
  estado?: string;
  segmento?: string;
  fechaCreacion?: string;
  origen?: string;

  // Última gestión (fecha de la última actualización y cantidad de intentos)
  ultimaGestion?: string;
  ultimaGestionDetalle?: string;
  fechaActualizacion?: string;

  // Ruta asignada por el backend
  colaActual?: string;
  skillRuta?: string;
  productoRuta?: string;
  regionRuta?: string;

  // CONTEXTO DE INTELIGENCIA ARTIFICIAL
  scoreIA?: number;
  mejorSiguienteAccion?: string;
  canalSugerido?: string;
  propensionPago?: string;
  motivoPrioridad?: string;
  fechaActualizacionIA?: string;
  confianzaRecomendacion?: number;
  motivoDesborde?: string;
  guionSugerido?: string;

  // HISTÓRICO DE EFECTIVIDAD
  efectividadWhatsApp?: number;
  efectividadSMS?: number;
  efectividadLlamada?: number;
}

// ==================================================
// 5. MODELO DEL HEADER DEL DASHBOARD
// ==================================================

export interface DashboardHeader {
  titulo: string;
  descripcion: string;
  ultimaActualizacion: string;
  motorIAActivo: boolean;
  nombreUsuario: string;
  rolUsuario: string;
}

// ==================================================
// 6. MODELO DE CARTERA POR ANTIGÜEDAD DE MORA
// ==================================================

export interface AgingData {
  rangoMora: string;
  valor: number;
  obligaciones: number;
  asociados: number;
}
