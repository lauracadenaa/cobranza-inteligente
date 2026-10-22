// 1. Molde para las tarjetas de la parte superior (KPIs)
export interface MetricCard {
  title: string;              // Ejemplo: "Cartera total en mora"
  value: string;              // Ejemplo: "$326.1M"
  changePercentage?: number;  // Ejemplo: 6.6
  periodText?: string;        // Ejemplo: "vs mes anterior"
  status?: 'success' | 'warning' | 'danger' | 'info';

  // Ruta de la imagen de cada KPI
  image?: string;
  
}

// 2. Molde para las barras o datos del gráfico
export interface ChartSeriesData {
  label: string;  // Ejemplo: "0 a 30 días"
  value: number;  // Ejemplo: 40.0M
}

// 3. Molde para la distribución de casos por estado (El gráfico circular/dona)
export interface StatusDistribution {
  statusName: string; // Ejemplo: "En gestión"
  count: number;      // Ejemplo: 542
  percentage: number; // Ejemplo: 45.66
  color: string;      // Ejemplo: "#7C3AED" (púrpura)
}

// 4. Modelo para las filas de la tabla de casos gestionados
export interface ManagedCase {

  id: string;
  asociado: string;
  documento?: string;
  obligacion: string;
  saldoVencido?: number;

  riesgo: 'Bajo' | 'Medio' | 'Alto' | 'Crítico';

  diasMora: number;
  tiempoLimite: string;
  asesor: string;

  // Nuevos campos para los filtros
  estado?: string;
  segmento?: string;
  fechaCreacion?: string;

}

// ==================================================
// MODELO DEL HEADER DEL DASHBOARD
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
// MODELO DE CARTERA POR ANTIGÜEDAD DE MORA
// ==================================================

export interface AgingData {

  rangoMora: string;

  valor: number;

  obligaciones: number;

}