
import { Routes } from '@angular/router';

import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LoginComponent } from './components/login/login.component';

import { CarteraComponent } from './modules/Cartera/components/cartera.component';

import { GestionCasosComponent } from './modules/Gestion de casos/components/gestion-casos.component';

// Reportes y auditoría
import { ReportesYaAuditoriaComponent } from './modules/Reportes y auditoria/reportesyauditoria.component';

// Links y pagos
import { LinksPagosComponent } from './modules/Links y pagos/links-pagos.component';

// Motor IA
import { MotorIaComponent } from './modules/Motor IA/components/motor-ia.component';

// Estrategias
import { EstrategiasComponent } from './modules/Estrategias/estrategias.component';

// Administración
import { AdministracionComponent } from './modules/Administración/administracion.component';

export const routes: Routes = [

  // Inicio de sesión
  {
    path: 'login',
    component: LoginComponent
  },

  // Cambio obligatorio de contraseña
  {
    path: 'change-password',
    component: LoginComponent
  },

  // Dashboard
  {
    path: 'dashboard',
    component: DashboardComponent
  },

  // Módulo Cartera
  {
    path: 'cartera',
    component: CarteraComponent
  },

  // Módulo Gestión de casos
  {
    path: 'gestion-casos',
    component: GestionCasosComponent
  },

  // Módulo Reportes y auditoría
  {
    path: 'reportes-auditoria',
    component: ReportesYaAuditoriaComponent
  },

  // Módulo Estrategias
  {
    path: 'estrategias',
    component: EstrategiasComponent
  },

  // Módulo Links y pagos
  {
    path: 'links-pagos',
    component: LinksPagosComponent
  },

  // Módulo Motor IA
  {
    path: 'motor-ia',
    component: MotorIaComponent
  },

  // Módulo Administración
  {
    path: 'administracion',
    component: AdministracionComponent
  },

  // Ruta inicial
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }

];
